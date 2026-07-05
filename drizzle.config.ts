import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // 마이그레이션 적용(push/migrate) 시에만 필요. generate는 오프라인 동작.
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  },
});
