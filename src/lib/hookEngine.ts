/**
 * 핵심 훅 엔진 — 무료 리포트 상단에 노출할 "가장 특징적인 포인트"를 규칙으로 선정한다.
 *
 * 원리: 만세력 통계(src/constants/hookStats.ts, 실제 엔진 표본 산출)상 해당 특징이
 * 전체 인구의 몇 %인지에 근거해 희소성 점수를 매기고, 가장 점수 높은 후보를
 * 결정론적으로 1개 고른다. 같은 사주는 언제 뽑아도 같은 훅이 나온다(타이밍형만
 * 현재 나이에 따라 달라짐).
 *
 * 훅 유형 4종:
 *  - rarity(희소성형): 괴강+양인 중첩, 오행 편중 등 통계적으로 드문 배치
 *  - tension(긴장형): 재다신약처럼 사주 내 모순 구조 — 언어화 가치가 높아 가중치 최상
 *  - timing(타이밍형): 대운 전환(교운기) 시점 — 구조 훅이 없을 때만 표면화
 *  - correction(오해 정정형): 극신약/극신강에 대한 통념 뒤집기
 *
 * 모든 훅은 본문 회수용 섹션 번호(sectionIndex)를 달고 나가며,
 * generateBasicReport가 프롬프트에 "해당 섹션에서 반드시 뒷받침하라"는 규칙을 주입한다.
 */
import { HOOK_STATS } from '../constants/hookStats';
import {
  calculateYongshin,
  getYangin,
  getCheoneulGuiin,
  isGoegang,
  isChung,
  isGwimun,
  isWonjin,
} from '../utils/saju';

export type CoreHookType = 'rarity' | 'tension' | 'timing' | 'correction';

export interface CoreHook {
  type: CoreHookType;
  /** 한 줄 훅 — 사용자에게 그대로 노출 */
  headline: string;
  /** 풀이 1~2문장 + 본문 회수 안내 */
  detail: string;
  /** 훅에 연결된 핵심 조언 — 당장 실행 가능한 한 문장 */
  advice: string;
  /** 전체 인구 중 비율(%). 검증 가능한 주장에만 존재 */
  rarityPercent: number | null;
  /** 본문에서 이 훅을 회수해야 하는 섹션 (1~6) */
  sectionIndex: number;
  sectionLabel: string;
  /** 본문 회수를 강제할 근거 용어들 (프롬프트 주입용) */
  evidence: string[];
  /** 선정 점수 (높을수록 우선) */
  score: number;
}

/** 6대 카테고리 라벨 — promptBuilders [6대 카테고리 리스트]와 순서 일치 */
const SECTION_LABELS = [
  '사주 원국 분석',
  '대운·세운 흐름',
  '생애 주기별 운세',
  '오행 밸런스 & 실생활 코칭',
  '용신 분석 & 개운법',
  '테마별 집중 분석',
] as const;

const SIPSIN_GROUP: Record<string, '비겁' | '식상' | '재성' | '관성' | '인성'> = {
  비견: '비겁', 겁재: '비겁',
  식신: '식상', 상관: '식상',
  편재: '재성', 정재: '재성',
  편관: '관성', 정관: '관성',
  편인: '인성', 정인: '인성',
};

const ELEMENT_KO: Record<string, string> = {
  wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)',
};

/** 사주 원국에서 훅 판정에 쓰는 특징 일체. 통계 스크립트와 반드시 동일 로직을 공유한다. */
export interface HookFeatures {
  hasHour: boolean;
  dayGanzhiHangul: string;
  strength: string;
  /** 일간 포함 전 글자 중 최다 오행 개수와 그 오행 */
  maxElementCount: number;
  dominantElement: string | null;
  /** 원국에 아예 없는 오행 개수 */
  missingElementCount: number;
  /** 일간 제외(년·월·시 천간 + 전 지지 본기) 오성 그룹 카운트 */
  groupCount: Record<'비겁' | '식상' | '재성' | '관성' | '인성', number>;
  /** 원국 지지 전체 쌍 중 충(沖) 쌍 수 */
  chungPairs: number;
  yanginPresent: boolean;
  cheoneulCount: number;
  goegangDay: boolean;
  /** 인접 지지(년-월, 월-일, 일-시) 귀문/원진 쌍 수 */
  gwimunAdjacent: number;
  wonjinAdjacent: number;
}

/**
 * getSajuData 반환 배열(역순 [시,일,월,년])에서 훅 특징을 추출한다.
 * 시주가 '?'(시간 미상)면 시주를 제외한 6글자 기준으로 집계한다.
 */
export function extractHookFeatures(sajuResult: any[], yongshinResult?: { strength: string } | null): HookFeatures | null {
  if (!Array.isArray(sajuResult) || sajuResult.length < 4) return null;
  const [hourP, dayP, monthP, yearP] = sajuResult;
  if (!dayP?.stem?.hanja || dayP.stem.hanja === '?') return null;

  const hasHour = hourP?.stem?.hanja !== '?' && !!hourP?.stem?.hanja;
  // 원국 순서 [년,월,일,(시)]
  const pillars = hasHour ? [yearP, monthP, dayP, hourP] : [yearP, monthP, dayP];

  const strength = (yongshinResult ?? calculateYongshin(sajuResult)).strength;

  const elCount: Record<string, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of pillars) {
    if (p.stem.element) elCount[p.stem.element]++;
    if (p.branch.element) elCount[p.branch.element]++;
  }
  let maxElementCount = 0;
  let dominantElement: string | null = null;
  let missingElementCount = 0;
  for (const [el, c] of Object.entries(elCount)) {
    if (c > maxElementCount) {
      maxElementCount = c;
      dominantElement = el;
    }
    if (c === 0) missingElementCount++;
  }

  const groupCount: HookFeatures['groupCount'] = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const p of pillars) {
    if (p !== dayP && p.stem.deity && SIPSIN_GROUP[p.stem.deity]) groupCount[SIPSIN_GROUP[p.stem.deity]]++;
    if (p.branch.deity && SIPSIN_GROUP[p.branch.deity]) groupCount[SIPSIN_GROUP[p.branch.deity]]++;
  }

  const branches = pillars.map((p) => p.branch.hanja).filter((h: string) => h && h !== '?');
  let chungPairs = 0;
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      if (isChung(branches[i], branches[j])) chungPairs++;
    }
  }
  let gwimunAdjacent = 0;
  let wonjinAdjacent = 0;
  for (let i = 0; i + 1 < branches.length; i++) {
    if (isGwimun(branches[i], branches[i + 1])) gwimunAdjacent++;
    if (isWonjin(branches[i], branches[i + 1])) wonjinAdjacent++;
  }

  const dayStem = dayP.stem.hanja;
  const yangin = getYangin(dayStem);
  const cheoneul = getCheoneulGuiin(dayStem);

  return {
    hasHour,
    dayGanzhiHangul: `${dayP.stem.hangul}${dayP.branch.hangul}`,
    strength,
    maxElementCount,
    dominantElement,
    missingElementCount,
    groupCount,
    chungPairs,
    yanginPresent: yangin !== '' && branches.includes(yangin),
    cheoneulCount: branches.filter((br: string) => cheoneul.includes(br)).length,
    goegangDay: isGoegang(dayStem, dayP.branch.hanja),
    gwimunAdjacent,
    wonjinAdjacent,
  };
}

/** 희소성 %가 낮을수록 큰 보너스. %가 없는 후보(타이밍형)는 10점 고정. */
const rarityBonus = (pct: number | null): number => {
  if (pct == null) return 10;
  if (pct < 1.5) return 60;
  if (pct < 3) return 52;
  if (pct < 6) return 45;
  if (pct < 9) return 38;
  if (pct < 12.5) return 32;
  if (pct < 18) return 26;
  if (pct < 25) return 20;
  if (pct < 35) return 14;
  return 8;
};

/** 긴장형(내 안의 모순 언어화)이 가장 흡인력이 높아 유형 기본점을 최상으로 둔다. */
const TYPE_BASE: Record<CoreHookType, number> = {
  tension: 40,
  rarity: 30,
  correction: 26,
  timing: 24,
};

/** % 표기: 10 이상은 정수, 미만은 소수 1자리 */
export const formatHookPct = (p: number): string => (p >= 10 ? String(Math.round(p)) : String(Math.round(p * 10) / 10));

interface DaeunTiming {
  /** 다음 대운 시작까지 1년 이내 */
  aboutToShift: boolean;
  /** 현재 대운 진입 후 경과 연수(0=1년 차). 3년 차 초과면 null */
  yearsIn: number | null;
  currentGanzhi: string | null;
}

const HANJA_TO_HANGUL: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

function resolveDaeunTiming(daeunResult: any[], currentAge: number): DaeunTiming {
  const timing: DaeunTiming = { aboutToShift: false, yearsIn: null, currentGanzhi: null };
  if (!Array.isArray(daeunResult) || daeunResult.length === 0 || currentAge <= 0) return timing;
  let currentIdx = -1;
  for (let i = 0; i < daeunResult.length; i++) {
    if (currentAge >= daeunResult[i].startAge) currentIdx = i;
  }
  if (currentIdx === -1) return timing; // 첫 대운 진입 전
  const cur = daeunResult[currentIdx];
  const next = daeunResult[currentIdx + 1];
  timing.currentGanzhi = `${HANJA_TO_HANGUL[cur.stem] ?? cur.stem}${HANJA_TO_HANGUL[cur.branch] ?? cur.branch}`;
  const yearsIn = currentAge - cur.startAge;
  if (yearsIn <= 2) timing.yearsIn = yearsIn;
  if (next && next.startAge - currentAge <= 1) timing.aboutToShift = true;
  return timing;
}

interface Candidate {
  type: CoreHookType;
  headline: string;
  detailBody: string;
  advice: string;
  rarityPercent: number | null;
  sectionIndex: number;
  evidence: string[];
  /** 후보별 고정 점수를 쓰고 싶을 때(일주 폴백 등) */
  fixedScore?: number;
}

export interface SelectCoreHookInput {
  sajuResult: any[];
  daeunResult?: any[];
  yongshinResult?: { strength: string } | null;
  /** 만 나이(연도 차 근사) — 타이밍형 판정에만 사용 */
  currentAge?: number;
}

/**
 * 사주에서 핵심 훅 1개를 결정론적으로 선정한다. 판정 불가(사주 데이터 이상) 시 null.
 */
export function selectCoreHook(input: SelectCoreHookInput): CoreHook | null {
  const features = extractHookFeatures(input.sajuResult, input.yongshinResult);
  if (!features) return null;

  const stats = features.hasHour ? HOOK_STATS.withHour : HOOK_STATS.withoutHour;
  const isWeak = features.strength === '신약' || features.strength === '극신약';
  const isStrong = features.strength === '신강' || features.strength === '극신강';
  const g = features.groupCount;
  const candidates: Candidate[] = [];

  // ── 긴장형 ──────────────────────────────────────────────────────────
  if (g.재성 >= 3 && isWeak) {
    candidates.push({
      type: 'tension',
      headline: '돈과 기회는 잘 보이는데, 아직 그걸 다 감당할 힘이 부족한 타입이에요(재다신약).',
      detailBody: '욕심이 많아서가 아니라 타고난 구조가 그래요. 힘을 기르는 순서만 지키면 오히려 큰돈을 다루는 그릇이 됩니다.',
      advice: '일을 벌이기 전에 내 체력과 시간부터 확보하세요. 감당 범위 안의 기회만 잡아도 충분히 커져요.',
      rarityPercent: stats.jaeDaShinYakPct,
      sectionIndex: 6,
      evidence: ['재다신약', `재성 ${g.재성}개`, features.strength],
    });
  }
  if (g.관성 >= 3 && isWeak) {
    candidates.push({
      type: 'tension',
      headline: '맡겨지는 책임과 주변의 기대가 유난히 많은 타입이에요(관다신약).',
      detailBody: '잘 버티는 게 답이 아니라, 나를 먼저 채워야 그 책임이 기회로 바뀌는 구조예요.',
      advice: '거절도 실력이에요. 책임을 하나 새로 맡을 때마다 하나는 내려놓는 연습을 해보세요.',
      rarityPercent: stats.gwanDaShinYakPct,
      sectionIndex: 6,
      evidence: ['관다신약', `관성 ${g.관성}개`, features.strength],
    });
  }
  if (g.식상 >= 3 && isWeak) {
    candidates.push({
      type: 'tension',
      headline: '하고 싶은 것도 보여줄 재능도 많은데, 체력이 먼저 바닥나는 타입이에요(식상과다).',
      detailBody: '재능을 줄일 필요는 없어요. 회복이 따라와야 재능이 오래가는 구조예요.',
      advice: '잠·운동·혼자만의 시간 같은 회복 루틴을 일정에 먼저 넣으세요. 그게 재능을 지키는 방법이에요.',
      rarityPercent: stats.siksangDaShinYakPct,
      sectionIndex: 1,
      evidence: ['식상과다', `식상 ${g.식상}개`, features.strength],
    });
  }
  if (g.인성 >= 3 && isStrong) {
    candidates.push({
      type: 'tension',
      headline: '생각이 많고 준비는 철저한데, 시작이 늦어지기 쉬운 타입이에요(인성과다).',
      detailBody: '받쳐주는 기운은 넘치는데 내보내는 통로가 좁은 구조라, 실행이 최대 과제예요.',
      advice: "'80% 준비되면 일단 시작'을 규칙으로 삼아보세요. 완벽한 때는 오지 않아요.",
      rarityPercent: stats.inDaShinGangPct,
      sectionIndex: 1,
      evidence: ['인성과다', `인성 ${g.인성}개`, features.strength],
    });
  }
  if (g.비겁 >= 3 && g.재성 >= 1 && isStrong) {
    candidates.push({
      type: 'tension',
      headline: '주변에 사람은 많은데, 내 몫을 지키는 게 평생 숙제인 타입이에요(군겁쟁재).',
      detailBody: '사람이 모이는 힘은 큰 자산이에요. 다만 그 사람들과 돈이 섞일 때 문제가 생기는 구조예요.',
      advice: '돈 문제만큼은 아무리 가까워도 선을 그으세요. 동업·보증·큰돈 빌려주기는 특히 신중하게.',
      rarityPercent: stats.gunGeopJaengJaePct,
      sectionIndex: 6,
      evidence: ['군겁쟁재', `비겁 ${g.비겁}개`, `재성 ${g.재성}개`],
    });
  }
  if (features.chungPairs >= 2) {
    candidates.push({
      type: 'tension',
      headline: '변화·이동·새 판이 유난히 잦게 찾아오는 인생 구조예요(충 중첩).',
      detailBody: `사주 지지에 부딪히는 기운(충)이 ${features.chungPairs}쌍이나 있어요. 흔들림이 아니라 판을 바꾸는 힘으로 쓰면 남들보다 크게 도약해요.`,
      advice: '변화가 올 때 버티기보다 기회로 쓰세요. 안 움직이려 할수록 오히려 더 흔들려요.',
      rarityPercent: stats.chung2Pct,
      sectionIndex: 1,
      evidence: ['충(沖) 중첩', `충 ${features.chungPairs}쌍`],
    });
  }

  // ── 희소성형 ────────────────────────────────────────────────────────
  if (features.goegangDay && features.yanginPresent) {
    candidates.push({
      type: 'rarity',
      headline: '백 명 중 한두 명뿐인, 진폭이 큰 승부사 구조를 타고났어요(괴강+양인).',
      detailBody: `${features.dayGanzhiHangul}일주(괴강)에 양인이라는 강한 기운까지 겹쳤어요. 방향만 잡히면 남들이 못 내는 추진력이 나와요.`,
      advice: '평범한 자리에선 답답해지기 쉬워요. 책임과 재량이 큰 일을 맡을수록 오히려 안정돼요.',
      rarityPercent: stats.goegangYanginPct,
      sectionIndex: 1,
      evidence: ['괴강', '양인', `${features.dayGanzhiHangul}일주`],
    });
  } else if (features.goegangDay) {
    candidates.push({
      type: 'rarity',
      headline: '무게 있는 일을 감당하라고 태어난 구조예요(괴강 일주).',
      detailBody: `${features.dayGanzhiHangul}일주는 괴강이라 불리는 강한 배치예요. 평범한 자리보다 책임이 무거운 자리에서 오히려 안정돼요.`,
      advice: '작은 일 여러 개보다 큰일 하나에 힘을 모으는 편이 잘 맞아요.',
      rarityPercent: stats.goegangDayPct,
      sectionIndex: 1,
      evidence: ['괴강', `${features.dayGanzhiHangul}일주`],
    });
  }
  if (features.maxElementCount >= 5 && features.dominantElement) {
    const elKo = ELEMENT_KO[features.dominantElement] ?? features.dominantElement;
    candidates.push({
      type: 'rarity',
      headline: `${features.hasHour ? '여덟' : '여섯'} 글자 중 ${features.maxElementCount}자가 ${elKo} 하나로 쏠린, 보기 드문 몰입형 구조예요.`,
      detailBody: '한 가지 기운이 이렇게 강하면 재능도 리스크도 그 기운 하나에 집중돼요. 잘 쓰면 전문가, 못 쓰면 쏠림이에요.',
      advice: `강한 ${elKo} 기운을 쓰는 일을 중심에 두고, 부족한 기운은 사람과 환경으로 채우세요.`,
      rarityPercent: stats.maxElement5Pct,
      sectionIndex: 4,
      evidence: ['오행 편중', `${elKo} ${features.maxElementCount}개`],
    });
  }
  if (features.cheoneulCount >= 2) {
    candidates.push({
      type: 'rarity',
      headline: '위기 때마다 도와주는 사람이 나타나는, 귀인이 겹친 구조예요(천을귀인).',
      detailBody: `최고 길신이라 불리는 천을귀인이 ${features.cheoneulCount}자리나 있어요. 혼자 버티는 것보다 도움을 청할 때 일이 풀리는 사주예요.`,
      advice: '혼자 끙끙대지 마세요. 당신 사주는 먼저 부탁하고 손 내밀 때 길이 열려요.',
      rarityPercent: stats.cheoneul2Pct,
      sectionIndex: 1,
      evidence: ['천을귀인', `귀인 ${features.cheoneulCount}개`],
    });
  }

  // ── 오해 정정형 ─────────────────────────────────────────────────────
  if (features.strength === '극신약') {
    candidates.push({
      type: 'correction',
      headline: "흔히 '신약하면 약하다'고 하는데, 당신의 경우는 달라요.",
      detailBody: '혼자 힘으로 밀어붙이는 구조가 아니라, 사람·환경·타이밍을 지렛대로 쓰는 구조예요(극신약). 기댈 기운만 정확히 알면 돼요.',
      advice: '혼자 다 하려고 하지 마세요. 좋은 팀과 좋은 타이밍을 고르는 안목이 당신의 무기예요.',
      rarityPercent: stats.strengthPct['극신약'] ?? null,
      sectionIndex: 5,
      evidence: ['극신약', '용신'],
    });
  }
  if (features.strength === '극신강') {
    candidates.push({
      type: 'correction',
      headline: '에너지가 넘치는 만큼, 그 힘의 출구를 만드는 게 평생 과제예요(극신강).',
      detailBody: '기운이 세다는 건 좋기만 한 게 아니에요. 쓸 곳을 정해주지 않으면 그 힘이 안에서 부딪혀요.',
      advice: '운동이든 일이든 표현이든, 힘을 쏟을 통로를 하나 정해두세요. 출구가 있으면 그 힘이 다 무기가 돼요.',
      rarityPercent: stats.strengthPct['극신강'] ?? null,
      sectionIndex: 5,
      evidence: ['극신강', '용신'],
    });
  }

  // ── 타이밍형 ────────────────────────────────────────────────────────
  const timing = resolveDaeunTiming(input.daeunResult ?? [], input.currentAge ?? 0);
  if (timing.aboutToShift) {
    candidates.push({
      type: 'timing',
      headline: '지금, 인생의 10년 단위 흐름(대운)이 바뀌기 직전이에요.',
      detailBody: '교운기라고 부르는 전환 구간이에요. 이 시기의 선택이 다음 10년의 방향을 정해요.',
      advice: '큰 결정은 서두르지 말고, 방향부터 점검하세요. 지금은 속도보다 방향이 중요한 때예요.',
      rarityPercent: null,
      sectionIndex: 2,
      evidence: ['교운기', '대운 전환'],
    });
  } else if (timing.yearsIn != null && timing.currentGanzhi) {
    candidates.push({
      type: 'timing',
      headline: `새로운 10년 흐름(${timing.currentGanzhi} 대운) ${timing.yearsIn + 1}년 차 — 인생의 판이 막 바뀐 시점이에요.`,
      detailBody: '흐름이 바뀐 초입에는 성과보다 방향 설정이 중요해요. 여기서 잡은 방향대로 10년이 흘러가요.',
      advice: '새 흐름에 맞는 습관을 하나만 먼저 만들어보세요. 지금 심는 것이 10년을 가요.',
      rarityPercent: null,
      sectionIndex: 2,
      evidence: ['교운기', `${timing.currentGanzhi} 대운 ${timing.yearsIn + 1}년 차`],
    });
  }

  // ── 폴백: 일주 희소성 (모든 사주에 존재하므로 점수는 최하로 고정) ──
  candidates.push({
    type: 'rarity',
    headline: `60가지 일주 가운데 ${features.dayGanzhiHangul}일주 — 당신 기질의 뿌리예요.`,
    detailBody: '같은 일주를 가진 사람은 드물어요. 이 기질을 아는 것이 활용의 시작이에요.',
    advice: '타고난 기질과 싸우기보다 활용하는 쪽이 늘 빨라요. 아래 리포트에서 구체적으로 확인해보세요.',
    rarityPercent: 1.7,
    sectionIndex: 1,
    evidence: [`${features.dayGanzhiHangul}일주`],
    fixedScore: 20,
  });

  let best: Candidate | null = null;
  let bestScore = -1;
  for (const c of candidates) {
    const score = c.fixedScore ?? TYPE_BASE[c.type] + rarityBonus(c.rarityPercent);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  if (!best) return null;

  const sectionLabel = SECTION_LABELS[best.sectionIndex - 1];
  return {
    type: best.type,
    headline: best.headline,
    detail: `${best.detailBody} 자세한 근거는 리포트의 '${sectionLabel}'에서 볼 수 있어요.`,
    advice: best.advice,
    rarityPercent: best.rarityPercent,
    sectionIndex: best.sectionIndex,
    sectionLabel,
    evidence: best.evidence,
    score: bestScore,
  };
}
