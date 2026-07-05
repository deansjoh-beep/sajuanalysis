import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkVercelRateLimit, paymentLimiter } from './_lib/rate-limit.js';
import { createTossClient, isTossConfigured, TossApiError } from './_lib/toss.js';
import { getDb, isDbConfigured } from '../db/client.js';
import {
  confirmPaymentAndPersist,
  isPaidProduct,
  PaymentValidationError,
  refundOrder,
  RefundPolicyPendingError,
} from '../db/payment.js';
import { assertNoPersonalKeys, PersonalDataError, type MyeongsikParams } from '../db/schema.js';

/**
 * 결제 통합 엔드포인트 (함수 12개 한도 대응 — vercel.json rewrite가
 * /api/payment/:action → /api/payment?action=:action 으로 매핑).
 *
 * - POST /api/payment/confirm — 결제창 성공 후 서버 최종 승인.
 *   금액은 서버 가격표로 검증, 승인 후 영속 실패 시 자동 취소.
 *   gift=true면 명식 없는 미사용 선물 코드를 발급한다.
 * - POST /api/payment/refund — 환불. x-admin-token 필요.
 *   생성 전 100% / 생성 후는 ⛔ 정책 확정 대기로 차단(501).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  if (!checkVercelRateLimit(req, res, paymentLimiter)) return;

  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'DB_NOT_CONFIGURED', message: '데이터베이스가 아직 구성되지 않았습니다.' });
  }
  if (!isTossConfigured()) {
    return res.status(503).json({
      error: 'PAYMENT_NOT_CONFIGURED',
      message: '결제 모듈이 아직 활성화되지 않았습니다 (TOSS_SECRET_KEY 미설정 — 테스트 키로 선행 개발 가능).',
    });
  }

  const action = String(req.query?.action || '');
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

      const outcome = await refundOrder(db, toss, orderNo, reason);
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
    if (error instanceof RefundPolicyPendingError) {
      return res.status(501).json({ error: 'REFUND_POLICY_PENDING', message: error.message });
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
