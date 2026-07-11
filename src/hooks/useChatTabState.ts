import { useRef, useState } from 'react';
import type { SajuCardPayload } from '../lib/chatDataSelectors';

/** 상담창 하단 선택지 버튼 하나. scenarioId면 시나리오 진입, query면 자유질문 전송. */
export interface ChatOption {
  label: string;
  scenarioId?: string;
  query?: string;
}

/**
 * 챗 메시지 판별 유니언.
 * - kind 없음/'text': 기존 텍스트 말풍선(하위 호환 — 기존 `{role, text}`가 그대로 유효).
 * - 'card': 엔진 계산값을 렌더하는 결정론적 카드(LLM 미개입).
 * - 'options': 후속 선택지 버튼 묶음.
 */
export type ChatMessage =
  | { role: 'user' | 'model'; kind?: 'text'; text: string }
  | { role: 'model'; kind: 'card'; card: SajuCardPayload }
  | { role: 'model'; kind: 'options'; title?: string; options: ChatOption[] };

/** LLM 히스토리·관계호칭 처리에서 텍스트 메시지만 걸러내기 위한 가드. */
export const isTextMessage = (
  m: ChatMessage
): m is { role: 'user' | 'model'; kind?: 'text'; text: string } =>
  m.kind === undefined || m.kind === 'text';

export const useChatTabState = (initialBasicCategory: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [consultationMode, setConsultationMode] = useState<'basic' | 'advanced'>('basic');
  const [basicSelectedCategory, setBasicSelectedCategory] = useState<string>(initialBasicCategory);
  const [basicAskedByCategory, setBasicAskedByCategory] = useState<Record<string, string[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('재물/사업');
  const [refreshKey, setRefreshKey] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState<string | null>(null);

  const activeChatRequestIdRef = useRef(0);
  const consultationModeRef = useRef<'basic' | 'advanced'>('basic');
  const preservedChatContextRef = useRef<ChatMessage[]>([]);
  const modeNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);

  return {
    messages,
    setMessages,
    consultationMode,
    setConsultationMode,
    basicSelectedCategory,
    setBasicSelectedCategory,
    basicAskedByCategory,
    setBasicAskedByCategory,
    selectedCategory,
    setSelectedCategory,
    refreshKey,
    setRefreshKey,
    input,
    setInput,
    loading,
    setLoading,
    modeNotice,
    setModeNotice,
    isListening,
    setIsListening,
    voiceStatusMessage,
    setVoiceStatusMessage,
    activeChatRequestIdRef,
    consultationModeRef,
    preservedChatContextRef,
    modeNoticeTimerRef,
    recognitionRef
  };
};
