/**
 * Phase 2-1 데이터 계층 테스트.
 *
 * - DoD: "DB에 개인 식별 컬럼 부재를 확인하는 스키마 테스트 존재" — 아래 PII 스위트가 담당.
 * - purge 동작(연쇄 파기·만료 삭제)은 인메모리 PGlite에 실제 마이그레이션 SQL을
 *   적용해 검증한다(drizzle/ 산출물 자체의 무결성도 함께 담보).
 */
import { PGlite } from '@electric-sql/pglite';
import { getTableColumns, sql } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from './schema.ts';
import {
  assertNoPersonalKeys,
  codes,
  orders,
  reports,
  REPORT_TTL_HOURS,
  type MyeongsikParams,
} from './schema.ts';
import { CODE_PATTERN, purgeByCode, purgeExpiredReports } from './purge.ts';

// ─── PII 컬럼 부재 (스키마 테스트) ──────────────────────────────────────────

/** 개인 식별로 이어질 수 있는 컬럼명 조각 — 어떤 테이블에도 존재해서는 안 된다 */
const FORBIDDEN_COLUMN_FRAGMENTS = [
  'name',
  'email',
  'phone',
  'tel',
  'address',
  'birth', // 생년월일시 원문 컬럼 금지 (명식은 myeongsik JSONB의 간지·연도 파라미터로만)
  'ssn',
  'user',
  'ip',
];

describe('스키마 — 개인 식별 컬럼 금지 원칙', () => {
  const tables = { codes, orders, reports };

  for (const [tableName, table] of Object.entries(tables)) {
    it(`${tableName} 테이블에 개인 식별 컬럼이 없다`, () => {
      const columns = getTableColumns(table);
      for (const column of Object.values(columns)) {
        const sqlName = column.name.toLowerCase();
        for (const fragment of FORBIDDEN_COLUMN_FRAGMENTS) {
          expect(sqlName, `${tableName}.${column.name}`).not.toContain(fragment);
        }
      }
    });
  }

  it('마이그레이션 SQL에도 개인 식별 컬럼 정의가 없다', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = './drizzle';
    const sqlFiles = fs.readdirSync(dir).filter((f: string) => f.endsWith('.sql'));
    expect(sqlFiles.length).toBeGreaterThan(0);
    for (const file of sqlFiles) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8').toLowerCase();
      const columnDefs = content.match(/"[a-z_]+"\s+(varchar|text|jsonb|integer|uuid|timestamp)/g) ?? [];
      for (const def of columnDefs) {
        for (const fragment of FORBIDDEN_COLUMN_FRAGMENTS) {
          expect(def, `${file}: ${def}`).not.toContain(`"${fragment}`);
        }
      }
    }
  });
});

describe('assertNoPersonalKeys — myeongsik JSONB 런타임 가드', () => {
  const validMyeongsik: MyeongsikParams = {
    pillars: { year: '갑진', month: '병인', day: '정미', hour: '경자' },
    gender: 'male',
    daeunsu: 3,
    daeunDirection: 'forward',
    birthYear: 1990,
    timeUnknown: false,
  };

  it('정상 명식 파라미터는 통과한다', () => {
    expect(() => assertNoPersonalKeys(validMyeongsik as unknown as Record<string, unknown>)).not.toThrow();
  });

  it('최상위 개인 식별 키를 거부한다', () => {
    expect(() => assertNoPersonalKeys({ ...validMyeongsik, name: '홍길동' } as unknown as Record<string, unknown>)).toThrow(/개인 식별/);
    expect(() => assertNoPersonalKeys({ ...validMyeongsik, email: 'a@b.c' } as unknown as Record<string, unknown>)).toThrow(/개인 식별/);
  });

  it('중첩된 개인 식별 키도 거부한다', () => {
    const nested = { ...validMyeongsik, extra: { contact: { phone: '010-0000-0000' } } };
    expect(() => assertNoPersonalKeys(nested as unknown as Record<string, unknown>)).toThrow(/개인 식별/);
  });

  it('birthDate 등 표기 변형도 거부한다', () => {
    expect(() => assertNoPersonalKeys({ ...validMyeongsik, birthDate: '1990-01-01' } as unknown as Record<string, unknown>)).toThrow(/개인 식별/);
    expect(() => assertNoPersonalKeys({ ...validMyeongsik, birth_time: '23:30' } as unknown as Record<string, unknown>)).toThrow(/개인 식별/);
  });
});

// ─── purge 동작 (인메모리 PGlite + 실제 마이그레이션) ───────────────────────

describe('purge — 연쇄 파기·만료 삭제', () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const myeongsik: MyeongsikParams = {
    pillars: { year: '갑진', month: '병인', day: '정미', hour: null },
    gender: 'female',
    daeunsu: 7,
    daeunDirection: 'backward',
    birthYear: 1985,
    timeUnknown: true,
  };

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
  });

  afterAll(async () => {
    await client.close();
  });

  async function seedCode(codeStr: string) {
    const [codeRow] = await db.insert(codes).values({ code: codeStr, myeongsik }).returning();
    const [order] = await db
      .insert(orders)
      .values({ orderNo: `order-${codeStr}`, codeId: codeRow.id, product: 'yearly2026', amount: 49000 })
      .returning();
    const [report] = await db
      .insert(reports)
      .values({ codeId: codeRow.id, orderId: order.id, product: 'yearly2026', content: '리포트 본문' })
      .returning();
    return { codeRow, order, report };
  }

  it('CODE_PATTERN이 표준 코드 형식을 수용한다', () => {
    expect(CODE_PATTERN.test('HW-3F9K2A')).toBe(true);
    expect(CODE_PATTERN.test('hw-3f9k2a')).toBe(false); // normalizeCode 후 사용 전제
    expect(CODE_PATTERN.test('HW3F9K2A')).toBe(false);
    expect(CODE_PATTERN.test("HW-3F9'; DROP TABLE codes;--")).toBe(false);
  });

  it('purgeByCode: codes 삭제가 orders·reports로 연쇄된다 (복구 불가 하드 삭제)', async () => {
    await seedCode('AA-111111');
    // 같은 코드에 주문·리포트 1건씩 추가 (총 2건씩)
    const [codeRow] = await db.select().from(codes).where(sql`${codes.code} = 'AA-111111'`);
    const [order2] = await db
      .insert(orders)
      .values({ orderNo: 'order-AA-2', codeId: codeRow.id, product: 'jobCareer', amount: 39000 })
      .returning();
    await db.insert(reports).values({ codeId: codeRow.id, orderId: order2.id, product: 'jobCareer', content: '두 번째 본문' });

    const result = await purgeByCode(db, 'aa-111111'); // 소문자 입력도 normalize
    expect(result).toEqual({ found: true, ordersPurged: 2, reportsPurged: 2 });

    expect(await db.select().from(codes)).toHaveLength(0);
    expect(await db.select().from(orders)).toHaveLength(0);
    expect(await db.select().from(reports)).toHaveLength(0);
  });

  it('purgeByCode: 존재하지 않는 코드는 found=false', async () => {
    const result = await purgeByCode(db, 'ZZ-999999');
    expect(result).toEqual({ found: false, ordersPurged: 0, reportsPurged: 0 });
  });

  it('purgeByCode: 다른 코드의 데이터는 건드리지 않는다', async () => {
    await seedCode('BB-222222');
    await seedCode('CC-333333');

    const result = await purgeByCode(db, 'BB-222222');
    expect(result.found).toBe(true);

    const remaining = await db.select().from(codes);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].code).toBe('CC-333333');
    expect(await db.select().from(orders)).toHaveLength(1);
    expect(await db.select().from(reports)).toHaveLength(1);

    await purgeByCode(db, 'CC-333333'); // 정리
  });

  it('reports.expires_at 기본값은 생성 시점 + 72시간이다', async () => {
    const { report } = await seedCode('DD-444444');
    const ttlMs = report.expiresAt.getTime() - report.createdAt.getTime();
    expect(ttlMs).toBe(REPORT_TTL_HOURS * 3600 * 1000);
    await purgeByCode(db, 'DD-444444'); // 정리
  });

  it('purgeExpiredReports: 만료분만 삭제하고 유효분은 남긴다', async () => {
    const { codeRow, order } = await seedCode('EE-555555'); // 유효 리포트 1건 포함
    await db.insert(reports).values({
      codeId: codeRow.id,
      orderId: order.id,
      product: 'loveMarriage',
      content: '만료된 본문',
      expiresAt: new Date(Date.now() - 1000),
    });

    const purged = await purgeExpiredReports(db);
    expect(purged).toBe(1);

    const remaining = await db.select().from(reports);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].content).toBe('리포트 본문');
  });
});
