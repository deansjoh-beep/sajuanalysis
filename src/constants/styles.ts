export const TAEKIL_SECTION_CARD_CLASS = 'rounded-3xl border border-white/60 p-4 md:p-6 bg-white/50 backdrop-blur-xl shadow-xl shadow-indigo-200/20';
export const TAEKIL_Q_BADGE_CLASS = 'text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600';
export const TAEKIL_LABEL_CLASS = 'text-[11px] font-bold text-zinc-600';
export const TAEKIL_HELP_TEXT_CLASS = 'mt-1 text-[11px] text-zinc-600';
export const TAEKIL_FIELD_CLASS = 'w-full min-h-[44px] rounded-2xl border border-white/65 px-4 py-3 text-[13px] outline-none bg-white/70 backdrop-blur text-zinc-900 transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200/70';
export const TAEKIL_FIELD_PLACEHOLDER_CLASS = `${TAEKIL_FIELD_CLASS} placeholder:text-zinc-500`;
export const GLASS_TAB_BG_CLASS = 'bg-gradient-to-br from-slate-100 via-cyan-50/60 to-indigo-100/70';
export const GLASS_PANEL_CLASS = 'border border-white/60 bg-white/55 backdrop-blur-xl shadow-xl shadow-indigo-200/20';
export const GLASS_PANEL_STRONG_CLASS = 'border border-white/60 bg-white/60 backdrop-blur-2xl shadow-2xl shadow-indigo-200/25';
export const TAB_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

/**
 * 3단계 텍스트 크기 토큰
 * - TEXT_TITLE:   제목 16px
 * - TEXT_BODY:    본문 13px
 * - TEXT_CAPTION: 주석·공지 11px
 * (예외: 홈화면 메인 헤드라인, PDF 리포트 표지 대형 타이틀은 별도)
 */
export const TEXT_TITLE = 'text-[16px] leading-tight font-bold';
export const TEXT_BODY = 'text-[13px] leading-relaxed';
export const TEXT_CAPTION = 'text-[11px] leading-snug';

/**
 * 카드 헤더 — 아이콘(혹은 배지) + 제목을 가로 배치하고
 * 카드들의 제목행 높이가 동일하게 정렬되도록 min-h로 기준선을 고정합니다.
 */
export const CARD_HEADER_ROW = 'flex items-center gap-2 min-h-[28px]';
export const CARD_HEADER_ICON = 'shrink-0 inline-flex items-center justify-center';
export const CARD_HEADER_TITLE = 'text-[16px] font-bold leading-tight text-zinc-900';
