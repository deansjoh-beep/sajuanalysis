import { useEffect } from 'react';
import { ChatMessage } from './useChatTabState';

interface UseChatTabActionsParams {
  isListening: boolean;
  loading: boolean;
  messages: ChatMessage[];
  consultationMode: 'basic' | 'advanced';
  basicSelectedCategory: string;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  setBasicAskedByCategory: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setConsultationMode: React.Dispatch<React.SetStateAction<'basic' | 'advanced'>>;
  setModeNotice: React.Dispatch<React.SetStateAction<string | null>>;
  setIsListening: React.Dispatch<React.SetStateAction<boolean>>;
  setVoiceStatusMessage: React.Dispatch<React.SetStateAction<string | null>>;
  activeChatRequestIdRef: React.MutableRefObject<number>;
  consultationModeRef: React.MutableRefObject<'basic' | 'advanced'>;
  preservedChatContextRef: React.MutableRefObject<ChatMessage[]>;
  modeNoticeTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  recognitionRef: React.MutableRefObject<any>;
  handleSend: (overrideInput?: string) => Promise<void>;
}

export const useChatTabActions = ({
  isListening,
  loading,
  messages,
  consultationMode,
  basicSelectedCategory,
  setLoading,
  setMessages,
  setInput,
  setRefreshKey,
  setBasicAskedByCategory,
  setConsultationMode,
  setModeNotice,
  setIsListening,
  setVoiceStatusMessage,
  activeChatRequestIdRef,
  consultationModeRef,
  preservedChatContextRef,
  modeNoticeTimerRef,
  recognitionRef,
  handleSend
}: UseChatTabActionsParams) => {
  useEffect(() => {
    return () => {
      if (modeNoticeTimerRef.current) {
        clearTimeout(modeNoticeTimerRef.current);
      }
    };
  }, [modeNoticeTimerRef]);

  const showTransientNotice = (message: string) => {
    setModeNotice(message);

    if (modeNoticeTimerRef.current) {
      clearTimeout(modeNoticeTimerRef.current);
    }

    modeNoticeTimerRef.current = setTimeout(() => {
      setModeNotice(null);
    }, 2500);
  };

  const refreshSuggestionsAfterChatClear = (resetBasicAsked: boolean) => {
    if (consultationModeRef.current === 'basic') {
      if (resetBasicAsked) {
        setBasicAskedByCategory({});
      }
      return;
    }

    setRefreshKey((prev) => prev + 1);
  };

  const clearChatWindowOnly = () => {
    if (loading) {
      activeChatRequestIdRef.current += 1;
      setLoading(false);
    }

    if (messages.length > 0) {
      preservedChatContextRef.current = [...preservedChatContextRef.current, ...messages];
    }

    setMessages([]);
    setInput('');
    refreshSuggestionsAfterChatClear(false);
    showTransientNotice('채팅창을 비웠습니다. 이전 상담 맥락은 유지됩니다.');
  };

  const clearChatWindowAndContext = () => {
    if (loading) {
      activeChatRequestIdRef.current += 1;
      setLoading(false);
    }

    preservedChatContextRef.current = [];
    setMessages([]);
    setInput('');
    refreshSuggestionsAfterChatClear(true);
    showTransientNotice('채팅창과 상담 맥락을 모두 초기화했습니다.');
  };

  const switchConsultationMode = (mode: 'basic' | 'advanced') => {
    if (mode === consultationMode) return;

    if (loading) {
      activeChatRequestIdRef.current += 1;
      setLoading(false);
    }

    if (mode === 'basic') {
      setBasicAskedByCategory((prev) => ({
        ...prev,
        [basicSelectedCategory]: prev[basicSelectedCategory] || []
      }));
    } else {
      setRefreshKey((prev) => prev + 1);
    }

    setConsultationMode(mode);
    showTransientNotice(`상담 모드가 ${mode === 'basic' ? '초급자' : '고급자'}로 변경되었습니다. 다음 질문부터 바로 적용됩니다.`);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleVoiceInput = () => {
    setVoiceStatusMessage(null);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      setVoiceStatusMessage('음성 입력은 HTTPS 또는 localhost 환경에서만 동작합니다.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatusMessage('현재 브라우저는 음성 입력(Web Speech API)을 지원하지 않습니다.');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onstart = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
    }

    if (loading) {
      setVoiceStatusMessage('답변 생성 중에는 음성 입력을 시작할 수 없습니다.');
      return;
    }

    if (isListening && recognitionRef.current) {
      // Toggle stop when already listening.
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatusMessage('듣고 있습니다... 말씀해 주세요.');
    };

    recognition.onend = () => {
      setIsListening(false);
      setVoiceStatusMessage(null);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      const code = event?.error;
      const mapped =
        code === 'not-allowed'
          ? '마이크 권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 마이크를 허용해 주세요.'
          : code === 'no-speech'
            ? '음성이 감지되지 않았습니다. 다시 시도해 주세요.'
            : code === 'network'
              ? '음성 인식 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
              : `음성 입력 오류가 발생했습니다(${code || 'unknown'}).`;
      setVoiceStatusMessage(mapped);
      recognitionRef.current = null;
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const current = event.results[i];
        const text = current?.[0]?.transcript || '';
        if (current.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      const merged = (finalTranscript || interimTranscript).trim();
      if (merged) {
        setInput(merged);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceStatusMessage('음성 입력을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      recognitionRef.current = null;
    }
  };

  return {
    showTransientNotice,
    clearChatWindowOnly,
    clearChatWindowAndContext,
    switchConsultationMode,
    handleSuggestionClick,
    handleVoiceInput
  };
};
