/**
 * 3장 신강·신약 판정 (docs/myeongri-standard/03-strength-class.md)
 *
 * §3.2.1 (경계 하한 포함, §1.4.2):
 *   r ≥ 80 극신강 / 60 ≤ r < 80 신강 / 40 ≤ r < 60 중화 / 20 ≤ r < 40 신약 / r < 20 극신약
 * §3.2.2 억부 방향 전환점은 별도로 두지 않는다 — 6장 결정 트리가 이 분류만 참조.
 */

export type StrengthClass = '극신강' | '신강' | '중화' | '신약' | '극신약';

export const classifyStrength = (ratio: number): StrengthClass => {
  if (ratio >= 80) return '극신강';
  if (ratio >= 60) return '신강';
  if (ratio >= 40) return '중화';
  if (ratio >= 20) return '신약';
  return '극신약';
};
