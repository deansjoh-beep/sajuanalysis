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
