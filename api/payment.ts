import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkVercelRateLimit, paymentLimiter } from './_lib/rate-limit.js';
import { createTossClient, isTossConfigured, TossApiError } from './_lib/toss.js';
import { getDb, isDbConfigured } from '../db/client.js';
import {
  confirmPaymentAndPersist,
  isPaidProduct,
  issueFreeOrder,
  PaymentValidationError,
  refundOrder,
  RefundNotAllowedError,
} from '../db/payment.js';
import { isOpenProduct } from '../db/productAccess.js';
import { assertNoPersonalKeys, PersonalDataError, type MyeongsikParams } from '../db/schema.js';
import { getAdminStats } from '../db/admin.js';
import { getFeedbackStats } from '../db/feedback.js';
import { isAdminRequest } from './code.js';

/**
 * 결제 통합 엔드포인트 (함수 12개 한도 대응 — vercel.json rewrite가
 * /api/payment/:action → /api/payment?action=:action 으로 매핑).
 *
 * - POST /api/payment/confirm — 결제창 성공 후 서버 최종 승인.
 *   금액은 서버 가격표로 검증, 승인 후 영속 실패 시 자동 취소.
 *   gift=true면 명식 없는 미사용 선물 코드를 발급한다.
 * - POST /api/payment/refund — 환불. x-admin-token 필요.
 *   생성 전 100% / 생성 후는 환불 불가 정책으로 차단(403, OWNER 확정 2026-07-17).
 *   하자·오류 예외(정책 3항)는 body.force=true로만 승인.
 * - GET  /api/payment/stats — [관리자] 일별 매출·생성 성공률·검증 실패율·평균 원가·환불 (x-admin-token).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query?.action || '');

  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'DB_NOT_CONFIGURED', message: '데이터베이스가 아직 구성되지 않았습니다.' });
  }

  // [관리자] 매출·원가 대시보드 — 토스 키 없이도 동작해야 하므로 토스 검사보다 먼저
  if (req.method === 'GET' && action === 'stats') {
    try {
      if (!isAdminRequest(req.headers)) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: '관리자 토큰이 필요합니다.' });
      }
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
      const db = await getDb();
      const [stats, feedbackStats] = await Promise.all([getAdminStats(db, days), getFeedbackStats(db)]);
      return res.status(200).json({ ok: true, stats, feedbackStats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'stats failed';
      console.error('[api/payment:stats] error:', error);
      return res.status(500).json({ error: 'STATS_FAILED', message });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  if (!checkVercelRateLimit(req, res, paymentLimiter)) return;

  // 무료 개방 발급 — 토스 없이 코드+주문(₩0) 기록. 토스 미설정 환경에서도 동작해야 하므로
  // isTossConfigured() 가드보다 먼저 처리한다(승인 전 주간 단계적 무료 오픈 워크플로).
  if (action === 'free') {
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
    try {
      assertNoPersonalKeys(myeongsik as unknown as Record<string, unknown>);
      const db = await getDb();
      const result = await issueFreeOrder(db, product, myeongsik);
      return res.status(200).json({ ok: true, code: result.code, orderId: result.orderId });
    } catch (error: unknown) {
      if (error instanceof PersonalDataError) {
        return res.status(400).json({ error: 'FORBIDDEN_PERSONAL_DATA', message: error.message });
      }
      const message = error instanceof Error ? error.message : 'free issue failed';
      console.error('[api/payment:free] error:', error);
      return res.status(500).json({ error: 'FREE_ISSUE_FAILED', message });
    }
  }

  if (!isTossConfigured()) {
    return res.status(503).json({
      error: 'PAYMENT_NOT_CONFIGURED',
      message: '결제 모듈이 아직 활성화되지 않았습니다 (TOSS_SECRET_KEY 미설정 — 테스트 키로 선행 개발 가능).',
    });
  }
  try {
    const db = await getDb();
    const toss = createTossClient();

    if (action === 'confirm') {
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

      const result = await confirmPaymentAndPersist(db, toss, {
        orderNo,
        paymentKey,
        amount,
        product,
        myeongsik: myeongsik ?? null,
      });
      // 리포트 생성 큐 진입은 후속(2-4 산출물 파이프라인)에서 이 지점에 연결한다.
      return res.status(200).json({
        ok: true,
        alreadyProcessed: result.alreadyProcessed,
        code: result.code,
        orderId: result.orderId,
      });
    }

    if (action === 'refund') {
      const adminToken = (process.env.ADMIN_ACCESS_TOKEN || '').trim();
      const provided = String(req.headers['x-admin-token'] || '');
      if (!adminToken || provided !== adminToken) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: '환불은 관리자 토큰이 필요합니다.' });
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const orderNo = String(body.orderNo || '').trim();
      const reason = String(body.reason || '').trim();
      if (!orderNo || !reason) {
        return res.status(400).json({ error: 'INVALID_REQUEST', message: 'orderNo, reason은 필수입니다.' });
      }

      // force=true: 하자·오류 예외 환불(정책 3항) — 관리자가 명시적으로 승인한 경우에만.
      const outcome = await refundOrder(db, toss, orderNo, reason, { allowGenerated: body.force === true });
      if (!outcome.found) {
        return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: '해당 주문을 찾을 수 없습니다.' });
      }
      if (outcome.alreadyRefunded) {
        return res.status(200).json({ ok: true, alreadyRefunded: true });
      }
      return res.status(200).json({ ok: true, refunded: true, amount: outcome.amount });
    }

    return res.status(400).json({ error: 'UNKNOWN_ACTION', message: `Unknown action: ${action || '(empty)'}` });
  } catch (error: unknown) {
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
      console.error(`[api/payment:${action}] toss error ${error.code}:`, error.message);
      return res.status(402).json({ error: error.code, message: error.message });
    }
    const message = error instanceof Error ? error.message : 'payment failed';
    console.error(`[api/payment:${action}] error:`, error);
    return res.status(500).json({ error: 'PAYMENT_FAILED', message });
  }
}
