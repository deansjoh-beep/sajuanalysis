/**
 * 만세력 페이지에 통합되는 AI 기본 리포트의 섹션 파싱 유틸.
 * report-common.ts의 [SECTION] 형식을 분해해 6 섹션 구조 + 인사말로 분리.
 */

export interface ParsedReportSection {
  /** 1-based 인덱스 (1~6) — 만세력 매핑 키 */
  index: number;
  /** 섹션 헤더 (예: "SECTION 1: 사주 원국 분석") */
  title: string;
  /** 섹션 키워드 (한 줄 요약) */
  keyword: string;
  /** 섹션 본문 (마크다운) */
  body: string;
}

export interface ParsedReport {
  /** 인사말 (있으면) */
  greeting: string;
  /** 6개 섹션 */
  sections: ParsedReportSection[];
}

/**
 * AI가 반환한 리포트 텍스트를 인사말 + 섹션 배열로 파싱.
 */
export function parseReport(content: string | null | undefined): ParsedReport {
  if (!content) return { greeting: '', sections: [] };

  const firstSectionIdx = content.indexOf('[SECTION]');
  let greeting = '';
  let sectionsPart = content;

  if (firstSectionIdx !== -1) {
    greeting = content.substring(0, firstSectionIdx).replace(/\[인사말\]/g, '').trim();
    sectionsPart = content.substring(firstSectionIdx);
  } else {
    greeting = content.replace(/\[인사말\]/g, '').trim();
    sectionsPart = '';
  }

  const parts = sectionsPart.split(/\[SECTION\]/).filter((p) => p.trim());
  const sections = parts.map((part, i) => {
    const match = part.match(/^(.*?)\s*\[KEYWORD\]\s*(.*?)\s*\[CONTENT\]\s*([\s\S]*)$/);
    if (!match) {
      return {
        index: i + 1,
        title: '상세 분석',
        keyword: '',
        body: part.replace(/\[KEYWORD\]|\[CONTENT\]|\[END\]/g, '').trim(),
      };
    }
    return {
      index: i + 1,
      title: match[1].trim(),
      keyword: match[2].trim(),
      body: match[3].replace(/\[END\]/g, '').trim(),
    };
  });

  return { greeting, sections };
}

/**
 * 1~6 인덱스로 섹션을 빠르게 찾기.
 */
export function getSectionByIndex(
  parsed: ParsedReport,
  index: number,
): ParsedReportSection | undefined {
  return parsed.sections.find((s) => s.index === index);
}
