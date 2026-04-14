import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    console.error('[api/premium-orders] Firebase Admin init failed:', error);
    cachedDb = null;
    return null;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only' });
  }

  try {
    const db = await getAdminDb();
    if (!db) {
      return res.status(500).json({
        error: 'ADMIN_SDK_UNAVAILABLE',
        message: 'Firebase Admin credentials are not configured',
      });
    }

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const productType =
      typeof req.query.productType === 'string' ? req.query.productType : undefined;

    // productType 필터는 기존 문서가 필드를 가지지 않을 수 있어(undefined=premium 취급)
    // 서버사이드 where 대신 쿼리 후 메모리 필터링으로 처리해 하위호환성을 보장한다.
    let snapshot;
    if (status && status !== 'all') {
      snapshot = await db
        .collection('premiumOrders')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .get();
    } else {
      snapshot = await db.collection('premiumOrders').orderBy('createdAt', 'desc').get();
    }

    let orders = snapshot.docs.map((d: any) => ({ orderId: d.id, ...d.data() }));

    if (productType && productType !== 'all') {
      orders = orders.filter((o: any) => {
        const t = o.productType || 'premium';
        return t === productType;
      });
    }

    return res.json({ success: true, orders });
  } catch (error: any) {
    console.error('[api/premium-orders] error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Failed to retrieve orders' });
  }
}
