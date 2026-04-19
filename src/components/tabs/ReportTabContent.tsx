import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Calendar, ChevronDown, Compass, Download, FileText, Ticket } from 'lucide-react';
import { useReportTabActions } from '../../hooks/useReportTabActions';
import { ReportTab } from './ReportTab';

interface ReportTabContentProps {
  tabTransition: any;
  glassTabBgClass: string;
  glassPanelStrongClass: string;
  loading: boolean;
  sajuResultLength: number;
  reportContent: string | null;
  isPrinting: boolean;
  userName: string;
  consultationMode: 'basic' | 'advanced';
  consultationModeRef: React.MutableRefObject<'basic' | 'advanced'>;
  setIsPrinting: React.Dispatch<React.SetStateAction<boolean>>;
  setConsultationMode: React.Dispatch<React.SetStateAction<'basic' | 'advanced'>>;
  setReportContent: React.Dispatch<React.SetStateAction<string | null>>;
  handleGenerateReport: () => void;
  onGoToOrder?: () => void;
  onGoToYearlyOrder?: () => void;
}

interface ParsedReportSection {
  title: string;
  keyword: string;
  body: string;
}

const extractReportSections = (content: string): ParsedReportSection[] => {
  if (!content) return [];

  const parts = content.split(/\[SECTION\]/).filter((part) => part.trim());
  return parts.map((part) => {
    const match = part.match(/^(.*?)\s*\[KEYWORD\]\s*(.*?)\s*\[CONTENT\]\s*([\s\S]*)$/);
    if (!match) {
      return {
        title: '상세 분석',
        keyword: '',
        body: part.replace(/\[KEYWORD\]|\[CONTENT\]|\[END\]/g, '').trim()
      };
    }

    return {
      title: match[1].trim(),
      keyword: match[2].trim(),
      body: match[3].replace(/\[END\]/g, '').trim()
    };
  });
};

const ReportAccordion: React.FC<{ content: string; forceOpen?: boolean }> = ({ content, forceOpen }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const { greeting, sections } = useMemo(() => {
    if (!content) return { greeting: '', sections: [] };

    try {
      const firstSectionIndex = content.indexOf('[SECTION]');
      let greetingText = '';
      let sectionsPart = content;

      if (firstSectionIndex !== -1) {
        greetingText = content.substring(0, firstSectionIndex).replace(/\[인사말\]/g, '').trim();
        sectionsPart = content.substring(firstSectionIndex);
      } else {
        greetingText = content.replace(/\[인사말\]/g, '').trim();
        sectionsPart = '';
      }

      const parsedSections = extractReportSections(sectionsPart).map((section) => ({
        header: section.keyword ? `${section.title} : ${section.keyword}` : section.title,
        body: section.body
      }));

      return { greeting: greetingText, sections: parsedSections };
    } catch (err) {
      console.error('[ERROR] Failed to parse report content:', err);
      return { greeting: '', sections: [] };
    }
  }, [content]);

  if (sections.length === 0) {
    return (
      <div className="markdown-body prose max-w-none text-[13px] p-4">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {greeting && (
        <div className="p-6 md:p-8 rounded-[2.5rem] bg-indigo-50 text-indigo-950 border-indigo-100 font-report text-[13px] leading-relaxed mb-8 shadow-sm border">
          <ReactMarkdown>{greeting}</ReactMarkdown>
        </div>
      )}
      {sections.map((section, index) => {
        const isOpen = forceOpen || openIndex === index;
        return (
          <div
            key={index}
            className="rounded-2xl border transition-all overflow-hidden bg-white border-black/5 shadow-sm"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-5 py-4 flex items-center justify-between text-left group"
            >
              <div className="flex-1 pr-4">
                <h3 className="text-[16px] font-report font-bold leading-tight transition-colors text-zinc-800 group-hover:text-indigo-600">
                  {section.header}
                </h3>
              </div>
              {!forceOpen && (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isOpen ? 'bg-indigo-500 text-white rotate-180 shadow-lg shadow-indigo-500/20' : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              )}
            </button>

            <AnimatePresence initial={!forceOpen}>
              {isOpen && (
                <motion.div
                  initial={forceOpen ? { opacity: 1, height: 'auto' } : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <div className="px-5 pb-5 pt-0 text-[13px] leading-relaxed text-zinc-700">
                    <div className="w-full h-px bg-black/5 mb-4" />
                    <div className="report-markdown markdown-body prose max-w-none">
                      <ReactMarkdown>{section.body}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export const ReportTabContent: React.FC<ReportTabContentProps> = ({
  tabTransition,
  glassTabBgClass,
  glassPanelStrongClass,
  loading,
  sajuResultLength,
  reportContent,
  isPrinting,
  userName,
  consultationMode,
  consultationModeRef,
  setIsPrinting,
  setConsultationMode,
  setReportContent,
  handleGenerateReport,
  onGoToOrder,
  onGoToYearlyOrder,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const { switchReportMode, handleDownloadPDF } = useReportTabActions({
    reportRef,
    reportContent,
    isPrinting,
    userName,
    consultationModeRef,
    setIsPrinting,
    setConsultationMode,
    setReportContent
  });

  return (
    <ReportTab tabTransition={tabTransition} glassTabBgClass={glassTabBgClass}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
        <div className="absolute -left-10 top-8 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-indigo-300/25 blur-3xl" />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto pb-20">
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/60 backdrop-blur border border-white/65 shadow-lg shadow-indigo-200/20 w-fit">
            <button
              onClick={() => switchReportMode('basic')}
              disabled={loading}
              className={`px-5 py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 ${
                consultationMode === 'basic'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              초급자
            </button>
            <button
              onClick={() => switchReportMode('advanced')}
              disabled={loading}
              className={`px-5 py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 ${
                consultationMode === 'advanced'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              고급자
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/65 bg-white/60 backdrop-blur p-3 shadow-lg shadow-indigo-200/20">
              <p className="text-[11px] font-bold text-zinc-500 mb-2">표준 리포트</p>
              <button
                onClick={handleGenerateReport}
                disabled={loading || sajuResultLength === 0}
                className="w-full px-4 py-2 min-h-[44px] rounded-xl text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/20"
              >
                리포트 생성하기
              </button>
            </div>

            <div className="rounded-2xl border border-white/65 bg-white/60 backdrop-blur p-3 shadow-lg shadow-violet-200/20">
              <p className="text-[11px] font-bold text-zinc-500 mb-2">전문가 제작 리포트</p>
              <button
                onClick={onGoToOrder}
                disabled={!onGoToOrder}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl text-[11px] font-bold bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-40"
              >
                <Ticket className="w-3.5 h-3.5" />
                프리미엄 주문
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleDownloadPDF}
              disabled={loading || isPrinting || !reportContent}
              className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-[11px] font-bold bg-white/65 backdrop-blur border border-white/60 text-zinc-600 hover:bg-indigo-100/50 hover:text-indigo-600 transition-all disabled:opacity-40"
            >
              <Download className={`w-4 h-4 ${isPrinting ? 'animate-bounce' : ''}`} />
              PDF 저장
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 space-y-6 border border-white/60 bg-white/55 backdrop-blur-2xl rounded-[3rem] shadow-2xl shadow-indigo-200/20"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Compass className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-[16px] font-bold animate-pulse">운명의 지도를 그리는 중...</p>
                <p className="text-[11px] text-zinc-500">AI 디렉터가 당신의 사주 로그를 정밀 분석하고 있습니다.</p>
              </div>
            </motion.div>
          ) : reportContent ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
              ref={reportRef}
            >
              <div className={`${glassPanelStrongClass} rounded-[3rem] p-8 md:p-12`}>
                <ReportAccordion content={reportContent} forceOpen={isPrinting} />
              </div>
              <div className="mt-10 pt-6 border-t border-white/60">
                <p className="text-[11px] text-zinc-500 leading-relaxed text-center">
                  본 리포트는 인공지능의 명리학적 해석이며, 과학적 사실이 아닙니다. 참고 용도로만 사용해 주시기 바라며, 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
                </p>
              </div>

              {/* 프리미엄 일년운세 2026 CTA — 결과 맨 아래 */}
              {onGoToYearlyOrder && (
                <div className="mt-8 rounded-[2rem] border border-amber-200/70 bg-gradient-to-br from-amber-50 via-rose-50 to-indigo-50 p-6 md:p-8 shadow-lg shadow-amber-200/20">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shrink-0 shadow-md mt-0.5">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center min-h-[28px]">
                        <h4 className="text-[16px] font-bold leading-tight text-zinc-900">프리미엄 일년운세 2026</h4>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-relaxed">사주 원국 · 대운 · 2026 세운 · 월별까지 통합한 10페이지 맞춤 리포트 · 5,000원</p>
                    </div>
                  </div>
                  <ul className="text-[11px] text-zinc-700 space-y-1 mb-4 pl-1">
                    <li>• 가장 알고 싶은 것과 가장 큰 고민에 먼저 직답</li>
                    <li>• 2026년 한 해 종합운 + 12개월 상세 흐름</li>
                    <li>• 실행 가능한 연간 체크리스트까지</li>
                  </ul>
                  <button
                    onClick={onGoToYearlyOrder}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-[13px] font-bold bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white hover:opacity-90 transition-all shadow-lg shadow-rose-500/20"
                  >
                    <Calendar className="w-4 h-4" />
                    프리미엄 일년운세 2026 주문하기
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-32 space-y-8 border border-white/60 bg-white/55 backdrop-blur-2xl rounded-[3rem] shadow-2xl shadow-indigo-200/20"
            >
              <div className="w-24 h-24 rounded-full bg-indigo-500/5 flex items-center justify-center mx-auto border border-indigo-500/10">
                <FileText className="w-10 h-10 text-indigo-500/30" />
              </div>
              <div className="space-y-4">
                <h3 className="text-[16px] font-title font-bold">운세 리포트가 아직 없습니다.</h3>
                <p className="text-[13px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  먼저 모드를 선택한 뒤
                  <br />
                  상단의 "리포트 생성하기" 버튼을 눌러 생성해 주세요.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ReportTab>
  );
};
