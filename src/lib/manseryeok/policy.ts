/**
 * 만세력 산출 정책 — 유일한 진실 원천
 *
 * 확정 근거: docs/decisions.md 2026-07-03 접수분
 *   - D-1-1 야자시 유지 (23:00~23:59 → 다음 날 子時)
 *   - D-1-2 진태양시 서울 경도 126.9784° 기본 자동 적용
 *   - D-1-3 서머타임/표준시 보정 도입
 *
 * ⚠️ 이 파일의 상수·함수는 만세력 산출의 유일한 진실 원천이다.
 * 정책 변경 시 반드시 docs/decisions.md에 결정 사항 접수 후 여기 반영한다.
 */

// ============================================================
// D-1-1  야자시(夜子時) 처리 정책
// ============================================================
/**
 * 자시(23:00~00:59)를 어떻게 배분할지의 정책.
 *   - 'yajasi'  : 23:00~23:59도 다음 날 子時로 처리 (야자시)
 *   - 'jojasi'  : 자정(00:00) 기준. 23:00~23:59은 당일 子時, 00:00~00:59은 다음 날 子時 (조자시)
 *
 * 현재 확정: yajasi. lunar-javascript `setDayZero(2)`가 이 정책을 구현한다.
 */
export const YAJASI_MODE = 'yajasi' as const;

// ============================================================
// D-1-2  진태양시 (True Local Apparent Solar Time)
// ============================================================
/**
 * 서울 경도(도, decimal degrees).
 *   - 사용 위치: applyTrueSolarTime의 longitude 인자 기본값.
 *   - 기준점: 서울특별시 종로구 세종로 위성 좌표 근사.
 */
export const SEOUL_LONGITUDE = 126.9784;

/**
 * 한국 표준시(KST) 표준 자오선. GMT+9 = 135°E.
 *   - `applyTrueSolarTime`은 Luxon `DateTime.offset`으로 자동 도출하나,
 *     상수화하여 문서화 목적으로 병기.
 */
export const STANDARD_MERIDIAN_KST = 135;

// ============================================================
// D-1-3  서머타임(DST) 및 표준시 변경 (한국 표준시 역사)
// ============================================================
/**
 * 한국이 GMT+8:30 (127.5°E) 표준시를 사용한 기간.
 *   - 1908-04-01 ~ 1911-12-31 (대한제국 표준시)
 *   - 1954-03-21 ~ 1961-08-09 (이승만 정부 재도입기)
 * 그 외 기간은 GMT+9 (135°E).
 *
 * 정규화 방침: 사용자가 입력한 wall-clock 시각이 GMT+8:30 기간이라면
 * 현재 KST(GMT+9) wall-clock으로 정규화하기 위해 **+30분** 이동한다.
 * (GMT+8:30이 KST보다 30분 늦으므로, 같은 순간의 KST wall-clock은 +30분 더 앞선다.)
 */
const GMT_8_30_PERIODS: ReadonlyArray<readonly [number, number]> = [
  [19080401, 19111231],
  [19540321, 19610809],
];

/**
 * 한국 서머타임(일광절약시간) 실시 기간.
 *   1948~1951, 1955~1960, 1987~1988 여름.
 *
 * 정규화 방침: DST 기간의 wall-clock은 표준시보다 +1시간 앞선다.
 * 표준시로 되돌리기 위해 **-60분** 이동한다.
 *
 * 출처: 지식경제부(구 산업통상자원부) 표준시 시행 이력. 년별 개시·종료 일자.
 */
const EXACT_DST_PERIODS: ReadonlyArray<readonly [number, number]> = [
  [19480601, 19480913],
  [19490403, 19490911],
  [19500401, 19500910],
  [19510506, 19510909],
  [19550505, 19550909],
  [19560520, 19560930],
  [19570505, 19570922],
  [19580504, 19580921],
  [19590503, 19590920],
  [19600501, 19600918],
  [19870510, 19871011],
  [19880508, 19881009],
];

const inRange = (dateNum: number, [from, to]: readonly [number, number]) =>
  dateNum >= from && dateNum <= to;

/**
 * 사용자가 입력한 wall-clock 시각을 "현재 KST(GMT+9) 기준 wall-clock"으로
 * 정규화하기 위해 **더해야 하는** 오프셋(분).
 *
 * 반환값을 wall-clock에 더하면 saju 라이브러리가 기대하는 정규화된 시각을 얻는다.
 * 이후 `applyTrueSolarTime`이 서울 경도 기준 진태양시 보정을 이어서 수행한다.
 *
 * @example
 *   1955-06-15 (GMT+8:30 + DST): +30 + (-60) = -30분
 *   1987-06-15 (GMT+9 + DST):    0 + (-60) = -60분
 *   1965-06-15 (GMT+9, DST 없음): 0분
 *   1930-06-15 (GMT+9 일제기, DST 없음): 0분
 *   1910-06-15 (GMT+8:30 대한제국): +30분
 */
export const getKstNormalizationOffsetMinutes = (
  year: number,
  month: number,
  day: number,
): number => {
  const dateNum = year * 10000 + month * 100 + day;
  let offset = 0;
  if (GMT_8_30_PERIODS.some((r) => inRange(dateNum, r))) {
    offset += 30;
  }
  if (EXACT_DST_PERIODS.some((r) => inRange(dateNum, r))) {
    offset -= 60;
  }
  return offset;
};

// ============================================================
// 절입 경계 감지
// ============================================================
/**
 * 출생 시각이 이 시간 범위 이내로 절기 시각에 근접하면 프론트에 안내 문구를
 * 표시하기 위한 플래그(nearJieqiBoundary)를 true로 반환한다.
 */
export const JIEQI_BOUNDARY_HOURS = 24;

// ============================================================
// 정책 스냅샷 (테스트/디버깅용)
// ============================================================
export const POLICY_SNAPSHOT = {
  yajasi: YAJASI_MODE,
  seoulLongitude: SEOUL_LONGITUDE,
  standardMeridianKst: STANDARD_MERIDIAN_KST,
  jieqiBoundaryHours: JIEQI_BOUNDARY_HOURS,
  gmt830PeriodCount: GMT_8_30_PERIODS.length,
  dstPeriodCount: EXACT_DST_PERIODS.length,
} as const;
