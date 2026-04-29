import type { ReactNode } from 'react';

interface InsightPanelProps {
  /** "이건 무엇인가요" 일반 설명 (정적 교육 텍스트) */
  general: string;
  /** "당신의 경우" 사용자 데이터 기반 해석 (선택) */
  personal?: string | ReactNode;
  /** 톤 (기본은 한지 옅은 베이지) */
  tone?: 'paper' | 'highlight';
}

/**
 * 만세력 페이지 각 섹션 헤더 아래에 들어가는 설명 패널.
 * - 첫 단락: 정적 일반 설명 (이 섹션이 사주에서 무엇을 의미하는가)
 * - 둘째 단락: 사용자 데이터 기반 해석 — 라벨 없이 단순 단락 분리만
 */
export function InsightPanel({ general, personal, tone = 'paper' }: InsightPanelProps) {
  const bg =
    tone === 'highlight'
      ? 'bg-gradient-to-br from-paper-50/80 to-paper-100/60 border-brush-gold/30'
      : 'bg-paper-50/55 border-ink-300/25';

  return (
    <div
      className={`rounded-2xl border ${bg} px-5 py-4 md:px-6 md:py-5 space-y-3`}
    >
      <p className="text-[14px] leading-[1.85] text-ink-700">
        {general}
      </p>
      {personal && (
        <div className="pt-3 border-t border-ink-300/20">
          {typeof personal === 'string' ? (
            <p className="text-[14px] leading-[1.85] text-ink-900 font-medium">
              {personal}
            </p>
          ) : (
            personal
          )}
        </div>
      )}
    </div>
  );
}
