import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─── CORS HANDLERS ───
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, phone, service, date, time, message, recipientEmail } = await req.json()

    // ─── USING RESEND (Recommended) ───
    // If you prefer using SMTP, you'd need a different setup.
    // Replace YOUR_RESEND_API_KEY in Supabase secrets.
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY. Please set this in Supabase project secrets.')
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Thiru Dentistry <onboarding@resend.dev>', // Update with your verified domain
        to: [recipientEmail || 'andersonjuds01@gmail.com'],
        subject: `🦷 New Dental Appointment: ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0A3D62, #1ABC9C); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
              <h2 style="margin: 0;">🦷 New Appointment Request</h2>
              <p style="margin: 8px 0 0; opacity: 0.9;">Thiru Dentistry — Padianallur</p>
            </div>
            <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; border-radius: 0 0 12px 12px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">👤 Name:</td><td style="padding: 12px 0; border-bottom: 1px solid #eee;">${name}</td></tr>
                <tr><td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold;">📞 Phone:</td><td style="padding: 12px 0; border-bottom: 1px solid #eee;">${phone}</td></tr>
                <tr><td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold;">🩺 Service:</td><td style="padding: 12px 0; border-bottom: 1px solid #eee;">${service || 'Not specified'}</td></tr>
                <tr><td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold;">📅 Date:</td><td style="padding: 12px 0; border-bottom: 1px solid #eee;">${date}</td></tr>
                <tr><td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold;">🕐 Time:</td><td style="padding: 12px 0; border-bottom: 1px solid #eee;">${time || 'Any time'}</td></tr>
                <tr><td style="padding: 12px 0; font-weight: bold;">💬 Message:</td><td style="padding: 12px 0;">${message || 'None'}</td></tr>
              </table>
            </div>
          </div>`,
      }),
    })

    const result = await response.json()
    if (!response.ok) throw new Error(JSON.stringify(result))

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
