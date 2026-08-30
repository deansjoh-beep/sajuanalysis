/**
 * 생년월일 유효성 — 년/월/일 독립 셀렉트 조합 검증용 공용 헬퍼.
 * 랜딩 티저(HeroSajuTeaser)·공용 입력(BirthInputFields)의 일(日) 옵션 동적 조정과
 * 결제 폼(CheckoutTab goPay) 제출 검증이 함께 사용한다.
 *
 * 양력: 실제 달력의 말일까지만 허용(윤년 반영).
 * 음력(평·윤): 달마다 29/30일이 달라 정밀 판정 대신 30일 상한만 적용한다
 * (최종 계산 시 만세력 엔진이 재검증).
 */
export type BirthCalendarType = 'solar' | 'lunar' | 'leap';

export function maxDayOfBirthMonth(year: number, month: number, calendarType: string): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return 31;
  if (calendarType === 'solar') {
    // new Date(y, m, 0) = m월의 말일 (month는 1-기준 입력)
    return new Date(year, month, 0).getDate();
  }
  return 30;
}

export function isValidBirthDate(
  year: number,
  month: number,
  day: number,
  calendarType: string
): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= maxDayOfBirthMonth(year, month, calendarType);
}
