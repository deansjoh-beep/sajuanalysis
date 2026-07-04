/**
 * 월운(月運) 12개 산출 — 절입(節入) 기준 (Phase 1-1)
 *
 * 사주 연도 Y의 월운은 입춘(Y)에서 시작해 입춘(Y+1) 직전까지 절(節) 기준 12개월로
 * 나뉜다(寅월~丑월). 월 간지는 출생 정보와 무관한 만세력 값이다:
 *   - 월지: 입춘→寅 … 소한→丑 (고정)
 *   - 월간: 연간(年干)의 오호둔(五虎遁) 확장
 *
 * 절입 시각 소스: lunar-javascript (D-1-4 확정 1차 기준; KASI 실측 대비 중앙값 0.27분).
 * lunar-javascript는 절기 시각을 베이징시(UTC+8)로 반환하므로 KST로 환산한다 —
 * 엔진 연·월주(getBeijingInstant 프레임)와 동일 기준이라 월주 경계와 자동 정합된다.
 *
 * 개인화(십성 등)는 여기서 하지 않는다. SajuAnalysis 조립 단계에서 일간과
 * `calculateDeity`로 주입한다.
 */

import { Solar } from 'lunar-javascript';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 절(節) 12개 — 월운 순서(寅월부터). cnName은 lunar-javascript 절기표 키,
 * approxMonth/approxDay는 해당 occurrence를 절기표에서 찾기 위한 대략 날짜(KST).
 * 소한만 사주 연도의 이듬해(1월)에 속한다.
 */
const JEOL_SEQUENCE: ReadonlyArray<{
  koName: string;
  cnName: string;
  approxMonth: number;
  approxDay: number;
  yearOffset: 0 | 1;
}> = [
  { koName: '입춘', cnName: '立春', approxMonth: 2, approxDay: 4, yearOffset: 0 },
  { koName: '경칩', cnName: '惊蛰', approxMonth: 3, approxDay: 6, yearOffset: 0 },
  { koName: '청명', cnName: '清明', approxMonth: 4, approxDay: 5, yearOffset: 0 },
  { koName: '입하', cnName: '立夏', approxMonth: 5, approxDay: 6, yearOffset: 0 },
  { koName: '망종', cnName: '芒种', approxMonth: 6, approxDay: 6, yearOffset: 0 },
  { koName: '소서', cnName: '小暑', approxMonth: 7, approxDay: 7, yearOffset: 0 },
  { koName: '입추', cnName: '立秋', approxMonth: 8, approxDay: 8, yearOffset: 0 },
  { koName: '백로', cnName: '白露', approxMonth: 9, approxDay: 8, yearOffset: 0 },
  { koName: '한로', cnName: '寒露', approxMonth: 10, approxDay: 8, yearOffset: 0 },
  { koName: '입동', cnName: '立冬', approxMonth: 11, approxDay: 7, yearOffset: 0 },
  { koName: '대설', cnName: '大雪', approxMonth: 12, approxDay: 7, yearOffset: 0 },
  { koName: '소한', cnName: '小寒', approxMonth: 1, approxDay: 6, yearOffset: 1 },
];

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const KST_OFFSET_MS = 9 * 3600 * 1000;

const pad2 = (n: number) => String(n).padStart(2, '0');

const toKstISO = (utcMs: number): string => {
  const k = new Date(utcMs + KST_OFFSET_MS);
  return `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())}T${pad2(
    k.getUTCHours(),
  )}:${pad2(k.getUTCMinutes())}:${pad2(k.getUTCSeconds())}+09:00`;
};

/**
 * 특정 연·절기의 절입 UTC 순간을 lunar-javascript 절기표에서 조회.
 * 대략 날짜에서 절기표를 만들어 해당 occurrence(±5일 이내)인지 검증한다.
 */
const jeolInstantUtcMs = (calendarYear: number, cnName: string, approxMonth: number, approxDay: number): number => {
  const table = Solar.fromYmd(calendarYear, approxMonth, approxDay).getLunar().getJieQiTable();
  const s = table[cnName];
  if (!s) {
    throw new Error(`절기표에 ${cnName}(${calendarYear}) 없음`);
  }
  // 베이징 벽시계 → UTC 순간
  const utcMs =
    Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond()) -
    BEIJING_OFFSET_MS;
  const approxMs = Date.UTC(calendarYear, approxMonth - 1, approxDay);
  if (Math.abs(utcMs - approxMs) > 5 * 86400000) {
    throw new Error(`절기 occurrence 불일치: ${cnName}(${calendarYear}) → ${new Date(utcMs).toISOString()}`);
  }
  return utcMs;
};

export type WolunMonth = {
  /** 월운 순번 1~12 (1=寅월/입춘 … 12=丑월/소한) */
  index: number;
  stem: string;
  branch: string;
  /** 간지 두 글자 (한자), 예: '庚寅' */
  ganzhi: string;
  /** 이 달을 여는 절(節) 이름 */
  jeolName: string;
  /** 절입 시작 순간 (포함) */
  startKstISO: string;
  /** 다음 절입 순간 (미포함) */
  endKstISO: string;
  /** 시작/끝 UTC epoch millis — 구간 판정·정렬용 */
  startUtcMs: number;
  endUtcMs: number;
};

/** 세운(歲運) 간지 — 입춘 기준 사주 연도의 연 간지 */
export const getSeunGanzhi = (sajuYear: number): { stem: string; branch: string; ganzhi: string } => {
  const stem = STEMS[(((sajuYear - 4) % 10) + 10) % 10];
  const branch = BRANCHES[(((sajuYear - 4) % 12) + 12) % 12];
  return { stem, branch, ganzhi: stem + branch };
};

/**
 * 사주 연도(입춘 기준) Y의 월운 12개.
 * 구간: [입춘(Y), 입춘(Y+1)). 각 달은 [절입, 다음 절입).
 */
export const getWolunData = (sajuYear: number): WolunMonth[] => {
  const yearStemIdx = (((sajuYear - 4) % 10) + 10) % 10;
  const firstMonthStemIdx = (yearStemIdx % 5) * 2 + 2; // 오호둔: 寅월 월간

  // 13개 경계: 입춘(Y) ~ 입춘(Y+1)
  const boundaries: number[] = JEOL_SEQUENCE.map((j) =>
    jeolInstantUtcMs(sajuYear + j.yearOffset, j.cnName, j.approxMonth, j.approxDay),
  );
  boundaries.push(jeolInstantUtcMs(sajuYear + 1, '立春', 2, 4));

  return JEOL_SEQUENCE.map((j, i) => {
    const stem = STEMS[(firstMonthStemIdx + i) % 10];
    const branch = BRANCHES[(2 + i) % 12]; // 寅부터
    return {
      index: i + 1,
      stem,
      branch,
      ganzhi: stem + branch,
      jeolName: j.koName,
      startKstISO: toKstISO(boundaries[i]),
      endKstISO: toKstISO(boundaries[i + 1]),
      startUtcMs: boundaries[i],
      endUtcMs: boundaries[i + 1],
    };
  });
};

/**
 * 조회 시점의 사주 연도(입춘 기준)와 현재 월운·세운.
 * @param date 실제 순간 (기본: 호출 시점)
 */
export const getCurrentWolun = (
  date: Date = new Date(),
): { sajuYear: number; seun: ReturnType<typeof getSeunGanzhi>; wolun: WolunMonth; months: WolunMonth[] } => {
  const t = date.getTime();
  const kstYear = new Date(t + KST_OFFSET_MS).getUTCFullYear();
  const ipchunMs = jeolInstantUtcMs(kstYear, '立春', 2, 4);
  const sajuYear = t >= ipchunMs ? kstYear : kstYear - 1;
  const months = getWolunData(sajuYear);
  const wolun = months.find((m) => t >= m.startUtcMs && t < m.endUtcMs);
  if (!wolun) {
    // 구간 산출이 [입춘, 입춘)을 완전히 덮으므로 도달 불가 — 방어
    throw new Error(`월운 구간 판정 실패: ${date.toISOString()} (sajuYear=${sajuYear})`);
  }
  return { sajuYear, seun: getSeunGanzhi(sajuYear), wolun, months };
};
