/**
 * 토스페이먼츠 서버 측 클라이언트 (2-2).
 *
 * - 결제 승인: POST /v1/payments/confirm — 클라이언트 결제창 성공 후 서버가 최종 승인.
 * - 결제 취소: POST /v1/payments/{paymentKey}/cancel — 환불·자동 취소 공용.
 * - 인증: secret key Basic 인증. ⛔ 실키는 OWNER PG 가맹 승인 후(8월 초) — 그 전엔
 *   토스 문서의 테스트 키(test_sk_...)로 개발한다. 키 미설정 시 API는 503.
 */

const TOSS_API_BASE = 'https://api.tosspayments.com';

export interface TossPaymentResult {
  paymentKey: string;
  orderId: string;
  status: string; // DONE | CANCELED | ...
  totalAmount: number;
  method?: string;
  approvedAt?: string;
}

export class TossApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'TossApiError';
  }
}

export interface TossClient {
  confirmPayment(input: { paymentKey: string; orderId: string; amount: number }): Promise<TossPaymentResult>;
  cancelPayment(paymentKey: string, cancelReason: string, cancelAmount?: number): Promise<TossPaymentResult>;
}

export function isTossConfigured(): boolean {
  return Boolean((process.env.TOSS_SECRET_KEY || '').trim());
}

export function createTossClient(secretKey?: string): TossClient {
  const key = (secretKey ?? process.env.TOSS_SECRET_KEY ?? '').trim();
  if (!key) {
    throw new Error('TOSS_SECRET_KEY가 설정되지 않았습니다.');
  }
  const authHeader = `Basic ${Buffer.from(`${key}:`).toString('base64')}`;

  const request = async (path: string, body: Record<string, unknown>): Promise<TossPaymentResult> => {
    const response = await fetch(`${TOSS_API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const code = String((data as { code?: string }).code || 'TOSS_ERROR');
      const message = String((data as { message?: string }).message || `토스 API 오류 (HTTP ${response.status})`);
      throw new TossApiError(code, message, response.status);
    }
    return data as unknown as TossPaymentResult;
  };

  return {
    confirmPayment: (input) => request('/v1/payments/confirm', input),
    cancelPayment: (paymentKey, cancelReason, cancelAmount) =>
      request(`/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
        cancelReason,
        ...(cancelAmount !== undefined ? { cancelAmount } : {}),
      }),
  };
}
