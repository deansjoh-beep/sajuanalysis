import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 상수 시간 문자열 비교 — 토큰/시크릿 인증에 사용한다.
 * 두 값을 SHA-256 고정 길이 다이제스트로 만든 뒤 timingSafeEqual로 비교하므로,
 * 길이 차이에 따른 조기 반환/예외 없이 비교 타이밍 노출(timing side-channel)을 없앤다.
 * ⚠️ 빈 값끼리는 true를 반환한다 — 시크릿 미설정(빈 문자열) 차단은 호출부의 Boolean 가드로 유지할 것.
 */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  const da = createHash('sha256').update(String(a ?? '')).digest();
  const db = createHash('sha256').update(String(b ?? '')).digest();
  return timingSafeEqual(da, db);
}
