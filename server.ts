import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { Readable } from "node:stream";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { runTaekilEngine, TaekilRequest } from "./src/utils/taekilEngine.ts";
import {
  expressRateLimit,
  pdfLimiter,
  emailLimiter,
  uploadLimiter,
  orderCreateLimiter,
  taekilLimiter,
  generalLimiter,
  purgeLimiter,
  paymentLimiter,
  codeLookupLimiter,
} from "./api/_lib/rate-limit.ts";
import { getDb, isDbConfigured } from "./db/client.ts";
import { CODE_PATTERN, normalizeCode, purgeByCode, purgeExpiredReports } from "./db/purge.ts";
import { consumeFollowup, lookupCode, redeemGiftCode, saveReport } from "./db/code.ts";
import { getAdminStats, sampleReportsForReview, saveReview } from "./db/admin.ts";
import { getFeedbackStats, submitFeedback } from "./db/feedback.ts";
import { createTossClient, isTossConfigured, TossApiError } from "./api/_lib/toss.ts";
import {
  confirmPaymentAndPersist,
  isPaidProduct,
  issueFreeOrder,
  PaymentValidationError,
  refundOrder,
  RefundNotAllowedError,
} from "./db/payment.ts";
import { isOpenProduct } from "./db/productAccess.ts";
import { assertNoPersonalKeys, PersonalDataError, type MyeongsikParams } from "./db/schema.ts";
import { serializeTimestamps } from "./api/_lib/serialize.ts";
import { generateDailyFortuneForSaju } from "./api/_lib/dailyFortune.ts";
import { claudeStreamAggregate } from "./api/_lib/claude-stream.ts";
import { getSeoulTodayYmd } from "./src/lib/seoulDateGanji.ts";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getStorage as getAdminStorage, Storage } from 'firebase-admin/storage';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { 
  getFirestore, 
  FieldValue, 
  Query,
  CollectionReference 
} from 'firebase-admin/firestore';

dotenv.config();
dotenv.config({ path: '.env.local', override: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase client config (for legacy use)
let firebaseConfig: any = null;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));
} catch (e) {
  console.warn('Failed to load firebase-applet-config.json');
}

// Initialize Firebase Admin SDK
let adminApp: App | null = null;
let adminDb: ReturnType<typeof getFirestore> | null = null;
let adminStorage: Storage | null = null;
let adminProjectId: string | null = null;
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');
try {
  if (getApps().length === 0) {
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
      adminProjectId = String(serviceAccount.project_id || '');
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket,
      });
      console.log('Firebase Admin SDK initialized with service account');
    } else {
      console.warn('service-account.json not found. Premium order creation via Admin SDK will be unavailable.');
    }
  } else {
    adminApp = getApps()[0];
  }
  if (adminApp) {
    adminDb = getFirestore(adminApp, 'ai-studio-fbfb1881-9f6e-4c3b-9700-cb6640ef2eb9');
    adminStorage = getAdminStorage(adminApp);
  }
} catch (e: any) {
  console.error('Failed to initialize Firebase Admin SDK:', e.message);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "20mb" }));

  // Security: Block access to sensitive files and patterns
  app.use((req, res, next) => {
    const sensitivePatterns = [
      /wp-config\.php/i,
      /\.env/i,
      /\.git/i,
      /\.htaccess/i,
      /\.php$/i,
      /config\.php/i,
      /database\.php/i
    ];
    if (sensitivePatterns.some(pattern => pattern.test(req.path))) {
      console.warn(`[SECURITY] Blocked access attempt to sensitive path: ${req.path} from ${req.ip}`);
      return res.status(403).send("Forbidden: Access to this file is restricted.");
    }

    // Block common admin/login paths to prevent scanning
    const adminPaths = [
      /^\/login/i,
      /^\/admin/i,
      /^\/wp-admin/i,
      /^\/administrator/i,
      /^\/portal/i
    ];
    if (adminPaths.some(pattern => pattern.test(req.path))) {
      return res.status(404).send("Not Found"); // Return 404 to hide existence
    }

    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/runtime-config", (_req, res) => {
    // API 키는 클라이언트에 노출하지 않음 — /api/gemini/generate, /api/claude/generate 프록시 사용
    res.json({});
  });

  app.post("/api/gemini/generate", expressRateLimit(generalLimiter), async (req, res) => {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { model, ...body } = req.body || {};
    if (!model || typeof model !== 'string') return res.status(400).json({ error: 'model field required' });

    const safeModel = model.replace(/[^a-zA-Z0-9._-]/g, '');

    // 스트리밍(SSE) — Gemini streamGenerateContent(alt=sse)를 그대로 클라이언트로 파이프.
    if (req.query.stream === '1') {
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
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
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await geminiRes.json();
    return res.status(geminiRes.status).json(data);
  });

  // 회원 통합 엔드포인트 (dev) — prod api/member.ts 와 동일 동작
  //  POST /api/member  → 카카오 로그인
  //  GET  /api/member  → 오늘의 운세 온디맨드 (ID 토큰) / 배치 (CRON_SECRET 일치 시)
  app.post('/api/member', expressRateLimit(generalLimiter), async (req, res) => {
    const code = String(req.body?.code || '').trim();
    const redirectUri = String(req.body?.redirectUri || '').trim();
    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'MISSING_PARAMS', message: 'code 와 redirectUri 가 필요합니다.' });
    }
    if (!adminApp) {
      return res.status(500).json({ error: 'ADMIN_SDK_UNAVAILABLE', message: 'service-account.json 이 필요합니다.' });
    }
    const restKey = String(process.env.KAKAO_REST_API_KEY || '').trim();
    if (!restKey) {
      return res.status(500).json({ error: 'KAKAO_NOT_CONFIGURED', message: 'KAKAO_REST_API_KEY 미설정' });
    }
    try {
      const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: restKey,
          redirect_uri: redirectUri,
          code,
        }).toString(),
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => '');
        console.error('[dev /api/member kakao] token exchange failed:', errText.slice(0, 200));
        return res.status(401).json({ error: 'KAKAO_TOKEN_FAILED', message: '카카오 토큰 교환에 실패했습니다.' });
      }
      const tokenData: any = await tokenRes.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        return res.status(401).json({ error: 'KAKAO_NO_ACCESS_TOKEN', message: '카카오 액세스 토큰을 받지 못했습니다.' });
      }
      const kakaoRes = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!kakaoRes.ok) {
        return res.status(401).json({ error: 'KAKAO_VERIFY_FAILED', message: '카카오 토큰 검증에 실패했습니다.' });
      }
      const kakaoUser: any = await kakaoRes.json();
      if (!kakaoUser?.id) {
        return res.status(401).json({ error: 'KAKAO_NO_ID', message: '카카오 사용자 정보를 가져오지 못했습니다.' });
      }
      const uid = `kakao:${kakaoUser.id}`;
      const email = kakaoUser.kakao_account?.email || undefined;
      const displayName =
        kakaoUser.kakao_account?.profile?.nickname || kakaoUser.properties?.nickname || '카카오 사용자';
      const photoURL =
        kakaoUser.kakao_account?.profile?.profile_image_url || kakaoUser.properties?.profile_image || undefined;
      const adminAuth = getAdminAuth(adminApp);
      try {
        await adminAuth.updateUser(uid, { email, displayName, photoURL });
      } catch {
        await adminAuth.createUser({ uid, email, displayName, photoURL }).catch(() => undefined);
      }
      const token = await adminAuth.createCustomToken(uid, { provider: 'kakao' });
      return res.json({ token, profile: { uid, email: email ?? null, displayName, photoURL: photoURL ?? null } });
    } catch (error: any) {
      console.error('[dev /api/member kakao] error:', error);
      return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Kakao auth failed' });
    }
  });

  app.get('/api/member', expressRateLimit(generalLimiter), async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cronSecret = String(process.env.CRON_SECRET || '').trim();
    if (!adminApp || !adminDb) {
      return res.status(500).json({ error: 'ADMIN_SDK_UNAVAILABLE', message: 'service-account.json 이 필요합니다.' });
    }
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_UNAVAILABLE', message: 'Gemini API 키 미설정' });
    const dateYmd = getSeoulTodayYmd();

    // 배치(cron) 모드
    if (cronSecret && bearer === cronSecret) {
      const started = Date.now();
      try {
        const membersSnap = await adminDb.collection('members').get();
        const targets: { uid: string; saju: any }[] = [];
        membersSnap.forEach((doc: any) => {
          const saju = doc.data()?.saju;
          if (saju && saju.birthYear) targets.push({ uid: doc.id, saju });
        });
        let generated = 0, skipped = 0, failed = 0;
        for (const { uid, saju } of targets) {
          const cacheRef = adminDb.collection('dailyFortunes').doc(`${uid}_${dateYmd}`);
          try {
            const existing = await cacheRef.get();
            if (existing.exists) { skipped++; continue; }
            const result = await generateDailyFortuneForSaju(saju, apiKey);
            await cacheRef.set({
              uid, date: result.dateYmd,
              dayPillarHanja: result.dayPillarHanja, dayPillarHangul: result.dayPillarHangul,
              fortune: result.fortune, model: result.model, source: 'cron',
              createdAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            generated++;
          } catch (err: any) {
            failed++;
            console.error(`[dev /api/member cron] ${uid} failed:`, err?.message);
          }
        }
        return res.json({ success: true, date: dateYmd, targets: targets.length, generated, skipped, failed, elapsedMs: Date.now() - started });
      } catch (error: any) {
        console.error('[dev /api/member cron] fatal:', error);
        return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message });
      }
    }

    // 온디맨드 모드 (Firebase ID 토큰)
    if (!bearer) return res.status(401).json({ error: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' });
    try {
      let uid: string;
      try {
        const decoded = await getAdminAuth(adminApp).verifyIdToken(bearer);
        uid = decoded.uid;
      } catch {
        return res.status(401).json({ error: 'INVALID_TOKEN', message: '유효하지 않은 인증입니다.' });
      }
      const memberSnap = await adminDb.collection('members').doc(uid).get();
      const saju = memberSnap.exists ? (memberSnap.data()?.saju as any) : undefined;
      if (!saju || !saju.birthYear) {
        return res.status(409).json({ error: 'NO_SAJU_PROFILE', message: '사주 정보가 없습니다. 먼저 만세력 분석을 진행해 주세요.' });
      }
      const cacheRef = adminDb.collection('dailyFortunes').doc(`${uid}_${dateYmd}`);
      const forceRegen = req.query.refresh === '1';
      if (!forceRegen) {
        const cached = await cacheRef.get();
        if (cached.exists) return res.json({ success: true, cached: true, ...serializeTimestamps(cached.data()) });
      }
      const result = await generateDailyFortuneForSaju(saju, apiKey);
      const payload = {
        uid, date: result.dateYmd,
        dayPillarHanja: result.dayPillarHanja, dayPillarHangul: result.dayPillarHangul,
        fortune: result.fortune, model: result.model, source: 'on-demand',
        createdAt: FieldValue.serverTimestamp(),
      };
      await cacheRef.set(payload, { merge: true });
      return res.json({ success: true, cached: false, ...serializeTimestamps({ ...payload, createdAt: new Date() }) });
    } catch (error: any) {
      console.error('[dev /api/member daily] error:', error);
      return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || '운세 생성 실패' });
    }
  });

  app.post("/api/claude/generate", expressRateLimit(generalLimiter), async (req, res) => {
    const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

    const { model, system, messages, max_tokens = 8192, temperature, thinking, stream } = req.body || {};
    if (!model || !messages) return res.status(400).json({ error: 'model and messages fields required' });

    // temperature는 명시된 경우에만 전달 — Sonnet 5·Opus 4.7+ 계열은 비기본 값을 400으로 거부.
    const claudeBody = {
      model,
      system,
      messages,
      max_tokens,
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(thinking && typeof thinking === 'object' ? { thinking } : {}),
    };

    // 장문 생성(stream: true)은 SSE 수신 → 서버측 조립으로 헤더 타임아웃 회피.
    if (stream === true) {
      const { status, data } = await claudeStreamAggregate(apiKey, claudeBody as any);
      return res.status(status).json(data);
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(claudeBody),
    });
    const data = await claudeRes.json();
    return res.status(claudeRes.status).json(data);
  });

  app.post('/api/generate-pdf', expressRateLimit(pdfLimiter, (req) => {
    // PDF_API_TOKEN 인증 성공 시 rate limit 스킵 (관리자 요청)
    const pdfToken = String(process.env.PDF_API_TOKEN || '').trim();
    return pdfToken !== '' && req.headers['x-pdf-token'] === pdfToken;
  }), async (req, res) => {
    const html = typeof req.body?.html === 'string' ? req.body.html : '';
    const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : 'report';

    if (!html) {
      return res.status(400).json({ error: 'html field required' });
    }

    const pdfToken = String(process.env.PDF_API_TOKEN || '').trim();
    if (pdfToken) {
      const provided = String(req.header('x-pdf-token') || '');
      if (provided !== pdfToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    try {
      const LOCAL_CHROME_PATHS = [
        process.env.CHROME_PATH || '',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ].filter(Boolean);

      const executablePath = LOCAL_CHROME_PATHS.find((p) => fs.existsSync(p));
      if (!executablePath) {
        return res.status(500).json({
          error: 'Chrome not found',
          detail: 'CHROME_PATH를 설정하거나 Google Chrome을 설치해주세요.'
        });
      }

      const puppeteer = await import('puppeteer-core');
      const browser = await puppeteer.default.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: { width: 794, height: 1123 },
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width:100%; padding:0 12mm; font-size:9px; color:#8b6b3e; font-family:'Noto Serif KR','Apple SD Gothic Neo',serif; display:flex; justify-content:space-between; align-items:center;">
            <span>인생가이드북 리포트</span>
            <span>${new Date().toISOString().slice(0, 10)}</span>
          </div>
        `,
        footerTemplate: `
          <div style="width:100%; padding:0 12mm; font-size:9px; color:#9a7a4a; font-family:'Noto Serif KR','Apple SD Gothic Neo',serif; display:flex; justify-content:space-between; align-items:center;">
            <span>UI Saju Premium Report</span>
            <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        `,
        margin: { top: '18mm', bottom: '18mm', left: '12mm', right: '12mm' },
      });

      await browser.close();

      const safeName = fileName.replace(/[^a-zA-Z0-9가-힣_\-]/g, '_');
      const safeFileName = encodeURIComponent(`${safeName}.pdf`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(pdfBuffer.length));
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}`);
      return res.send(Buffer.from(pdfBuffer));
    } catch (error: any) {
      console.error('[generate-pdf] error:', error);
      return res.status(500).json({ error: 'PDF 생성 실패', detail: String(error?.message || error) });
    }
  });

  app.post('/api/premium-report/upload', expressRateLimit(uploadLimiter), express.raw({ type: 'application/pdf', limit: '100mb' }), async (req, res) => {
    try {
      const reportDir = path.join(__dirname, '.tmp', 'premium-reports');
      if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

      const bucketCandidates = [
        process.env.FIREBASE_STORAGE_BUCKET,
        firebaseConfig?.storageBucket,
        adminProjectId ? `${adminProjectId}.appspot.com` : undefined,
        adminProjectId ? `${adminProjectId}.firebasestorage.app` : undefined,
      ].filter(Boolean) as string[];

      let bucketName = '';
      if (adminStorage) {
        for (const candidate of bucketCandidates) {
          try {
            const [exists] = await adminStorage.bucket(candidate).exists();
            if (exists) {
              bucketName = candidate;
              break;
            }
          } catch {
            // try next candidate
          }
        }
      }

      const body = req.body as Buffer;
      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({ error: 'PDF_BODY_REQUIRED', message: 'PDF binary body is required' });
      }

      const originalName = String(req.header('x-file-name') || 'premium-report.pdf');
      const safeName = originalName.replace(/[^a-zA-Z0-9가-힣_.-]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;

      // 1) Cloud bucket 업로드 시도
      if (adminStorage && bucketName) {
        try {
          const objectPath = `lifeNavReports/${fileName}`;
          const bucket = adminStorage.bucket(bucketName);
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
        } catch (cloudErr) {
          console.warn('Cloud storage upload failed. Falling back to local file storage.', cloudErr);
        }
      }

      // 2) 로컬 파일 저장 폴백
      const localPath = path.join(reportDir, fileName);
      fs.writeFileSync(localPath, body);
      const localUrl = `${req.protocol}://${req.get('host')}/api/premium-report/files/${encodeURIComponent(fileName)}`;
      return res.json({ success: true, url: localUrl, path: localPath, storage: 'local' });
    } catch (error: any) {
      console.error('Failed to upload premium report PDF:', error);
      return res.status(500).json({
        error: 'UPLOAD_FAILED',
        message: error?.message || 'Failed to upload PDF',
      });
    }
  });

  app.post('/api/premium-report/send-email', expressRateLimit(emailLimiter), async (req, res) => {
    try {
      const apiKey = String(process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || '').trim();
      const fromEmail = String(process.env.FROM_EMAIL || process.env.VITE_FROM_EMAIL || 'noreply@example.com').trim();
      if (!apiKey) {
        return res.status(500).json({
          error: 'RESEND_API_KEY_MISSING',
          message: 'Resend API key is not configured on server',
        });
      }

      const to = String(req.body?.to || '').trim();
      const subject = String(req.body?.subject || '').trim();
      const html = String(req.body?.html || '').trim();
      if (!to || !subject || !html) {
        return res.status(400).json({
          error: 'INVALID_EMAIL_PAYLOAD',
          message: 'to, subject, html are required',
        });
      }

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to,
          subject,
          html,
        }),
      });

      const raw = await resendResponse.text().catch(() => '');
      if (!resendResponse.ok) {
        let detail = raw;
        try {
          const parsed = JSON.parse(raw);
          detail = parsed?.message || parsed?.error || raw;
        } catch {
          // keep raw text
        }
        return res.status(resendResponse.status).json({
          error: 'RESEND_SEND_FAILED',
          message: detail || 'Failed to send email',
        });
      }

      let messageId = '';
      try {
        const parsed = JSON.parse(raw);
        messageId = String(parsed?.id || '');
      } catch {
        // ignore parse failure
      }
      return res.json({ success: true, messageId });
    } catch (error: any) {
      console.error('Failed to send premium report email:', error);
      return res.status(500).json({
        error: 'EMAIL_SEND_FAILED',
        message: error?.message || 'Failed to send email',
      });
    }
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!err) return next();
    const isApi = String(req.path || '').startsWith('/api/');
    if (!isApi) return next(err);

    if (err.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: '업로드 용량이 너무 큽니다. PDF 용량을 줄여 다시 시도해주세요.',
      });
    }

    return res.status(err.status || 500).json({
      error: err.code || 'API_ERROR',
      message: err.message || '서버 처리 중 오류가 발생했습니다.',
    });
  });

  app.get('/api/premium-report/files/:fileName', (req, res) => {
    try {
      const fileName = String(req.params.fileName || '');
      if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        return res.status(400).send('Invalid file name');
      }

      const reportDir = path.join(__dirname, '.tmp', 'premium-reports');
      const filePath = path.join(reportDir, fileName);
      if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      return res.sendFile(filePath);
    } catch (error: any) {
      return res.status(500).send(error?.message || 'Failed to read file');
    }
  });

  // ── Phase 2-1: 파기 API — api/code.ts(Vercel)와 동일 형상 유지 ──────────
  // DELETE /api/purge?code= (스펙 경로) = DELETE /api/code?code= → 즉시 파기(연쇄, 복구 불가)
  app.delete(["/api/purge", "/api/code"], expressRateLimit(purgeLimiter), async (req, res) => {
    try {
      if (!isDbConfigured()) {
        return res.status(503).json({ error: 'DB_NOT_CONFIGURED', message: '데이터베이스가 아직 구성되지 않았습니다 (DATABASE_URL 미설정).' });
      }
      const raw = String(req.query.code || '').trim();
      if (!raw) {
        return res.status(400).json({ error: 'CODE_REQUIRED', message: 'code 쿼리 파라미터가 필요합니다.' });
      }
      const code = normalizeCode(raw);
      if (!CODE_PATTERN.test(code)) {
        return res.status(400).json({ error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' });
      }
      const db = await getDb();
      const result = await purgeByCode(db, code);
      if (!result.found) {
        return res.status(404).json({ error: 'CODE_NOT_FOUND', message: '해당 코드를 찾을 수 없습니다.' });
      }
      return res.status(200).json({
        ok: true,
        irrecoverable: true,
        message: '해당 코드의 명식·주문·리포트가 모두 파기되었습니다. 이 작업은 되돌릴 수 없습니다.',
        ordersPurged: result.ordersPurged,
        reportsPurged: result.reportsPurged,
      });
    } catch (error: any) {
      console.error('[purge] failed:', error);
      return res.status(500).json({ error: 'PURGE_FAILED', message: error?.message || 'purge failed' });
    }
  });

  // GET /api/purge → 만료 리포트 청소 (프로덕션 크론과 동일 경로, CRON_SECRET 필요)
  app.get("/api/purge", async (req, res) => {
    try {
      if (!isDbConfigured()) {
        return res.status(503).json({ error: 'DB_NOT_CONFIGURED' });
      }
      const cronSecret = (process.env.CRON_SECRET || '').trim();
      const auth = String(req.headers['authorization'] || '');
      if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }
      const db = await getDb();
      const purged = await purgeExpiredReports(db);
      console.log(`[purge-cron] expired reports purged: ${purged}`);
      return res.status(200).json({ ok: true, expiredReportsPurged: purged });
    } catch (error: any) {
      console.error('[purge-cron] failed:', error);
      return res.status(500).json({ error: 'PURGE_CRON_FAILED', message: error?.message || 'purge cron failed' });
    }
  });

  // ── Phase 2-3: 사주 코드 조회/재열람·선물 리딤·후속 질문 — api/code.ts와 동일 형상 ──
  const CODE_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // 관리자 토큰 검사 (2-5) — ADMIN_ACCESS_TOKEN 미설정 시 관리자 기능 전체 비활성
  const isAdminReq = (req: any): boolean => {
    const token = (process.env.ADMIN_ACCESS_TOKEN || '').trim();
    return Boolean(token) && String(req.headers['x-admin-token'] || '') === token;
  };

  // ── Phase 2-5: 관리자 통계·검수 — api/payment.ts(stats)·api/code.ts(sample/review)와 동일 형상 ──
  app.get("/api/payment/stats", async (req, res) => {
    try {
      if (!isDbConfigured()) return res.status(503).json({ error: 'DB_NOT_CONFIGURED' });
      if (!isAdminReq(req)) return res.status(401).json({ error: 'UNAUTHORIZED', message: '관리자 토큰이 필요합니다.' });
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
      const db = await getDb();
      const [stats, feedbackStats] = await Promise.all([getAdminStats(db, days), getFeedbackStats(db)]);
      return res.status(200).json({ ok: true, stats, feedbackStats });
    } catch (error: any) {
      console.error('[payment:stats] failed:', error);
      return res.status(500).json({ error: 'STATS_FAILED', message: error?.message || 'stats failed' });
    }
  });

  app.post("/api/code/review", async (req, res) => {
    try {
      if (!isDbConfigured()) return res.status(503).json({ error: 'DB_NOT_CONFIGURED' });
      if (!isAdminReq(req)) return res.status(401).json({ error: 'UNAUTHORIZED', message: '관리자 토큰이 필요합니다.' });
      const reportId = String(req.body?.reportId || '').trim();
      const verdict = String(req.body?.verdict || '');
      if (!CODE_UUID_PATTERN.test(reportId) || (verdict !== 'approved' && verdict !== 'rejected')) {
        return res.status(400).json({ error: 'INVALID_REQUEST', message: 'reportId와 verdict(approved|rejected)가 필요합니다.' });
      }
      const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String).slice(0, 10) : [];
      const note = String(req.body?.note || '').slice(0, 2000);
      const db = await getDb();
      const outcome = await saveReview(db, { reportId, verdict: verdict as 'approved' | 'rejected', tags, note });
      if (!outcome.ok) {
        return res.status(404).json({ error: 'REPORT_NOT_FOUND', message: '해당 리포트를 찾을 수 없습니다 (만료·파기됐을 수 있습니다).' });
      }
      return res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('[code:review] failed:', error);
      return res.status(500).json({ error: 'CODE_API_FAILED', message: error?.message || 'review failed' });
    }
  });

  app.get("/api/code", expressRateLimit(codeLookupLimiter, (req) => !String((req as any).query?.code || '').trim()), async (req, res) => {
    try {
      if (!isDbConfigured()) {
        return res.status(503).json({ error: 'DB_NOT_CONFIGURED' });
      }
      // [관리자] 오늘 생성분 검수 샘플
      if (String(req.query.adminSample || '') === '1') {
        if (!isAdminReq(req)) {
          return res.status(401).json({ error: 'UNAUTHORIZED', message: '관리자 토큰이 필요합니다.' });
        }
        const db = await getDb();
        const samples = await sampleReportsForReview(db, 10);
        return res.status(200).json({ ok: true, samples });
      }
      const raw = String(req.query.code || '').trim();
      if (!raw) {
        // 코드 없는 GET = 만료 청소 크론 (프로덕션 vercel.json crons와 동일 경로)
        const cronSecret = (process.env.CRON_SECRET || '').trim();
        const auth = String(req.headers['authorization'] || '');
        if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
          return res.status(401).json({ error: 'UNAUTHORIZED' });
        }
        const db = await getDb();
        const purged = await purgeExpiredReports(db);
        console.log(`[purge-cron] expired reports purged: ${purged}`);
        return res.status(200).json({ ok: true, expiredReportsPurged: purged });
      }
      const code = normalizeCode(raw);
      if (!CODE_PATTERN.test(code)) {
        return res.status(400).json({ error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' });
      }
      const db = await getDb();
      const result = await lookupCode(db, code);
      if (!result.found) {
        return res.status(404).json({ error: 'CODE_NOT_FOUND', message: '해당 코드를 찾을 수 없습니다.' });
      }
      return res.status(200).json(result);
    } catch (error: any) {
      console.error('[code:lookup] failed:', error);
      return res.status(500).json({ error: 'CODE_API_FAILED', message: error?.message || 'lookup failed' });
    }
  });

  app.post("/api/code/redeem", expressRateLimit(codeLookupLimiter), async (req, res) => {
    try {
      if (!isDbConfigured()) {
        return res.status(503).json({ error: 'DB_NOT_CONFIGURED' });
      }
      const code = normalizeCode(String(req.body?.code || ''));
      if (!CODE_PATTERN.test(code)) {
        return res.status(400).json({ error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' });
      }
      const myeongsik = req.body?.myeongsik as MyeongsikParams | undefined;
      if (!myeongsik || typeof myeongsik !== 'object') {
        return res.status(400).json({ error: 'MYEONGSIK_REQUIRED', message: '선물 코드 등록에는 myeongsik(명식 파라미터)이 필요합니다.' });
      }
      const db = await getDb();
      const outcome = await redeemGiftCode(db, code, myeongsik);
      if (outcome === 'not_found') {
        return res.status(404).json({ error: 'CODE_NOT_FOUND', message: '해당 코드를 찾을 수 없습니다.' });
      }
      if (outcome === 'already_redeemed') {
        return res.status(409).json({ error: 'ALREADY_REDEEMED', message: '이미 등록된 코드입니다.' });
      }
      return res.status(200).json({ ok: true, redeemed: true });
    } catch (error: any) {
      if (error instanceof PersonalDataError) {
        return res.status(400).json({ error: 'FORBIDDEN_PERSONAL_DATA', message: error.message });
      }
      console.error('[code:redeem] failed:', error);
      return res.status(500).json({ error: 'CODE_API_FAILED', message: error?.message || 'redeem failed' });
    }
  });

  app.post("/api/code/followup", expressRateLimit(codeLookupLimiter), async (req, res) => {
    try {
      if (!isDbConfigured()) {
        return res.status(503).json({ error: 'DB_NOT_CONFIGURED' });
      }
      const code = normalizeCode(String(req.body?.code || ''));
      if (!CODE_PATTERN.test(code)) {
        return res.status(400).json({ error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' });
      }
      const orderId = String(req.body?.orderId || '').trim();
      if (!CODE_UUID_PATTERN.test(orderId)) {
        return res.status(400).json({ error: 'ORDER_ID_INVALID', message: 'orderId가 올바르지 않습니다.' });
      }
      const db = await getDb();
      const outcome = await consumeFollowup(db, code, orderId);
      if (!outcome.ok && outcome.reason === 'order_not_found') {
        return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: '해당 코드의 주문을 찾을 수 없습니다.' });
      }
      if (!outcome.ok) {
        return res.status(429).json({ error: 'FOLLOWUP_EXHAUSTED', message: '후속 질문 횟수를 모두 사용했습니다 (구매당 3회).', remaining: 0 });
      }
      return res.status(200).json({ ok: true, remaining: outcome.remaining });
    } catch (error: any) {
      console.error('[code:followup] failed:', error);
      return res.status(500).json({ error: 'CODE_API_FAILED', message: error?.message || 'followup failed' });
    }
  });

  app.post("/api/code/feedback", expressRateLimit(codeLookupLimiter), async (req, res) => {
    try {
      if (!isDbConfigured()) {
        return res.status(503).json({ error: 'DB_NOT_CONFIGURED' });
      }
      const code = normalizeCode(String(req.body?.code || ''));
      if (!CODE_PATTERN.test(code)) {
        return res.status(400).json({ error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' });
      }
      const product = String(req.body?.product || '');
      if (!isPaidProduct(product)) {
        return res.status(400).json({ error: 'INVALID_PRODUCT', message: `알 수 없는 상품: ${product}` });
      }
      const db = await getDb();
      const outcome = await submitFeedback(db, {
        code,
        product,
        rating: Number(req.body?.rating),
        answers: (req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {}) as Record<string, string>,
        comment: String(req.body?.comment || ''),
      });
      if (!outcome.ok && outcome.reason === 'code_not_found') {
        return res.status(404).json({ error: 'CODE_NOT_FOUND', message: '해당 코드를 찾을 수 없습니다.' });
      }
      if (!outcome.ok) {
        return res.status(400).json({ error: 'INVALID_FEEDBACK', message: '별점(1~5)과 선택지 값을 확인해 주세요.' });
      }
      return res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('[code:feedback] failed:', error);
      return res.status(500).json({ error: 'CODE_API_FAILED', message: error?.message || 'feedback failed' });
    }
  });

  app.post("/api/code/save-report", expressRateLimit(codeLookupLimiter), async (req, res) => {
    try {
      if (!isDbConfigured()) {
        return res.status(503).json({ error: 'DB_NOT_CONFIGURED' });
      }
      const code = normalizeCode(String(req.body?.code || ''));
      if (!CODE_PATTERN.test(code)) {
        return res.status(400).json({ error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' });
      }
      const orderId = String(req.body?.orderId || '').trim();
      if (!CODE_UUID_PATTERN.test(orderId)) {
        return res.status(400).json({ error: 'ORDER_ID_INVALID', message: 'orderId가 올바르지 않습니다.' });
      }
      const content = typeof req.body?.content === 'string' ? req.body.content : '';
      if (content.trim().length < 100 || content.length > 300_000) {
        return res.status(400).json({ error: 'CONTENT_INVALID', message: '리포트 본문이 비어 있거나 허용 크기를 벗어났습니다.' });
      }
      const asOptionalInt = (v: unknown): number | null =>
        v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null;
      const db = await getDb();
      const outcome = await saveReport(db, code, orderId, content, {
        generationCostKrw: asOptionalInt(req.body?.generationCostKrw),
        qualityScore: asOptionalInt(req.body?.qualityScore),
      });
      if (!outcome.ok && outcome.reason === 'order_not_found') {
        return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: '해당 코드의 주문을 찾을 수 없습니다.' });
      }
      if (!outcome.ok && outcome.reason === 'order_not_eligible') {
        return res.status(409).json({ error: 'ORDER_NOT_ELIGIBLE', message: '환불된 주문에는 리포트를 저장할 수 없습니다.' });
      }
      if (!outcome.ok) {
        return res.status(409).json({ error: 'REPORT_ALREADY_ACTIVE', message: '이미 유효한 리포트가 있습니다. 만료 후 재생성할 수 있습니다.' });
      }
      return res.status(200).json({ ok: true, reportId: outcome.reportId, expiresAt: outcome.expiresAt });
    } catch (error: any) {
      console.error('[code:save-report] failed:', error);
      return res.status(500).json({ error: 'CODE_API_FAILED', message: error?.message || 'save-report failed' });
    }
  });

  // ── Phase 2-2: 결제 — api/payment.ts(Vercel)와 동일 형상 유지 ──────────
  const handlePaymentError = (res: any, action: string, error: unknown) => {
    if (error instanceof PaymentValidationError) {
      return res.status(400).json({ error: 'AMOUNT_MISMATCH', message: error.message });
    }
    if (error instanceof PersonalDataError) {
      return res.status(400).json({ error: 'FORBIDDEN_PERSONAL_DATA', message: error.message });
    }
    if (error instanceof RefundNotAllowedError) {
      return res.status(403).json({ error: 'REFUND_NOT_ALLOWED', message: error.message });
    }
    if (error instanceof TossApiError) {
      console.error(`[payment:${action}] toss error ${error.code}:`, error.message);
      return res.status(402).json({ error: error.code, message: error.message });
    }
    const message = error instanceof Error ? error.message : 'payment failed';
    console.error(`[payment:${action}] error:`, error);
    return res.status(500).json({ error: 'PAYMENT_FAILED', message });
  };

  const requirePaymentReady = (res: any): boolean => {
    if (!isDbConfigured()) {
      res.status(503).json({ error: 'DB_NOT_CONFIGURED', message: '데이터베이스가 아직 구성되지 않았습니다.' });
      return false;
    }
    if (!isTossConfigured()) {
      res.status(503).json({
        error: 'PAYMENT_NOT_CONFIGURED',
        message: '결제 모듈이 아직 활성화되지 않았습니다 (TOSS_SECRET_KEY 미설정 — 테스트 키로 선행 개발 가능).',
      });
      return false;
    }
    return true;
  };

  // 무료 개방 발급 — 토스 없이 코드+주문(₩0). DB만 필요(토스 미설정 환경 동작). api/payment.ts `free`와 동일 형상.
  app.post("/api/payment/free", expressRateLimit(paymentLimiter), async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: 'DB_NOT_CONFIGURED', message: '데이터베이스가 아직 구성되지 않았습니다.' });
    }
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const product = String(body.product || '');
      const myeongsik = body.myeongsik as MyeongsikParams | undefined;
      if (!isPaidProduct(product)) {
        return res.status(400).json({ error: 'INVALID_PRODUCT', message: `알 수 없는 상품: ${product}` });
      }
      if (!isOpenProduct(product)) {
        return res.status(403).json({ error: 'PRODUCT_NOT_OPEN', message: '아직 무료 개방되지 않은 상품입니다.' });
      }
      if (!myeongsik) {
        return res.status(400).json({ error: 'MYEONGSIK_REQUIRED', message: 'myeongsik(명식 파라미터)이 필요합니다.' });
      }
      assertNoPersonalKeys(myeongsik as unknown as Record<string, unknown>);
      const db = await getDb();
      const result = await issueFreeOrder(db, product, myeongsik);
      return res.status(200).json({ ok: true, code: result.code, orderId: result.orderId });
    } catch (error) {
      return handlePaymentError(res, 'free', error);
    }
  });

  app.post("/api/payment/confirm", expressRateLimit(paymentLimiter), async (req, res) => {
    if (!requirePaymentReady(res)) return;
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const paymentKey = String(body.paymentKey || '').trim();
      const orderNo = String(body.orderId || '').trim();
      const amount = Number(body.amount);
      const product = String(body.product || '');
      const gift = Boolean(body.gift);
      const myeongsik = gift ? null : (body.myeongsik as MyeongsikParams | undefined);

      if (!paymentKey || !orderNo || !Number.isInteger(amount)) {
        return res.status(400).json({ error: 'INVALID_REQUEST', message: 'paymentKey, orderId, amount는 필수입니다.' });
      }
      if (!isPaidProduct(product)) {
        return res.status(400).json({ error: 'INVALID_PRODUCT', message: `알 수 없는 상품: ${product}` });
      }
      if (!gift && !myeongsik) {
        return res.status(400).json({ error: 'MYEONGSIK_REQUIRED', message: '일반 상품 결제에는 myeongsik(명식 파라미터)이 필요합니다.' });
      }
      if (myeongsik) assertNoPersonalKeys(myeongsik as unknown as Record<string, unknown>);

      const db = await getDb();
      const toss = createTossClient();
      const result = await confirmPaymentAndPersist(db, toss, {
        orderNo, paymentKey, amount, product, myeongsik: myeongsik ?? null,
      });
      return res.status(200).json({
        ok: true,
        alreadyProcessed: result.alreadyProcessed,
        code: result.code,
        orderId: result.orderId,
      });
    } catch (error) {
      return handlePaymentError(res, 'confirm', error);
    }
  });

  app.post("/api/payment/refund", expressRateLimit(paymentLimiter), async (req, res) => {
    if (!requirePaymentReady(res)) return;
    try {
      const adminToken = (process.env.ADMIN_ACCESS_TOKEN || '').trim();
      const provided = String(req.headers['x-admin-token'] || '');
      if (!adminToken || provided !== adminToken) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: '환불은 관리자 토큰이 필요합니다.' });
      }
      const orderNo = String(req.body?.orderNo || '').trim();
      const reason = String(req.body?.reason || '').trim();
      if (!orderNo || !reason) {
        return res.status(400).json({ error: 'INVALID_REQUEST', message: 'orderNo, reason은 필수입니다.' });
      }
      const db = await getDb();
      const toss = createTossClient();
      // force=true: 하자·오류 예외 환불(정책 3항) — 관리자가 명시적으로 승인한 경우에만.
      const outcome = await refundOrder(db, toss, orderNo, reason, { allowGenerated: req.body?.force === true });
      if (!outcome.found) {
        return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: '해당 주문을 찾을 수 없습니다.' });
      }
      if (outcome.alreadyRefunded) {
        return res.status(200).json({ ok: true, alreadyRefunded: true });
      }
      return res.status(200).json({ ok: true, refunded: true, amount: outcome.amount });
    } catch (error) {
      return handlePaymentError(res, 'refund', error);
    }
  });

  app.post("/api/taekil/recommend", expressRateLimit(taekilLimiter), (req, res) => {
    try {
      const body = req.body as Partial<TaekilRequest>;
      const required = [
        "name",
        "gender",
        "birthDate",
        "birthTime",
        "isLunar",
        "category",
        "periodStart",
        "periodEnd"
      ] as const;

      const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
      if (missing.length > 0) {
        return res.status(400).json({
          error: "MISSING_FIELDS",
          message: `필수 입력값이 누락되었습니다: ${missing.join(", ")}`
        });
      }

      // 결혼 카테고리 시 배우자 정보 검증
      if (body.category === '결혼') {
        const spouseRequired = [
          "spouseName",
          "spouseGender",
          "spouseBirthDate",
          "spouseBirthTime",
          "spouseIsLunar"
        ] as const;
        const spouseMissing = spouseRequired.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
        if (spouseMissing.length > 0) {
          return res.status(400).json({
            error: "MISSING_SPOUSE_INFO",
            message: `결혼 택일을 위해 배우자 정보가 필요합니다: ${spouseMissing.join(", ")}`
          });
        }
      }

      if (body.category === '이사') {
        const movingRequired = [
          'moveCurrentAddress',
          'moveTargetAddress'
        ] as const;
        const movingMissing = movingRequired.filter((k) => body[k] === undefined || body[k] === null || body[k] === '');
        if (movingMissing.length > 0) {
          return res.status(400).json({
            error: 'MISSING_MOVING_INFO',
            message: `이사 택일을 위해 필수 정보가 필요합니다: ${movingMissing.join(', ')} (주소는 동 단위 입력 가능)`
          });
        }
      }

      const payload: TaekilRequest = {
        name: String(body.name),
        gender: body.gender as "M" | "F",
        birthDate: String(body.birthDate),
        birthTime: String(body.birthTime),
        isLunar: Boolean(body.isLunar),
        isLeap: Boolean(body.isLeap),
        unknownTime: Boolean(body.unknownTime),
        category: body.category as TaekilRequest["category"],
        periodStart: String(body.periodStart),
        periodEnd: String(body.periodEnd),
        // 결혼 카테고리용 배우자 정보
        spouseName: body.spouseName ? String(body.spouseName) : undefined,
        spouseGender: body.spouseGender ? (body.spouseGender as "M" | "F") : undefined,
        spouseBirthDate: body.spouseBirthDate ? String(body.spouseBirthDate) : undefined,
        spouseBirthTime: body.spouseBirthTime ? String(body.spouseBirthTime) : undefined,
        spouseIsLunar: body.spouseIsLunar !== undefined ? Boolean(body.spouseIsLunar) : undefined,
        spouseIsLeap: body.spouseIsLeap ? Boolean(body.spouseIsLeap) : undefined,
        spouseUnknownTime: body.spouseUnknownTime ? Boolean(body.spouseUnknownTime) : undefined,
        preferredWeekdays: Array.isArray(body.preferredWeekdays) ? body.preferredWeekdays.map((v) => Number(v)) : undefined,
        avoidDates: Array.isArray(body.avoidDates) ? body.avoidDates.map((v) => String(v)) : undefined,
        moveCurrentAddress: body.moveCurrentAddress ? String(body.moveCurrentAddress) : undefined,
        moveTargetAddress: body.moveTargetAddress ? String(body.moveTargetAddress) : undefined,
        moveFamilyBirthDates: Array.isArray(body.moveFamilyBirthDates) ? body.moveFamilyBirthDates.map((v) => String(v)) : undefined,
        movePriority: body.movePriority ? (body.movePriority as 'folklore' | 'saju' | 'balanced') : undefined,
        moveOnlyWeekend: body.moveOnlyWeekend !== undefined ? Boolean(body.moveOnlyWeekend) : undefined,
        categoryInputs: body.categoryInputs && typeof body.categoryInputs === 'object' ? (body.categoryInputs as Record<string, string>) : undefined,
        additionalInfo: body.additionalInfo ? String(body.additionalInfo) : undefined
      };

      const results = runTaekilEngine(payload);
      return res.json({
        meta: {
          timezone: "Asia/Seoul",
          category: payload.category,
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          total: results.length
        },
        results
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "TAEKIL_ENGINE_ERROR",
        message: error?.message || "택일 추천 처리 중 오류가 발생했습니다."
      });
    }
  });

  // Premium Order Creation API - uses Firebase Admin SDK (bypasses security rules)
  app.post("/api/premium-order/create", expressRateLimit(orderCreateLimiter), async (req, res) => {
    try {
      if (!adminDb) {
        console.error('Firebase Admin SDK not initialized. Place service-account.json in project root.');
        return res.status(500).json({
          error: "ADMIN_SDK_UNAVAILABLE",
          message: "서버 설정 오류: service-account.json 파일이 없습니다. 관리자에게 문의하세요."
        });
      }

      const order = req.body;
      console.log('Creating premium order via Admin SDK:', { name: order.name, email: order.email });

      // Validate required fields (use != null to allow false and 0)
      const required = ['name', 'email', 'birthDate', 'birthTime', 'gender', 'isLunar', 'tier', 'price'];
      const missing = required.filter((k) => order[k] == null || order[k] === '');
      if (missing.length > 0) {
        console.warn('Missing required fields:', missing);
        return res.status(400).json({
          error: "MISSING_REQUIRED_FIELDS",
          message: `Required fields missing: ${missing.join(", ")}`
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

      // Write directly to Firestore via Admin SDK (bypasses all security rules)
      const docRef = await adminDb.collection('premiumOrders').add({
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

      console.log('Premium order created successfully:', docRef.id);
      return res.json({
        success: true,
        orderId: docRef.id,
        message: "Premium order created successfully"
      });

    } catch (error: any) {
      console.error('Premium order creation error:', error);
      return res.status(500).json({
        error: "SERVER_ERROR",
        message: error?.message || "Failed to create premium order"
      });
    }
  });

  // Premium Order List API - reads from Firestore via Admin SDK
  app.get("/api/premium-orders", expressRateLimit(generalLimiter), async (req, res) => {
    try {
      if (!adminDb) {
        return res.status(500).json({
          error: "ADMIN_SDK_UNAVAILABLE",
          message: "Server not initialized"
        });
      }

      const status = req.query.status as string | undefined;
      const productType = req.query.productType as string | undefined;
      let collectionRef = adminDb.collection('premiumOrders');

      let snapshot;
      if (status && status !== 'all') {
        snapshot = await collectionRef
          .where('status', '==', status)
          .orderBy('createdAt', 'desc')
          .get();
      } else {
        snapshot = await collectionRef
          .orderBy('createdAt', 'desc')
          .get();
      }

      let orders = snapshot.docs.map(doc => ({
        orderId: doc.id,
        ...doc.data()
      }));

      if (productType && productType !== 'all') {
        orders = orders.filter((o: any) => (o.productType || 'premium') === productType);
      }

      console.log(`Retrieved ${orders.length} premium orders (status=${status}, productType=${productType})`);
      return res.json({
        success: true,
        orders: serializeTimestamps(orders)
      });

    } catch (error: any) {
      console.error('Failed to retrieve premium orders:', error);
      return res.status(500).json({
        error: "SERVER_ERROR",
        message: error?.message || "Failed to retrieve orders"
      });
    }
  });

  // Premium Order Update API - writes via Admin SDK
  app.post('/api/premium-order/update', async (req, res) => {
    try {
      if (!adminDb) {
        return res.status(500).json({
          error: 'ADMIN_SDK_UNAVAILABLE',
          message: 'Server not initialized',
        });
      }

      const orderId = String(req.body?.orderId || '');
      const updates = (req.body?.updates || {}) as Record<string, any>;
      if (!orderId) {
        return res.status(400).json({ error: 'ORDER_ID_REQUIRED', message: 'orderId is required' });
      }
      if (!updates || typeof updates !== 'object' || Array.isArray(updates) || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'UPDATES_REQUIRED', message: 'updates is required' });
      }

      const docRef = adminDb.collection('premiumOrders').doc(orderId);
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
    } catch (error: any) {
      console.error('Failed to update premium order:', error);
      return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Failed to update order' });
    }
  });

  // Premium Order Reject API - writes via Admin SDK
  app.post('/api/premium-order/reject', async (req, res) => {
    try {
      if (!adminDb) {
        return res.status(500).json({
          error: 'ADMIN_SDK_UNAVAILABLE',
          message: 'Server not initialized',
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

      const docRef = adminDb.collection('premiumOrders').doc(orderId);
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
      console.error('Failed to reject premium order:', error);
      return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Failed to reject order' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, "utf-8");
        res.send(html);
      } else {
        res.status(404).send("Not Found");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
