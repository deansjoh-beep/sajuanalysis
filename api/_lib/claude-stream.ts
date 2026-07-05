/**
 * Anthropic Messages API 스트리밍 수신 → 서버측 조립 (프리미엄 장문 리포트용)
 *
 * 배경: Sonnet 5가 1만+ 토큰 장문을 비스트리밍으로 생성하면 응답 헤더가 수 분 뒤에
 * 도착해 Node(undici) 기본 헤더 타임아웃(300s)에 걸린다. stream: true로 요청하면
 * 헤더·청크가 즉시 흐르므로 타임아웃이 없고, 여기서 완성본으로 조립해 기존
 * 비스트리밍 응답과 동일한 형태({ content, stop_reason, usage, model })로 반환한다.
 *
 * 사용처: server.ts·api/claude/generate.ts 프록시(stream: true 요청 시),
 *         scripts/report-bench.ts(직접 호출).
 */

export type ClaudeMessagesBody = {
  model: string;
  system?: string;
  messages: Array<{ role: string; content: unknown }>;
  max_tokens: number;
  temperature?: number;
  thinking?: { type: string };
};

export type ClaudeAggregateResult = {
  status: number;
  /** 성공 시 비스트리밍 Messages 응답과 호환되는 서브셋, 실패 시 Anthropic 에러 본문. */
  data: any;
};

/** Anthropic에 stream=true로 요청하고 SSE를 조립해 완성 응답으로 반환한다. */
export const claudeStreamAggregate = async (
  apiKey: string,
  body: ClaudeMessagesBody,
): Promise<ClaudeAggregateResult> => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    return { status: res.status, data: err };
  }

  let text = '';
  let model = body.model;
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let streamError: any = null;

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleLine = (line: string) => {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let event: any;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    switch (event.type) {
      case 'message_start':
        model = event.message?.model ?? model;
        inputTokens = Number(event.message?.usage?.input_tokens ?? 0);
        break;
      case 'content_block_delta':
        // thinking_delta 등은 무시하고 최종 텍스트만 조립
        if (event.delta?.type === 'text_delta') text += String(event.delta.text ?? '');
        break;
      case 'message_delta':
        stopReason = event.delta?.stop_reason ?? stopReason;
        outputTokens = Number(event.usage?.output_tokens ?? outputTokens);
        break;
      case 'error':
        streamError = event.error ?? { message: 'stream error' };
        break;
      default:
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      handleLine(line);
    }
    if (streamError) break;
  }
  if (buffer) handleLine(buffer.replace(/\r$/, ''));

  if (streamError) {
    return { status: 502, data: { error: streamError } };
  }

  return {
    status: 200,
    data: {
      model,
      content: [{ type: 'text', text }],
      stop_reason: stopReason,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    },
  };
};
