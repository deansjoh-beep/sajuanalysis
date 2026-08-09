/**
 * 이용현황(활동 지표) 집계 — server.ts와 api/*.ts가 공유.
 *
 * - recordUsageEvent: (KST 날짜, 이벤트) 카운터 +1. 실패해도 호출측 흐름을 깨지 않는다
 *   (열람 같은 핵심 경로에 부가 기능이라, 테이블 미적용 환경에서도 안전해야 한다).
 * - getUsageStats: 일별 코드 발급·무료/유료 주문·리포트 생성·열람 + 누적 요약.
 *   발급·주문·생성은 기존 테이블 created_at으로, 열람은 usage_events로 집계한다.
 */
import { gte, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { codes, orders, reports, usageEvents } from './schema.js';

/** KST 기준 YYYY-MM-DD */
export const kstDayOf = (d: Date = new Date()): string =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export type UsageEventName = 'lookup';

/** 이벤트 카운터 +1 — 어떤 실패도 삼킨다(핵심 경로 보호). */
export async function recordUsageEvent(db: Db, event: UsageEventName, day: string = kstDayOf()): Promise<void> {
  try {
    await db
      .insert(usageEvents)
      .values({ day, event, count: 1 })
      .onConflictDoUpdate({
        target: [usageEvents.day, usageEvents.event],
        set: { count: sql`${usageEvents.count} + 1` },
      });
  } catch (error) {
    console.warn('[usage] recordUsageEvent failed:', error);
  }
}

export interface UsageDailyRow {
  date: string; // YYYY-MM-DD (KST)
  codesIssued: number;
  ordersFree: number;
  ordersPaid: number;
  reportsGenerated: number;
  lookups: number;
}

export interface UsageStats {
  daily: UsageDailyRow[];
  totals: {
    codes: number;
    /** 명식이 채워진(실사용 시작) 코드 수 */
    activeCodes: number;
    reports: number;
    lookups: number;
    /** 상품별 누적 주문 수 (환불 제외) */
    ordersByProduct: Record<string, number>;
  };
}

const KST_DATE = (col: unknown) => sql<string>`to_char(${col} at time zone 'Asia/Seoul', 'YYYY-MM-DD')`;

export async function getUsageStats(db: Db, days = 14): Promise<UsageStats> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const sinceDay = kstDayOf(since);

  const codesDaily = await db
    .select({ date: KST_DATE(codes.createdAt), n: sql<number>`count(*)::int` })
    .from(codes)
    .where(gte(codes.createdAt, since))
    .groupBy(KST_DATE(codes.createdAt));

  const ordersDaily = await db
    .select({
      date: KST_DATE(orders.createdAt),
      free: sql<number>`(count(*) filter (where ${orders.amount} = 0 and ${orders.status} <> 'refunded'))::int`,
      paid: sql<number>`(count(*) filter (where ${orders.amount} > 0 and ${orders.status} <> 'refunded'))::int`,
    })
    .from(orders)
    .where(gte(orders.createdAt, since))
    .groupBy(KST_DATE(orders.createdAt));

  const reportsDaily = await db
    .select({ date: KST_DATE(reports.createdAt), n: sql<number>`count(*)::int` })
    .from(reports)
    .where(gte(reports.createdAt, since))
    .groupBy(KST_DATE(reports.createdAt));

  // usage_events는 마이그레이션 0003 이후 존재 — 미적용 환경에서도 나머지 통계는 살린다.
  let lookupsDaily: Array<{ date: string; n: number }> = [];
  let lookupsTotal = 0;
  try {
    lookupsDaily = await db
      .select({ date: usageEvents.day, n: usageEvents.count })
      .from(usageEvents)
      .where(sql`${usageEvents.event} = 'lookup' and ${usageEvents.day} >= ${sinceDay}`);
    const [lt] = await db
      .select({ n: sql<number>`coalesce(sum(${usageEvents.count}), 0)::int` })
      .from(usageEvents)
      .where(sql`${usageEvents.event} = 'lookup'`);
    lookupsTotal = lt?.n ?? 0;
  } catch (error) {
    console.warn('[usage] usage_events unavailable (마이그레이션 미적용?):', error);
  }

  const [codeTotals] = await db
    .select({
      codes: sql<number>`count(*)::int`,
      activeCodes: sql<number>`(count(*) filter (where ${codes.myeongsik} is not null))::int`,
    })
    .from(codes);
  const [reportTotals] = await db.select({ n: sql<number>`count(*)::int` }).from(reports);
  const productRows = await db
    .select({ product: orders.product, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(sql`${orders.status} <> 'refunded'`)
    .groupBy(orders.product);

  // 최근 N일을 빈 날짜 없이 연속 시리즈로 채운다(대시보드 표가 며칠 비어도 흐름이 보이게).
  const byDate = new Map<string, UsageDailyRow>();
  for (let i = days - 1; i >= 0; i--) {
    const date = kstDayOf(new Date(Date.now() - i * 24 * 3600 * 1000));
    byDate.set(date, { date, codesIssued: 0, ordersFree: 0, ordersPaid: 0, reportsGenerated: 0, lookups: 0 });
  }
  for (const r of codesDaily) byDate.get(r.date) && (byDate.get(r.date)!.codesIssued = r.n);
  for (const r of ordersDaily) {
    const row = byDate.get(r.date);
    if (row) { row.ordersFree = r.free; row.ordersPaid = r.paid; }
  }
  for (const r of reportsDaily) byDate.get(r.date) && (byDate.get(r.date)!.reportsGenerated = r.n);
  for (const r of lookupsDaily) byDate.get(r.date) && (byDate.get(r.date)!.lookups = r.n);

  return {
    daily: [...byDate.values()],
    totals: {
      codes: codeTotals.codes,
      activeCodes: codeTotals.activeCodes,
      reports: reportTotals.n,
      lookups: lookupsTotal,
      ordersByProduct: Object.fromEntries(productRows.map((r) => [r.product, r.n])),
    },
  };
}
