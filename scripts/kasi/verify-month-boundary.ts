/**
 * 엔진 월주(月柱) 절입 경계 정확도 하네스 (Phase 1-1, 2단계)
 *
 * KASI 절입 시각(KST)을 권위 기준으로, 엔진(getSajuData)이 절입 경계에서 월주를
 * 언제 전환하는지 실측한다. 올바른 경계는 절입_KST 그 순간이어야 한다
 * (진태양시 보정을 출생·절입에 동일 적용하면 상쇄되어 경계는 KST 절입 시각과 같음).
 *
 * 각 절(節) 주변 ±분 단위로 출생 시각을 스캔해 월주 지지가 바뀌는 지점(flip)을 찾고,
 * 그 지점이 절입_KST에서 얼마나 벗어나는지(offset, 분)를 집계한다.
 *   - flip offset ≈ 0 이면 정확.
 *   - flip offset ≈ -28분(EOT 포함)이면 "출생만 진태양시·절기는 베이징시" 혼합버그.
 *
 * 실행: npx tsx scripts/kasi/verify-month-boundary.ts
 */

import { DateTime } from 'luxon';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSajuData } from '../../src/utils/saju';

const dir = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(dir, '../../src/lib/manseryeok/data/kasi-jieqi.json'), 'utf-8'));

/** KASI 자체 데이터 오류(독립 천문계산·lunar로 확인) — 정확도 지표에서 제외 */
const KNOWN_KASI_ERRORS = new Set(['2011|입동']);

type Term = { name: string; date: string; time: string; isMonthBoundary: boolean };
const jeol: Term[] = (data.terms as Term[]).filter((t) => t.isMonthBoundary);

/** 절입의 권위 KST 순간(KASI, luxon DateTime, Asia/Seoul) */
const authoritativeKst = (t: Term): DateTime => {
  const [y, mo, d] = t.date.split('-').map(Number);
  const [hh, mm] = t.time.split(':').map(Number);
  return DateTime.fromObject({ year: y, month: mo, day: d, hour: hh, minute: mm }, { zone: 'Asia/Seoul' });
};

/** 특정 KST 순간의 출생 월주 지지(한자) */
const monthBranchAt = (kst: DateTime): string | null => {
  const dateStr = kst.toFormat('yyyy-MM-dd');
  const timeStr = kst.toFormat('HH:mm');
  try {
    const res = getSajuData(dateStr, timeStr, false, false, false, 'Asia/Seoul');
    // 반환 [시주, 일주, 월주, 년주]
    return res[2]?.branch?.hanja ?? null;
  } catch {
    return null;
  }
};

/**
 * 절입 주변에서 월주 지지가 바뀌는 flip offset(분)을 이분법으로 탐색.
 * 스캔창 [-90, +30]분. 창 양끝의 지지가 다르면 그 사이를 이분해 1분 해상도로 flip 지점 특정.
 */
const findFlipOffsetMin = (base: DateTime): number | null => {
  const lo = -90;
  const hi = 30;
  const branchLo = monthBranchAt(base.plus({ minutes: lo }));
  const branchHi = monthBranchAt(base.plus({ minutes: hi }));
  if (!branchLo || !branchHi || branchLo === branchHi) return null; // 창 안에서 전환 없음
  let a = lo;
  let b = hi;
  // a는 branchLo, b는 branchHi 유지하며 1분까지 좁힘
  while (b - a > 1) {
    const mid = Math.floor((a + b) / 2);
    const bm = monthBranchAt(base.plus({ minutes: mid }));
    if (bm === branchLo) a = mid;
    else b = mid;
  }
  return b; // 전환이 처음 일어난 offset(분)
};

const main = () => {
  const offsets: number[] = [];
  let noFlip = 0;
  const samples: Array<{ key: string; offset: number }> = [];

  const outliers: Array<{ key: string; offset: number }> = [];
  for (const t of jeol) {
    const key = `${t.date.slice(0, 4)}|${t.name}`;
    if (KNOWN_KASI_ERRORS.has(key)) continue; // KASI 값이 틀린 절은 지표 제외
    const base = authoritativeKst(t);
    const off = findFlipOffsetMin(base);
    if (off === null) {
      noFlip++;
      continue;
    }
    offsets.push(off);
    if (samples.length < 12) samples.push({ key, offset: off });
    if (Math.abs(off) > 2) outliers.push({ key, offset: off });
  }

  offsets.sort((a, b) => a - b);
  const mean = offsets.reduce((s, x) => s + x, 0) / offsets.length;
  const median = offsets[Math.floor(offsets.length / 2)];
  const within2 = offsets.filter((x) => Math.abs(x) <= 2).length;

  console.log('===== 엔진 월주 절입 경계 정확도 (절 348건 기준) =====');
  console.log(`측정: ${offsets.length}건 / 창내 전환없음: ${noFlip}건`);
  console.log(`flip offset(분, 절입_KST 대비 +늦음/−이름):`);
  console.log(`  평균: ${mean.toFixed(2)} | 중앙: ${median} | 최소: ${offsets[0]} | 최대: ${offsets[offsets.length - 1]}`);
  console.log(`  |offset|≤2분(정확): ${within2}/${offsets.length} (${((100 * within2) / offsets.length).toFixed(1)}%)`);
  console.log('\n샘플 12건:');
  for (const s of samples) console.log(`  ${s.key}: flip @ ${s.offset >= 0 ? '+' : ''}${s.offset}분`);
  if (outliers.length > 0) {
    console.log(`\n|offset|>2분 이상치 ${outliers.length}건:`);
    for (const o of outliers.slice(0, 20)) console.log(`  ${o.key}: ${o.offset >= 0 ? '+' : ''}${o.offset}분`);
  }
  console.log('\n해석: |offset|≤2분이 100%면 절입 경계가 실제 절입_KST와 일치(수정 완료).');
};

main();
