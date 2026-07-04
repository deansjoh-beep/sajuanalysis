/**
 * KASI 기준 vs lunar-javascript 절기 시각 정확도 실측 (Phase 1-1)
 *
 * src/lib/manseryeok/data/kasi-jieqi.json 의 절(節, 월경계) 348건을 기준으로,
 * 엔진이 사용하는 lunar-javascript의 절기 계산 시각과의 오차를 분(minute) 단위로 집계한다.
 *
 * 핵심 검증: lunar-javascript가 절기 시각을 어느 표준시로 반환하는가?
 *   - 가설: 베이징시(UTC+8). KASI는 KST(UTC+9).
 *   - 두 해석(UTC+8, UTC+9)으로 KASI UTC 순간과의 오차를 각각 계산해 어느 쪽이 0에 수렴하는지 판정.
 *
 * 실행: npx tsx scripts/kasi/compare-jieqi.ts
 */

import { Solar } from 'lunar-javascript';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '../../src/lib/manseryeok/data/kasi-jieqi.json');

/** KASI(한국어) 절기명 → lunar-javascript(중국 간체) 절기명 */
const KO_TO_CN: Record<string, string> = {
  소한: '小寒', 대한: '大寒', 입춘: '立春', 우수: '雨水', 경칩: '惊蛰', 춘분: '春分',
  청명: '清明', 곡우: '谷雨', 입하: '立夏', 소만: '小满', 망종: '芒种', 하지: '夏至',
  소서: '小暑', 대서: '大暑', 입추: '立秋', 처서: '处暑', 백로: '白露', 추분: '秋分',
  한로: '寒露', 상강: '霜降', 입동: '立冬', 소설: '小雪', 대설: '大雪', 동지: '冬至',
};

type JieqiRecord = {
  name: string;
  date: string;
  time: string;
  datetimeKST: string;
  sunLongitude: number | null;
  isMonthBoundary: boolean;
};

/** lunar-javascript Solar 객체 → wall-clock 필드를 UTC millis로 (지정 offset시간대로 해석) */
const solarToUtcMs = (s: any, tzOffsetHours: number): number =>
  Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond()) -
  tzOffsetHours * 3600 * 1000;

/** KASI record(KST wall-clock) → UTC millis */
const kasiToUtcMs = (r: JieqiRecord): number => {
  const [y, mo, d] = r.date.split('-').map(Number);
  const [hh, mm] = r.time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, hh, mm, 0) - 9 * 3600 * 1000; // KST = UTC+9
};

/** 특정 KASI record에 대응하는 lunar-javascript 절기 Solar를 찾아 반환 */
const findLunarJieqi = (r: JieqiRecord): any | null => {
  const cn = KO_TO_CN[r.name];
  if (!cn) return null;
  const [y, mo, d] = r.date.split('-').map(Number);
  // 해당 절기 날짜에서 Lunar를 만들어 절기표 조회. 반환 Solar가 KASI 날짜와 ±3일 이내인지로 동일 occurrence 확인.
  const table = Solar.fromYmd(y, mo, d).getLunar().getJieQiTable();
  const s = table[cn];
  if (!s) return null;
  const solarMs = Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay());
  const recMs = Date.UTC(y, mo - 1, d);
  if (Math.abs(solarMs - recMs) > 3 * 86400000) return null; // 다른 해 occurrence
  return s;
};

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

const summarize = (label: string, deltasMin: number[]) => {
  const abs = deltasMin.map(Math.abs).sort((a, b) => a - b);
  const mean = abs.reduce((s, x) => s + x, 0) / abs.length;
  console.log(`\n[${label}] n=${abs.length}`);
  console.log(`  평균 |오차|: ${mean.toFixed(2)}분`);
  console.log(`  중앙값: ${percentile(abs, 50).toFixed(2)}분 / p90: ${percentile(abs, 90).toFixed(2)}분 / p99: ${percentile(abs, 99).toFixed(2)}분 / 최대: ${abs[abs.length - 1].toFixed(2)}분`);
  const within1 = abs.filter((x) => x <= 1).length;
  const within5 = abs.filter((x) => x <= 5).length;
  console.log(`  ≤1분: ${within1}/${abs.length} (${((100 * within1) / abs.length).toFixed(1)}%) | ≤5분: ${within5}/${abs.length} (${((100 * within5) / abs.length).toFixed(1)}%)`);
};

const main = () => {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  const records: JieqiRecord[] = data.terms;
  // 절(節, 월경계) 348건만 검증 대상(월주 경계 = 실사용). 필요시 전체로 확장 가능.
  const jeol = records.filter((r) => r.isMonthBoundary);

  const deltaUtc8: number[] = []; // lunar를 UTC+8로 해석했을 때 오차(분)
  const deltaUtc9: number[] = []; // lunar를 UTC+9로 해석했을 때 오차(분)
  const worst: Array<{ name: string; date: string; kasi: string; lunar: string; deltaMin8: number }> = [];
  let unmatched = 0;

  for (const r of jeol) {
    const s = findLunarJieqi(r);
    if (!s) {
      unmatched++;
      continue;
    }
    const kasiMs = kasiToUtcMs(r);
    const d8 = (solarToUtcMs(s, 8) - kasiMs) / 60000;
    const d9 = (solarToUtcMs(s, 9) - kasiMs) / 60000;
    deltaUtc8.push(d8);
    deltaUtc9.push(d9);
    worst.push({
      name: r.name,
      date: r.date,
      kasi: r.time,
      lunar: `${String(s.getHour()).padStart(2, '0')}:${String(s.getMinute()).padStart(2, '0')}`,
      deltaMin8: d8,
    });
  }

  console.log('===== KASI vs lunar-javascript 절기 시각 오차 (절 348건 기준) =====');
  console.log(`매칭: ${deltaUtc8.length}건 / 미매칭: ${unmatched}건`);
  summarize('lunar를 UTC+8(베이징시)로 해석', deltaUtc8);
  summarize('lunar를 UTC+9(KST)로 해석', deltaUtc9);

  // UTC+8 해석 기준 오차 상위 10건
  const top = [...worst].sort((a, b) => Math.abs(b.deltaMin8) - Math.abs(a.deltaMin8)).slice(0, 10);
  console.log('\n----- UTC+8 해석 기준 |오차| 상위 10건 -----');
  for (const w of top) {
    console.log(`  ${w.date} ${w.name}: KASI ${w.kasi} vs lunar ${w.lunar}(+8해석) → ${w.deltaMin8.toFixed(2)}분`);
  }
};

main();
