/**
 * 규칙 엔진 조견표 정본 — 「명리 판단 기준서」 부록 (docs/myeongri-standard/appendix-tables.md)
 *
 * 모든 §번호는 기준서 조항을 인용한다(조항 번호는 불변 — §1.2 규약).
 * A-1 표는 `src/utils/saju.ts`의 `hiddenStems`(구성·순서)와 일치해야 하며,
 * 그 일치는 스펙 테스트로 강제한다(§8.5).
 */

export type Ohaeng = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type PillarPos = 'year' | 'month' | 'day' | 'hour';

export type RulePillar = { stem: string; branch: string };
/** 규칙 엔진 입력 — 만세력 산출 이후의 명식(한자 간지). 시간 미상은 hour=null (§8.3). */
export type RulesInput = { year: RulePillar; month: RulePillar; day: RulePillar; hour: RulePillar | null };

export const STEM_ELEMENT: Record<string, Ohaeng> = {
  '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth',
  '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water',
};

/** A-1 월률분야표 — [여기, (중기), 본기] 순, 일수 합 30 (§2.3.1, §1.3.6) */
export const HIDDEN_STEM_DAYS: Record<string, Array<{ stem: string; days: number }>> = {
  '子': [{ stem: '壬', days: 10 }, { stem: '癸', days: 20 }],
  '丑': [{ stem: '癸', days: 9 }, { stem: '辛', days: 3 }, { stem: '己', days: 18 }],
  '寅': [{ stem: '戊', days: 7 }, { stem: '丙', days: 7 }, { stem: '甲', days: 16 }],
  '卯': [{ stem: '甲', days: 10 }, { stem: '乙', days: 20 }],
  '辰': [{ stem: '乙', days: 9 }, { stem: '癸', days: 3 }, { stem: '戊', days: 18 }],
  '巳': [{ stem: '戊', days: 7 }, { stem: '庚', days: 7 }, { stem: '丙', days: 16 }],
  '午': [{ stem: '丙', days: 11 }, { stem: '己', days: 9 }, { stem: '丁', days: 10 }],
  '未': [{ stem: '丁', days: 9 }, { stem: '乙', days: 3 }, { stem: '己', days: 18 }],
  '申': [{ stem: '戊', days: 7 }, { stem: '壬', days: 7 }, { stem: '庚', days: 16 }],
  '酉': [{ stem: '庚', days: 10 }, { stem: '辛', days: 20 }],
  '戌': [{ stem: '辛', days: 9 }, { stem: '丁', days: 3 }, { stem: '戊', days: 18 }],
  '亥': [{ stem: '戊', days: 7 }, { stem: '甲', days: 5 }, { stem: '壬', days: 18 }],
};

/** 지지의 본기(표면 오행 대표) — A-1 마지막 항목 (§1.3.6). */
export const branchMainStem = (branch: string): string => {
  const entries = HIDDEN_STEM_DAYS[branch];
  return entries ? entries[entries.length - 1].stem : '';
};

/** A-2 오행 생극 (§6.3 희기신 도출용) */
export const PRODUCES: Record<Ohaeng, Ohaeng> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
export const PRODUCED_BY: Record<Ohaeng, Ohaeng> = { wood: 'water', fire: 'wood', earth: 'fire', metal: 'earth', water: 'metal' };
export const CONTROLS: Record<Ohaeng, Ohaeng> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
export const CONTROLLED_BY: Record<Ohaeng, Ohaeng> = { wood: 'metal', earth: 'wood', water: 'earth', fire: 'water', metal: 'fire' };

/** A-3 지지충 6쌍 (§7.1.1) */
export const CHUNG_MAP: Record<string, string> = {
  '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅',
  '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳',
};

/** A-4 한열 지지 (§4.2.1) */
export const COLD_BRANCHES = ['亥', '子', '丑'];
export const HOT_BRANCHES = ['巳', '午', '未'];

export const ELEMENT_KO: Record<Ohaeng, string> = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };
