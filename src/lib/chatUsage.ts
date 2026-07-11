/**
 * 무료 상담 일일 턴 한도 (localStorage 기반).
 *
 * 코드가 없는 무료 사용자는 하루 FREE_DAILY_LIMIT회의 LLM 턴(시나리오 버튼 + 자유
 * 질문 모두 포함)만 사용할 수 있다. 소진 시 gate로 리포트 구매/코드 입력을 유도한다.
 *
 * 날짜 경계는 서울(KST) 기준. 순수 코어 함수는 테스트 대상이며, 브라우저 래퍼만
 * localStorage와 현재 시각을 읽는다.
 */
export const FREE_DAILY_LIMIT = 5;

const STORAGE_KEY = 'chat_free_usage_v1';

export interface UsageState {
  date: string; // YYYY-MM-DD (KST)
  count: number;
}

/** 남은 무료 턴 수(순수). state가 없거나 날짜가 지났으면 한도 전부 반환. */
export function remainingFromState(
  state: UsageState | null,
  todayKey: string,
  limit: number = FREE_DAILY_LIMIT
): number {
  if (!state || state.date !== todayKey) return limit;
  return Math.max(0, limit - state.count);
}

/** 턴 1회 소비 후의 다음 state(순수). 날짜가 지났으면 새 날로 리셋 후 1. */
export function incrementedState(state: UsageState | null, todayKey: string): UsageState {
  if (!state || state.date !== todayKey) return { date: todayKey, count: 1 };
  return { date: todayKey, count: state.count + 1 };
}

/** 서울(KST) 기준 YYYY-MM-DD. */
export function seoulDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

const readState = (): UsageState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.date === 'string' && typeof parsed?.count === 'number') {
      return parsed as UsageState;
    }
    return null;
  } catch {
    return null;
  }
};

const writeState = (state: UsageState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage 미가용(프라이빗 모드 등) — 한도 없이 동작 */
  }
};

/** 오늘 남은 무료 턴 수. */
export function getFreeTurnsRemaining(): number {
  return remainingFromState(readState(), seoulDateKey());
}

/** 무료 턴 1회 소비. 소비 후 남은 수를 반환. */
export function consumeFreeTurn(): number {
  const today = seoulDateKey();
  const next = incrementedState(readState(), today);
  writeState(next);
  return remainingFromState(next, today);
}
