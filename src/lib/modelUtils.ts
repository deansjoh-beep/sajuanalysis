export interface ModelErrorPayload {
  code: number | null;
  status: string | null;
  message: string;
}

export const parseModelErrorPayload = (err: any): ModelErrorPayload => {
  const directCode = err?.error?.code ?? err?.code;
  const directStatus = err?.error?.status ?? err?.status;

  if (directCode || directStatus) {
    return {
      code: Number(directCode) || null,
      status: String(directStatus || '').toUpperCase() || null,
      message: String(err?.error?.message || err?.message || '')
    };
  }

  const rawMessage = String(err?.message || '');
  const jsonStart = rawMessage.indexOf('{"error"');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart));
      return {
        code: Number(parsed?.error?.code) || null,
        status: String(parsed?.error?.status || '').toUpperCase() || null,
        message: String(parsed?.error?.message || rawMessage)
      };
    } catch {
      // keep fallback below
    }
  }

  return {
    code: null,
    status: null,
    message: rawMessage
  };
};

export const isRetryableModelError = (err: any): boolean => {
  const payload = parseModelErrorPayload(err);
  return (
    payload.code === 429 ||
    payload.code === 503 ||
    payload.status === 'UNAVAILABLE' ||
    payload.status === 'RESOURCE_EXHAUSTED'
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
  maxAttempts = 3
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
      const backoff = 1200 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 300);
      console.warn(
        `[RETRY] Gemini request failed with transient load error. attempt=${attempt}/${maxAttempts}, wait=${backoff}ms`
      );
      await waitMs(backoff);
    }
  }

  throw lastError;
};
