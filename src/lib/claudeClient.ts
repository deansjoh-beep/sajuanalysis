export const getClaudeApiKey = (): string | null => {
  // 프록시(/api/claude/generate)를 사용하므로 키 자체는 불필요하지만
  // 프록시 가용 여부 확인용으로 true를 반환해 폴백 흐름을 유지
  return 'proxy';
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
  const response = await fetch('/api/claude/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
