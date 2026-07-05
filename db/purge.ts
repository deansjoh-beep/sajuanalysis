/**
 * 파기 로직 (IMPLEMENTATION_PLAN 2-1) — server.ts(Express)와 api/purge.ts(Vercel)가 공유.
 *
 * - purgeByCode: 즉시 삭제 API의 본체. codes 행 하드 삭제 → FK cascade로
 *   orders·reports 연쇄 파기. 복구 불가.
 * - purgeExpiredReports: 만료 크론의 본체. expires_at 경과 리포트 물리 삭제.
 *   (Hobby 플랜 크론은 1일 1회 정밀도이므로, 읽기 경로에서도 expires_at을
 *   반드시 검사해 72시간을 논리적으로 보장할 것)
 */
import { count, eq, lte } from 'drizzle-orm';
import type { Db } from './client.js';
import { codes, orders, reports } from './schema.js';

export interface PurgeByCodeResult {
  found: boolean;
  ordersPurged: number;
  reportsPurged: number;
}

/** 사주 코드 형식: 영숫자 2자 + '-' + 영숫자 6자 (예: HW-3F9K2A). 혼동 문자 검증은 발급기(2-3) 소관. */
export const CODE_PATTERN = /^[A-Z0-9]{2}-[A-Z0-9]{6}$/;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function purgeByCode(db: Db, rawCode: string): Promise<PurgeByCodeResult> {
  const code = normalizeCode(rawCode);

  const [codeRow] = await db
    .select({ id: codes.id })
    .from(codes)
    .where(eq(codes.code, code));

  if (!codeRow) {
    return { found: false, ordersPurged: 0, reportsPurged: 0 };
  }

  const [{ value: orderCount }] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.codeId, codeRow.id));
  const [{ value: reportCount }] = await db
    .select({ value: count() })
    .from(reports)
    .where(eq(reports.codeId, codeRow.id));

  // codes 하드 삭제 → onDelete: 'cascade'로 orders·reports 연쇄 파기
  await db.delete(codes).where(eq(codes.id, codeRow.id));

  return { found: true, ordersPurged: orderCount, reportsPurged: reportCount };
}

export async function purgeExpiredReports(db: Db, now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(reports)
    .where(lte(reports.expiresAt, now))
    .returning();
  return deleted.length;
}
