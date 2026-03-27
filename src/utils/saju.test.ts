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

  test('hidden stems use standard values for亥 and酉', () => {
    expect(hiddenStems['亥']).toEqual(['갑', '임']);
    expect(hiddenStems['酉']).toEqual(['신']);
  });
});