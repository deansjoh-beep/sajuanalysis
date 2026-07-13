import { Type } from '@google/genai';
import {
  getSajuData,
  getDaeunData,
  calculateYongshin,
  calculateGyeok,
  hanjaToHangul,
} from '../utils/saju';

// Saju Calculation Tool for Gemini
export const calculateSajuForPerson = (args: any) => {
  try {
    const rawBirthDate = String(args?.birthDate || '').trim();
    const rawBirthTime = String(args?.birthTime || '').trim();
    const rawGender = String(args?.gender || '').trim().toUpperCase();
    const normalizedGender: 'M' | 'F' =
      rawGender === 'F' || rawGender === '여' || rawGender === '여성' ? 'F' : 'M';
    const normalizedUnknownTime = !!args?.unknownTime || !rawBirthTime;
    const normalizedBirthTime = normalizedUnknownTime ? '12:00' : rawBirthTime;
    const normalizedIsLunar = !!args?.isLunar;
    const normalizedIsLeap = !!args?.isLeap;
    const personName = String(args?.personName || '대상자');

    if (!rawBirthDate) {
      return {
        error:
          '생년월일이 누락되어 사주 계산을 진행할 수 없습니다. YYYY-MM-DD 형식으로 알려주세요.',
      };
    }

    const saju = getSajuData(
      rawBirthDate,
      normalizedBirthTime,
      normalizedIsLunar,
      normalizedIsLeap,
      normalizedUnknownTime,
    );
    const daeun = getDaeunData(
      rawBirthDate,
      normalizedBirthTime,
      normalizedIsLunar,
      normalizedIsLeap,
      normalizedGender,
      normalizedUnknownTime,
    );
    const yongshin = calculateYongshin(saju);
    const gyeok = calculateGyeok(saju);

    const sajuText = saju
      .map(
        (p) =>
          `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja}) - 십성: ${p.stem.deity}/${p.branch.deity}`,
      )
      .join('\n');
    const daeunText = daeun
      .map(
        (d) =>
          `${d.startAge}세 대운: ${d.stem.hangul}${d.branch.hangul} (${hanjaToHangul[d.stem]}${hanjaToHangul[d.branch]})`,
      )
      .join(', ');

    return {
      personName,
      saju: sajuText,
      daeun: daeunText,
      yongshin: `${yongshin.yongshin} (기운: ${yongshin.strength}, 점수: ${yongshin.score})`,
      gyeok: `${gyeok.gyeok} (구성: ${gyeok.composition})`,
    };
  } catch (e) {
    return {
      error:
        '사주 계산 중 오류가 발생했습니다. 날짜와 시간 형식을 확인해주세요. (예: 1990-01-01, 14:30)',
    };
  }
};

export const sajuToolDeclaration = {
  name: 'calculateSajuForPerson',
  parameters: {
    type: Type.OBJECT,
    description:
      '타인의 생년월일시 정보를 바탕으로 사주 팔자와 대운을 계산합니다. 궁합 분석이나 제3자(가족, 친구 등) 상담 시 반드시 이 도구를 사용하여 정확한 데이터를 얻어야 합니다.',
    properties: {
      birthDate: { type: Type.STRING, description: '생년월일 (YYYY-MM-DD 형식)' },
      birthTime: { type: Type.STRING, description: '생시 (HH:mm 형식, 모를 경우 생략 가능)' },
      isLunar: { type: Type.BOOLEAN, description: '음력 여부 (true: 음력, false: 양력)' },
      isLeap: { type: Type.BOOLEAN, description: '윤달 여부 (음력일 경우에만 해당)' },
      gender: { type: Type.STRING, description: "성별 ('M': 남성, 'F': 여성)" },
      personName: {
        type: Type.STRING,
        description: "대상자의 이름 또는 호칭 (예: '남자친구', '상대방', '어머니')",
      },
      unknownTime: { type: Type.BOOLEAN, description: '생시를 모르는지 여부' },
    },
    required: ['birthDate', 'isLunar', 'gender'],
  },
};

export interface ProxyGenerateContentParams {
  model: string;
  contents: any[];
  config?: {
    systemInstruction?: string;
    tools?: any[];
    temperature?: number;
    maxOutputTokens?: number;
    [key: string]: any;
  };
}

export interface ProxyGenerateContentResponse {
  text: string;
  functionCalls: any[] | undefined;
  candidates: any[];
}

export const proxyGenerateContent = async ({
  model,
  contents,
  config,
}: ProxyGenerateContentParams): Promise<ProxyGenerateContentResponse> => {
  const body: any = { model, contents };

  if (config?.systemInstruction) {
    body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
  }
  if (config?.tools) {
    body.tools = config.tools;
  }
  const generationConfig: any = {};
  if (config?.temperature !== undefined) generationConfig.temperature = config.temperature;
  if (config?.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = config.maxOutputTokens;
  // thinking 토큰 제어(예: gemini-2.5* thinkingBudget:0)로 지연·비용 절감.
  if (config?.thinkingConfig !== undefined) generationConfig.thinkingConfig = config.thinkingConfig;
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const res = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `Gemini API error ${res.status}`;
    const err = Object.assign(new Error(JSON.stringify({ error: errData?.error || { message: errMsg, code: res.status } })), {
      status: res.status,
      error: errData?.error,
    });
    throw err;
  }

  const data = await res.json();
  const parts: any[] = data.candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find((p: any) => typeof p.text === 'string');
  const fcParts = parts.filter((p: any) => p.functionCall);

  return {
    text: textPart?.text ?? '',
    functionCalls: fcParts.length > 0 ? fcParts.map((p: any) => p.functionCall) : undefined,
    candidates: data.candidates ?? [],
  };
};

export interface StreamGeminiContentParams {
  model: string;
  contents: any[];
  config?: {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    thinkingConfig?: any;
  };
  /** 누적 텍스트를 청크마다 전달(스트리밍 렌더용). */
  onText?: (accumulated: string) => void;
  signal?: AbortSignal;
}

/**
 * SSE 스트리밍 생성. /api/gemini/generate?stream=1 프록시가 Gemini streamGenerateContent(alt=sse)를
 * 그대로 파이프한다. proxyGenerateContent와 동일한 반환 형태({text, candidates})를 맞춰
 * 호출측(generateBasicReport)의 finishReason 처리를 재사용한다.
 */
export const streamGeminiContent = async ({
  model,
  contents,
  config,
  onText,
  signal,
}: StreamGeminiContentParams): Promise<ProxyGenerateContentResponse> => {
  const body: any = { model, contents };
  if (config?.systemInstruction) {
    body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
  }
  const generationConfig: any = {};
  if (config?.temperature !== undefined) generationConfig.temperature = config.temperature;
  if (config?.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = config.maxOutputTokens;
  if (config?.thinkingConfig !== undefined) generationConfig.thinkingConfig = config.thinkingConfig;
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const res = await fetch('/api/gemini/generate?stream=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const errData = await res.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `Gemini stream error ${res.status}`;
    throw Object.assign(new Error(JSON.stringify({ error: errData?.error || { message: errMsg, code: res.status } })), {
      status: res.status,
      error: errData?.error,
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let finishReason: string | undefined;

  const consumeEvent = (rawEvent: string) => {
    // 이벤트는 여러 줄일 수 있고 줄 끝이 \r\n일 수 있다 — \r 제거 후 data: 파싱.
    for (const line of rawEvent.split(/\r?\n/)) {
      const m = line.match(/^data:\s?(.*)$/);
      if (!m) continue;
      const payload = m[1];
      if (!payload || payload === '[DONE]') continue;
      try {
        const obj = JSON.parse(payload);
        const cand = obj.candidates?.[0];
        const partText: string = (cand?.content?.parts ?? [])
          .map((p: any) => (typeof p.text === 'string' ? p.text : ''))
          .join('');
        if (partText) {
          full += partText;
          onText?.(full);
        }
        if (cand?.finishReason) finishReason = cand.finishReason;
      } catch {
        /* 부분 JSON — 다음 청크에서 합쳐짐(버퍼 유지) */
      }
    }
  };

  // SSE 이벤트 구분자는 빈 줄(\n\n 또는 \r\n\r\n). 완결된 이벤트만 잘라 처리하고
  // 미완결 부분은 버퍼에 남겨 다음 청크와 합친다.
  const BOUNDARY = /\r?\n\r?\n/;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let m: RegExpExecArray | null;
    while ((m = BOUNDARY.exec(buffer)) !== null) {
      const rawEvent = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      consumeEvent(rawEvent);
    }
  }
  if (buffer.trim()) consumeEvent(buffer);

  return { text: full, functionCalls: undefined, candidates: [{ finishReason }] };
};

export const DEFAULT_GEMINI_MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
];

export const DEPRECATED_GEMINI_MODEL_REPLACEMENTS: Record<string, string> = {
  // gemini-1.5-flash는 v1beta에서 404 NOT_FOUND. 2.5-flash-lite로 대체.
  'gemini-1.5-flash': 'gemini-2.5-flash-lite',
  'models/gemini-1.5-flash': 'gemini-2.5-flash-lite',
};

export const normalizeModelName = (model: string) => {
  const trimmed = String(model || '').trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.replace(/^models\//i, '');
  const withoutAction = withoutPrefix.replace(/:generatecontent$/i, '');
  return withoutAction.toLowerCase();
};

export const toSafeModelName = (model: string) => {
  const normalized = normalizeModelName(model);
  if (!normalized) return '';
  return DEPRECATED_GEMINI_MODEL_REPLACEMENTS[normalized] || normalized;
};

export const getPreferredGeminiModels = (): string[] => {
  const fromWindow = String((window as any).GEMINI_MODEL_PRIORITY || '').trim();
  const fromVite = String((import.meta as any).env.VITE_GEMINI_MODEL_PRIORITY || '').trim();
  const fromProcess = String(
    (typeof process !== 'undefined' &&
      process.env &&
      process.env.GEMINI_MODEL_PRIORITY) ||
      '',
  ).trim();

  const raw = fromWindow || fromVite || fromProcess;
  const parsed = raw
    .split(',')
    .map((m) => toSafeModelName(m))
    .filter(Boolean);

  const baseCandidates = raw ? parsed : [];
  const deduped = Array.from(new Set([...baseCandidates, ...DEFAULT_GEMINI_MODEL_PRIORITY]));
  return deduped.length > 0 ? deduped : DEFAULT_GEMINI_MODEL_PRIORITY;
};
