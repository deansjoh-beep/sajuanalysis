import { describe, expect, it } from 'vitest';
import { isValidBirthDate, maxDayOfBirthMonth } from './birthDate';

describe('maxDayOfBirthMonth', () => {
  it('양력 — 달별 말일을 정확히 반환한다', () => {
    expect(maxDayOfBirthMonth(2021, 2, 'solar')).toBe(28);
    expect(maxDayOfBirthMonth(2020, 2, 'solar')).toBe(29); // 윤년
    expect(maxDayOfBirthMonth(2000, 2, 'solar')).toBe(29); // 400년 규칙 윤년
    expect(maxDayOfBirthMonth(1900, 2, 'solar')).toBe(28); // 100년 규칙 평년
    expect(maxDayOfBirthMonth(1991, 4, 'solar')).toBe(30);
    expect(maxDayOfBirthMonth(1991, 7, 'solar')).toBe(31);
  });

  it('음력(평·윤) — 30일 상한을 적용한다', () => {
    expect(maxDayOfBirthMonth(1991, 2, 'lunar')).toBe(30);
    expect(maxDayOfBirthMonth(1991, 2, 'leap')).toBe(30);
  });

  it('비정상 월 입력은 31로 폴백한다', () => {
    expect(maxDayOfBirthMonth(1991, 13, 'solar')).toBe(31);
    expect(maxDayOfBirthMonth(NaN, 2, 'solar')).toBe(31);
  });
});

describe('isValidBirthDate', () => {
  it('존재하지 않는 양력 날짜를 거부한다', () => {
    expect(isValidBirthDate(2021, 2, 31, 'solar')).toBe(false);
    expect(isValidBirthDate(2021, 2, 29, 'solar')).toBe(false);
    expect(isValidBirthDate(2021, 4, 31, 'solar')).toBe(false);
  });

  it('유효한 날짜를 허용한다', () => {
    expect(isValidBirthDate(2020, 2, 29, 'solar')).toBe(true);
    expect(isValidBirthDate(1991, 7, 23, 'solar')).toBe(true);
    expect(isValidBirthDate(1991, 2, 30, 'lunar')).toBe(true);
  });

  it('음력 31일과 범위 밖 값을 거부한다', () => {
    expect(isValidBirthDate(1991, 2, 31, 'lunar')).toBe(false);
    expect(isValidBirthDate(1991, 0, 1, 'solar')).toBe(false);
    expect(isValidBirthDate(1991, 1, 0, 'solar')).toBe(false);
    expect(isValidBirthDate(NaN, 1, 1, 'solar')).toBe(false);
  });
});
