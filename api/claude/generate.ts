import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkVercelRateLimit, generalLimiter } from '../_lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!checkVercelRateLimit(req, res, generalLimiter)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured' });
  }

  const { model, system, messages, max_tokens = 8192, temperature } = req.body || {};
  if (!model || !messages) {
    return res.status(400).json({ error: 'model and messages fields required' });
  }

  try {
    // temperature는 명시된 경우에만 전달 — Sonnet 5·Opus 4.7+ 계열은 비기본 값을 400으로 거부.
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, system, messages, max_tokens, ...(typeof temperature === 'number' ? { temperature } : {}) }),
    });

    const data = await claudeRes.json();
    return res.status(claudeRes.status).json(data);
  } catch (err: any) {
    return res.status(502).json({ error: { message: `Proxy fetch failed: ${err?.message || 'unknown'}`, code: 502 } });
  }
}
