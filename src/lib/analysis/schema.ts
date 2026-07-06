/**
 * SajuAnalysis — 구조 분석 JSON 스키마 (Phase 1-2, IMPLEMENTATION_PLAN 1-2)
 *
 * 리포트 생성(1-3)의 유일한 입력이 되는 결정론적 구조체다. 기존에 검증된 만세력 산출물
 * (명식·대운·월운·세운·공망·신살·합충)과 잠정(provisional) 격국·용신을 하나로 조립한다.
 *
 * 원칙:
 *   - 이 객체에 **존재하는 요소만** 리포트가 언급한다(근거 없는 서술 금지 — 1-3 프롬프트 규칙).
 *   - 만세력 파생 필드(명식·대운·월운·세운·공망·신살·합충·절입경계)는 검증된 결정론 산출.
 *   - `gyeokYongshin`은 유파 의존 **잠정** 해석이라 `null` 허용 필드로 예약한다(플랜 1-2).
 *     v1은 provisional 값을 채우되 `provisional: true`가 붙는다. Phase 3 규칙엔진이 정식화(D-1-6).
 */

import {
  getSajuData,
  getDaeunData,
  getGongmang,
  getShinsal,
  getSipseung,
  getCheoneulGuiin,
  getMunchang,
  getHakdang,
  getYangin,
  isGoegang,
  isChung,
  isHyeong,
  isPa,
  isHae,
  isWonjin,
  isGwimun,
  getHongyeom,
  getYukhap,
  calculateDeity,
  elementMap,
  getDeityEnglishExplanation,
  hanjaToHangul,
  hiddenStems,
} from '../../utils/saju.js';
import { getCurrentWolun, type WolunMonth } from '../manseryeok/wolun.js';
import { analyzeGyeokYongshin, type GyeokYongshin } from './gyeokyongshin.js';

export type OhaengKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type PillarPosition = '년주' | '월주' | '일주' | '시주';
export type RunScope = '원국' | '세운' | '월운';

// ── saju.ts 미노출 관계표(로컬 재정의; 지지 관계는 saju의 export 술어 재사용) ──
const STEM_HAP: ReadonlyArray<readonly [string, string, string]> = [
  ['甲', '己', '토합'], ['乙', '庚', '금합'], ['丙', '辛', '수합'],
  ['丁', '壬', '목합'], ['戊', '癸', '화합'],
];
const STEM_CHUNG: ReadonlyArray<readonly [string, string]> = [
  ['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸'],
];
const BRANCH_SAMHAP: ReadonlyArray<readonly [readonly [string, string, string], string]> = [
  [['申', '子', '辰'], '수국'], [['巳', '酉', '丑'], '금국'],
  [['寅', '午', '戌'], '화국'], [['亥', '卯', '未'], '목국'],
];

const OHAENG_KO: Record<OhaengKey, string> = {
  wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)',
};

const hangulToHanja = (hangul: string): string =>
  Object.entries(hanjaToHangul).find(([, v]) => v === hangul)?.[0] ?? hangul;

export type StemInfo = {
  hanja: string;
  hangul: string;
  element: OhaengKey;
  /** 일간 대비 십신. 일간 자신은 '일간'. */
  sipsin: string;
  /** 십신 영문 설명(프리미엄 프롬프트용, Phase 1-3). 매핑 없으면 ''. */
  sipsinEn: string;
};

export type BranchInfo = {
  hanja: string;
  hangul: string;
  element: OhaengKey;
  /** 지지 본기(本氣) 기준 십신. */
  sipsin: string;
  /** 십신 영문 설명(프리미엄 프롬프트용, Phase 1-3). 매핑 없으면 ''. */
  sipsinEn: string;
  /** 지장간(한자) — [여기, (중기), 본기]. */
  hiddenStems: string[];
  /** 일간 기준 십이운성. */
  sibiUnseong: string;
};

export type PillarInfo = {
  position: PillarPosition;
  ganzhi: string; // 두 글자 (예: '辛亥'), 시간 미상이면 '??'
  stem: StemInfo | null; // 시간 미상 시주는 null
  branch: BranchInfo | null;
};

export type DaeunEntry = {
  startAge: number;
  startYear: number;
  stem: string;
  branch: string;
  ganzhi: string;
  sipsin: string; // 대운 천간의 십신
  sibiUnseong: string; // 대운 지지의 십이운성
  isCurrent: boolean;
};

export type SeunInfo = {
  sajuYear: number; // 입춘 기준 사주 연도
  stem: string;
  branch: string;
  ganzhi: string;
  sipsin: string;
  sibiUnseong: string;
};

export type WolunEntry = {
  index: number;
  ganzhi: string;
  jeolName: string;
  startKstISO: string;
  endKstISO: string;
  sipsin: string;
  isCurrent: boolean;
};

export type RunToken = {
  scope: RunScope;
  label: string; // '년주'/'월주'/... 또는 '세운'/'월운'
  stem: string;
  branch: string;
};

export type HapChungEvent = {
  /** 관계 태그: 천간합·천간충·육합·삼합·반합·충·형·파·해·원진 */
  tag: string;
  /** 상세(예: '금합', '화국'). 태그로 충분하면 태그와 동일. */
  detail: string;
  /** 관여 대상 2곳(삼합/반합은 대표 2곳). */
  between: Array<{ scope: RunScope; label: string; char: string }>;
};

export type GongmangInfo = {
  branches: string[]; // 공망 지지 2개(한자)
  branchesHangul: string[];
  /** 공망에 걸린 원국 주(位). */
  natalHits: PillarPosition[];
  /** 세운/현재 월운 지지가 공망인지. */
  seunInGongmang: boolean;
  wolunInGongmang: boolean;
};

export type ShinsalEntry = {
  scope: RunScope;
  label: string; // 위치 또는 세운/월운
  branch: string;
  name: string; // 신살명
};

export type SajuAnalysis = {
  meta: {
    asOfISO: string;
    input: { dateStr: string; timeStr: string; isLunar: boolean; isLeap: boolean; gender: 'M' | 'F'; unknownTime: boolean };
    /** 만세력 파생 필드는 검증된 결정론 산출임을 표시. */
    manseryeokVerified: true;
  };
  /** 명식 8자 — 년·월·일·시 순. */
  myeongsik: PillarInfo[];
  dayMaster: { hanja: string; hangul: string; element: OhaengKey };
  /** 오행 분포(가시 8자 기준 개수). */
  ohaeng: Record<OhaengKey, number>;
  daeun: DaeunEntry[];
  currentDaeun: DaeunEntry | null;
  seun: SeunInfo;
  wolun: WolunEntry[];
  currentWolunIndex: number;
  hapChungEvents: HapChungEvent[];
  gongmang: GongmangInfo;
  shinsal: ShinsalEntry[];
  nearJieqiBoundary: boolean;
  minHoursToJieqi: number | null;
  /** ⚠️ 유파 의존 잠정 해석(검증 정답 없음). null 허용 예약(플랜 1-2). */
  gyeokYongshin: GyeokYongshin | null;
  provisionalNote: string;
};

export type BuildSajuAnalysisInput = {
  dateStr: string; // 'YYYY-MM-DD'
  timeStr: string; // 'HH:mm'
  isLunar: boolean;
  isLeap: boolean;
  gender: 'M' | 'F';
  unknownTime?: boolean;
  timezone?: string;
  /** 조회 시점(대운·세운·월운 현재 판정 기준). 기본: 호출 시각. */
  asOfDate?: Date;
};

const PROVISIONAL_NOTE =
  '만세력 파생 필드(명식·대운·월운·세운·공망·신살·합충·절입경계)는 검증된 결정론 산출입니다. ' +
  'gyeokYongshin은 유파에 따라 달라지는 잠정 해석이므로 참고 경향으로만 사용하세요(검증된 단일 정답 없음).';

/** 사주 원국·운을 조립해 SajuAnalysis 구조체를 만든다(결정론). */
export const buildSajuAnalysis = (input: BuildSajuAnalysisInput): SajuAnalysis => {
  const { dateStr, timeStr, isLunar, isLeap, gender } = input;
  const unknownTime = input.unknownTime ?? false;
  const timezone = input.timezone ?? 'Asia/Seoul';
  const asOfDate = input.asOfDate ?? new Date();

  const saju = getSajuData(dateStr, timeStr, isLunar, isLeap, unknownTime, timezone);
  const daeunRaw = getDaeunData(dateStr, timeStr, isLunar, isLeap, gender, unknownTime, timezone);

  // saju 반환 순서 [시, 일, 월, 년] → 명식은 [년, 월, 일, 시]
  const [hourP, dayP, monthP, yearP] = saju;
  const natalOrder = [yearP, monthP, dayP, hourP];
  const dayStem = dayP.stem.hanja;

  const myeongsik: PillarInfo[] = natalOrder.map((p) => toPillarInfo(p, dayStem));

  const dayMaster = {
    hanja: dayStem,
    hangul: hanjaToHangul[dayStem] ?? dayStem,
    element: dayP.stem.element as OhaengKey,
  };

  // ── 오행 분포(가시 8자) ──
  const ohaeng: Record<OhaengKey, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of natalOrder) {
    for (const glyph of [p.stem, p.branch]) {
      const el = glyph?.element as OhaengKey | undefined;
      if (el && el in ohaeng) ohaeng[el] += 1;
    }
  }

  // ── 세운·월운(조회 시점) ──
  const { sajuYear, seun: seunGz, wolun: currentWolun, months } = getCurrentWolun(asOfDate);
  const seun: SeunInfo = {
    sajuYear,
    stem: seunGz.stem,
    branch: seunGz.branch,
    ganzhi: seunGz.ganzhi,
    sipsin: calculateDeity(dayStem, seunGz.stem),
    sibiUnseong: getSipseung(dayStem, seunGz.branch),
  };
  const wolun: WolunEntry[] = months.map((m) => toWolunEntry(m, dayStem, currentWolun.index));

  // ── 대운(현재 대운 표시) ──
  const asOfYear = new Date(asOfDate.getTime() + 9 * 3600 * 1000).getUTCFullYear();
  let currentDaeunIdx = -1;
  daeunRaw.forEach((d, i) => {
    if (d.startYear <= asOfYear) currentDaeunIdx = i;
  });
  const daeun: DaeunEntry[] = daeunRaw.map((d, i) => ({
    startAge: d.startAge,
    startYear: d.startYear,
    stem: d.stem,
    branch: d.branch,
    ganzhi: `${d.stem}${d.branch}`,
    sipsin: calculateDeity(dayStem, d.stem),
    sibiUnseong: getSipseung(dayStem, d.branch),
    isCurrent: i === currentDaeunIdx,
  }));
  const currentDaeun = currentDaeunIdx >= 0 ? daeun[currentDaeunIdx] : null;

  // ── 합충 이벤트(원국 ↔ 세운 ↔ 현재 월운) ──
  const tokens: RunToken[] = [
    ...natalOrder
      .filter((p) => p.stem.hanja !== '?' && p.branch.hanja !== '?')
      .map((p) => ({ scope: '원국' as RunScope, label: p.title as string, stem: p.stem.hanja, branch: p.branch.hanja })),
    { scope: '세운', label: '세운', stem: seun.stem, branch: seun.branch },
    { scope: '월운', label: '월운', stem: currentWolun.stem, branch: currentWolun.branch },
  ];
  const hapChungEvents = detectHapChung(tokens);

  // ── 공망(일주 기준 단일 — 기준서 부록 A-6) ──
  const gongmang = buildGongmang(dayP, natalOrder, seun.branch, currentWolun.branch);

  // ── 신살(연지 12신살 + 일간 기준 귀인/살) ──
  const shinsal = buildShinsal(natalOrder, dayStem, yearP.branch.hanja, seun, currentWolun, dayP);

  // ── 절입 경계 플래그(getSajuData 부착) ──
  const nearJieqiBoundary = (saju as any).nearJieqiBoundary ?? false;
  const minHoursToJieqi = (saju as any).minHoursToJieqi ?? null;

  // ── 격국·용신(provisional) ──
  const gyeokYongshin = analyzeGyeokYongshin(saju);

  return {
    meta: {
      asOfISO: new Date(asOfDate.getTime()).toISOString(),
      input: { dateStr, timeStr, isLunar, isLeap, gender, unknownTime },
      manseryeokVerified: true,
    },
    myeongsik,
    dayMaster,
    ohaeng,
    daeun,
    currentDaeun,
    seun,
    wolun,
    currentWolunIndex: currentWolun.index,
    hapChungEvents,
    gongmang,
    shinsal,
    nearJieqiBoundary,
    minHoursToJieqi,
    gyeokYongshin,
    provisionalNote: PROVISIONAL_NOTE,
  };
};

const toPillarInfo = (p: any, dayStem: string): PillarInfo => {
  const position = p.title as PillarPosition;
  if (p.stem.hanja === '?' || p.branch.hanja === '?') {
    return { position, ganzhi: '??', stem: null, branch: null };
  }
  const stemHanja = p.stem.hanja;
  const branchHanja = p.branch.hanja;
  const stemSipsin = position === '일주' ? '일간' : calculateDeity(dayStem, stemHanja);
  const branchSipsin = calculateDeity(dayStem, branchHanja, true);
  return {
    position,
    ganzhi: `${stemHanja}${branchHanja}`,
    stem: {
      hanja: stemHanja,
      hangul: hanjaToHangul[stemHanja] ?? stemHanja,
      element: p.stem.element as OhaengKey,
      sipsin: stemSipsin,
      sipsinEn: getDeityEnglishExplanation(stemSipsin),
    },
    branch: {
      hanja: branchHanja,
      hangul: hanjaToHangul[branchHanja] ?? branchHanja,
      element: p.branch.element as OhaengKey,
      sipsin: branchSipsin,
      sipsinEn: getDeityEnglishExplanation(branchSipsin),
      hiddenStems: (hiddenStems[branchHanja] ?? []).map(hangulToHanja),
      sibiUnseong: getSipseung(dayStem, branchHanja),
    },
  };
};

const toWolunEntry = (m: WolunMonth, dayStem: string, currentIndex: number): WolunEntry => ({
  index: m.index,
  ganzhi: m.ganzhi,
  jeolName: m.jeolName,
  startKstISO: m.startKstISO,
  endKstISO: m.endKstISO,
  sipsin: calculateDeity(dayStem, m.stem),
  isCurrent: m.index === currentIndex,
});

/** 토큰 집합 내 천간·지지 합충형파해·원진·삼합 이벤트를 추출. */
const detectHapChung = (tokens: RunToken[]): HapChungEvent[] => {
  const events: HapChungEvent[] = [];
  const at = (t: RunToken, char: string) => ({ scope: t.scope, label: t.label, char });

  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i];
      const b = tokens[j];

      // 천간합
      for (const [s1, s2, name] of STEM_HAP) {
        if ((a.stem === s1 && b.stem === s2) || (a.stem === s2 && b.stem === s1)) {
          events.push({ tag: '천간합', detail: name, between: [at(a, a.stem), at(b, b.stem)] });
        }
      }
      // 천간충
      for (const [s1, s2] of STEM_CHUNG) {
        if ((a.stem === s1 && b.stem === s2) || (a.stem === s2 && b.stem === s1)) {
          events.push({ tag: '천간충', detail: '천간충', between: [at(a, a.stem), at(b, b.stem)] });
        }
      }
      // 지지 육합
      const yh = getYukhap(a.branch, b.branch);
      if (yh) events.push({ tag: '육합', detail: yh, between: [at(a, a.branch), at(b, b.branch)] });
      // 지지 충/형/파/해/원진
      if (isChung(a.branch, b.branch)) events.push({ tag: '충', detail: '지지충', between: [at(a, a.branch), at(b, b.branch)] });
      if (isHyeong(a.branch, b.branch)) events.push({ tag: '형', detail: '형', between: [at(a, a.branch), at(b, b.branch)] });
      if (isPa(a.branch, b.branch)) events.push({ tag: '파', detail: '파', between: [at(a, a.branch), at(b, b.branch)] });
      if (isHae(a.branch, b.branch)) events.push({ tag: '해', detail: '해', between: [at(a, a.branch), at(b, b.branch)] });
      if (isWonjin(a.branch, b.branch)) events.push({ tag: '원진', detail: '원진', between: [at(a, a.branch), at(b, b.branch)] });
      if (isGwimun(a.branch, b.branch)) events.push({ tag: '귀문', detail: '귀문관살', between: [at(a, a.branch), at(b, b.branch)] });
    }
  }

  // 삼합/반합(토큰 지지 집합 기준)
  for (const [trio, name] of BRANCH_SAMHAP) {
    const present = trio
      .map((br) => tokens.find((t) => t.branch === br))
      .filter((t): t is RunToken => Boolean(t));
    // 서로 다른 지지가 3개면 삼합, 2개면 반합
    const distinctBranches = new Set(present.map((t) => t.branch));
    if (distinctBranches.size >= 2) {
      const tag = distinctBranches.size >= 3 ? '삼합' : '반합';
      const reps = [...distinctBranches].map((br) => {
        const t = present.find((x) => x.branch === br)!;
        return { scope: t.scope, label: t.label, char: br };
      });
      events.push({ tag, detail: name, between: [reps[0], reps[1]] });
    }
  }

  return events;
};

const buildGongmang = (
  dayP: any,
  natalOrder: any[],
  seunBranch: string,
  wolunBranch: string,
): GongmangInfo => {
  const gm = getGongmang(dayP.stem.hanja, dayP.branch.hanja);
  const natalHits = natalOrder
    .filter((p) => p.branch?.hanja && gm.includes(p.branch.hanja))
    .map((p) => p.title as PillarPosition);
  return {
    branches: gm,
    branchesHangul: gm.map((b) => hanjaToHangul[b] ?? b),
    natalHits,
    seunInGongmang: gm.includes(seunBranch),
    wolunInGongmang: gm.includes(wolunBranch),
  };
};

const buildShinsal = (
  natalOrder: any[],
  dayStem: string,
  yearBranch: string,
  seun: SeunInfo,
  currentWolun: { stem: string; branch: string },
  dayP: any,
): ShinsalEntry[] => {
  const out: ShinsalEntry[] = [];

  // 연지 기준 12신살 (원국 + 세운 + 월운)
  const scan: Array<{ scope: RunScope; label: string; branch: string }> = [
    ...natalOrder
      .filter((p) => p.branch?.hanja && p.branch.hanja !== '?')
      .map((p) => ({ scope: '원국' as RunScope, label: p.title as string, branch: p.branch.hanja as string })),
    { scope: '세운', label: '세운', branch: seun.branch },
    { scope: '월운', label: '월운', branch: currentWolun.branch },
  ];
  for (const s of scan) {
    const name = getShinsal(yearBranch, s.branch);
    if (name) out.push({ scope: s.scope, label: s.label, branch: s.branch, name });
  }

  // 일간 기준 귀인/살 (원국 지지 매칭)
  const guiin = getCheoneulGuiin(dayStem);
  const munchang = getMunchang(dayStem);
  const hakdang = getHakdang(dayStem);
  const yangin = getYangin(dayStem);
  const hongyeom = getHongyeom(dayStem);
  for (const p of natalOrder) {
    const br = p.branch?.hanja;
    if (!br || br === '?') continue;
    const label = p.title as string;
    if (guiin.includes(br)) out.push({ scope: '원국', label, branch: br, name: '천을귀인' });
    if (munchang === br) out.push({ scope: '원국', label, branch: br, name: '문창귀인' });
    if (hakdang === br) out.push({ scope: '원국', label, branch: br, name: '학당귀인' });
    if (yangin === br) out.push({ scope: '원국', label, branch: br, name: '양인살' });
    if (hongyeom === br) out.push({ scope: '원국', label, branch: br, name: '홍염살' });
  }

  // 괴강살(일주)
  if (dayP.stem?.hanja && dayP.branch?.hanja && isGoegang(dayP.stem.hanja, dayP.branch.hanja)) {
    out.push({ scope: '원국', label: '일주', branch: dayP.branch.hanja, name: '괴강살' });
  }

  return out;
};

export { OHAENG_KO };
