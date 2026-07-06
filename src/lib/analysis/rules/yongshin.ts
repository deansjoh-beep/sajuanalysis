/**
 * 6장 용신·희신·기신 선정 (docs/myeongri-standard/06-yongshin.md)
 *
 * §6.2 주 용신 결정 트리:
 *   [1] 조후 극단(|t|=3) → 조후 오행 (§6.2.1)
 *   [2] r ≥ 60 → 억부(억제): 적군 3오행 중 원국 세력 최강, 동점 시 관성>식상>재성 (§6.2.2)
 *       r < 40 → 억부(부조): 인성 오행 고정 (§6.2.3)
 *   [3] 중화(40≤r<60) → 격국: 상신 후보 서열대로 원국 천간 존재 첫 후보의 오행,
 *       둘 다 부재면 ①후보 오행 + 상신 부재 플래그 (§6.2.4)
 * §6.3.1 희신=生용신 / 기신=克용신 / 구신=生기신 / 한신=나머지 (기계 도출)
 * §6.4.1 presentInNatal = 천간 4자 + 지지 본기 4자 표면 존재 여부
 * §6.4.2 |t|=2면 조후 오행을 johooHuisin으로 병기(주 용신·주 희신과 겹치면 생략)
 */
import {
  STEM_ELEMENT, PRODUCES, PRODUCED_BY, CONTROLS, CONTROLLED_BY, branchMainStem, ELEMENT_KO,
  type Ohaeng, type RulesInput,
} from './tables';
import type { StrengthScore } from './strength-score';
import type { JohooResult } from './johoo';
import type { GyeokResult } from './gyeok';

export type YongshinMethod = '조후' | '억부(억제)' | '억부(부조)' | '격국';

export type YongshinRules = {
  method: YongshinMethod;
  /** 오행 키(내부 연산용) */
  element: Ohaeng;
  /** 한글 표기(리포트·골든셋 표기, 예: '수') */
  primary: string;
  huisin: string;
  gisin: string;
  gusin: string;
  hansin: string;
  presentInNatal: boolean;
  /** §6.4.2 — 병기할 조후 희신(생략 시 null) */
  johooHuisin: string | null;
  /** §6.2.4 — 격국 용신인데 상신이 원국 천간에 없어 "운에서 보충" 서술이 필요한 경우 */
  sangsinAbsent: boolean;
};

const ALL_ELEMENTS: Ohaeng[] = ['wood', 'fire', 'earth', 'metal', 'water'];

export const decideYongshin = (
  input: RulesInput,
  strength: StrengthScore,
  johoo: JohooResult,
  gyeok: GyeokResult,
): YongshinRules => {
  const dayEl = STEM_ELEMENT[input.day.stem];

  let method: YongshinMethod;
  let element: Ohaeng;
  let sangsinAbsent = false;

  if (johoo.extreme && johoo.element) {
    method = '조후'; // §6.2.1
    element = johoo.element;
  } else if (strength.ratio >= 60) {
    method = '억부(억제)'; // §6.2.2 — 적군 최강, 동점 시 관성 > 식상 > 재성
    const candidates: Ohaeng[] = [CONTROLLED_BY[dayEl], PRODUCES[dayEl], CONTROLS[dayEl]]; // 관성·식상·재성
    const max = Math.max(...candidates.map((el) => strength.elementTotals[el]));
    element = candidates.find((el) => strength.elementTotals[el] === max)!;
  } else if (strength.ratio < 40) {
    method = '억부(부조)'; // §6.2.3 — 인성 고정
    element = PRODUCED_BY[dayEl];
  } else {
    method = '격국'; // §6.2.4
    if (gyeok.sangsinExposedElement) {
      element = gyeok.sangsinExposedElement;
    } else {
      element = gyeok.sangsinPrimaryElement;
      sangsinAbsent = true;
    }
  }

  // §6.3.1 생극 기계 도출
  const huisinEl = PRODUCED_BY[element];
  const gisinEl = CONTROLLED_BY[element];
  const gusinEl = PRODUCED_BY[gisinEl];
  const hansinEl = ALL_ELEMENTS.find((el) => ![element, huisinEl, gisinEl, gusinEl].includes(el))!;

  // §6.4.1 표면 = 천간 4자 + 지지 본기 4자
  const surfaceElements = new Set<Ohaeng>();
  const stems = [input.year.stem, input.month.stem, input.day.stem, input.hour?.stem];
  const branches = [input.year.branch, input.month.branch, input.day.branch, input.hour?.branch];
  for (const s of stems) if (s) surfaceElements.add(STEM_ELEMENT[s]);
  for (const b of branches) if (b) surfaceElements.add(STEM_ELEMENT[branchMainStem(b)]);

  // §6.4.2 조후 희신 병기 (극단은 [1]에서 주 용신이 됐으므로 |t|=2만 해당)
  let johooHuisin: string | null = null;
  if (Math.abs(johoo.t) === 2 && johoo.element && johoo.element !== element && johoo.element !== huisinEl) {
    johooHuisin = ELEMENT_KO[johoo.element];
  }

  return {
    method,
    element,
    primary: ELEMENT_KO[element],
    huisin: ELEMENT_KO[huisinEl],
    gisin: ELEMENT_KO[gisinEl],
    gusin: ELEMENT_KO[gusinEl],
    hansin: ELEMENT_KO[hansinEl],
    presentInNatal: surfaceElements.has(element),
    johooHuisin,
    sangsinAbsent,
  };
};
