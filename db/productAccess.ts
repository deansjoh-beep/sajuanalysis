/**
 * 상품 개방 상태 단일 소스 — 프론트(CheckoutTab)·백엔드(api/payment `free`·server.ts)가 공유한다.
 *
 * 토스페이먼츠 정식 승인 전까지 상품을 주간 단위로 하나씩 "무료" 개방한다.
 * - 'open'   : 판매 중. (FREE_OPEN이면 무료 발급, 아니면 토스 결제.) CheckoutTab에서 바로 구매 가능.
 * - 'soon'   : 준비중. CheckoutTab에서 카드는 노출하되 준비중 배지로 막고, 서버도 발급을 거부한다.
 * - 'closed' : 판매 종료(예: 지난 해의 신년운세). 구매 화면·랜딩에서 숨기고 서버는 무료 발급·결제 승인
 *              모두 거부한다. 이미 발급된 코드의 재열람·재생성은 계속 허용된다(판매만 닫는다).
 *
 * ⚠️ 새 상품을 열 때는 아래 표에서 해당 값을 'soon' → 'open'으로 **한 곳만** 바꾸면
 *    프론트 노출과 서버 발급 허용이 함께 반영된다(주간 단계적 오픈 워크플로).
 * ⚠️ 키 집합은 db/payment.ts PRODUCT_PRICES와 반드시 일치한다(db/productAccess.test.ts가 강제).
 */
export type CommerceProduct = 'premium' | 'yearly2026' | 'jobCareer' | 'loveMarriage' | 'yearly2027';

/**
 * 무료 개방 모드 — 프론트(CheckoutTab 결제 UI)와 서버(무료 발급 엔드포인트)가 공유하는 단일 스위치.
 *
 * - true  : 결제 없이 코드 발급. `POST /api/payment/free` 허용, 구매 화면은 가격 대신 '무료' 표기.
 * - false : 토스 결제 필수. `POST /api/payment/free`는 403으로 닫히고 결제창 경로가 활성화된다.
 *
 * ⚠️ 프론트만 false로 두면 무료 발급 API가 그대로 열려 유료 상품을 공짜로 받을 수 있다.
 *    반드시 이 상수 한 곳만 바꿔 양쪽이 함께 전환되게 할 것.
 * ⚠️ false로 배포하기 전에 Vercel 빌드 환경에 VITE_TOSS_CLIENT_KEY가 설정돼 있어야 한다.
 *    없으면 구매 탭이 상품 목록 대신 '결제 준비 중'만 표시한다(CheckoutTab paymentBlocked).
 */
export const FREE_OPEN = false;

export type ProductAccess = 'open' | 'soon' | 'closed';

export const PRODUCT_ACCESS: Record<CommerceProduct, ProductAccess> = {
  // 2027 신년운세 론치 (2026-10-12~). 2026 일년운세는 신규 판매를 닫고 재열람만 유지한다.
  yearly2027: 'open',
  // 1차 무료 개방 (2026-07-21~) → 2027 신년운세 론치와 함께 판매 종료 (2026-10-12).
  yearly2026: 'closed',
  // 2차 무료 개방 (2026-07-26~). 평생 사주 리포트 오픈.
  premium: 'open',
  // 3차 오픈 (2026-10-14). 직업·재물운·연애·결혼운 동시 개방 — 4종 전부 판매.
  jobCareer: 'open',
  loveMarriage: 'open',
};

/** 판매 중(개방된) 상품인지. 서버 무료 발급 경로에서 직접 게이트로 사용한다. */
export function isOpenProduct(value: string): value is CommerceProduct {
  return value in PRODUCT_ACCESS && PRODUCT_ACCESS[value as CommerceProduct] === 'open';
}

/** 판매 종료 상품인지. 결제 승인(confirm) 경로에서 지난 상품의 결제를 막는 게이트로 사용한다. */
export function isClosedProduct(value: string): value is CommerceProduct {
  return value in PRODUCT_ACCESS && PRODUCT_ACCESS[value as CommerceProduct] === 'closed';
}
