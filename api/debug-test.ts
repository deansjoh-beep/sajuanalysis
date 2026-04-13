import type { VercelRequest, VercelResponse } from '@vercel/node';

const parseServiceAccount = (): any => {
  const jsonEnv = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (jsonEnv) { try { return JSON.parse(jsonEnv); } catch { return null; } }
  return null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sa = parseServiceAccount();
  return res.json({ ok: true, node: process.version, hasServiceAccount: !!sa });
}
