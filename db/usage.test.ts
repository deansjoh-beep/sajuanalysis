/**
 * 이용현황(활동 지표) 집계 테스트 (인메모리 PGlite + 실제 마이그레이션).
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getUsageStats, kstDayOf, recordUsageEvent } from './usage.ts';
import { lookupCode } from './code.ts';
import { getAdminStats } from './admin.ts';
import * as schema from './schema.ts';
import { codes, orders, reports, usageEvents, type MyeongsikParams } from './schema.ts';

const myeongsik: MyeongsikParams = {
  pillars: { year: '갑진', month: '병인', day: '정미', hour: null },
  gender: 'male',
  daeunsu: 4,
  daeunDirection: 'forward',
  birthYear: 1988,
  timeUnknown: true,
};

describe('이용현황 집계 (PGlite)', () => {
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
    await db.delete(usageEvents);
    await db.delete(reports);
    await db.delete(orders);
    await db.delete(codes);
  });

  it('recordUsageEvent: 같은 날 같은 이벤트는 카운터가 누적된다', async () => {
    await recordUsageEvent(db, 'lookup');
    await recordUsageEvent(db, 'lookup');
    await recordUsageEvent(db, 'lookup');
    const rows = await db.select().from(usageEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(3);
    expect(rows[0].day).toBe(kstDayOf());
  });

  it('lookupCode: 실재 코드 조회는 열람 1건으로 집계, 없는 코드는 미집계', async () => {
    await db.insert(codes).values({ code: 'UU-USAGE1', myeongsik });
    await lookupCode(db, 'UU-USAGE1');
    await lookupCode(db, 'UU-USAGE1');
    await lookupCode(db, 'ZZ-NOPE99'); // 미존재 — 집계 안 됨
    const stats = await getUsageStats(db);
    expect(stats.totals.lookups).toBe(2);
  });

  it('getUsageStats: 일별 발급·무료/유료 주문·생성·열람과 누적 요약을 집계한다', async () => {
    const [c1] = await db.insert(codes).values({ code: 'UA-100001', myeongsik }).returning();
    const [c2] = await db.insert(codes).values({ code: 'UB-100002' }).returning(); // 미리딤(비활성)
    await db.insert(orders).values([
      { orderNo: 'u-1', paymentKey: 'pk-1', codeId: c1.id, product: 'yearly2026', status: 'generated', amount: 0 },
      { orderNo: 'u-2', paymentKey: 'pk-2', codeId: c2.id, product: 'premium', status: 'paid', amount: 9900 },
      { orderNo: 'u-3', paymentKey: 'pk-3', codeId: c2.id, product: 'premium', status: 'refunded', amount: 9900 },
    ]);
    const [o1] = await db.select().from(orders).where(eq(orders.orderNo, 'u-1'));
    await db.insert(reports).values({
      codeId: c1.id, orderId: o1.id, product: 'yearly2026', content: '본문',
    });
    await recordUsageEvent(db, 'lookup');

    const stats = await getUsageStats(db);
    const today = stats.daily[stats.daily.length - 1];

    expect(stats.daily).toHaveLength(14); // 빈 날짜 없이 14일 연속
    expect(today.date).toBe(kstDayOf());
    expect(today.codesIssued).toBe(2);
    expect(today.ordersFree).toBe(1);
    expect(today.ordersPaid).toBe(1); // 환불 제외
    expect(today.reportsGenerated).toBe(1);
    expect(today.lookups).toBe(1);

    expect(stats.totals.codes).toBe(2);
    expect(stats.totals.activeCodes).toBe(1);
    expect(stats.totals.reports).toBe(1);
    expect(stats.totals.ordersByProduct).toEqual({ yearly2026: 1, premium: 1 }); // 환불 제외
  });

  it('getAdminStats: usage 필드로 이용현황이 함께 내려간다', async () => {
    await db.insert(codes).values({ code: 'UC-100003', myeongsik });
    const stats = await getAdminStats(db);
    expect(stats.usage.totals.codes).toBe(1);
    expect(stats.usage.daily).toHaveLength(14);
  });
});
