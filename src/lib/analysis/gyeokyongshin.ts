/**
 * 격국(格局)·용신(用神) 판정 — 구조화 모듈 (Phase 1-2)
 *
 * ⚠️ **provisional(잠정) 휴리스틱이다. 만세력(절기·간지)과 달리 검증된 정답이 없다.**
 * 격국·용신은 유파(자평명리·궁통보감·적천수 등)마다 판정 기준이 근본적으로 다르며,
 * 단일 "정답"으로 교차검증할 KASI 같은 권위 기준이 존재하지 않는다.
 * 따라서 이 모듈의 출력은 모두 `provisional: true`로 표기하고, 리포트 프롬프트는 이를
 * "경향 참고"로만 사용해야 한다(단정 금지). 규칙 엔진 기반 정식 판정은 Phase 3 과제이며,
 * 채택 유파는 OWNER 결정 사항이다(docs/decisions.md D-1-6 대기).
 *
 * 이 모듈이 하는 일(기존 saju.ts의 산재한 휴리스틱을 정리·구조화):
 *   - 신강/신약: 생조(비겁+인성) 세력 가중 점수 + 득령·득지·득세 3분해(투명화).
 *   - 억부용신: 신강이면 억제(관성 오행), 신약이면 생조(인성 오행).
 *   - 조후용신: 월지 계절 편향(한랭/조열) 시 우선.
 *   - 격국: 월지 지장간의 투간(透干) 여부로 격을 정하고 십신명 부여.
 *
 * 수치·최종 선택 로직은 기존 구현과 동일하게 유지(런타임 통변 텍스트 불변). 추가된 것은
 * 타입·투명 신호(득령/득지/득세·투간 플래그·provisional)와 격명 정본화(비견→건록격,
 * 겁재→양인격)뿐이다.
 */

import { calculateDeity, elementMap, hiddenStems, hanjaToHangul } from '../../utils/saju';

export type OhaengElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export type BodyStrength = '극신강' | '신강' | '중립' | '신약' | '극신약';

const ELEMENT_KO: Record<OhaengElement, string> = {
  wood: '목(木)',
  fire: '화(火)',
  earth: '토(土)',
  metal: '금(金)',
  water: '수(水)',
};

/** 일간을 생조(生助)하는 오행: [같은 오행(비겁), 나를 생하는 오행(인성)] */
const SUPPORT_ELEMENTS: Record<OhaengElement, OhaengElement[]> = {
  wood: ['wood', 'water'],
  fire: ['fire', 'wood'],
  earth: ['earth', 'fire'],
  metal: ['metal', 'earth'],
  water: ['water', 'metal'],
};

/** 나를 극하는 오행(관성) — 억부용신(신강 시 억제) */
const CONTROLLED_BY: Record<OhaengElement, OhaengElement> = {
  wood: 'metal', fire: 'water', earth: 'wood', metal: 'fire', water: 'earth',
};

/** 나를 생하는 오행(인성) — 억부용신(신약 시 생조) */
const PRODUCED_BY: Record<OhaengElement, OhaengElement> = {
  wood: 'water', fire: 'wood', earth: 'fire', metal: 'earth', water: 'metal',
};

/** 생조 세력 가중치(합계 100). 월지(월령)가 최대. */
const WEIGHTS = {
  yearStem: 10, yearBranch: 10,
  monthStem: 10, monthBranch: 35,
  dayBranch: 15,
  hourStem: 10, hourBranch: 10,
} as const;

/** 억부 방향 전환 임계(생조 세력 과반). score >= EOKBU_PIVOT → 신강 계열(억제 필요). */
const EOKBU_PIVOT = 50;

const ADVICE: Record<OhaengElement, { color: string; direction: string; numbers: string; action: string }> = {
  wood: { color: '초록색', direction: '동쪽', numbers: '3, 8', action: '독서, 산책, 새로운 시작' },
  fire: { color: '빨간색', direction: '남쪽', numbers: '2, 7', action: '운동, 열정적인 활동, 예절' },
  earth: { color: '노란색', direction: '중앙', numbers: '5, 10', action: '명상, 신용 유지, 안정' },
  metal: { color: '흰색', direction: '서쪽', numbers: '4, 9', action: '정리정돈, 결단력, 운동' },
  water: { color: '검은색', direction: '북쪽', numbers: '1, 6', action: '지혜 습득, 휴식, 유연함' },
};

const HAN_MONTHS = ['亥', '子', '丑']; // 한랭(寒冷)
const JO_MONTHS = ['巳', '午', '未']; // 조열(燥熱)

export type GangyakAssessment = {
  score: number; // 0~100 생조 세력 점수
  strength: BodyStrength;
  /** 억부 방향: score >= EOKBU_PIVOT (억제 필요) */
  isStrong: boolean;
  deukryeong: boolean; // 득령(得令): 월지가 일간을 생조
  deukji: boolean; // 득지(得地): 일지가 일간을 생조
  deukse: boolean; // 득세(得勢): 생조 세력 과반
};

export type GyeokResult = {
  /** 격명 (예: '정관격', '건록격', '양인격'). 판정 불가 시 null. */
  name: string | null;
  /** 격을 정한 천간(한자). */
  basisStem: string | null;
  /** 투간(透干) 여부. false면 월지 본기 기준(불투). */
  transparent: boolean;
  /** 십신 구성 요약 (예: '정관 2개, 편재 1개'). */
  composition: string;
  provisional: true;
};

export type YongshinResult = {
  /** 최종 용신 오행. */
  primary: OhaengElement;
  /** 채택 근거: 조후 우선이면 '조후', 아니면 '억부'. */
  method: '억부' | '조후';
  eokbu: OhaengElement;
  johoo: OhaengElement | null;
  johooStatus: '한랭' | '조열' | '평온';
  advice: (typeof ADVICE)[OhaengElement];
  logicBasis: string;
  provisional: true;
};

export type GyeokYongshin = {
  dayMaster: string;
  dayMasterElement: OhaengElement;
  gangyak: GangyakAssessment;
  gyeok: GyeokResult;
  yongshin: YongshinResult;
  /** 유파 의존성 경고 문구. */
  schoolNote: string;
  provisional: true;
};

const SCHOOL_NOTE =
  '격국·용신은 유파에 따라 판정이 달라지는 잠정 해석입니다(검증된 단일 정답 없음). 참고 경향으로만 활용하세요.';

/** getSajuData 반환 pillar와 호환되는 최소 구조(element는 오행 키 문자열). */
type Pillar = {
  stem: { hanja: string; element: string; deity?: string };
  branch: { hanja: string; element: string; deity?: string };
};

/**
 * 사주 8자(구조화 pillar 배열)로 격국·용신을 판정한다.
 * @param sajuData getSajuData 반환 배열 [시주, 일주, 월주, 년주]
 */
export const analyzeGyeokYongshin = (sajuData: Pillar[]): GyeokYongshin | null => {
  if (!sajuData || sajuData.length < 4) return null;

  // 내부 정렬 [년, 월, 일, 시]
  const [year, month, day, hour] = [...sajuData].reverse();
  const dayStem = day.stem.hanja;
  const dayElement = day.stem.element as OhaengElement;
  if (!dayElement || !SUPPORT_ELEMENTS[dayElement]) return null;

  const meSupport = SUPPORT_ELEMENTS[dayElement];
  const supports = (el: string) => meSupport.includes(el as OhaengElement);

  // ── 신강/신약: 생조 세력 가중 점수 ──
  let score = 0;
  if (supports(year.stem.element)) score += WEIGHTS.yearStem;
  if (supports(year.branch.element)) score += WEIGHTS.yearBranch;
  if (supports(month.stem.element)) score += WEIGHTS.monthStem;
  if (supports(month.branch.element)) score += WEIGHTS.monthBranch;
  if (supports(day.branch.element)) score += WEIGHTS.dayBranch;
  if (supports(hour.stem.element)) score += WEIGHTS.hourStem;
  if (supports(hour.branch.element)) score += WEIGHTS.hourBranch;

  let strength: BodyStrength = '중립';
  if (score >= 80) strength = '극신강';
  else if (score >= 60) strength = '신강';
  else if (score >= 40) strength = '중립';
  else if (score >= 20) strength = '신약';
  else strength = '극신약';

  const gangyak: GangyakAssessment = {
    score,
    strength,
    isStrong: score >= EOKBU_PIVOT,
    deukryeong: supports(month.branch.element),
    deukji: supports(day.branch.element),
    deukse: score >= EOKBU_PIVOT,
  };

  // ── 억부용신 ──
  const eokbu: OhaengElement = gangyak.isStrong ? CONTROLLED_BY[dayElement] : PRODUCED_BY[dayElement];

  // ── 조후용신 ──
  const monthBranch = month.branch.hanja;
  let johooStatus: YongshinResult['johooStatus'] = '평온';
  let johoo: OhaengElement | null = null;
  if (HAN_MONTHS.includes(monthBranch)) {
    johooStatus = '한랭';
    johoo = 'fire';
  } else if (JO_MONTHS.includes(monthBranch)) {
    johooStatus = '조열';
    johoo = 'water';
  }

  // ── 최종 용신: 조후 편향이 뚜렷하면 조후 우선, 아니면 억부 ──
  const method: YongshinResult['method'] = johoo ? '조후' : '억부';
  const primary: OhaengElement = johoo ?? eokbu;
  const logicBasis = johoo
    ? `계절적 요인(${johooStatus})이 강하여 조후 균형(${ELEMENT_KO[johoo]})을 우선합니다.`
    : `일간의 기운이 ${strength}하므로 억부 균형(${ELEMENT_KO[eokbu]})이 필요합니다.`;

  const yongshin: YongshinResult = {
    primary,
    method,
    eokbu,
    johoo,
    johooStatus,
    advice: ADVICE[primary],
    logicBasis,
    provisional: true,
  };

  // ── 격국: 월지 지장간 투간 판정 ──
  const gyeok = determineGyeok(sajuData, dayStem, monthBranch);

  return {
    dayMaster: dayStem,
    dayMasterElement: dayElement,
    gangyak,
    gyeok,
    yongshin,
    schoolNote: SCHOOL_NOTE,
    provisional: true,
  };
};

/** 한글 지장간 이름 → 한자 천간. (hiddenStems는 한글 저장) */
const hangulStemToHanja = (hangul: string): string =>
  Object.entries(hanjaToHangul).find(([, v]) => v === hangul)?.[0] ?? '';

const determineGyeok = (sajuData: Pillar[], dayStem: string, monthBranch: string): GyeokResult => {
  const [year, month, day, hour] = [...sajuData].reverse();

  // 월지 지장간(한자). hiddenStems 배열 = [여기, (중기), 본기] → 본기가 마지막.
  const hiddenHanjas = (hiddenStems[monthBranch] || []).map(hangulStemToHanja).filter(Boolean);

  // 일간을 제외한 천간(년·월·시)
  const heavenlyStems = [year.stem.hanja, month.stem.hanja, hour.stem.hanja];

  // 투간 판정: 본기 > 중기 > 여기 순으로 천간에 노출된 지장간을 채택
  let gyeokStem = '';
  let transparent = false;
  for (let i = hiddenHanjas.length - 1; i >= 0; i--) {
    if (heavenlyStems.includes(hiddenHanjas[i])) {
      gyeokStem = hiddenHanjas[i];
      transparent = true;
      break;
    }
  }
  // 불투(不透) 시 본기로 격을 정함
  if (!gyeokStem && hiddenHanjas.length > 0) {
    gyeokStem = hiddenHanjas[hiddenHanjas.length - 1];
  }

  const composition = summarizeComposition(sajuData);

  if (!gyeokStem) {
    return { name: null, basisStem: null, transparent: false, composition, provisional: true };
  }

  const deity = calculateDeity(dayStem, gyeokStem);
  const name = gyeokNameFromDeity(deity);

  return { name, basisStem: gyeokStem, transparent, composition, provisional: true };
};

/** 십신명 → 격명. 비겁은 건록/양인격으로 정본화(월지 비견=建祿, 겁재=陽刃). */
const gyeokNameFromDeity = (deity: string): string => {
  if (!deity) return '특수격';
  if (deity === '비견') return '건록격';
  if (deity === '겁재') return '양인격';
  return `${deity}격`;
};

/** 명식 전체의 십신 분포 요약(일간 제외, 개수 내림차순). */
const summarizeComposition = (sajuData: Pillar[]): string => {
  const counts: Record<string, number> = {};
  for (const p of sajuData) {
    if (p.stem.deity && p.stem.deity !== '일간') counts[p.stem.deity] = (counts[p.stem.deity] || 0) + 1;
    if (p.branch.deity) counts[p.branch.deity] = (counts[p.branch.deity] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} ${count}개`)
    .join(', ');
};

// ============================================================
// 레거시 어댑터 — 기존 saju.ts 반환 형태 호환 (App.tsx·리포트·택일 무변경)
// ============================================================

/** 기존 calculateYongshin 반환 형태로 변환. */
export const toLegacyYongshin = (r: GyeokYongshin) => {
  const johooStatusKo = r.yongshin.johooStatus === '한랭' ? '한랭(寒冷)' : r.yongshin.johooStatus === '조열' ? '조열(燥熱)' : '평온';
  return {
    strength: r.gangyak.strength,
    score: r.gangyak.score,
    johooStatus: johooStatusKo,
    eokbuYongshin: ELEMENT_KO[r.yongshin.eokbu],
    johooYongshin: r.yongshin.johoo ? ELEMENT_KO[r.yongshin.johoo] : '균형 잡힘',
    yongshin: ELEMENT_KO[r.yongshin.primary],
    logicBasis: r.yongshin.logicBasis,
    advice: r.yongshin.advice,
  };
};

/** 기존 calculateGyeok 반환 형태로 변환. */
export const toLegacyGyeok = (r: GyeokYongshin) => ({
  gyeok: r.gyeok.name ?? '특수격',
  composition: r.gyeok.composition,
});

export { ELEMENT_KO };
