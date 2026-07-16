cat > supabase/functions/notify-appointment/index.ts << 'EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const payload = await req.json();
  const appt = payload.record;

  const emailBody = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#0d2137;padding:24px;text-align:center">
        <h2 style="color:#00c9a7;margin:0">🦷 New Appointment Booked</h2>
        <p style="color:#7a9ab8;margin:6px 0 0">Thiru Dentistry</p>
      </div>
      <div style="padding:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6b7280;width:40%">Patient Name</td><td style="padding:8px 0;font-weight:600">${appt.name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0;font-weight:600">${appt.phone}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Service</td><td style="padding:8px 0">${appt.service || 'Not specified'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0">${appt.date}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="padding:8px 0">${appt.time || 'Any time'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Message</td><td style="padding:8px 0">${appt.message || '—'}</td></tr>
        </table>
        <div style="margin-top:20px;padding:14px;background:#f0fdf4;border-radius:8px;border-left:4px solid #00c9a7">
          <p style="margin:0;font-size:0.85rem;color:#166534">📞 Call or WhatsApp the patient to confirm their appointment.</p>
        </div>
      </div>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Thiru Dentistry <onboarding@resend.dev>',
      to: [Deno.env.get('DOCTOR_EMAIL')],
      subject: `🦷 New Appointment — ${appt.name} on ${appt.date}`,
      html: emailBody
    })
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { status: 200 });
});
EOF