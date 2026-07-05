/**
 * DB 클라이언트 싱글턴 — 호스팅 중립 (D-0-2: Postgres 이관).
 *
 * - 프로덕션/스테이징: DATABASE_URL(또는 POSTGRES_URL)로 표준 node-postgres Pool.
 *   Neon/Supabase/Vercel Postgres 모두 "pooled" 연결 문자열을 넣으면 서버리스에서 안전하다.
 * - 로컬 개발: DATABASE_URL이 없으면 PGlite(내장 Postgres, .pglite/ 파일 영속)로 폴백.
 *   OWNER가 호스팅을 고르기 전에도 전체 데이터 계층이 동작한다.
 * - 테스트: db/schema.test.ts가 인메모리 PGlite 인스턴스를 직접 만든다(이 모듈 미사용).
 */
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema.js';

export type Db =
  | NodePgDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

let dbSingleton: Db | null = null;

export function getDatabaseUrl(): string | undefined {
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  return url || undefined;
}

/** DB 구성 여부 — 미구성 시 API는 503으로 응답해야 한다(프로덕션에서 PGlite 폴백 금지). */
export function isDbConfigured(): boolean {
  return Boolean(getDatabaseUrl()) || process.env.NODE_ENV !== 'production';
}

export async function getDb(): Promise<Db> {
  if (dbSingleton) return dbSingleton;

  const url = getDatabaseUrl();
  if (url) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: url, max: 3 });
    dbSingleton = drizzleNodePg(pool, { schema });
    return dbSingleton;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL이 설정되지 않았습니다 — 프로덕션에서는 PGlite 폴백을 사용하지 않습니다.',
    );
  }

  // 로컬 개발 폴백: 파일 영속 PGlite + 마이그레이션 자동 적용
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite('./.pglite');
  const db = drizzlePglite(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  dbSingleton = db;
  return dbSingleton;
}
