import { describe, it, expect } from 'vitest';
import { PRODUCT_ACCESS, isOpenProduct } from './productAccess';
import { PRODUCT_PRICES } from './payment';

describe('productAccess — 상품 개방 설정 단일 소스', () => {
  it('키 집합이 PRODUCT_PRICES와 정확히 일치한다(상품 목록 동기화)', () => {
    expect(Object.keys(PRODUCT_ACCESS).sort()).toEqual(Object.keys(PRODUCT_PRICES).sort());
  });

  it('모든 값은 open | soon 중 하나다', () => {
    for (const status of Object.values(PRODUCT_ACCESS)) {
      expect(['open', 'soon']).toContain(status);
    }
  });

  it("isOpenProduct는 'open' 상품만 통과시킨다", () => {
    // 1차 개방 상품
    expect(isOpenProduct('yearly2026')).toBe(true);
    // 아직 준비중인 상품은 거부
    expect(isOpenProduct('premium')).toBe(false);
    expect(isOpenProduct('jobCareer')).toBe(false);
    expect(isOpenProduct('loveMarriage')).toBe(false);
    // 알 수 없는 상품
    expect(isOpenProduct('bogus')).toBe(false);
  });

  it('적어도 하나의 상품은 개방되어 있다(구매 탭이 비지 않도록)', () => {
    expect(Object.values(PRODUCT_ACCESS).some((s) => s === 'open')).toBe(true);
  });
});
