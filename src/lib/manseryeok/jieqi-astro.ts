/**
 * 천문계산 기반 24절기 시각 산출 (Phase 1-1)
 *
 * 태양의 겉보기 황경(apparent ecliptic longitude)이 15°의 배수에 도달하는 순간이 절기다.
 * 이 모듈은 KASI Open API의 커버리지 공백(2000년 미만·2028년 초과)을 메우고,
 * KASI와 lunar-javascript가 불일치할 때의 독립 tie-break 기준을 제공한다.
 *
 * 알고리즘: Meeus, "Astronomical Algorithms" 2nd ed., Ch.25 (Solar Coordinates) 저정밀식 + ΔT 보정.
 *
 * 📏 실측 정밀도(lunar-javascript 대비, 1950~2030 24절기 1,863건):
 *   - 평균 |오차| ≈ 4분, 최대 ≈ 14분, 계통편차 ≈ -3분(약간 이르게 나옴).
 *   - ⚠️ **분 단위 정밀 기준값이 아니다.** 이 모듈의 용도는:
 *       (a) KASI ↔ lunar-javascript 불일치 시 **독립 tie-break** (KASI 오류는 수십 분~수 시간 단위라 충분히 구분).
 *       (b) KASI 미제공 연도(2000 미만·2028 초과)의 **거친 교차검증**(lunar 값이 정상 범위인지 감시).
 *   - **분 단위 1차 기준은 lunar-javascript**다(KASI 348건 대조 시 중앙값 0.27분, 99.7%가 ≤1분).
 *     lunar-javascript는 절기 시각을 **베이징시(UTC+8)** 로 반환함에 유의.
 *
 * ⚠️ 결정론 원칙: 계산은 100% 이 코드로 수행한다(LLM 위임 금지). 단위 테스트 필수.
 */

/** 24절기 — 태양황경(도) → 한국어 절기명. 절기의 정의값. */
export const SOLAR_TERM_BY_LONGITUDE: Record<number, string> = {
  315: '입춘', 330: '우수', 345: '경칩', 0: '춘분', 15: '청명', 30: '곡우',
  45: '입하', 60: '소만', 75: '망종', 90: '하지', 105: '소서', 120: '대서',
  135: '입추', 150: '처서', 165: '백로', 180: '추분', 195: '한로', 210: '상강',
  225: '입동', 240: '소설', 255: '대설', 270: '동지', 285: '소한', 300: '대한',
};

/**
 * 절(節, 월주 경계=절입점) 여부. 태양황경이 15°의 홀수배(315,345,15,…) → mod 30 === 15.
 * 중기(中氣)는 30°의 배수(0,30,60,…) → mod 30 === 0.
 */
export const isMonthBoundaryLongitude = (longitudeDeg: number): boolean =>
  ((longitudeDeg % 30) + 30) % 30 === 15;

const DEG = Math.PI / 180;

/** JS Date(UTC 순간) → 율리우스일(JD) */
export const toJulianDay = (date: Date): number => date.getTime() / 86400000 + 2440587.5;

/** JD → JS Date(UTC 순간) */
export const fromJulianDay = (jd: number): Date => new Date((jd - 2440587.5) * 86400000);

/**
 * ΔT = TT − UT (초). Espenak & Meeus(2006) 다항 근사, 1900~2050 구간.
 * 태양황경 식은 역학시(TT) 기준이므로 UT(≈UTC) 순간을 TT로 보정해야 한다.
 * (미보정 시 절기 시각이 수 분 이르게 나오는 계통오차 발생.)
 */
export const deltaTSeconds = (year: number): number => {
  let t: number;
  if (year < 1920) {
    t = year - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  } else if (year < 1941) {
    t = year - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t ** 3;
  } else if (year < 1961) {
    t = year - 1950;
    return 29.07 + 0.407 * t - (t * t) / 233 + t ** 3 / 2547;
  } else if (year < 1986) {
    t = year - 1975;
    return 45.45 + 1.067 * t - (t * t) / 260 - t ** 3 / 718;
  } else if (year < 2005) {
    t = year - 2000;
    return (
      63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 +
      0.000651814 * t ** 4 + 0.00002373599 * t ** 5
    );
  }
  // 2005~2050
  t = year - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
};

/**
 * 태양 겉보기 황경(도, 0~360). Meeus Ch.25 저정밀식.
 * @param jde 율리우스일(역학시 TT 기준). UT 순간은 sunApparentLongitudeAtUT 사용.
 */
export const sunApparentLongitude = (jde: number): number => {
  const T = (jde - 2451545.0) / 36525.0; // J2000.0 기준 율리우스 세기(TT)

  // 태양 기하 평균황경 (aberration·nutation 미적용)
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  // 태양(=지구) 평균근점이각
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;

  // 중심차(equation of center)
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);

  const trueLong = L0 + C; // 참황경

  // 겉보기황경 보정: 장동(nutation Δψ 근사) + 광행차(aberration)
  const omega = (125.04 - 1934.136 * T) * DEG;
  const apparent = trueLong - 0.00569 - 0.00478 * Math.sin(omega);

  return ((apparent % 360) + 360) % 360;
};

/**
 * UT(≈UTC) 순간의 태양 겉보기 황경(도). ΔT로 TT 변환 후 계산.
 * @param utMs UTC epoch millis
 */
export const sunApparentLongitudeAtUT = (utMs: number): number => {
  const year = new Date(utMs).getUTCFullYear();
  const jde = (utMs + deltaTSeconds(year) * 1000) / 86400000 + 2440587.5;
  return sunApparentLongitude(jde);
};

/** target 기준 각도차를 (-180, 180] 로. crossing 검출·이분법용. */
const normalizedDiff = (angleDeg: number, targetDeg: number): number =>
  (((angleDeg - targetDeg + 540) % 360) - 180);

/**
 * 지정 UTC 구간에서 태양황경이 targetDeg에 도달하는 순간을 이분법으로 정밀화.
 * 구간 [loMs, hiMs] 내에서 normalizedDiff가 음→양으로 바뀐다고 가정.
 */
const bisectCrossing = (loMs: number, hiMs: number, targetDeg: number): Date => {
  let lo = loMs;
  let hi = hiMs;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const diff = normalizedDiff(sunApparentLongitudeAtUT(mid), targetDeg);
    if (diff < 0) lo = mid;
    else hi = mid;
  }
  return new Date((lo + hi) / 2);
};

export type SolarTermInstant = {
  name: string; // 절기명
  longitude: number; // 태양황경(도)
  isMonthBoundary: boolean; // 절(true)/중기(false)
  utc: Date; // UTC 순간
  utcISO: string; // ISO 8601 (UTC)
  kstISO: string; // 'YYYY-MM-DDTHH:mm:00+09:00'
  kstDate: string; // 'YYYY-MM-DD' (KST)
  kstTime: string; // 'HH:mm' (KST)
};

const KST_OFFSET_MS = 9 * 3600 * 1000;

const pad2 = (n: number) => String(n).padStart(2, '0');

const buildInstant = (utc: Date, longitude: number): SolarTermInstant => {
  const kst = new Date(utc.getTime() + KST_OFFSET_MS);
  // KST wall-clock을 UTC getter로 읽으면 +09:00 벽시계가 된다.
  const y = kst.getUTCFullYear();
  const mo = pad2(kst.getUTCMonth() + 1);
  const d = pad2(kst.getUTCDate());
  const hh = pad2(kst.getUTCHours());
  const mm = pad2(kst.getUTCMinutes());
  const kstDate = `${y}-${mo}-${d}`;
  const kstTime = `${hh}:${mm}`;
  return {
    name: SOLAR_TERM_BY_LONGITUDE[((longitude % 360) + 360) % 360],
    longitude: ((longitude % 360) + 360) % 360,
    isMonthBoundary: isMonthBoundaryLongitude(longitude),
    utc,
    utcISO: utc.toISOString(),
    kstISO: `${kstDate}T${kstTime}:00+09:00`,
    kstDate,
    kstTime,
  };
};

/**
 * 특정 양력 연도(KST 기준 1/1~12/31)의 24절기 시각 전체를 계산해 시간순으로 반환.
 *
 * 매 양력 연도는 소한(285°)~동지(270°) 24개를 정확히 담는다.
 * 구현: 연초 직전부터 연말까지 태양황경을 unwrap 하며 15° 배수 crossing을 포착해 이분법 정밀화.
 */
export const getSolarTermsForYear = (year: number): SolarTermInstant[] => {
  // KST 1/1 00:00 = UTC 전날 15:00. 소한(1/5~6)~동지(12/22) 포착을 위해 KST 연 경계로 스캔.
  const startMs = Date.UTC(year, 0, 1, 0, 0, 0) - KST_OFFSET_MS;
  const endMs = Date.UTC(year, 11, 31, 23, 59, 0) - KST_OFFSET_MS;
  const stepMs = 6 * 3600 * 1000; // 6시간 간격 스캔(6h 내 황경 변화 <0.3° → crossing 유일)

  const toDeg = (ms: number) => sunApparentLongitudeAtUT(ms);

  const results: SolarTermInstant[] = [];
  let prevMs = startMs;
  let prevDeg = toDeg(startMs);
  // unwrap 누적값
  let prevUnwrapped = prevDeg;

  for (let ms = startMs + stepMs; ms <= endMs; ms += stepMs) {
    const deg = toDeg(ms);
    // unwrap: 이전 대비 감소하면 360 경계를 넘은 것
    let unwrapped = prevUnwrapped + (((deg - prevDeg + 540) % 360) - 180);
    // prev~cur 사이에 있는 15° 배수 각각에 대해 crossing 정밀화
    const kStart = Math.ceil(prevUnwrapped / 15 + 1e-9);
    const kEnd = Math.floor(unwrapped / 15 - 1e-9);
    for (let k = kStart; k <= kEnd; k++) {
      const targetUnwrapped = k * 15;
      const targetDeg = ((targetUnwrapped % 360) + 360) % 360;
      const utc = bisectCrossing(prevMs, ms, targetDeg);
      results.push(buildInstant(utc, targetDeg));
    }
    prevMs = ms;
    prevDeg = deg;
    prevUnwrapped = unwrapped;
  }
  results.sort((a, b) => a.utc.getTime() - b.utc.getTime());
  return results;
};

/**
 * 특정 연도·태양황경의 절기 시각 하나만 계산.
 * @param targetDeg 15의 배수(0~345)
 */
export const solarTermInstant = (year: number, targetDeg: number): SolarTermInstant | null => {
  const all = getSolarTermsForYear(year);
  const norm = ((targetDeg % 360) + 360) % 360;
  return all.find((t) => t.longitude === norm) ?? null;
};
