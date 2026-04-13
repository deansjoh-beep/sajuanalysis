import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Firebase Admin Utils (inlined) ---
const DEFAULT_FIRESTORE_DB = 'ai-studio-fbfb1881-9f6e-4c3b-9700-cb6640ef2eb9';
const VERIFIED_REPORTS_BUCKET = 'gen-lang-client-0938860351-reports';

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

const resolveBucketName = (projectId: string): string => String(process.env.FIREBASE_STORAGE_BUCKET || '').trim() || String(process.env.REPORTS_STORAGE_BUCKET || '').trim() || VERIFIED_REPORTS_BUCKET || `${projectId}.firebasestorage.app`;
// --- End Firebase Admin Utils ---

let cachedAdmin: { storage: any; projectId: string } | null | undefined;

const getAdminStorage = async (): Promise<{ storage: any; projectId: string } | null> => {
  if (cachedAdmin !== undefined) return cachedAdmin;

  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getStorage } = await import('firebase-admin/storage');
    const { getFirestore } = await import('firebase-admin/firestore');

    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) {
      cachedAdmin = null;
      return null;
    }

    const defaultBucket = (
      String(process.env.FIREBASE_STORAGE_BUCKET || '').trim() ||
      `${serviceAccount.project_id}.firebasestorage.app`
    );
    const app = getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(serviceAccount as any),
          storageBucket: defaultBucket,
        });

    // Ensure Firestore app init path is aligned with existing code path.
    const dbId = resolveFirestoreDbId();
    getFirestore(app, dbId);

    cachedAdmin = {
      storage: getStorage(app),
      projectId: serviceAccount.project_id,
    };
    return cachedAdmin;
  } catch (error) {
    console.error('[api/premium-report/upload] Firebase Admin init failed:', error);
    cachedAdmin = null;
    return null;
  }
};

const readRawBody = async (req: VercelRequest): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve());
    req.on('error', (err) => reject(err));
  });
  return Buffer.concat(chunks);
};

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }

  try {
    const body = await readRawBody(req);
    if (!body || body.length === 0) {
      return res.status(400).json({ error: 'PDF_BODY_REQUIRED', message: 'PDF binary body is required' });
    }

    const admin = await getAdminStorage();
    if (!admin) {
      return res.status(500).json({
        error: 'ADMIN_SDK_UNAVAILABLE',
        message: 'Firebase Admin credentials are not configured',
      });
    }

    const { storage, projectId } = admin;
    // exists() 체크는 권한 오류로 실패할 수 있으므로 제거하고 버킷명을 직접 결정
    const bucketName = (
      String(process.env.FIREBASE_STORAGE_BUCKET || '').trim() ||
      `${projectId}.firebasestorage.app` ||
      `${projectId}.appspot.com`
    );

    const originalName = String(req.headers['x-file-name'] || 'premium-report.pdf');
    const safeName = originalName.replace(/[^a-zA-Z0-9가-힣_.-]/g, '_');
    const fileName = `${Date.now()}_${safeName}`;
    const objectPath = `lifeNavReports/${fileName}`;

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);
    await file.save(body, {
      metadata: { contentType: 'application/pdf' },
      resumable: false,
    });

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '2100-01-01',
    });

    return res.json({ success: true, url: signedUrl, path: objectPath, storage: 'gcs' });
  } catch (error: any) {
    console.error('[api/premium-report/upload] error:', error);
    return res.status(500).json({
      error: 'UPLOAD_FAILED',
      message: error?.message || 'Failed to upload PDF',
    });
  }
}
