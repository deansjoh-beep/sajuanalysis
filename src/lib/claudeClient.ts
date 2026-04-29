/**
 * Claude (Anthropic) API 폴백 클라이언트
 *
 * Gemini 모델이 모두 503/429로 실패할 때 자동으로 호출됩니다.
 * @anthropic-ai/sdk 대신 fetch를 직접 사용해 번들 크기를 최소화합니다.
 * 브라우저에서 직접 호출 시 anthropic-dangerous-direct-browser-access 헤더가 필요합니다.
 */

export const getClaudeApiKey = (): string | null => {
  const windowKey = (window as any).ANTHROPIC_API_KEY;
  const viteKey = (import.meta as any).env.VITE_ANTHROPIC_API_KEY;
  const processKey =
    typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY;
  const key = windowKey || viteKey || processKey;
  return key && key !== 'undefined' && key !== '' ? String(key) : null;
};

export const DEFAULT_CLAUDE_MODELS = [
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const;

export interface ClaudeGenerateParams {
  model: string;
  systemInstruction: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Anthropic Messages API 호출.
 * 반환 형태는 Gemini generateContent의 { text } 서브셋과 동일하게 맞춤.
 */
export const claudeGenerateContent = async ({
  model,
  systemInstruction,
  userMessage,
  maxTokens = 8192,
  temperature = 0.8,
}: ClaudeGenerateParams): Promise<{ text: string }> => {
  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemInstruction,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const err = Object.assign(
      new Error(errorBody?.error?.message || `Claude API error ${response.status}`),
      {
        error: errorBody?.error,
        code: response.status,
        status: String(errorBody?.error?.type || '').toUpperCase(),
      },
    );
    throw err;
  }

  const data = await response.json();
  const text =
    Array.isArray(data.content) && data.content[0]?.type === 'text'
      ? String(data.content[0].text)
      : '';
  return { text };
};
