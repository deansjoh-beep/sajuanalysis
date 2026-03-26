import { describe, test, expect } from 'vitest';
import { getCareerFocus } from './saju';

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
});