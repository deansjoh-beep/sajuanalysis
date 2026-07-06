/**
 * 2장 오행 세력 점수화 (docs/myeongri-standard/02-strength-score.md)
 *
 * §2.2.1 위치별 가중치: 연간10 연지10 월간10 월지35 일지15 시간10 시지10 (합 100)
 * §2.3.1 지지 가중치는 A-1 월률분야표의 일수 비례로 지장간에 배분 (일수 ÷ 30)
 * §2.3.3 충 감쇠가 성립한 지지는 배분 후 전체 기여에 ×0.5
 * §2.4.1 천간 세력 = 위치 가중치 × 통근 계수 (통근 1.0 / 무근 0.5)
 * §2.4.2 통근 위치 차등 없음. 충 감쇠된 지지도 통근 판정에는 유효.
 * §2.5.1 아군 = 비겁(일간 오행) + 인성(일간을 생하는 오행), 적군 = 나머지 3오행
 * §2.6.1 세력 비율 = 아군 ÷ (아군+적군) × 100
 * §2.7   득령 = 월지 본기 아군 / 득지 = 일지 본기 아군 / 득세 = 월지·일지 제외 아군 ≥50%
 * §8.3.1 시간 미상은 시주 항목 제외(비율식 자동 정규화)
 */
import {
  HIDDEN_STEM_DAYS, STEM_ELEMENT, PRODUCED_BY, branchMainStem,
  type Ohaeng, type PillarPos, type RulesInput,
} from './tables';
import type { ChungEffect } from './hapchung-effect';

/** §2.2.1 */
const WEIGHTS = {
  yearStem: 10, yearBranch: 10,
  monthStem: 10, monthBranch: 35,
  dayBranch: 15,
  hourStem: 10, hourBranch: 10,
} as const;

export type StrengthContribution = {
  pos: PillarPos;
  kind: 'stem' | 'branch';
  /** 기여 주체 글자(지지는 지장간 글자) */
  stem: string;
  element: Ohaeng;
  amount: number;
  ally: boolean;
};

export type StrengthScore = {
  ally: number;
  enemy: number;
  /** §2.6.1 — 반올림 전 원값(경계 비교용, §1.4.1) */
  ratio: number;
  /** 오행별 세력 합(§6.2.2 억제 용신 선택용) */
  elementTotals: Record<Ohaeng, number>;
  deukryeong: boolean;
  deukji: boolean;
  deukse: boolean;
  contributions: StrengthContribution[];
};

export const scoreStrength = (input: RulesInput, chung: ChungEffect): StrengthScore => {
  const dayEl = STEM_ELEMENT[input.day.stem];
  const allySet = new Set<Ohaeng>([dayEl, PRODUCED_BY[dayEl]]); // §2.5.1

  const branches = [input.year.branch, input.month.branch, input.day.branch, input.hour?.branch]
    .filter((b): b is string => Boolean(b));
  // §2.4.1 통근: 같은 오행의 지장간이 원국 지지 어디든 존재 (§1.3.4)
  const rootedElements = new Set<Ohaeng>();
  for (const b of branches) {
    for (const h of HIDDEN_STEM_DAYS[b] ?? []) rootedElements.add(STEM_ELEMENT[h.stem]);
  }

  const contributions: StrengthContribution[] = [];
  const pushStem = (pos: PillarPos, stem: string, weight: number) => {
    const element = STEM_ELEMENT[stem];
    const amount = weight * (rootedElements.has(element) ? 1 : 0.5); // §2.4.1
    contributions.push({ pos, kind: 'stem', stem, element, amount, ally: allySet.has(element) });
  };
  const pushBranch = (pos: PillarPos, branch: string, weight: number) => {
    const damped = weight * chung.damping[pos]; // §2.3.3
    for (const h of HIDDEN_STEM_DAYS[branch] ?? []) {
      const element = STEM_ELEMENT[h.stem];
      const amount = damped * (h.days / 30); // §2.3.1
      contributions.push({ pos, kind: 'branch', stem: h.stem, element, amount, ally: allySet.has(element) });
    }
  };

  pushStem('year', input.year.stem, WEIGHTS.yearStem);
  pushBranch('year', input.year.branch, WEIGHTS.yearBranch);
  pushStem('month', input.month.stem, WEIGHTS.monthStem);
  pushBranch('month', input.month.branch, WEIGHTS.monthBranch);
  pushBranch('day', input.day.branch, WEIGHTS.dayBranch);
  if (input.hour) { // §8.3.1 시간 미상 제외
    pushStem('hour', input.hour.stem, WEIGHTS.hourStem);
    pushBranch('hour', input.hour.branch, WEIGHTS.hourBranch);
  }

  let ally = 0;
  let enemy = 0;
  const elementTotals: Record<Ohaeng, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const c of contributions) {
    elementTotals[c.element] += c.amount;
    if (c.ally) ally += c.amount;
    else enemy += c.amount;
  }
  const total = ally + enemy;
  const ratio = total > 0 ? (ally / total) * 100 : 50;

  // §2.7 득령·득지·득세
  const deukryeong = allySet.has(STEM_ELEMENT[branchMainStem(input.month.branch)]);
  const deukji = allySet.has(STEM_ELEMENT[branchMainStem(input.day.branch)]);
  const isDeukseScope = (c: StrengthContribution) =>
    !(c.kind === 'branch' && (c.pos === 'month' || c.pos === 'day')); // §2.7.3
  let seAlly = 0;
  let seTotal = 0;
  for (const c of contributions) {
    if (!isDeukseScope(c)) continue;
    seTotal += c.amount;
    if (c.ally) seAlly += c.amount;
  }
  const deukse = seTotal > 0 && seAlly / seTotal >= 0.5;

  return { ally, enemy, ratio, elementTotals, deukryeong, deukji, deukse, contributions };
};
