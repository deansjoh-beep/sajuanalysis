export interface ModelErrorPayload {
  code: number | null;
  status: string | null;
  message: string;
}

export const parseModelErrorPayload = (err: any): ModelErrorPayload => {
  // 1순위: err.message 안의 JSON {"error":{...}} 파싱 (Gemini SDK는 err.status에
  //        HTTP 숫자코드 "503"을 넣고 err.message에 실제 상세 JSON을 담음)
  const rawMessage = String(err?.message || '');
  const jsonStart = rawMessage.indexOf('{"error"');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart));
      if (parsed?.error?.code || parsed?.error?.status) {
        return {
          code: Number(parsed?.error?.code) || null,
          status: String(parsed?.error?.status || '').toUpperCase() || null,
          message: String(parsed?.error?.message || rawMessage)
        };
      }
    } catch {
      // fall through
    }
  }

  // 2순위: err.error.* 또는 err.* 직접 접근
  const directCode = err?.error?.code ?? err?.code;
  const directStatus = err?.error?.status ?? err?.status;

  if (directCode || directStatus) {
    return {
      code: Number(directCode) || null,
      status: String(directStatus || '').toUpperCase() || null,
      message: String(err?.error?.message || rawMessage)
    };
  }

  return {
    code: null,
    status: null,
    message: rawMessage
  };
};

export const isRetryableModelError = (err: any): boolean => {
  const payload = parseModelErrorPayload(err);
  // SDK가 err.status에 HTTP 코드 문자열("503")을 담는 경우 대비해 숫자 변환도 체크
  const numericStatus = Number(payload.status);
  return (
    payload.code === 429 ||
    payload.code === 503 ||
    payload.status === 'UNAVAILABLE' ||
    payload.status === 'RESOURCE_EXHAUSTED' ||
    numericStatus === 429 ||
    numericStatus === 503
  );
};

export const isModelSelectionError = (err: any): boolean => {
  const payload = parseModelErrorPayload(err);
  const message = String(payload.message || '').toLowerCase();
  const modelHint = message.includes('model') || message.includes('models/');
  return (
    payload.code === 404 ||
    payload.status === 'NOT_FOUND' ||
    payload.status === 'FAILED_PRECONDITION' ||
    (payload.status === 'INVALID_ARGUMENT' && modelHint)
  );
};

export const waitMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const runWithModelRetry = async <T>(
  task: () => Promise<T>,
  maxAttempts = 3,
  baseBackoffMs = 2000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (err: any) {
      lastError = err;
      if (!isRetryableModelError(err) || attempt === maxAttempts) {
        throw err;
      }
      const backoff = baseBackoffMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
      console.warn(
        `[RETRY] Gemini request failed with transient load error. attempt=${attempt}/${maxAttempts}, wait=${backoff}ms`
      );
      await waitMs(backoff);
    }
  }

  throw lastError;
};
