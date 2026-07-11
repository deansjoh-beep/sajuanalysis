import { describe, it, expect } from 'vitest';
import {
  normalizeCode,
  CODE_INPUT_PATTERN,
  pickConsumableOrder,
  totalFollowupRemaining,
  ChatCodeInfo,
} from './chatCodeClient';

const makeInfo = (remainings: number[]): ChatCodeInfo => ({
  code: 'HW-3F9K2A',
  orders: remainings.map((r, i) => ({
    orderId: `order-${i}`,
    product: 'yearly2026',
    status: 'paid',
    followupRemaining: r,
  })),
  newYearDiscountPercent: 30,
});

describe('chatCodeClient 순수 헬퍼', () => {
  it('normalizeCode: 대문자화 + 2-6 하이픈 삽입', () => {
    expect(normalizeCode('hw3f9k2a')).toBe('HW-3F9K2A');
    expect(normalizeCode('HW-3F9K2A')).toBe('HW-3F9K2A');
    expect(normalizeCode('  hw3f9k2a  ')).toBe('HW-3F9K2A');
  });

  it('CODE_INPUT_PATTERN: 유효/무효 코드 구분', () => {
    expect(CODE_INPUT_PATTERN.test('HW-3F9K2A')).toBe(true);
    expect(CODE_INPUT_PATTERN.test('HW3F9K2A')).toBe(true);
    expect(CODE_INPUT_PATTERN.test('HW-3F9')).toBe(false);
    expect(CODE_INPUT_PATTERN.test('완전히다른값')).toBe(false);
  });

  it('pickConsumableOrder: followup 남은 첫 주문을 고른다', () => {
    const info = makeInfo([0, 2, 3]);
    expect(pickConsumableOrder(info)?.orderId).toBe('order-1');
  });

  it('pickConsumableOrder: 남은 게 없으면 null', () => {
    expect(pickConsumableOrder(makeInfo([0, 0]))).toBeNull();
    expect(pickConsumableOrder(null)).toBeNull();
  });

  it('totalFollowupRemaining: 전 주문 합', () => {
    expect(totalFollowupRemaining(makeInfo([1, 2, 3]))).toBe(6);
    expect(totalFollowupRemaining(makeInfo([0, 0]))).toBe(0);
    expect(totalFollowupRemaining(null)).toBe(0);
  });
});
