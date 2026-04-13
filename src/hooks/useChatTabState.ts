import { useRef, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

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
