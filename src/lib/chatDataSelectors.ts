/**
 * 챗봇 시나리오용 데이터 셀렉터.
 *
 * 만세력 엔진(getSajuData/getDaeunData/calculateYongshin)이 계산한 결정론적 값을
 * "주제별 카드 payload"로 슬라이스한다. 여기서 나온 payload는 React 카드 컴포넌트가
 * 그대로 렌더하며 LLM 출력을 거치지 않는다 — 간지·수치 환각을 원천 차단한다.
 *
 * 테스트 가능성을 위해 모든 함수는 순수 함수다("현재 시각"이 필요한 셀렉터는
 * currentYearPillar/currentAge를 인자로 받고 내부에서 Date를 읽지 않는다).
 */
import { calculateDeity, getSipseung, hanjaToHangul } from '../utils/saju';

export interface PillarView {
  title: string;
  stemHangul: string;
  stemHanja: string;
  branchHangul: string;
  branchHanja: string;
  stemDeity: string;
  branchDeity: string;
  stemElement: string;
  branchElement: string;
}

export interface MyeongsikCardPayload {
  kind: 'myeongsik';
  pillars: PillarView[];
  dayMasterHangul: string;
  dayMasterHanja: string;
  yongshin: string | null;
  strength: string | null;
}

export interface WealthStar {
  label: string; // '정재' | '편재'
  position: string; // 예: '월주 천간(병)'
}

export interface WealthCardPayload {
  kind: 'wealth';
  stars: WealthStar[];
  yongshin: string | null;
  hasJeongjae: boolean;
  hasPyeonjae: boolean;
}

export interface DaeunStep {
  startAge: number;
  ganjiHangul: string;
  ganjiHanja: string;
  stemDeity: string;
  branchDeity: string;
  isCurrent: boolean;
}

export interface DaeunCardPayload {
  kind: 'daeun';
  steps: DaeunStep[];
  currentAge: number;
}

export interface YearlyCardPayload {
  kind: 'yearly';
  year: number;
  ganjiHangul: string;
  ganjiHanja: string;
  stemDeity: string;
  branchDeity: string;
  branchUnseong: string;
}

export type SajuCardPayload =
  | MyeongsikCardPayload
  | WealthCardPayload
  | DaeunCardPayload
  | YearlyCardPayload;

/** getCurrentYearPillarKST()가 반환하는 형태의 부분 집합. */
export interface CurrentYearPillar {
  year: number;
  yearPillarHangul: string;
  yearPillarHanja: string;
}

const WEALTH_DEITIES = ['정재', '편재'];

const findDayPillar = (sajuResult: any[]): any | undefined =>
  sajuResult.find((p) => p?.title === '일주');

/** 명식 카드: 4주 간지 + 일간 + 용신/강약. 오프닝에서 봇이 먼저 보여준다. */
export function buildMyeongsikCard(
  sajuResult: any[],
  yongshinResult: any | null
): MyeongsikCardPayload {
  const dayPillar = findDayPillar(sajuResult);
  const pillars: PillarView[] = sajuResult.map((p) => ({
    title: p.title,
    stemHangul: p.stem?.hangul ?? '',
    stemHanja: p.stem?.hanja ?? '',
    branchHangul: p.branch?.hangul ?? '',
    branchHanja: p.branch?.hanja ?? '',
    stemDeity: p.stem?.deity ?? '',
    branchDeity: p.branch?.deity ?? '',
    stemElement: p.stem?.element ?? '',
    branchElement: p.branch?.element ?? '',
  }));

  return {
    kind: 'myeongsik',
    pillars,
    dayMasterHangul: dayPillar?.stem?.hangul ?? '',
    dayMasterHanja: dayPillar?.stem?.hanja ?? '',
    yongshin: yongshinResult?.yongshin ?? null,
    strength: yongshinResult?.strength ?? null,
  };
}

/** 재물 카드: 천간·지지에 드러난 재성(정재·편재) 위치 + 용신. */
export function buildWealthCard(
  sajuResult: any[],
  yongshinResult: any | null
): WealthCardPayload {
  const stars: WealthStar[] = [];
  for (const p of sajuResult) {
    if (WEALTH_DEITIES.includes(p.stem?.deity)) {
      stars.push({ label: p.stem.deity, position: `${p.title} 천간(${p.stem.hangul})` });
    }
    if (WEALTH_DEITIES.includes(p.branch?.deity)) {
      stars.push({ label: p.branch.deity, position: `${p.title} 지지(${p.branch.hangul})` });
    }
  }

  return {
    kind: 'wealth',
    stars,
    yongshin: yongshinResult?.yongshin ?? null,
    hasJeongjae: stars.some((s) => s.label === '정재'),
    hasPyeonjae: stars.some((s) => s.label === '편재'),
  };
}

/** 대운 카드: 대운 타임라인 + 현재 대운 표시. */
export function buildDaeunCard(
  daeunResult: any[],
  dayMasterHanja: string,
  currentAge: number
): DaeunCardPayload {
  const steps: DaeunStep[] = daeunResult.map((d, i) => {
    const isCurrent =
      currentAge >= d.startAge &&
      (i === daeunResult.length - 1 || currentAge < daeunResult[i + 1].startAge);
    return {
      startAge: d.startAge,
      ganjiHangul: `${hanjaToHangul[d.stem] || d.stem}${hanjaToHangul[d.branch] || d.branch}`,
      ganjiHanja: `${d.stem}${d.branch}`,
      stemDeity: dayMasterHanja ? calculateDeity(dayMasterHanja, d.stem) ?? '' : '',
      branchDeity: dayMasterHanja ? calculateDeity(dayMasterHanja, d.branch, true) ?? '' : '',
      isCurrent,
    };
  });

  return { kind: 'daeun', steps, currentAge };
}

/** 올해 세운 카드: 당해 간지 + 천간십성/지지십성/지지운성. */
export function buildYearlyCard(
  dayMasterHanja: string,
  currentYearPillar: CurrentYearPillar
): YearlyCardPayload {
  const stem = currentYearPillar.yearPillarHanja.charAt(0);
  const branch = currentYearPillar.yearPillarHanja.charAt(1);
  return {
    kind: 'yearly',
    year: currentYearPillar.year,
    ganjiHangul: currentYearPillar.yearPillarHangul,
    ganjiHanja: currentYearPillar.yearPillarHanja,
    stemDeity: dayMasterHanja ? calculateDeity(dayMasterHanja, stem) ?? '' : '',
    branchDeity: dayMasterHanja ? calculateDeity(dayMasterHanja, branch, true) ?? '' : '',
    branchUnseong: dayMasterHanja ? getSipseung(dayMasterHanja, branch) : '',
  };
}

/**
 * 카드를 LLM에 전달할 요약 문자열로 직렬화한다.
 * 모델이 "사용자가 이미 본 카드"를 인지하고 같은 수치를 되풀이하지 않도록,
 * 그리고 카드에 없는 값을 지어내지 않도록 근거 데이터를 명시한다.
 */
export function summarizeCard(card: SajuCardPayload): string {
  switch (card.kind) {
    case 'myeongsik': {
      const pillars = card.pillars
        .map((p) => `${p.title} ${p.stemHangul}${p.branchHangul}(${p.stemHanja}${p.branchHanja})`)
        .join(', ');
      return `[명식 카드] ${pillars} | 일간: ${card.dayMasterHangul}(${card.dayMasterHanja})${
        card.yongshin ? ` | 용신: ${card.yongshin}` : ''
      }${card.strength ? ` | 강약: ${card.strength}` : ''}`;
    }
    case 'wealth': {
      const stars = card.stars.length
        ? card.stars.map((s) => `${s.label}=${s.position}`).join(', ')
        : '천간·지지에 드러난 재성 없음(지장간 잠복 가능)';
      return `[재물 구조 카드] 재성: ${stars}${card.yongshin ? ` | 용신: ${card.yongshin}` : ''}`;
    }
    case 'daeun': {
      const steps = card.steps
        .map(
          (s) =>
            `${s.startAge}세 ${s.ganjiHangul}(${s.stemDeity}/${s.branchDeity})${
              s.isCurrent ? '←현재' : ''
            }`
        )
        .join(', ');
      return `[대운 흐름 카드] ${steps}`;
    }
    case 'yearly':
      return `[올해 세운 카드] ${card.year} ${card.ganjiHangul}(${card.ganjiHanja}) | 천간십성: ${card.stemDeity} | 지지십성: ${card.branchDeity} | 지지운성: ${card.branchUnseong}`;
    default:
      return '';
  }
}
