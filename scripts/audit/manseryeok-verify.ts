/**
 * 만세력 정밀도 교차검증 하네스 (Phase 0)
 *
 * 목적:
 *  - 기존 엔진(`src/utils/saju.ts` 기반 `getSajuData`)의 사주 8자 산출 결과를
 *    두 종류의 검증 소스와 대조한다.
 *      1) 하드코딩된 회귀 골든셋(known good) — 학술/실무 문헌·기존 테스트 유래
 *      2) 프로그램적으로 생성한 경계 케이스(절입 ±24h, 야자시/조자시, 서머타임)
 *  - 불일치를 유형별로 분류해 `docs/audit/manseryeok-report.md`에 반영할 수치를 산출한다.
 *
 * KASI 대조 모드 (Phase 1-1 통합):
 *  - `kasi-expected.ts`가 KASI 절입 시각 + 순수 산술(60갑자 JDN·오호둔·오서둔)로 8자 expected를
 *    독립 산출한다(lunar-javascript 미사용). 이를 무작위 1,000건 + 절입 경계 타깃 케이스에 주입해
 *    진짜 정확도 %를 산출한다. IMPLEMENTATION_PLAN.md DoD("KASI 기준 1,000건 정확도 100%") 지표.
 *  - 커버리지: KASI 실측 2000~2028년. 공백연도(1900~1999, 2029~)는 jieqi-astro 감시로 별도 커버.
 *
 * 실행: `npx tsx scripts/audit/manseryeok-verify.ts`
 */

import { getSajuData, getDaeunData, getAdjustedTime } from '../../src/utils/saju';
import { loadJeolInstants, expectedEightChar, type JeolInstant } from './kasi-expected';

type ReferenceCase = {
  id: string;
  category: 'known-good' | 'boundary-절입' | 'boundary-야자시' | 'boundary-조자시' | 'boundary-DST' | 'boundary-표준시변경' | 'kasi-boundary' | 'kasi-random';
  input: {
    dateStr: string;    // 'YYYY-MM-DD' (양력 표기 원문; isLunar가 true면 음력)
    timeStr: string;    // 'HH:mm'
    isLunar: boolean;
    isLeap: boolean;
    gender?: 'M' | 'F';
  };
  expected?: {
    year: string;   // '甲子'
    month: string;
    day: string;
    hour: string;
  };
  note?: string;
};

/**
 * 회귀 골든셋 (known-good)
 *  - 각 항목에는 근거(문헌·유명 인물·기존 테스트) 주석을 병기한다.
 *  - Phase 1 착수 시 이 배열을 100건까지 확장한다.
 */
const KNOWN_GOOD: ReferenceCase[] = [
  {
    id: 'kg-001',
    category: 'known-good',
    input: { dateStr: '1969-10-23', timeStr: '10:00', isLunar: true, isLeap: false },
    // 반환 배열은 [시주, 일주, 월주, 년주] 순
    expected: { hour: '癸巳', day: '辛亥', month: '乙亥', year: '己酉' },
    note: '기존 `src/utils/saju.test.ts`에서 검증된 케이스 (음력 입력)',
  },
];

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

const isValidPillar = (p: string) =>
  p.length === 2 && STEMS.includes(p[0]) && BRANCHES.includes(p[1]);

const pillarOf = (p: any) => `${p.stem.hanja}${p.branch.hanja}`;

const runOne = (c: ReferenceCase) => {
  const { input } = c;
  try {
    const result = getSajuData(input.dateStr, input.timeStr, input.isLunar, input.isLeap, false, 'Asia/Seoul');
    // 반환은 [시주, 일주, 월주, 년주] 역순 배열
    const [hour, day, month, year] = result;
    const actual = {
      year: pillarOf(year),
      month: pillarOf(month),
      day: pillarOf(day),
      hour: pillarOf(hour),
    };

    const structural =
      isValidPillar(actual.year) &&
      isValidPillar(actual.month) &&
      isValidPillar(actual.day) &&
      isValidPillar(actual.hour);

    if (!structural) {
      return { case: c, actual, verdict: 'structural-fail' as const };
    }

    if (!c.expected) {
      return { case: c, actual, verdict: 'no-expected' as const };
    }

    const match =
      actual.year === c.expected.year &&
      actual.month === c.expected.month &&
      actual.day === c.expected.day &&
      actual.hour === c.expected.hour;

    return { case: c, actual, verdict: match ? ('match' as const) : ('mismatch' as const) };
  } catch (e: any) {
    return { case: c, actual: null, verdict: 'error' as const, error: String(e?.message || e) };
  }
};

/**
 * 경계 케이스: 절입 ±60분 (양력 입력)
 *  - 정확한 절기 시각은 lunar-javascript에 의존하므로 여기서는 대표 날짜만 커버.
 *  - 24절기 각 대표일(±60분)에 대해 결정론 산출이 예외 없이 완주하는지 확인한다.
 */
const buildBoundaryJieqi = (): ReferenceCase[] => {
  // 대표 절기 시작일 (연도별 실제 시각은 다르지만 관측 목적상 대표일 사용)
  const REPRESENTATIVE_JIEQI_2000 = [
    ['02-04', '입춘'], ['03-05', '경칩'], ['04-05', '청명'], ['05-05', '입하'],
    ['06-06', '망종'], ['07-07', '소서'], ['08-07', '입추'], ['09-08', '백로'],
    ['10-08', '한로'], ['11-07', '입동'], ['12-07', '대설'], ['01-06', '소한'],
  ];
  const cases: ReferenceCase[] = [];
  for (const year of [1990, 2000, 2010, 2020]) {
    for (const [md, name] of REPRESENTATIVE_JIEQI_2000) {
      for (const time of ['00:30', '23:30']) {
        cases.push({
          id: `jieqi-${year}-${md}-${time}`,
          category: 'boundary-절입',
          input: { dateStr: `${year}-${md}`, timeStr: time, isLunar: false, isLeap: false },
          note: `${name} 대표일 ±30분 경계 완주성 확인`,
        });
      }
    }
  }
  return cases;
};

/**
 * 경계 케이스: 야자시(23:30~23:59) / 조자시(00:00~00:59)
 */
const buildBoundaryYajasi = (): ReferenceCase[] => {
  const cases: ReferenceCase[] = [];
  const dates = ['1990-06-15', '2000-06-15', '2010-06-15', '2020-06-15'];
  for (const d of dates) {
    cases.push({
      id: `yaja-${d}-2330`, category: 'boundary-야자시',
      input: { dateStr: d, timeStr: '23:30', isLunar: false, isLeap: false },
      note: '야자시: setDayZero(2) 정책 확인',
    });
    cases.push({
      id: `joja-${d}-0030`, category: 'boundary-조자시',
      input: { dateStr: d, timeStr: '00:30', isLunar: false, isLeap: false },
      note: '조자시: 다음 날 자시로 처리하는 정책 확인',
    });
  }
  return cases;
};

/**
 * 경계 케이스: 서머타임 기간
 */
const buildBoundaryDST = (): ReferenceCase[] => {
  const cases: ReferenceCase[] = [];
  const spans = [
    { period: '1948-07-15', label: '1948~51 DST 여름' },
    { period: '1957-07-15', label: '1955~60 DST 여름' },
    { period: '1987-07-15', label: '1987~88 DST 여름 (5~10월)' },
    { period: '1988-07-15', label: '1987~88 DST 여름' },
  ];
  for (const s of spans) {
    cases.push({
      id: `dst-${s.period}`, category: 'boundary-DST',
      input: { dateStr: s.period, timeStr: '10:00', isLunar: false, isLeap: false },
      note: `${s.label} — getAdjustedTime()이 -60분 오프셋 인지하는지 계측 (현행 코드는 saju.ts:260에서 offsetMinutes 반환만; getSajuData에서 실제 적용되지 않음)`,
    });
  }
  return cases;
};

/**
 * 경계 케이스: 표준시 변경 (1912-01-01~1954-03-20 = -30분, 1961-08-10~ = -30분)
 */
const buildBoundaryStdTime = (): ReferenceCase[] => {
  const cases: ReferenceCase[] = [];
  cases.push({
    id: 'stdtime-1912-01-01', category: 'boundary-표준시변경',
    input: { dateStr: '1912-01-01', timeStr: '10:00', isLunar: false, isLeap: false },
    note: '한국 표준시 GMT+8:30 시작 경계',
  });
  cases.push({
    id: 'stdtime-1954-03-21', category: 'boundary-표준시변경',
    input: { dateStr: '1954-03-21', timeStr: '10:00', isLunar: false, isLeap: false },
    note: 'GMT+9로 복귀 경계',
  });
  cases.push({
    id: 'stdtime-1961-08-10', category: 'boundary-표준시변경',
    input: { dateStr: '1961-08-10', timeStr: '10:00', isLunar: false, isLeap: false },
    note: 'GMT+8:30 재도입 경계 (실제 적용은 saju.ts:249 조건)',
  });
  return cases;
};

/**
 * 무작위 케이스 1,000건 — 구조적 완주성만 검증(expected 없음).
 * 시드 기반 결정론적 생성 → 재실행 시 동일 시퀀스.
 */
const buildRandomCases = (n: number, seed: number): ReferenceCase[] => {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const cases: ReferenceCase[] = [];
  for (let i = 0; i < n; i++) {
    const year = 1900 + Math.floor(rand() * 131);
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    const hour = Math.floor(rand() * 24);
    const minute = Math.floor(rand() * 60);
    cases.push({
      id: `rand-${i}`,
      category: 'known-good',
      input: {
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        isLunar: false,
        isLeap: false,
      },
    });
  }
  return cases;
};

const KST_MS = 9 * 3600 * 1000;

const toKstWallClock = (utcMs: number): { dateStr: string; timeStr: string } => {
  const kst = new Date(utcMs + KST_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    dateStr: `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())}`,
    timeStr: `${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}`,
  };
};

/**
 * KASI 대조: 절입 경계 타깃 케이스.
 * 각 절(節)의 ±5분(경계 직전/직후)·±6시간에 expected 8자를 주입한다.
 * ±5분은 KASI 분해상도(분)·엔진 실측 오차(±2분)를 상회하는 안전 마진.
 * 천문계산 패치 항(2011 입동)은 ±14분 정밀도라 근접 오프셋을 생략한다.
 */
const buildKasiBoundaryCases = (jeol: JeolInstant[]): ReferenceCase[] => {
  const cases: ReferenceCase[] = [];
  for (const t of jeol) {
    const offsets = t.patched ? [-360, 360] : [-360, -5, 5, 360];
    for (const off of offsets) {
      const birthUtcMs = t.utcMs + off * 60000;
      const { dateStr, timeStr } = toKstWallClock(birthUtcMs);
      const expected = expectedEightChar(jeol, dateStr, timeStr);
      if (!expected) continue; // 커버리지 밖 (예: 첫 절 -6h)
      const kstYear = new Date(t.utcMs + KST_MS).getUTCFullYear();
      cases.push({
        id: `kasi-jeol-${kstYear}-${t.name}-${off >= 0 ? '+' : ''}${off}m`,
        category: 'kasi-boundary',
        input: { dateStr, timeStr, isLunar: false, isLeap: false },
        expected: { year: expected.year, month: expected.month, day: expected.day, hour: expected.hour },
        note: `${kstYear} ${t.name} ${off >= 0 ? '+' : ''}${off}분`,
      });
    }
  }
  return cases;
};

/**
 * KASI 대조: 일주 자정 경계 타깃 케이스.
 * 진태양시 보정(경도 −32.1분 + EOT −14~+16분 = 총 −46~−16분)으로 00:00~00:46 출생은
 * 일주가 전날로 넘어갈 수 있다. 이 flip 구간과 야자시(23시대)를 명시적으로 검증한다.
 */
const buildKasiMidnightCases = (jeol: JeolInstant[]): ReferenceCase[] => {
  const cases: ReferenceCase[] = [];
  const times = ['23:40', '00:05', '00:20', '00:35', '00:50', '01:05'];
  for (const year of [2000, 2007, 2014, 2021, 2028]) {
    for (let month = 1; month <= 12; month++) {
      for (const timeStr of times) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-15`;
        const expected = expectedEightChar(jeol, dateStr, timeStr);
        if (!expected || expected.minutesToNearestJeol < 5) continue;
        cases.push({
          id: `kasi-midnight-${dateStr}-${timeStr}`,
          category: 'kasi-boundary',
          input: { dateStr, timeStr, isLunar: false, isLeap: false },
          expected: { year: expected.year, month: expected.month, day: expected.day, hour: expected.hour },
          note: '일주 자정/야자시 경계 (진태양시 보정 포함)',
        });
      }
    }
  }
  return cases;
};

/**
 * KASI 대조: 무작위 n건 (KASI 커버리지 2000~2028 내, 시드 기반 결정론).
 * 절입 ±5분 이내(기준·엔진 분해상도 중첩 구간)와 천문계산 패치 항 ±45분 이내는
 * expected 신뢰도가 부족해 건너뛰고 다음 후보로 대체한다(총 n건 유지, 제외 수 로그).
 */
const buildKasiRandomCases = (
  jeol: JeolInstant[],
  n: number,
  seed: number,
): { cases: ReferenceCase[]; skippedNearBoundary: number } => {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const startMs = Date.UTC(2000, 1, 15); // 2000-02-15 (입춘 2000 이후, 연주 확정 가능 구간)
  const endMs = Date.UTC(2028, 11, 28);
  const cases: ReferenceCase[] = [];
  let skipped = 0;
  while (cases.length < n) {
    const ms = startMs + Math.floor((rand() * (endMs - startMs)) / 60000) * 60000;
    const { dateStr, timeStr } = toKstWallClock(ms);
    const expected = expectedEightChar(jeol, dateStr, timeStr);
    if (!expected) continue;
    if (expected.minutesToNearestJeol < 5 || (expected.nearestJeolPatched && expected.minutesToNearestJeol < 45)) {
      skipped++;
      continue;
    }
    cases.push({
      id: `kasi-rand-${cases.length}`,
      category: 'kasi-random',
      input: { dateStr, timeStr, isLunar: false, isLeap: false },
      expected: { year: expected.year, month: expected.month, day: expected.day, hour: expected.hour },
    });
  }
  return { cases, skippedNearBoundary: skipped };
};

const main = () => {
  const boundaryJieqi = buildBoundaryJieqi();
  const boundaryYajasi = buildBoundaryYajasi();
  const boundaryDST = buildBoundaryDST();
  const boundaryStd = buildBoundaryStdTime();
  const randomCases = buildRandomCases(1000, 42);

  // KASI 대조 모드 (expected 있는 진짜 정확도 검증)
  const jeol = loadJeolInstants();
  const kasiBoundary = [...buildKasiBoundaryCases(jeol), ...buildKasiMidnightCases(jeol)];
  const { cases: kasiRandom, skippedNearBoundary } = buildKasiRandomCases(jeol, 1000, 20260704);

  const allCases = [
    ...KNOWN_GOOD,
    ...boundaryJieqi,
    ...boundaryYajasi,
    ...boundaryDST,
    ...boundaryStd,
    ...randomCases,
    ...kasiBoundary,
    ...kasiRandom,
  ];

  const results = allCases.map(runOne);
  const summary = {
    total: results.length,
    match: results.filter(r => r.verdict === 'match').length,
    mismatch: results.filter(r => r.verdict === 'mismatch').length,
    structuralFail: results.filter(r => r.verdict === 'structural-fail').length,
    error: results.filter(r => r.verdict === 'error').length,
    noExpected: results.filter(r => r.verdict === 'no-expected').length,
  };

  console.log('\n===== Manseryeok Verify Summary =====');
  console.log(JSON.stringify(summary, null, 2));

  // ===== KASI 대조 정확도 (DoD 지표) =====
  const kasiResults = results.filter(
    (r) => r.case.category === 'kasi-boundary' || r.case.category === 'kasi-random',
  );
  const kasiByCat = (cat: ReferenceCase['category']) => {
    const rs = kasiResults.filter((r) => r.case.category === cat);
    const ok = rs.filter((r) => r.verdict === 'match').length;
    return { total: rs.length, match: ok, pct: rs.length ? (100 * ok) / rs.length : 0 };
  };
  const kb = kasiByCat('kasi-boundary');
  const kr = kasiByCat('kasi-random');
  console.log('\n===== KASI 대조 정확도 (expected 8자 독립 산출 기준) =====');
  console.log(`  절입 경계 타깃: ${kb.match}/${kb.total} (${kb.pct.toFixed(2)}%)`);
  console.log(`  무작위 1,000건: ${kr.match}/${kr.total} (${kr.pct.toFixed(2)}%)  [경계근접 제외 후 재추출: ${skippedNearBoundary}건]`);

  const kasiMismatches = kasiResults.filter((r) => r.verdict !== 'match');
  if (kasiMismatches.length > 0) {
    console.log(`\n  불일치 ${kasiMismatches.length}건 — 주(柱)별 분해:`);
    const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
    const byPillar: Record<string, number> = { year: 0, month: 0, day: 0, hour: 0 };
    for (const m of kasiMismatches) {
      if (!m.actual || !m.case.expected) continue;
      for (const k of pillarKeys) {
        if ((m.actual as any)[k] !== m.case.expected[k]) byPillar[k]++;
      }
    }
    console.log(`  ${JSON.stringify(byPillar)}`);
    for (const m of kasiMismatches.slice(0, 30)) {
      console.log(`  ${JSON.stringify({ id: m.case.id, input: m.case.input, expected: m.case.expected, actual: m.actual, verdict: m.verdict })}`);
    }
  }

  const mismatches = results.filter(r => r.verdict === 'mismatch' || r.verdict === 'structural-fail' || r.verdict === 'error');
  if (mismatches.length > 0) {
    console.log('\n===== Mismatches / Errors =====');
    for (const m of mismatches) {
      console.log(JSON.stringify({
        id: m.case.id,
        category: m.case.category,
        input: m.case.input,
        expected: m.case.expected,
        actual: m.actual,
        verdict: m.verdict,
        error: (m as any).error,
      }));
    }
  }

  // Dae-un 대운 완주성만 확인 (성별 결정 필요)
  const daeunSample = KNOWN_GOOD[0];
  try {
    const daeun = getDaeunData(
      daeunSample.input.dateStr, daeunSample.input.timeStr,
      daeunSample.input.isLunar, daeunSample.input.isLeap,
      'M', false, 'Asia/Seoul'
    );
    console.log(`\n[Daeun] ${daeunSample.id} → daeunSu=${daeun[0]?.startAge}, first=${daeun[0]?.stem}${daeun[0]?.branch}`);
  } catch (e: any) {
    console.log(`\n[Daeun] error: ${e?.message}`);
  }

  // 서머타임/표준시 오프셋 실측
  console.log('\n===== getAdjustedTime 오프셋 실측 =====');
  const offsetSamples: Array<[number, number, number]> = [
    [1948, 7, 15], [1957, 7, 15], [1987, 7, 15], [1988, 7, 15],
    [1912, 1, 1], [1954, 3, 21], [1961, 8, 10], [2020, 6, 15],
  ];
  for (const [y, m, d] of offsetSamples) {
    const off = getAdjustedTime(y, m, d, 10, 0);
    console.log(`  ${y}-${m}-${d} → offset ${off} min`);
  }

  process.exit(summary.mismatch + summary.structuralFail + summary.error > 0 ? 1 : 0);
};

main();
