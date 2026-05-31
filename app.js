import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import mongoose from 'mongoose'; // นำเข้า mongoose สำหรับต่อ DB

// 1. ตรวจสอบ API Key และ DB URI จาก Environment Variable
if (!process.env.TYPHOON_API_KEY) {
  console.error('❌ Error: ไม่พบ TYPHOON_API_KEY ใน Environment Variables');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('❌ Error: ไม่พบ MONGODB_URI ใน Environment Variables');
  process.exit(1);
}

// เชื่อมต่อฐานข้อมูล MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🍃 Connected to MongoDB Atlas successfully!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  history: [
    {
      role: { type: String, required: true },
      content: { type: String, required: true }
    }
  ],
  updatedAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const openai = new OpenAI({
  apiKey: process.env.TYPHOON_API_KEY, 
  baseURL: 'https://api.opentyphoon.ai/v1',
});

const MAX_HISTORY = 6; // จำกัดประวัติใน DB ไม่ให้ยาวเกินไป เพื่อเซฟ Token

// ✨ [อัปเดตปี 2026] รายการวันหยุดทางศาสนาที่ห้ามขายแอลกอฮอล์ / ร้านต้องปิด (Format: YYYY-MM-DD)
const BUDDHIST_HOLIDAYS = [
  '2026-03-03', // วันมาฆบูชา
  '2026-05-31', // วันวิสาขบูชา
  '2026-07-29', // วันอาสาฬหบูชา
  '2026-07-30', // วันเข้าพรรษา
  '2026-10-26', // วันออกพรรษา
];

// ฟังก์ชันสร้าง System Prompt แบบ Dynamic เพื่อบังคับ AI ตามวันที่ปัจจุบัน
function getDynamicSystemPrompt() {
  // ดึงเวลาปัจจุบันในไทย
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const todayStr = now.toISOString().split('T')[0]; // แปลงเป็น YYYY-MM-DD
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const isTodayHoliday = BUDDHIST_HOLIDAYS.includes(todayStr);
  const isTomorrowHoliday = BUDDHIST_HOLIDAYS.includes(tomorrowStr);

  let shopStatus = 'เปิดทุกวัน 17.00 - 02.00 น.';
  if (isTodayHoliday) {
    shopStatus = '🔴 **วันนี้ร้านปิดให้บริการ** (เนื่องจากเป็นวันสำคัญทางพระพุทธศาสนา)';
  } else if (isTomorrowHoliday) {
    shopStatus = '🟡 วันนี้ร้านเปิด 17.00 น. แต่ **ปิดเร็วกว่าปกติในเวลา 00.00 น. (เที่ยงคืน)** (เนื่องจากพรุ่งนี้เป็นวันสำคัญทางพระพุทธศาสนา)';
  }

  return `Role & Identity
คุณคือ "ท่าช้าง" แอดมิน AI (ผู้ชาย) ของร้าน "ท่าช้าง รัชโยธิน" บุคลิกอารมณ์ดี เป็นกันเอง แต่ชัดเจนและเด็ดขาด (หากตอบเป็นภาษาไทย ให้ลงท้ายด้วย "ครับ" ทุกครั้ง)

สถานะร้านแบบ Real-time ณ ปัจจุบัน (ยึดตามข้อมูลนี้เป็นหลักในการตอบลูกค้า)
สถานะร้านวันนี้: ${shopStatus}

กฎเหล็กในการตอบ (STRICT RULES - ต้องปฏิบัติตามอย่างเคร่งครัด)
1. ❌ ห้ามเดาข้อมูล! หากลูกค้าถามเรื่องที่ไม่มีใน Knowledge Base หรือคุณไม่มั่นใจ ให้ตอบว่า "เรื่องนี้เดี๋ยวรอแอดมินมาตอบสักครู่นะครับ" เท่านั้น ห้ามสร้างข้อมูลเองเด็ดขาด
2. ❌ ห้ามแถมข้อมูล! ถามคำไหน ตอบคำนั้นให้ตรงประเด็น สั้นและกระชับที่สุด ไม่ต้องอธิบายเพิ่มเกินความจำเป็น
3. ใช้ Bullet points และ Emoji แยกบรรทัดให้อ่านง่าย
4. 🔴 MULTILINGUAL SUPPORT: หากลูกค้าพิมพ์ภาษาอังกฤษ, จีน หรืออื่นๆ "ต้องแปลคำตอบจาก Knowledge Base และตอบกลับเป็นภาษานั้นๆ 100%" (ห้ามมีภาษาไทยปน และไม่ต้องลงท้ายครับ)
5. หาก "สถานะร้านวันนี้" ระบุว่าร้านปิด ให้แจ้งลูกค้าไปตรงๆ ทันทีว่าวันนี้ร้านปิดตามประกาศ

Knowledge Base (ข้อมูลร้านสำหรับอ้างอิง)
เวลาปกติเปิด-ปิด: เปิดทุกวัน 17.00 - 02.00 น. (เช็ก "สถานะร้านวันนี้" ด้านบนก่อนตอบเสมอ)
พิกัด: ใกล้เมเจอร์รัชโยธิน (BTS รัชโยธิน ทางออก 2) | Map: https://maps.app.goo.gl/v13faovZ1zEPF47h8
อายุเข้าใช้บริการ: 20 ปีบริบูรณ์ขึ้นไปเท่านั้น
เอกสารเข้าตรวจ: บัตรประชาชน/ใบขับขี่/พาสปอร์ต "ตัวจริง" หรือแอป ThaID เท่านั้น ❌ ห้ามใช้รูปถ่ายบัตรในมือถือเด็ดขาด!
การจองโต๊ะ: ❌ ไม่รับจองผ่านแชท/แอดมิน และไม่รับจองล่วงหน้าข้ามวัน
วิธีจองโต๊ะ: โทรจองวันต่อวันเท่านั้นที่เบอร์ 📞 092-525-3885 (เวลา 13.00 - 17.00 น.) เลือกโซนไม่ได้
ถ้าโทรไม่ติด: เนื่องจากลูกค้าติดต่อจำนวนมากแนะนำให้โทรย้ำๆ
เงื่อนไขโต๊ะจอง: ต้องมาถึงก่อน 19.00 น. และเพื่อนในกลุ่มต้องมาแสตนบายด์อย่างน้อย "ครึ่งหนึ่ง"
คิว Walk-in หน้าร้าน: เริ่มรับคิว 17.00 น. / เรียกคิว 18.00 น. (เรียก 3-4 ครั้งไม่อยู่ ขอข้ามคิวทันที)
เมนู/โปรโมชั่น: https://stickerthachang.my.canva.site/menu-promotion
รับฝากของ: ให้ติดต่อหน้าร้านโดยตรง
ค่าจองโต๊ะ: ไม่เสียค่าจอง ยกเว้นมี Event
ลานเกย์: ลานอเวนิวหน้าเวทีเป็นจุดรวมพล รีบจอยรีบคุยก่อนโดนการ์ดเชิญออก

Response Guidelines (แนวทางเมื่อโดนถาม)
- [ลูกค้าจองในแชท]: ปฏิเสธสุภาพ -> ให้เบอร์โทร 092-525-3885 -> แจ้งเวลาโทร 13.00-17.00 น.
- [ลูกค้าถามเรื่องบัตร/อายุ]: ย้ำอายุ 20+ -> ห้ามใช้รูปถ่ายบัตร -> แนะนำแอป ThaID
- [โต๊ะว่าง/เต็ม/โอนเงินซ้ำ/ของหาย]: แจ้งว่านี่คือระบบอัตโนมัติ ให้รอแอดมินมาตรวจสอบ
- [ลูกค้าขอบคุณ]: ตอบยินดีให้บริการ`;
}

app.get('/', (req, res) => {
  res.send('🚀 เซิร์ฟเวอร์ท่าช้างทำงานปกติ  MongoDB Atlas!');
});

app.post('/chat', async (req, res) => {
  console.log('📥 Zapier POST Body:', JSON.stringify(req.body));

  // เช็กสถานะการเชื่อมต่อ Database ก่อนทำงาน ป้องกันอาการค้าง
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ Database connection is not ready. Current state:', mongoose.connection.readyState);
    return res.status(500).json({ error: 'ระบบฐานข้อมูลยังไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้งครับ' });
  }

  const body = Array.isArray(req.body) ? req.body[0] : req.body;
  const userMessage = body?.message || body?.Message || body?.text;
  const userId = body?.userId || body?.user_id || body?.senderId || 'default_user';

  if (!userMessage) {
    return res.status(400).json({ error: 'กรุณาส่ง message มาใน body ด้วยครับ' });
  }

  try {
    // 1. ดึงประวัติแชทเก่าของ userId นี้จาก MongoDB
    let chatSession = await Chat.findOne({ userId });
    if (!chatSession) {
      chatSession = new Chat({ userId, history: [] });
    }

    // 2. ใส่ข้อความใหม่ของลูกค้าลงในประวัติ
    chatSession.history.push({ role: 'user', content: userMessage });

    const formattedHistory = chatSession.history.map(item => ({
      role: item.role,
      content: item.content
    }));

    // ✨ เรียกใช้ Dynamic Prompt ที่คำนวณวันที่เรียบร้อยแล้ว
    const messages = [
      { role: 'system', content: getDynamicSystemPrompt() },
      ...formattedHistory
    ];

    // เรียกใช้งาน API
    const response = await openai.chat.completions.create({
      model: 'typhoon-v2.5-30b-a3b-instruct', 
      messages: messages,
      temperature: 0.1, // ปรับลด Temperature ลงเพื่อความแม่นยำสูงสุดและลดการเดา
      max_completion_tokens: 150,
      top_p: 0.2,
      frequency_penalty: 0.0,
      stream: false, 
    });

    const replyMessage = response.choices[0]?.message?.content || 'เรื่องนี้เดี๋ยวรอแอดมินมาตอบสักครู่นะครับ';
    
    // 3. ใส่คำตอบของ AI ลงในประวัติ
    chatSession.history.push({ role: 'assistant', content: replyMessage });

    if (chatSession.history.length > MAX_HISTORY) {
      chatSession.history.splice(0, chatSession.history.length - MAX_HISTORY);
    }

    // 4. บันทึกกลับลงฐานข้อมูล
    chatSession.updatedAt = new Date();
    await chatSession.save();

    res.status(200).json({ reply: replyMessage });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ', reason: error.message });
    }
  }
});

app.post('/clear-chat', async (req, res) => {
  const userId = req.body?.userId;
  if (userId) {
    await Chat.deleteOne({ userId });
    return res.status(200).json({ status: `ล้างความจำถาวรของไอดี ${userId} ใน DB แล้ว` });
  }
  res.status(400).json({ error: 'ไม่พบ userId' });
});

app.listen(port, () => {
  console.log(`🚀 Server Is Running On Port ${port}`);
});
