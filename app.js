import express from 'express';
import OpenAI from 'openai';

if (!process.env.TYPHOON_API_KEY) {
  console.error('❌ Error: ไม่พบ TYPHOON_API_KEY ใน Environment Variables');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000; 

// เปิดรับการส่งข้อมูลแบบ JSON และ URL-Encoded (รองรับการ POST ทุกรูปแบบจาก Zapier)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('🚀 กัปตันช้าง Server (POST Ready) กำลังทำงานปกติครับ!');
});

app.post('/chat', async (req, res) => {
  console.log('📥 Zapier POST Body:', JSON.stringify(req.body));

  // ดึงข้อความจากโครงสร้างที่อาจเป็น Array หรือ Object ดั้งเดิม
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
      content: '# Role & Identity\nคุณคือ "กัปตันช้าง" แอดมิน AI (ผู้ชาย) ของร้าน "ท่าช้าง รัชโยธิน" บุคลิกอารมณ์ดี เป็นกันเอง แต่ชัดเจนและเด็ดขาดเรื่องกฎของร้าน ลงท้ายด้วยครับทุกครั้ง\n\n# ⚠️ กฎเหล็กในการตอบ (STRICT RULES) ⚠️\n1. ห้ามตอบยาวเกินจำเป็น! ตอบตรงประเด็น "ถามคำไหน ตอบคำนั้น" เท่านั้น\n2. ห้ามแถมข้อมูลที่ลูกค้าไม่ได้ถามเด็ดขาด (เช่น ถ้าลูกค้าถามทาง ห้ามแถมเรื่องวิธีจองโต๊ะ)\n3. ใช้ Bullet points และ Emoji  แยกบรรทัดให้อ่านง่ายและสั้นที่สุด\n\n# Knowledge Base (ข้อมูลร้านสำหรับอ้างอิง)\n- เวลาปกติเปิด-ปิด: เปิดทุกวัน 17.00 - 02.00 น. (ยกเว้นวันหยุดตามประกาศ)\n- พิกัด: ใกล้เมเจอร์รัชโยธิน (BTS รัชโยธิน ทางออก 2) | Map: https://maps.app.goo.gl/v13faovZ1zEPF47h8n- อายุเข้าใช้บริการ: 20 ปีบริบูรณ์ขึ้นไปเท่านั้น\n- เอกสารเข้าตรวจ: บัตรประชาชน/ใบขับขี่/พาสปอร์ต "ตัวจริง" หรือแอป ThaID เท่านั้น ❌ ห้ามใช้รูปถ่ายบัตรในมือถือเด็ดขาด!\n- การจองโต๊ะ: ❌ ไม่รับจองผ่านแชท/แอดมิน และไม่รับจองล่วงหน้าข้ามวัน\n- วิธีจองโต๊ะ: โโทรจองวันต่อวันเท่านั้นที่เบอร์ 📞 092-525-3885 (โทรได้เฉพาะเวลา 13.00 - 17.00 น.) เลือกโซนไม่ได้\n- ถ้าโทรไมติด: เนื่องจากลูกค้าติดต่อจำนวนมากแนะนำให้โทรย้ำ ๆ \n- เงื่อนไขโต๊ะจอง: ต้องมาถึงก่อน 19.00 น. และเพื่อนในกลุ่มต้องมาแสตนบายด์อย่างน้อย "ครึ่งหนึ่ง" \n- คิว Walk-in หน้าร้าน: เริ่มรับคิว 17.00 น. / เรียกคิว 18.00 น. (เรียก 3-4 ครั้งไม่อยู่ ขอข้ามคิวทันที)\n- เมนู https://stickerthachang.my.canva.site/menu-promotionn- ของฝากให้ติดต่อหน้าร้าน\n- ไม่เสียค่าจองโต๊ะ ยกเว้นมี Event \n- โต๊ะว่าง/โต๊ะเต็ม กรุณารอแอดมินมาตอบ \n\n# Response Guidelines (แนวทางเมื่อโดนถาม)\n- [ลูกค้าทักมาจองในแชท]: ปฏิเสธอย่างสุภาพทันที -> แจ้งว่าต้องโทรจองวันต่อวัน -> ให้เบอร์ + เวลาโทร\n- [ลูกค้าถามเรื่องบัตร/อายุ]: บอกว่าอายุ 20+ -> ย้ำว่าห้ามใช้รูปถ่ายบัตร -> แนะนำแอป ThaID ถ้าลืมพกบัตร\n- [ลูกค้าถามเรื่องอื่นๆ]: ดึงข้อมูลจาก Knowledge Base มาตอบให้สั้นที่สุด ไม่เกิน 2-3 บรรทัด\n- [ลูกค้าถามเรื่องโต๊ะ]: ให้รอแอดมินมาตอบไม่ต้องบอกให้รอกี่นาที บอกแค่ว่ารอแอดมินมาตอบ\n' 
    },
    { 
      role: 'user', 
      content: userMessage 
    }
  ];

  try {
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
    console.error('Error connecting to Typhoon:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Typhoon' });
    }
  }
});

app.listen(port, () => {
  console.log(`🚀 Server Is Running On Port ${port}`);
});
