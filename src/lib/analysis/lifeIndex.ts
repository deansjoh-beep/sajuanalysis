/**
 * 인생 100년 지수 — 재물발복·연애결혼인연·성공관운·건강 4종.
 *
 * 저장된 명식(MyeongsikParams)만으로 0~99세 결정론적 계산이 가능하다(LLM 미사용, 원가 0).
 * 억부(강약)·조후·용신 입력은 v1.5 자평 표준 규칙 엔진(`./rules`)을 그대로 재사용한다 — 리포트
 * 본문과 다른 억부 판정으로 그래프가 그려지면 본문·그래프가 모순되므로, 별도 휴리스틱을 두지 않는다.
 * 가중치·트리거 구조는 참고 서비스의 "인생 100년" 뷰를 골격으로 삼되, 규칙 엔진 출력에 맞게
 * 전부 다시 계산한다(동일 수치를 목표로 하지 않는다).
 */
import { analyzeByRules, type RulesInput, type RulePillar } from './rules';
import {
  STEM_ELEMENT, PRODUCES, PRODUCED_BY, CONTROLS, CONTROLLED_BY,
  HIDDEN_STEM_DAYS, COLD_BRANCHES, HOT_BRANCHES, type Ohaeng,
} from './rules/tables';
import { calculateDeity, getCheoneulGuiin, isChung, isHyeong, getYukhap, hanjaToHangul } from '../../utils/saju';
import { getYearPillarsForRange } from '../seoulDateGanji';
import type { MyeongsikParams } from '../buildMyeongsik';

export type LifeIndexKey = 'wealth' | 'love' | 'career' | 'health';

export const LIFE_INDEX_LABELS: Record<LifeIndexKey, string> = {
  wealth: '재물',
  love: '인연',
  career: '관운',
  health: '건강',
};

export const LIFE_INDEX_DESCRIPTIONS: Record<LifeIndexKey, string> = {
  wealth: '돈이 들어오고 불어나는 힘이 언제 강해지는지를 보여줍니다. 곡선이 높은 시기일수록 수입 확대·사업 확장 같은 재물 활동에 유리합니다.',
  love: '새로운 인연을 만나거나 관계가 결혼으로 이어지기 쉬운 시기를 보여줍니다. 높은 시기가 만남과 결실의 호기입니다.',
  career: '승진·합격·계약처럼 사회적으로 인정받는 일이 이루어지기 쉬운 시기를 보여줍니다.',
  health: '몸의 균형이 유지되는 정도를 보여줍니다. 곡선이 내려가는 구간에는 과로를 줄이고 검진을 챙기는 것이 좋습니다.',
};

/** 고객용으로 순화한 요인 태그 문구. 내부 태그 코드 → 노출 문구. */
export const LIFE_INDEX_TAG_LABELS: Record<string, string> = {
  wealth_storage_open: '재물 창고가 열리는 시기',
  wealth_storage_half: '재물 창고가 반쯤 열리는 시기',
  wealth_branch_move: '재물 자원이 크게 움직이는 해',
  wealth_branch_hap: '재물 자원에 합이 붙는 해',
  love_spouse_star: '배우자 인연 기운이 강한 해',
  love_break: '관계가 흔들리기 쉬운 해',
  love_ilgan_hap: '나와 합이 되는 해 — 호감·인연',
  love_day_branch_hap: '배우자궁에 합이 드는 해',
  love_day_branch_chung: '배우자궁이 흔들리는 해 — 변화의 계기',
  career_cheoneul: '귀인의 도움을 받는 해',
  career_day_branch_hap: '결실이 맺히는 해',
  career_day_branch_chung: '환경이 크게 바뀌는 해',
  career_month_dong: '주변 환경이 움직이는 해',
  career_storage_open: '숨은 기회가 열리는 해',
  health_day_branch_chung: '몸에 변화나 사고 수가 있는 해 — 무리하지 않도록 주의',
  health_samhyeong: '건강 관리에 특히 신경 써야 하는 해',
  health_baekho_goegang: '급격한 변화에 유의할 해',
  health_extreme_temp: '체온 균형이 무너지기 쉬운 해',
};

export interface LifeIndexPoint {
  age: number;
  year: number;
  seunGanzhi: string;
  daeunGanzhi: string | null;
  wealth: number;
  love: number;
  career: number;
  health: number;
  tags: Record<LifeIndexKey, string[]>;
}

export interface LifeIndexPeakSummary {
  ageStart: number;
  ageEnd: number;
  yearStart: number;
  yearEnd: number;
  daeunGanzhi: string | null;
  tags: string[];
  sentence: string;
}

// ───────────────────────── 조견표(로컬) ─────────────────────────

const STEMS_CYCLE = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES_CYCLE = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const SS_GROUP: Record<string, string> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
};

/** 천간합(天干合) 5쌍 — 일간의 합 상대를 찾는 데 사용(연애 지수). */
const STEM_HAP_PAIRS: [string, string][] = [
  ['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸'],
];

/** 오행별 묘고(墓庫) 지지 — 재물 창고 개고 트리거용. */
const STORAGE_BRANCH: Record<Ohaeng, string> = { wood: '未', fire: '戌', earth: '戌', metal: '丑', water: '辰' };
/** 묘고 지지 → 저장된 오행(개고 대상 판별용, 辰戌丑未 4개만). */
const STORAGE_ELEMENT: Record<string, Ohaeng> = { 辰: 'water', 戌: 'fire', 丑: 'metal', 未: 'wood' };

/** 삼형(三刑) — 인사신·축술미(자묘형/자형은 이 MVP 범위에서 생략). */
const SAMHYEONG_SETS: string[][] = [['寅', '巳', '申'], ['丑', '戌', '未']];

/** 백호대살(白虎大殺) — 프로젝트 조견표에 없어 통용되는 일주 조합을 로컬 정의한다. */
const BAEKHO_ILJU = ['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑'];

// ───────────────────────── 유틸 ─────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

const toGanzhi = (pillar: RulePillar | null): string | null => (pillar ? `${pillar.stem}${pillar.branch}` : null);

export const toHangulGanzhi = (ganzhi: string): string =>
  ganzhi.split('').map((c) => hanjaToHangul[c] ?? c).join('');

const sipseongGroup = (dayStem: string, targetChar: string, isBranch = false): string => {
  const ss = calculateDeity(dayStem, targetChar, isBranch);
  return SS_GROUP[ss] ?? '';
};

/** 오행 el이 일간 기준으로 어느 십성 그룹에 해당하는지(비겁/식상/재성/관성/인성). */
const elementToGroup = (dayEl: Ohaeng, el: Ohaeng): string => {
  if (el === dayEl) return '비겁';
  if (el === PRODUCED_BY[dayEl]) return '인성';
  if (el === PRODUCES[dayEl]) return '식상';
  if (el === CONTROLS[dayEl]) return '재성';
  if (el === CONTROLLED_BY[dayEl]) return '관성';
  return '';
};

const branchMainStem = (branch: string): string | null => {
  const hs = HIDDEN_STEM_DAYS[branch];
  return hs ? hs[hs.length - 1].stem : null;
};

/** 지지 온도 기여(조후 극단 근사) — COLD/HOT 지지 ±1, 그 외 0. 원국 월지·시지 판정(§4.2.1)보다
 * 완화된 가중치를 쓴다(운의 일시적 영향이라 원국 조후만큼 크게 흔들면 안 됨). */
const branchTemp = (branch: string): number => (COLD_BRANCHES.includes(branch) ? -1 : HOT_BRANCHES.includes(branch) ? 1 : 0);
const stemTemp = (stem: string): number => {
  const el = STEM_ELEMENT[stem];
  return el === 'fire' ? 1 : el === 'water' ? -1 : 0;
};

export interface DaeunBand { startAge: number; gan: string; ji: string }

export const buildDaeunBands = (monthPillar: string, daeunsu: number, direction: 'forward' | 'backward'): DaeunBand[] => {
  const monthStem = monthPillar.charAt(0);
  const monthBranch = monthPillar.charAt(1);
  let si = STEMS_CYCLE.indexOf(monthStem);
  let bi = BRANCHES_CYCLE.indexOf(monthBranch);
  const bands: DaeunBand[] = [];
  for (let i = 1; i <= 10; i++) {
    if (direction === 'forward') { si = (si + 1) % 10; bi = (bi + 1) % 12; }
    else { si = (si - 1 + 10) % 10; bi = (bi - 1 + 12) % 12; }
    bands.push({ startAge: daeunsu + (i - 1) * 10, gan: STEMS_CYCLE[si], ji: BRANCHES_CYCLE[bi] });
  }
  return bands;
};

export const activeBand = (bands: DaeunBand[], age: number): DaeunBand | null => {
  if (age < bands[0].startAge) return null;
  for (let i = bands.length - 1; i >= 0; i--) {
    if (age >= bands[i].startAge) return bands[i];
  }
  return null;
};

/** 원국 세력을 십성 5그룹(비겁·식상·재성·관성·인성)으로 집계한다.
 * §2.2.1 위치 가중치·§2.3.1 지장간 일수 배분을 그대로 따르되, 결과를 아군/적군이 아닌
 * 5그룹으로 나눈다(강약 규칙 엔진과 동일 원자재를 재사용해 본문과의 정합을 지킨다). */
const computeNatalGroupTotals = (input: RulesInput, dayStem: string): Record<string, number> => {
  const totals: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  const positions: Array<{ pillar: RulePillar | null; stemW: number; branchW: number }> = [
    { pillar: input.year, stemW: 10, branchW: 10 },
    { pillar: input.month, stemW: 10, branchW: 35 },
    { pillar: input.day, stemW: 0, branchW: 15 },
    { pillar: input.hour, stemW: 10, branchW: 10 },
  ];
  for (const { pillar, stemW, branchW } of positions) {
    if (!pillar) continue;
    if (stemW > 0) {
      const g = sipseongGroup(dayStem, pillar.stem);
      if (g) totals[g] += stemW;
    }
    for (const h of HIDDEN_STEM_DAYS[pillar.branch] ?? []) {
      const g = sipseongGroup(dayStem, h.stem);
      if (g) totals[g] += branchW * (h.days / 30);
    }
  }
  return totals;
};

const computeElementCounts = (input: RulesInput): Record<Ohaeng, number> => {
  const counts: Record<Ohaeng, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const pillars = [input.year, input.month, input.day, input.hour].filter((p): p is RulePillar => Boolean(p));
  for (const p of pillars) {
    counts[STEM_ELEMENT[p.stem]]++;
    const main = branchMainStem(p.branch);
    if (main) counts[STEM_ELEMENT[main]]++;
  }
  return counts;
};

const inputFromPillars = (m: MyeongsikParams): RulesInput | null => {
  const parse = (gz: string | null): RulePillar | null => (gz && gz.length >= 2 ? { stem: gz.charAt(0), branch: gz.charAt(1) } : null);
  const year = parse(m.pillars.year);
  const month = parse(m.pillars.month);
  const day = parse(m.pillars.day);
  if (!year || !month || !day) return null;
  return { year, month, day, hour: m.timeUnknown ? null : parse(m.pillars.hour) };
};

// ───────────────────────── 메인 계산 ─────────────────────────

/** 저장된 명식으로 0~99세 인생 100년 지수 4종을 계산한다. 명식이 유효하지 않으면 빈 배열. */
export const computeLifeIndices = (myeongsik: MyeongsikParams): LifeIndexPoint[] => {
  const input = inputFromPillars(myeongsik);
  if (!input) return [];
  const analysis = analyzeByRules(input);
  if (!analysis) return [];

  const dayStem = input.day.stem;
  const dayBranch = input.day.branch;
  const monthBranch = input.month.branch;
  const dayEl = STEM_ELEMENT[dayStem];
  const isMale = myeongsik.gender === 'male';

  const yongshinEl = analysis.yongshin.element;
  const huisinEl = PRODUCED_BY[yongshinEl];
  const favElements = new Set<Ohaeng>([yongshinEl, huisinEl]);

  const baseRatio = analysis.strength.ratio;
  const groupTotals = computeNatalGroupTotals(input, dayStem);
  const gsTot = Object.values(groupTotals).reduce((a, b) => a + b, 0) || 1;
  const elc0 = computeElementCounts(input);

  // 조후: t<0(한랭)이면 화가 필요, t>0(조열)이면 수가 필요(§4.2.1과 동일 부호계).
  const johooT = analysis.johoo.t;
  const need: Ohaeng | null = johooT < 0 ? 'fire' : johooT > 0 ? 'water' : null;

  // 재물: 재성 오행·묘고
  const jaeEl = CONTROLS[dayEl];
  const jaego = STORAGE_BRANCH[jaeEl];
  const natalBranches = [input.year.branch, input.month.branch, input.day.branch, input.hour?.branch].filter(
    (b): b is string => Boolean(b),
  );
  const jaeBranches = new Set(
    natalBranches.filter((b) => (HIDDEN_STEM_DAYS[b] ?? []).some((h) => sipseongGroup(dayStem, h.stem) === '재성')),
  );
  const jaegoIn = natalBranches.includes(jaego);

  // 연애: 배우자성·이별 신호·일간합 상대
  const spouseGroup = isMale ? '재성' : '관성';
  const breakSipseong = isMale ? '겁재' : '상관';
  const ilganHapPair = STEM_HAP_PAIRS.find(([a, b]) => a === dayStem || b === dayStem);
  const ilganHapPartner = ilganHapPair ? (ilganHapPair[0] === dayStem ? ilganHapPair[1] : ilganHapPair[0]) : null;
  const spouseWeak = (groupTotals[spouseGroup] / gsTot) < 0.1;

  // 성공·관운: 개고 대상 묘고 지지(원국에 실존하는 것만)
  const storageInNatal = natalBranches.filter((b) => STORAGE_ELEMENT[b]);
  const cheoneul = new Set(getCheoneulGuiin(dayStem));

  const daeunBands = buildDaeunBands(myeongsik.pillars.month, myeongsik.daeunsu, myeongsik.daeunDirection);
  const yearGanzhi = getYearPillarsForRange(myeongsik.birthYear, myeongsik.birthYear + 99);

  const points: LifeIndexPoint[] = [];

  for (let age = 0; age < 100; age++) {
    const yg = yearGanzhi[age];
    const Yg = yg?.yearPillarHanja.charAt(0) ?? '';
    const Yz = yg?.yearPillarHanja.charAt(1) ?? '';
    const band = activeBand(daeunBands, age);
    const active = Boolean(band);
    const Dg = band?.gan ?? null;
    const Dz = band?.ji ?? null;

    // ── 공통: 억부 흐름 S(감당력·균형·면역의 기초) ──────────────────────────
    let S = baseRatio;
    const shiftS = (stem: string | null, branch: string | null, w: number) => {
      if (stem) { const g = sipseongGroup(dayStem, stem); S += (g === '비겁' || g === '인성') ? w : -w * 0.7; }
      if (branch) { const g = sipseongGroup(dayStem, branch, true); S += (g === '비겁' || g === '인성') ? w : -w * 0.7; }
    };
    if (active) shiftS(Dg, Dz, 9);
    shiftS(Yg, Yz, 5);
    const handle = clamp((S - 45) / 30, 0, 1.4);
    const balanceF = clamp(1 - Math.abs(S - 50) / 50, 0, 1);
    const immune = clamp((S - 15) / 45, 0, 1);

    const tags: Record<LifeIndexKey, string[]> = { wealth: [], love: [], career: [], health: [] };

    // ── 1) 재물발복 ──────────────────────────────────────────────────────
    let R = (groupTotals.재성 / gsTot) * 100;
    const addWealth = (stem: string | null, branch: string | null, w: number) => {
      if (stem) { const g = sipseongGroup(dayStem, stem); if (g === '재성') R += w; else if (g === '식상') R += w * 0.5; }
      if (branch) { const g = sipseongGroup(dayStem, branch, true); if (g === '재성') R += w; else if (g === '식상') R += w * 0.5; }
    };
    if (active) addWealth(Dg, Dz, 12);
    addWealth(Yg, Yz, 8);
    let B = 0;
    for (const z of jaeBranches) {
      if (isChung(Yz, z)) { B += 8; tags.wealth.push('wealth_branch_move'); }
      else if (active && Dz && isChung(Dz, z)) { B += 5; tags.wealth.push('wealth_branch_move'); }
      if (getYukhap(Yz, z)) { B += 3; tags.wealth.push('wealth_branch_hap'); }
    }
    if (jaegoIn) {
      if (isChung(Yz, jaego)) { B += 6; tags.wealth.push('wealth_storage_open'); }
      else if (isHyeong(Yz, jaego)) { B += 3; tags.wealth.push('wealth_storage_half'); }
    }
    const wealth = Math.max(0, R * handle + B);

    // ── 2) 연애·결혼 인연 ────────────────────────────────────────────────
    let P = 0;
    let N = 0;
    const scanLove = (stem: string | null, branch: string | null, w: number) => {
      for (const [char, isBranch] of [[stem, false], [branch, true]] as [string | null, boolean][]) {
        if (!char) continue;
        const ss = calculateDeity(dayStem, char, isBranch);
        const g = SS_GROUP[ss];
        if (g === spouseGroup) { P += w; if (spouseWeak) P += 1; tags.love.push('love_spouse_star'); }
        else if (g === '식상') { P += w * 0.5; }
        if (ss === breakSipseong) { N += w * 0.8; tags.love.push('love_break'); }
      }
    };
    if (active) scanLove(Dg, Dz, 3);
    scanLove(Yg, Yz, 2.2);
    if (ilganHapPartner) {
      if (Yg === ilganHapPartner) { P += 3; tags.love.push('love_ilgan_hap'); }
      if (active && Dg === ilganHapPartner) { P += 2; tags.love.push('love_ilgan_hap'); }
    }
    if (getYukhap(Yz, dayBranch)) { P += 5; tags.love.push('love_day_branch_hap'); }
    if (active && Dz && getYukhap(Dz, dayBranch)) { P += 3; tags.love.push('love_day_branch_hap'); }
    if (isChung(Yz, dayBranch)) { P += 2.5; N += 1.5; tags.love.push('love_day_branch_chung'); }
    if (active && Dz && isChung(Dz, dayBranch)) { P += 1.5; N += 1; tags.love.push('love_day_branch_chung'); }
    const love = P - N;

    // ── 3) 성공·관운 ─────────────────────────────────────────────────────
    let johuAdd = 0;
    const bumpJohu = (el: Ohaeng | null) => { if (need && el === need) johuAdd += 0.08; };
    if (active) { bumpJohu(STEM_ELEMENT[Dg!]); bumpJohu(STEM_ELEMENT[branchMainStem(Dz!) ?? '']); }
    bumpJohu(STEM_ELEMENT[Yg] ?? null);
    bumpJohu(STEM_ELEMENT[branchMainStem(Yz) ?? ''] ?? null);
    const envF = balanceF * (1 + Math.min(0.3, johuAdd));

    const pres: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    Object.keys(pres).forEach((g) => { pres[g] = (groupTotals[g] / gsTot) * 10; });
    const addPres = (stem: string | null, branch: string | null, w: number) => {
      if (stem) { const g = sipseongGroup(dayStem, stem); if (g) pres[g] += w; }
      if (branch) { const g = sipseongGroup(dayStem, branch, true); if (g) pres[g] += w; }
    };
    if (active) addPres(Dg, Dz, 3);
    addPres(Yg, Yz, 2);
    const flow = Math.min(pres.관성, pres.인성) + Math.min(pres.재성, pres.관성);
    const power = pres.관성;

    let T = 0;
    if (cheoneul.has(Yz) || (active && Dz && cheoneul.has(Dz))) { T += 3; tags.career.push('career_cheoneul'); }
    if (getYukhap(Yz, dayBranch)) { T += 2; tags.career.push('career_day_branch_hap'); }
    else if (isChung(Yz, dayBranch)) { T += 1.5; tags.career.push('career_day_branch_chung'); }
    if (getYukhap(Yz, monthBranch) || isChung(Yz, monthBranch)) { T += 1; tags.career.push('career_month_dong'); }
    for (const b of storageInNatal) {
      const el = STORAGE_ELEMENT[b];
      const group = elementToGroup(dayEl, el);
      if (group !== '관성' && group !== '재성') continue;
      const open = isChung(Yz, b);
      const half = isHyeong(Yz, b);
      if (!open && !half) continue;
      const fav = favElements.has(el);
      T += (open ? 2.5 : 1.2) * (fav ? 1 : 0.6);
      tags.career.push('career_storage_open');
    }
    const career = Math.max(0, (flow + power * 0.6) * envF + T);

    // ── 4) 건강 ──────────────────────────────────────────────────────────
    const elc = { ...elc0 };
    if (active) { elc[STEM_ELEMENT[Dg!]]++; const dm = branchMainStem(Dz!); if (dm) elc[STEM_ELEMENT[dm]]++; }
    elc[STEM_ELEMENT[Yg]]++;
    const ym = branchMainStem(Yz);
    if (ym) elc[STEM_ELEMENT[ym]]++;
    let elPen = 0;
    (Object.keys(elc) as Ohaeng[]).forEach((el) => {
      const c = elc[el];
      if (c === 0) elPen += 1.5;
      else if (c >= 5) elPen += (c - 4) * 1.2 + 0.6;
      else if (c === 4) elPen += 0.6;
    });
    const balEl = clamp(1 - elPen / 6, 0, 1);
    let yt = johooT;
    if (active) { yt += stemTemp(Dg!) + branchTemp(Dz!); }
    yt += stemTemp(Yg) + branchTemp(Yz);
    const johuMid = clamp(1 - Math.min(1, Math.abs(yt) / 14), 0, 1);
    const healthBase = (0.4 * balEl + 0.3 * immune + 0.3 * johuMid) * 100;
    let pen = 0;
    if (isChung(Yz, dayBranch)) { pen += 15; tags.health.push('health_day_branch_chung'); }
    else if (active && Dz && isChung(Dz, dayBranch)) { pen += 9; tags.health.push('health_day_branch_chung'); }
    const yearBranchSet = new Set([...natalBranches, Yz, ...(active && Dz ? [Dz] : [])]);
    for (const set of SAMHYEONG_SETS) {
      if (set.every((b) => yearBranchSet.has(b)) && set.includes(Yz)) { pen += 12; tags.health.push('health_samhyeong'); }
    }
    const ilju = `${dayStem}${dayBranch}`;
    if (BAEKHO_ILJU.includes(ilju)) {
      if (isChung(Yz, dayBranch) || isHyeong(Yz, dayBranch)) { pen += 10; tags.health.push('health_baekho_goegang'); }
    }
    if (Math.abs(yt) >= 12) tags.health.push('health_extreme_temp');
    const health = Math.max(0, healthBase - pen);

    (Object.keys(tags) as LifeIndexKey[]).forEach((k) => { tags[k] = [...new Set(tags[k])]; });

    points.push({
      age,
      year: myeongsik.birthYear + age,
      seunGanzhi: `${Yg}${Yz}`,
      daeunGanzhi: active ? `${Dg}${Dz}` : null,
      wealth: round1(wealth),
      love: round1(love),
      career: round1(career),
      health: round1(health),
      tags,
    });
  }

  return points;
};

// ───────────────────────── 사용자 적용 단락 ─────────────────────────

const PEAK_HIGH_SENTENCE: Record<LifeIndexKey, (rangeLabel: string, tagText: string) => string> = {
  wealth: (r, t) => `재물 지수는 ${r} 구간에서 가장 높습니다.${t} 수입 확대·사업 확장 같은 결정이 이 구간에 유리합니다.`,
  love: (r, t) => `인연 지수는 ${r} 구간에서 가장 높습니다.${t} 만남과 결실의 호기입니다.`,
  career: (r, t) => `관운 지수는 ${r} 구간에서 가장 높습니다.${t} 승진·합격·계약 등에 유리한 시기입니다.`,
  health: (r, t) => `건강 지수는 ${r} 구간에서 가장 안정적입니다.${t}`,
};

const PEAK_LOW_SENTENCE: Record<LifeIndexKey, (rangeLabel: string) => string> = {
  wealth: (r) => `반면 ${r} 구간은 새 확장보다 지출 관리·정비가 필요한 시기입니다.`,
  love: (r) => `반면 ${r} 구간은 관계에 무리한 진전을 서두르기보다 관망이 필요한 시기입니다.`,
  career: (r) => `반면 ${r} 구간은 큰 결정보다 내실을 다지는 편이 낫습니다.`,
  health: (r) => `반면 ${r} 구간은 과로를 줄이고 검진을 챙기는 것이 좋습니다. 낮은 구간이 나쁜 운명이라는 뜻은 아니며, 관리로 충분히 지나갈 수 있는 시기입니다.`,
};

const ageRangeLabel = (points: LifeIndexPoint[], from: number, to: number): string => {
  const a = points[from];
  const b = points[to];
  return a.age === b.age ? `${a.age}세(${a.year}년)` : `${a.age}~${b.age}세(${a.year}~${b.year}년)`;
};

const expandWindow = (values: number[], centerIdx: number, threshold: number, maxSpan = 9): [number, number] => {
  let lo = centerIdx;
  let hi = centerIdx;
  while (lo > 0 && hi - lo < maxSpan && values[lo - 1] >= threshold) lo--;
  while (hi < values.length - 1 && hi - lo < maxSpan && values[hi + 1] >= threshold) hi++;
  return [lo, hi];
};

/** 선택된 지수의 최고 구간·최저 구간을 문장으로 요약한다(카드의 "사용자 적용 단락"). */
export const summarizeLifeIndexPeaks = (
  points: LifeIndexPoint[],
  key: LifeIndexKey,
  currentAge?: number,
): { high: LifeIndexPeakSummary; low: LifeIndexPeakSummary } | null => {
  if (points.length === 0) return null;
  const values = points.map((p) => p[key]);

  const maxVal = Math.max(...values);
  const maxIdx = values.indexOf(maxVal);
  const [hiLo, hiHi] = expandWindow(values, maxIdx, maxVal - Math.abs(maxVal) * 0.15 - 1);
  const highTags = [...new Set(points.slice(hiLo, hiHi + 1).flatMap((p) => p.tags[key]))]
    .slice(0, 3)
    .map((t) => LIFE_INDEX_TAG_LABELS[t] ?? t);
  const highRange = ageRangeLabel(points, hiLo, hiHi);
  const high: LifeIndexPeakSummary = {
    ageStart: points[hiLo].age, ageEnd: points[hiHi].age,
    yearStart: points[hiLo].year, yearEnd: points[hiHi].year,
    daeunGanzhi: points[maxIdx].daeunGanzhi,
    tags: highTags,
    sentence: PEAK_HIGH_SENTENCE[key](highRange, highTags.length ? ` 요인: ${highTags.join(', ')}.` : ''),
  };

  const searchFrom = currentAge != null ? Math.max(0, currentAge) : 0;
  const lowSlice = values.slice(searchFrom);
  const minVal = Math.min(...lowSlice);
  const minIdx = searchFrom + lowSlice.indexOf(minVal);
  const [loLo, loHi] = expandWindow(values, minIdx, minVal + Math.abs(minVal) * 0.15 + 1);
  const lowRange = ageRangeLabel(points, loLo, loHi);
  const low: LifeIndexPeakSummary = {
    ageStart: points[loLo].age, ageEnd: points[loHi].age,
    yearStart: points[loLo].year, yearEnd: points[loHi].year,
    daeunGanzhi: points[minIdx].daeunGanzhi,
    tags: [],
    sentence: PEAK_LOW_SENTENCE[key](lowRange),
  };

  return { high, low };
};
