import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Firebase Admin Utils (inlined) ---
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

const resolveBucketName = (projectId: string): string => String(process.env.FIREBASE_STORAGE_BUCKET || '').trim() || String(process.env.REPORTS_STORAGE_BUCKET || '').trim() || VERIFIED_REPORTS_BUCKET || `${projectId}.firebasestorage.app`;
// --- End Firebase Admin Utils ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }

  try {
    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) {
      return res.status(500).json({
        error: 'ADMIN_SDK_UNAVAILABLE',
        message: 'Firebase Admin credentials are not configured',
      });
    }

    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getStorage } = await import('firebase-admin/storage');

    const bucketName = resolveBucketName(serviceAccount.project_id);

    const app = getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(serviceAccount as any),
          storageBucket: bucketName,
        });

    const storage = getStorage(app);
    const originalName = String(req.body?.fileName || 'premium-report.pdf');
    const safeName = originalName.replace(/[^a-zA-Z0-9가-힣_.-]/g, '_');
    const objectPath = `lifeNavReports/${Date.now()}_${safeName}`;

    const file = storage.bucket(bucketName).file(objectPath);

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: 'application/pdf',
    });

    const [readUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '2100-01-01',
    });

    return res.status(200).json({
      success: true,
      uploadUrl,
      readUrl,
      path: objectPath,
    });
  } catch (error: any) {
    console.error('[api/premium-report/upload-url] error:', error);
    return res.status(500).json({
      error: 'SIGNED_URL_FAILED',
      message: error?.message || 'Failed to create signed upload URL',
    });
  }
}
