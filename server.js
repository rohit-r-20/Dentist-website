require('dotenv').config();
const express = require('express');
const cors = require("cors");
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const path = require("path");
const { OpenAI } = require('openai');

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

// ─── MONGODB CONNECTION ───
let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) return;

  try {
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

// ─── SCHEMA ───
const appointmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  service: String,
  date: { type: String, required: true },
  time: String,
  message: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

// ─── ROUTER ───
const apiRouter = express.Router();

// Health check
apiRouter.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API running' });
});

// ─── CREATE APPOINTMENT ───
apiRouter.post('/appointments', async (req, res) => {
  try {
    const { name, phone, service, date, time, message } = req.body;

    if (!name || !phone || !date) {
      return res.status(400).json({ error: 'Name, phone, date required' });
    }

    const appt = new Appointment({ name, phone, service, date, time, message });
    await appt.save();

    console.log("✅ Saved:", appt._id);

    // ─── EMAIL ───
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.NOTIFICATION_EMAIL || process.env.EMAIL_USER,
          subject: "New Appointment",
          text: `Name: ${name}\nPhone: ${phone}\nDate: ${date}\nTime: ${time}`
        });

        console.log("📧 Email sent");
      } catch (err) {
        console.error("❌ Email error:", err.message);
      }
    }

    res.status(201).json({ success: true });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── SEND EMAIL ───
apiRouter.post('/send-email', async (req, res) => {
  try {
    const { name, phone, service, date, time, message, recipientEmail } = req.body;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      await transporter.verify();
      await transporter.sendMail({
        from: `"Thiru Dentistry" <${process.env.EMAIL_USER}>`,
        to: recipientEmail || process.env.NOTIFICATION_EMAIL || process.env.EMAIL_USER,
        subject: `🦷 New Dental Appointment: ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0A3D62, #1ABC9C); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
              <h2 style="margin: 0;">🦷 New Appointment Request</h2>
              <p style="margin: 8px 0 0; opacity: 0.9;">Thiru Dentistry — Padianallur</p>
            </div>
            <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; font-weight: bold;">👤 Name:</td><td>${name}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">📞 Phone:</td><td><a href="tel:${phone}">${phone}</a></td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">🩺 Service:</td><td>${service || 'Not specified'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">📅 Date:</td><td>${date}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">🕐 Time:</td><td>${time || 'Any time'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">💬 Message:</td><td>${message || 'None'}</td></tr>
              </table>
            </div>
          </div>`,
      });
      res.json({ success: true, message: 'Email sent successfully' });
    } else {
      res.status(500).json({ error: 'Server email configuration is missing.' });
    }
  } catch (err) {
    console.error('Email sending error:', err.message);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// ─── GET APPOINTMENTS ───
apiRouter.get('/appointments', async (req, res) => {
  try {
    const data = await Appointment.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── UPDATE STATUS ───
apiRouter.patch('/appointments/:id', async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json({ success: true, data: appt });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE ───
apiRouter.delete('/appointments/:id', async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── CHATBOT ───
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

apiRouter.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages
    });

    res.json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// ─── ROUTE MOUNT ───
app.use('/', apiRouter);
app.use('/api', apiRouter);

// ─── STATIC FRONTEND ───
app.use(express.static(__dirname));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── START SERVER ───
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
  });
}

module.exports = app;