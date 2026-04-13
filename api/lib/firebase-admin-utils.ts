/**
 * 공유 Firebase Admin SDK 유틸리티
 * 모든 Vercel API 함수에서 사용되는 service account 파싱 및 초기화 로직
 */

export const DEFAULT_FIRESTORE_DB = 'ai-studio-fbfb1881-9f6e-4c3b-9700-cb6640ef2eb9';
export const DEFAULT_STORAGE_BUCKET = 'gen-lang-client-0938860351-reports';
export const VERIFIED_REPORTS_BUCKET = 'gen-lang-client-0938860351-reports';

export type ServiceAccountLike = {
  project_id: string;
  client_email: string;
  private_key: string;
};

/**
 * Service account 필드 검증 및 정규화
 */
export const normalizeServiceAccount = (parsed: Partial<ServiceAccountLike> | null): ServiceAccountLike | null => {
  if (!parsed) return null;
  const projectId = String(parsed.project_id || '').trim();
  const clientEmail = String(parsed.client_email || '').trim();
  const privateKeyRaw = String(parsed.private_key || '').trim();
  if (!projectId || !clientEmail || !privateKeyRaw) return null;
  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKeyRaw.replace(/\\n/g, '\n'),
  };
};

/**
 * 환경변수에서 Firebase service account 파싱
 * 우선순위:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON (JSON 문자열)
 * 2. FIREBASE_SERVICE_ACCOUNT_BASE64 (base64 인코딩)
 * 3. 개별 환경변수 (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)
 */
export const parseServiceAccount = (): ServiceAccountLike | null => {
  const jsonEnv = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (jsonEnv) {
    try {
      return normalizeServiceAccount(JSON.parse(jsonEnv));
    } catch {
      return null;
    }
  }

  const b64Env = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
  if (b64Env) {
    try {
      const raw = Buffer.from(b64Env, 'base64').toString('utf8');
      return normalizeServiceAccount(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  const envProjectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const envClientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const envPrivateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if (envProjectId && envClientEmail && envPrivateKey) {
    return normalizeServiceAccount({
      project_id: envProjectId,
      client_email: envClientEmail,
      private_key: envPrivateKey,
    });
  }

  return null;
};

/**
 * 버킷명 결정 로직
 * 환경변수 → 커스텀 보고서 버킷 → 프로젝트 기본 형식들
 */
export const resolveBucketName = (projectId: string): string => {
  return (
    String(process.env.FIREBASE_STORAGE_BUCKET || '').trim() ||
    String(process.env.REPORTS_STORAGE_BUCKET || '').trim() ||
    VERIFIED_REPORTS_BUCKET ||
    `${projectId}.firebasestorage.app`
  );
};

/**
 * Firestore 데이터베이스 ID 결정
 */
export const resolveFirestoreDbId = (): string => {
  return (
    String(process.env.FIREBASE_DATABASE_ID || '').trim() ||
    DEFAULT_FIRESTORE_DB
  );
};
