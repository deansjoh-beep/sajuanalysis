/**
 * Phase 2-2 결제 테스트 — 인메모리 PGlite + 가짜 토스 클라이언트.
 *
 * 검증 대상 (IMPLEMENTATION_PLAN 2-2):
 * - 서버 가격표 기준 금액 검증 (클라이언트 금액 신뢰 금지)
 * - 중복 승인 방어 (order_no 멱등)
 * - 승인 후 영속 실패 시 자동 취소
 * - 환불: 생성 전 100% / 생성 후 정책 확정 대기 차단
 * - 선물 코드: 명식 없는 미사용 코드 발급
 * - 코드 발급기: 형식·혼동 문자 제외·충돌 재시도
 */
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TossClient, TossPaymentResult } from '../api/_lib/toss.ts';
import { CODE_CHARSET, generateSajuCode, issueCode } from './code.ts';
import {
  confirmPaymentAndPersist,
  PaymentValidationError,
  PRODUCT_PRICES,
  refundOrder,
  RefundPolicyPendingError,
} from './payment.ts';
import * as schema from './schema.ts';
import { codes, orders, type MyeongsikParams } from './schema.ts';

const myeongsik: MyeongsikParams = {
  pillars: { year: '갑진', month: '병인', day: '정미', hour: '경자' },
  gender: 'male',
  daeunsu: 3,
  daeunDirection: 'forward',
  birthYear: 1990,
  timeUnknown: false,
};

/** 호출 기록을 남기는 가짜 토스 클라이언트 */
function makeFakeToss(behavior: { failConfirm?: boolean; failCancel?: boolean } = {}) {
  const calls: { confirm: unknown[]; cancel: unknown[] } = { confirm: [], cancel: [] };
  const toss: TossClient = {
    async confirmPayment(input) {
      calls.confirm.push(input);
      if (behavior.failConfirm) throw new Error('토스 승인 거부 (테스트)');
      return { paymentKey: input.paymentKey, orderId: input.orderId, status: 'DONE', totalAmount: input.amount } as TossPaymentResult;
    },
    async cancelPayment(paymentKey, cancelReason) {
      calls.cancel.push({ paymentKey, cancelReason });
      if (behavior.failCancel) throw new Error('토스 취소 실패 (테스트)');
      return { paymentKey, orderId: '', status: 'CANCELED', totalAmount: 0 } as TossPaymentResult;
    },
  };
  return { toss, calls };
}

describe('generateSajuCode — 코드 발급기', () => {
  it('형식 XX-XXXXXX, 혼동 문자(I·O·L·0·1) 미포함', () => {
    expect(CODE_CHARSET).not.toMatch(/[IOL01]/);
    for (let i = 0; i < 200; i++) {
      const code = generateSajuCode();
      expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{2}-[A-HJ-KM-NP-Z2-9]{6}$/);
      expect(code).not.toMatch(/[IOL01]/);
    }
  });
});

describe('결제 — 승인·멱등·자동취소·환불 (PGlite)', () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await db.delete(orders);
    await db.delete(codes);
  });

  it('issueCode: 충돌 시 재시도해 새 코드를 발급한다', async () => {
    await db.insert(codes).values({ code: 'AA-AAAAAA', myeongsik });
    let call = 0;
    const generator = () => (call++ === 0 ? 'AA-AAAAAA' : 'BB-BBBBBB'); // 1회차 충돌 → 2회차 성공
    const issued = await issueCode(db, myeongsik, { generator });
    expect(issued.code).toBe('BB-BBBBBB');
  });

  it('issueCode: maxAttempts 연속 충돌 시 throw', async () => {
    await db.insert(codes).values({ code: 'AA-AAAAAA', myeongsik });
    await expect(
      issueCode(db, myeongsik, { generator: () => 'AA-AAAAAA', maxAttempts: 3 }),
    ).rejects.toThrow(/연속 충돌/);
  });

  it('confirm 성공: 토스 승인 → 코드 발급 + 주문(paid) 기록', async () => {
    const { toss, calls } = makeFakeToss();
    const result = await confirmPaymentAndPersist(db, toss, {
      orderNo: 'toss-order-1',
      paymentKey: 'pk-1',
      amount: PRODUCT_PRICES.yearly2026,
      product: 'yearly2026',
      myeongsik,
    });

    expect(result.alreadyProcessed).toBe(false);
    expect(result.code).toMatch(/^[A-Z2-9]{2}-[A-Z2-9]{6}$/);
    expect(calls.confirm).toHaveLength(1);
    expect(calls.confirm[0]).toEqual({ paymentKey: 'pk-1', orderId: 'toss-order-1', amount: PRODUCT_PRICES.yearly2026 });

    const [order] = await db.select().from(orders).where(eq(orders.orderNo, 'toss-order-1'));
    expect(order.status).toBe('paid');
    expect(order.paymentKey).toBe('pk-1');
    expect(order.amount).toBe(PRODUCT_PRICES.yearly2026);
  });

  it('금액 불일치: 토스 호출 없이 거부한다', async () => {
    const { toss, calls } = makeFakeToss();
    await expect(
      confirmPaymentAndPersist(db, toss, {
        orderNo: 'toss-order-2',
        paymentKey: 'pk-2',
        amount: 100, // 조작된 금액
        product: 'yearly2026',
        myeongsik,
      }),
    ).rejects.toThrow(PaymentValidationError);
    expect(calls.confirm).toHaveLength(0);
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it('중복 승인 방어: 같은 orderNo 재요청은 멱등 응답, 토스 재호출 없음', async () => {
    const { toss, calls } = makeFakeToss();
    const input = {
      orderNo: 'toss-order-3',
      paymentKey: 'pk-3',
      amount: PRODUCT_PRICES.jobCareer,
      product: 'jobCareer' as const,
      myeongsik,
    };
    const first = await confirmPaymentAndPersist(db, toss, input);
    const second = await confirmPaymentAndPersist(db, toss, input);

    expect(second.alreadyProcessed).toBe(true);
    expect(second.code).toBe(first.code);
    expect(second.orderId).toBe(first.orderId);
    expect(calls.confirm).toHaveLength(1); // 두 번째는 토스 호출 안 함
    expect(await db.select().from(orders)).toHaveLength(1);
  });

  it('토스 승인 실패: DB에 아무것도 남지 않는다', async () => {
    const { toss, calls } = makeFakeToss({ failConfirm: true });
    await expect(
      confirmPaymentAndPersist(db, toss, {
        orderNo: 'toss-order-4',
        paymentKey: 'pk-4',
        amount: PRODUCT_PRICES.premium,
        product: 'premium',
        myeongsik,
      }),
    ).rejects.toThrow(/승인 거부/);
    expect(calls.cancel).toHaveLength(0); // 승인 자체가 실패했으므로 취소 불필요
    expect(await db.select().from(codes)).toHaveLength(0);
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it('승인 후 영속 실패: 자동 취소를 호출하고 오류를 전파한다', async () => {
    await db.insert(codes).values({ code: 'ZZ-ZZZZZZ', myeongsik });
    const { toss, calls } = makeFakeToss();
    await expect(
      confirmPaymentAndPersist(
        db,
        toss,
        {
          orderNo: 'toss-order-5',
          paymentKey: 'pk-5',
          amount: PRODUCT_PRICES.premium,
          product: 'premium',
          myeongsik,
        },
        { generator: () => 'ZZ-ZZZZZZ', maxAttempts: 2 }, // 코드 발급이 반드시 실패하도록
      ),
    ).rejects.toThrow(/연속 충돌/);

    expect(calls.confirm).toHaveLength(1); // 승인은 됐고
    expect(calls.cancel).toHaveLength(1); // 자동 취소가 나갔다
    expect((calls.cancel[0] as { paymentKey: string }).paymentKey).toBe('pk-5');
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it('선물 코드: 명식 없는 미사용 코드가 발급된다', async () => {
    const { toss } = makeFakeToss();
    const result = await confirmPaymentAndPersist(db, toss, {
      orderNo: 'toss-gift-1',
      paymentKey: 'pk-g1',
      amount: PRODUCT_PRICES.loveMarriage,
      product: 'loveMarriage',
      myeongsik: null, // gift
    });

    const [codeRow] = await db.select().from(codes).where(eq(codes.code, result.code));
    expect(codeRow.myeongsik).toBeNull(); // 수령자가 코드 입력 + 생시 입력 시 채워진다 (2-3)
  });

  it('환불: 생성 전(paid) 주문은 토스 전액 취소 + refunded 전이', async () => {
    const { toss, calls } = makeFakeToss();
    await confirmPaymentAndPersist(db, toss, {
      orderNo: 'toss-order-6',
      paymentKey: 'pk-6',
      amount: PRODUCT_PRICES.yearly2026,
      product: 'yearly2026',
      myeongsik,
    });

    const outcome = await refundOrder(db, toss, 'toss-order-6', '단순 변심');
    expect(outcome).toEqual({ found: true, alreadyRefunded: false, amount: PRODUCT_PRICES.yearly2026 });
    expect(calls.cancel).toHaveLength(1);
    expect((calls.cancel[0] as { paymentKey: string }).paymentKey).toBe('pk-6');

    const [order] = await db.select().from(orders).where(eq(orders.orderNo, 'toss-order-6'));
    expect(order.status).toBe('refunded');

    // 재환불 시도 → 멱등
    const again = await refundOrder(db, toss, 'toss-order-6', '중복 요청');
    expect(again).toEqual({ found: true, alreadyRefunded: true, amount: null });
    expect(calls.cancel).toHaveLength(1); // 토스 재호출 없음
  });

  it('환불: 생성 후(generated) 주문은 정책 확정 대기로 차단된다', async () => {
    const { toss, calls } = makeFakeToss();
    const result = await confirmPaymentAndPersist(db, toss, {
      orderNo: 'toss-order-7',
      paymentKey: 'pk-7',
      amount: PRODUCT_PRICES.yearly2026,
      product: 'yearly2026',
      myeongsik,
    });
    await db.update(orders).set({ status: 'generated' }).where(eq(orders.id, result.orderId));

    await expect(refundOrder(db, toss, 'toss-order-7', '변심')).rejects.toThrow(RefundPolicyPendingError);
    expect(calls.cancel).toHaveLength(0); // 정책 확정 전엔 토스 취소도 나가면 안 됨
  });

  it('환불: 존재하지 않는 주문은 found=false', async () => {
    const { toss } = makeFakeToss();
    expect(await refundOrder(db, toss, 'no-such-order', '사유')).toEqual({ found: false, alreadyRefunded: false, amount: null });
  });
});
