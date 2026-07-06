/**
 * 베타 무료 코드 일괄 발급 스크립트 (IMPLEMENTATION_PLAN 3-2).
 *
 * 사용:
 *   npx tsx scripts/issue-beta-codes.ts [--count 300] [--product yearly2026] [--out FILE]
 *
 * - DATABASE_URL 설정 시 해당 DB(Neon 프로덕션 등), 미설정 시 로컬 PGlite(.pglite/).
 *   ⚠️ 프로덕션 발급은 DATABASE_URL을 명시해 실행할 것.
 * - 출력: CSV(code 열) — 기본 bench-output/beta-codes-<타임스탬프>.csv (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/client.ts';
import { issueBetaCodes } from '../db/beta.ts';
import { isPaidProduct } from '../db/payment.ts';

const args = process.argv.slice(2);
const getArg = (name: string, fallback: string): string => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};

const count = Math.max(1, Math.min(1000, Number(getArg('count', '300'))));
const product = getArg('product', 'yearly2026');
if (!isPaidProduct(product)) {
  console.error(`알 수 없는 상품: ${product} (premium|yearly2026|jobCareer|loveMarriage)`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = getArg('out', path.join('bench-output', `beta-codes-${stamp}.csv`));

const db = await getDb();
console.log(`베타 코드 ${count}건 발급 시작 — 상품: ${product}, DB: ${process.env.DATABASE_URL ? '외부(DATABASE_URL)' : '로컬 PGlite'}`);

const { codes } = await issueBetaCodes(db, count, product, (n) => console.log(`  ...${n}/${count}`));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `code\n${codes.join('\n')}\n`, 'utf-8');

console.log(`완료: ${codes.length}건 발급 → ${outFile}`);
console.log(`예시: ${codes.slice(0, 3).join(', ')} ...`);
process.exit(0);
