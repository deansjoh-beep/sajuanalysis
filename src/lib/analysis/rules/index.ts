/**
 * 명리 판단 기준서 규칙 엔진 — 판정 파이프라인 (§1.2.1)
 *
 *   명식 → [7장] 충 감쇠 → [2장] 세력 점수화 → [3장] 강약 분류
 *        → [4장] 조후 → [5장] 격국 → [6장] 용신·희기신
 *
 * 뒤 단계는 앞 단계의 출력만 참조한다(역참조 금지, §1.2.1).
 * 전 단계 결정론(§1.2.2) — 동일 명식은 언제나 동일 출력.
 * 확신 표기: provisional이 아니라 자평 표준 판정이다(§1.1.3, standard: 'japyeong').
 */
import { detectChungEffect, type ChungEffect } from './hapchung-effect';
import { scoreStrength, type StrengthScore } from './strength-score';
import { classifyStrength, type StrengthClass } from './strength-class';
import { assessJohoo, type JohooResult } from './johoo';
import { determineGyeok, type GyeokResult } from './gyeok';
import { decideYongshin, type YongshinRules } from './yongshin';
import { STEM_ELEMENT, type PillarPos, type RulesInput } from './tables';

export type { RulesInput, RulePillar } from './tables';

export type RulesAnalysis = {
  /** §1.1.1 채택 유파 선언 — 자평명리 표준 */
  standard: 'japyeong';
  chung: {
    adjacent: Array<[PillarPos, PillarPos]>;
    distant: Array<[PillarPos, PillarPos]>;
    monthDamaged: boolean;
  };
  strength: {
    ally: number;
    enemy: number;
    ratio: number;
    class: StrengthClass;
    deukryeong: boolean;
    deukji: boolean;
    deukse: boolean;
  };
  johoo: { t: number; status: JohooResult['status']; extreme: boolean };
  gyeok: {
    name: GyeokResult['name'];
    basisStem: string;
    transparent: boolean;
    damaged: boolean;
    seongpae: GyeokResult['seongpae'];
  };
  yongshin: Omit<YongshinRules, 'element'> & { element: YongshinRules['element'] };
};

/** 명식(한자 간지)을 기준서 파이프라인으로 판정한다. 잘못된 간지는 null. */
export const analyzeByRules = (input: RulesInput): RulesAnalysis | null => {
  const stems = [input.year.stem, input.month.stem, input.day.stem, ...(input.hour ? [input.hour.stem] : [])];
  if (stems.some((s) => !STEM_ELEMENT[s])) return null;

  const chung: ChungEffect = detectChungEffect(input); // 7장
  const strength: StrengthScore = scoreStrength(input, chung); // 2장
  const cls = classifyStrength(strength.ratio); // 3장
  const johoo = assessJohoo(input); // 4장
  const gyeok = determineGyeok(input, chung); // 5장
  const yongshin = decideYongshin(input, strength, johoo, gyeok); // 6장

  return {
    standard: 'japyeong',
    chung: { adjacent: chung.adjacent, distant: chung.distant, monthDamaged: chung.monthDamaged },
    strength: {
      ally: strength.ally,
      enemy: strength.enemy,
      ratio: strength.ratio,
      class: cls,
      deukryeong: strength.deukryeong,
      deukji: strength.deukji,
      deukse: strength.deukse,
    },
    johoo: { t: johoo.t, status: johoo.status, extreme: johoo.extreme },
    gyeok: {
      name: gyeok.name,
      basisStem: gyeok.basisStem,
      transparent: gyeok.transparent,
      damaged: gyeok.damaged,
      seongpae: gyeok.seongpae,
    },
    yongshin,
  };
};

/** "丙戌" 같은 간지 문자열 명식으로 판정한다(테스트·골든셋 편의). */
export const analyzeByRulesFromGanzhi = (pillars: {
  year: string; month: string; day: string; hour: string | null;
}): RulesAnalysis | null => {
  const parse = (gz: string | null) => {
    if (!gz || gz.length < 2) return null;
    return { stem: gz[0], branch: gz[1] };
  };
  const year = parse(pillars.year);
  const month = parse(pillars.month);
  const day = parse(pillars.day);
  if (!year || !month || !day) return null;
  return analyzeByRules({ year, month, day, hour: parse(pillars.hour) });
};
