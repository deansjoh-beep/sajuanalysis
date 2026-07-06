import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkVercelRateLimit, orderCreateLimiter } from './_lib/rate-limit.js';

/**
 * 프리미엄 주문 통합 엔드포인트 (Hobby 플랜 서버리스 함수 12개 한도 대응 — api/member.ts 패턴).
 *
 * 종전 api/premium-order/{create,reject,update}.ts 3개 함수를 통합.
 * 클라이언트 경로는 그대로 /api/premium-order/create 등 — vercel.json rewrite가
 * /api/premium-order/:action → /api/premium-order?action=:action 으로 매핑한다.
 * (dev는 server.ts의 기존 Express 라우트가 동일 경로를 직접 처리)
 */

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
    console.error('[api/premium-order] Firebase Admin init failed:', error);
    cachedDb = null;
    return null;
  }
};

async function handleCreate(req: VercelRequest, res: VercelResponse, db: any) {
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
}

async function handleUpdate(req: VercelRequest, res: VercelResponse, db: any) {
  const { FieldValue } = await import('firebase-admin/firestore');

  const orderId = String(req.body?.orderId || '');
  const updates = (req.body?.updates || {}) as Record<string, any>;

  if (!orderId) {
    return res.status(400).json({ error: 'ORDER_ID_REQUIRED', message: 'orderId is required' });
  }
  if (!updates || typeof updates !== 'object' || Array.isArray(updates) || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'UPDATES_REQUIRED', message: 'updates is required' });
  }

  const docRef = db.collection('premiumOrders').doc(orderId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'Order not found' });
  }

  const payload: Record<string, any> = { ...updates };
  if (updates.status === 'reviewing' && !updates.generatedAt) {
    payload.generatedAt = FieldValue.serverTimestamp();
  }
  if (updates.status === 'delivered' && !updates.sentAt) {
    payload.sentAt = FieldValue.serverTimestamp();
  }

  await docRef.update(payload);
  return res.json({ success: true });
}

async function handleReject(req: VercelRequest, res: VercelResponse, db: any) {
  const orderId = String(req.body?.orderId || '');
  const rejectReason = String(req.body?.rejectReason || '').trim();

  if (!orderId) {
    return res.status(400).json({ error: 'ORDER_ID_REQUIRED', message: 'orderId is required' });
  }
  if (!rejectReason) {
    return res.status(400).json({ error: 'REJECT_REASON_REQUIRED', message: 'rejectReason is required' });
  }

  const docRef = db.collection('premiumOrders').doc(orderId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'Order not found' });
  }

  const currentVersion = Number(docSnap.data()?.version || 1);
  await docRef.update({
    status: 'rejected',
    rejectReason,
    version: currentVersion + 1,
    reportText: null,
    pdfUrl: null,
  });

  return res.json({ success: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query?.action || '');

  if (req.method === 'GET' && req.query?.ping === '1') {
    return res.json({ ok: true, ts: Date.now() });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }
  if (action === 'create' && !checkVercelRateLimit(req, res, orderCreateLimiter)) return;

  try {
    const db = await getAdminDb();
    if (!db) {
      return res.status(500).json({
        error: 'ADMIN_SDK_UNAVAILABLE',
        message: 'Firebase Admin credentials are not configured',
      });
    }

    switch (action) {
      case 'create':
        return await handleCreate(req, res, db);
      case 'update':
        return await handleUpdate(req, res, db);
      case 'reject':
        return await handleReject(req, res, db);
      default:
        return res.status(400).json({ error: 'UNKNOWN_ACTION', message: `Unknown action: ${action || '(empty)'}` });
    }
  } catch (error: any) {
    console.error(`[api/premium-order:${action}] error:`, error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Request failed' });
  }
}
