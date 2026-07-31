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
import { getWolunData } from './manseryeok/wolun';

/**
 * 월 일진 캘린더 (무료 부가 서비스) — 코드 보유자에게 다음 달 일진표 PDF를 제공한다.
 *
 * 판정은 전부 정적 규칙(십성·합충·신살 조견표)이며 LLM을 호출하지 않는다
 * (만세력 정적 원칙과 동일). 등급 어휘·레이아웃은 일진 캘린더 스킬(벽걸이 달력형
 * A4 가로 1장, ◎◎~▲▲ 5단계)을 그대로 따른다.
 *
 * ⛔ 등급 규칙표·십성 키워드는 OWNER 확정 전 임시안 — 바꿀 땐 이 파일만 수정하면 된다.
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
  /** 4~10자 한줄 해설 (합충·신살 태그 우선, 없으면 십성 키워드) */
  note: string;
}

export interface IljinMonth {
  year: number;
  month: number;
  /** 이 양력 월에 절입하는 절기 (예: { name: '입추', day: 7, ganzhi: '丙申' }) — 없으면 null */
  jeolip: { name: string; day: number; ganzhi: string } | null;
  days: IljinDay[];
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

/** 대상 양력 월에 절입하는 절기를 찾는다 (startKstISO는 KST 오프셋 ISO라 날짜부가 곧 KST 날짜). */
const findJeolip = (year: number, month: number): IljinMonth['jeolip'] => {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  for (const sajuYear of [year, year - 1]) {
    const w = getWolunData(sajuYear).find((m) => m.startKstISO.startsWith(prefix));
    if (w) return { name: w.jeolName, day: Number(w.startKstISO.slice(8, 10)), ganzhi: w.ganzhi };
  }
  return null;
};

/**
 * 일주(간지 2자) 기준으로 한 달의 일진·십성·등급·해설을 계산한다.
 * 입력은 코드에 저장된 명식의 일주뿐 — 생년월일 원문은 쓰지 않는다.
 */
export function getMonthIljin(year: number, month: number, dayPillar: string): IljinMonth {
  const dayStem = dayPillar.charAt(0);
  const dayBranch = dayPillar.charAt(1);
  const guiin = getCheoneulGuiin(dayStem);
  const gongmang = getGongmang(dayStem, dayBranch);

  const days: IljinDay[] = [];
  for (let d = 1; d <= lastDayOf(year, month); d++) {
    const ganji = dayGanjiOf(year, month, d);
    const stem = ganji.charAt(0);
    const branch = ganji.charAt(1);

    const stemDeity = calculateDeity(dayStem, stem) || '비견';
    const branchDeity = calculateDeity(dayStem, branch, true) || '';

    const tags: string[] = [];
    let rating = BASE_RATING[stemDeity] ?? '△';

    if (ganji === dayPillar) {
      // 복음(伏吟) — 일주와 동일한 날은 평으로 고정
      rating = '△';
      tags.push('복음');
    } else {
      if (STEM_HAP[dayStem] === stem) {
        rating = shift(rating, 1);
        tags.push('천간합');
      }
      if (getYukhap(dayBranch, branch)) {
        rating = shift(rating, 1);
        tags.push('육합');
      }
      if (guiin.includes(branch)) {
        rating = shift(rating, 1);
        tags.push('천을귀인');
      }
      if (isChung(dayBranch, branch)) {
        rating = shift(rating, -2);
        tags.push('일지충');
      }
      if (isWonjin(dayBranch, branch)) {
        rating = shift(rating, -1);
        tags.push('원진');
      }
      if (isHyeong(dayBranch, branch)) {
        rating = shift(rating, -1);
        tags.push('형살');
      }
      if (gongmang.includes(branch)) {
        rating = shift(rating, -1);
        tags.push('공망');
      }
    }

    days.push({
      day: d,
      ganji,
      ganjiHangul: toHangul(ganji),
      sipsin: branchDeity ? `${stemDeity}/${branchDeity}` : stemDeity,
      rating,
      note: tags.length > 0 ? tags.slice(0, 3).join('·') : (SIPSIN_KEYWORD[stemDeity] ?? ''),
    });
  }

  return { year, month, jeolip: findJeolip(year, month), days };
}

/** 서울 기준 다음 달 { year, month } */
export function getNextMonthKst(): { year: number; month: number } {
  const { year, month } = getSeoulTodayParts();
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
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
  const subtitle = `${esc(dayPillar)}(${esc(toHangul(dayPillar))}) 일주 기준${esc(jeolipText)} · 사주 코드 ${esc(code)}`;

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
<style>
@page { size: A4 landscape; margin: 10mm 12mm; }
* { box-sizing: border-box; }
body { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; margin: 0; color: #2a2a2a; }
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
<div class="footer-note">등급·해설은 일간 기준 십성과 합충 조견표에 따른 참고 정보입니다. 간지와 사주 코드 외 개인정보는 포함되지 않습니다.</div>
</body></html>`;
}
