import { describe, it, expect } from 'vitest';
import { selectCoreHook, extractHookFeatures, formatHookPct } from './hookEngine';
import { buildReportSystemInstruction } from './promptBuilders';
import { getSajuData, calculateYongshin, calculateDeity, hanjaToHangul, elementMap } from '../utils/saju';

/** getSajuData 반환 형태와 동일한 pillar 객체를 수제작하는 헬퍼 */
const P = (title: string, stem: string, branch: string, dayStem: string, isDay = false) => ({
  title,
  stem: {
    hanja: stem,
    hangul: hanjaToHangul[stem],
    element: elementMap[stem],
    deity: isDay ? '일간' : calculateDeity(dayStem, stem),
  },
  branch: {
    hanja: branch,
    hangul: hanjaToHangul[branch],
    element: elementMap[branch],
    deity: calculateDeity(dayStem, branch, true),
    hidden: '',
  },
});

/** [시, 일, 월, 년] 순서(getSajuData 역순 반환과 동일) */
const makeSaju = (year: [string, string], month: [string, string], day: [string, string], hour: [string, string]) => {
  const dayStem = day[0];
  return [
    P('시주', hour[0], hour[1], dayStem),
    P('일주', day[0], day[1], dayStem, true),
    P('월주', month[0], month[1], dayStem),
    P('년주', year[0], year[1], dayStem),
  ];
};

const MASKED_HOUR = {
  title: '시주',
  stem: { hanja: '?', hangul: '?', element: '', deity: '' },
  branch: { hanja: '?', hangul: '?', element: '', deity: '', hidden: '' },
};

describe('hookEngine — selectCoreHook', () => {
  it('같은 입력에 대해 항상 같은 훅을 반환한다 (결정론)', () => {
    const sajuResult = getSajuData('1990-05-15', '10:00', false, false);
    const yongshinResult = calculateYongshin(sajuResult);
    const input = { sajuResult, yongshinResult, currentAge: 36 };
    const a = selectCoreHook(input);
    const b = selectCoreHook(input);
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
  });

  it('훅은 항상 유효한 회수 섹션(1~6)과 근거·본문 안내를 가진다', () => {
    const dates: Array<[string, string]> = [
      ['1985-01-03', '02:00'],
      ['1990-05-15', '10:00'],
      ['1996-11-28', '18:00'],
      ['2001-08-07', '22:00'],
    ];
    for (const [d, t] of dates) {
      const sajuResult = getSajuData(d, t, false, false);
      const hook = selectCoreHook({ sajuResult, yongshinResult: calculateYongshin(sajuResult) });
      expect(hook).not.toBeNull();
      expect(hook!.sectionIndex).toBeGreaterThanOrEqual(1);
      expect(hook!.sectionIndex).toBeLessThanOrEqual(6);
      expect(hook!.headline.length).toBeGreaterThan(0);
      expect(hook!.advice.length).toBeGreaterThan(0);
      expect(hook!.evidence.length).toBeGreaterThan(0);
      // 회수 안내: detail이 해당 섹션 라벨을 언급해야 한다
      expect(hook!.detail).toContain(hook!.sectionLabel);
      expect(hook!.score).toBeGreaterThan(0);
    }
  });

  it('시간 미상 사주도 훅을 반환하며 6글자 기준으로 판정한다', () => {
    const sajuResult = getSajuData('1990-05-15', '10:00', false, false, true);
    const features = extractHookFeatures(sajuResult);
    expect(features).not.toBeNull();
    expect(features!.hasHour).toBe(false);
    const hook = selectCoreHook({ sajuResult });
    expect(hook).not.toBeNull();
  });

  it('괴강 일주 + 양인 중첩은 희소성형 훅으로 선정된다', () => {
    // 일주 庚辰(괴강), 년지 酉(庚의 양인)
    const sajuResult = makeSaju(['辛', '酉'], ['丙', '寅'], ['庚', '辰'], ['丁', '丑']);
    const hook = selectCoreHook({ sajuResult });
    expect(hook).not.toBeNull();
    expect(hook!.type).toBe('rarity');
    expect(hook!.evidence).toContain('괴강');
    expect(hook!.evidence).toContain('양인');
    expect(hook!.sectionIndex).toBe(1);
    expect(hook!.rarityPercent).not.toBeNull();
    expect(hook!.rarityPercent!).toBeLessThan(3);
  });

  it('재성 과다 + 신약 사주는 긴장형(재다신약) 훅으로 선정된다', () => {
    // 일간 庚(금) — 재성은 목(甲乙寅卯). 지지에 화·목만 두어 극신약 유도, 충 없음.
    const sajuResult = makeSaju(['甲', '午'], ['乙', '巳'], ['庚', '寅'], ['壬', '午']);
    const features = extractHookFeatures(sajuResult)!;
    expect(features.groupCount.재성).toBeGreaterThanOrEqual(3);
    expect(['신약', '극신약']).toContain(features.strength);
    const hook = selectCoreHook({ sajuResult });
    expect(hook).not.toBeNull();
    expect(hook!.type).toBe('tension');
    expect(hook!.evidence).toContain('재다신약');
    expect(hook!.sectionIndex).toBe(6);
  });

  it('구조 훅이 없는 사주가 교운기면 타이밍형 훅이 표면화된다', () => {
    // 균형 사주(긴장·희소 특징 없음): 일간 甲, 오행 고른 분포, 충 1쌍 이하
    const sajuResult = makeSaju(['庚', '午'], ['壬', '子'], ['甲', '寅'], ['戊', '辰']);
    const daeunResult = [
      { startAge: 3, startYear: 1993, stem: '癸', branch: '丑' },
      { startAge: 13, startYear: 2003, stem: '甲', branch: '寅' },
      { startAge: 23, startYear: 2013, stem: '乙', branch: '卯' },
      { startAge: 33, startYear: 2023, stem: '丙', branch: '辰' },
    ];
    const hook = selectCoreHook({ sajuResult, daeunResult, currentAge: 34 });
    expect(hook).not.toBeNull();
    expect(hook!.type).toBe('timing');
    expect(hook!.sectionIndex).toBe(2);
    expect(hook!.evidence).toContain('교운기');

    // 같은 사주가 교운기가 아니면(대운 정보 없음) 일주 폴백으로 내려간다
    const noTiming = selectCoreHook({ sajuResult });
    expect(noTiming).not.toBeNull();
    expect(noTiming!.type).toBe('rarity');
    expect(noTiming!.evidence).toContain('갑인일주');
  });

  it('극신약 사주는 (더 강한 후보가 없으면) 오해 정정형 훅으로 선정된다', () => {
    // 일간 甲 극신약(지원은 시간 乙 하나뿐) + 재2·관2·식상2로 어떤 십성도 3개 미만
    const sajuResult = makeSaju(['丙', '戌'], ['庚', '申'], ['甲', '辰'], ['乙', '巳']);
    const features = extractHookFeatures(sajuResult)!;
    expect(features.strength).toBe('극신약');
    expect(features.groupCount.재성).toBeLessThan(3);
    expect(features.groupCount.관성).toBeLessThan(3);
    expect(features.groupCount.식상).toBeLessThan(3);
    const hook = selectCoreHook({ sajuResult });
    expect(hook).not.toBeNull();
    expect(hook!.type).toBe('correction');
    expect(hook!.sectionIndex).toBe(5);
    expect(hook!.evidence).toContain('극신약');
  });

  it('시주가 판정 불가(일주 없음)면 null을 반환한다', () => {
    expect(selectCoreHook({ sajuResult: [] })).toBeNull();
    expect(extractHookFeatures([MASKED_HOUR, MASKED_HOUR, MASKED_HOUR, MASKED_HOUR])).toBeNull();
  });
});

describe('hookEngine — formatHookPct', () => {
  it('10 이상은 정수, 미만은 소수 1자리로 표기한다', () => {
    expect(formatHookPct(11.39)).toBe('11');
    expect(formatHookPct(1.41)).toBe('1.4');
    expect(formatHookPct(5.86)).toBe('5.9');
  });
});

describe('promptBuilders — 핵심 훅 회수 규칙', () => {
  const baseParams = {
    currentDateText: '2026년 7월 17일 금요일',
    currentYearPillar: { year: 2026, yearPillarHangul: '병오', yearPillarHanja: '丙午' } as any,
    reportGuideline: '(지침)',
    userName: '테스트',
    sajuContext: '(사주)',
    daeunContext: '(대운)',
    currentAge: 36,
  };

  it('coreHook 전달 시 회수 규칙 블록과 헤드라인·근거·섹션이 주입된다', () => {
    const prompt = buildReportSystemInstruction({
      ...baseParams,
      coreHook: {
        headline: '테스트 훅 헤드라인',
        advice: '테스트 핵심 조언',
        sectionIndex: 6,
        sectionLabel: '테마별 집중 분석',
        evidence: ['재다신약', '재성 4개'],
      },
    });
    expect(prompt).toContain('[핵심 훅 회수 규칙');
    expect(prompt).toContain('테스트 훅 헤드라인');
    expect(prompt).toContain('테스트 핵심 조언');
    expect(prompt).toContain('재다신약, 재성 4개');
    expect(prompt).toContain('6번 섹션(테마별 집중 분석)');
  });

  it('coreHook 미전달 시 회수 규칙 블록이 없다', () => {
    const prompt = buildReportSystemInstruction(baseParams);
    expect(prompt).not.toContain('[핵심 훅 회수 규칙');
  });
});
