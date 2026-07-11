import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';
import { checkVercelRateLimit, generalLimiter } from '../_lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!checkVercelRateLimit(req, res, generalLimiter)) return;

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
  const isStream = req.query?.stream === '1';

  try {
    if (isStream) {
      // SSE — Gemini streamGenerateContent(alt=sse)를 그대로 파이프.
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      if (!upstream.ok || !upstream.body) {
        const errData = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json(errData);
      }
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      Readable.fromWeb(upstream.body as any).pipe(res);
      return;
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    const data = await geminiRes.json();
    return res.status(geminiRes.status).json(data);
  } catch (err: any) {
    return res.status(502).json({ error: { message: `Proxy fetch failed: ${err?.message || 'unknown'}`, code: 502 } });
  }
}
