/**
 * 챗봇 시나리오용 데이터 셀렉터.
 *
 * 만세력 엔진(getSajuData/getDaeunData/calculateYongshin/calculateGyeok)이 계산한
 * 결정론적 값을 "주제별 카드 payload"로 슬라이스한다. 여기서 나온 payload는 React
 * 카드 컴포넌트가 그대로 렌더하며 LLM 출력을 거치지 않는다 — 간지·수치 환각을
 * 원천 차단한다.
 *
 * 테스트 가능성을 위해 모든 함수는 순수 함수다("현재 시각"이 필요한 셀렉터는
 * 기준 간지/나이를 인자로 받고 내부에서 Date를 읽지 않는다).
 *
 * ⚠️ sajuResult(Pillar 배열)는 title로 접근한다(인덱스 순서에 의존하지 않음).
 */
import { calculateDeity, getSipseung, getShinsal, getHongyeom, hanjaToHangul } from '../utils/saju';

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

/** 특정 십성이 실린 자리(천간/지지)의 위치 표기. */
export interface DeityPlacement {
  label: string;
  position: string;
}

export interface MyeongsikCardPayload {
  kind: 'myeongsik';
  pillars: PillarView[];
  dayMasterHangul: string;
  dayMasterHanja: string;
  yongshin: string | null;
  strength: string | null;
}

export interface WealthCardPayload {
  kind: 'wealth';
  stars: DeityPlacement[]; // 정재·편재 위치
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

/** 세운/월운/일진 공용 기간 카드(간지 + 천간십성/지지십성/지지운성). */
export interface PeriodCardPayload {
  kind: 'period';
  periodLabel: string;
  ganjiHangul: string;
  ganjiHanja: string;
  stemDeity: string;
  branchDeity: string;
  branchUnseong: string;
}

export interface CareerCardPayload {
  kind: 'career';
  gyeok: string | null;
  composition: string | null;
  officers: DeityPlacement[]; // 관성(정관·편관)
  seals: DeityPlacement[]; // 인성(정인·편인)
}

export interface LoveCardPayload {
  kind: 'love';
  spousePalaceHangul: string; // 일지(배우자궁)
  spousePalaceHanja: string;
  hiddenStems: string; // 일지 지장간
  spouseDeity: string; // 일지 십성
  romanceStars: DeityPlacement[]; // 도화·홍염 위치
}

export interface ElementCount {
  label: string; // 목(木) 등
  count: number;
}

export interface HealthCardPayload {
  kind: 'health';
  elements: ElementCount[];
  lacking: string[]; // 개수 0인 오행 라벨
  johooStatus: string | null;
  johooYongshin: string | null;
}

export interface RelationsCardPayload {
  kind: 'relations';
  peers: DeityPlacement[]; // 비겁(비견·겁재) — 형제·동료·경쟁
  authorities: DeityPlacement[]; // 관성(정관·편관) — 윗사람·조직
  supporters: DeityPlacement[]; // 인성(정인·편인) — 조력자
}

export type SajuCardPayload =
  | MyeongsikCardPayload
  | WealthCardPayload
  | DaeunCardPayload
  | PeriodCardPayload
  | CareerCardPayload
  | LoveCardPayload
  | HealthCardPayload
  | RelationsCardPayload;

/** getCurrentYearPillarKST()가 반환하는 형태의 부분 집합. */
export interface CurrentYearPillar {
  year: number;
  yearPillarHangul: string;
  yearPillarHanja: string;
}

const ELEMENT_LABELS: Record<string, string> = {
  wood: '목(木)',
  fire: '화(火)',
  earth: '토(土)',
  metal: '금(金)',
  water: '수(水)',
};
const ELEMENT_ORDER = ['wood', 'fire', 'earth', 'metal', 'water'];

const findPillar = (sajuResult: any[], title: string): any | undefined =>
  sajuResult.find((p) => p?.title === title);

/** 지정한 십성이 천간/지지에 실린 자리를 모두 수집한다. */
const scanPlacements = (sajuResult: any[], deities: string[]): DeityPlacement[] => {
  const out: DeityPlacement[] = [];
  for (const p of sajuResult) {
    if (deities.includes(p.stem?.deity)) {
      out.push({ label: p.stem.deity, position: `${p.title} 천간(${p.stem.hangul})` });
    }
    if (deities.includes(p.branch?.deity)) {
      out.push({ label: p.branch.deity, position: `${p.title} 지지(${p.branch.hangul})` });
    }
  }
  return out;
};

/** 명식 카드: 4주 간지 + 일간 + 용신/강약. 오프닝에서 봇이 먼저 보여준다. */
export function buildMyeongsikCard(
  sajuResult: any[],
  yongshinResult: any | null
): MyeongsikCardPayload {
  const dayPillar = findPillar(sajuResult, '일주');
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
  const stars = scanPlacements(sajuResult, ['정재', '편재']);
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

/** 기간 카드(세운/월운/일진 공용): 간지 + 천간십성/지지십성/지지운성. */
export function buildPeriodCard(
  dayMasterHanja: string,
  pillarHanja: string,
  pillarHangul: string,
  periodLabel: string
): PeriodCardPayload {
  const stem = pillarHanja.charAt(0);
  const branch = pillarHanja.charAt(1);
  return {
    kind: 'period',
    periodLabel,
    ganjiHangul: pillarHangul,
    ganjiHanja: pillarHanja,
    stemDeity: dayMasterHanja ? calculateDeity(dayMasterHanja, stem) ?? '' : '',
    branchDeity: dayMasterHanja ? calculateDeity(dayMasterHanja, branch, true) ?? '' : '',
    branchUnseong: dayMasterHanja ? getSipseung(dayMasterHanja, branch) : '',
  };
}

/** 세운 카드(기간 카드의 올해 세운 프리셋). */
export function buildYearlyCard(
  dayMasterHanja: string,
  currentYearPillar: CurrentYearPillar
): PeriodCardPayload {
  return buildPeriodCard(
    dayMasterHanja,
    currentYearPillar.yearPillarHanja,
    currentYearPillar.yearPillarHangul,
    `${currentYearPillar.year}년 세운`
  );
}

/** 직업 카드: 격국 + 십성 분포 + 관성(정관·편관)·인성(정인·편인) 위치. */
export function buildCareerCard(
  sajuResult: any[],
  gyeokResult: any | null
): CareerCardPayload {
  return {
    kind: 'career',
    gyeok: gyeokResult?.gyeok ?? null,
    composition: gyeokResult?.composition ?? null,
    officers: scanPlacements(sajuResult, ['정관', '편관']),
    seals: scanPlacements(sajuResult, ['정인', '편인']),
  };
}

/** 연애·결혼 카드: 배우자궁(일지) + 지장간 + 도화·홍염 신살. */
export function buildLoveCard(sajuResult: any[], dayMasterHanja: string): LoveCardPayload {
  const dayPillar = findPillar(sajuResult, '일주');
  const yearPillar = findPillar(sajuResult, '년주');
  const yearBranch = yearPillar?.branch?.hanja ?? '';
  const hongyeomBranch = dayMasterHanja ? getHongyeom(dayMasterHanja) : '';

  const romanceStars: DeityPlacement[] = [];
  for (const p of sajuResult) {
    const branchHanja = p.branch?.hanja;
    if (!branchHanja || branchHanja === '?') continue;
    if (yearBranch && getShinsal(yearBranch, branchHanja) === '도화') {
      romanceStars.push({ label: '도화', position: `${p.title} 지지(${p.branch.hangul})` });
    }
    if (hongyeomBranch && branchHanja === hongyeomBranch) {
      romanceStars.push({ label: '홍염', position: `${p.title} 지지(${p.branch.hangul})` });
    }
  }

  return {
    kind: 'love',
    spousePalaceHangul: dayPillar?.branch?.hangul ?? '',
    spousePalaceHanja: dayPillar?.branch?.hanja ?? '',
    hiddenStems: dayPillar?.branch?.hidden ?? '',
    spouseDeity: dayPillar?.branch?.deity ?? '',
    romanceStars,
  };
}

/** 건강 카드: 오행 분포 + 부족한 오행 + 조후. */
export function buildHealthCard(
  sajuResult: any[],
  yongshinResult: any | null
): HealthCardPayload {
  const counts: Record<string, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of sajuResult) {
    const se = p.stem?.element;
    const be = p.branch?.element;
    if (se && counts[se] !== undefined) counts[se] += 1;
    if (be && counts[be] !== undefined) counts[be] += 1;
  }
  const elements: ElementCount[] = ELEMENT_ORDER.map((k) => ({
    label: ELEMENT_LABELS[k],
    count: counts[k],
  }));
  const lacking = elements.filter((e) => e.count === 0).map((e) => e.label);

  return {
    kind: 'health',
    elements,
    lacking,
    johooStatus: yongshinResult?.johooStatus ?? null,
    johooYongshin: yongshinResult?.johooYongshin ?? null,
  };
}

/** 대인관계 카드: 비겁(형제·동료)·관성(윗사람)·인성(조력자) 위치. */
export function buildRelationsCard(sajuResult: any[]): RelationsCardPayload {
  return {
    kind: 'relations',
    peers: scanPlacements(sajuResult, ['비견', '겁재']),
    authorities: scanPlacements(sajuResult, ['정관', '편관']),
    supporters: scanPlacements(sajuResult, ['정인', '편인']),
  };
}

const placementsText = (label: string, list: DeityPlacement[]): string =>
  `${label}: ${list.length ? list.map((s) => `${s.label}=${s.position}`).join(', ') : '없음'}`;

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
    case 'period':
      return `[${card.periodLabel} 카드] ${card.ganjiHangul}(${card.ganjiHanja}) | 천간십성: ${card.stemDeity} | 지지십성: ${card.branchDeity} | 지지운성: ${card.branchUnseong}`;
    case 'career':
      return `[직업 구조 카드] 격국: ${card.gyeok ?? '미상'} | 십성분포: ${card.composition ?? '미상'} | ${placementsText('관성', card.officers)} | ${placementsText('인성', card.seals)}`;
    case 'love': {
      const stars = card.romanceStars.length
        ? card.romanceStars.map((s) => `${s.label}=${s.position}`).join(', ')
        : '도화·홍염 없음';
      return `[연애·결혼 카드] 배우자궁(일지): ${card.spousePalaceHangul}(${card.spousePalaceHanja}) 십성 ${card.spouseDeity || '미상'} | 지장간: ${card.hiddenStems || '없음'} | 신살: ${stars}`;
    }
    case 'health': {
      const dist = card.elements.map((e) => `${e.label} ${e.count}`).join(', ');
      return `[건강 카드] 오행분포: ${dist}${card.lacking.length ? ` | 부족: ${card.lacking.join(', ')}` : ''} | 조후: ${card.johooStatus ?? '미상'}(용신 ${card.johooYongshin ?? '미상'})`;
    }
    case 'relations':
      return `[대인관계 카드] ${placementsText('비겁', card.peers)} | ${placementsText('관성', card.authorities)} | ${placementsText('인성', card.supporters)}`;
    default:
      return '';
  }
}
