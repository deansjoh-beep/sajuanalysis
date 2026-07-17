/**
 * 모델 토큰 단가표 + 생성 원가(₩) 추정.
 *
 * 프리미엄 리포트 생성 파이프(generatePremiumReport)와 벤치 하네스(scripts/report-bench.ts)가
 * 공유하는 단일 소스. reports.generation_cost_krw(관리자 원가 통계)에 저장되는 값의 근거다.
 *
 * ⚠️ 단가 변경 시 여기 한 곳만 고치면 된다. 값은 USD / 1M tokens.
 */

export interface CallUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export const PRICING_USD_PER_M: Record<string, { input: number; output: number }> = {
  // Sonnet 5 인트로가($2/$10)는 2026-08-31까지 — 이후 정가 $3/$15로 갱신할 것.
  'claude-sonnet-5': { input: 2.0, output: 10.0 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};

/** 단가 미등록 모델에 적용할 보수적(비싼 쪽) 폴백 단가 키. */
const FALLBACK_PRICING_KEY = 'gemini-2.5-pro';

export const DEFAULT_USD_KRW = 1400;

/**
 * 호출 사용량 합계 → 원화 추정 원가. 실패했지만 과금된 시도(빈 응답 등)도
 * usages에 포함해 부르면 실제 청구액에 가까워진다.
 */
export function estimateCostKrw(usages: CallUsage[], usdKrw: number = DEFAULT_USD_KRW): number {
  return usages.reduce((sum, u) => {
    const p = PRICING_USD_PER_M[u.model] ?? PRICING_USD_PER_M[FALLBACK_PRICING_KEY];
    return sum + ((u.inputTokens * p.input + u.outputTokens * p.output) / 1_000_000) * usdKrw;
  }, 0);
}
