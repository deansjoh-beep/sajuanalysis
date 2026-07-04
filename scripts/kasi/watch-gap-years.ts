/**
 * KASI 공백구간(1900~1999, 2029~2030) 절기 감시 (Phase 1-1)
 *
 * KASI Open API는 2000~2028년만 제공한다. 공백구간에서 엔진의 1차 절기 기준인
 * lunar-javascript가 정상 범위인지, 독립 천문계산(jieqi-astro, Meeus ±14분)으로
 * 전 절(節)을 대조해 감시한다.
 *
 * 판정 기준: |lunar − astro| ≤ WATCH_THRESHOLD_MIN(30분)이면 정상.
 *   - jieqi-astro 자체 정밀도(±14분) + lunar 오차 여유를 합친 상한.
 *   - KASI에서 발견된 유형의 오류(수십 분~수 시간)는 이 임계로 확실히 걸러진다.
 *
 * 실행: npx tsx scripts/kasi/watch-gap-years.ts
 */

import { Solar } from 'lunar-javascript';
import { getSolarTermsForYear } from '../../src/lib/manseryeok/jieqi-astro';

const KO_TO_CN: Record<string, string> = {
  소한: '小寒', 입춘: '立春', 경칩: '惊蛰', 청명: '清明', 입하: '立夏', 망종: '芒种',
  소서: '小暑', 입추: '立秋', 백로: '白露', 한로: '寒露', 입동: '立冬', 대설: '大雪',
};

const WATCH_THRESHOLD_MIN = 30;

/** lunar-javascript 절기 Solar(베이징 벽시계) → UTC millis */
const lunarSolarToUtcMs = (s: any): number =>
  Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond()) -
  8 * 3600 * 1000;

const GAP_YEARS = [
  ...Array.from({ length: 100 }, (_, i) => 1900 + i),
  2029,
  2030,
];

const main = () => {
  const deltas: number[] = [];
  const outliers: Array<{ year: number; name: string; deltaMin: number }> = [];
  let unmatched = 0;

  for (const year of GAP_YEARS) {
    const astroJeol = getSolarTermsForYear(year).filter((t) => t.isMonthBoundary);
    for (const a of astroJeol) {
      const cn = KO_TO_CN[a.name];
      const [y, mo, d] = a.kstDate.split('-').map(Number);
      const table = Solar.fromYmd(y, mo, d).getLunar().getJieQiTable();
      const s = table[cn];
      if (!s) {
        unmatched++;
        continue;
      }
      const lunarMs = lunarSolarToUtcMs(s);
      if (Math.abs(lunarMs - a.utc.getTime()) > 3 * 86400000) {
        unmatched++;
        continue; // 다른 해 occurrence
      }
      const deltaMin = (lunarMs - a.utc.getTime()) / 60000;
      deltas.push(deltaMin);
      if (Math.abs(deltaMin) > WATCH_THRESHOLD_MIN) {
        outliers.push({ year, name: a.name, deltaMin: Math.round(deltaMin * 100) / 100 });
      }
    }
  }

  const abs = deltas.map(Math.abs).sort((x, y) => x - y);
  const mean = abs.reduce((s, x) => s + x, 0) / abs.length;
  const pct = (p: number) => abs[Math.min(abs.length - 1, Math.floor((p / 100) * abs.length))];

  console.log('===== KASI 공백구간 감시: lunar-javascript vs jieqi-astro (절 전수) =====');
  console.log(`대상: ${GAP_YEARS[0]}~1999 + 2029~2030, 절(節) ${deltas.length}건 (매칭실패 ${unmatched}건)`);
  console.log(`|오차|: 평균 ${mean.toFixed(2)}분 | 중앙 ${pct(50).toFixed(2)} | p99 ${pct(99).toFixed(2)} | 최대 ${abs[abs.length - 1].toFixed(2)}분`);
  console.log(`임계(${WATCH_THRESHOLD_MIN}분) 초과: ${outliers.length}건`);
  for (const o of outliers.slice(0, 30)) {
    console.log(`  ${o.year} ${o.name}: ${o.deltaMin >= 0 ? '+' : ''}${o.deltaMin}분`);
  }
  console.log(
    outliers.length === 0
      ? '\n판정: 공백구간에서 lunar-javascript 절기 시각에 이상 징후 없음 → 1차 기준으로 사용 가능.'
      : '\n판정: 임계 초과 건 존재 — 개별 확인 필요.',
  );
  process.exit(outliers.length > 0 ? 1 : 0);
};

main();
