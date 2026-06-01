import { auth } from '../firebase';

export interface DailyFortune {
  summary: string;
  score: number;
  sections: {
    overall: string;
    wealth: string;
    love: string;
    work: string;
    health: string;
  };
  advice: string;
  lucky: { color: string; number: string; direction: string };
  tags: string[];
}

export interface DailyFortuneResponse {
  success: boolean;
  cached: boolean;
  date: string;
  dayPillarHanja: string;
  dayPillarHangul: string;
  fortune: DailyFortune;
  model: string;
  createdAt?: string;
}

export class DailyFortuneError extends Error {
  code: string;
  constructor(message: string, code = 'unknown') {
    super(message);
    this.code = code;
  }
}

/**
 * 회원의 오늘의 운세를 조회/생성한다.
 * Firebase ID 토큰을 Authorization 헤더로 보내고, 서버가 캐시 확인 후 필요 시 생성한다.
 */
export const fetchDailyFortune = async (opts?: { refresh?: boolean }): Promise<DailyFortuneResponse> => {
  const user = auth.currentUser;
  if (!user) throw new DailyFortuneError('로그인이 필요합니다.', 'UNAUTHENTICATED');

  const idToken = await user.getIdToken();
  const url = `/api/daily-fortune${opts?.refresh ? '?refresh=1' : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new DailyFortuneError(data?.message || '운세를 불러오지 못했습니다.', data?.error || 'SERVER_ERROR');
  }
  return data as DailyFortuneResponse;
};
