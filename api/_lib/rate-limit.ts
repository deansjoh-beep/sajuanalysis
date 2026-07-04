/**
 * 슬라이딩 윈도우 방식의 IP 기반 Rate Limiter
 *
 * Express(server.ts)와 Vercel Serverless 함수 양쪽에서 사용합니다.
 * 모듈 레벨 Map을 사용하므로 동일 프로세스/웜 인스턴스 내에서 상태가 유지됩니다.
 *
 * ※ 운영 트래픽이 많아지면 Upstash Redis + @upstash/ratelimit 으로 교체를 권장합니다.
 *    (분산 환경에서 서버리스 인스턴스 간 카운터를 공유하려면 외부 스토어가 필요합니다)
 */

interface WindowRecord {
  count: number;
  resetAt: number; // epoch ms
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetEpochSec: number;
  retryAfterSec?: number;
  /** 응답 헤더로 그대로 쓸 수 있는 객체 */
  headers: Record<string, string>;
}

// 모듈 레벨 스토어 (프로세스/웜 인스턴스 공유)
const store = new Map<string, WindowRecord>();

/** 만료된 항목 주기적 정리 (1% 확률 — 오버헤드 최소화) */
function maybeCleanup(): void {
  if (Math.random() > 0.01) return;
  const now = Date.now();
  for (const [key, rec] of store) {
    if (rec.resetAt <= now) store.delete(key);
  }
}

export interface RateLimiterConfig {
  /** 윈도우 크기 (밀리초) */
  windowMs: number;
  /** 윈도우 내 최대 허용 요청 수 */
  max: number;
}

/**
 * rate limiter 함수를 반환합니다.
 *
 * @example
 * const pdfLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
 * const result = pdfLimiter('203.0.113.1');
 * if (!result.allowed) return res.status(429).json({ error: '...' });
 */
export function createRateLimiter(config: RateLimiterConfig) {
  const { windowMs, max } = config;
  const windowSec = Math.ceil(windowMs / 1000);

  return function check(ip: string): RateLimitResult {
    maybeCleanup();

    const now = Date.now();
    const storeKey = ip;
    const rec = store.get(storeKey);

    if (!rec || rec.resetAt <= now) {
      // 새 윈도우 시작
      store.set(storeKey, { count: 1, resetAt: now + windowMs });
      const resetEpochSec = Math.ceil((now + windowMs) / 1000);
      return {
        allowed: true,
        limit: max,
        remaining: max - 1,
        resetEpochSec,
        headers: {
          'RateLimit-Limit': String(max),
          'RateLimit-Remaining': String(max - 1),
          'RateLimit-Reset': String(resetEpochSec),
          'RateLimit-Policy': `${max};w=${windowSec}`,
        },
      };
    }

    rec.count += 1;
    const remaining = Math.max(0, max - rec.count);
    const resetEpochSec = Math.ceil(rec.resetAt / 1000);
    const allowed = rec.count <= max;
    const retryAfterSec = allowed ? undefined : Math.ceil((rec.resetAt - now) / 1000);

    return {
      allowed,
      limit: max,
      remaining,
      resetEpochSec,
      retryAfterSec,
      headers: {
        'RateLimit-Limit': String(max),
        'RateLimit-Remaining': String(remaining),
        'RateLimit-Reset': String(resetEpochSec),
        'RateLimit-Policy': `${max};w=${windowSec}`,
        ...(retryAfterSec !== undefined ? { 'Retry-After': String(retryAfterSec) } : {}),
      },
    };
  };
}

// ─── 엔드포인트별 limiter 인스턴스 ──────────────────────────────────────────

/** PDF 생성 — Chromium 기동으로 리소스 집약적. 분당 5회 */
export const pdfLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/** 이메일 발송 — Resend API 쿼터 보호. 분당 10회 */
export const emailLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** 파일 업로드 — Firebase Storage 대역폭 보호. 분당 10회 */
export const uploadLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** 프리미엄 주문 생성 — Firebase 쓰기 보호. 분당 10회 */
export const orderCreateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** 택일 추천 — CPU 집약적 계산. 분당 15회 */
export const taekilLimiter = createRateLimiter({ windowMs: 60_000, max: 15 });

/** 일반 조회 API — 분당 30회 */
export const generalLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

// ─── Express 미들웨어 헬퍼 ──────────────────────────────────────────────────

type ExpressReq = { ip?: string; socket?: { remoteAddress?: string }; headers: Record<string, string | string[] | undefined> };
type ExpressRes = { status: (code: number) => ExpressRes; json: (body: unknown) => void; setHeader: (key: string, value: string) => void };
type NextFn = () => void;

/**
 * Express 라우트 미들웨어로 변환합니다.
 *
 * @example
 * app.post('/api/generate-pdf', expressRateLimit(pdfLimiter), handler);
 */
export function expressRateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  skipFn?: (req: ExpressReq) => boolean,
) {
  return (req: ExpressReq, res: ExpressRes, next: NextFn): void => {
    if (skipFn?.(req)) { next(); return; }

    const ip = getExpressIp(req);
    const result = limiter(ip);

    applyHeaders(res, result.headers);

    if (!result.allowed) {
      res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        retryAfter: result.retryAfterSec,
      });
      return;
    }
    next();
  };
}

// ─── Vercel 서버리스 헬퍼 ──────────────────────────────────────────────────

type VercelReq = { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } };
type VercelRes = { status: (code: number) => VercelRes; json: (body: unknown) => void; setHeader: (key: string, value: string) => void };

/**
 * Vercel 서버리스 함수에서 rate limit을 검사합니다.
 * false를 반환하면 이미 429 응답이 전송된 것이므로 핸들러를 즉시 종료하세요.
 *
 * @example
 * if (!checkVercelRateLimit(req, res, pdfLimiter)) return;
 */
export function checkVercelRateLimit(
  req: VercelReq,
  res: VercelRes,
  limiter: ReturnType<typeof createRateLimiter>,
): boolean {
  const ip = getVercelIp(req);
  const result = limiter(ip);

  applyHeaders(res, result.headers);

  if (!result.allowed) {
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      retryAfter: result.retryAfterSec,
    });
    return false;
  }
  return true;
}

// ─── 내부 유틸 ──────────────────────────────────────────────────────────────

function getExpressIp(req: ExpressReq): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return first.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getVercelIp(req: VercelReq): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return first.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function applyHeaders(res: { setHeader: (k: string, v: string) => void }, headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}
