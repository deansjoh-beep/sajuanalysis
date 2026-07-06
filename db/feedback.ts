/**
 * 베타 피드백 (IMPLEMENTATION_PLAN 3-2) — server.ts와 api/code.ts가 공유.
 *
 * 리포트 말미 폼: 별점(1~5) + 객관식 3문항 + 자유 서술.
 * 코드 기준 익명 수집 — 코드당 상품별 1회(재제출은 덮어쓰기).
 *
 * ⛔ 객관식 문항·선택지는 OWNER 확정 전 임시안 — 변경 시 아래 허용값 표만 교체.
 */
import { eq, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { codes, feedback } from './schema.js';

/** 객관식 허용값 (임시안) — 키/값이 곧 폼의 문항/선택지 */
export const FEEDBACK_QUESTIONS: Record<string, readonly string[]> = {
  /** Q1. 해석이 실제와 얼마나 맞았나요? */
  accuracy: ['잘 맞았다', '보통이다', '잘 맞지 않았다'],
  /** Q2. 가장 유익했던 부분은? */
  bestSection: ['총운·큰 흐름', '월별·시기 조언', '실행 체크리스트', '기타'],
  /** Q3. 주변에 추천할 의향이 있나요? */
  recommend: ['추천하겠다', '보통이다', '추천하지 않겠다'],
};

export interface FeedbackOutcome {
  ok: boolean;
  reason: 'saved' | 'code_not_found' | 'invalid_rating' | 'invalid_answer';
}

export async function submitFeedback(
  db: Db,
  input: {
    code: string;
    product: 'premium' | 'yearly2026' | 'jobCareer' | 'loveMarriage';
    rating: number;
    answers: Record<string, string>;
    comment: string;
  },
): Promise<FeedbackOutcome> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, reason: 'invalid_rating' };
  }

  // 객관식은 허용값만 저장 (자유 텍스트 주입 방지 — 집계 무결성)
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.answers ?? {})) {
    const allowed = FEEDBACK_QUESTIONS[key];
    if (!allowed) continue;
    if (!allowed.includes(value)) return { ok: false, reason: 'invalid_answer' };
    answers[key] = value;
  }

  const codeStr = input.code.trim().toUpperCase();
  const [codeRow] = await db.select({ id: codes.id }).from(codes).where(eq(codes.code, codeStr));
  if (!codeRow) return { ok: false, reason: 'code_not_found' };

  await db
    .insert(feedback)
    .values({
      codeId: codeRow.id,
      product: input.product,
      rating: input.rating,
      answers,
      comment: input.comment.slice(0, 2000),
    })
    .onConflictDoUpdate({
      target: [feedback.codeId, feedback.product],
      set: {
        rating: input.rating,
        answers,
        comment: input.comment.slice(0, 2000),
        createdAt: new Date(),
      },
    });
  return { ok: true, reason: 'saved' };
}

export interface FeedbackStats {
  count: number;
  avgRating: number | null;
  /** 별점 분포 — index 0 = 1점 … index 4 = 5점 */
  ratingDist: number[];
  /** 문항별 응답 분포 { 문항키: { 선택지: 건수 } } */
  answerDist: Record<string, Record<string, number>>;
  /** 최근 자유 서술 (최대 20건, 최신순) */
  recentComments: Array<{ product: string; rating: number; comment: string; createdAt: Date }>;
}

export async function getFeedbackStats(db: Db): Promise<FeedbackStats> {
  const [agg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      avgRating: sql<number | null>`round(avg(${feedback.rating})::numeric, 2)::float`,
      d1: sql<number>`(count(*) filter (where ${feedback.rating} = 1))::int`,
      d2: sql<number>`(count(*) filter (where ${feedback.rating} = 2))::int`,
      d3: sql<number>`(count(*) filter (where ${feedback.rating} = 3))::int`,
      d4: sql<number>`(count(*) filter (where ${feedback.rating} = 4))::int`,
      d5: sql<number>`(count(*) filter (where ${feedback.rating} = 5))::int`,
    })
    .from(feedback);

  const answerDist: Record<string, Record<string, number>> = {};
  for (const key of Object.keys(FEEDBACK_QUESTIONS)) {
    // key는 내부 상수(FEEDBACK_QUESTIONS 키)라 리터럴 인라인이 안전 —
    // 파라미터로 넘기면 SELECT/GROUP BY 식이 달라져 Postgres가 거부한다.
    const extract = sql.raw(`"answers" ->> '${key}'`);
    const rows = await db
      .select({
        value: sql<string>`${extract}`,
        n: sql<number>`count(*)::int`,
      })
      .from(feedback)
      .where(sql`${extract} is not null`)
      .groupBy(extract);
    answerDist[key] = Object.fromEntries(rows.map((r) => [r.value, r.n]));
  }

  const commentRows = await db
    .select({
      product: feedback.product,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(sql`${feedback.comment} <> ''`)
    .orderBy(sql`${feedback.createdAt} desc`)
    .limit(20);

  return {
    count: agg.count,
    avgRating: agg.avgRating ?? null,
    ratingDist: [agg.d1, agg.d2, agg.d3, agg.d4, agg.d5],
    answerDist,
    recentComments: commentRows,
  };
}
