/**
 * 연간(신년) 운세 상품 ↔ 대상 연도 매핑 — 단일 소스.
 *
 * 일년운세 리포트는 "오늘 연도"가 아니라 **상품이 가리키는 연도**의 세운·월주로 생성해야 한다
 * (2027 신년운세는 2026년 10월부터 판매되므로 생성 시점의 연도와 대상 연도가 다르다).
 * 프롬프트 조립(premiumReportCore)·월운 캘린더(CodeLookupTab)·관리자 프리뷰가 모두 이 표를 본다.
 *
 * 새해 상품을 추가할 때: 여기에 한 줄 + db/schema.ts product enum + db/payment.ts PRODUCT_PRICES
 * + db/productAccess.ts PRODUCT_ACCESS + 전용 지침 파일(src/constants/guidelines/yearly-fortune-YYYY.ts).
 */
export const YEARLY_FORTUNE_TARGET_YEAR = {
  yearly2026: 2026,
  yearly2027: 2027,
} as const;

export type YearlyFortuneProduct = keyof typeof YEARLY_FORTUNE_TARGET_YEAR;

export function isYearlyFortuneProduct(value: string | undefined | null): value is YearlyFortuneProduct {
  return typeof value === 'string' && value in YEARLY_FORTUNE_TARGET_YEAR;
}

/** 상품이 가리키는 연도. 연간 운세 상품이 아니면 null. */
export function getYearlyFortuneTargetYear(value: string | undefined | null): number | null {
  return isYearlyFortuneProduct(value) ? YEARLY_FORTUNE_TARGET_YEAR[value] : null;
}
