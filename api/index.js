// Vercel Serverless Function — Thiru Dentistry API
// This file is a self-contained version of server.js for Vercel deployment.

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

// ─── MIDDLEWARE ───
app.use(cors({ origin: '*', methods: ['GET','POST','PATCH','DELETE'], credentials: true }));
app.use(express.json({ limit: '10kb' }));

// ─── MONGODB (Serverless connection caching) ───
let cachedDb = null;
const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) return;
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    cachedDb = true;
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB error:', err.message);
  }
};

// Connect to DB on every request
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ─── APPOINTMENT SCHEMA ───
const appointmentSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true, maxlength: 100 },
  phone:   { type: String, required: true, trim: true, maxlength: 20 },
  service: { type: String, trim: true, maxlength: 100 },
  date:    { type: String, required: true },
  time:    { type: String, default: 'Any time' },
  message: { type: String, trim: true, maxlength: 500 },
  status:  { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);

// ─── ROUTES ───
const router = express.Router();

// Health check
router.get('/', (req, res) => res.json({ status: 'ok', clinic: 'Thiru Dentistry API' }));

// POST /appointments
router.post('/appointments', async (req, res) => {
  try {
    const { name, phone, service, date, time, message } = req.body;
    if (!name || !phone || !date) {
      return res.status(400).json({ error: 'Name, phone, and date are required.' });
    }
    const appt = new Appointment({ name, phone, service, date, time, message });
    await appt.save();

    // Send email notification
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
        await transporter.verify();
        await transporter.sendMail({
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
        console.log('Email sent');
      } catch (emailErr) {
        console.error('Email failed:', emailErr.message);
      }
    }

    res.status(201).json({ success: true, message: 'Appointment booked!', id: appt._id });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// GET /appointments
router.get('/appointments', async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (date)   filter.date   = date;
    const appts = await Appointment.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, count: appts.length, data: appts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /appointments/:id
router.patch('/appointments/:id', async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id, { status: req.body.status }, { new: true }
    );
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: appt });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /appointments/:id
router.delete('/appointments/:id', async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your')) {
      return res.status(503).json({ error: 'Chat unavailable.' });
    }
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a friendly dental clinic assistant for Thiru Dentistry in Padianallur, Tamil Nadu. 
Phone +91 90426 36466, Doctor: Dr. Sivapriya. Hours: Mon-Sat 9AM-7PM.
Services: Root Canal, Implants, Braces, Tooth Extraction, Cosmetic & General Dentistry.
Keep replies concise and warm.`
        },
        ...messages.slice(-10)
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    res.json({ success: true, reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat unavailable. Please call +91 90426 36466.' });
  }
});

// Mount the router at both / and /api to handle Vercel's path behavior
app.use('/', router);
app.use('/api', router);

module.exports = app;
