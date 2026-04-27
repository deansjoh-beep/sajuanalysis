import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
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
} from "./api/lib/rate-limit.ts";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getStorage as getAdminStorage, Storage } from 'firebase-admin/storage';
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
  const PORT = 3000;

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

  app.get("/api/runtime-config", (req, res) => {
    const geminiApiKey = String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
    res.json({ geminiApiKey });
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
        orders
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
        let html = fs.readFileSync(indexPath, "utf-8");
        // Inject API Key into the HTML so the frontend can access it even if build-time injection failed
        const apiKeyScript = `<script>window.GEMINI_API_KEY = "${process.env.GEMINI_API_KEY || ''}";</script>`;
        html = html.replace("<head>", `<head>${apiKeyScript}`);
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
