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
  /**
   * ⚠️ Sonnet 5·Opus 4.7+ 계열은 비기본 temperature를 400으로 거부한다.
   * 해당 모델 호출 시 생략할 것(생략하면 요청 본문에 포함하지 않음).
   */
  temperature?: number;
  /** thinking 설정(예: { type: 'disabled' }). 생략 시 모델 기본값(Sonnet 5는 adaptive). */
  thinking?: { type: string };
  /**
   * true면 프록시가 Anthropic SSE를 수신해 서버측 조립 후 완성본을 반환한다.
   * 1만+ 토큰 장문 생성 시 필수 — 비스트리밍은 응답 헤더가 수 분 뒤에 도착해
   * 서버측(undici) 헤더 타임아웃(300s)에 걸린다.
   */
  stream?: boolean;
  signal?: AbortSignal;
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
  temperature,
  thinking,
  stream,
  signal,
}: ClaudeGenerateParams): Promise<{ text: string }> => {
  const response = await fetch('/api/claude/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(thinking ? { thinking } : {}),
      ...(stream === true ? { stream: true } : {}),
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
  // Sonnet 5 등 adaptive thinking 모델은 text 앞에 thinking 블록이 올 수 있다 —
  // 첫 블록 고정 접근 대신 text 타입 블록을 찾는다.
  const textBlock = Array.isArray(data.content)
    ? data.content.find((b: any) => b?.type === 'text')
    : null;
  return { text: textBlock ? String(textBlock.text) : '' };
};
