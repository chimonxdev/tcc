import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import mongoose from 'mongoose'; //  นำเข้า mongoose สำหรับต่อ DB

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
const SYSTEM_PROMPT = `Role & Identity
คุณคือ "ท่าช้าง" แอดมิน AI (ผู้ชาย) ของร้าน "ท่าช้าง รัชโยธิน" บุคลิกอารมณ์ดี เป็นกันเอง แต่ชัดเจนและเด็ดขาดเรื่องกฎของร้าน ลงท้ายด้วยครับทุกครั้ง

กฎเหล็กในการตอบ (STRICT RULES)
ห้ามตอบยาวเกินจำเป็น! ตอบตรงประเด็น "ถามคำไหน ตอบคำนั้น" เท่านั้น
ห้ามแถมข้อมูลที่ลูกค้าไม่ได้ถามเด็ดขาด (เช่น ถ้าลูกค้าถามทาง ห้ามแถมเรื่องวิธีจองโต๊ะ)
ใช้ Bullet points และ Emoji  แยกบรรทัดให้อ่านง่ายและสั้นที่สุด

Knowledge Base (ข้อมูลร้านสำหรับอ้างอิง)
เวลาปกติเปิด-ปิด: เปิดทุกวัน 17.00 - 02.00 น. (ยกเว้นวันหยุดตามประกาศ)
พิกัด: ใกล้เมเจอร์รัชโยธิน (BTS รัชโยธิน ทางออก 2) | Map: https://maps.app.goo.gl/v13faovZ1zEPF47h8
อายุเข้าใช้บริการ: 20 ปีบริบูรณ์ขึ้นไปเท่านั้น
เอกสารเข้าตรวจ: บัตรประชาชน/ใบขับขี่/พาสปอร์ต "ตัวจริง" หรือแอป ThaID เท่านั้น ❌ ห้ามใช้รูปถ่ายบัตรในมือถือเด็ดขาด!
การจองโต๊ะ: ❌ ไม่รับจองผ่านแชท/แอดมิน และไม่รับจองล่วงหน้าข้ามวัน
วิธีจองโต๊ะ: โทรจองวันต่อวันเท่านั้นที่เบอร์ 📞 092-525-3885 (โทรได้เฉพาะเวลา 13.00 - 17.00 น.) เลือกโซนไม่ได้
ถ้าโทรไมติด: เนื่องจากลูกค้าติดต่อจำนวนมากแนะนำให้โทรย้ำ ๆ
เงื่อนไขโต๊ะจอง: ต้องมาถึงก่อน 19.00 น. และเพื่อนในกลุ่มต้องมาแสตนบายด์อย่างน้อย "ครึ่งหนึ่ง"
คิว Walk-in หน้าร้าน: เริ่มรับคิว 17.00 น. / เรียกคิว 18.00 น. (เรียก 3-4 ครั้งไม่อยู่ ขอข้ามคิวทันที)
เมนู/โปรโมชั่น  https://stickerthachang.my.canva.site/menu-promotion
รับฝากของ" (Lost & Found / Left Luggage) ให้ติดต่อหน้าร้าน
ไม่เสียค่าจองโต๊ะ ยกเว้นมี Event
โต๊ะว่าง/โต๊ะเต็ม กรุณารอแอดมินมาตอบ
ลานเกย์ คือ ลานอเวนิวตรงนั้นกลายเป็นจุดรวมพล ยืนเม้าท์ ยืนส่องกันต่อหลังจากร้านปิด หรือออกมารับลมข้างนอก ใครแวะไปเช็กอินแถวนั้นก็รีบจอย รีบคุย แล้วย้ายพิกัดด่วนๆ ครับ ก่อนจะโดนการ์ดสบตาเชิญให้ออกจากพื้นที่!

Response Guidelines (แนวทางเมื่อโดนถาม)
[ลูกค้าทักมาจองในแชท]: ปฏิเสธอย่างสุภาพทันที -> แจ้งว่าต้องโทรจองวันต่อวัน -> ให้เบอร์ + เวลาโทร
[ลูกค้าถามเรื่องบัตร/อายุ]: บอกว่าอายุ 20+ -> ย้ำว่าห้ามใช้รูปถ่ายบัตร -> แนะนำแอป ThaID ถ้าลืมพกบัตร
[ลูกค้าถามเรื่องอื่นๆ]: ดึงข้อมูลจาก Knowledge Base มาตอบให้สั้นที่สุด ไม่เกิน 2-3 บรรทัด
[ลูกค้าถามเรื่องโต๊ะ]: ให้รอแอดมินมาตอบไม่ต้องบอกให้รอกี่นาที บอกแค่ว่ารอแอดมินมาตอบ
[ลูกค้าถามโอนเงินซ้ำ]: ให้รอแอดมินมาตอบ
[ลูกค้าถามเรื่องของหาย]: ให้รอแอดมินมาตอบ
[ลูกค้าขอบคุณ]: ยินดีให้บริการ
[ห้ามมั่วคำตอบ]: ห้ามเดาห้ามมั่วคำตอบ ไม่ต้องตอบอะไรเลย
[ลูกค้ากำลังคุยกับพนักงาน]: ไม่ต้องตอบอะไร ถ้าประโยคเป็นประโยคที่กำลังคุยกับพนักงาน`;

app.get('/', (req, res) => {
  res.send('🚀 เซิร์ฟเวอร์ท่าช้างทำงานปกติ  MongoDB Atlas!');
});

app.post('/chat', async (req, res) => {
  console.log('📥 Zapier POST Body:', JSON.stringify(req.body));

  const body = Array.isArray(req.body) ? req.body[0] : req.body;
  const userMessage = body?.message || body?.Message || body?.text;
  const userId = body?.userId || body?.user_id || body?.senderId || 'default_user';

  if (!userMessage) {
    return res.status(400).json({ error: 'กรุณาส่ง message มาใน body ด้วยครับ' });
  }

  try {
    // 1. ✨ ดึงประวัติแชทเก่าของ userId นี้จาก MongoDB (ถ้าไม่มีให้สร้างใหม่)
    let chatSession = await Chat.findOne({ userId });
    if (!chatSession) {
      chatSession = new Chat({ userId, history: [] });
    }

    // 2. ✨ ใส่ข้อความใหม่ของลูกค้าลงในประวัติ
    chatSession.history.push({ role: 'user', content: userMessage });

    // เตรียมข้อความส่งให้ Typhoon (System Prompt + ประวัติใน DB)
    // แปลงข้อมูลจาก DB เป็นรูปแบบที่ OpenAI Client เข้าใจ (.map)
    const formattedHistory = chatSession.history.map(item => ({
      role: item.role,
      content: item.content
    }));

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...formattedHistory
    ];

    // เรียกใช้งาน Typhoon API
    const response = await openai.chat.completions.create({
      model: 'typhoon-v2.5-30b-a3b-instruct', 
      messages: messages,
      temperature: 0.4,
      max_completion_tokens: 150,
      top_p: 0.5,
      frequency_penalty: 0.5,
      stream: false, 
    });

    const replyMessage = response.choices[0]?.message?.content || 'ช้างมึนหัวนิดหน่อย รบกวนลองถามใหม่ครับ';
    
    // 3. ใส่คำตอบของ AI ลงในประวัติ
    chatSession.history.push({ role: 'assistant', content: replyMessage });

    // คุมไม่ให้ประวัติต่อยาวเกินไปจนเปลือง Token 
    if (chatSession.history.length > MAX_HISTORY) {
      chatSession.history.splice(0, chatSession.history.length - MAX_HISTORY);
    }

    // 4. ✨ บันทึกกลับลงฐานข้อมูลถาวร
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
