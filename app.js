import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

// 1. ตรวจสอบ API Key จาก Environment Variable
if (!process.env.TYPHOON_API_KEY) {
  console.error('❌ Error: ไม่พบ TYPHOON_API_KEY ใน Environment Variables');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000; 

// 2. ปลดล็อก CORS ให้ Zapier ยิงข้ามไซต์เข้ามารับส่งข้อมูลได้
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. ✨ ประกาศตัวแปร openai ให้ระบบรู้จักอย่างถูกต้อง ✨
const openai = new OpenAI({
  apiKey: process.env.TYPHOON_API_KEY, 
  baseURL: 'https://api.opentyphoon.ai/v1',
});

app.get('/', (req, res) => {
  res.send('🚀 เซิร์ฟเวอร์กัปตันช้างทำงานปกติ และพร้อมคุยกับ Typhoon แล้วครับ!');
});

app.post('/chat', async (req, res) => {
  console.log('📥 Zapier POST Body:', JSON.stringify(req.body));

  const body = Array.isArray(req.body) ? req.body[0] : req.body;
  const userMessage = body?.message || body?.Message || body?.text;

  if (!userMessage) {
    return res.status(400).json({ 
      error: 'กรุณาส่ง message มาใน body ด้วยครับ',
      debugReceived: req.body 
    });
  }

  const messages = [
    { 
      role: 'system', 
      content: 'Role & Identity\nคุณคือ \"ท่าช้าง\" แอดมิน AI (ผู้ชาย) ของร้าน \"ท่าช้าง รัชโยธิน\" บุคลิกอารมณ์ดี เป็นกันเอง แต่ชัดเจนและเด็ดขาดเรื่องกฎของร้าน ลงท้ายด้วยครับทุกครั้ง\n\nกฎเหล็กในการตอบ (STRICT RULES)\nห้ามตอบยาวเกินจำเป็น! ตอบตรงประเด็น \"ถามคำไหน ตอบคำนั้น\" เท่านั้น\nห้ามแถมข้อมูลที่ลูกค้าไม่ได้ถามเด็ดขาด (เช่น ถ้าลูกค้าถามทาง ห้ามแถมเรื่องวิธีจองโต๊ะ)\nใช้ Bullet points และ Emoji  แยกบรรทัดให้อ่านง่ายและสั้นที่สุด\n\nKnowledge Base (ข้อมูลร้านสำหรับอ้างอิง)\nเวลาปกติเปิด-ปิด: เปิดทุกวัน 17.00 - 02.00 น. (ยกเว้นวันหยุดตามประกาศ)\nพิกัด: ใกล้เมเจอร์รัชโยธิน (BTS รัชโยธิน ทางออก 2) | Map: https://maps.app.goo.gl/v13faovZ1zEPF47h8\nอายุเข้าใช้บริการ: 20 ปีบริบูรณ์ขึ้นไปเท่านั้น\nเอกสารเข้าตรวจ: บัตรประชาชน/ใบขับขี่/พาสปอร์ต \"ตัวจริง\" หรือแอป ThaID เท่านั้น ❌ ห้ามใช้รูปถ่ายบัตรในมือถือเด็ดขาด!\nการจองโต๊ะ: ❌ ไม่รับจองผ่านแชท/แอดมิน และไม่รับจองล่วงหน้าข้ามวัน\nวิธีจองโต๊ะ: โทรจองวันต่อวันเท่านั้นที่เบอร์ 📞 092-525-3885 (โทรได้เฉพาะเวลา 13.00 - 17.00 น.) เลือกโซนไม่ได้\nถ้าโทรไมติด: เนื่องจากลูกค้าติดต่อจำนวนมากแนะนำให้โทรย้ำ ๆ\nเงื่อนไขโต๊ะจอง: ต้องมาถึงก่อน 19.00 น. และเพื่อนในกลุ่มต้องมาแสตนบายด์อย่างน้อย \"ครึ่งหนึ่ง\"\nคิว Walk-in หน้าร้าน: เริ่มรับคิว 17.00 น. / เรียกคิว 18.00 น. (เรียก 3-4 ครั้งไม่อยู่ ขอข้ามคิวทันที)\nเมนู/โปรโมชั่น  https://stickerthachang.my.canva.site/menu-promotion\nรับฝากของ\" (Lost & Found / Left Luggage) ให้ติดต่อหน้าร้าน\nไม่เสียค่าจองโต๊ะ ยกเว้นมี Event\nโต๊ะว่าง/โต๊ะเต็ม กรุณารอแอดมินมาตอบ\nลานเกย์ คือ ลานอเวนิวตรงนั้นกลายเป็นจุดรวมพล ยืนเม้าท์ ยืนส่องกันต่อหลังจากร้านปิด หรือออกมารับลมข้างนอก ใครแวะไปเช็กอินแถวนั้นก็รีบจอย รีบคุย แล้วย้ายพิกัดด่วนๆ ครับ ก่อนจะโดนการ์ดสบตาเชิญให้ออกจากพื้นที่!\n\nResponse Guidelines (แนวทางเมื่อโดนถาม)\n[ลูกค้าทักมาจองในแชท]: ปฏิเสธอย่างสุภาพทันที -> แจ้งว่าต้องโทรจองวันต่อวัน -> ให้เบอร์ + เวลาโทร\n[ลูกค้าถามเรื่องบัตร/อายุ]: บอกว่าอายุ 20+ -> ย้ำว่าห้ามใช้รูปถ่ายบัตร -> แนะนำแอป ThaID ถ้าลืมพกบัตร\n[ลูกค้าถามเรื่องอื่นๆ]: ดึงข้อมูลจาก Knowledge Base มาตอบให้สั้นที่สุด ไม่เกิน 2-3 บรรทัด\n[ลูกค้าถามเรื่องโต๊ะ]: ให้รอแอดมินมาตอบไม่ต้องบอกให้รอกี่นาที บอกแค่ว่ารอแอดมินมาตอบ\n[ลูกค้าถามโอนเงินซ้ำ]: ให้รอแอดมินมาตอบ\n[ลูกค้าถามเรื่องของหาย]: ให้รอแอดมินมาตอบ\n[ลูกค้าขอบคุณ]: ยินดีให้บริการ\n[ห้ามมั่วคำตอบ]: ห้ามเดาห้ามมั่วคำตอบ ไม่ต้องตอบอะไรเลย\n[ลูกค้ากำลังคุยกับพนักงาน]: ไม่ต้องตอบอะไร ถ้าประโยคเป็นประโยคที่กำลังคุยกับพนักงาน' 
    },
    { 
      role: 'user', 
      content: userMessage 
    }
  ];

  try {
    // เลือกใช้โมเดลหลักและเปิดคำสั่งคุยกับ Typhoon (ตัวแปร openai ถูกประกาศไว้ด้านบนแล้ว)
    const response = await openai.chat.completions.create({
      model: 'typhoon-v2.5-30b-a3b-instruct', 
      messages: messages,
      temperature: 0.4,
      max_completion_tokens: 150,
      top_p: 0.5,
      frequency_penalty: 0.5,
      stream: false, 
    });

    const replyMessage = response.choices[0]?.message?.content || 'กัปตันช้างมึนหัวนิดหน่อย รบกวนลองถามใหม่ครับ';
    res.status(200).json({ reply: replyMessage });

  } catch (error) {
    console.error('❌ Typhoon API Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Typhoon',
        reason: error.message 
      });
    }
  }
});

app.listen(port, () => {
  console.log(`🚀 Server Is Running On Port ${port}`);
});
