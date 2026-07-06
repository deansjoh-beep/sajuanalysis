/**
 * Phase 2-3 사주 코드 체계 테스트 — 조회/재열람·선물 리딤·후속 질문 (인메모리 PGlite).
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  consumeFollowup,
  FOLLOWUP_LIMIT,
  lookupCode,
  NEW_YEAR_DISCOUNT_PERCENT,
  redeemGiftCode,
  saveReport,
} from './code.ts';
import { PersonalDataError } from './schema.ts';
import * as schema from './schema.ts';
import { codes, orders, reports, type MyeongsikParams } from './schema.ts';

const myeongsik: MyeongsikParams = {
  pillars: { year: '갑진', month: '병인', day: '정미', hour: '경자' },
  gender: 'female',
  daeunsu: 5,
  daeunDirection: 'forward',
  birthYear: 1992,
  timeUnknown: false,
};

describe('사주 코드 체계 — 조회·리딤·후속질문', () => {
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
    await db.delete(reports);
    await db.delete(orders);
    await db.delete(codes);
  });

  async function seed(codeStr: string, opts: { gift?: boolean; orderStatus?: 'paid' | 'generated' | 'refunded'; reportExpired?: boolean; withReport?: boolean } = {}) {
    const [codeRow] = await db
      .insert(codes)
      .values({ code: codeStr, myeongsik: opts.gift ? null : myeongsik })
      .returning();
    const [order] = await db
      .insert(orders)
      .values({
        orderNo: `order-${codeStr}`,
        paymentKey: `pk-${codeStr}`,
        codeId: codeRow.id,
        product: 'yearly2026',
        status: opts.orderStatus ?? 'paid',
        amount: 49000,
      })
      .returning();
    let report = null;
    if (opts.withReport) {
      [report] = await db
        .insert(reports)
        .values({
          codeId: codeRow.id,
          orderId: order.id,
          product: 'yearly2026',
          content: '리포트 본문',
          ...(opts.reportExpired ? { expiresAt: new Date(Date.now() - 1000) } : {}),
        })
        .returning();
    }
    return { codeRow, order, report };
  }

  // ─── 조회 / 재열람 ────────────────────────────────────────────────────

  it('lookup: 존재하지 않는 코드는 found=false', async () => {
    const result = await lookupCode(db, 'ZZ-999999');
    expect(result.found).toBe(false);
  });

  it('lookup: 유효 리포트는 본문 포함 재열람, 할인·후속질문 정보 동봉', async () => {
    const { order } = await seed('AA-111111', { orderStatus: 'generated', withReport: true });
    const result = await lookupCode(db, 'aa-111111'); // 소문자 입력 normalize

    expect(result.found).toBe(true);
    expect(result.giftPending).toBe(false);
    expect(result.myeongsik).toEqual(myeongsik);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].content).toBe('리포트 본문');
    expect(result.regenerable).toHaveLength(0); // 유효 리포트 있음 → 재생성 불필요
    expect(result.newYearDiscountPercent).toBe(NEW_YEAR_DISCOUNT_PERCENT);
    expect(result.orders[0]).toMatchObject({
      orderId: order.id,
      product: 'yearly2026',
      status: 'generated',
      followupRemaining: FOLLOWUP_LIMIT,
    });
  });

  it('lookup: 만료 리포트는 본문 미반환 + 동일 상품 무과금 재생성 대상 표시', async () => {
    const { order } = await seed('BB-222222', { orderStatus: 'generated', withReport: true, reportExpired: true });
    const result = await lookupCode(db, 'BB-222222');

    expect(result.reports).toHaveLength(0); // expires_at 읽기 경로 검사 — 크론 공백에도 본문 노출 금지
    expect(result.regenerable).toEqual([{ orderId: order.id, product: 'yearly2026' }]);
  });

  it('lookup: 선물 미리딤 코드는 giftPending=true, 명식 없음', async () => {
    await seed('CC-333333', { gift: true });
    const result = await lookupCode(db, 'CC-333333');
    expect(result.giftPending).toBe(true);
    expect(result.myeongsik).toBeNull();
  });

  // ─── 선물 코드 리딤 ───────────────────────────────────────────────────

  it('redeem: 미사용 선물 코드에 명식을 채운다', async () => {
    await seed('DD-444444', { gift: true });
    const outcome = await redeemGiftCode(db, 'dd-444444', myeongsik);
    expect(outcome).toBe('redeemed');

    const [row] = await db.select().from(codes).where(eq(codes.code, 'DD-444444'));
    expect(row.myeongsik).toEqual(myeongsik);
  });

  it('redeem: 이미 등록된 코드는 already_redeemed (이중 리딤 차단)', async () => {
    await seed('EE-555555', { gift: true });
    expect(await redeemGiftCode(db, 'EE-555555', myeongsik)).toBe('redeemed');
    expect(await redeemGiftCode(db, 'EE-555555', myeongsik)).toBe('already_redeemed');
  });

  it('redeem: 일반(비선물) 코드도 already_redeemed로 보호된다', async () => {
    await seed('FF-666666');
    expect(await redeemGiftCode(db, 'FF-666666', myeongsik)).toBe('already_redeemed');
  });

  it('redeem: 존재하지 않는 코드는 not_found', async () => {
    expect(await redeemGiftCode(db, 'ZZ-888888', myeongsik)).toBe('not_found');
  });

  it('redeem: PII 섞인 명식은 저장 전에 거부한다', async () => {
    await seed('GG-777777', { gift: true });
    const dirty = { ...myeongsik, email: 'a@b.c' } as unknown as MyeongsikParams;
    await expect(redeemGiftCode(db, 'GG-777777', dirty)).rejects.toThrow(PersonalDataError);

    const [row] = await db.select().from(codes).where(eq(codes.code, 'GG-777777'));
    expect(row.myeongsik).toBeNull(); // 여전히 미리딤
  });

  // ─── 후속 질문 회수 차감 ─────────────────────────────────────────────

  it(`followup: 주문당 ${FOLLOWUP_LIMIT}회 차감 후 차단된다`, async () => {
    const { order } = await seed('HH-222333');

    for (let i = 1; i <= FOLLOWUP_LIMIT; i++) {
      const outcome = await consumeFollowup(db, 'HH-222333', order.id);
      expect(outcome).toEqual({ ok: true, reason: 'consumed', remaining: FOLLOWUP_LIMIT - i });
    }

    const blocked = await consumeFollowup(db, 'HH-222333', order.id);
    expect(blocked).toEqual({ ok: false, reason: 'limit_exhausted', remaining: 0 });

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.followupUsed).toBe(FOLLOWUP_LIMIT); // 초과 차감 없음
  });

  it('followup: 다른 코드의 주문은 차감할 수 없다 (코드 소지 = 자격)', async () => {
    const { order } = await seed('JJ-444555');
    await seed('KK-666777');

    const outcome = await consumeFollowup(db, 'KK-666777', order.id);
    expect(outcome).toEqual({ ok: false, reason: 'order_not_found', remaining: 0 });

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.followupUsed).toBe(0);
  });

  // ─── 리포트 저장 (생성 파이프 연결) ──────────────────────────────────

  it('saveReport: 본문 저장 + 주문 paid→generated 전이 + 72h 만료', async () => {
    const { order } = await seed('NN-111222');
    const outcome = await saveReport(db, 'nn-111222', order.id, '생성된 리포트 본문');

    expect(outcome.ok).toBe(true);
    expect(outcome.reportId).toBeTruthy();
    expect(outcome.expiresAt!.getTime()).toBeGreaterThan(Date.now());

    const [orderRow] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(orderRow.status).toBe('generated');

    const result = await lookupCode(db, 'NN-111222');
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].content).toBe('생성된 리포트 본문');
    expect(result.regenerable).toHaveLength(0);
  });

  it('saveReport: 유효 리포트가 있으면 already_active (만료 전 중복 저장 차단)', async () => {
    const { order } = await seed('PP-333444', { orderStatus: 'generated', withReport: true });
    const outcome = await saveReport(db, 'PP-333444', order.id, '두 번째 본문');
    expect(outcome).toMatchObject({ ok: false, reason: 'already_active' });
  });

  it('saveReport: 만료된 리포트만 있으면 재저장 허용 (무과금 재생성 경로)', async () => {
    const { order } = await seed('QQ-555666', { orderStatus: 'generated', withReport: true, reportExpired: true });
    const outcome = await saveReport(db, 'QQ-555666', order.id, '재생성된 본문');
    expect(outcome.ok).toBe(true);

    const result = await lookupCode(db, 'QQ-555666');
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].content).toBe('재생성된 본문');
  });

  it('saveReport: 환불 주문은 order_not_eligible, 타 코드 주문은 order_not_found', async () => {
    const { order } = await seed('RR-777888', { orderStatus: 'refunded' });
    expect(await saveReport(db, 'RR-777888', order.id, '본문')).toMatchObject({ ok: false, reason: 'order_not_eligible' });

    await seed('SS-999000');
    expect(await saveReport(db, 'SS-999000', order.id, '본문')).toMatchObject({ ok: false, reason: 'order_not_found' });
  });

  it('followup: 존재하지 않는 코드/주문은 order_not_found', async () => {
    const { order } = await seed('MM-888999');
    expect(await consumeFollowup(db, 'ZZ-000111', order.id)).toEqual({ ok: false, reason: 'order_not_found', remaining: 0 });
    expect(await consumeFollowup(db, 'MM-888999', '00000000-0000-4000-8000-000000000000')).toEqual({ ok: false, reason: 'order_not_found', remaining: 0 });
  });
});
