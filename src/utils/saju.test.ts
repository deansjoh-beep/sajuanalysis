import { describe, test, expect } from 'vitest';
import { getCareerFocus } from './saju';

describe('saju utils', () => {
  test('getCareerFocus returns fallback text for empty data', () => {
    const text = getCareerFocus([]);
    expect(text).toMatch(/General professional potential|Career potential/);
  });

  test('getCareerFocus returns combined career phrases', () => {
    const sajuMock = [
      { stem: { deity: '식신' }, branch: { deity: '' } },
      { stem: { deity: '편관' }, branch: { deity: '' } }
    ];
    const text = getCareerFocus(sajuMock as any);
    expect(text).toContain('innovation');
    expect(text.toLowerCase()).toContain('leadership');
  });
});