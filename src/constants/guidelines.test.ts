/**
 * guidelines 지침 통합 테스트
 *
 * 검증 범위:
 * 1. barrel export — 7개 상수가 모두 정상 export되는지
 * 2. 지침 내용 — 각 파일의 핵심 규칙 문자열이 포함되는지
 * 3. 중복 제거 — BASIC/ADVANCED_REPORT_GUIDELINE에 SECTION 구조가 없는지
 * 4. 프롬프트 조립 — buildConsultingSystemInstruction / buildReportSystemInstruction
 *    호출 시 올바른 지침이 주입되는지
 * 5. 모드 분기 — basic/advanced에 따라 다른 지침이 선택되는지
 */
import { describe, test, expect } from 'vitest';
import {
  SAJU_GUIDELINE,
  CONSULTING_GUIDELINE,
  BASIC_CONSULTING_GUIDELINE,
  ADVANCED_CONSULTING_GUIDELINE,
  CONSULTING_SCENARIO_GUIDELINE,
  REPORT_GUIDELINE,
  BASIC_REPORT_GUIDELINE,
  ADVANCED_REPORT_GUIDELINE,
  REPORT_WRITING_STYLE_GUIDELINE,
} from '../constants/guidelines';
import { buildConsultingSystemInstruction, buildReportSystemInstruction } from '../lib/promptBuilders';
import { assemblePremiumReportPrompt } from '../lib/premiumReportCore';
import type { ReportInputData, ProductType } from '../lib/premiumOrderStore';

// ─── 공통 픽스처 ──────────────────────────────────────────────────────────────
const DUMMY_SAJU_CONTEXT = '일주: 갑(甲) 자(子) - 십성: 비견/겁재';
const DUMMY_DAEUN_CONTEXT = '30세 대운: 을묘 (현재 대운)';
const DUMMY_DAY_PILLAR = {
  dateText: '2026-04-05',
  dayPillarHanja: '甲子',
  dayPillarHangul: '갑자',
};
const DUMMY_YEAR_PILLAR = {
  year: 2026,
  yearPillarHanja: '丙午',
  yearPillarHangul: '병오',
};
const DUMMY_NEARBY_DAY_PILLARS = {
  yesterday:        { dateText: '2026-04-04', dayPillarHanja: '癸亥', dayPillarHangul: '계해' },
  today:            { dateText: '2026-04-05', dayPillarHanja: '甲子', dayPillarHangul: '갑자' },
  tomorrow:         { dateText: '2026-04-06', dayPillarHanja: '乙丑', dayPillarHangul: '을축' },
  dayAfterTomorrow: { dateText: '2026-04-07', dayPillarHanja: '丙寅', dayPillarHangul: '병인' },
};
const DUMMY_NEARBY_YEAR_PILLARS = [
  { year: 2025, yearPillarHanja: '乙巳', yearPillarHangul: '을사' },
  { year: 2026, yearPillarHanja: '丙午', yearPillarHangul: '병오' },
  { year: 2027, yearPillarHanja: '丁未', yearPillarHangul: '정미' },
  { year: 2028, yearPillarHanja: '戊申', yearPillarHangul: '무신' },
  { year: 2029, yearPillarHanja: '己酉', yearPillarHangul: '기유' },
  { year: 2030, yearPillarHanja: '庚戌', yearPillarHangul: '경술' },
  { year: 2031, yearPillarHanja: '辛亥', yearPillarHangul: '신해' },
];

// ─── 1. Barrel Export 검증 ────────────────────────────────────────────────────
describe('guidelines barrel export', () => {
  test('SAJU_GUIDELINE: 비어있지 않음', () => {
    expect(SAJU_GUIDELINE.length).toBeGreaterThan(100);
  });

  test('CONSULTING_GUIDELINE: 비어있지 않음', () => {
    expect(CONSULTING_GUIDELINE.length).toBeGreaterThan(100);
  });

  test('BASIC_CONSULTING_GUIDELINE: 비어있지 않음', () => {
    expect(BASIC_CONSULTING_GUIDELINE.length).toBeGreaterThan(50);
  });

  test('ADVANCED_CONSULTING_GUIDELINE: 비어있지 않음', () => {
    expect(ADVANCED_CONSULTING_GUIDELINE.length).toBeGreaterThan(50);
  });

  test('CONSULTING_SCENARIO_GUIDELINE: 비어있지 않음', () => {
    expect(CONSULTING_SCENARIO_GUIDELINE.length).toBeGreaterThan(50);
  });

  test('REPORT_GUIDELINE: 비어있지 않음', () => {
    expect(REPORT_GUIDELINE.length).toBeGreaterThan(100);
  });

  test('BASIC_REPORT_GUIDELINE: 비어있지 않음', () => {
    expect(BASIC_REPORT_GUIDELINE.length).toBeGreaterThan(50);
  });

  test('ADVANCED_REPORT_GUIDELINE: 비어있지 않음', () => {
    expect(ADVANCED_REPORT_GUIDELINE.length).toBeGreaterThan(50);
  });

  test('REPORT_WRITING_STYLE_GUIDELINE: 비어있지 않음', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE.length).toBeGreaterThan(100);
  });
});

// ─── 2. 지침 핵심 규칙 내용 검증 ──────────────────────────────────────────────
describe('지침 핵심 규칙 내용 검증', () => {
  // SAJU_GUIDELINE
  test('SAJU_GUIDELINE: 감명 프로세스 정의 포함', () => {
    expect(SAJU_GUIDELINE).toContain('음양');
    expect(SAJU_GUIDELINE).toContain('조후');
    expect(SAJU_GUIDELINE).toContain('십성');
  });

  // CONSULTING_GUIDELINE
  test('CONSULTING_GUIDELINE: 컨텍스트 격리 정책 포함', () => {
    expect(CONSULTING_GUIDELINE).toContain('채팅 세션');
  });

  test('CONSULTING_GUIDELINE: 대화 연속성 규칙 포함', () => {
    expect(CONSULTING_GUIDELINE).toContain('누적');
  });

  // BASIC_CONSULTING_GUIDELINE
  test('BASIC_CONSULTING_GUIDELINE: 이모지 금지 규칙 포함', () => {
    expect(BASIC_CONSULTING_GUIDELINE).toContain('이모지');
    expect(BASIC_CONSULTING_GUIDELINE).toContain('절대 사용하지 않는다');
  });

  test('BASIC_CONSULTING_GUIDELINE: 마크다운 금지 규칙 포함', () => {
    expect(BASIC_CONSULTING_GUIDELINE).toContain('마크다운');
  });

  test('BASIC_CONSULTING_GUIDELINE: 응답 포인트 제한 규칙 포함', () => {
    expect(BASIC_CONSULTING_GUIDELINE).toContain('1~2개로 제한');
  });

  // CONSULTING_SCENARIO_GUIDELINE — 시나리오 응답 규칙
  test('CONSULTING_SCENARIO_GUIDELINE: 카드 근거 한정·이모지/마크다운 금지 규칙 포함', () => {
    expect(CONSULTING_SCENARIO_GUIDELINE).toContain('카드');
    expect(CONSULTING_SCENARIO_GUIDELINE).toContain('이모지');
    expect(CONSULTING_SCENARIO_GUIDELINE).toContain('마크다운');
  });

  // ADVANCED_CONSULTING_GUIDELINE
  test('ADVANCED_CONSULTING_GUIDELINE: 한자 병기 필수 규칙 포함', () => {
    expect(ADVANCED_CONSULTING_GUIDELINE).toContain('한자');
    expect(ADVANCED_CONSULTING_GUIDELINE).toContain('병기');
  });

  test('ADVANCED_CONSULTING_GUIDELINE: 핵심→근거→리스크 서술 순서 포함', () => {
    expect(ADVANCED_CONSULTING_GUIDELINE).toContain('핵심');
    expect(ADVANCED_CONSULTING_GUIDELINE).toContain('근거');
    expect(ADVANCED_CONSULTING_GUIDELINE).toContain('리스크');
  });

  // REPORT_GUIDELINE — 구조 정의 포함 여부
  test('REPORT_GUIDELINE: SECTION 1~6 구조 모두 포함', () => {
    expect(REPORT_GUIDELINE).toContain('SECTION 1');
    expect(REPORT_GUIDELINE).toContain('SECTION 2');
    expect(REPORT_GUIDELINE).toContain('SECTION 3');
    expect(REPORT_GUIDELINE).toContain('SECTION 4');
    expect(REPORT_GUIDELINE).toContain('SECTION 5');
    expect(REPORT_GUIDELINE).toContain('SECTION 6');
  });

  test('REPORT_GUIDELINE: 클로징 문구 포함', () => {
    expect(REPORT_GUIDELINE).toContain('관통하는 가장 중요한 조언');
  });

  test('REPORT_GUIDELINE: Role 정의 포함', () => {
    expect(REPORT_GUIDELINE).toContain('30년 경력');
  });

  // BASIC_REPORT_GUIDELINE — 초급자 전용 규칙
  test('BASIC_REPORT_GUIDELINE: 초급 모드 작성 대상 포함', () => {
    expect(BASIC_REPORT_GUIDELINE).toContain('초급 모드');
  });

  test('BASIC_REPORT_GUIDELINE: 비유 사용 규칙 포함', () => {
    expect(BASIC_REPORT_GUIDELINE).toContain('비유 사용');
  });

  // ADVANCED_REPORT_GUIDELINE — 고급자 전용 규칙
  test('ADVANCED_REPORT_GUIDELINE: 고급자 작성 대상 포함', () => {
    expect(ADVANCED_REPORT_GUIDELINE).toContain('고급자');
  });

  test('ADVANCED_REPORT_GUIDELINE: 한자 병기 필수 규칙 포함', () => {
    expect(ADVANCED_REPORT_GUIDELINE).toContain('한자');
    expect(ADVANCED_REPORT_GUIDELINE).toContain('병기');
  });

  test('ADVANCED_REPORT_GUIDELINE: 논증 전개 순서 포함', () => {
    expect(ADVANCED_REPORT_GUIDELINE).toContain('원국 분석');
    expect(ADVANCED_REPORT_GUIDELINE).toContain('결론');
  });

  // REPORT_WRITING_STYLE_GUIDELINE — 유료 리포트 서술 원칙 v3 (OWNER 지시 2026-10-15; v1 2026-08-17, v2 2026-09-09)
  test('REPORT_WRITING_STYLE_GUIDELINE: v3 최우선 3원칙 선언 — 용어 무지 독자·비유 금지·문단 결론 선행', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('【최우선 3원칙');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('사주 용어를 전혀 모르는 사람도 한 번 읽고 이해하게 쓴다');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('비유로 설명하지 않는다');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('모든 문단은 결론 한 문장으로 시작');
  });

  test('REPORT_WRITING_STYLE_GUIDELINE: 원칙 1 — 결론 선행 규칙 포함(섹션 + 문단 단위)', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('결론 먼저');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('결론부터 말씀드리면');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('모든 문단도 첫 문장이 그 문단의 결론');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('섹션 말미에 요약을 반복하지 않는다');
  });

  test('REPORT_WRITING_STYLE_GUIDELINE: 원칙 2 — 비유 금지 + 실생활·스타일 구체화', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('비유를 쓰지 않는다');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('마치 ~처럼');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('실생활과 스타일을 구체적으로');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('행동·습관·선택·말투');
    // 앞선 지침(간명 기본 규칙·report-basic·골든셋)의 "비유 사용" 지시를 명시적으로 무효화해야 한다.
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('"비유를 사용하라"');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('따르지 않는다');
    // v2의 "비유 먼저" 원칙은 폐기되었다.
    expect(REPORT_WRITING_STYLE_GUIDELINE).not.toContain('비유 먼저');
  });

  test('REPORT_WRITING_STYLE_GUIDELINE: 쉬운 어휘 기준 — 한자어 치환표·금지 종결·한 줄 결론 제목·구체성(2026-10-15 참조 사례 반영)', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('【쉬운 어휘 기준');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('월급처럼 따박따박 들어오는 돈');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('"~을 시사합니다"');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('【한 줄 결론 제목');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('[MONTH_START]·[DAEUN_START]·[SEUN_BLOCK] 안의 내용 첫 줄도');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('독자 확인 문장');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('양쪽 제시');
    // 참조 사례의 유행어·한자 병기·단정은 가져오지 않고 합니다체를 유지한다.
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('【참조 사례에서 가져오지 않는 것】');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('합니다체를 유지');
  });

  test('REPORT_WRITING_STYLE_GUIDELINE: 독자 기준 — 사전지식 없는 독자 전제 + 허용 기본어 4개로 축소', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('사주명리를 처음 접하는 사람');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('기본어는 4개뿐');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('원국·일간·음양·용신은 본문에 쓰지 않고 풀이말로만');
  });

  test('REPORT_WRITING_STYLE_GUIDELINE: 원칙 3 — 본문 용어 금지·괄호 해설 금지·번역표 포함', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('괄호 해설을 달아서 쓰는 것도 금지');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('번역표');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('고등학교 선생님');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('조항 번호(§)는 어떤 경우에도 본문에 쓰지 않는다');
  });

  test('REPORT_WRITING_STYLE_GUIDELINE: 최우선 규칙 선언 + 구조 규칙 예외 명시', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('우선한다');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('구조 규칙은 기존 지침을 그대로 따른다');
  });

  test('REPORT_WRITING_STYLE_GUIDELINE: 고급 모드 예외 규정 포함', () => {
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('고급 모드(advanced)');
    expect(REPORT_WRITING_STYLE_GUIDELINE).toContain('한자 병기');
  });
});

// ─── 유료 리포트 4종: 서술 원칙 v3 주입 검증 ────────────────────────────────────
describe('assemblePremiumReportPrompt: 서술 원칙 v3 주입', () => {
  const baseInput: ReportInputData = {
    name: '테스트',
    gender: 'M',
    birthDate: '1990-07-25',
    birthTime: '14:30',
    isLunar: false,
    isLeap: false,
    unknownTime: false,
    concern: '커리어 방향이 고민입니다.',
    interest: '내년 이직 시기',
    reportLevel: 'basic',
    lifeEvents: [],
    adminNotes: '',
    currentJob: '회사원',
    workHistory: '',
    relationshipStatus: '',
  };

  const productTypes: ProductType[] = ['premium', 'yearly2026', 'yearly2027', 'jobCareer', 'loveMarriage'];

  test.each(productTypes)('%s: system 프롬프트에 서술 원칙 v3이 포함됨', (productType) => {
    const { system } = assemblePremiumReportPrompt({ ...baseInput, productType });
    expect(system).toContain('[유료 리포트 공통 서술 원칙 v3 — 최우선 문체 규칙]');
    expect(system).toContain('결론부터 말씀드리면');
  });

  // 연간 운세는 "오늘 연도"가 아니라 상품이 가리키는 연도의 세운·월주로 생성한다
  // (2027 신년운세는 2026년 10월부터 판매 — 생성 시점과 대상 연도가 다름).
  describe('연간 운세 상품 — 대상 연도 고정', () => {
    test('yearly2027: 2027 정미년 세운·월주와 2027 전용 지침이 주입된다', () => {
      const { system, user } = assemblePremiumReportPrompt({ ...baseInput, productType: 'yearly2027' });
      expect(system).toContain('「프리미엄 신년운세 2027」');
      expect(system).toContain('2027 정미년(丁未年)');
      expect(system).not.toContain('「프리미엄 일년운세 2026」');
      expect(user).toContain('[2027 세운]\n2027년 정미(丁未)');
      expect(user).toContain('[2027 월별 간지]');
      expect(user).toContain('1월: 辛丑(신축)');
      expect(user).toContain('2월: 壬寅(임인)');
      expect(user).toContain('12월: 壬子(임자)');
      // 향후 세운 흐름은 대상 연도 기준 전년~5년 후
      expect(user).toContain('2026년: 丙午(병오) (대상 연도로부터 1년 전)');
      expect(user).toContain('2027년: 丁未(정미) (대상 연도)');
      expect(user).toContain('2032년: 壬子(임자) (대상 연도로부터 5년 후)');
    });

    test('yearly2026: 기존과 동일하게 2026 병오년 세운·월주가 주입된다', () => {
      const { system, user } = assemblePremiumReportPrompt({ ...baseInput, productType: 'yearly2026' });
      expect(system).toContain('「프리미엄 일년운세 2026」');
      expect(user).toContain('[2026 세운]\n2026년 병오(丙午)');
      expect(user).toContain('[2026 월별 간지]');
      expect(user).toContain('1월: 己丑(기축)');
      expect(user).toContain('2월: 庚寅(경인)');
    });

    test('대상 연도가 아직 오지 않았으면 "다가오는 해" 시제 규칙을, 대상 연도 안이면 "올해" 시제 규칙을 쓴다', () => {
      const thisYear = Number(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()),
      );
      const { user: u27 } = assemblePremiumReportPrompt({ ...baseInput, productType: 'yearly2027' });
      if (thisYear < 2027) {
        expect(u27).toContain('오늘은 아직');
        expect(u27).toContain('2027년 기준');
        expect(u27).not.toContain('올해는 이미 진행 중입니다');
      } else {
        expect(u27).toContain('올해는 이미 진행 중입니다');
      }
    });
  });

  test('premium(인생네비): 서술 원칙 v3이 골든셋 예시보다 뒤에 배치됨 (충돌 시 우선권 확보)', () => {
    const { system } = assemblePremiumReportPrompt({ ...baseInput, productType: 'premium' });
    const goldenIdx = system.indexOf('[골든셋 모범 예시');
    const styleIdx = system.indexOf('[유료 리포트 공통 서술 원칙 v3');
    expect(goldenIdx).toBeGreaterThan(-1);
    expect(styleIdx).toBeGreaterThan(goldenIdx);
  });

  test('advanced 모드에서도 서술 원칙 v3이 주입됨', () => {
    const { system } = assemblePremiumReportPrompt({
      ...baseInput,
      productType: 'premium',
      reportLevel: 'advanced',
    });
    expect(system).toContain('[유료 리포트 공통 서술 원칙 v3 — 최우선 문체 규칙]');
  });
});

// ─── 3. 중복 제거 검증 ────────────────────────────────────────────────────────
describe('리포트 지침 중복 제거 검증', () => {
  test('BASIC_REPORT_GUIDELINE: SECTION 1~6 구조 미포함 (report-common으로 이전됨)', () => {
    // 모드 파일에는 섹션 내용 설명이 없어야 함 (SECTION n: 형태의 섹션 정의)
    expect(BASIC_REPORT_GUIDELINE).not.toMatch(/^SECTION [1-6]:/m);
  });

  test('ADVANCED_REPORT_GUIDELINE: SECTION 1~6 구조 미포함 (report-common으로 이전됨)', () => {
    expect(ADVANCED_REPORT_GUIDELINE).not.toMatch(/^SECTION [1-6]:/m);
  });

  test('BASIC_REPORT_GUIDELINE: 클로징 문구 미포함 (report-common으로 이전됨)', () => {
    expect(BASIC_REPORT_GUIDELINE).not.toContain('일대일상담');
  });

  test('ADVANCED_REPORT_GUIDELINE: 클로징 문구 미포함 (report-common으로 이전됨)', () => {
    expect(ADVANCED_REPORT_GUIDELINE).not.toContain('일대일상담');
  });

  test('BASIC_REPORT_GUIDELINE: Role 정의 미포함 (report-common으로 이전됨)', () => {
    expect(BASIC_REPORT_GUIDELINE).not.toContain('30년 경력');
  });

  test('ADVANCED_REPORT_GUIDELINE: Role 정의 미포함 (report-common으로 이전됨)', () => {
    expect(ADVANCED_REPORT_GUIDELINE).not.toContain('30년 경력');
  });
});

// ─── 4. 프롬프트 조립 검증 ────────────────────────────────────────────────────
describe('buildConsultingSystemInstruction 프롬프트 조립', () => {
  const baseParams = {
    isFirstMessage: false,
    latestUserMessage: '재물운을 알고 싶어요.',
    userName: '테스트',
    sajuContext: DUMMY_SAJU_CONTEXT,
    daeunContext: DUMMY_DAEUN_CONTEXT,
    todayDayPillar: DUMMY_DAY_PILLAR,
    currentYearPillar: DUMMY_YEAR_PILLAR,
    nearbyDayPillars: DUMMY_NEARBY_DAY_PILLARS,
    nearbyYearPillars: DUMMY_NEARBY_YEAR_PILLARS,
  };

  test('일진 달력(어제/오늘/내일/모레) 값이 프롬프트에 그대로 주입됨', () => {
    const prompt = buildConsultingSystemInstruction({
      ...baseParams,
      mode: 'basic',
      modeSpecificGuideline: `${CONSULTING_GUIDELINE}\n\n${BASIC_CONSULTING_GUIDELINE}`,
    });
    expect(prompt).toContain('계해(癸亥)');
    expect(prompt).toContain('갑자(甲子)');
    expect(prompt).toContain('을축(乙丑)');
    expect(prompt).toContain('병인(丙寅)');
  });

  test('basic 모드: 프롬프트에 CONSULTING_GUIDELINE 내용이 포함됨', () => {
    const modeSpecificGuideline = `${CONSULTING_GUIDELINE}\n\n${BASIC_CONSULTING_GUIDELINE}`;
    const prompt = buildConsultingSystemInstruction({
      ...baseParams,
      mode: 'basic',
      modeSpecificGuideline,
    });
    // CONSULTING_GUIDELINE 핵심 구문
    expect(prompt).toContain('채팅 세션');
  });

  test('basic 모드: 프롬프트에 BASIC_CONSULTING_GUIDELINE 내용이 포함됨', () => {
    const modeSpecificGuideline = `${CONSULTING_GUIDELINE}\n\n${BASIC_CONSULTING_GUIDELINE}`;
    const prompt = buildConsultingSystemInstruction({
      ...baseParams,
      mode: 'basic',
      modeSpecificGuideline,
    });
    // BASIC_CONSULTING_GUIDELINE 핵심 구문
    expect(prompt).toContain('1~2개로 제한');
  });

  test('advanced 모드: 프롬프트에 ADVANCED_CONSULTING_GUIDELINE 내용이 포함됨', () => {
    const modeSpecificGuideline = `${CONSULTING_GUIDELINE}\n\n${ADVANCED_CONSULTING_GUIDELINE}`;
    const prompt = buildConsultingSystemInstruction({
      ...baseParams,
      mode: 'advanced',
      modeSpecificGuideline,
    });
    // ADVANCED_CONSULTING_GUIDELINE 핵심 구문 (한자 병기)
    expect(prompt).toContain('한자');
    expect(prompt).toContain('병기');
  });

  test('basic 모드: 프롬프트에 사주 컨텍스트 데이터가 포함됨', () => {
    const modeSpecificGuideline = `${CONSULTING_GUIDELINE}\n\n${BASIC_CONSULTING_GUIDELINE}`;
    const prompt = buildConsultingSystemInstruction({
      ...baseParams,
      mode: 'basic',
      modeSpecificGuideline,
    });
    expect(prompt).toContain(DUMMY_SAJU_CONTEXT);
    expect(prompt).toContain(DUMMY_DAEUN_CONTEXT);
  });

  test('basic vs advanced: 두 모드의 프롬프트가 서로 다름', () => {
    const basicPrompt = buildConsultingSystemInstruction({
      ...baseParams,
      mode: 'basic',
      modeSpecificGuideline: `${CONSULTING_GUIDELINE}\n\n${BASIC_CONSULTING_GUIDELINE}`,
    });
    const advancedPrompt = buildConsultingSystemInstruction({
      ...baseParams,
      mode: 'advanced',
      modeSpecificGuideline: `${CONSULTING_GUIDELINE}\n\n${ADVANCED_CONSULTING_GUIDELINE}`,
    });
    expect(basicPrompt).not.toBe(advancedPrompt);
  });
});

describe('buildReportSystemInstruction 프롬프트 조립', () => {
  const baseReportParams = {
    currentDateText: '2026년 4월 5일',
    currentYearPillar: DUMMY_YEAR_PILLAR,
    userName: '테스트',
    sajuContext: DUMMY_SAJU_CONTEXT,
    daeunContext: DUMMY_DAEUN_CONTEXT,
    currentAge: 30,
  };

  test('basic 모드: 프롬프트에 REPORT_GUIDELINE(공통) 내용이 포함됨', () => {
    const reportGuideline = `${REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`;
    const prompt = buildReportSystemInstruction({ ...baseReportParams, reportGuideline });
    expect(prompt).toContain('SECTION 1');
    expect(prompt).toContain('SECTION 6');
    expect(prompt).toContain('관통하는 가장 중요한 조언');
  });

  test('basic 모드: 프롬프트에 BASIC_REPORT_GUIDELINE 내용이 포함됨', () => {
    const reportGuideline = `${REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`;
    const prompt = buildReportSystemInstruction({ ...baseReportParams, reportGuideline });
    expect(prompt).toContain('초급 모드');
    expect(prompt).toContain('비유 사용');
  });

  test('advanced 모드: 프롬프트에 REPORT_GUIDELINE(공통) 내용이 포함됨', () => {
    const reportGuideline = `${REPORT_GUIDELINE}\n\n${ADVANCED_REPORT_GUIDELINE}`;
    const prompt = buildReportSystemInstruction({ ...baseReportParams, reportGuideline });
    expect(prompt).toContain('SECTION 1');
    expect(prompt).toContain('SECTION 6');
  });

  test('advanced 모드: 프롬프트에 ADVANCED_REPORT_GUIDELINE 내용이 포함됨', () => {
    const reportGuideline = `${REPORT_GUIDELINE}\n\n${ADVANCED_REPORT_GUIDELINE}`;
    const prompt = buildReportSystemInstruction({ ...baseReportParams, reportGuideline });
    expect(prompt).toContain('고급자');
    expect(prompt).toContain('한자');
  });

  test('basic 모드: 프롬프트에 사용자 이름과 사주 데이터가 포함됨', () => {
    const reportGuideline = `${REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`;
    const prompt = buildReportSystemInstruction({ ...baseReportParams, reportGuideline });
    expect(prompt).toContain('테스트');
    expect(prompt).toContain(DUMMY_SAJU_CONTEXT);
    expect(prompt).toContain(DUMMY_DAEUN_CONTEXT);
  });

  test('Role 정의(30년 경력 명리학 대가)는 REPORT_GUIDELINE에만 존재 — 기본 모드', () => {
    // '30년 경력 명리학 대가'는 report-common의 Role 정의에만 있으므로
    // 조합된 지침 문자열에서 정확히 한 번만 등장해야 함 (BASIC_REPORT_GUIDELINE에 없음)
    const combined = `${REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`;
    const count = (combined.match(/30년 경력 명리학 대가/g) || []).length;
    expect(count).toBe(1);
  });

  test('Role 정의(30년 경력 명리학 대가)는 REPORT_GUIDELINE에만 존재 — 고급 모드', () => {
    const combined = `${REPORT_GUIDELINE}\n\n${ADVANCED_REPORT_GUIDELINE}`;
    const count = (combined.match(/30년 경력 명리학 대가/g) || []).length;
    expect(count).toBe(1);
  });

  test('basic vs advanced: 두 모드의 프롬프트가 서로 다름', () => {
    const basicPrompt = buildReportSystemInstruction({
      ...baseReportParams,
      reportGuideline: `${REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`,
    });
    const advancedPrompt = buildReportSystemInstruction({
      ...baseReportParams,
      reportGuideline: `${REPORT_GUIDELINE}\n\n${ADVANCED_REPORT_GUIDELINE}`,
    });
    expect(basicPrompt).not.toBe(advancedPrompt);
  });
});

// ─── 5. 모드 분기 로직 검증 (useChatSendAction 인라인 재현) ────────────────────
describe('모드 분기: 올바른 지침 선택 여부', () => {
  const selectConsultingGuideline = (mode: 'basic' | 'advanced') => {
    const modeOnlyGuideline = mode === 'basic'
      ? BASIC_CONSULTING_GUIDELINE
      : ADVANCED_CONSULTING_GUIDELINE;
    return `${CONSULTING_GUIDELINE}\n\n${modeOnlyGuideline}`;
  };

  const selectReportGuideline = (mode: 'basic' | 'advanced') => {
    const modeGuideline = mode === 'basic' ? BASIC_REPORT_GUIDELINE : ADVANCED_REPORT_GUIDELINE;
    return `${REPORT_GUIDELINE}\n\n${modeGuideline}`;
  };

  test('상담 basic 모드 → BASIC_CONSULTING_GUIDELINE 포함, ADVANCED 미포함', () => {
    const result = selectConsultingGuideline('basic');
    // BASIC 전용 구문 존재
    expect(result).toContain('1~2개로 제한');
    // ADVANCED 전용 구문 미포함
    expect(result).not.toContain('원국 분석 → 운의 흐름');
  });

  test('상담 advanced 모드 → ADVANCED_CONSULTING_GUIDELINE 포함, BASIC 미포함', () => {
    const result = selectConsultingGuideline('advanced');
    // ADVANCED 전용 구문 존재
    expect(result).toContain('핵심 결론');
    // BASIC 전용 구문 미포함 (3~5문장은 초급자 전용)
    expect(result).not.toContain('3~5문장');
  });

  test('리포트 basic 모드 → BASIC_REPORT_GUIDELINE 포함, ADVANCED 미포함', () => {
    const result = selectReportGuideline('basic');
    expect(result).toContain('비유 사용');
    expect(result).not.toContain('간명(看命)');
  });

  test('리포트 advanced 모드 → ADVANCED_REPORT_GUIDELINE 포함, BASIC 미포함', () => {
    const result = selectReportGuideline('advanced');
    expect(result).toContain('간명(看命)');
    expect(result).not.toContain('고등학교 학생');
  });
});
