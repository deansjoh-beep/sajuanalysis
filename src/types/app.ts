export interface Guidelines {
  saju: string;
  consulting: string;
  report: string;
}

export interface UserData {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  calendarType: 'solar' | 'lunar' | 'leap';
  gender: 'M' | 'F';
  unknownTime: boolean;
}

/**
 * 입력 폼 기본값 — 테스트 계정(오세진 1969-12-02 양력 10:00, 남).
 * 무제한 상담 테스트 명식(chatUsage.UNLIMITED_TEST_PROFILES)과 동일하게 유지한다.
 */
export const DEFAULT_USER_DATA: UserData = {
  name: '오세진',
  birthYear: '1969',
  birthMonth: '12',
  birthDay: '2',
  birthHour: '10',
  birthMinute: '0',
  calendarType: 'solar',
  gender: 'M',
  unknownTime: false,
};

export interface TaekilTimeSlot {
  time: string;
  score: number;
  reason: string;
}

export interface TaekilScoreFactor {
  label: string;
  weight: number;
  type: 'plus' | 'minus' | 'info';
}

export interface TaekilResultItem {
  date: string;
  rating: number;
  reasons: string[];
  topTimeSlots: TaekilTimeSlot[];
  factors: TaekilScoreFactor[];
}

export type SuggestionSource = 'static' | 'dynamic' | 'fallback' | null;
