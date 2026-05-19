/**
 * Firestore Admin SDK Timestamp 직렬화 유틸.
 *
 * Admin SDK의 Timestamp 객체는 res.json()을 거치면 `{ _seconds, _nanoseconds }`
 * 형태로 직렬화되어 클라이언트에서 `new Date(...)`가 Invalid Date가 된다.
 * 응답 직전에 모든 Timestamp를 ISO 8601 문자열로 정규화해 클라이언트가
 * `new Date(isoString)`으로 안전하게 파싱할 수 있게 한다.
 */

const isTimestampLike = (v: any): boolean =>
  !!v &&
  typeof v === 'object' &&
  (typeof v.toDate === 'function' ||
    (typeof v._seconds === 'number' && typeof v._nanoseconds === 'number') ||
    (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'));

const timestampToIso = (v: any): string | null => {
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    const seconds = typeof v._seconds === 'number' ? v._seconds : v.seconds;
    const nanos = typeof v._nanoseconds === 'number' ? v._nanoseconds : v.nanoseconds || 0;
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString();
  } catch {
    return null;
  }
};

/**
 * 객체/배열을 깊이 순회하며 Firestore Timestamp를 ISO 문자열로 치환한다.
 * 원본은 변경하지 않고 새 구조를 반환한다.
 */
export const serializeTimestamps = <T = any>(input: T): T => {
  if (input === null || input === undefined) return input;
  if (isTimestampLike(input)) return timestampToIso(input) as unknown as T;
  if (Array.isArray(input)) {
    return input.map((item) => serializeTimestamps(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    // Date는 그대로 ISO 문자열로
    if (input instanceof Date) return input.toISOString() as unknown as T;
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(input as Record<string, any>)) {
      out[k] = serializeTimestamps(val);
    }
    return out as T;
  }
  return input;
};
