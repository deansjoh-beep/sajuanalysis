import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AIReportSection } from '../manse/AIReportSection';
import { REPORT_SECTION_LABELS } from '../../lib/generateReportKeywords';
import type { ParsedReport } from '../manse/reportSectionUtils';

/**
 * 랜딩 기본 운세 리포트 아코디언.
 *
 * 헤더는 1단계에서 받은 키워드만 표시(빠름·저렴). 사용자가 아무 섹션이나 처음 펼치면
 * onFirstExpand로 본문 전체(2단계)를 한 번 생성한다 — 둘러보고 이탈하는 방문자는 본문
 * 생성 비용을 아예 지불하지 않는다. 본문 카드는 만세력과 동일한 백색 AIReportSection.
 */

interface ReportAccordionProps {
  /** 1단계 키워드 6개(헤더). */
  keywords: string[];
  /** 2단계 본문. 아직 생성 전이면 null. */
  report: ParsedReport | null;
  /** 2단계 생성 진행 중. */
  reportLoading: boolean;
  /** 2단계 생성 실패 메시지. */
  reportError: string | null;
  /** 첫 펼침 시 본문 생성을 시작(캐시됨 — 재호출은 호출측에서 무시). */
  onFirstExpand: () => void;
}

export function ReportAccordion({
  keywords,
  report,
  reportLoading,
  reportError,
  onFirstExpand,
}: ReportAccordionProps) {
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    const willOpen = !openSet.has(i);
    // 펼칠 때 + 본문이 아직 없고 진행 중도 아니면 생성 시작(에러 뒤 재클릭 = 재시도).
    if (willOpen && !report && !reportLoading) onFirstExpand();
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {keywords.map((keyword, i) => {
        const open = openSet.has(i);
        const section = report?.sections[i];
        return (
          <div
            key={i}
            className="rounded-2xl border border-ink-300/30 bg-paper-50/70 overflow-hidden"
          >
            <button
              onClick={() => toggle(i)}
              aria-expanded={open}
              className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left hover:bg-paper-100/50 transition-colors"
            >
              <span className="text-[12px] text-ink-500 w-[68px] shrink-0">
                {REPORT_SECTION_LABELS[i]}
              </span>
              <span className="flex-1 text-[14px] font-bold text-ink-900 leading-snug">
                {keyword}
              </span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>

            {open && (
              <div className="px-2 pb-2">
                {section ? (
                  // 헤더에 이미 키워드가 있으므로 본문 카드에서는 키워드를 숨긴다.
                  <AIReportSection section={{ ...section, keyword: '' }} />
                ) : reportError ? (
                  <div className="rounded-2xl border border-ink-300/30 bg-paper-50/80 px-4 py-4 space-y-3">
                    <p className="text-[14px] text-ink-700 leading-relaxed">{reportError}</p>
                    <button
                      onClick={onFirstExpand}
                      className="min-h-[40px] px-4 rounded-xl text-[13px] font-bold bg-ink-900 text-paper-50 hover:bg-ink-700 transition-all"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : (
                  <AIReportSection loading loadingLabel="해설을 작성하고 있습니다..." />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
