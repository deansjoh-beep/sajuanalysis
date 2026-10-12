/**
 * 프리미엄 리포트 코어 — 프롬프트 조립 + 품질 평가 (Phase 1-4)
 *
 * generatePremiumReport.ts에서 브라우저 의존(jspdf·html2canvas·firebase) 없는 부분을
 * 무변경 추출한 모듈이다. 두 소비처가 공유한다:
 *   1. generateLifeNavReport (관리자 프리미엄 리포트, 브라우저)
 *   2. scripts/report-bench.ts (테스트 하네스, Node — IMPLEMENTATION_PLAN 1-4)
 *
 * 프롬프트 컨텍스트는 SajuAnalysis 단일 소스에서 파생한다(Phase 1-3 어댑터).
 * 반환하는 system 문자열에는 SAJU_GUIDELINE이 이미 포함돼 있다.
 */

import {
  SAJU_GUIDELINE,
  BASIC_REPORT_GUIDELINE,
  ADVANCED_REPORT_GUIDELINE,
  YEARLY_FORTUNE_2026_GUIDELINE,
  YEARLY_FORTUNE_2027_GUIDELINE,
  JOB_CAREER_GUIDELINE,
  LOVE_MARRIAGE_GUIDELINE,
  GOLDEN_LIFENAV_EXAMPLE,
  REPORT_WRITING_STYLE_GUIDELINE,
} from '../constants/guidelines';
import { getCurrentYearPillarKST, getMonthPillarsForYear, getYearPillarsForRange } from './seoulDateGanji';
import {
  buildLifeNavReportPrompt,
  buildYearlyFortunePrompt,
  buildJobCareerPrompt,
  buildLoveMarriagePrompt,
} from './promptBuilders';
import { getYearlyFortuneTargetYear, isYearlyFortuneProduct } from './yearlyFortuneProducts';
import { buildSajuAnalysis, type SajuAnalysis } from './analysis/schema';
import { sajuAnalysisToPromptContext } from './analysis/promptContext';
import type { ReportInputData, ReportSection, DaeunBlock, LifeEvent, ProductType } from './premiumOrderStore';

// ─────────────────────────────────────────────────────────────────────────────
// 필수 섹션 정의
// ─────────────────────────────────────────────────────────────────────────────

const LIFE_NAV_REQUIRED_SECTION_IDS = [
  'cover',
  'fourpillars',
  'yongshin',
  'profile',
  'daeun',
  'hapchung',
  'sinsal',
  'fortune',
  'fields',
  'concern',
  'admin',
  'glossary',
] as const;

const YEARLY_FORTUNE_REQUIRED_SECTION_IDS = [
  'cover',
  'chart',
  'answer',
  'yearly',
  'monthly',
  'checklist',
  'glossary',
] as const;

const JOB_CAREER_REQUIRED_SECTION_IDS = [
  'cover',
  'chart',
  'answer',
  'foundation',
  'sipseng',
  'ohaeng',
  'timing',
  'action',
  'glossary',
] as const;

const LOVE_MARRIAGE_REQUIRED_SECTION_IDS = [
  'cover',
  'chart',
  'answer',
  'foundation',
  'love',
  'marriage',
  'partner',
  'action',
  'glossary',
] as const;

const stripCodeFence = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// 섹션 파싱
// ─────────────────────────────────────────────────────────────────────────────

/** [DAEUN_START]...[DAEUN_END] 블록 파싱 */
const parseDaeunBlocks = (content: string, lifeEvents: LifeEvent[]): DaeunBlock[] => {
  const blocks: DaeunBlock[] = [];
  const regex = /\[DAEUN_START\]\s*(.*?)\s*\[DAEUN_CONTENT\]([\s\S]*?)\[DAEUN_END\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    const label = m[1].trim();
    const blockContent = m[2].trim();
    // e.g. "甲子운 (5~14세)"
    const ageMatch = label.match(/\((\d+)~(\d+)세\)/);
    const startAge = ageMatch ? parseInt(ageMatch[1]) : 0;
    const endAge = ageMatch ? parseInt(ageMatch[2]) : startAge + 9;

    // 이 대운 기간 내의 인생 이벤트 매핑 — 블록 본문에 해당 연도 언급이 있으면 연결
    const relatedEvents = lifeEvents.filter(e => blockContent.includes(String(e.year)));

    blocks.push({ label, startAge, endAge, content: blockContent, lifeEvents: relatedEvents });
  }
  return blocks;
};

/** 섹션 마커 파싱: [SECTION] id [TITLE] ... [SUMMARY] ... [CONTENT] ... [END] */
export const parseLifeNavSections = (
  raw: string,
  lifeEvents: LifeEvent[]
): ReportSection[] => {
  const sections: ReportSection[] = [];
  const regex = /\[SECTION\]\s*(\S+)\s*\[TITLE\]\s*([\s\S]*?)\s*\[SUMMARY\]\s*([\s\S]*?)\s*\[CONTENT\]\s*([\s\S]*?)\s*\[END\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    const id = m[1].trim();
    const title = m[2].trim();
    const summary = m[3].trim();
    const content = m[4].trim();
    const daeunBlocks = id === 'daeun' ? parseDaeunBlocks(content, lifeEvents) : undefined;
    sections.push({ id, title, summary, content, daeunBlocks });
  }
  return sections;
};

// ─────────────────────────────────────────────────────────────────────────────
// 품질 평가 (상품별)
// ─────────────────────────────────────────────────────────────────────────────

export type PremiumReportQuality = {
  score: number;
  issues: string[];
  normalizedText: string;
  sections: ReportSection[];
};

const evaluateLifeNavReportQuality = (
  rawText: string,
  lifeEvents: LifeEvent[],
  expectedDaeunCount: number
): PremiumReportQuality => {
  const normalizedText = stripCodeFence(rawText);
  const sections = parseLifeNavSections(normalizedText, lifeEvents);
  const issues: string[] = [];

  if (sections.length === 0) {
    issues.push('섹션 마커 파싱 실패');
  }

  const ids = new Set(sections.map((s) => s.id));
  LIFE_NAV_REQUIRED_SECTION_IDS.forEach((id) => {
    if (!ids.has(id)) {
      issues.push(`필수 섹션 누락: ${id}`);
    }
  });

  sections.forEach((section) => {
    if (section.id === 'cover') return;
    const contentLen = section.content.replace(/\s+/g, '').length;
    if (contentLen < 120) {
      issues.push(`본문이 너무 짧음: ${section.id}`);
    }
  });

  const daeunSection = sections.find((s) => s.id === 'daeun');
  const actualDaeunBlocks = daeunSection?.daeunBlocks?.length ?? 0;
  const expectedMinDaeunBlocks = Math.max(8, Math.min(12, expectedDaeunCount));
  if (actualDaeunBlocks < expectedMinDaeunBlocks) {
    issues.push(`대운 블록 부족: ${actualDaeunBlocks}/${expectedMinDaeunBlocks}`);
  }

  const score = Math.max(0, 100 - (issues.length * 12));
  return { score, issues, normalizedText, sections };
};

const evaluateYearlyFortuneQuality = (rawText: string): PremiumReportQuality => {
  const normalizedText = stripCodeFence(rawText);
  const sections = parseLifeNavSections(normalizedText, []);
  const issues: string[] = [];

  if (sections.length === 0) issues.push('섹션 마커 파싱 실패');

  const ids = new Set(sections.map((s) => s.id));
  YEARLY_FORTUNE_REQUIRED_SECTION_IDS.forEach((id) => {
    if (!ids.has(id)) issues.push(`필수 섹션 누락: ${id}`);
  });

  sections.forEach((section) => {
    if (section.id === 'cover') return;
    const contentLen = section.content.replace(/\s+/g, '').length;
    if (section.id === 'answer' && contentLen < 1200) {
      issues.push(`Part I(answer) 분량 부족: ${contentLen}자 (2,000자 권장)`);
    } else if (section.id === 'monthly' && contentLen < 2000) {
      issues.push(`Part III(monthly) 분량 부족: ${contentLen}자`);
    } else if (contentLen < 120) {
      issues.push(`본문이 너무 짧음: ${section.id}`);
    }
  });

  // 월별 블록 개수 확인 (최소 10개)
  const monthlySection = sections.find((s) => s.id === 'monthly');
  if (monthlySection) {
    const monthBlockCount = (monthlySection.content.match(/\[MONTH_START\]/g) || []).length;
    if (monthBlockCount < 10) {
      issues.push(`월별 블록 부족: ${monthBlockCount}/12`);
    }
  }

  const score = Math.max(0, 100 - issues.length * 12);
  return { score, issues, normalizedText, sections };
};

const evaluateJobCareerQuality = (rawText: string): PremiumReportQuality => {
  const normalizedText = stripCodeFence(rawText);
  const sections = parseLifeNavSections(normalizedText, []);
  const issues: string[] = [];

  if (sections.length === 0) issues.push('섹션 마커 파싱 실패');

  const ids = new Set(sections.map((s) => s.id));
  JOB_CAREER_REQUIRED_SECTION_IDS.forEach((id) => {
    if (!ids.has(id)) issues.push(`필수 섹션 누락: ${id}`);
  });

  sections.forEach((section) => {
    if (section.id === 'cover') return;
    const contentLen = section.content.replace(/\s+/g, '').length;
    if (section.id === 'answer' && contentLen < 800) {
      issues.push(`answer 섹션 분량 부족: ${contentLen}자 (1,200자 권장)`);
    } else if (section.id === 'timing') {
      const seunBlockCount = (section.content.match(/\[SEUN_BLOCK\]/g) || []).length;
      if (seunBlockCount < 3) issues.push(`SEUN_BLOCK 부족: ${seunBlockCount}/3`);
      if (contentLen < 600) issues.push(`timing 섹션 분량 부족: ${contentLen}자`);
    } else if (section.id === 'action') {
      if (!section.content.includes('[ACTION_PLAN]')) issues.push('ACTION_PLAN 마커 누락');
    } else if (contentLen < 120) {
      issues.push(`본문이 너무 짧음: ${section.id}`);
    }
  });

  const score = Math.max(0, 100 - issues.length * 12);
  return { score, issues, normalizedText, sections };
};

const evaluateLoveMarriageQuality = (rawText: string): PremiumReportQuality => {
  const normalizedText = stripCodeFence(rawText);
  const sections = parseLifeNavSections(normalizedText, []);
  const issues: string[] = [];

  if (sections.length === 0) issues.push('섹션 마커 파싱 실패');

  const ids = new Set(sections.map((s) => s.id));
  LOVE_MARRIAGE_REQUIRED_SECTION_IDS.forEach((id) => {
    if (!ids.has(id)) issues.push(`필수 섹션 누락: ${id}`);
  });

  sections.forEach((section) => {
    if (section.id === 'cover') return;
    const contentLen = section.content.replace(/\s+/g, '').length;
    if (section.id === 'answer' && contentLen < 800) {
      issues.push(`answer 섹션 분량 부족: ${contentLen}자 (1,200자 권장)`);
    } else if (section.id === 'love') {
      const seunBlockCount = (section.content.match(/\[SEUN_BLOCK\]/g) || []).length;
      if (seunBlockCount < 3) issues.push(`love SEUN_BLOCK 부족: ${seunBlockCount}/3`);
      if (contentLen < 700) issues.push(`love 섹션 분량 부족: ${contentLen}자`);
    } else if (section.id === 'marriage') {
      if (contentLen < 700) issues.push(`marriage 섹션 분량 부족: ${contentLen}자`);
    } else if (section.id === 'action') {
      if (!section.content.includes('[ACTION_PLAN]')) issues.push('ACTION_PLAN 마커 누락');
    } else if (contentLen < 120) {
      issues.push(`본문이 너무 짧음: ${section.id}`);
    }
  });

  const score = Math.max(0, 100 - issues.length * 12);
  return { score, issues, normalizedText, sections };
};

// ─────────────────────────────────────────────────────────────────────────────
// 금칙어(단정 표현) 검사 — OWNER 지시(2026-07-05)
// "사망·이혼·파산 등 단정적 표현 금지"를 v1 규칙으로 넣고, 추후 아래 배열에 추가한다.
// 위반은 품질 이슈로 계상되어(건당 -12점) 80점 미만이면 보정 재생성이 발동한다.
// ─────────────────────────────────────────────────────────────────────────────

export type ForbiddenRule = { label: string; pattern: RegExp };

/** 등장 자체를 금지하는 표현(운세 리포트에 부적절한 수명 단정어). ※ 추가는 여기에. */
const FORBIDDEN_TERMS: ReadonlyArray<ForbiddenRule> = [
  { label: '수명 단정어(요절·단명·비명횡사)', pattern: /요절|단명|비명횡사/ },
];

/** 민감 주제어 — 아래 단정 어미와 한 문장 내(30자)에서 결합하면 위반. ※ 추가는 여기에. */
const SENSITIVE_TOPICS: ReadonlyArray<string> = [
  '사망', '죽음', '죽게', '이혼', '파경', '사별', '파산', '부도',
];

/** 단정 어미 패턴 — "~할 수 있으니 조심" 같은 경향·주의 서술은 허용, 확정 서술만 잡는다. */
const ASSERTIVE_ENDINGS =
  '(합니다|하게\\s*됩니다|하게\\s*될\\s*것|할\\s*것입니다|이\\s*확실|은\\s*확실|을\\s*피할\\s*수\\s*없|은\\s*피할\\s*수\\s*없|하고\\s*맙니다|예정입니다|운명입니다|정해져\\s*있)';

const FORBIDDEN_ASSERTIONS: ReadonlyArray<ForbiddenRule> = SENSITIVE_TOPICS.map((topic) => ({
  label: `${topic} 단정 표현`,
  pattern: new RegExp(`${topic}[^.!?\\n]{0,30}${ASSERTIVE_ENDINGS}`),
}));

/** 리포트 본문에서 금칙(단정) 표현 위반 라벨 목록을 반환한다. 없으면 빈 배열. */
export const checkForbiddenExpressions = (text: string): string[] => {
  const violations: string[] = [];
  for (const rule of [...FORBIDDEN_TERMS, ...FORBIDDEN_ASSERTIONS]) {
    if (rule.pattern.test(text)) violations.push(rule.label);
  }
  return violations;
};

// ─────────────────────────────────────────────────────────────────────────────
// 사주 용어 밀도 검사 — OWNER 지시(2026-09-09) "고등학교 선생님이 학생에게 설명하는 수준"
// 서술 원칙 v2(report-writing-style.ts)의 "본문 금지" 용어가 본문(표지·용어사전 제외)
// 1,000자당 상한을 넘으면 품질 이슈로 계상한다(-12점). 초급 모드에만 적용 — 고급 모드는
// 전문 용어 사용이 지침이므로 검사하지 않는다. 이슈 문구는 보정 재생성 프롬프트에 그대로
// 실리므로, 상위 용어를 함께 적어 모델이 어디를 고칠지 알게 한다.
// 실측 기준(2026-09-09, 저장 리포트 2건 본문): 인생네비(고급 모드) 12.1회, 일년운세 7.8회.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 본문 금지 전문 용어. 두 글자 이상만 — 해·사·충·병 같은 한 글자는 일반어와 겹쳐 제외.
 * 일반어와 겹치는 것(성격(性格)·인성(人性)·지지(支持)·관대·목욕·망신·장성)도 제외하고
 * '상관'은 "상관없다"를 빼기 위해 패턴으로 처리한다. ※ 추가는 여기에.
 */
export const JARGON_TERMS: ReadonlyArray<string> = [
  // 십성·묶음
  '비견', '겁재', '식신', '편재', '정재', '편관', '정관', '편인', '정인',
  '비겁', '식상', '재성', '관성', '관살', '칠살',
  // 희기신·강약·격국·판정 과정
  '희신', '기신', '구신', '한신', '신강', '신약', '격국', '득령', '득지', '득세',
  '투출', '통근', '설기', '합거', '회국', '취격', '억부', '조후', '통관',
  // 십이운성
  '십이운성', '장생', '건록', '제왕',
  // 신살
  '십이신살', '신살', '겁살', '재살', '천살', '지살', '월살', '망신살', '장성살', '반안살', '반안',
  '역마살', '역마', '육해살', '화개살', '화개', '도화살', '도화', '홍염살', '홍염',
  '천을귀인', '괴강', '양인', '백호', '귀문', '원진',
  // 구조·위치
  '공망', '지장간', '천간', '월지', '일지', '년지', '시지',
];

const JARGON_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  ...JARGON_TERMS.map((t) => ({ label: t, pattern: new RegExp(t, 'g') })),
  { label: '상관', pattern: /상관(?!없)/g },
];

export type JargonDensity = {
  /** 공백 제거 본문 글자 수(표지·용어사전 제외) */
  bodyChars: number;
  hits: number;
  per1000: number;
  /** 상위 용어 [용어, 횟수] */
  top: Array<[string, number]>;
};

/** 본문(cover·glossary 제외)의 전문 용어 밀도. 섹션 파싱이 안 된 원문은 전체를 본문으로 본다. */
export const measureJargonDensity = (sections: ReportSection[], fallbackText: string): JargonDensity => {
  const body = sections.length > 0
    ? sections.filter((s) => s.id !== 'cover' && s.id !== 'glossary').map((s) => s.content).join('\n')
    : fallbackText;
  const bodyChars = body.replace(/\s+/g, '').length;
  const counts: Array<[string, number]> = [];
  for (const rule of JARGON_PATTERNS) {
    const n = (body.match(rule.pattern) || []).length;
    if (n > 0) counts.push([rule.label, n]);
  }
  counts.sort((a, b) => b[1] - a[1]);
  const hits = counts.reduce((sum, [, n]) => sum + n, 0);
  const per1000 = bodyChars > 0 ? (hits / bodyChars) * 1000 : 0;
  return { bodyChars, hits, per1000, top: counts.slice(0, 8) };
};

/** 본문 1,000자당 상한. 서술 원칙 v2의 자체 점검 기준(3회)보다 여유를 둔 기계 검사 기준. */
export const JARGON_DENSITY_LIMIT_PER_1000 = 5;
/** 짧은 본문의 우연한 초과를 막는 최소 등장 횟수. */
const JARGON_MIN_HITS = 12;

/** 밀도 상한 초과 시 이슈 문구(보정 프롬프트용), 아니면 null. */
export const checkJargonDensity = (sections: ReportSection[], fallbackText: string): string | null => {
  const d = measureJargonDensity(sections, fallbackText);
  if (d.hits < JARGON_MIN_HITS || d.per1000 <= JARGON_DENSITY_LIMIT_PER_1000) return null;
  const top = d.top.map(([t, n]) => `${t}×${n}`).join(', ');
  return `사주 용어 과다: 본문 1,000자당 ${d.per1000.toFixed(1)}회 (상한 ${JARGON_DENSITY_LIMIT_PER_1000}) — ${top} → 서술 원칙의 번역표대로 생활 언어로 고쳐 쓸 것`;
};

/**
 * 상품 유형별 품질 평가 디스패처(+ 금칙어 검사 + 용어 밀도 검사). 미지정/premium은 인생네비 기준.
 * opts.reportLevel이 'advanced'|'both'면 용어 밀도 검사를 생략한다(고급 모드는 전문 용어가 지침).
 */
export const evaluatePremiumReportQuality = (
  productType: ProductType | undefined,
  rawText: string,
  lifeEvents: LifeEvent[],
  expectedDaeunCount: number,
  opts?: { reportLevel?: ReportInputData['reportLevel'] },
): PremiumReportQuality => {
  const quality =
    productType === 'loveMarriage' ? evaluateLoveMarriageQuality(rawText)
    : productType === 'jobCareer' ? evaluateJobCareerQuality(rawText)
    : isYearlyFortuneProduct(productType) ? evaluateYearlyFortuneQuality(rawText)
    : evaluateLifeNavReportQuality(rawText, lifeEvents, expectedDaeunCount);

  const violations = checkForbiddenExpressions(quality.normalizedText);
  if (violations.length > 0) {
    quality.issues.push(...violations.map((v) => `금칙어(단정 표현) 위반: ${v} — 경향·주의 서술로 완화 필요`));
    quality.score = Math.max(0, quality.score - violations.length * 12);
  }

  if (opts?.reportLevel !== 'advanced' && opts?.reportLevel !== 'both') {
    const jargonIssue = checkJargonDensity(quality.sections, quality.normalizedText);
    if (jargonIssue) {
      quality.issues.push(jargonIssue);
      quality.score = Math.max(0, quality.score - 12);
    }
  }
  return quality;
};

// ─────────────────────────────────────────────────────────────────────────────
// 프롬프트 조립
// ─────────────────────────────────────────────────────────────────────────────

export type PremiumReportPromptBundle = {
  /** 시스템 프롬프트 — SAJU_GUIDELINE 포함 완성본. */
  system: string;
  user: string;
  analysis: SajuAnalysis;
};

/**
 * 입력 → SajuAnalysis(단일 소스) → 상품별 system/user 프롬프트 조립.
 * opts.yongshinEngine: 'v1.5'(기본 — 자평 표준 규칙 엔진 + 기준서 §조항 주입) | 'v1'(레거시 provisional, 회귀 비교용).
 * 기본값은 sajuAnalysisToPromptContext에서 'v1.5'로 확정됨(2026-07-07 OWNER 병합, A/B 벤치 30건 근거 — 플랜 3-1).
 * opts 미지정 시 v1.5가 적용된다.
 */
export const assemblePremiumReportPrompt = (
  inputData: ReportInputData,
  opts?: { yongshinEngine?: 'v1' | 'v1.5' },
): PremiumReportPromptBundle => {
  // 1. 사주 계산 — 프롬프트 컨텍스트는 SajuAnalysis(구조화 결정론 JSON) 단일 소스에서 파생.
  const analysis = buildSajuAnalysis({
    dateStr: inputData.birthDate,
    timeStr: inputData.birthTime,
    isLunar: inputData.isLunar,
    isLeap: inputData.isLeap,
    gender: inputData.gender,
    unknownTime: inputData.unknownTime,
  });

  const currentYearPillar = getCurrentYearPillarKST();

  // 2. 컨텍스트 문자열 생성 (어댑터 — diff 하네스: src/lib/analysis/promptContext.test.ts)
  const { sajuContext, daeunContext, yongshinContext, hapchungContext, shinsalContext, sipseungContext } =
    sajuAnalysisToPromptContext(analysis, opts);

  const lifeEventsText = inputData.lifeEvents.length > 0
    ? inputData.lifeEvents.map(e => `${e.year}년: ${e.description}`).join('\n')
    : '없음';

  // 현재 나이 계산
  const birthYear = parseInt(inputData.birthDate.split('-')[0]);
  const currentAge = currentYearPillar.year - birthYear;

  // 오늘 날짜 (서울 기준) — AI가 "올해" 기준연도를 정확히 인식하도록 명시
  const seoulNow = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const todayY = seoulNow.find(p => p.type === 'year')?.value ?? String(currentYearPillar.year);
  const todayM = seoulNow.find(p => p.type === 'month')?.value ?? '01';
  const todayD = seoulNow.find(p => p.type === 'day')?.value ?? '01';
  const todayDateText = `${todayY}년 ${parseInt(todayM)}월 ${parseInt(todayD)}일`;

  // 연간 운세는 "오늘 연도"가 아니라 상품이 가리키는 연도(2026 일년운세 → 2026, 2027 신년운세 → 2027)로 생성한다.
  const yearlyTargetYear = getYearlyFortuneTargetYear(inputData.productType);
  const isYearlyFortune = yearlyTargetYear !== null;
  const isJobCareer = inputData.productType === 'jobCareer';
  const isLoveMarriage = inputData.productType === 'loveMarriage';

  let system: string;
  let user: string;

  if (isLoveMarriage) {
    // 연애·결혼운 가이드북: 2026~2028 세운 고정 블록 주입
    const seun3YText = [
      '2026년: 병오(丙午) — 천간 丙(양화), 지지 午(화)',
      '2027년: 정미(丁未) — 천간 丁(음화), 지지 未(토)',
      '2028년: 무신(戊申) — 천간 戊(양토), 지지 申(금)',
    ].join('\n');

    const built = buildLoveMarriagePrompt({
      userName: inputData.name,
      gender: inputData.gender,
      birthDate: inputData.birthDate,
      birthTime: inputData.birthTime,
      isLunar: inputData.isLunar,
      isLeap: inputData.isLeap,
      unknownTime: inputData.unknownTime,
      sajuContext: `${sajuContext}\n\n[합충형파해]\n${hapchungContext}\n\n[십이신살]\n${shinsalContext}\n\n[십이운성]\n${sipseungContext}`,
      daeunContext,
      yongshinContext,
      currentAge,
      currentYearText: `${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}(${currentYearPillar.yearPillarHanja})`,
      todayDateText,
      seun3YText,
      relationshipStatus: inputData.relationshipStatus || '',
      loveConcern: inputData.concern || '',
      desiredDirection: inputData.interest || '',
      loveMarriageGuideline: LOVE_MARRIAGE_GUIDELINE,
    });
    system = built.system;
    user = built.user;
  } else if (isJobCareer) {
    // 직업운 리포트: 2026~2028 세운 고정 블록 주입
    const seun3YText = [
      '2026년: 병오(丙午) — 천간 丙(양화), 지지 午(화)',
      '2027년: 정미(丁未) — 천간 丁(음화), 지지 未(토)',
      '2028년: 무신(戊申) — 천간 戊(양토), 지지 申(금)',
    ].join('\n');

    const built = buildJobCareerPrompt({
      userName: inputData.name,
      gender: inputData.gender,
      birthDate: inputData.birthDate,
      birthTime: inputData.birthTime,
      isLunar: inputData.isLunar,
      isLeap: inputData.isLeap,
      unknownTime: inputData.unknownTime,
      sajuContext: `${sajuContext}\n\n[합충형파해]\n${hapchungContext}\n\n[십이신살]\n${shinsalContext}\n\n[십이운성]\n${sipseungContext}`,
      daeunContext,
      yongshinContext,
      currentAge,
      currentYearText: `${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}(${currentYearPillar.yearPillarHanja})`,
      todayDateText,
      seun3YText,
      currentJob: inputData.currentJob || '',
      careerConcern: inputData.concern || '',
      careerGoal: inputData.interest || '',
      workHistory: inputData.workHistory || '',
      jobCareerGuideline: JOB_CAREER_GUIDELINE,
    });
    system = built.system;
    user = built.user;
  } else if (isYearlyFortune) {
    const targetYear = yearlyTargetYear;
    // 대상 연도 세운 — 6월 1일 기준으로 계산해 입춘 전후 경계 문제를 피한다(getYearPillarsForRange 규약).
    const [targetPillar] = getYearPillarsForRange(targetYear, targetYear);
    const targetYearText = `${targetPillar.year}년 ${targetPillar.yearPillarHangul}(${targetPillar.yearPillarHanja})`;

    // 대상 연도 월별 간지 텍스트 (양력 1~12월, 각 달 15일 기준)
    const monthPillars = getMonthPillarsForYear(targetYear);
    const monthPillarsText = monthPillars
      .map((p) => `${p.month}월: ${p.monthPillarHanja}(${p.monthPillarHangul})`)
      .join('\n');

    // 향후 세운 흐름 — 대상 연도 기준 전년 1년 + 대상 연도 + 미래 5년 = 총 7년치 (2년·3년 후 질문 대응)
    const seunStart = targetYear - 1;
    const seunEnd = targetYear + 5;
    const yearPillars = getYearPillarsForRange(seunStart, seunEnd);
    const seunRangeText = yearPillars
      .map((p) => {
        const relLabel =
          p.year === targetYear
            ? ' (대상 연도)'
            : p.year > targetYear
              ? ` (대상 연도로부터 ${p.year - targetYear}년 후)`
              : ` (대상 연도로부터 ${targetYear - p.year}년 전)`;
        const nowLabel = p.year === currentYearPillar.year ? ' · 올해' : '';
        return `${p.year}년: ${p.yearPillarHanja}(${p.yearPillarHangul})${relLabel}${nowLabel}`;
      })
      .join('\n');

    const productTitle = targetYear === 2026 ? '프리미엄 일년운세 2026' : `프리미엄 신년운세 ${targetYear}`;
    const yearlyFortuneGuideline = targetYear === 2027 ? YEARLY_FORTUNE_2027_GUIDELINE : YEARLY_FORTUNE_2026_GUIDELINE;

    const built = buildYearlyFortunePrompt({
      userName: inputData.name,
      gender: inputData.gender,
      birthDate: inputData.birthDate,
      birthTime: inputData.birthTime,
      isLunar: inputData.isLunar,
      isLeap: inputData.isLeap,
      unknownTime: inputData.unknownTime,
      sajuContext: `${sajuContext}\n\n[합충형파해]\n${hapchungContext}\n\n[십이신살]\n${shinsalContext}\n\n[십이운성]\n${sipseungContext}`,
      daeunContext,
      yongshinContext,
      currentAge,
      ageInTargetYear: targetYear - birthYear,
      targetYear,
      targetYearText,
      currentYearText: `${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}(${currentYearPillar.yearPillarHanja})`,
      todayDateText,
      monthPillarsText,
      seunRangeText,
      currentJob: inputData.currentJob || '',
      concern: inputData.concern,
      interest: inputData.interest,
      productTitle,
      yearlyFortuneGuideline,
    });
    system = built.system;
    user = built.user;
  } else {
    const levelGuideline = inputData.reportLevel === 'advanced'
      ? ADVANCED_REPORT_GUIDELINE
      : inputData.reportLevel === 'both'
        ? `${ADVANCED_REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`
        : BASIC_REPORT_GUIDELINE;

    const built = buildLifeNavReportPrompt({
      userName: inputData.name,
      gender: inputData.gender,
      birthDate: inputData.birthDate,
      birthTime: inputData.birthTime,
      isLunar: inputData.isLunar,
      isLeap: inputData.isLeap,
      unknownTime: inputData.unknownTime,
      reportLevel: inputData.reportLevel,
      sajuContext: `${sajuContext}\n\n[합충형파해]\n${hapchungContext}\n\n[십이신살]\n${shinsalContext}\n\n[십이운성]\n${sipseungContext}`,
      daeunContext,
      yongshinContext,
      currentAge,
      currentYearText: `${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}(${currentYearPillar.yearPillarHanja})`,
      todayDateText,
      lifeEventsText,
      concern: inputData.concern,
      interest: inputData.interest,
      adminNotes: inputData.adminNotes,
      levelGuideline,
    });
    system = built.system;
    user = built.user;

    // 골든셋 few-shot 주입 (D-2-4, OWNER 위임 선정 2026-07-05) — 인생네비 전용.
    // 형식·톤·깊이의 기준 예시일 뿐, 간지·해석은 실제 고객 데이터에서만 도출하도록 명시한다.
    system += [
      '',
      '',
      '[골든셋 모범 예시 — 구성·분량·깊이 기준]',
      '아래는 섹션 구성·분량·깊이·비유의 밀도를 보여주는 예시다. 구성과 깊이는 이 예시에 맞춰라.',
      '단, 예시의 문체와 용어 사용은 옛 기준이므로 따르지 마라. 예시에 나오는 십성 이름·신강/신약·희신/기신·살 이름·십이운성 이름은',
      '말미 [유료 리포트 공통 서술 원칙]의 번역표대로 생활 언어로 바꿔 써야 한다.',
      '또한 간지·오행·십성·대운 등 모든 해석 내용은 예시가 아니라 위에 제공된 이번 고객의 사주 데이터에서만 도출하고,',
      '고객 이름은 반드시 이번 고객의 실제 이름을 사용하라. 예시 속 ○○○ 명식·해석을 절대 복사하지 마라.',
      '',
      '<모범예시>',
      GOLDEN_LIFENAV_EXAMPLE.trim(),
      '</모범예시>',
    ].join('\n');
  }

  // 서술 원칙 v2(OWNER 지시 2026-09-09, v1은 2026-08-17)는 유료 4종 공통. 상품별 지침·골든셋
  // 예시·데이터 블록 라벨과 문체 규정이 충돌할 때 이 원칙이 이기도록 system 말미에 배치한다.
  return { system: `${SAJU_GUIDELINE}\n\n${system}\n\n${REPORT_WRITING_STYLE_GUIDELINE}`, user, analysis };
};
