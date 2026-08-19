import { Solar } from 'lunar-javascript';
import {
  calculateDeity,
  getCheoneulGuiin,
  getGongmang,
  getYukhap,
  hanjaToHangul,
  isChung,
  isHyeong,
  isWonjin,
} from '../utils/saju';
import { getSeoulTodayParts } from './seoulDateGanji';
import { PDF_SANS_FONT_LINKS, PDF_SANS_STACK } from './pdfFonts';
import { getSeunGanzhi, getWolunData, type WolunMonth } from './manseryeok/wolun';
import { activeBand, buildDaeunBands } from './analysis/lifeIndex';
import { analyzeByRulesFromGanzhi } from './analysis/rules';
import { branchMainStem, ELEMENT_KO, PRODUCED_BY, STEM_ELEMENT, type Ohaeng } from './analysis/rules/tables';
import type { MyeongsikParams } from './buildMyeongsik';

/**
 * 월 일진 캘린더 (무료 부가 서비스) — 코드 보유자에게 다음 달 일진표 PDF를 제공한다.
 *
 * 판정은 전부 정적 규칙(십성·합충·신살 조견표)이며 LLM을 호출하지 않는다
 * (만세력 정적 원칙과 동일). 등급 어휘·레이아웃은 일진 캘린더 스킬(벽걸이 달력형
 * A4 가로 1장, ◎◎~▲▲ 5단계)을 그대로 따른다.
 *
 * 등급은 두 모드로 나뉜다:
 *   - 컨텍스트 모드 (저장된 명식 전달) — 원국 강약·용신 + 대운·세운·월운·일진을 함께 본다.
 *   - 샘플 모드 (일주 간지 문자열만 전달) — 일진↔일주 관계만 본다. 랜딩 홍보용.
 *
 * 컨텍스트 모드에 필요한 값(대운 간지 포함)은 전부 저장된 MyeongsikParams에서 유도되므로
 * 사용자 추가 입력도, 개인정보 추가 저장도 없다. 일진 산출 자체가 순수 함수라 캐싱 구조도 그대로다.
 *
 * ⛔ 등급 규칙표·십성 키워드·오행 과다 임계는 OWNER 확정 전 임시안 — 바꿀 땐 이 파일만 수정하면 된다.
 */

// ─── 타입 ───────────────────────────────────────────────────────────────────

export interface IljinDay {
  day: number;
  /** 일진 간지 (한자 2자, 예: '丁未') */
  ganji: string;
  /** 간지 한글 (예: '정미') */
  ganjiHangul: string;
  /** 천간 십성/지지 십성 (예: '정재/정관') */
  sipsin: string;
  /** ◎◎ | ◎ | ○ | △ | ▲ | ▲▲ */
  rating: string;
  /** 4~10자 한줄 해설 (과다·운충 경고 우선, 다음 합충·신살, 없으면 십성 키워드) */
  note: string;
}

/**
 * 등급 계산에 실제로 반영된 운(運) — PDF 표기·검증용.
 * 저장된 명식에서 전부 유도되는 값이라 별도 입력도, 개인정보 저장도 필요 없다.
 */
export interface IljinContext {
  /** 대운 간지 (대운 시작 전 나이면 null) */
  daeun: string | null;
  /** 이 달에 걸친 세운 간지 — 입춘을 넘는 달은 2개 */
  seun: string[];
  /** 이 달에 걸친 월운 간지 — 절입을 넘는 달은 2개 */
  wolun: string[];
  /** 원국 강약 분류 (신강/신약 등) */
  strength: string;
  /** 용신 오행 (한글) */
  yongshin: string;
  /** 기신 오행 (한글) */
  gisin: string;
}

export interface IljinMonth {
  year: number;
  month: number;
  /** 이 양력 월에 절입하는 절기 (예: { name: '입추', day: 7, ganzhi: '丙申' }) — 없으면 null */
  jeolip: { name: string; day: number; ganzhi: string } | null;
  days: IljinDay[];
  /**
   * 원국·대운·세운·월운이 등급에 반영됐는지.
   * false = 일주 간지만 알고 부르는 샘플 모드(랜딩 홍보용) — 일진↔일주 관계만 본다.
   */
  contextual: boolean;
  context: IljinContext | null;
}

// ─── 등급 규칙 (임시안) ─────────────────────────────────────────────────────

/** 등급 사다리 — 인덱스가 클수록 길하다 */
const LADDER = ['▲▲', '▲', '△', '○', '◎', '◎◎'] as const;

/** 천간 십성 → 기본 등급 */
const BASE_RATING: Record<string, string> = {
  정재: '○',
  정관: '○',
  정인: '○',
  식신: '○',
  편재: '△',
  편인: '△',
  비견: '△',
  겁재: '▲',
  상관: '▲',
  편관: '▲',
};

/** 천간합 (甲己·乙庚·丙辛·丁壬·戊癸) */
const STEM_HAP: Record<string, string> = {
  甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛',
  辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊',
};

/** 십성별 한줄 키워드 (합충 태그가 없을 때의 기본 해설) */
const SIPSIN_KEYWORD: Record<string, string> = {
  비견: '동료·협업',
  겁재: '지출 주의',
  식신: '실행·창작',
  상관: '구설 주의',
  편재: '기회 포착',
  정재: '실속·계약',
  편관: '압박·결단',
  정관: '공식 일정',
  편인: '재충전·구상',
  정인: '문서·학습',
};

/**
 * 오행 중복 임계 — 원국(6~8자) + 대운·세운·월운·일진(8자) 중 같은 오행이 이 개수 이상 쌓이면
 * 그 오행의 날은 길신 가산을 전부 취소하고 한 단계 내린다.
 *
 * 용신·조후에 필요한 오행이라도 과다는 과다다. 이 규칙이 없으면 합·귀인 가산만 누적되어
 * 삼중 중첩일(예: 대운 午 + 세운 丙午 + 일진 丙午)이 최고 등급으로 나온다.
 *
 * 값 7은 OWNER 확정(2026-08-20, docs/decisions.md). 전체 16자에서 오행 하나의 기대값이
 * 3.2자이므로 기대치의 2.2배다. 명식 120개 × 12개월(43,800일) 실측 과다 적용률 13.7%
 * (달당 약 4일) — 6이면 30.5%로 경고가 흔해지고, 5면 54.0%에 최대 25일 연속으로 무의미해진다.
 */
const ELEMENT_EXCESS_THRESHOLD = 7;

const shift = (rating: string, delta: number): string => {
  const idx = LADDER.indexOf(rating as (typeof LADDER)[number]);
  if (idx < 0) return rating;
  return LADDER[Math.min(LADDER.length - 1, Math.max(0, idx + delta))];
};

// ─── 일진 계산 ──────────────────────────────────────────────────────────────

const toHangul = (ganji: string): string =>
  ganji
    .split('')
    .map((c) => hanjaToHangul[c] || c)
    .join('');

const dayGanjiOf = (year: number, month: number, day: number): string => {
  const solar = Solar.fromYmd(year, month, day);
  return solar.getLunar().getEightChar().getDay();
};

const lastDayOf = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** 월운 12구간은 사주 연도당 한 번만 계산한다 (절입 시각 산출이 무겁다). */
const wolunCache = new Map<number, WolunMonth[]>();
const wolunOf = (sajuYear: number): WolunMonth[] => {
  let bands = wolunCache.get(sajuYear);
  if (!bands) {
    bands = getWolunData(sajuYear);
    wolunCache.set(sajuYear, bands);
  }
  return bands;
};

/** 대상 양력 월에 절입하는 절기를 찾는다 (startKstISO는 KST 오프셋 ISO라 날짜부가 곧 KST 날짜). */
const findJeolip = (year: number, month: number): IljinMonth['jeolip'] => {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  for (const sajuYear of [year, year - 1]) {
    const w = wolunOf(sajuYear).find((m) => m.startKstISO.startsWith(prefix));
    if (w) return { name: w.jeolName, day: Number(w.startKstISO.slice(8, 10)), ganzhi: w.ganzhi };
  }
  return null;
};

/**
 * 그 날에 걸린 사주 연도(입춘 기준)와 월운 구간.
 * 판정 기준 시각은 그날 12:00 KST — 절입이 그날 낮 12시 이후면 직전 달로 잡히는
 * 일 단위 근사다(절입일 자체는 캘린더 셀에 절기명으로 따로 표기된다).
 */
const runOfDay = (year: number, month: number, day: number): { sajuYear: number; wolun: WolunMonth } | null => {
  const t = Date.UTC(year, month - 1, day, 3); // 12:00 KST = 03:00 UTC
  for (const sajuYear of [year, year - 1]) {
    const wolun = wolunOf(sajuYear).find((m) => t >= m.startUtcMs && t < m.endUtcMs);
    if (wolun) return { sajuYear, wolun };
  }
  return null;
};

type ElementCounts = Record<Ohaeng, number>;

const emptyCounts = (): ElementCounts => ({ wood: 0, fire: 0, earth: 0, metal: 0, water: 0 });

/** 간지 2자를 오행 카운트에 더한다 — 천간은 그대로, 지지는 본기(本氣) 기준. */
const addGanzhi = (counts: ElementCounts, ganzhi: string | null): void => {
  if (!ganzhi || ganzhi.length < 2) return;
  const stemEl = STEM_ELEMENT[ganzhi.charAt(0)];
  if (stemEl) counts[stemEl] += 1;
  const branchEl = STEM_ELEMENT[branchMainStem(ganzhi.charAt(1))];
  if (branchEl) counts[branchEl] += 1;
};

const KO_TO_ELEMENT: Record<string, Ohaeng> = { 목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water' };

interface RunContext {
  /** 원국만의 오행 카운트 (매일 여기에 운 4주를 더해 과다를 판정한다) */
  natalCounts: ElementCounts;
  /** 용신 + 희신 오행 */
  favor: Set<Ohaeng>;
  gisin: Ohaeng | null;
  daeun: string | null;
  strength: string;
  yongshinKo: string;
  gisinKo: string;
}

/**
 * 저장된 명식으로 등급 보정에 쓸 원국 판정(강약·용신·기신)과 대운 간지를 만든다.
 * 대운 간지는 daeunsu·대운 방향·월주에서 결정론적으로 나오므로 사용자 입력이 필요 없다.
 * 나이는 `대상 연도 − 출생 연도`로 잡는다(생월·생일은 저장하지 않는다 — 인생 100년 지수와 동일 관례).
 */
const buildRunContext = (m: MyeongsikParams, year: number): RunContext | null => {
  const hour = m.timeUnknown ? null : m.pillars.hour;
  const analysis = analyzeByRulesFromGanzhi({
    year: m.pillars.year,
    month: m.pillars.month,
    day: m.pillars.day,
    hour,
  });
  if (!analysis) return null;

  const yongEl = analysis.yongshin.element;
  const natalCounts = emptyCounts();
  for (const gz of [m.pillars.year, m.pillars.month, m.pillars.day, hour]) addGanzhi(natalCounts, gz);

  const band = activeBand(buildDaeunBands(m.pillars.month, m.daeunsu, m.daeunDirection), year - m.birthYear);

  return {
    natalCounts,
    favor: new Set<Ohaeng>([yongEl, PRODUCED_BY[yongEl]]),
    gisin: KO_TO_ELEMENT[analysis.yongshin.gisin] ?? null,
    daeun: band ? `${band.gan}${band.ji}` : null,
    strength: analysis.strength.class,
    yongshinKo: ELEMENT_KO[yongEl],
    gisinKo: analysis.yongshin.gisin,
  };
};

/**
 * 일주(간지 2자) 기준으로 한 달의 일진·십성·등급·해설을 계산한다.
 *
 * `source`에 저장된 명식(MyeongsikParams)을 주면 원국 강약·용신과 대운·세운·월운까지
 * 등급에 반영한다. 일주 문자열만 주면 일진↔일주 관계만 보는 샘플 모드다(랜딩 홍보용).
 * 어느 쪽이든 생년월일 원문은 쓰지 않는다.
 */
export function getMonthIljin(year: number, month: number, source: string | MyeongsikParams): IljinMonth {
  const dayPillar = typeof source === 'string' ? source : source.pillars.day;
  const ctx = typeof source === 'string' ? null : buildRunContext(source, year);

  const dayStem = dayPillar.charAt(0);
  const dayBranch = dayPillar.charAt(1);
  const guiin = getCheoneulGuiin(dayStem);
  const gongmang = getGongmang(dayStem, dayBranch);

  const seunSeen: string[] = [];
  const wolunSeen: string[] = [];

  const days: IljinDay[] = [];
  for (let d = 1; d <= lastDayOf(year, month); d++) {
    const ganji = dayGanjiOf(year, month, d);
    const stem = ganji.charAt(0);
    const branch = ganji.charAt(1);

    const stemDeity = calculateDeity(dayStem, stem) || '비견';
    const branchDeity = calculateDeity(dayStem, branch, true) || '';

    // 그 날의 운 — 컨텍스트 모드에서만 쓴다.
    const run = ctx ? runOfDay(year, month, d) : null;
    const seun = run ? getSeunGanzhi(run.sajuYear).ganzhi : null;
    const wolun = run ? run.wolun.ganzhi : null;
    if (seun && !seunSeen.includes(seun)) seunSeen.push(seun);
    if (wolun && !wolunSeen.includes(wolun)) wolunSeen.push(wolun);

    const warnTags: string[] = []; // 과다·운충 — 가장 먼저 보여줄 경고
    const negTags: string[] = [];
    const posTags: string[] = [];
    let bonus = 0;
    let penalty = 0;

    const base = BASE_RATING[stemDeity] ?? '△';
    const bokeum = ganji === dayPillar;

    if (bokeum) {
      // 복음(伏吟) — 일주와 동일한 간지. 원국 합충은 자기 자신과의 관계라 보지 않는다.
      negTags.push('복음');
    } else {
      if (STEM_HAP[dayStem] === stem) {
        bonus += 1;
        posTags.push('천간합');
      }
      if (getYukhap(dayBranch, branch)) {
        bonus += 1;
        posTags.push('육합');
      }
      if (guiin.includes(branch)) {
        bonus += 1;
        posTags.push('천을귀인');
      }
      if (isChung(dayBranch, branch)) {
        penalty -= 2;
        negTags.push('일지충');
      }
      if (isWonjin(dayBranch, branch)) {
        penalty -= 1;
        negTags.push('원진');
      }
      if (isHyeong(dayBranch, branch)) {
        penalty -= 1;
        negTags.push('형살');
      }
      if (gongmang.includes(branch)) {
        penalty -= 1;
        negTags.push('공망');
      }
    }

    let rating: string;

    if (!ctx) {
      // 샘플 모드 — 원국·운을 모르므로 일진↔일주 관계만으로 매긴다.
      rating = bokeum ? '△' : shift(base, bonus + penalty);
    } else {
      const dayEls = [STEM_ELEMENT[stem], STEM_ELEMENT[branchMainStem(branch)]].filter(Boolean) as Ohaeng[];

      // 원국 용신·기신 — 십성 이름이 아니라 일간이 실제로 필요로 하는 오행으로 본다.
      if (!bokeum) {
        if (dayEls.some((el) => ctx.favor.has(el))) {
          bonus += 1;
          posTags.push('용신');
        } else if (ctx.gisin && dayEls.includes(ctx.gisin)) {
          penalty -= 1;
          negTags.push('기신');
        }
      }

      // 운(대운·세운·월운) 지지와의 충 — 원국 일지만 보던 기존 판정의 공백.
      // 대운·세운 지지가 같으면(예: 대운 午 + 세운 丙午) 충은 하나다. 같은 충을 두 번
      // 세면 감점이 실제보다 두 배가 되므로 지지 기준으로 중복을 걷어낸다.
      const runBranches = [
        ctx.daeun ? { label: '대운충', branch: ctx.daeun.charAt(1) } : null,
        seun ? { label: '세운충', branch: seun.charAt(1) } : null,
        wolun ? { label: '월운충', branch: wolun.charAt(1) } : null,
      ].filter(Boolean) as Array<{ label: string; branch: string }>;
      const chungSeen = new Set<string>();
      for (const r of runBranches) {
        if (chungSeen.has(r.branch) || !isChung(r.branch, branch)) continue;
        chungSeen.add(r.branch);
        penalty -= 1;
        warnTags.push(r.label);
      }

      // 오행 과다 — 원국 + 대운·세운·월운·일진 누적.
      const counts = { ...ctx.natalCounts };
      addGanzhi(counts, ctx.daeun);
      addGanzhi(counts, seun);
      addGanzhi(counts, wolun);
      addGanzhi(counts, ganji);
      const excess = dayEls.find((el) => counts[el] >= ELEMENT_EXCESS_THRESHOLD);

      if (excess) {
        // 길신 가산을 전부 취소하고 한 단계 내린다 — 용신이라도 과다는 과다다.
        bonus = 0;
        penalty -= 1;
        warnTags.unshift(`${ELEMENT_KO[excess]}과다`);
        // 가산이 취소됐는데 '용신'을 길한 표시로 남겨두면 해설이 서로 모순된다.
        const yong = posTags.indexOf('용신');
        if (yong >= 0) posTags.splice(yong, 1);
      }

      rating = shift(bokeum ? '△' : base, bonus + penalty);
    }

    const tags = [...warnTags, ...negTags, ...posTags];

    days.push({
      day: d,
      ganji,
      ganjiHangul: toHangul(ganji),
      sipsin: branchDeity ? `${stemDeity}/${branchDeity}` : stemDeity,
      rating,
      note: tags.length > 0 ? tags.slice(0, 3).join('·') : (SIPSIN_KEYWORD[stemDeity] ?? ''),
    });
  }

  return {
    year,
    month,
    jeolip: findJeolip(year, month),
    days,
    contextual: Boolean(ctx),
    context: ctx
      ? {
          daeun: ctx.daeun,
          seun: seunSeen,
          wolun: wolunSeen,
          strength: ctx.strength,
          yongshin: ctx.yongshinKo,
          gisin: ctx.gisinKo,
        }
      : null,
  };
}

/** 서울 기준 이번 달 { year, month } */
export function getThisMonthKst(): { year: number; month: number } {
  const { year, month } = getSeoulTodayParts();
  return { year, month };
}

/** 서울 기준 다음 달 { year, month } */
export function getNextMonthKst(): { year: number; month: number } {
  const { year, month } = getSeoulTodayParts();
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/**
 * 랜딩 홍보 문구에 보여줄 달 — 15일까지는 이번 달, 16일부터는 다음 달.
 * 월 후반에는 이번 달이 얼마 남지 않아 다음 달을 먼저 보여주는 것이 더 매력적이다.
 */
export function getPromoMonthKst(): { year: number; month: number } {
  const { day } = getSeoulTodayParts();
  return day <= 15 ? getThisMonthKst() : getNextMonthKst();
}

// ─── 캘린더 HTML (A4 가로 1장 · 벽걸이 달력형) ─────────────────────────────

const RATING_COLORS: Record<string, string> = {
  '◎◎': '#bfe0b8',
  '◎': '#e3f0e0',
  '○': '#f5f0e6',
  '△': '#f0f0f0',
  '▲': '#fbe4e4',
  '▲▲': '#f5b8b8',
};

const RATING_BORDER: Record<string, string> = { '◎◎': 'great', '◎': 'great', '▲▲': 'hazard' };

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type GridCell = number | null | [number, number | null];

/** 일요일 시작 주 그리드 — 6주가 되면 마지막 짧은 주를 이전 주 같은 요일 칸에 병합 */
const buildGrid = (year: number, month: number, lastDay: number): GridCell[][] => {
  const sunStartIdx = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const grid: GridCell[][] = [];
  let week: GridCell[] = Array(sunStartIdx).fill(null);
  for (let d = 1; d <= lastDay; d++) {
    week.push(d);
    if (week.length === 7) {
      grid.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    grid.push(week);
  }
  if (grid.length === 6) {
    const last = grid.pop()!;
    const prev = grid.pop()!;
    grid.push(prev.map((a, i) => [a as number, last[i] as number | null] as [number, number | null]));
  }
  return grid;
};

const dayBlock = (m: IljinMonth, d: IljinDay, small: boolean): string => {
  const wd = new Date(Date.UTC(m.year, m.month - 1, d.day)).getUTCDay();
  const wdClass = wd === 0 ? 'sun' : wd === 6 ? 'sat' : '';
  const jeolTag = m.jeolip && m.jeolip.day === d.day ? `<span class="jeol">${esc(m.jeolip.name)}</span>` : '';
  return `<div class="daynum-block ${small ? 'sub' : ''}">
    <div class="dnum ${wdClass}">${d.day}<span class="wdtag">${WEEKDAYS[wd]}</span>${jeolTag}<span class="rating">${d.rating}</span></div>
    <div class="ganji-row"><span class="ganji">${esc(d.ganji)}</span><span class="sipsin">${esc(d.sipsin)}</span></div>
    <div class="note-wrap"><div class="note">${esc(d.note)}</div></div>
  </div>`;
};

/**
 * 월 일진 캘린더 HTML — 기존 /api/generate-pdf(Puppeteer)로 렌더한다.
 * 표기: 일주 간지·사주 코드만. 생년월일 원문 미표기(2-4 원칙).
 */
export function buildIljinCalendarHtml(m: IljinMonth, dayPillar: string, code: string): string {
  const byDay = new Map(m.days.map((d) => [d.day, d]));
  const grid = buildGrid(m.year, m.month, m.days.length);

  const cellHtml = (n: number | null, extra = ''): string => {
    if (n === null || !byDay.has(n)) return '';
    return dayBlock(m, byDay.get(n)!, extra === 'sub');
  };

  const rows = grid
    .map((week) => {
      const cells = week.map((cell) => {
        if (cell === null) return '<div class="daycell empty"></div>';
        if (Array.isArray(cell)) {
          const [a, b] = cell;
          const da = byDay.get(a);
          if (!da && b === null) return '<div class="daycell empty"></div>';
          const bg = da ? RATING_COLORS[da.rating] ?? '#ffffff' : '#ffffff';
          const border = da ? RATING_BORDER[da.rating] ?? '' : '';
          const divider = b !== null ? '<div class="cell-divider"></div>' : '';
          return `<div class="daycell dual ${border}" style="background:${bg}">${cellHtml(a)}${divider}${b !== null ? cellHtml(b, 'sub') : ''}</div>`;
        }
        const d = byDay.get(cell)!;
        return `<div class="daycell ${RATING_BORDER[d.rating] ?? ''}" style="background:${RATING_COLORS[d.rating] ?? '#ffffff'}">${cellHtml(cell)}</div>`;
      });
      return `<div class="week-row">${cells.join('')}</div>`;
    })
    .join('\n');

  const header = WEEKDAYS.map(
    (n, i) => `<div class="hcell ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${n}</div>`,
  ).join('');

  const jeolipText = m.jeolip ? ` · ${m.jeolip.name} ${m.month}/${m.jeolip.day} 절입(${m.jeolip.ganzhi}월)` : '';
  // 반영된 운을 표기해 등급 근거를 드러낸다 — 전부 간지라 생년월일 원문은 노출되지 않는다.
  const runText = m.context
    ? ` · ${[m.context.daeun ? `대운 ${m.context.daeun}` : null, `세운 ${m.context.seun.join('·')}`]
        .filter(Boolean)
        .join(' · ')} 반영`
    : '';
  const subtitle = `${esc(dayPillar)}(${esc(toHangul(dayPillar))}) 일주 기준${esc(jeolipText)}${esc(runText)} · 사주 코드 ${esc(code)}`;

  // 폰트 링크는 반드시 실어 보낸다 — 서버리스 Chromium에는 한글 시스템 폰트가 없다(pdfFonts.ts 참고).
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
${PDF_SANS_FONT_LINKS}
<style>
@page { size: A4 landscape; margin: 10mm 12mm; }
* { box-sizing: border-box; }
body { font-family: ${PDF_SANS_STACK}; margin: 0; color: #2a2a2a; }
.title-bar { display: flex; justify-content: space-between; align-items: baseline;
  border-bottom: 3px solid #8a1f1f; padding-bottom: 6px; margin-bottom: 8px; }
.title-bar h1 { font-size: 21px; margin: 0; color: #8a1f1f; letter-spacing: 1px; }
.title-bar .subtitle { font-size: 11px; color: #555; max-width: 55%; text-align: right; }
.header-row { display: grid; grid-template-columns: repeat(7, 1fr); }
.hcell { background: #8a1f1f; color: white; font-size: 12px; padding: 4px 0; font-weight: 600; text-align: center; }
.hcell.sun, .hcell.sat { background: #6e1616; }
.week-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; }
.daycell { border: 0.75px solid #bbb; margin: -0.375px; padding: 3px 4px; position: relative;
  height: 30mm; display: flex; flex-direction: column; }
.daycell.dual { padding: 2px 4px; }
.daynum-block { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; }
.daynum-block.sub { padding-top: 1px; }
.cell-divider { border-top: 1px dashed #bbb; margin: 2px 0; }
.daycell.empty { background: #fafafa; border-color: #eee; }
.daycell.hazard { border: 1.6px solid #b02a2a; }
.daycell.great { border: 1.6px solid #2f7d32; }
.dnum { font-size: 11px; font-weight: 700; color: #333; flex: 0 0 auto; }
.dnum.sun { color: #b02a2a; }
.dnum.sat { color: #2a4fb0; }
.wdtag { font-size: 7.5px; font-weight: 400; color: #888; margin-left: 2px; }
.jeol { font-size: 7.5px; font-weight: 700; color: #8a1f1f; margin-left: 3px; }
.rating { font-size: 10px; font-weight: 700; color: #8a1f1f; float: right; }
.ganji-row { display: flex; align-items: baseline; gap: 5px; flex: 0 0 auto; margin-top: 1px; }
.ganji { font-size: 15px; font-weight: 700; letter-spacing: 1px; color: #2a2a2a; }
.daynum-block.sub .ganji { font-size: 12px; }
.sipsin { font-size: 8px; color: #666; font-weight: 500; }
.daynum-block.sub .sipsin { font-size: 7px; }
.note-wrap { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; min-height: 0; padding: 1px 0; }
.note { font-size: 7.6px; color: #999; font-weight: 400; line-height: 1.25; text-align: center; }
.daynum-block.sub .note { font-size: 6.6px; }
.legend { margin-top: 6px; font-size: 9px; color: #555; display: flex; gap: 18px; }
.legend span.mark { font-weight: 700; color: #8a1f1f; margin-right: 3px; }
.footer-note { margin-top: 5px; font-size: 8.5px; color: #777; }
</style></head><body>
<div class="title-bar">
  <h1>${m.year}년 ${m.month}월 일진 캘린더</h1>
  <div class="subtitle">${subtitle}</div>
</div>
<div class="header-row">${header}</div>
${rows}
<div class="legend">
  <div><span class="mark">◎</span>대길일</div>
  <div><span class="mark">○</span>길일</div>
  <div><span class="mark">△</span>평</div>
  <div><span class="mark">▲</span>주의</div>
  <div><span class="mark">▲▲</span>최대주의</div>
</div>
<div class="footer-note">${
    m.context
      ? `등급·해설은 원국(강약·용신)과 대운·세운·월운·일진을 함께 본 참고 정보입니다. 같은 오행이 과다하게 겹치는 날은 길신이라도 등급을 내립니다.`
      : `등급·해설은 일간 기준 십성과 합충 조견표에 따른 참고 정보입니다.`
  } 간지와 사주 코드 외 개인정보는 포함되지 않습니다.</div>
</body></html>`;
}
