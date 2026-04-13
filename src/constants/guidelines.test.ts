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
  REPORT_GUIDELINE,
  BASIC_REPORT_GUIDELINE,
  ADVANCED_REPORT_GUIDELINE,
} from '../constants/guidelines';
import { buildConsultingSystemInstruction, buildReportSystemInstruction } from '../lib/promptBuilders';

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

  test('REPORT_GUIDELINE: 비어있지 않음', () => {
    expect(REPORT_GUIDELINE.length).toBeGreaterThan(100);
  });

  test('BASIC_REPORT_GUIDELINE: 비어있지 않음', () => {
    expect(BASIC_REPORT_GUIDELINE.length).toBeGreaterThan(50);
  });

  test('ADVANCED_REPORT_GUIDELINE: 비어있지 않음', () => {
    expect(ADVANCED_REPORT_GUIDELINE.length).toBeGreaterThan(50);
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

  test('BASIC_CONSULTING_GUIDELINE: 3~5문장 응답 길이 규칙 포함', () => {
    expect(BASIC_CONSULTING_GUIDELINE).toContain('3~5문장');
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
    expect(REPORT_GUIDELINE).toContain('일대일상담');
  });

  test('REPORT_GUIDELINE: Role 정의 포함', () => {
    expect(REPORT_GUIDELINE).toContain('30년 경력');
  });

  // BASIC_REPORT_GUIDELINE — 초급자 전용 규칙
  test('BASIC_REPORT_GUIDELINE: 초급자 작성 대상 포함', () => {
    expect(BASIC_REPORT_GUIDELINE).toContain('초급자');
  });

  test('BASIC_REPORT_GUIDELINE: 괄호 해설 규칙 포함', () => {
    expect(BASIC_REPORT_GUIDELINE).toContain('괄호');
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
    sajuContext: DUMMY_SAJU_CONTEXT,
    daeunContext: DUMMY_DAEUN_CONTEXT,
    todayDayPillar: DUMMY_DAY_PILLAR,
    currentYearPillar: DUMMY_YEAR_PILLAR,
  };

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
    expect(prompt).toContain('3~5문장');
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
    expect(prompt).toContain('일대일상담');
  });

  test('basic 모드: 프롬프트에 BASIC_REPORT_GUIDELINE 내용이 포함됨', () => {
    const reportGuideline = `${REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`;
    const prompt = buildReportSystemInstruction({ ...baseReportParams, reportGuideline });
    expect(prompt).toContain('초급자');
    expect(prompt).toContain('괄호');
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

  test('SECTION 섹션 정의(The Blueprint of Life)는 REPORT_GUIDELINE에만 존재 — 기본 모드', () => {
    // "The Blueprint of Life"는 SECTION 1 정의에만 포함된 고유 문구이므로
    // 조합된 지침 문자열에서 정확히 한 번만 등장해야 함 (BASIC_REPORT_GUIDELINE에 없음)
    const combined = `${REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`;
    const count = (combined.match(/The Blueprint of Life/g) || []).length;
    expect(count).toBe(1);
  });

  test('SECTION 섹션 정의(The Blueprint of Life)는 REPORT_GUIDELINE에만 존재 — 고급 모드', () => {
    const combined = `${REPORT_GUIDELINE}\n\n${ADVANCED_REPORT_GUIDELINE}`;
    const count = (combined.match(/The Blueprint of Life/g) || []).length;
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
    expect(result).toContain('3~5문장');
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
    expect(result).toContain('고등학교 학생');
    expect(result).not.toContain('간명(看命)');
  });

  test('리포트 advanced 모드 → ADVANCED_REPORT_GUIDELINE 포함, BASIC 미포함', () => {
    const result = selectReportGuideline('advanced');
    expect(result).toContain('간명(看命)');
    expect(result).not.toContain('고등학교 학생');
  });
});
