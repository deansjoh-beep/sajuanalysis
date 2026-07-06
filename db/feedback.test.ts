/**
 * Phase 3-2 베타 인프라 테스트 — 피드백 수집·집계 + 베타 코드 발급 (인메모리 PGlite).
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { issueBetaCodes } from './beta.ts';
import { lookupCode } from './code.ts';
import { getFeedbackStats, submitFeedback } from './feedback.ts';
import * as schema from './schema.ts';
import { codes, feedback, orders, type MyeongsikParams } from './schema.ts';

const myeongsik: MyeongsikParams = {
  pillars: { year: '갑진', month: '병인', day: '정미', hour: null },
  gender: 'female',
  daeunsu: 6,
  daeunDirection: 'backward',
  birthYear: 1995,
  timeUnknown: true,
};

describe('베타 인프라 — 피드백·코드 발급 (PGlite)', () => {
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
    await db.delete(feedback);
    await db.delete(orders);
    await db.delete(codes);
  });

  // ─── 피드백 ──────────────────────────────────────────────────────────

  it('submitFeedback: 정상 제출 + 재제출은 덮어쓰기(코드·상품당 1건)', async () => {
    await db.insert(codes).values({ code: 'FB-111111', myeongsik });

    const first = await submitFeedback(db, {
      code: 'fb-111111', // 소문자 normalize
      product: 'yearly2026',
      rating: 4,
      answers: { accuracy: '잘 맞았다', recommend: '추천하겠다' },
      comment: '월별 조언이 유익했어요',
    });
    expect(first).toEqual({ ok: true, reason: 'saved' });

    const second = await submitFeedback(db, {
      code: 'FB-111111',
      product: 'yearly2026',
      rating: 5,
      answers: { accuracy: '잘 맞았다' },
      comment: '수정 제출',
    });
    expect(second).toEqual({ ok: true, reason: 'saved' });

    const rows = await db.select().from(feedback);
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(5);
    expect(rows[0].comment).toBe('수정 제출');
  });

  it('submitFeedback: 별점 범위·허용되지 않은 선택지·미존재 코드 거부', async () => {
    await db.insert(codes).values({ code: 'FB-222222', myeongsik });

    expect(await submitFeedback(db, { code: 'FB-222222', product: 'yearly2026', rating: 0, answers: {}, comment: '' }))
      .toEqual({ ok: false, reason: 'invalid_rating' });
    expect(await submitFeedback(db, { code: 'FB-222222', product: 'yearly2026', rating: 6, answers: {}, comment: '' }))
      .toEqual({ ok: false, reason: 'invalid_rating' });
    expect(
      await submitFeedback(db, {
        code: 'FB-222222',
        product: 'yearly2026',
        rating: 3,
        answers: { accuracy: '임의의 값 주입' },
        comment: '',
      }),
    ).toEqual({ ok: false, reason: 'invalid_answer' });
    expect(await submitFeedback(db, { code: 'ZZ-999999', product: 'yearly2026', rating: 3, answers: {}, comment: '' }))
      .toEqual({ ok: false, reason: 'code_not_found' });

    expect(await db.select().from(feedback)).toHaveLength(0);
  });

  it('getFeedbackStats: 별점·문항 분포와 서술 목록 집계', async () => {
    await db.insert(codes).values([
      { code: 'FB-333331', myeongsik },
      { code: 'FB-333332', myeongsik },
      { code: 'FB-333333', myeongsik },
    ]);
    await submitFeedback(db, { code: 'FB-333331', product: 'yearly2026', rating: 5, answers: { accuracy: '잘 맞았다' }, comment: '좋아요' });
    await submitFeedback(db, { code: 'FB-333332', product: 'yearly2026', rating: 4, answers: { accuracy: '잘 맞았다' }, comment: '' });
    await submitFeedback(db, { code: 'FB-333333', product: 'jobCareer', rating: 2, answers: { accuracy: '잘 맞지 않았다' }, comment: '아쉬움' });

    const stats = await getFeedbackStats(db);
    expect(stats.count).toBe(3);
    expect(stats.avgRating).toBeCloseTo((5 + 4 + 2) / 3, 1);
    expect(stats.ratingDist).toEqual([0, 1, 0, 1, 1]);
    expect(stats.answerDist.accuracy).toEqual({ '잘 맞았다': 2, '잘 맞지 않았다': 1 });
    expect(stats.recentComments).toHaveLength(2); // 빈 서술 제외
  });

  // ─── 베타 코드 발급 ───────────────────────────────────────────────────

  it('issueBetaCodes: 미사용 코드 + 0원 주문(리포트 자격·후속질문 3회) 발급', async () => {
    const { codes: issued } = await issueBetaCodes(db, 5, 'yearly2026');
    expect(issued).toHaveLength(5);
    expect(new Set(issued).size).toBe(5); // 중복 없음

    const result = await lookupCode(db, issued[0]);
    expect(result.found).toBe(true);
    expect(result.giftPending).toBe(true); // 수령자 리딤 대기
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({
      product: 'yearly2026',
      status: 'paid',
      amount: 0,
      followupRemaining: 3,
    });

    const orderRows = await db.select().from(orders);
    expect(orderRows.every((o) => o.orderNo.startsWith('beta-') && o.amount === 0)).toBe(true);
  });
});
