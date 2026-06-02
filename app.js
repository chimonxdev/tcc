import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import mongoose from 'mongoose';

if (!process.env.TYPHOON_API_KEY) {
  console.error('❌ Error: ไม่พบ TYPHOON_API_KEY ใน Environment Variables');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('❌ Error: ไม่พบ MONGODB_URI ใน Environment Variables');
  process.exit(1);
}

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

const MAX_HISTORY = 6;

// ✨ [วันหยุดศาสนาปี 2026] ห้ามขายแอลกอฮอล์ / ร้านต้องปิด (Format: YYYY-MM-DD)
const BUDDHIST_HOLIDAYS = [
  '2026-03-03', // วันมาฆบูชา
  '2026-05-31', // วันวิสาขบูชา
  '2026-07-29', // วันอาสาฬหบูชา
  '2026-07-30', // วันเข้าพรรษา
  '2026-10-26', // วันออกพรรษา
];

// ✨ [เหตุการณ์พิเศษ] บังคับสถานะร้านแบบ Real-time ของ "วันนี้"
const SPECIAL_EVENTS = {
  '2026-06-27': '🔴 **วันนี้ร้านปิดให้บริการ** (เนื่องจากเป็นวันก่อนเลือกตั้ง กทม.)',
  '2026-06-28': '🟡 วันนี้ร้านเปิด 17.00 น. ตามปกติ แต่ **จะเริ่มจำหน่ายเครื่องดื่มแอลกอฮอล์ได้ตั้งแต่เวลา 18.00 น. เป็นต้นไป** (ตามกฎหมายวันเลือกตั้ง)'
};

function getDynamicSystemPrompt() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const todayStr = now.toISOString().split('T')[0];
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const isTodayHoliday = BUDDHIST_HOLIDAYS.includes(todayStr);
  const isTomorrowHoliday = BUDDHIST_HOLIDAYS.includes(tomorrowStr);

  let shopStatus = 'เปิดทุกวัน 17.00 - 02.00 น.';

  // ตรวจสอบสถานะของ "วันนี้"
  if (SPECIAL_EVENTS[todayStr]) {
    shopStatus = SPECIAL_EVENTS[todayStr];
  } else if (isTodayHoliday) {
    shopStatus = '🔴 **วันนี้ร้านปิดให้บริการ** (เนื่องจากเป็นวันสำคัญทางพระพุทธศาสนา/ก่อนวันเลือกตั้ง)';
  } else if (isTomorrowHoliday) {
    shopStatus = '🟡 วันนี้ร้านเปิด 17.00 น. แต่ **ปิดเร็วกว่าปกติในเวลา 00.00 น. (เที่ยงคืน)** (เนื่องจากพรุ่งนี้เป็นวันสำคัญทางพระพุทธศาสนา)';
  }

  // นำปฏิทินทั้งหมดฝังลงไปใน Prompt ให้ AI ฉลาดขึ้นและตอบอนาคตได้
  return `Role & Identity
คุณคือ "ท่าช้าง" แอดมิน AI (ผู้ชาย) ของร้าน "ท่าช้าง รัชโยธิน" บุคลิกอารมณ์ดี เป็นกันเอง แต่ชัดเจนและเด็ดขาด (หากตอบเป็นภาษาไทย ให้ลงท้ายด้วย "ครับ" ทุกครั้ง)

สถานะร้านแบบ Real-time ณ ปัจจุบัน
- วันนี้วันที่: ${todayStr}
- สถานะร้านวันนี้: ${shopStatus}

กฎเหล็กในการตอบ (STRICT RULES - ต้องปฏิบัติตามอย่างเคร่งครัด)
1. ❌ ห้ามเดาข้อมูล! หากลูกค้าถามเรื่องที่ไม่มีใน Knowledge Base หรือถามหาวันหยุดนอกเหนือจากที่ระบุ ให้ตอบว่า "เรื่องนี้เดี๋ยวรอแอดมินมาตอบสักครู่นะครับ"
2. ❌ ห้ามแถมข้อมูล! ถามคำไหน ตอบคำนั้นให้ตรงประเด็น สั้นและกระชับที่สุด
3. ใช้ Bullet points และ Emoji แยกบรรทัดให้อ่านง่าย
4. 🔴 MULTILINGUAL SUPPORT: หากลูกค้าพิมพ์ภาษาอังกฤษ, จีน หรืออื่นๆ ให้ตอบกลับเป็นภาษานั้นๆ 100% (ห้ามมีภาษาไทยปน และไม่ต้องลงท้ายครับ)
5. หากลูกค้าถามถึงสถานะร้านใน "อนาคต" ให้เช็กจากหัวข้อ "ปฏิทินวันหยุดและวันพิเศษ" ด้านล่างเพื่อตอบ

Knowledge Base (ข้อมูลร้านสำหรับอ้างอิง)
เวลาปกติเปิด-ปิด: เปิดทุกวัน 17.00 - 02.00 น.
พิกัด: ใกล้เมเจอร์รัชโยธิน (BTS รัชโยธิน ทางออก 2) | Map: https://maps.app.goo.gl/v13faovZ1zEPF47h8
อายุเข้าใช้บริการ: 20 ปีบริบูรณ์ขึ้นไปเท่านั้น
เอกสารเข้าตรวจ: บัตรประชาชน/ใบขับขี่/พาสปอร์ต "ตัวจริง" หรือแอป ThaID เท่านั้น ❌ ห้ามใช้รูปถ่ายบัตรในมือถือเด็ดขาด!
การจองโต๊ะ: ❌ ไม่รับจองผ่านแชท/แอดมิน และไม่รับจองล่วงหน้าข้ามวัน
วิธีจองโต๊ะ: โทรจองวันต่อวันเท่านั้นที่เบอร์ 📞 092-525-3885 (เวลา 13.00 - 17.00 น.) เลือกโซนไม่ได้
ถ้าโทรไม่ติด: เนื่องจากลูกค้าติดต่อจำนวนมากแนะนำให้โทรย้ำๆ
เงื่อนไขโต๊ะจอง: ต้องมาถึงก่อน 19.00 น. และเพื่อนในกลุ่มต้องมาแสตนบายด์อย่างน้อย "ครึ่งหนึ่ง"
คิว Walk-in หน้าร้าน: เริ่มรับคิว 17.00 น. / เรียกคิว 18.00 น. (เรียก 3-4 ครั้งไม่อยู่ ขอข้ามคิวทันที)
รับฝากของ: ให้ติดต่อหน้าร้านโดยตรง
ค่าจองโต๊ะ: ไม่เสียค่าจอง ยกเว้นมี Event
เมนู/โปรโมชั่น/โปรโมชั่นวันเกิด/ราคาเครื่องดื่ม/อาหาร: https://stickerthachang.my.canva.site/menu-promotion
สมัครงาน/พนักงาน: ติดต่อสมัครงานหน้าร้าน ตั้งแต่เวลา 17.00 - 02.00 น.
ลานเกย์: ลานอเวนิวหน้าเวทีเป็นจุดรวมพล รีบจอยรีบคุยก่อนโดนการ์ดเชิญออก

📅 ปฏิทินวันหยุดและวันพิเศษปี 2026 (พ.ศ. 2569) (ใช้อ้างอิงเมื่อลูกค้าถามล่วงหน้า)
- วันสำคัญทางศาสนา (ร้านปิด): 3 มี.ค., 31 พ.ค., 29 ก.ค., 30 ก.ค., 26 ต.ค. (คืนก่อนหน้าวันเหล่านี้ ร้านจะปิดเที่ยงคืน 00.00 น.)
- ช่วงเลือกตั้ง กทม.:
  * 27 มิ.ย. 2026: 🔴 ร้านปิดให้บริการ (ก่อนวันเลือกตั้ง)
  * 28 มิ.ย. 2026: 🟡 ร้านเปิด 17.00 น. แต่เริ่มจำหน่ายแอลกอฮอล์ได้ตั้งแต่เวลา 18.00 น. เป็นต้นไป

Response Guidelines (แนวทางเมื่อโดนถาม)
- [ลูกค้าจองในแชท]: ปฏิเสธสุภาพ -> ให้เบอร์โทร 092-525-3885 -> แจ้งเวลาโทร 13.00-17.00 น.
- [ลูกค้าถามเรื่องบัตร/อายุ]: ย้ำอายุ 20+ -> ห้ามใช้รูปถ่ายบัตร -> แนะนำแอป ThaID
- [โต๊ะว่าง/เต็ม/โอนเงินซ้ำ/ของหาย]: แจ้งว่านี่คือระบบอัตโนมัติ ให้รอแอดมินมาตรวจสอบ
- [ลูกค้าขอบคุณ]: ตอบยินดีให้บริการ
- [โปรโมชั่น/วันเกิด/เครื่องดื่ม]: ❌ ห้ามสรุปโปรโมชั่นเองเด็ดขาด! หากลูกค้าถามเรื่องโปรโมชั่นหรือวันเกิด ให้ตอบแค่ประโยคนี้เท่านั้น: "รายละเอียดโปรโมชั่นและวันเกิด ดูได้ที่ลิงก์นี้เลยครับ https://stickerthachang.my.canva.site/menu-promotion" 
`;
}

app.get('/', (req, res) => {
  res.send('🚀 เซิร์ฟเวอร์ท่าช้างทำงานปกติ  MongoDB Atlas!');
});

app.post('/chat', async (req, res) => {
  console.log('📥 Zapier POST Body:', JSON.stringify(req.body));

  if (mongoose.connection.readyState !== 1) {
    console.error('❌ Database connection is not ready.');
    return res.status(500).json({ error: 'ระบบฐานข้อมูลยังไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้งครับ' });
  }

  const body = Array.isArray(req.body) ? req.body[0] : req.body;
  const userMessage = body?.message || body?.Message || body?.text;
  const userId = body?.userId || body?.user_id || body?.senderId || 'default_user';

  if (!userMessage) {
    return res.status(400).json({ error: 'กรุณาส่ง message มาใน body ด้วยครับ' });
  }

  try {
    let chatSession = await Chat.findOne({ userId });
    if (!chatSession) {
      chatSession = new Chat({ userId, history: [] });
    }

    chatSession.history.push({ role: 'user', content: userMessage });

    const formattedHistory = chatSession.history.map(item => ({
      role: item.role,
      content: item.content
    }));

    const messages = [
      { role: 'system', content: getDynamicSystemPrompt() },
      ...formattedHistory
    ];

    const response = await openai.chat.completions.create({
      model: 'typhoon-v2.5-30b-a3b-instruct', 
      messages: messages,
      temperature: 0, 
      max_completion_tokens: 150,
      top_p: 0.05,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
      stream: false, 
    });

    const replyMessage = response.choices[0]?.message?.content || 'เรื่องนี้เดี๋ยวรอแอดมินมาตอบสักครู่นะครับ';
    
    chatSession.history.push({ role: 'assistant', content: replyMessage });

    if (chatSession.history.length > MAX_HISTORY) {
      chatSession.history.splice(0, chatSession.history.length - MAX_HISTORY);
    }

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
