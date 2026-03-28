# 🦷 Thiru Dentistry — Deployment Guide

## 📁 Project Structure

```
thiru-dentistry/
├── frontend/               ← React + Vite app (deploy to Vercel)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── components/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                ← Node + Express (deploy to Render)
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
└── index.html              ← Standalone single-file version (ready to use!)
```

---

## ⚡ QUICKSTART (Single File)

The `index.html` file is a **complete standalone website** — no build needed!

1. Upload `index.html` to any static host (Vercel, Netlify, GitHub Pages)
2. Done! 🎉

---

## 🚀 STEP-BY-STEP FULL DEPLOYMENT

### Step 1: Set Up MongoDB Atlas (Free)

1. Go to https://cloud.mongodb.com
2. Create a free account → Create Free Cluster
3. Database Access → Add User (username + password)
4. Network Access → Allow from Anywhere (0.0.0.0/0)
5. Clusters → Connect → Drivers → Copy connection string
6. Replace `<password>` in the string with your password

### Step 2: Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create new API key → Copy it
3. Add billing method (pay-as-you-go, ~$0.002 per conversation)

### Step 3: Deploy Backend to Render

1. Push backend code to GitHub repository
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Configure:
   - **Name**: thiru-dentistry-api
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables:
   ```
   MONGODB_URI    = your-mongodb-connection-string
   OPENAI_API_KEY = your-openai-key
   FRONTEND_URL   = https://thiru-dentistry.vercel.app
   NODE_ENV       = production
   PORT           = 5000
   ```
6. Click **Create Web Service**
7. Copy your Render URL (e.g., https://thiru-dentistry-api.onrender.com)

### Step 4: Deploy Frontend to Vercel

**Option A — Single HTML file:**
1. Go to https://vercel.com → Add New → Project
2. Import your GitHub repo
3. Set Output Directory to root (`.`)
4. Deploy → Done!

**Option B — React/Vite app:**
```bash
# Install dependencies
npm create vite@latest thiru-dentistry -- --template react
cd thiru-dentistry
npm install

# Install Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Copy component code to src/
# Update API endpoint in components:
# const API = 'https://thiru-dentistry-api.onrender.com'
```

Add to `vite.config.js`:
```js
export default {
  build: { outDir: 'dist' },
  define: { 'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL) }
}
```

Vercel Environment Variables:
```
VITE_API_URL = https://thiru-dentistry-api.onrender.com
```

---

## 🔌 API Endpoints

| Method | Endpoint         | Description              | Body / Params              |
|--------|-----------------|--------------------------|----------------------------|
| GET    | /               | Health check             | —                          |
| POST   | /appointments   | Create appointment       | name, phone, date, service |
| GET    | /appointments   | List appointments        | ?status=pending&date=...   |
| PATCH  | /appointments/:id | Update status          | { status: "confirmed" }    |
| POST   | /chat           | AI chatbot response      | { messages: [...] }        |

### Example: Book Appointment
```js
const res = await fetch('https://your-api.onrender.com/appointments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Ramesh Kumar',
    phone: '+91 98765 43210',
    service: 'Dental Implants',
    date: '2025-01-15',
    time: '10:00 AM',
    message: 'First time patient'
  })
});
```

### Example: Chat Message
```js
const res = await fetch('https://your-api.onrender.com/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'How do I book an appointment?' }
    ]
  })
});
```

---

## 🔧 Connect Frontend to Backend

In your form submit handler, replace the simulation with:

```js
const API = process.env.VITE_API_URL || 'https://thiru-dentistry-api.onrender.com';

const handleSubmit = async (e) => {
  e.preventDefault();
  setStatus('loading');
  try {
    const res = await fetch(`${API}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.success) setStatus('success');
    else setStatus('error');
  } catch {
    setStatus('error');
  }
};
```

---

## 🤖 Enable Real AI Chatbot

Replace the local intent detection in Chatbot component:

```js
const sendMsg = async () => {
  if (!input.trim()) return;
  const userMsg = input.trim();
  setInput('');
  
  const newHistory = [...conversationHistory, { role: 'user', content: userMsg }];
  setMessages(m => [...m, { role: 'user', text: userMsg, time: now() }]);
  setTyping(true);
  
  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newHistory })
    });
    const data = await res.json();
    setTyping(false);
    setMessages(m => [...m, { role: 'bot', text: data.reply, time: now() }]);
    setConversationHistory([...newHistory, { role: 'assistant', content: data.reply }]);
  } catch {
    setTyping(false);
    setMessages(m => [...m, { role: 'bot', text: 'Sorry, I\'m having trouble. Please call +91 90426 36466.', time: now() }]);
  }
};
```

---

## 📊 MongoDB Schema

```js
{
  name:      String (required),   // "Ramesh Kumar"
  phone:     String (required),   // "+91 98765 43210"
  service:   String,              // "Dental Implants"
  date:      String (required),   // "2025-01-15"
  time:      String,              // "10:00 AM"
  message:   String,              // Patient notes
  status:    String,              // "pending" | "confirmed" | "cancelled"
  createdAt: Date                 // Auto
}
```

---

## 🌐 Custom Domain (Optional)

On Vercel:
1. Settings → Domains → Add `thirudentistry.com`
2. Update DNS at your registrar:
   - A Record: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`

---

## ✅ Production Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Backend deployed to Render with env vars
- [ ] Frontend deployed to Vercel
- [ ] FRONTEND_URL set correctly in backend (CORS)
- [ ] VITE_API_URL set in Vercel environment
- [ ] OpenAI API key added (for real chatbot)
- [ ] Custom domain configured (optional)
- [ ] Google Analytics added (optional)
- [ ] WhatsApp link tested (+91 90426 36466)
- [ ] Google Maps embed tested
- [ ] Appointment form tested end-to-end
- [ ] Mobile responsiveness verified

---

## 💰 Estimated Monthly Cost

| Service    | Plan   | Cost      |
|-----------|--------|-----------|
| Vercel    | Hobby  | Free      |
| Render    | Free   | Free      |
| MongoDB   | Free   | Free      |
| OpenAI    | Pay-go | ~₹50-200  |
| **Total** |        | **~₹0-200/mo** |

---

## 📞 Support

Thiru Dentistry: +91 90426 36466  
WhatsApp: https://wa.me/919042636466
