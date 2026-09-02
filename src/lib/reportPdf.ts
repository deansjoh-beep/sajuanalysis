import { calculateDeity, elementMap, yinYangMap } from '../utils/saju';
import { getGanZhiInfo } from '../utils/sajuAlgorithm';
import { PDF_SERIF_FONT_LINKS, PDF_SERIF_STACK } from './pdfFonts';
import type { MyeongsikParams } from './buildMyeongsik';
import type { ReportSection } from './premiumOrderStore';

/**
 * 리포트 PDF HTML 빌더 (CodeLookupTab에서 분리).
 * 표지: 명식(간지)·십성·십이운성·오행 분포·웰컴 문구·발행일·코드.
 * 생년월일 원문은 표기하지 않는다 (2-4 원칙 — 간지·코드까지만).
 */

// ─── 리포트 본문 구조 마커 제거 ─────────────────────────────────────────────

const MARKER_PATTERNS: RegExp[] = [
  /\[\s*\/?\s*(?:SECTION|TITLE|SUMMARY|CONTENT|END)\s*\]/gi,
  /\[\s*\/?\s*DAEUN_(?:START|CONTENT|END)\s*\]/gi,
  /\[\s*DAEUN_TRANSITION\s*\]/gi,
  /\[\s*\/?\s*FIELD_[^\]]*\]/gi,
  /\[\s*\/?\s*ACTION_PLAN\s*\]/gi,
  /\[\s*\/?\s*EASY_(?:START|END)\s*\]/gi,
  /\[\s*\/?\s*MONTH_(?:START|CONTENT|END)\s*\]/gi,
  /\[\s*SEUN_BLOCK\s*\]/gi,
  /\[\s*\/?\s*SUB(?:\s+[^\]]*)?\s*\]/gi,
];

export function stripMarkers(input: string): string {
  let out = input;
  for (const p of MARKER_PATTERNS) out = out.replace(p, '\n');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── 표지용 명식 요약 ───────────────────────────────────────────────────────

const ELEMENT_KO: Record<string, string> = {
  wood: '목', fire: '화', earth: '토', metal: '금', water: '수',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 파일명에 못 쓰는 문자를 제거한다(Windows 금지 문자 + 경로 구분자). */
const sanitizeForFileName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '').trim();

const formatDateKo = (d: Date) =>
  `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

const formatDateFile = (d: Date) => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
};

/** 일주 간지 → '병술일주' 같은 한글 호칭 (파일명·표지 공용). */
export function iljuLabel(myeongsik: MyeongsikParams | null): string | null {
  const day = myeongsik?.pillars.day;
  if (!day || day.length < 2) return null;
  const stem = getGanZhiInfo(day.charAt(0));
  const branch = getGanZhiInfo(day.charAt(1));
  if (stem.kor === stem.hanja || branch.kor === branch.hanja) return null;
  return `${stem.kor}${branch.kor}일주`;
}

/**
 * 저장 파일명: 사주리포트_{이름 또는 일주}_{조회날짜}.
 * 이름은 로그인 회원의 표시 이름(있을 때만) — 브라우저 안에서만 쓰이고 서버로는 보내지 않는다.
 */
export function buildReportPdfFileName(
  memberName: string | null | undefined,
  myeongsik: MyeongsikParams | null,
  code: string,
  issuedAt: Date = new Date(),
): string {
  const owner = (memberName && sanitizeForFileName(memberName)) || iljuLabel(myeongsik) || code;
  return `사주리포트_${owner}_${formatDateFile(issuedAt)}.pdf`;
}

interface PillarCell {
  label: string;
  stemDeity: string;
  stemHanja: string;
  branchHanja: string;
  branchDeity: string;
}

/**
 * 시→년 순(전통 표기)으로 표지 명식 카드 셀을 만든다.
 * 시간 미상이면 시주 카드는 만들지 않는다 (ManseTab과 동일한 규칙).
 */
function buildPillarCells(myeongsik: MyeongsikParams): PillarCell[] {
  const dayStem = myeongsik.pillars.day.charAt(0);
  const order: Array<{ label: string; ganzhi: string | null; isDay: boolean }> = [
    { label: '시주', ganzhi: myeongsik.pillars.hour, isDay: false },
    { label: '일주', ganzhi: myeongsik.pillars.day, isDay: true },
    { label: '월주', ganzhi: myeongsik.pillars.month, isDay: false },
    { label: '년주', ganzhi: myeongsik.pillars.year, isDay: false },
  ];
  return order
    .filter(({ ganzhi }) => Boolean(ganzhi && ganzhi.length >= 2))
    .map(({ label, ganzhi, isDay }) => {
      const stem = (ganzhi as string).charAt(0);
      const branch = (ganzhi as string).charAt(1);
      return {
        label,
        stemDeity: isDay ? '일간' : calculateDeity(dayStem, stem),
        stemHanja: stem,
        branchHanja: branch,
        branchDeity: calculateDeity(dayStem, branch, true),
      };
    });
}

/**
 * 한자 박스 인라인 스타일 — src/components/manse/HanjaBox.tsx의 색 규칙과 동일하게 유지할 것.
 * 양간지 = 외곽선+글자색, 음간지 = 채움+밝은 글자. 금(金)은 양=미색/음=모래색 특수 처리.
 */
const HANJA_BOX_COLORS: Record<string, string> = {
  wood: '#047857', fire: '#b8392e', earth: '#a88a4a', water: '#1a1a1a',
};

function hanjaBoxStyle(ch: string): string {
  const element = elementMap[ch];
  const isYang = yinYangMap[ch] === '+';
  if (!element) return 'border: 2px solid rgba(156,142,126,.4); color: #3a3530; opacity: .4;';
  if (element === 'metal') {
    return isYang
      ? 'background: #fdfaf2; border: 1px solid rgba(156,142,126,.4); color: #6b5d4f;'
      : 'background: #ebe1c8; border: 1px solid rgba(156,142,126,.4); color: #3a3530;';
  }
  const color = HANJA_BOX_COLORS[element];
  return isYang
    ? `border: 2px solid ${color}; color: ${color};`
    : `background: ${color}; border: 2px solid ${color}; color: #fdfaf2;`;
}

/** 명식에 실제로 있는 글자(6~8자)의 오행 분포. */
function buildElementCounts(myeongsik: MyeongsikParams): Array<{ name: string; count: number }> {
  const counts: Record<string, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const chars = [
    myeongsik.pillars.year,
    myeongsik.pillars.month,
    myeongsik.pillars.day,
    myeongsik.pillars.hour ?? '',
  ].join('');
  for (const ch of chars) {
    const el = elementMap[ch];
    if (el) counts[el] += 1;
  }
  return (['wood', 'fire', 'earth', 'metal', 'water'] as const).map((el) => ({
    name: ELEMENT_KO[el],
    count: counts[el],
  }));
}

// ─── PDF HTML ───────────────────────────────────────────────────────────────

export function buildReportPdfHtml(opts: {
  code: string;
  productLabel: string;
  myeongsik: MyeongsikParams | null;
  sections: ReportSection[];
  issuedAt?: Date;
}): string {
  const { code, productLabel, myeongsik, sections } = opts;
  const issuedAt = opts.issuedAt ?? new Date();

  const body = sections
    .map(
      (s) => `
      <section>
        <h2>${esc(s.title)}</h2>
        ${s.summary ? `<p class="summary">${esc(stripMarkers(s.summary))}</p>` : ''}
        ${stripMarkers(s.content)
          .split(/\n{2,}/)
          .map((p) => `<p>${esc(p).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}</p>`)
          .join('')}
      </section>`,
    )
    .join('');

  // 표지 명식 블록 — 명식이 없는 코드(선물 미등록 등 예외 경로)면 통째로 생략한다.
  let manseBlock = '';
  if (myeongsik) {
    const cells = buildPillarCells(myeongsik);
    const dayStem = myeongsik.pillars.day.charAt(0);
    const dayStemKor = getGanZhiInfo(dayStem).kor;
    const dayElement = ELEMENT_KO[elementMap[dayStem]] ?? '';
    const elements = buildElementCounts(myeongsik);
    const gwageon = myeongsik.gender === 'male' ? '건명(乾命)' : '곤명(坤命)';
    const daeunDir = myeongsik.daeunDirection === 'forward' ? '순행' : '역행';

    manseBlock = `
    <div class="manse">
      ${cells
        .map(
          (c) => `
      <div class="pillar-card">
        <p class="pillar-label">${esc(c.label)}</p>
        <p class="pillar-deity">${esc(c.stemDeity) || '&nbsp;'}</p>
        <div class="hanja-box" style="${hanjaBoxStyle(c.stemHanja)}">${esc(c.stemHanja)}</div>
        <div class="hanja-box" style="${hanjaBoxStyle(c.branchHanja)}">${esc(c.branchHanja)}</div>
        <p class="pillar-deity">${esc(c.branchDeity) || '&nbsp;'}</p>
      </div>`,
        )
        .join('')}
    </div>
    <div class="keyinfo">
      <p>일간 ${esc(dayStem)}(${esc(dayStemKor)}·${esc(dayElement)}) · ${gwageon} · 대운수 ${myeongsik.daeunsu} ${daeunDir}${myeongsik.timeUnknown ? ' · 시간 미상' : ''}</p>
      <p>오행 분포 &nbsp;${elements.map((e) => `${esc(e.name)} ${e.count}`).join(' · ')}</p>
    </div>`;
  }

  // 폰트 링크는 반드시 실어 보낸다 — 서버리스 Chromium에는 한글 시스템 폰트가 없다(pdfFonts.ts 참고).
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
${PDF_SERIF_FONT_LINKS}
<style>
  @page { size: A4 portrait; margin: 18mm 16mm; }
  body { font-family: ${PDF_SERIF_STACK}; color: #1f2430; font-size: 11pt; line-height: 1.75; word-break: keep-all; }
  .cover { text-align: center; padding-top: 56px; page-break-after: always; }
  .cover h1 { font-size: 26pt; margin: 0 0 6px; }
  .cover .issued { font-size: 10pt; color: #6b6f7c; margin-bottom: 36px; }
  .cover .welcome { max-width: 430px; margin: 0 auto 36px; font-size: 11pt; color: #3a3f4d; }
  .manse { display: flex; justify-content: center; gap: 12px; margin: 0 auto 16px; }
  .pillar-card { width: 108px; padding: 14px 0 10px; border: 1px solid #e2ddd0; border-radius: 16px; background: #fffdf8; }
  .pillar-label { font-size: 9pt; font-weight: bold; color: #8a857a; margin: 0 0 2px; }
  .pillar-deity { font-size: 10pt; font-weight: bold; color: #3a3530; margin: 0 0 8px; }
  .pillar-card .hanja-box + .pillar-deity { margin: 8px 0 0; }
  .hanja-box { width: 52px; height: 52px; margin: 0 auto 12px; border-radius: 12px; font-size: 19pt; font-weight: bold; line-height: 52px; text-align: center; }
  .hanja-box + .hanja-box { margin-bottom: 0; }
  .keyinfo { font-size: 10.5pt; color: #3a3f4d; margin-bottom: 44px; }
  .keyinfo p { margin: 2px 0; }
  .cover .code { font-size: 10pt; color: #6b6f7c; }
  .cover .code strong { font-size: 12pt; letter-spacing: 2px; color: #1f2430; }
  section { page-break-inside: avoid; margin-bottom: 28px; }
  h2 { font-size: 14pt; border-bottom: 1px solid #c9c4b4; padding-bottom: 6px; }
  .summary { font-weight: bold; }
</style></head><body>
  <div class="cover">
    <h1>${esc(productLabel)}</h1>
    <p class="issued">발행일 ${formatDateKo(issuedAt)}</p>
    <p class="welcome">고객님, 안녕하세요. 소중한 시간을 내어 이 리포트를 받아주셔서 감사합니다.<br/>
    이 리포트는 고객님의 명식이 품은 타고난 기질과 앞으로의 흐름을 차례로 짚어드립니다.</p>
    ${manseBlock}
    <p class="code">사주 코드 <strong>${esc(code)}</strong><br/>코드를 입력하면 언제든 리포트를 다시 열람할 수 있습니다.</p>
  </div>
  ${body}
</body></html>`;
}
