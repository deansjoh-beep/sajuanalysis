import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkVercelRateLimit, generalLimiter } from '../lib/rate-limit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (await checkVercelRateLimit(req, res, generalLimiter)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  const { model, ...body } = req.body || {};
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'model field required' });
  }

  const safeModel = model.replace(/[^a-zA-Z0-9._-]/g, '');
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${apiKey}`;

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await geminiRes.json();
  return res.status(geminiRes.status).json(data);
}
