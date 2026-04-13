import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }

  try {
    const apiKey = String(process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || '').trim();
    const fromEmail = String(process.env.FROM_EMAIL || process.env.VITE_FROM_EMAIL || 'noreply@example.com').trim();
    if (!apiKey) {
      return res.status(500).json({
        error: 'RESEND_API_KEY_MISSING',
        message: 'Resend API key is not configured on server',
      });
    }

    const to = String(req.body?.to || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const html = String(req.body?.html || '').trim();
    if (!to || !subject || !html) {
      return res.status(400).json({
        error: 'INVALID_EMAIL_PAYLOAD',
        message: 'to, subject, html are required',
      });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        html,
      }),
    });

    const raw = await resendResponse.text().catch(() => '');
    if (!resendResponse.ok) {
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.message || parsed?.error || raw;
      } catch {
        // keep raw
      }
      return res.status(resendResponse.status).json({
        error: 'RESEND_SEND_FAILED',
        message: detail || 'Failed to send email',
      });
    }

    let messageId = '';
    try {
      const parsed = JSON.parse(raw);
      messageId = String(parsed?.id || '');
    } catch {
      // ignore
    }

    return res.json({ success: true, messageId });
  } catch (error: any) {
    console.error('[api/premium-report/send-email] error:', error);
    return res.status(500).json({
      error: 'EMAIL_SEND_FAILED',
      message: error?.message || 'Failed to send email',
    });
  }
}
