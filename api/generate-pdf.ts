/**
 * Vercel Serverless Function: POST /api/generate-pdf
 *
 * Headless Chrome(Puppeteer)으로 HTML을 렌더링해서 PDF를 생성합니다.
 * Tailwind v4의 oklch/oklab/color-mix 색상을 브라우저 엔진이 그대로 처리하므로
 * html2canvas 방식의 색상 파싱 크래시 문제가 근본적으로 해결됩니다.
 *
 * 환경변수:
 *   PDF_API_TOKEN      - 요청 인증 토큰 (Vercel 대시보드에서 설정)
 *   CHROMIUM_BINARY_URL- Sparticuz Chromium 바이너리 URL (옵션, 기본값 내장)
 *
 * 로컬 개발:
 *   vercel dev 명령어로 실행하거나, CHROME_PATH 환경변수로 로컬 Chrome 경로 지정
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import * as path from 'path';
import { checkVercelRateLimit, pdfLimiter } from './lib/rate-limit.js';

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

// firebase-applet-config.json에서 storageBucket 폸백으로 사용
let _configBucket = '';
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase-applet-config.json'), 'utf8'));
  _configBucket = String(cfg?.storageBucket || '');
} catch { /* 로컼 또는 Vercel 환경 실패시 무시 */ }
export const CONFIG_STORAGE_BUCKET = _configBucket;

// A4 화면 크기 (96dpi 기준, CSS px)
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

// 허용 출처 목록 (CORS)
const ALLOWED_ORIGINS = [
  'https://sajuanalysis.vercel.app',
  'https://sajuanalysis-git-main.vercel.app',
  // vercel preview 도메인 패턴은 아래 런타임에서 체크
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
];

// 폰트 CDN 등 허용 호스트 (request interception 화이트리스트)
const ALLOWED_RESOURCE_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'hangeul.pstatic.net',
];

const ensureBucketExists = async (
  bucketName: string,
  serviceAccount: ServiceAccountLike,
): Promise<boolean> => {
  try {
    const { Storage } = await import('@google-cloud/storage');
    const rawLocation = String(process.env.FIREBASE_STORAGE_LOCATION || 'asia-northeast3').trim();
    const storageClient = new Storage({
      projectId: serviceAccount.project_id,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
    });

    const bucket = storageClient.bucket(bucketName);
    const [exists] = await bucket.exists();
    if (exists) return true;

    await storageClient.createBucket(bucketName, {
      location: rawLocation.toUpperCase(),
      storageClass: 'STANDARD',
    });
    console.log(`[generate-pdf] bucket created: ${bucketName} (location=${rawLocation})`);
    return true;
  } catch (error: any) {
    console.warn(`[generate-pdf] ensureBucketExists failed for ${bucketName}: ${error?.message || String(error)}`);
    return false;
  }
};

// 프로젝트 고유 버킷명 (firebase-applet-config.json / FIREBASE_STORAGE_BUCKET env 폴백)
const tryUploadPdfBuffer = async (pdfBuffer: Buffer, safeName: string): Promise<string | null> => {
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    console.warn('[generate-pdf] tryUploadPdfBuffer: service account not configured');
    return null;
  }

  const preferredBucket = resolveBucketName(serviceAccount.project_id);

  // 신형 .firebasestorage.app 버킷이 없을 경우 구형 .appspot.com 버킷으로 폴백
  const bucketCandidates = [...new Set([
    preferredBucket,
    VERIFIED_REPORTS_BUCKET,
    `${serviceAccount.project_id}.appspot.com`,
    `${serviceAccount.project_id}.firebasestorage.app`,
  ])];

  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getStorage } = await import('firebase-admin/storage');

  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount as any),
        storageBucket: preferredBucket,
      });

  const storage = getStorage(app);

  let lastError: Error | null = null;
  for (const bucketName of bucketCandidates) {
    try {
      console.log(`[generate-pdf] trying bucket="${bucketName}"`);
      const objectPath = `lifeNavReports/${Date.now()}_${safeName}.pdf`;
      const file = storage.bucket(bucketName).file(objectPath);
      await file.save(pdfBuffer, {
        metadata: { contentType: 'application/pdf' },
        resumable: false,
      });
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '2100-01-01',
      });
      console.log(`[generate-pdf] upload success bucket="${bucketName}"`);
      return signedUrl;
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      console.warn(`[generate-pdf] bucket="${bucketName}" failed: ${msg}`);
      lastError = err instanceof Error ? err : new Error(msg);
      if (msg.includes('does not exist') || msg.includes('404')) {
        const ensured = await ensureBucketExists(bucketName, serviceAccount);
        if (ensured) {
          try {
            const retryPath = `lifeNavReports/${Date.now()}_${safeName}.pdf`;
            const retryFile = storage.bucket(bucketName).file(retryPath);
            await retryFile.save(pdfBuffer, {
              metadata: { contentType: 'application/pdf' },
              resumable: false,
            });
            const [retrySignedUrl] = await retryFile.getSignedUrl({
              action: 'read',
              expires: '2100-01-01',
            });
            console.log(`[generate-pdf] upload success after bucket create: "${bucketName}"`);
            return retrySignedUrl;
          } catch (retryErr: any) {
            const retryMsg: string = retryErr?.message || String(retryErr);
            console.warn(`[generate-pdf] retry failed bucket="${bucketName}": ${retryMsg}`);
            lastError = retryErr instanceof Error ? retryErr : new Error(retryMsg);
          }
        }
      }
      // "버킷 없음(404/does not exist)" 이외의 오류(권한 등)는 즉시 throw
      if (!msg.includes('does not exist') && !msg.includes('404')) {
        throw new Error(`bucket="${bucketName}": ${msg}`);
      }
    }
  }

  throw new Error(
    `tried [${bucketCandidates.join(', ')}]: ${lastError?.message ?? 'all failed'}`
  );
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ────────────────────────────────────────────────────────────
  const origin = (req.headers.origin ?? '') as string;
  const isAllowedOrigin =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/sajuanalysis[a-z0-9-]*\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin);

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PDF-Token');
  res.setHeader('Access-Control-Expose-Headers', 'X-PDF-Storage-URL, X-PDF-Storage-Error');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate Limiting (인증 토큰이 있으면 스킵) ─────────────────────────
  const PDF_TOKEN = process.env.PDF_API_TOKEN;
  const providedToken = req.headers['x-pdf-token'];
  const isAuthenticated = PDF_TOKEN && providedToken === PDF_TOKEN;
  if (!isAuthenticated && !checkVercelRateLimit(req, res, pdfLimiter)) return;

  // ── 인증 ────────────────────────────────────────────────────────────
  if (PDF_TOKEN) {
    const provided = req.headers['x-pdf-token'];
    if (provided !== PDF_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // ── 입력 검증 ────────────────────────────────────────────────────────
  const { html, fileName } = req.body as { html?: string; fileName?: string };
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'html field required' });
  }
  if (html.length > 4_000_000) {
    return res.status(413).json({ error: 'HTML too large (max 4MB)' });
  }

  try {
    // ── Chromium 실행 경로 결정 ──────────────────────────────────────
    let executablePath: string;
    let launchArgs: string[];

    if (process.env.VERCEL) {
      // Vercel Serverless: @sparticuz/chromium-min 사용
      const chromiumMin = await import('@sparticuz/chromium-min');
      const binaryUrl =
        process.env.CHROMIUM_BINARY_URL ??
        'https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar';
      executablePath = await chromiumMin.default.executablePath(binaryUrl);
      launchArgs = chromiumMin.default.args;
    } else {
      // 로컬 개발: 시스템 Chrome 또는 CHROME_PATH 환경변수
      const LOCAL_CHROME_PATHS = [
        process.env.CHROME_PATH ?? '',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ].filter(Boolean);

      executablePath = LOCAL_CHROME_PATHS.find((p) => fs.existsSync(p)) ?? '';
      if (!executablePath) {
        return res.status(500).json({
          error: '로컬 Chrome을 찾을 수 없습니다. CHROME_PATH 환경변수를 설정하거나 Chrome을 설치하세요.',
        });
      }
      launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    }

    // ── 브라우저 실행 ────────────────────────────────────────────────
    const puppeteer = await import('puppeteer-core');
    const browser = await puppeteer.default.launch({
      args: launchArgs,
      defaultViewport: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    // SSRF 방지: 외부 요청 차단 (폰트 CDN만 허용)
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const type = request.resourceType();

      // 문서 로딩 & data URI 항상 허용
      if (type === 'document' || url.startsWith('data:')) {
        return request.continue();
      }
      // 폰트 CDN 허용
      if (ALLOWED_RESOURCE_HOSTS.some((host) => url.includes(host))) {
        return request.continue();
      }
      // 나머지 차단 (SSRF 방지)
      request.abort();
    });

    // 한자 폰트 링크를 서버에서 직접 주입 (클라이언트 HTML에 없더라도 온전히 적용)
    const serverFontInjection = `
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;700&display=block">
<style>
body, * { font-family: "Noto Serif SC", "Noto Sans SC", "Nanum Myeongjo", serif !important; }
</style>`;
    const processedHtml = html.replace(/<\/head>/, `${serverFontInjection}</head>`);

    // HTML 주입 후 폰트 로딩까지 대기
    // networkidle0: 모든 네트워크 요청(폰트 다운로드 포함) 완료 후
    await page.setContent(processedHtml, { waitUntil: 'networkidle0', timeout: 60_000 });
    // 특정 한자 문자로 폰트 강제 로드
    try {
      await page.evaluate(async () => {
        await (document as any).fonts.ready;
        const cjkChars = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
        const weights = ['400', '600', '700'];
        const fonts = ['Noto Serif SC', 'Noto Sans SC'];
        await Promise.allSettled(
          fonts.flatMap(f => weights.map(w => (document as any).fonts.load(`${w} 1em "${f}"`, cjkChars)))
        );
      });
    } catch {}
    // 폰트 렌더링 안정화 대기
    await new Promise(r => setTimeout(r, 1500));

    const issueDate = new Date().toISOString().slice(0, 10);

    // PDF 생성 (브라우저 네이티브 인쇄 엔진 사용 → oklch/oklab 완벽 지원)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%; padding:0 12mm; font-size:9px; color:#8b6b3e; font-family:'Noto Serif SC','Nanum Myeongjo',serif; display:flex; justify-content:space-between; align-items:center;">
          <span>인생가이드북 리포트</span>
          <span>${issueDate}</span>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; padding:0 12mm; font-size:9px; color:#9a7a4a; font-family:'Noto Serif SC','Nanum Myeongjo',serif; display:flex; justify-content:space-between; align-items:center;">
          <span>UI Saju Premium Report</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
      margin: { top: '18mm', bottom: '18mm', left: '12mm', right: '12mm' },
    });

    await browser.close();

    // 안전한 파일명 처리
    const safeName = (fileName ?? 'report').replace(/[^a-zA-Z0-9가-힣_\-]/g, '_');
    const safeFileName = encodeURIComponent(`${safeName}.pdf`);

    let storageUrl: string | null = null;
    let storageError: string | null = null;
    try {
      storageUrl = await tryUploadPdfBuffer(Buffer.from(pdfBuffer), safeName);
    } catch (e: any) {
      storageError = e?.message || 'storage upload failed';
    }
    if (storageUrl) {
      res.setHeader('X-PDF-Storage-URL', storageUrl);
    } else {
      res.setHeader('X-PDF-Storage-Error', storageError || 'upload returned null');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error('[generate-pdf] 오류:', err);
    res.status(500).json({ error: 'PDF 생성 실패', detail: String(err) });
  }
}
