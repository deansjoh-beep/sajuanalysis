import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import type { ParsedReportSection } from './reportSectionUtils';

interface AIReportSectionProps {
  section?: ParsedReportSection;
  loading?: boolean;
  /** 로딩 중 placeholder로 보여줄 라벨 (예: "사주 원국 해설을 작성하는 중...") */
  loadingLabel?: string;
  /** 호출 자체가 실패했을 때 표시할 메시지 */
  errorMessage?: string;
}

/**
 * 만세력 페이지에 끼워넣는 AI 기본 리포트 섹션 카드.
 * 한지·먹 톤. 로딩 시 스켈레톤, 에러 시 안내.
 */
export function AIReportSection({
  section,
  loading,
  loadingLabel,
  errorMessage,
}: AIReportSectionProps) {
  // 에러 상태
  if (errorMessage) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-3xl border border-seal/30 bg-paper-50/55 px-6 py-5 md:px-8 md:py-6"
        style={{
          boxShadow:
            '0 1px 0 rgba(184, 57, 46, 0.06), 0 8px 22px -10px rgba(58, 53, 48, 0.08)',
        }}
      >
        <p className="text-[14px] text-ink-700 leading-relaxed">
          {errorMessage}
        </p>
      </motion.section>
    );
  }

  // 로딩 상태 — 스켈레톤
  if (loading || !section) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-3xl border border-brush-gold/25 bg-gradient-to-br from-paper-50/70 to-paper-100/50 px-6 py-6 md:px-8 md:py-7"
        style={{
          boxShadow:
            '0 1px 0 rgba(168, 138, 74, 0.08), 0 8px 22px -10px rgba(58, 53, 48, 0.1)',
        }}
      >
        <p className="text-[14px] text-ink-700 font-medium mb-4">
          {loadingLabel ?? 'AI가 당신의 사주를 풀어내는 중입니다...'}
        </p>
        <div className="space-y-2">
          {[100, 92, 85, 78].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded-full bg-paper-100/70 animate-pulse"
              style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </motion.section>
    );
  }

  // 정상 상태
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-3xl border border-brush-gold/30 bg-gradient-to-br from-paper-50/75 to-paper-100/55 px-6 py-6 md:px-8 md:py-7 space-y-4"
      style={{
        boxShadow:
          '0 1px 0 rgba(168, 138, 74, 0.1), 0 10px 28px -12px rgba(58, 53, 48, 0.12)',
      }}
    >
      {section.keyword && (
        <p className="font-serif text-[15px] md:text-[18px] font-bold text-ink-900 leading-snug">
          {section.keyword}
        </p>
      )}

      <div className="prose-sm md:prose-base max-w-none text-ink-900 leading-[1.9] text-[14px] space-y-3">
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p className="text-ink-900 leading-[1.9]">{children}</p>
            ),
            strong: ({ children }) => (
              <strong className="text-ink-900 font-bold">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="text-seal not-italic font-bold">{children}</em>
            ),
            h1: ({ children }) => (
              <h4 className="font-serif text-[16px] md:text-[18px] font-bold text-ink-900 mt-4 mb-2">
                {children}
              </h4>
            ),
            h2: ({ children }) => (
              <h4 className="font-serif text-[15px] md:text-[17px] font-bold text-ink-900 mt-4 mb-2">
                {children}
              </h4>
            ),
            h3: ({ children }) => (
              <h5 className="font-serif text-[14px] md:text-[15px] font-bold text-ink-900 mt-3 mb-1.5">
                {children}
              </h5>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-5 space-y-1.5">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-5 space-y-1.5">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-ink-900 leading-[1.85]">{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-brush-gold/50 pl-4 my-3 text-ink-900 italic">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-seal underline underline-offset-2 hover:text-ink-900"
              >
                {children}
              </a>
            ),
          }}
        >
          {section.body}
        </ReactMarkdown>
      </div>
    </motion.section>
  );
}

/**
 * 모드 토글 (초급자/고급자) — 만세력 페이지 상단에 배치되는 작은 토글.
 */
interface ReportModeToggleProps {
  mode: 'basic' | 'advanced';
  onChange: (mode: 'basic' | 'advanced') => void;
  disabled?: boolean;
}

export function ReportModeToggle({ mode, onChange, disabled }: ReportModeToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full border border-ink-300/30 bg-paper-50/70">
      {(['basic', 'advanced'] as const).map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m)}
          className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
            mode === m
              ? 'bg-ink-900 text-paper-50 shadow-sm'
              : 'text-ink-700 hover:text-ink-900'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {m === 'basic' ? '초급자' : '고급자'}
        </button>
      ))}
    </div>
  );
}
