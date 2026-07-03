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
 * 한계:
 *  - IMPLEMENTATION_PLAN.md는 KASI 기준 1,000건 대조를 요구하지만, KASI 데이터셋 확보는
 *    OWNER 결정 사항(외부 발주 or API 계약)에 속한다. 이 스크립트는 확보 후 즉시 붙일 수 있도록
 *    `REFERENCE_DATASET` 배열 구조를 확정해 둔다.
 *
 * 실행: `npx tsx scripts/audit/manseryeok-verify.ts`
 */

import { getSajuData, getDaeunData, getAdjustedTime } from '../../src/utils/saju';

type ReferenceCase = {
  id: string;
  category: 'known-good' | 'boundary-절입' | 'boundary-야자시' | 'boundary-조자시' | 'boundary-DST' | 'boundary-표준시변경';
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

const main = () => {
  const boundaryJieqi = buildBoundaryJieqi();
  const boundaryYajasi = buildBoundaryYajasi();
  const boundaryDST = buildBoundaryDST();
  const boundaryStd = buildBoundaryStdTime();
  const randomCases = buildRandomCases(1000, 42);

  const allCases = [
    ...KNOWN_GOOD,
    ...boundaryJieqi,
    ...boundaryYajasi,
    ...boundaryDST,
    ...boundaryStd,
    ...randomCases,
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
