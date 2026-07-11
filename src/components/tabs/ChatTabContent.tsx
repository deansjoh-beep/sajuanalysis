import React, { useMemo } from 'react';
import { MessageCircle, RefreshCw, Mic, Send } from 'lucide-react';
import { ChatTab } from './ChatTab';
import { TAB_TRANSITION, GLASS_TAB_BG_CLASS } from '../../constants/styles';
import { BASIC_CHAT_CATEGORIES, CATEGORIES } from '../../constants/questions';
import { renderChatPlainText } from '../chat/renderChatPlainText';
import { SajuCard, ChatOptionsBlock, ChatGate } from '../chat/SajuCards';
import { buildMyeongsikCard } from '../../lib/chatDataSelectors';
import { CHAT_SCENARIOS } from '../../constants/chatScenarios';
import type { ChatMessage } from '../../hooks/useChatTabState';
import type { ChatCodeInfo } from '../../lib/chatCodeClient';
import { totalFollowupRemaining } from '../../lib/chatCodeClient';
import { FREE_DAILY_LIMIT } from '../../lib/chatUsage';

type SuggestionSource = 'static' | 'dynamic' | 'fallback' | null;

interface ChatTabContentProps {
  consultationMode: 'basic' | 'advanced';
  switchConsultationMode: (mode: 'basic' | 'advanced') => void;
  sajuResult: any[];
  yongshinResult: any | null;
  userName: string;
  messages: ChatMessage[];
  loading: boolean;
  modeNotice: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  // 자유질문 입력
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleSend: (overrideInput?: string) => void;
  handleSuggestionClick: (suggestion: string) => void;
  handleScenarioSelect: (scenarioId: string) => void;
  applyCode: (code: string) => Promise<boolean>;
  freeTurnsRemaining: number;
  activeCode: ChatCodeInfo | null;
  // 음성
  handleVoiceInput: () => void;
  isListening: boolean;
  voiceStatusMessage: string | null;
  // 주문 CTA
  setOrderProductType: (type: any) => void;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
  // 추천 질문(레거시 인라인)
  suggestions: string[];
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  suggestionsSource: SuggestionSource;
  showInlineSuggestions: boolean;
  setShowInlineSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  handleGenerateAiSuggestions: () => void | Promise<void>;
  aiSuggestionRequestCount: number;
  basicSelectedCategory: string;
  setBasicSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  selectedCategory: string;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
}

export const ChatTabContent: React.FC<ChatTabContentProps> = ({
  consultationMode,
  switchConsultationMode,
  sajuResult,
  yongshinResult,
  userName,
  messages,
  loading,
  modeNotice,
  scrollRef,
  input,
  setInput,
  handleSend,
  handleSuggestionClick,
  handleScenarioSelect,
  applyCode,
  freeTurnsRemaining,
  activeCode,
  handleVoiceInput,
  isListening,
  voiceStatusMessage,
  setOrderProductType,
  setActiveTab,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  suggestionsSource,
  showInlineSuggestions,
  setShowInlineSuggestions,
  setRefreshKey,
  handleGenerateAiSuggestions,
  aiSuggestionRequestCount,
  basicSelectedCategory,
  setBasicSelectedCategory,
  selectedCategory,
  setSelectedCategory,
}) => {
  const openingCard = useMemo(
    () => (sajuResult.length > 0 ? buildMyeongsikCard(sajuResult, yongshinResult) : null),
    [sajuResult, yongshinResult]
  );

  const onGoToOrder = () => {
    setOrderProductType('premium');
    setActiveTab('order');
  };

  return (
    <ChatTab tabTransition={TAB_TRANSITION} glassTabBgClass={GLASS_TAB_BG_CLASS}>
      <div className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative text-[13px]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-5 hide-scrollbar">
            {/* 상단 컨트롤 한 줄: 좌측 잔여 상태 + 우측 모드 토글 */}
            <div className="flex items-center justify-between gap-2 pb-1">
              <span className="text-[12px] text-ink-500">
                {activeCode
                  ? `코드 ${activeCode.code} · 후속 ${totalFollowupRemaining(activeCode)}회`
                  : `무료 상담 ${freeTurnsRemaining}/${FREE_DAILY_LIMIT}회`}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => switchConsultationMode('basic')}
                  className={`px-3 py-1 min-h-[36px] rounded-lg text-[13px] font-bold border ${consultationMode === 'basic' ? 'bg-ink-900 border-ink-900 text-paper-50' : 'bg-paper-50/75 border-ink-300/30 text-ink-700'}`}
                >
                  초급자
                </button>
                <button
                  onClick={() => switchConsultationMode('advanced')}
                  className={`px-3 py-1 min-h-[36px] rounded-lg text-[13px] font-bold border ${consultationMode === 'advanced' ? 'bg-ink-900 border-ink-900 text-paper-50' : 'bg-paper-50/75 border-ink-300/30 text-ink-700'}`}
                >
                  고급자
                </button>
              </div>
            </div>

            {modeNotice && (
              <div className="mx-auto max-w-3xl rounded-xl border border-brush-gold/30 bg-paper-100/60 px-4 py-2 text-center text-[14px] text-ink-700">
                {modeNotice}
              </div>
            )}

            {messages.length === 0 && (
              openingCard ? (
                <div className="flex flex-col items-start space-y-3">
                  <SajuCard card={openingCard} />
                  <p className="max-w-[96%] md:max-w-[92%] text-[14px] text-ink-600 px-1 leading-relaxed">
                    {userName ? `${userName}님, ` : ''}무엇이 궁금하세요? 아래에서 골라보시거나 직접 물어보셔도 좋아요.
                  </p>
                  <ChatOptionsBlock
                    options={CHAT_SCENARIOS.map((s) => ({ label: s.label, scenarioId: s.id }))}
                    disabled={loading}
                    onSelectScenario={handleScenarioSelect}
                    onSelectQuery={handleSuggestionClick}
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <MessageCircle className="w-14 h-14" />
                  <p>
                    {consultationMode === 'basic'
                      ? '무엇이 궁금하신가요?\n아래 추천 질문을 선택하거나 음성/직접 입력해 주세요.'
                      : '궁금한 점을 물어보세요.\n당신의 사주를 기반으로 답변해 드립니다.'}
                  </p>
                </div>
              )
            )}

            {messages.map((msg, i) => {
              if (msg.kind === 'card') {
                return (
                  <div key={i} className="flex flex-col items-start">
                    <SajuCard card={msg.card} />
                  </div>
                );
              }
              if (msg.kind === 'options') {
                return (
                  <div key={i} className="flex flex-col items-start">
                    <ChatOptionsBlock
                      title={msg.title}
                      options={msg.options}
                      disabled={loading}
                      onSelectScenario={handleScenarioSelect}
                      onSelectQuery={handleSuggestionClick}
                    />
                  </div>
                );
              }
              if (msg.kind === 'gate') {
                return (
                  <div key={i} className="flex flex-col items-start">
                    <ChatGate
                      gate={msg.gate}
                      disabled={loading}
                      onGoToOrder={onGoToOrder}
                      onApplyCode={applyCode}
                    />
                  </div>
                );
              }
              return (
                <div key={i} className={`space-y-2 ${msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
                  <div className={`max-w-[96%] md:max-w-[92%] p-4 md:p-5 rounded-2xl leading-relaxed shadow-sm text-[14px] ${
                    msg.role === 'user'
                      ? 'bg-ink-900 text-paper-50 rounded-tr-none'
                      : 'bg-paper-50/80 border border-ink-300/30 text-ink-800 rounded-tl-none'
                  }`}>
                    {renderChatPlainText(msg.text)}
                  </div>

                  {msg.role === 'model' && i === messages.length - 1 && !loading && (suggestionsLoading || suggestionsError || suggestions.length > 0) && (
                    <div className="w-full max-w-[96%] md:max-w-[92%]">
                      <button
                        onClick={() => setShowInlineSuggestions((prev) => !prev)}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-ink-300/30 bg-paper-50/60 text-ink-600 hover:text-ink-900 text-[13px] font-semibold"
                      >
                        {showInlineSuggestions ? '추천 질문 접기' : suggestionsLoading ? '추천 질문 생성 중...' : '추천 질문 보기'}
                      </button>

                      {showInlineSuggestions && (
                        <div className="mt-2 p-3 rounded-2xl border bg-paper-100/60 border-ink-300/25">
                          <div className="mb-2 px-2 text-[12px] text-ink-500 flex items-center justify-between gap-2">
                            <span>
                              {suggestionsLoading
                                ? '질문을 생성하고 있습니다...'
                                : suggestionsSource === 'static'
                                  ? '기본 추천 질문'
                                : suggestionsSource === 'dynamic'
                                  ? 'AI 맞춤 추천'
                                  : suggestionsSource === 'fallback'
                                    ? '기본 추천(비상 모드)'
                                    : '추천 준비 중'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {!suggestionsLoading && (
                                <button
                                  onClick={() => setRefreshKey((prev) => prev + 1)}
                                  className="rounded-md px-2 py-1 text-ink-600 hover:text-ink-900"
                                  title="기본 추천 질문 새로고침"
                                >
                                  기본 새로고침
                                </button>
                              )}
                              <button
                                onClick={() => { void handleGenerateAiSuggestions(); }}
                                disabled={suggestionsLoading || aiSuggestionRequestCount >= 2}
                                className="rounded-md px-2 py-1 text-ink-700 border border-ink-300/40 bg-paper-50/70 hover:bg-paper-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="AI 추천 질문 생성"
                              >
                                AI 생성 ({Math.max(0, 2 - aiSuggestionRequestCount)}회 남음)
                              </button>
                            </div>
                          </div>

                          {suggestionsError && (
                            <div className="mb-2 px-2 py-1.5 rounded-lg bg-amber-100/70 border border-amber-200 text-[11px] text-amber-800">
                              {suggestionsError}
                            </div>
                          )}

                          <div className="grid grid-cols-[3fr_7fr] gap-3">
                            <div className="space-y-1 pr-1">
                              {(consultationMode === 'basic' ? BASIC_CHAT_CATEGORIES : CATEGORIES).map((cat) => (
                                <button
                                  key={`inline-basic-category-${cat}`}
                                  onClick={() => {
                                    if (consultationMode === 'basic') {
                                      setBasicSelectedCategory(cat);
                                    } else {
                                      setSelectedCategory(cat);
                                    }
                                  }}
                                  className={`w-full text-center px-1 py-0.5 min-h-[28px] rounded-md text-[12px] leading-tight transition-all border bg-transparent ${
                                    (consultationMode === 'basic' ? basicSelectedCategory : selectedCategory) === cat
                                      ? 'text-ink-900 font-bold border-ink-700/50'
                                      : 'text-ink-500 border-ink-300/40 hover:border-ink-500/50 hover:text-ink-700'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                              <div className="w-full min-h-[32px] rounded-md border-0 bg-transparent text-ink-500 flex items-center justify-center">
                                <RefreshCw className={`w-4 h-4 ${suggestionsLoading ? 'animate-spin' : ''}`} />
                              </div>
                            </div>

                            <div className="space-y-1.5 pl-1">
                              {!suggestionsLoading && suggestions.map((s, idx) => (
                                <button
                                  key={`inline-chat-suggestion-${idx}`}
                                  onClick={() => handleSuggestionClick(s)}
                                  className="w-full text-right px-3 py-1.5 min-h-[32px] rounded-lg border-0 bg-transparent transition-all text-ink-700 hover:text-ink-900"
                                >
                                  {s}
                                </button>
                              ))}
                              {!suggestionsLoading && suggestions.length === 0 && (
                                <div className="px-3 py-1.5 text-[13px] text-zinc-500">추천 질문을 준비 중입니다. 잠시만 기다려 주세요.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="flex items-center gap-3 px-5 py-2.5 rounded-full w-fit border bg-paper-50/80 border-ink-300/30">
                <RefreshCw className="w-5 h-5 animate-spin text-brush-gold" />
                <span className="text-[14px] text-ink-500">유아이가 분석 중입니다...</span>
              </div>
            )}

          </div>

          {/* Input Area */}
          <div className="p-2 border-t md:pb-4 border-ink-300/25 bg-paper-50/70">

            <div className="max-w-4xl mx-auto relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={consultationMode === 'basic' ? '음성 또는 직접 입력으로 질문해 주세요...' : '메시지를 입력하세요...'}
                className="w-full border rounded-2xl py-3 pl-4 pr-24 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brush-gold/40 transition-all shadow-sm bg-paper-50/80 border-ink-300/35 text-ink-900 placeholder:text-ink-400"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleVoiceInput}
                    className={`p-2 min-h-[44px] min-w-[44px] rounded-xl active:scale-90 transition-transform ${isListening ? 'bg-seal text-paper-50' : 'bg-paper-50/80 border border-ink-300/35 text-ink-700'}`}
                    title="음성 입력"
                  >
                    <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                  </button>
                  <button onClick={() => handleSend()} className="p-2 min-h-[44px] min-w-[44px] bg-ink-900 rounded-xl text-paper-50 hover:bg-ink-700 active:scale-90 transition-all">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            {voiceStatusMessage && (
              <p className="max-w-4xl mx-auto mt-1 text-[13px] text-rose-600">
                {voiceStatusMessage}
              </p>
            )}

            {/* Mobile-only Privacy Notice */}
            <div className="md:hidden mt-1">
              <div className="pt-1 border-t border-ink-300/25">
                <p className="text-[12px] text-ink-500 text-center leading-tight">
                  상담 정보는 상담 종료 시 자동 파기됩니다.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </ChatTab>
  );
};
