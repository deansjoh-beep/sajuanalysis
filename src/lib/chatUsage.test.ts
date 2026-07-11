import { describe, it, expect } from 'vitest';
import {
  FREE_DAILY_LIMIT,
  remainingFromState,
  incrementedState,
  seoulDateKey,
  isUnlimitedTestUser,
} from './chatUsage';

describe('chatUsage 무료 턴 한도 코어', () => {
  const TODAY = '2026-07-11';

  it('상태 없음 → 한도 전부 남음', () => {
    expect(remainingFromState(null, TODAY)).toBe(FREE_DAILY_LIMIT);
  });

  it('오늘 일부 사용 → 남은 수 정확', () => {
    expect(remainingFromState({ date: TODAY, count: 2 }, TODAY)).toBe(FREE_DAILY_LIMIT - 2);
  });

  it('날짜가 지나면 리셋되어 한도 전부', () => {
    expect(remainingFromState({ date: '2026-07-10', count: 5 }, TODAY)).toBe(FREE_DAILY_LIMIT);
  });

  it('한도 초과분은 0으로 클램프', () => {
    expect(remainingFromState({ date: TODAY, count: 99 }, TODAY)).toBe(0);
  });

  it('increment: 상태 없음 → 오늘 1', () => {
    expect(incrementedState(null, TODAY)).toEqual({ date: TODAY, count: 1 });
  });

  it('increment: 같은 날 누적', () => {
    expect(incrementedState({ date: TODAY, count: 2 }, TODAY)).toEqual({ date: TODAY, count: 3 });
  });

  it('increment: 날짜가 바뀌면 새 날로 리셋 후 1', () => {
    expect(incrementedState({ date: '2026-07-10', count: 4 }, TODAY)).toEqual({ date: TODAY, count: 1 });
  });

  it('소비 5회 뒤 남은 수 0 (경계)', () => {
    let state: { date: string; count: number } | null = null;
    for (let i = 0; i < FREE_DAILY_LIMIT; i++) state = incrementedState(state, TODAY);
    expect(remainingFromState(state, TODAY)).toBe(0);
  });

  it('seoulDateKey는 YYYY-MM-DD 형식', () => {
    expect(seoulDateKey(new Date('2026-07-11T00:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isUnlimitedTestUser 무제한 테스트 명식', () => {
  const TESTER = {
    name: '오세진',
    birthYear: '1969',
    birthMonth: '12',
    birthDay: '2',
    birthHour: '10',
    calendarType: 'solar',
    unknownTime: false,
  };

  it('테스트 명식과 정확히 일치 → true', () => {
    expect(isUnlimitedTestUser(TESTER)).toBe(true);
  });

  it('0 패딩된 문자열("02")도 동일 취급', () => {
    expect(isUnlimitedTestUser({ ...TESTER, birthDay: '02' })).toBe(true);
  });

  it('이름 앞뒤 공백은 무시', () => {
    expect(isUnlimitedTestUser({ ...TESTER, name: ' 오세진 ' })).toBe(true);
  });

  it('이름이 다르면 false', () => {
    expect(isUnlimitedTestUser({ ...TESTER, name: '홍길동' })).toBe(false);
  });

  it('생일이 하루라도 다르면 false', () => {
    expect(isUnlimitedTestUser({ ...TESTER, birthDay: '3' })).toBe(false);
  });

  it('시(時)가 다르면 false', () => {
    expect(isUnlimitedTestUser({ ...TESTER, birthHour: '11' })).toBe(false);
  });

  it('음력 입력이면 false', () => {
    expect(isUnlimitedTestUser({ ...TESTER, calendarType: 'lunar' })).toBe(false);
  });

  it('생시 모름이면 false (시각 확인 불가)', () => {
    expect(isUnlimitedTestUser({ ...TESTER, unknownTime: true })).toBe(false);
  });
});
