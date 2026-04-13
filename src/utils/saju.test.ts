import { describe, test, expect } from 'vitest';
import { calculateGyeok, getCareerFocus, getSajuData, hiddenStems } from './saju';

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
});