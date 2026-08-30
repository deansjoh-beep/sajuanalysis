import { DEFAULT_USER_DATA, type UserData } from '../types/app';

/**
 * 생년월일시(userData) 브라우저 보관 — 재방문 시 재입력을 없애기 위한 localStorage 저장.
 *
 * 개인정보 무저장 원칙과의 관계: 이 저장은 사용자 본인 기기의 localStorage에만 남고
 * 서버로 전송·저장되지 않는다. 랜딩 문구("서버로 전송·저장되지 않으며, 이 브라우저에만
 * 보관됩니다")와 반드시 일치하게 유지할 것. 헤더의 '상담 종료 및 데이터 삭제'가
 * clearStoredUserData로 함께 지운다.
 */

const KEY = 'sj_user_birth_v1';

export function loadStoredUserData(): UserData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    // 형상 검증: 기본값의 키를 기준으로 문자열/불리언 타입이 맞는 값만 채택 (버전 불일치 방어)
    const merged: UserData = { ...DEFAULT_USER_DATA };
    for (const key of Object.keys(DEFAULT_USER_DATA) as Array<keyof UserData>) {
      const v = parsed[key];
      if (typeof v === typeof DEFAULT_USER_DATA[key]) {
        (merged as any)[key] = v;
      }
    }
    return merged;
  } catch {
    return null;
  }
}

export function saveStoredUserData(u: UserData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    // 저장 불가 환경(사생활 보호 모드 등) — 조용히 무시
  }
}

export function clearStoredUserData(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
