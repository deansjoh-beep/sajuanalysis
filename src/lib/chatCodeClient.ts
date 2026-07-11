/**
 * 사주 코드 조회 + 후속 질문 차감 클라이언트 헬퍼.
 *
 * 상담 챗에서 코드 보유자는 자유 질문 1건당 followup 1회를 차감한다(구매당 3회).
 * 시나리오 버튼 턴은 차감하지 않는다. 서버 API(api/code.ts · server.ts)와 통신.
 */

/** 코드 입력 검증 패턴(하이픈 선택): 예 HW-3F9K2A. */
export const CODE_INPUT_PATTERN = /^[A-Za-z0-9]{2}-?[A-Za-z0-9]{6}$/;

/** 대문자화 + 2-6 하이픈 정규화. */
export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^([A-Z0-9]{2})([A-Z0-9]{6})$/, '$1-$2');
}

export interface ChatCodeOrder {
  orderId: string;
  product: string;
  status: string;
  followupRemaining: number;
}

export interface ChatCodeInfo {
  code: string; // 정규화된 코드
  orders: ChatCodeOrder[];
  newYearDiscountPercent: number | null;
}

export interface LookupResponse {
  ok: boolean;
  info?: ChatCodeInfo;
  error?: string;
  message?: string;
}

export interface FollowupResponse {
  ok: boolean;
  remaining: number;
  error?: string;
  message?: string;
}

/** 코드 조회. found=false이면 CODE_NOT_FOUND로 매핑. */
export async function lookupCodeClient(rawCode: string): Promise<LookupResponse> {
  const code = normalizeCode(rawCode);
  if (!CODE_INPUT_PATTERN.test(code)) {
    return { ok: false, error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' };
  }
  try {
    const res = await fetch(`/api/code?code=${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.found === false) {
      return {
        ok: false,
        error: data?.error || 'CODE_NOT_FOUND',
        message: data?.message || '코드를 찾을 수 없습니다. 다시 확인해 주세요.',
      };
    }
    const orders: ChatCodeOrder[] = Array.isArray(data.orders)
      ? data.orders.map((o: any) => ({
          orderId: o.orderId,
          product: o.product,
          status: o.status,
          followupRemaining: Math.max(0, Number(o.followupRemaining) || 0),
        }))
      : [];
    return {
      ok: true,
      info: { code, orders, newYearDiscountPercent: data.newYearDiscountPercent ?? null },
    };
  } catch {
    return { ok: false, error: 'NETWORK', message: '조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
  }
}

/** 후속 질문 1회 차감. 429 FOLLOWUP_EXHAUSTED / TOO_MANY_REQUESTS를 error 코드로 구분. */
export async function consumeFollowupClient(code: string, orderId: string): Promise<FollowupResponse> {
  try {
    const res = await fetch('/api/code/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, orderId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      return { ok: true, remaining: Math.max(0, Number(data.remaining) || 0) };
    }
    return {
      ok: false,
      error: data?.error || 'FOLLOWUP_FAILED',
      message: data?.message || '후속 질문 처리 중 오류가 발생했습니다.',
      remaining: Math.max(0, Number(data?.remaining) || 0),
    };
  } catch {
    return { ok: false, error: 'NETWORK', message: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', remaining: 0 };
  }
}

/** followup이 남은 첫 주문을 고른다(차감 대상). 없으면 null. */
export function pickConsumableOrder(info: ChatCodeInfo | null): ChatCodeOrder | null {
  if (!info) return null;
  return info.orders.find((o) => o.followupRemaining > 0) ?? null;
}

/** 코드에 남은 followup 총합. */
export function totalFollowupRemaining(info: ChatCodeInfo | null): number {
  if (!info) return 0;
  return info.orders.reduce((n, o) => n + o.followupRemaining, 0);
}
