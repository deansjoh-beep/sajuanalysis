import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkVercelRateLimit, codeLookupLimiter, purgeLimiter } from './_lib/rate-limit.js';
import { getDb, isDbConfigured } from '../db/client.js';
import { CODE_PATTERN, normalizeCode, purgeByCode, purgeExpiredReports } from '../db/purge.js';
import { consumeFollowup, lookupCode, redeemGiftCode, saveReport } from '../db/code.js';
import { sampleReportsForReview, saveReview } from '../db/admin.js';
import { PersonalDataError, type MyeongsikParams } from '../db/schema.js';

/**
 * 사주 코드 통합 엔드포인트 (Hobby 함수 12개 한도 — 코드 생애주기 전체를 한 함수로).
 *
 * - GET    /api/code?code=HW-3F9K2A     → 조회/재열람: 명식·주문·유효 리포트 로드.
 *   만료 리포트는 본문 미반환 + 무과금 재생성 대상(regenerable) 표시.
 * - GET    /api/code (Bearer CRON_SECRET) → 만료 리포트 청소 크론 (vercel.json crons).
 * - POST   /api/code/redeem              → 선물 코드 리딤 (code + myeongsik).
 * - POST   /api/code/followup            → 후속 질문 1회 차감 (code + orderId, 주문당 3회).
 * - POST   /api/code/save-report         → 생성 완료 리포트 저장 + 주문 generated 전이 (code + orderId + content).
 * - GET    /api/code?adminSample=1       → [관리자] 오늘 생성분 미검수 무작위 10건 (x-admin-token).
 * - POST   /api/code/review              → [관리자] 검수 판정 저장 (reportId + verdict + tags + note).
 * - DELETE /api/code?code=               → 즉시 파기 (구 /api/purge — rewrite로 경로 보존, 복구 불가).
 *   · Hobby 크론은 1일 1회 정밀도 → 읽기 경로에서도 expires_at 검사 필수(72h 논리 보장).
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 관리자 토큰 검사 — ADMIN_ACCESS_TOKEN 미설정 시 관리자 기능 전체 비활성 */
export function isAdminRequest(headers: Record<string, string | string[] | undefined>): boolean {
  const token = (process.env.ADMIN_ACCESS_TOKEN || '').trim();
  return Boolean(token) && String(headers['x-admin-token'] || '') === token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured()) {
    return res.status(503).json({
      error: 'DB_NOT_CONFIGURED',
      message: '데이터베이스가 아직 구성되지 않았습니다 (DATABASE_URL 미설정).',
    });
  }

  const action = String(req.query?.action || '');

  try {
    if (req.method === 'GET') {
      const raw = String(req.query.code || '').trim();

      // [관리자] 오늘 생성분 검수 샘플
      if (String(req.query.adminSample || '') === '1') {
        if (!isAdminRequest(req.headers)) {
          return res.status(401).json({ error: 'UNAUTHORIZED', message: '관리자 토큰이 필요합니다.' });
        }
        const db = await getDb();
        const samples = await sampleReportsForReview(db, 10);
        return res.status(200).json({ ok: true, samples });
      }

      // 코드 파라미터 없는 GET = 만료 청소 크론
      if (!raw) {
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

      // 조회/재열람
      if (!checkVercelRateLimit(req, res, codeLookupLimiter)) return;
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
    }

    if (req.method === 'POST') {
      const body = (req.body || {}) as Record<string, unknown>;

      // [관리자] 검수 판정 저장 — 코드 불필요, 토큰 인증
      if (action === 'review') {
        if (!isAdminRequest(req.headers)) {
          return res.status(401).json({ error: 'UNAUTHORIZED', message: '관리자 토큰이 필요합니다.' });
        }
        const reportId = String(body.reportId || '').trim();
        const verdict = String(body.verdict || '');
        if (!UUID_PATTERN.test(reportId) || (verdict !== 'approved' && verdict !== 'rejected')) {
          return res.status(400).json({ error: 'INVALID_REQUEST', message: 'reportId와 verdict(approved|rejected)가 필요합니다.' });
        }
        const tags = Array.isArray(body.tags) ? body.tags.map(String).slice(0, 10) : [];
        const note = String(body.note || '').slice(0, 2000);
        const db = await getDb();
        const outcome = await saveReview(db, { reportId, verdict, tags, note });
        if (!outcome.ok) {
          return res.status(404).json({ error: 'REPORT_NOT_FOUND', message: '해당 리포트를 찾을 수 없습니다 (만료·파기됐을 수 있습니다).' });
        }
        return res.status(200).json({ ok: true });
      }

      if (!checkVercelRateLimit(req, res, codeLookupLimiter)) return;
      const code = normalizeCode(String(body.code || ''));
      if (!CODE_PATTERN.test(code)) {
        return res.status(400).json({ error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' });
      }
      const db = await getDb();

      if (action === 'redeem') {
        const myeongsik = body.myeongsik as MyeongsikParams | undefined;
        if (!myeongsik || typeof myeongsik !== 'object') {
          return res.status(400).json({ error: 'MYEONGSIK_REQUIRED', message: '선물 코드 등록에는 myeongsik(명식 파라미터)이 필요합니다.' });
        }
        const outcome = await redeemGiftCode(db, code, myeongsik);
        if (outcome === 'not_found') {
          return res.status(404).json({ error: 'CODE_NOT_FOUND', message: '해당 코드를 찾을 수 없습니다.' });
        }
        if (outcome === 'already_redeemed') {
          return res.status(409).json({ error: 'ALREADY_REDEEMED', message: '이미 등록된 코드입니다.' });
        }
        return res.status(200).json({ ok: true, redeemed: true });
      }

      if (action === 'followup') {
        const orderId = String(body.orderId || '').trim();
        if (!UUID_PATTERN.test(orderId)) {
          return res.status(400).json({ error: 'ORDER_ID_INVALID', message: 'orderId가 올바르지 않습니다.' });
        }
        const outcome = await consumeFollowup(db, code, orderId);
        if (!outcome.ok && outcome.reason === 'order_not_found') {
          return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: '해당 코드의 주문을 찾을 수 없습니다.' });
        }
        if (!outcome.ok) {
          return res.status(429).json({ error: 'FOLLOWUP_EXHAUSTED', message: '후속 질문 횟수를 모두 사용했습니다 (구매당 3회).', remaining: 0 });
        }
        return res.status(200).json({ ok: true, remaining: outcome.remaining });
      }

      if (action === 'save-report') {
        const orderId = String(body.orderId || '').trim();
        const content = typeof body.content === 'string' ? body.content : '';
        if (!UUID_PATTERN.test(orderId)) {
          return res.status(400).json({ error: 'ORDER_ID_INVALID', message: 'orderId가 올바르지 않습니다.' });
        }
        if (content.trim().length < 100 || content.length > 300_000) {
          return res.status(400).json({ error: 'CONTENT_INVALID', message: '리포트 본문이 비어 있거나 허용 크기를 벗어났습니다.' });
        }
        const asOptionalInt = (v: unknown): number | null =>
          v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null;
        const costKrw = asOptionalInt(body.generationCostKrw);
        const qualityScore = asOptionalInt(body.qualityScore);
        const outcome = await saveReport(db, code, orderId, content, {
          generationCostKrw: costKrw,
          qualityScore,
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
      }

      return res.status(400).json({ error: 'UNKNOWN_ACTION', message: `Unknown action: ${action || '(empty)'}` });
    }

    if (req.method === 'DELETE') {
      if (!checkVercelRateLimit(req, res, purgeLimiter)) return;
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
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error: unknown) {
    if (error instanceof PersonalDataError) {
      return res.status(400).json({ error: 'FORBIDDEN_PERSONAL_DATA', message: error.message });
    }
    const message = error instanceof Error ? error.message : 'request failed';
    console.error(`[api/code:${req.method}:${action}] error:`, error);
    return res.status(500).json({ error: 'CODE_API_FAILED', message });
  }
}
