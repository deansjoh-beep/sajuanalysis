import { describe, it, expect } from 'vitest';
import { estimateCostKrw, PRICING_USD_PER_M, DEFAULT_USD_KRW } from './modelPricing';

describe('modelPricing — estimateCostKrw', () => {
  it('Sonnet 5 단일 호출 원가를 단가표대로 계산한다', () => {
    // 10k in × $2/M + 20k out × $10/M = $0.22 → ₩308 (환율 1400)
    const cost = estimateCostKrw([{ model: 'claude-sonnet-5', inputTokens: 10_000, outputTokens: 20_000 }]);
    expect(cost).toBeCloseTo(308, 5);
  });

  it('여러 호출(보정 재생성·폴백 과금 포함)은 합산된다', () => {
    const one = estimateCostKrw([{ model: 'gemini-2.5-flash', inputTokens: 5_000, outputTokens: 8_000 }]);
    const two = estimateCostKrw([
      { model: 'gemini-2.5-flash', inputTokens: 5_000, outputTokens: 8_000 },
      { model: 'claude-sonnet-5', inputTokens: 10_000, outputTokens: 20_000 },
    ]);
    expect(two).toBeCloseTo(one + 308, 5);
  });

  it('단가 미등록 모델은 보수적 폴백 단가(gemini-2.5-pro)로 계산한다', () => {
    const unknown = estimateCostKrw([{ model: 'some-future-model', inputTokens: 1_000_000, outputTokens: 0 }]);
    const pro = PRICING_USD_PER_M['gemini-2.5-pro'];
    expect(unknown).toBeCloseTo(pro.input * DEFAULT_USD_KRW, 5);
  });

  it('사용량이 없으면 0이다', () => {
    expect(estimateCostKrw([])).toBe(0);
  });

  it('환율 인자를 반영한다', () => {
    const cost = estimateCostKrw([{ model: 'claude-sonnet-5', inputTokens: 10_000, outputTokens: 20_000 }], 1000);
    expect(cost).toBeCloseTo(220, 5);
  });
});
