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
    console.error('[api/premium-order/reject] Firebase Admin init failed:', error);
    cachedDb = null;
    return null;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }

  try {
    const db = await getAdminDb();
    if (!db) {
      return res.status(500).json({
        error: 'ADMIN_SDK_UNAVAILABLE',
        message: 'Firebase Admin credentials are not configured',
      });
    }

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
  } catch (error: any) {
    console.error('[api/premium-order/reject] error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Failed to reject order' });
  }
}
