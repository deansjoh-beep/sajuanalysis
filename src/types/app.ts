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
 * 입력 폼 기본값 — 임의의 중립 명식(실존 인물 아님).
 * ⚠️ 개인 명식이나 무제한 상담 테스트 명식(chatUsage.UNLIMITED_TEST_PROFILES)과
 * 절대 일치시키지 말 것 — 일치하면 기본값 그대로 상담하는 모든 방문자가
 * 무료 한도를 우회하게 되고, 개인 생년월일시가 사이트 기본값으로 노출된다.
 */
export const DEFAULT_USER_DATA: UserData = {
  name: '',
  birthYear: '1991',
  birthMonth: '7',
  birthDay: '23',
  birthHour: '9',
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
