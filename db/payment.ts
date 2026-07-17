/**
 * 결제 영속 로직 (2-2) — server.ts(Express)와 api/payment.ts(Vercel)가 공유.
 *
 * 흐름: 클라이언트 결제창 성공 → confirm 요청 → [금액 검증] → [중복 승인 방어(멱등)]
 *   → 토스 승인 API → [코드 발급 + 주문 기록] → 실패 시 자동 취소 + 로그.
 *
 * 환불: 리포트 생성 전(status=paid) 100% 환불. 생성 후(status=generated)는
 * ⛔ OWNER 환불 정책 문구 확정 대기 — 확정 전까지 차단한다.
 */
import { eq } from 'drizzle-orm';
import type { TossClient } from '../api/_lib/toss.js';
import type { Db } from './client.js';
import { issueCode, type IssueCodeOptions } from './code.js';
import { codes, orders, type MyeongsikParams } from './schema.js';

/**
 * OWNER 확정 가격 (2026-07-09). 서버가 항상 이 표 기준으로 결제 금액을 검증한다
 * (클라이언트 금액 신뢰 금지). ⚠️ 프론트 CheckoutTab.tsx PRODUCT_CATALOG와 동기화 유지.
 */
export const PRODUCT_PRICES = {
  premium: 9900,
  yearly2026: 4900,
  jobCareer: 4900,
  loveMarriage: 4900,
} as const;

export type PaidProduct = keyof typeof PRODUCT_PRICES;

export function isPaidProduct(value: string): value is PaidProduct {
  return value in PRODUCT_PRICES;
}

export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

/**
 * 생성 후 환불 차단 오류 — OWNER 확정 정책(2026-07-17): 맞춤형 디지털 콘텐츠는
 * 생성(제공) 완료 후 청약철회 불가(전자상거래법 17조 2항, 구매 화면 사전 고지).
 * 예외: 하자·오류(취소·환불 정책 3항)는 관리자가 force 플래그로 명시 승인 시에만 환불.
 */
export class RefundNotAllowedError extends Error {
  constructor() {
    super('리포트가 이미 생성된 주문은 환불할 수 없습니다(생성 후 환불 불가 정책, 구매 시 사전 고지). 하자·오류로 인한 예외 환불은 force 승인으로만 가능합니다.');
    this.name = 'RefundNotAllowedError';
  }
}

export interface ConfirmPaymentInput {
  /** 토스 orderId — 우리 orders.order_no로 그대로 저장 */
  orderNo: string;
  paymentKey: string;
  amount: number;
  product: PaidProduct;
  /** null이면 선물 코드 상품 — 미사용 코드를 발급하고 수령자가 나중에 명식을 채운다 */
  myeongsik: MyeongsikParams | null;
}

export interface ConfirmPaymentResult {
  alreadyProcessed: boolean;
  code: string;
  orderId: string;
}

/**
 * 결제 승인 + 영속. 순서가 중요하다:
 * 1) 금액 검증 실패 → 토스 호출 없이 거부 (아무것도 승인되지 않음)
 * 2) order_no 중복 → 이미 처리된 결제 (멱등 응답, 토스 재호출 없음 = 중복 승인 방어)
 * 3) 토스 승인 실패 → 그대로 전파 (DB에 아무것도 없음)
 * 4) 승인 후 영속 실패 → 토스 자동 취소 + 로그 후 전파 (돈만 나가는 상태 방지)
 */
export async function confirmPaymentAndPersist(
  db: Db,
  toss: TossClient,
  input: ConfirmPaymentInput,
  codeOptions: IssueCodeOptions = {},
): Promise<ConfirmPaymentResult> {
  const { orderNo, paymentKey, amount, product, myeongsik } = input;

  const expected = PRODUCT_PRICES[product];
  if (amount !== expected) {
    throw new PaymentValidationError(
      `결제 금액이 상품 가격과 다릅니다 (요청 ${amount}원 / 정가 ${expected}원).`,
    );
  }

  const [existing] = await db
    .select({ orderId: orders.id, code: codes.code })
    .from(orders)
    .innerJoin(codes, eq(orders.codeId, codes.id))
    .where(eq(orders.orderNo, orderNo));
  if (existing) {
    return { alreadyProcessed: true, code: existing.code, orderId: existing.orderId };
  }

  await toss.confirmPayment({ paymentKey, orderId: orderNo, amount });

  try {
    const issued = await issueCode(db, myeongsik, codeOptions);
    const [orderRow] = await db
      .insert(orders)
      .values({ orderNo, paymentKey, codeId: issued.id, product, status: 'paid', amount })
      .returning();
    return { alreadyProcessed: false, code: issued.code, orderId: orderRow.id };
  } catch (error) {
    // 승인은 됐는데 기록에 실패 — 돈만 나간 상태를 만들지 않도록 자동 취소
    console.error(`[payment] 승인 후 영속 실패 — 자동 취소 시도 (orderNo=${orderNo}):`, error);
    try {
      await toss.cancelPayment(paymentKey, '시스템 오류로 인한 자동 취소');
      console.error(`[payment] 자동 취소 완료 (orderNo=${orderNo})`);
    } catch (cancelError) {
      // 자동 취소까지 실패 — 수동 정산 필요, 반드시 로그로 남긴다
      console.error(`[payment] ⚠️ 자동 취소 실패 — 수동 정산 필요 (orderNo=${orderNo}, paymentKey=${paymentKey}):`, cancelError);
    }
    throw error;
  }
}

export interface RefundOutcome {
  found: boolean;
  alreadyRefunded: boolean;
  /** 환불된 금액 (환불이 실제 실행된 경우에만) */
  amount: number | null;
}

/**
 * 환불 처리. 생성 전(paid) → 토스 전액 취소 + status=refunded.
 * 생성 후(generated) → RefundNotAllowedError (생성 후 환불 불가 정책).
 * 단, allowGenerated=true(관리자가 하자·오류를 인정한 예외 승인)면 생성 후에도 전액 환불.
 */
export async function refundOrder(
  db: Db,
  toss: TossClient,
  orderNo: string,
  reason: string,
  options: { allowGenerated?: boolean } = {},
): Promise<RefundOutcome> {
  const [order] = await db.select().from(orders).where(eq(orders.orderNo, orderNo));
  if (!order) return { found: false, alreadyRefunded: false, amount: null };
  if (order.status === 'refunded') return { found: true, alreadyRefunded: true, amount: null };
  if (order.status === 'generated' && options.allowGenerated !== true) throw new RefundNotAllowedError();

  await toss.cancelPayment(order.paymentKey, reason);
  await db.update(orders).set({ status: 'refunded' }).where(eq(orders.id, order.id));
  return { found: true, alreadyRefunded: false, amount: order.amount };
}
