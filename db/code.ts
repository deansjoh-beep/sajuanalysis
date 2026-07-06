/**
 * 사주 코드 체계 (IMPLEMENTATION_PLAN 2-3).
 *
 * - 발급기: XX-XXXXXX (접두 2자 + '-' + 6자). 혼동 문자 I·O·L·0·1 제외.
 *   충돌은 unique 제약 + 재시도로 처리한다.
 * - 조회/재열람(lookupCode): 코드 하나로 명식·주문·유효 리포트를 로드한다.
 *   만료 리포트는 본문을 내리지 않고(expires_at 읽기 경로 검사), 동일 상품
 *   무과금 재생성 대상(regenerable)으로 표시한다. 구매 이력이 있으면 새해
 *   리포트 10% 할인 플래그를 세운다.
 * - 선물 리딤(redeemGiftCode): myeongsik null인 미사용 코드에 수령자의 명식을 채운다.
 * - 후속 질문(consumeFollowup): 구매(주문)당 3회 — 원자적 차감으로 한도를 보장한다.
 */
import { randomInt } from 'node:crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import {
  assertNoPersonalKeys,
  codes,
  orders,
  reports,
  type MyeongsikParams,
} from './schema.js';

/** I, O, L, 0, 1 제외 — 육안 혼동 방지 */
export const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type CodeGenerator = () => string;

export function generateSajuCode(rand: (max: number) => number = randomInt): string {
  const pick = (n: number) =>
    Array.from({ length: n }, () => CODE_CHARSET[rand(CODE_CHARSET.length)]).join('');
  return `${pick(2)}-${pick(6)}`;
}

export interface IssueCodeOptions {
  /** 테스트용 생성기 주입 */
  generator?: CodeGenerator;
  maxAttempts?: number;
}

/**
 * 새 사주 코드 행을 발급한다. myeongsik=null이면 미사용 선물 코드.
 * 충돌(unique 위반) 시 새 코드로 재시도, maxAttempts 소진 시 throw.
 */
export async function issueCode(
  db: Db,
  myeongsik: MyeongsikParams | null,
  options: IssueCodeOptions = {},
): Promise<{ id: string; code: string }> {
  const { generator = generateSajuCode, maxAttempts = 5 } = options;

  if (myeongsik) {
    assertNoPersonalKeys(myeongsik as unknown as Record<string, unknown>);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generator();
    // 사전 조회 + unique 제약 이중 방어 (경합은 unique 위반 catch가 흡수)
    const [existing] = await db.select({ id: codes.id }).from(codes).where(eq(codes.code, code));
    if (existing) continue;

    try {
      const [row] = await db.insert(codes).values({ code, myeongsik }).returning();
      return { id: row.id, code: row.code };
    } catch (error: unknown) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  throw new Error(`사주 코드 발급 실패 — ${maxAttempts}회 연속 충돌`);
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return e?.code === '23505' || /duplicate key|unique/i.test(String(e?.message || ''));
}

// ─── 조회 / 재열람 ──────────────────────────────────────────────────────────

/** 후속 질문 한도 — 리포트 구매(주문)당 3회 (OWNER 확정안) */
export const FOLLOWUP_LIMIT = 3;

/** 재구매(새해 리포트) 할인율 — 구매 이력 보유 코드에 적용 */
export const NEW_YEAR_DISCOUNT_PERCENT = 10;

export interface CodeLookupResult {
  found: boolean;
  /** true면 아직 명식이 채워지지 않은 미사용 선물 코드 */
  giftPending: boolean;
  myeongsik: MyeongsikParams | null;
  orders: Array<{
    orderId: string;
    product: string;
    status: string;
    amount: number;
    followupRemaining: number;
    createdAt: Date;
  }>;
  /** 유효(미만료) 리포트만 본문 포함 */
  reports: Array<{
    reportId: string;
    product: string;
    content: string;
    createdAt: Date;
    expiresAt: Date;
  }>;
  /** 리포트가 만료된 생성 완료 주문 — 동일 상품 무과금 재생성 대상 */
  regenerable: Array<{ orderId: string; product: string }>;
  /** 구매 이력 보유 → 새해 리포트 10% 할인 */
  newYearDiscountPercent: number | null;
}

const EMPTY_LOOKUP: CodeLookupResult = {
  found: false,
  giftPending: false,
  myeongsik: null,
  orders: [],
  reports: [],
  regenerable: [],
  newYearDiscountPercent: null,
};

export async function lookupCode(db: Db, rawCode: string, now: Date = new Date()): Promise<CodeLookupResult> {
  const code = rawCode.trim().toUpperCase();
  const [codeRow] = await db.select().from(codes).where(eq(codes.code, code));
  if (!codeRow) return EMPTY_LOOKUP;

  const orderRows = await db.select().from(orders).where(eq(orders.codeId, codeRow.id));
  const reportRows = await db.select().from(reports).where(eq(reports.codeId, codeRow.id));

  const validReports = reportRows.filter((r) => r.expiresAt.getTime() > now.getTime());
  const validProducts = new Set(validReports.map((r) => r.product));

  // 생성 완료(generated)됐지만 유효 리포트가 없는 주문 → 무과금 재생성 대상
  const regenerable = orderRows
    .filter((o) => o.status === 'generated' && !validProducts.has(o.product))
    .map((o) => ({ orderId: o.id, product: o.product }));

  return {
    found: true,
    giftPending: codeRow.myeongsik === null,
    myeongsik: codeRow.myeongsik,
    orders: orderRows.map((o) => ({
      orderId: o.id,
      product: o.product,
      status: o.status,
      amount: o.amount,
      followupRemaining: Math.max(0, FOLLOWUP_LIMIT - o.followupUsed),
      createdAt: o.createdAt,
    })),
    reports: validReports.map((r) => ({
      reportId: r.id,
      product: r.product,
      content: r.content,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    })),
    regenerable,
    newYearDiscountPercent: orderRows.length > 0 ? NEW_YEAR_DISCOUNT_PERCENT : null,
  };
}

// ─── 선물 코드 리딤 ─────────────────────────────────────────────────────────

export type RedeemOutcome = 'redeemed' | 'not_found' | 'already_redeemed';

/**
 * 미사용 선물 코드에 수령자의 명식을 채운다.
 * UPDATE ... WHERE myeongsik IS NULL 원자 조건으로 이중 리딤을 차단한다.
 */
export async function redeemGiftCode(
  db: Db,
  rawCode: string,
  myeongsik: MyeongsikParams,
): Promise<RedeemOutcome> {
  assertNoPersonalKeys(myeongsik as unknown as Record<string, unknown>);
  const code = rawCode.trim().toUpperCase();

  const updated = await db
    .update(codes)
    .set({ myeongsik })
    .where(and(eq(codes.code, code), sql`${codes.myeongsik} IS NULL`))
    .returning();
  if (updated.length > 0) return 'redeemed';

  const [existing] = await db.select({ id: codes.id }).from(codes).where(eq(codes.code, code));
  return existing ? 'already_redeemed' : 'not_found';
}

// ─── 후속 질문 회수 차감 ────────────────────────────────────────────────────

export interface FollowupOutcome {
  ok: boolean;
  reason: 'consumed' | 'limit_exhausted' | 'order_not_found';
  remaining: number;
}

/**
 * 후속 질문 1회를 원자적으로 차감한다 (주문당 FOLLOWUP_LIMIT회).
 * orderId가 해당 code 소속인지 함께 검증한다 — 코드 소지가 곧 자격.
 */
export async function consumeFollowup(db: Db, rawCode: string, orderId: string): Promise<FollowupOutcome> {
  const code = rawCode.trim().toUpperCase();
  const [codeRow] = await db.select({ id: codes.id }).from(codes).where(eq(codes.code, code));
  if (!codeRow) return { ok: false, reason: 'order_not_found', remaining: 0 };

  const updated = await db
    .update(orders)
    .set({ followupUsed: sql`${orders.followupUsed} + 1` })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.codeId, codeRow.id),
        lt(orders.followupUsed, FOLLOWUP_LIMIT),
      ),
    )
    .returning();

  if (updated.length > 0) {
    return { ok: true, reason: 'consumed', remaining: Math.max(0, FOLLOWUP_LIMIT - updated[0].followupUsed) };
  }

  const [order] = await db
    .select({ followupUsed: orders.followupUsed })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.codeId, codeRow.id)));
  if (!order) return { ok: false, reason: 'order_not_found', remaining: 0 };
  return { ok: false, reason: 'limit_exhausted', remaining: 0 };
}
