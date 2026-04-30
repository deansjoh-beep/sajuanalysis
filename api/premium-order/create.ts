import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkVercelRateLimit, orderCreateLimiter } from '../lib/rate-limit.js';

// --- Firebase Admin Utils (inlined) ---
const DEFAULT_FIRESTORE_DB = 'ai-studio-fbfb1881-9f6e-4c3b-9700-cb6640ef2eb9';

type ServiceAccountLike = { project_id: string; client_email: string; private_key: string; };

const normalizeServiceAccount = (parsed: Partial<ServiceAccountLike> | null): ServiceAccountLike | null => {
  if (!parsed) return null;
  const projectId = String(parsed.project_id || '').trim();
  const clientEmail = String(parsed.client_email || '').trim();
  const privateKeyRaw = String(parsed.private_key || '').trim();
  if (!projectId || !clientEmail || !privateKeyRaw) return null;
  return { project_id: projectId, client_email: clientEmail, private_key: privateKeyRaw.replace(/\\n/g, '\n') };
};

const parseServiceAccount = (): ServiceAccountLike | null => {
  const jsonEnv = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (jsonEnv) { try { return normalizeServiceAccount(JSON.parse(jsonEnv)); } catch { return null; } }
  const b64Env = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
  if (b64Env) { try { return normalizeServiceAccount(JSON.parse(Buffer.from(b64Env, 'base64').toString('utf8'))); } catch { return null; } }
  const p = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const c = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const k = String(process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if (p && c && k) return normalizeServiceAccount({ project_id: p, client_email: c, private_key: k });
  return null;
};

const resolveFirestoreDbId = (): string => String(process.env.FIREBASE_DATABASE_ID || '').trim() || DEFAULT_FIRESTORE_DB;
// --- End Firebase Admin Utils ---

let cachedDb: any | null | undefined;

const getAdminDb = async (): Promise<any | null> => {
  if (cachedDb !== undefined) return cachedDb;

  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) {
      cachedDb = null;
      return null;
    }

    const app = getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(serviceAccount as any),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });

    const dbId = resolveFirestoreDbId();
    cachedDb = getFirestore(app, dbId);
    return cachedDb;
  } catch (error) {
    console.error('[api/premium-order/create] Firebase Admin init failed:', error);
    cachedDb = null;
    return null;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET' && req.query?.ping === '1') {
    return res.json({ ok: true, ts: Date.now() });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }

  // Rate Limiting
  if (!checkVercelRateLimit(req, res, orderCreateLimiter)) return;

  try {
    const db = await getAdminDb();
    if (!db) {
      return res.status(500).json({
        error: 'ADMIN_SDK_UNAVAILABLE',
        message: 'Firebase Admin credentials are not configured',
      });
    }

    const { FieldValue } = await import('firebase-admin/firestore');

    const order = req.body || {};
    const required = ['name', 'email', 'birthDate', 'birthTime', 'gender', 'isLunar', 'tier', 'price'];
    const missing = required.filter((k) => order[k] == null || order[k] === '');

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: `Required fields missing: ${missing.join(', ')}`,
      });
    }

    const rawProductType = String(order.productType || 'premium');
    const productType = rawProductType === 'yearly2026'
      ? 'yearly2026'
      : rawProductType === 'jobCareer'
        ? 'jobCareer'
        : rawProductType === 'loveMarriage'
          ? 'loveMarriage'
          : 'premium';

    const docRef = await db.collection('premiumOrders').add({
      name: String(order.name),
      email: String(order.email),
      birthDate: String(order.birthDate),
      birthTime: String(order.birthTime),
      gender: String(order.gender),
      isLunar: Boolean(order.isLunar),
      isLeap: Boolean(order.isLeap ?? false),
      unknownTime: Boolean(order.unknownTime ?? false),
      tier: String(order.tier),
      price: Number(order.price),
      productType,
      currentJob: String(order.currentJob || ''),
      workHistory: String(order.workHistory || ''),
      relationshipStatus: String(order.relationshipStatus || ''),
      concern: String(order.concern || ''),
      interest: String(order.interest || ''),
      reportLevel: String(order.reportLevel || 'basic'),
      lifeEvents: Array.isArray(order.lifeEvents) ? order.lifeEvents : [],
      adminNotes: String(order.adminNotes || ''),
      status: 'submitted',
      version: 1,
      createdAt: FieldValue.serverTimestamp(),
      generatedAt: null,
      sentAt: null,
    });

    return res.json({ success: true, orderId: docRef.id, message: 'Premium order created successfully' });
  } catch (error: any) {
    console.error('[api/premium-order/create] error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Failed to create premium order' });
  }
}
