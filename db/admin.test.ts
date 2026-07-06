/**
 * Phase 2-5 관리자 통계·검수 테스트 (인메모리 PGlite + 실제 마이그레이션).
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getAdminStats, sampleReportsForReview, saveReview } from './admin.ts';
import { saveReport } from './code.ts';
import * as schema from './schema.ts';
import { codes, orders, reportReviews, reports, type MyeongsikParams } from './schema.ts';

const myeongsik: MyeongsikParams = {
  pillars: { year: '갑진', month: '병인', day: '정미', hour: null },
  gender: 'male',
  daeunsu: 4,
  daeunDirection: 'forward',
  birthYear: 1988,
  timeUnknown: true,
};

describe('관리자 통계·검수 (PGlite)', () => {
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
    await db.delete(reportReviews);
    await db.delete(reports);
    await db.delete(orders);
    await db.delete(codes);
  });

  async function seedOrder(codeStr: string, opts: {
    status?: 'paid' | 'generated' | 'refunded';
    amount?: number;
    createdAt?: Date;
  } = {}) {
    const [codeRow] = await db.insert(codes).values({ code: codeStr, myeongsik }).returning();
    const [order] = await db
      .insert(orders)
      .values({
        orderNo: `order-${codeStr}`,
        paymentKey: `pk-${codeStr}`,
        codeId: codeRow.id,
        product: 'yearly2026',
        status: opts.status ?? 'paid',
        amount: opts.amount ?? 49000,
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      })
      .returning();
    return { codeRow, order };
  }

  it('getAdminStats: 매출은 환불 제외, 성공률·원가·실패율·검수 집계', async () => {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const { order: o1 } = await seedOrder('AA-111111', { status: 'generated', amount: 49000 });
    await seedOrder('BB-222222', { status: 'paid', amount: 39000, createdAt: dayAgo });
    await seedOrder('CC-333333', { status: 'refunded', amount: 99000 });

    // 리포트 2건: 원가·품질점수 포함 (하나는 검증 실패 점수)
    await saveReport(db, 'AA-111111', o1.id, '본문 A', { generationCostKrw: 300, qualityScore: 95 });
    const [r2] = await db
      .insert(reports)
      .values({ codeId: (await db.select().from(codes).where(eq(codes.code, 'BB-222222')))[0].id,
        orderId: (await db.select().from(orders).where(eq(orders.orderNo, 'order-BB-222222')))[0].id,
        product: 'yearly2026', content: '본문 B', generationCostKrw: 500, qualityScore: 60 })
      .returning();
    await saveReview(db, { reportId: r2.id, verdict: 'rejected', tags: ['근거 부족'], note: '' });

    const stats = await getAdminStats(db, 14);

    expect(stats.totals.revenue).toBe(49000 + 39000); // 환불 99000 제외
    expect(stats.totals.orderCount).toBe(2);
    expect(stats.totals.refundCount).toBe(1);
    // 성공률: generated 1 / (paid+generated 2) — AA는 saveReport로 generated 전이됨
    expect(stats.totals.generationSuccessRate).toBeCloseTo(1 / 2);
    expect(stats.totals.avgCostKrw).toBe(400); // (300+500)/2
    expect(stats.totals.validationFailRate).toBeCloseTo(1 / 2); // 60점 1건 / 점수 2건
    expect(stats.totals.reviewedCount).toBe(1);
    expect(stats.totals.approvedCount).toBe(0);

    // 일별: 오늘(주문 2건 중 환불 1건 제외 → 1건 49000) + 어제(39000)
    expect(stats.daily.length).toBe(2);
    const today = stats.daily[stats.daily.length - 1];
    expect(today.orderCount).toBe(1);
    expect(today.revenue).toBe(49000);
    expect(today.refunds).toBe(1);
  });

  it('sampleReportsForReview: 오늘 생성·미만료·미검수만, 검수 후 제외', async () => {
    const { order } = await seedOrder('DD-444444', { status: 'generated' });
    await saveReport(db, 'DD-444444', order.id, '오늘 본문', { qualityScore: 90 });

    // 만료된 리포트 (오늘 생성이지만 만료)
    const { order: o2, codeRow: c2 } = await seedOrder('EE-555555', { status: 'generated' });
    await db.insert(reports).values({
      codeId: c2.id, orderId: o2.id, product: 'yearly2026', content: '만료 본문',
      expiresAt: new Date(Date.now() - 1000),
    });

    let samples = await sampleReportsForReview(db, 10);
    expect(samples).toHaveLength(1);
    expect(samples[0].code).toBe('DD-444444');
    expect(samples[0].qualityScore).toBe(90);

    await saveReview(db, { reportId: samples[0].reportId, verdict: 'approved', tags: [], note: '' });
    samples = await sampleReportsForReview(db, 10);
    expect(samples).toHaveLength(0); // 검수 완료분 제외
  });

  it('saveReview: 미존재 리포트는 report_not_found, 재판정은 덮어쓰기', async () => {
    expect(await saveReview(db, { reportId: '00000000-0000-4000-8000-000000000000', verdict: 'approved', tags: [], note: '' }))
      .toEqual({ ok: false, reason: 'report_not_found' });

    const { order } = await seedOrder('FF-666666', { status: 'generated' });
    const saved = await saveReport(db, 'FF-666666', order.id, '본문 F 검수 대상입니다. '.repeat(10));
    expect(saved.ok).toBe(true);

    await saveReview(db, { reportId: saved.reportId!, verdict: 'rejected', tags: ['형식 오류'], note: '마커 누락' });
    await saveReview(db, { reportId: saved.reportId!, verdict: 'approved', tags: [], note: '수정 확인' });

    const rows = await db.select().from(reportReviews);
    expect(rows).toHaveLength(1); // 리포트당 1건 (덮어쓰기)
    expect(rows[0].verdict).toBe('approved');
    expect(rows[0].note).toBe('수정 확인');
  });

  it('saveReport: 원가·품질점수 메타가 저장된다', async () => {
    const { order } = await seedOrder('GG-777777');
    const saved = await saveReport(db, 'GG-777777', order.id, '메타 포함 본문입니다. '.repeat(10), {
      generationCostKrw: 310,
      qualityScore: 100,
    });
    const [row] = await db.select().from(reports).where(eq(reports.id, saved.reportId!));
    expect(row.generationCostKrw).toBe(310);
    expect(row.qualityScore).toBe(100);
  });
});
