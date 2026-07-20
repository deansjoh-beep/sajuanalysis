/**
 * 상품 개방 상태 단일 소스 — 프론트(CheckoutTab)·백엔드(api/payment `free`·server.ts)가 공유한다.
 *
 * 토스페이먼츠 정식 승인 전까지 상품을 주간 단위로 하나씩 "무료" 개방한다.
 * - 'open'  : 무료 발급 허용(결제 없이 코드 발급 → 즉시 생성). CheckoutTab에서 바로 구매 가능.
 * - 'soon'  : 준비중. CheckoutTab에서 카드는 노출하되 준비중 배지로 막고, 서버도 무료 발급을 거부한다.
 *
 * ⚠️ 새 상품을 열 때는 아래 표에서 해당 값을 'soon' → 'open'으로 **한 곳만** 바꾸면
 *    프론트 노출과 서버 발급 허용이 함께 반영된다(주간 단계적 오픈 워크플로).
 * ⚠️ 키 집합은 db/payment.ts PRODUCT_PRICES와 반드시 일치한다(db/productAccess.test.ts가 강제).
 */
export type CommerceProduct = 'premium' | 'yearly2026' | 'jobCareer' | 'loveMarriage';

export type ProductAccess = 'open' | 'soon';

export const PRODUCT_ACCESS: Record<CommerceProduct, ProductAccess> = {
  // 1차 무료 개방 (2026-07-21~). 이후 주간 단위로 아래 'soon'을 하나씩 'open'으로 전환.
  yearly2026: 'open',
  premium: 'soon',
  jobCareer: 'soon',
  loveMarriage: 'soon',
};

/** 무료 발급이 허용된(개방된) 상품인지. 서버 발급 경로에서 직접 게이트로 사용한다. */
export function isOpenProduct(value: string): value is CommerceProduct {
  return value in PRODUCT_ACCESS && PRODUCT_ACCESS[value as CommerceProduct] === 'open';
}
