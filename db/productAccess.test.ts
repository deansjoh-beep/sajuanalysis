import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { FREE_OPEN, PRODUCT_ACCESS, isOpenProduct } from './productAccess';
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
    // 개방 상품 (1차: 일년운세, 2차: 평생 사주)
    expect(isOpenProduct('yearly2026')).toBe(true);
    expect(isOpenProduct('premium')).toBe(true);
    // 아직 준비중인 상품은 거부
    expect(isOpenProduct('jobCareer')).toBe(false);
    expect(isOpenProduct('loveMarriage')).toBe(false);
    // 알 수 없는 상품
    expect(isOpenProduct('bogus')).toBe(false);
  });

  it('적어도 하나의 상품은 개방되어 있다(구매 탭이 비지 않도록)', () => {
    expect(Object.values(PRODUCT_ACCESS).some((s) => s === 'open')).toBe(true);
  });
});

describe('FREE_OPEN — 무료 개방 스위치는 프론트·서버 공용', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

  it('불리언 단일 상수다', () => {
    expect(typeof FREE_OPEN).toBe('boolean');
  });

  it('CheckoutTab은 자체 FREE_OPEN을 선언하지 않고 공용 상수를 쓴다', () => {
    const src = read('src/components/tabs/CheckoutTab.tsx');
    expect(src).not.toMatch(/^\s*const FREE_OPEN\s*=/m);
    expect(src).toMatch(/import \{[^}]*FREE_OPEN[^}]*\} from '@\/db\/productAccess'/);
  });

  // 프론트만 닫으면 무료 발급 API가 열린 채로 남아 유료 상품을 공짜로 받을 수 있다.
  it.each([
    ['api/payment.ts', '../db/productAccess.js'],
    ['server.ts', './db/productAccess.ts'],
  ])('%s의 무료 발급 경로는 FREE_OPEN 게이트를 통과해야 한다', (file, importPath) => {
    const src = read(file);
    expect(src).toContain(`FREE_OPEN`);
    expect(src).toContain(importPath);
    const gateIndex = src.indexOf('FREE_ISSUE_CLOSED');
    const issueIndex = src.indexOf('issueFreeOrder(db');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(issueIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(issueIndex);
  });
});
