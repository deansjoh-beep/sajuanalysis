/**
 * 핵심 훅(hookEngine) 희소성 통계 사전계산 스크립트.
 *
 * 실제 만세력 엔진(getSajuData)으로 1944~2005년 출생일을 7일 간격 × 12시진
 * (짝수시 정각 = 시진 중앙값) 표본으로 돌리고, 훅 엔진과 **동일한 특징 추출기**
 * (src/lib/hookEngine.ts::extractHookFeatures)로 각 특징의 인구 비율(%)을 계산해
 * `src/constants/hookStats.ts`를 생성한다.
 *
 * 실행: npx tsx scripts/compute-hook-stats.ts
 *
 * - 표본 날짜 간격 7일은 60갑자와 서로소 → 일주 분포 비편향.
 * - "시간 미상" 사용자용 통계는 같은 표본에서 시주를 '?'로 가린 변형으로 산출
 *   (실서비스 unknownTime과 동일한 형태 → calculateYongshin 편향까지 동일하게 반영).
 * - 결과는 결정론적(표본 고정)이며, 재실행 시 동일 파일이 생성된다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSajuData } from '../src/utils/saju';
import { extractHookFeatures, type HookFeatures } from '../src/lib/hookEngine';

const START_YEAR = 1944;
const END_YEAR = 2005;
const DAY_STEP = 7;
const HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

const MASKED_HOUR_PILLAR = {
  title: '시주',
  stem: { hanja: '?', hangul: '?', element: '', deity: '' },
  branch: { hanja: '?', hangul: '?', element: '', deity: '', hidden: '' },
};

interface Bucket {
  n: number;
  strength: Record<string, number>;
  maxElement4: number;      // 동일 오행 4개 이상
  maxElement5: number;      // 동일 오행 5개 이상
  missing1: number;         // 오행 결핍 1개 이상
  missing2: number;         // 오행 결핍 2개 이상
  jaeDaShinYak: number;     // 재성>=3 & 신약측
  gwanDaShinYak: number;    // 관성>=3 & 신약측
  siksangDaShinYak: number; // 식상>=3 & 신약측
  inDaShinGang: number;     // 인성>=3 & 신강측
  gunGeopJaengJae: number;  // 비겁>=3 & 재성>=1 & 신강측
  chung2: number;           // 원국 지지 충 2쌍 이상(전체 쌍)
  yanginPresent: number;    // 일간 양인 지지가 원국에 존재
  cheoneul2: number;        // 천을귀인 2개 이상
  goegangDay: number;       // 괴강 일주
  goegangYangin: number;    // 괴강 일주 + 양인 동시
  gwimunAdjacent: number;   // 인접 지지 귀문 1쌍 이상
  wonjinAdjacent: number;   // 인접 지지 원진 1쌍 이상
}

const newBucket = (): Bucket => ({
  n: 0,
  strength: { 극신강: 0, 신강: 0, 중립: 0, 신약: 0, 극신약: 0 },
  maxElement4: 0, maxElement5: 0, missing1: 0, missing2: 0,
  jaeDaShinYak: 0, gwanDaShinYak: 0, siksangDaShinYak: 0,
  inDaShinGang: 0, gunGeopJaengJae: 0,
  chung2: 0, yanginPresent: 0, cheoneul2: 0,
  goegangDay: 0, goegangYangin: 0, gwimunAdjacent: 0, wonjinAdjacent: 0,
});

function collect(f: HookFeatures, b: Bucket) {
  b.n++;
  b.strength[f.strength] = (b.strength[f.strength] ?? 0) + 1;
  const isWeak = f.strength === '신약' || f.strength === '극신약';
  const isStrong = f.strength === '신강' || f.strength === '극신강';

  if (f.maxElementCount >= 4) b.maxElement4++;
  if (f.maxElementCount >= 5) b.maxElement5++;
  if (f.missingElementCount >= 1) b.missing1++;
  if (f.missingElementCount >= 2) b.missing2++;

  if (f.groupCount.재성 >= 3 && isWeak) b.jaeDaShinYak++;
  if (f.groupCount.관성 >= 3 && isWeak) b.gwanDaShinYak++;
  if (f.groupCount.식상 >= 3 && isWeak) b.siksangDaShinYak++;
  if (f.groupCount.인성 >= 3 && isStrong) b.inDaShinGang++;
  if (f.groupCount.비겁 >= 3 && f.groupCount.재성 >= 1 && isStrong) b.gunGeopJaengJae++;

  if (f.chungPairs >= 2) b.chung2++;
  if (f.yanginPresent) b.yanginPresent++;
  if (f.cheoneulCount >= 2) b.cheoneul2++;
  if (f.goegangDay) b.goegangDay++;
  if (f.goegangDay && f.yanginPresent) b.goegangYangin++;
  if (f.gwimunAdjacent >= 1) b.gwimunAdjacent++;
  if (f.wonjinAdjacent >= 1) b.wonjinAdjacent++;
}

function run() {
  const full = newBucket();
  const noHour = newBucket();
  const t0 = Date.now();

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const start = Date.UTC(year, 0, 1);
    const end = Date.UTC(year, 11, 31);
    for (let ms = start; ms <= end; ms += DAY_STEP * 86400000) {
      const d = new Date(ms);
      const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      for (const h of HOURS) {
        const timeStr = `${String(h).padStart(2, '0')}:00`;
        const saju = getSajuData(dateStr, timeStr, false, false);
        const f = extractHookFeatures(saju);
        if (f) collect(f, full);
        // 시간 미상 변형은 시진과 무관 → 날짜당 1회만 집계
        if (h === 0) {
          const masked = [MASKED_HOUR_PILLAR, saju[1], saju[2], saju[3]];
          const mf = extractHookFeatures(masked);
          if (mf) collect(mf, noHour);
        }
      }
    }
    if ((year - START_YEAR) % 10 === 9) {
      console.log(`  ...${year} 완료 (${Date.now() - t0}ms, full n=${full.n})`);
    }
  }

  const pct = (num: number, den: number) => Math.round((num / den) * 10000) / 100;
  const toStats = (b: Bucket) => ({
    sampleSize: b.n,
    strengthPct: Object.fromEntries(Object.entries(b.strength).map(([k, v]) => [k, pct(v, b.n)])),
    maxElement4Pct: pct(b.maxElement4, b.n),
    maxElement5Pct: pct(b.maxElement5, b.n),
    missing1Pct: pct(b.missing1, b.n),
    missing2Pct: pct(b.missing2, b.n),
    jaeDaShinYakPct: pct(b.jaeDaShinYak, b.n),
    gwanDaShinYakPct: pct(b.gwanDaShinYak, b.n),
    siksangDaShinYakPct: pct(b.siksangDaShinYak, b.n),
    inDaShinGangPct: pct(b.inDaShinGang, b.n),
    gunGeopJaengJaePct: pct(b.gunGeopJaengJae, b.n),
    chung2Pct: pct(b.chung2, b.n),
    yanginPresentPct: pct(b.yanginPresent, b.n),
    cheoneul2Pct: pct(b.cheoneul2, b.n),
    goegangDayPct: pct(b.goegangDay, b.n),
    goegangYanginPct: pct(b.goegangYangin, b.n),
    gwimunAdjacentPct: pct(b.gwimunAdjacent, b.n),
    wonjinAdjacentPct: pct(b.wonjinAdjacent, b.n),
  });

  const stats = {
    generatedBy: 'scripts/compute-hook-stats.ts',
    sample: `${START_YEAR}-01-01 ~ ${END_YEAR}-12-31, ${DAY_STEP}일 간격 × 12시진`,
    /** 생시를 아는 사주(8글자) 기준 통계 */
    withHour: toStats(full),
    /** 시간 미상(6글자, 시주 제외) 기준 통계 */
    withoutHour: toStats(noHour),
  };

  const out = `/**
 * 핵심 훅 희소성 통계 — 자동 생성 파일. 직접 수정 금지.
 *
 * 재생성: npx tsx scripts/compute-hook-stats.ts
 * 표본: ${stats.sample} (실제 만세력 엔진 산출, n=${full.n.toLocaleString()})
 */
export const HOOK_STATS = ${JSON.stringify(stats, null, 2)} as const;
`;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(__dirname, '../src/constants/hookStats.ts');
  fs.writeFileSync(outPath, out, 'utf8');
  console.log(`완료: ${outPath} (full n=${full.n}, noHour n=${noHour.n}, ${Date.now() - t0}ms)`);
}

run();
