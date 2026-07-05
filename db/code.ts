/**
 * 사주 코드 발급기 (IMPLEMENTATION_PLAN 2-3 선행분 — 결제(2-2)가 승인 시 코드를 발급해야 해서 함께 구현).
 *
 * 형식: XX-XXXXXX (접두 2자 + '-' + 6자). 혼동 문자 I·O·L·0·1 제외.
 * 충돌은 unique 제약 + 재시도로 처리한다.
 */
import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { assertNoPersonalKeys, codes, type MyeongsikParams } from './schema.js';

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
