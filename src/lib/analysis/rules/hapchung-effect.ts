/**
 * 7장 합·충의 판정 개입 (docs/myeongri-standard/07-hapchung.md)
 *
 * §7.1.3 "감쇠는 인접 지지(연-월, 월-일, 일-시) 사이의 충에만 적용한다.
 *         원격 충(연-일, 연-시, 월-시)은 태그만 생성하고 감쇠하지 않는다."
 * §7.1.4 "성립한 충의 양쪽 지지 모두 세력 기여 ×0.5. 복수의 충에 걸려도 감쇠는 1회만."
 * §7.2   합·천간충·운 합충은 판정 불개입(태그는 기존 SajuAnalysis 로직 소관).
 */
import { CHUNG_MAP, type PillarPos, type RulesInput } from './tables';

export type ChungEffect = {
  /** 인접 충(감쇠 적용) — 위치 쌍 */
  adjacent: Array<[PillarPos, PillarPos]>;
  /** 원격 충(태그만, 감쇠 없음 §7.1.3) */
  distant: Array<[PillarPos, PillarPos]>;
  /** 위치별 지지 세력 계수 — 감쇠 대상 0.5, 그 외 1 (§7.1.4, §2.3.3) */
  damping: Record<PillarPos, number>;
  /** 월지가 감쇠 대상이면 격 순도 하락 (§7.1.4 → §5.1.4) */
  monthDamaged: boolean;
};

const ADJACENT_PAIRS: Array<[PillarPos, PillarPos]> = [['year', 'month'], ['month', 'day'], ['day', 'hour']];
const DISTANT_PAIRS: Array<[PillarPos, PillarPos]> = [['year', 'day'], ['year', 'hour'], ['month', 'hour']];

export const detectChungEffect = (input: RulesInput): ChungEffect => {
  const branchOf: Record<PillarPos, string | null> = {
    year: input.year.branch,
    month: input.month.branch,
    day: input.day.branch,
    hour: input.hour?.branch ?? null,
  };
  const isChung = (a: string | null, b: string | null) => Boolean(a && b && CHUNG_MAP[a] === b);

  const adjacent = ADJACENT_PAIRS.filter(([a, b]) => isChung(branchOf[a], branchOf[b]));
  const distant = DISTANT_PAIRS.filter(([a, b]) => isChung(branchOf[a], branchOf[b]));

  const damping: Record<PillarPos, number> = { year: 1, month: 1, day: 1, hour: 1 };
  for (const [a, b] of adjacent) {
    damping[a] = 0.5; // 중복 충이어도 1회만(대입이므로 자동 보장, §7.1.4)
    damping[b] = 0.5;
  }

  return { adjacent, distant, damping, monthDamaged: damping.month === 0.5 };
};
