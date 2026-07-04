import { describe, test, expect } from 'vitest';
import { calculateGyeok, getCareerFocus, getSajuData, getAdjustedTime, hiddenStems } from './saju';
import { getKstNormalizationOffsetMinutes, SEOUL_LONGITUDE } from '../lib/manseryeok/policy';

describe('saju utils', () => {
  test('getCareerFocus returns English fallback text for empty data when locale is en', () => {
    const text = getCareerFocus([], 'en');
    expect(text).toMatch(/General professional potential|Career potential/);
  });

  test('getCareerFocus returns combined English career phrases when locale is en', () => {
    const sajuMock = [
      { stem: { deity: '식신' }, branch: { deity: '' } },
      { stem: { deity: '편관' }, branch: { deity: '' } }
    ];
    const text = getCareerFocus(sajuMock as any, 'en');
    expect(text).toContain('innovation');
    expect(text.toLowerCase()).toContain('leadership');
  });

  test('getCareerFocus returns Korean phrase when locale is ko', () => {
    const sajuMock = [{ stem: { deity: '식신' }, branch: { deity: '' } }];
    const text = getCareerFocus(sajuMock as any, 'ko');
    expect(text).toContain('창의성');
  });

  test('getSajuData uses converted solar date for lunar input', () => {
    const saju = getSajuData('1969-10-23', '10:00', true, false, false, 'Asia/Seoul');

    expect(saju.map((pillar) => `${pillar.stem.hanja}${pillar.branch.hanja}`)).toEqual([
      '癸巳',
      '辛亥',
      '乙亥',
      '己酉'
    ]);
    expect(calculateGyeok(saju).gyeok).toBe('상관격');
  });

  test('getSajuData attaches non-enumerable nearJieqiBoundary and minHoursToJieqi', () => {
    const saju = getSajuData('1969-10-23', '10:00', true, false, false, 'Asia/Seoul');
    // map/스프레드 등 열거는 4개 pillar만 순회한다
    expect(Object.keys(saju as any).filter((k) => Number.isNaN(Number(k))).length).toBe(0);
    // 그러나 명시 접근은 가능
    expect(typeof (saju as any).nearJieqiBoundary).toBe('boolean');
    expect((saju as any).minHoursToJieqi === null || typeof (saju as any).minHoursToJieqi === 'number').toBe(true);
  });

  test('getSajuData 결과는 unknownTime=true여도 안전하게 반환된다', () => {
    const saju = getSajuData('1990-06-15', '00:00', false, false, true, 'Asia/Seoul');
    expect(saju).toHaveLength(4);
    // 시주가 unknownTime 시 '?' 로 초기화
    expect(saju[0].stem.hanja).toBe('?');
    expect((saju as any).nearJieqiBoundary).toBe(false);
  });

  test('getSajuData post-1961 케이스는 KST 오프셋을 적용하지 않는다 (회귀)', () => {
    // 1969-10-23 lunar 10:00 은 policy 도입 후에도 동일 결과여야 한다
    const saju = getSajuData('1969-10-23', '10:00', true, false, false, 'Asia/Seoul');
    expect(saju.map((p) => `${p.stem.hanja}${p.branch.hanja}`)).toEqual([
      '癸巳', '辛亥', '乙亥', '己酉'
    ]);
  });

  test('hidden stems include all 여기/중기/본기 for each branch', () => {
    // 酉: 여기 庚(경), 본기 辛(신)
    expect(hiddenStems['酉']).toEqual(['경', '신']);
    // 亥: 여기 戊(무), 중기 甲(갑), 본기 壬(임)
    expect(hiddenStems['亥']).toEqual(['무', '갑', '임']);
    // 子: 여기 壬(임), 본기 癸(계)
    expect(hiddenStems['子']).toEqual(['임', '계']);
    // 卯: 여기 甲(갑), 본기 乙(을)
    expect(hiddenStems['卯']).toEqual(['갑', '을']);
    // 午: 여기 丙(병), 중기 己(기), 본기 丁(정)
    expect(hiddenStems['午']).toEqual(['병', '기', '정']);
  });

  // Phase 1-1: 연·월주 절입 경계가 실제 절입_KST 순간과 일치해야 한다.
  // (종전 버그: 출생만 진태양시·절기는 베이징시라 경계가 평균 ~28분 이르게 잡혔음.)
  describe('절입 경계 정확도 (연·월주)', () => {
    // 2024 입춘 = 2024-02-04 17:27:07 KST. 이 순간에 연주 癸卯→甲辰, 월주 乙丑(丑월)→丙寅(寅월).
    test('입춘 직전 출생은 이전 연·월주(癸卯/乙丑)', () => {
      const saju = getSajuData('2024-02-04', '17:25', false, false, false, 'Asia/Seoul');
      expect(`${saju[3].stem.hanja}${saju[3].branch.hanja}`).toBe('癸卯'); // 년주
      expect(`${saju[2].stem.hanja}${saju[2].branch.hanja}`).toBe('乙丑'); // 월주
    });

    test('입춘 직후 출생은 이후 연·월주(甲辰/丙寅)', () => {
      const saju = getSajuData('2024-02-04', '17:29', false, false, false, 'Asia/Seoul');
      expect(`${saju[3].stem.hanja}${saju[3].branch.hanja}`).toBe('甲辰');
      expect(`${saju[2].stem.hanja}${saju[2].branch.hanja}`).toBe('丙寅');
    });

    test('회귀: 입춘 7분 전(17:20)은 조기 전환하지 않는다 (종전 버그는 甲辰)', () => {
      // 버그 시절 경계가 ~17:13이라 17:20이 이미 甲辰으로 넘어갔었다. 수정 후엔 癸卯여야 함.
      const saju = getSajuData('2024-02-04', '17:20', false, false, false, 'Asia/Seoul');
      expect(`${saju[3].stem.hanja}${saju[3].branch.hanja}`).toBe('癸卯');
      expect(saju[2].branch.hanja).toBe('丑');
    });

    test('월 경계(청명 2024 16:02): 직전 卯월 → 직후 辰월', () => {
      const before = getSajuData('2024-04-04', '16:00', false, false, false, 'Asia/Seoul');
      const after = getSajuData('2024-04-04', '16:05', false, false, false, 'Asia/Seoul');
      expect(before[2].branch.hanja).toBe('卯');
      expect(after[2].branch.hanja).toBe('辰');
    });

    test('절입 경계 전후로 시주(진태양시 기준)는 변하지 않는다', () => {
      // 일·시주는 절기와 무관 → 경계 전후 동일해야 한다(진태양시 계산 보존 확인).
      const before = getSajuData('2024-02-04', '17:25', false, false, false, 'Asia/Seoul');
      const after = getSajuData('2024-02-04', '17:29', false, false, false, 'Asia/Seoul');
      expect(`${before[0].stem.hanja}${before[0].branch.hanja}`).toBe(`${after[0].stem.hanja}${after[0].branch.hanja}`); // 시주
      expect(`${before[1].stem.hanja}${before[1].branch.hanja}`).toBe(`${after[1].stem.hanja}${after[1].branch.hanja}`); // 일주
    });
  });

  test('getAdjustedTime(deprecated)은 policy 결과를 그대로 재노출한다', () => {
    // Phase 1-1 리팩터링: policy 모듈로 이관되었으므로 결과가 일치해야 한다
    expect(getAdjustedTime(1955, 6, 15, 10, 0)).toBe(getKstNormalizationOffsetMinutes(1955, 6, 15));
    expect(getAdjustedTime(1987, 7, 15, 10, 0)).toBe(-60);
    expect(getAdjustedTime(1988, 7, 15, 10, 0)).toBe(-60);
    expect(getAdjustedTime(1912, 1, 1, 10, 0)).toBe(0);
    expect(getAdjustedTime(2020, 6, 15, 10, 0)).toBe(0);
  });
});