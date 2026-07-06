/**
 * 5장 격국 판정 (docs/myeongri-standard/05-gyeok.md)
 *
 * §5.1.2 투간 검사: 월지 지장간과 동일 글자가 연간·월간·시간에 노출(일간 제외, §1.3.5).
 *        복수 투간 시 위치 우선 — 월간 > 시간 > 연간.
 * §5.1.3 무투간이면 월지 본기로 취격 (모든 명식이 격을 가짐, transparent=false)
 * §5.1.4 순도 플래그 transparent·damaged(월지 충, §7.1.4) — 격명·용신 선정은 불변
 * §5.2   격명 = 취격 천간의 일간 대비 십신 (비견=건록격, 겁재=양인격 정본)
 * §5.3   순용·역용 상신 표 + 파격 요소 (자평진전 통설, 2026-07-06 확정)
 * §5.3.2 "노출" = 연간·월간·시간(일간 제외) / "전무" = 천간 4자 + 지지 본기 4자
 * §5.4.1 성패: 파격 요소 → 파격 경향 / 상신 천간 노출 → 성격 / 그 외 → 미성
 * §5.6.1 외격(종격·화격)은 인정하지 않는다.
 */
import { calculateDeity } from '../../../utils/saju.js';
import {
  HIDDEN_STEM_DAYS, STEM_ELEMENT, PRODUCES, PRODUCED_BY, CONTROLS, CONTROLLED_BY,
  branchMainStem, type Ohaeng, type RulesInput,
} from './tables';
import type { ChungEffect } from './hapchung-effect';

export type GyeokName =
  | '건록격' | '양인격' | '식신격' | '상관격' | '편재격'
  | '정재격' | '편관격' | '정관격' | '편인격' | '정인격';

export type Seongpae = '성격' | '파격 경향' | '미성';

/** §5.3 상신·파격 표의 십신 범주 */
type Category = '재성' | '인성' | '관성' | '식상' | '식신' | '편관' | '정관' | '상관' | '편인' | '비겁';

const CATEGORY_DEITIES: Record<Category, string[]> = {
  '재성': ['정재', '편재'],
  '인성': ['정인', '편인'],
  '관성': ['정관', '편관'],
  '식상': ['식신', '상관'],
  '식신': ['식신'],
  '편관': ['편관'],
  '정관': ['정관'],
  '상관': ['상관'],
  '편인': ['편인'],
  '비겁': ['비견', '겁재'],
};

/** 십신 범주 → 오행 (일간 오행 기준) */
const categoryElement = (cat: Category, dayEl: Ohaeng): Ohaeng => {
  switch (cat) {
    case '비겁': return dayEl;
    case '인성': case '편인': return PRODUCED_BY[dayEl];
    case '식상': case '식신': case '상관': return PRODUCES[dayEl];
    case '재성': return CONTROLS[dayEl];
    case '관성': case '편관': case '정관': return CONTROLLED_BY[dayEl];
  }
};

const GYEOK_NAME: Record<string, GyeokName> = {
  '비견': '건록격', '겁재': '양인격', '식신': '식신격', '상관': '상관격',
  '편재': '편재격', '정재': '정재격', '편관': '편관격', '정관': '정관격',
  '편인': '편인격', '정인': '정인격',
};

/** §5.3.1 상신 후보(①→② 서열)와 파격 요소 */
const SANGSIN_TABLE: Record<GyeokName, {
  sangsin: Category[];
  pagyeok: { type: '노출'; category: Category } | { type: '전무'; categories: Category[] };
}> = {
  '정관격': { sangsin: ['재성', '인성'], pagyeok: { type: '노출', category: '상관' } },
  '정재격': { sangsin: ['관성', '식상'], pagyeok: { type: '노출', category: '비겁' } },
  '편재격': { sangsin: ['관성', '식상'], pagyeok: { type: '노출', category: '비겁' } },
  '정인격': { sangsin: ['관성', '식상'], pagyeok: { type: '노출', category: '재성' } },
  '편인격': { sangsin: ['관성', '식상'], pagyeok: { type: '노출', category: '재성' } },
  '식신격': { sangsin: ['재성', '편관'], pagyeok: { type: '노출', category: '편인' } },
  '편관격': { sangsin: ['식신', '인성'], pagyeok: { type: '노출', category: '재성' } },
  '상관격': { sangsin: ['인성', '재성'], pagyeok: { type: '노출', category: '정관' } },
  '건록격': { sangsin: ['관성', '재성'], pagyeok: { type: '전무', categories: ['재성', '관성'] } },
  '양인격': { sangsin: ['편관', '정관'], pagyeok: { type: '전무', categories: ['관성'] } },
};

export type GyeokResult = {
  name: GyeokName;
  basisStem: string;
  transparent: boolean;
  damaged: boolean;
  seongpae: Seongpae;
  /** §6.2.4용 — 상신 후보 중 원국 천간에 노출된 첫 범주의 오행(없으면 null) */
  sangsinExposedElement: Ohaeng | null;
  /** §6.2.4용 — ①후보 범주의 오행(상신 부재 시 용신 대체) */
  sangsinPrimaryElement: Ohaeng;
};

export const determineGyeok = (input: RulesInput, chung: ChungEffect): GyeokResult => {
  const dayStem = input.day.stem;
  const dayEl = STEM_ELEMENT[dayStem];
  const hidden = (HIDDEN_STEM_DAYS[input.month.branch] ?? []).map((h) => h.stem);

  // §5.1.2 위치 우선 스캔: 월간 > 시간 > 연간
  const scanStems = [input.month.stem, input.hour?.stem, input.year.stem]
    .filter((s): s is string => Boolean(s));
  const transparentStem = scanStems.find((s) => hidden.includes(s)) ?? null;
  const basisStem = transparentStem ?? branchMainStem(input.month.branch); // §5.1.3

  const deity = calculateDeity(dayStem, basisStem);
  const name = GYEOK_NAME[deity] ?? '건록격';

  // §5.3.2 노출 = 연·월·시간 십신 / 전무 = 천간 4자 + 지지 본기 4자
  const exposedDeities = scanStems.map((s) => calculateDeity(dayStem, s));
  const branchMains = [input.year.branch, input.month.branch, input.day.branch, input.hour?.branch]
    .filter((b): b is string => Boolean(b))
    .map((b) => calculateDeity(dayStem, branchMainStem(b)));
  const surfaceDeities = [...exposedDeities, calculateDeity(dayStem, dayStem), ...branchMains];

  const rule = SANGSIN_TABLE[name];
  const inCategory = (deities: string[], cat: Category) =>
    deities.some((d) => CATEGORY_DEITIES[cat].includes(d));

  // §5.4.1 성패 3상태
  let broken = false;
  if (rule.pagyeok.type === '노출') {
    broken = inCategory(exposedDeities, rule.pagyeok.category);
  } else {
    broken = rule.pagyeok.categories.every((cat) => !inCategory(surfaceDeities, cat));
  }
  const exposedSangsin = rule.sangsin.find((cat) => inCategory(exposedDeities, cat)) ?? null;
  const seongpae: Seongpae = broken ? '파격 경향' : exposedSangsin ? '성격' : '미성';

  return {
    name,
    basisStem,
    transparent: Boolean(transparentStem),
    damaged: chung.monthDamaged, // §5.1.4
    seongpae,
    sangsinExposedElement: exposedSangsin ? categoryElement(exposedSangsin, dayEl) : null,
    sangsinPrimaryElement: categoryElement(rule.sangsin[0], dayEl),
  };
};
