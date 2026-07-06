/**
 * 관리자 통계·검수 로직 (IMPLEMENTATION_PLAN 2-5) — server.ts와 api/*.ts가 공유.
 *
 * - getAdminStats: 일별 매출·환불 + 생성 성공률·평균 원가·검증 실패율·검수 현황.
 * - sampleReportsForReview: 오늘(KST) 생성된 유효 리포트 중 미검수분 무작위 N건.
 * - saveReview: 승인/반려 + 반려 사유 태깅. 리포트당 1건(재판정은 덮어쓰기).
 *   검수 이력(report_reviews)은 리포트 파기 후에도 남는다.
 */
import { and, eq, gte, notExists, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { codes, orders, reportReviews, reports } from './schema.js';

/** 검증 실패 기준 — 품질 평가기 점수 80 미만 (프로덕션 보정 트리거와 동일) */
export const QUALITY_PASS_SCORE = 80;

export interface DailyStatRow {
  date: string; // YYYY-MM-DD (KST)
  orderCount: number;
  revenue: number;
  refunds: number;
}

export interface AdminStats {
  daily: DailyStatRow[];
  totals: {
    revenue: number;
    orderCount: number;
    refundCount: number;
    /** generated / (paid + generated). 주문 없으면 null */
    generationSuccessRate: number | null;
    /** 원가 기록이 있는 리포트의 평균(원). 기록 없으면 null */
    avgCostKrw: number | null;
    /** 점수 기록이 있는 리포트 중 80점 미만 비율. 기록 없으면 null */
    validationFailRate: number | null;
    reviewedCount: number;
    approvedCount: number;
  };
}

const KST_DATE = (col: unknown) => sql<string>`to_char(${col} at time zone 'Asia/Seoul', 'YYYY-MM-DD')`;

export async function getAdminStats(db: Db, days = 14): Promise<AdminStats> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const dateExpr = KST_DATE(orders.createdAt);

  const daily = await db
    .select({
      date: dateExpr,
      orderCount: sql<number>`(count(*) filter (where ${orders.status} <> 'refunded'))::int`,
      revenue: sql<number>`coalesce(sum(${orders.amount}) filter (where ${orders.status} <> 'refunded'), 0)::int`,
      refunds: sql<number>`(count(*) filter (where ${orders.status} = 'refunded'))::int`,
    })
    .from(orders)
    .where(gte(orders.createdAt, since))
    .groupBy(dateExpr)
    .orderBy(dateExpr);

  const [orderTotals] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orders.amount}) filter (where ${orders.status} <> 'refunded'), 0)::int`,
      orderCount: sql<number>`(count(*) filter (where ${orders.status} <> 'refunded'))::int`,
      refundCount: sql<number>`(count(*) filter (where ${orders.status} = 'refunded'))::int`,
      paidOrGenerated: sql<number>`(count(*) filter (where ${orders.status} in ('paid', 'generated')))::int`,
      generated: sql<number>`(count(*) filter (where ${orders.status} = 'generated'))::int`,
    })
    .from(orders);

  const [reportTotals] = await db
    .select({
      avgCostKrw: sql<number | null>`round(avg(${reports.generationCostKrw}))::int`,
      scored: sql<number>`(count(*) filter (where ${reports.qualityScore} is not null))::int`,
      failed: sql<number>`(count(*) filter (where ${reports.qualityScore} < ${QUALITY_PASS_SCORE}))::int`,
    })
    .from(reports);

  const [reviewTotals] = await db
    .select({
      reviewedCount: sql<number>`count(*)::int`,
      approvedCount: sql<number>`(count(*) filter (where ${reportReviews.verdict} = 'approved'))::int`,
    })
    .from(reportReviews);

  return {
    daily,
    totals: {
      revenue: orderTotals.revenue,
      orderCount: orderTotals.orderCount,
      refundCount: orderTotals.refundCount,
      generationSuccessRate:
        orderTotals.paidOrGenerated > 0 ? orderTotals.generated / orderTotals.paidOrGenerated : null,
      avgCostKrw: reportTotals.avgCostKrw ?? null,
      validationFailRate: reportTotals.scored > 0 ? reportTotals.failed / reportTotals.scored : null,
      reviewedCount: reviewTotals.reviewedCount,
      approvedCount: reviewTotals.approvedCount,
    },
  };
}

export interface ReviewSample {
  reportId: string;
  code: string;
  product: string;
  content: string;
  qualityScore: number | null;
  createdAt: Date;
}

/** 오늘(KST) 생성된 유효(미만료) 리포트 중 미검수분 무작위 N건 */
export async function sampleReportsForReview(db: Db, limit = 10): Promise<ReviewSample[]> {
  const rows = await db
    .select({
      reportId: reports.id,
      code: codes.code,
      product: reports.product,
      content: reports.content,
      qualityScore: reports.qualityScore,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(codes, eq(reports.codeId, codes.id))
    .where(
      and(
        sql`${KST_DATE(reports.createdAt)} = ${KST_DATE(sql`now()`)}`,
        sql`${reports.expiresAt} > now()`,
        notExists(
          db.select({ one: sql`1` }).from(reportReviews).where(eq(reportReviews.reportId, reports.id)),
        ),
      ),
    )
    .orderBy(sql`random()`)
    .limit(limit);
  return rows;
}

export type ReviewSaveOutcome = { ok: true } | { ok: false; reason: 'report_not_found' };

export async function saveReview(
  db: Db,
  input: { reportId: string; verdict: 'approved' | 'rejected'; tags: string[]; note: string },
): Promise<ReviewSaveOutcome> {
  const [report] = await db
    .select({ id: reports.id, product: reports.product })
    .from(reports)
    .where(eq(reports.id, input.reportId));
  if (!report) return { ok: false, reason: 'report_not_found' };

  await db
    .insert(reportReviews)
    .values({
      reportId: report.id,
      product: report.product,
      verdict: input.verdict,
      tags: input.tags,
      note: input.note,
    })
    .onConflictDoUpdate({
      target: reportReviews.reportId,
      set: { verdict: input.verdict, tags: input.tags, note: input.note, createdAt: new Date() },
    });
  return { ok: true };
}
