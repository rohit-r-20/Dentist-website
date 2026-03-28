require('dotenv').config();
const express = require('express');
const cors = require("cors");
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ───
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// ─── MONGODB (Serverless caching) ───
let isConnected = false;
const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is undefined. Did you forget to set it in Vercel Environment Variables?');
      return;
    }
    const db = await mongoose.connect(process.env.MONGODB_URI);
    isConnected = !!db.connections[0].readyState;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB error:', err);
  }
};

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ─── APPOINTMENT SCHEMA ───
const appointmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  service: { type: String, trim: true, maxlength: 100 },
  date: { type: String, required: true },
  time: { type: String, default: 'Any time' },
  message: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

// ─── ROUTES ───
const apiRouter = express.Router();

// Health check
apiRouter.get('/', (req, res) => res.json({ status: 'ok', clinic: 'Thiru Dentistry API' }));



// POST /appointments — create new booking
apiRouter.post('/appointments', async (req, res) => {
  try {
    const { name, phone, service, date, time, message } = req.body;
    if (!name || !phone || !date) {
      return res.status(400).json({ error: 'Name, phone, and date are required.' });
    }
    const appt = new Appointment({ name, phone, service, date, time, message });
    await appt.save();
    console.log('✅ Appointment saved to MongoDB:', appt._id);

    // ─── SEND EMAIL NOTIFICATION ───
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log('📧 Attempting to send email notification...');
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        // Verify the transporter credentials first
        await transporter.verify();
        console.log('📧 Email credentials verified successfully');

        const mailOptions = {
          from: `"Thiru Dentistry" <${process.env.EMAIL_USER}>`,
          to: process.env.NOTIFICATION_EMAIL || 'andersonjuds01@gmail.com',
          subject: `🦷 New Dental Appointment: ${name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #0A3D62, #1ABC9C); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
                <h2 style="margin: 0;">🦷 New Appointment Request</h2>
                <p style="margin: 8px 0 0; opacity: 0.9;">Thiru Dentistry — Padianallur</p>
              </div>
              <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">👤 Name:</td><td style="padding: 8px 0;">${name}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">📞 Phone:</td><td style="padding: 8px 0;"><a href="tel:${phone}">${phone}</a></td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">🩺 Service:</td><td style="padding: 8px 0;">${service || 'Not specified'}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">📅 Date:</td><td style="padding: 8px 0;">${date}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">🕐 Time:</td><td style="padding: 8px 0;">${time || 'Any time'}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">💬 Message:</td><td style="padding: 8px 0;">${message || 'None'}</td></tr>
                </table>
              </div>
              <div style="background: #0A3D62; padding: 16px; border-radius: 0 0 12px 12px; text-align: center;">
                <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" style="color: #1ABC9C; text-decoration: none; font-weight: bold;">💬 Reply on WhatsApp</a>
              </div>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.response);
      } catch (emailErr) {
        console.error('❌ Email failed:', emailErr.message);
        console.error('💡 Tip: Make sure EMAIL_PASS is a valid Gmail App Password (16 chars, no spaces).');
        console.error('💡 Generate one at: https://myaccount.google.com/apppasswords');
      }
    } else {
      console.log('⚠️  EMAIL_USER or EMAIL_PASS not set — skipping email notification');
    }



    res.status(201).json({ success: true, message: 'Appointment booked!', id: appt._id });
  } catch (err) {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// GET /appointments — list all (admin)
apiRouter.get('/appointments', async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (date) filter.date = date;
    const appts = await Appointment.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, count: appts.length, data: appts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /appointments/:id — update status
apiRouter.patch('/appointments/:id', async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: appt });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /appointments/:id — delete appointment
apiRouter.delete('/appointments/:id', async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, message: 'Appointment deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── CHATBOT ENDPOINT (OpenAI) ───
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing-key-prevent-crash' });

apiRouter.post('/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'missing-key-prevent-crash') {
      return res.status(503).json({ error: 'Chat unavailable. OpenAI credentials missing.' });
    }
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a friendly dental clinic assistant for Thiru Dentistry in Padianallur, Tamil Nadu, India. 
Help users book appointments and answer dental questions politely and professionally.
Clinic info: Phone +91 90426 36466, Address: Service Rd, M.A.Nagar, Padianallur 600052.
Doctor: Dr. Sivapriya. Hours: Mon-Sat 9AM-7PM. 5-star rated, women-owned clinic.
Services: Root Canal, Implants, Braces, Tooth Extraction, Cosmetic & General Dentistry.
Keep replies concise and warm. Always encourage booking an appointment.`
        },
        ...messages.slice(-10) // send last 10 messages for context
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    const reply = completion.choices[0].message.content;
    res.json({ success: true, reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat unavailable. Please call +91 90426 36466.' });
  }
});

// Dual-mount the router so it works both locally (req.url begins with /api) 
// and on Vercel (where Vercel Serverless automatically strips the /api prefix).
app.use('/', apiRouter);
app.use('/api', apiRouter);

// ─── 404 ───
app.use((req, res) => res.status(404).json({ error: 'Route not found', requestedPath: req.url }));

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`🚀 Thiru Dentistry API running on port ${PORT}`));
}

module.exports = app;


const path = require("path");

// Serve static files
app.use(express.static(__dirname));

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});