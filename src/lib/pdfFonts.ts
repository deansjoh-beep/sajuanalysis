/**
 * PDF 생성용 한글 웹폰트 정의 — PDF용 HTML을 만드는 모든 곳과 서버(generate-pdf) 주입이 공유한다.
 *
 * 배경 (2026-07-31 실측으로 확인한 프로덕션 장애):
 * - 서버리스 Chromium(@sparticuz/chromium-min) 컨테이너에는 **한글 시스템 폰트가 하나도 없다**.
 *   문서가 'Batang'·'Malgun Gothic' 같은 OS 폰트만 지정하면 전부 해석에 실패하고,
 *   컨테이너에 유일하게 있는 Open Sans로 떨어져 한글·한자가 통째로 두부 글자(□)로 나간다.
 *   로컬 개발은 Windows 시스템 폰트가 있어 멀쩡하므로 이 결함이 프로덕션에서만 드러났다.
 *   → PDF용 HTML은 반드시 한글 웹폰트를 **스스로** 실어야 한다(서버 주입에 기대지 말 것).
 *
 * ⚠️ Noto **SC**(간체) 계열에는 한글 글리프가 없다. 한자 폴백이라고 SC를 넣으면
 *    한자만 살고 한글이 전부 깨진다. 한글·한자를 모두 담은 Noto **KR** 계열을 쓸 것.
 *
 * ⚠️ Google Fonts URL에 `;`로 굵기를 여러 개 묶으면(`wght@400;700`) 서버리스 Chromium에서
 *    폰트가 **적용되지 않는다**(응답 자체는 200이지만 PDF에 임베드되지 않음 — 재현 확인).
 *    굵기마다 <link>를 따로 둘 것. buildFontLinkTags가 이 규칙을 강제한다.
 */

const GOOGLE_FONTS_CSS2 = 'https://fonts.googleapis.com/css2';

/** 굵기 하나짜리 Google Fonts URL을 만든다(`;` 사용 금지 — 위 주석 참고). */
function fontCssUrl(family: string, weight: number): string {
  return `${GOOGLE_FONTS_CSS2}?family=${family.replace(/ /g, '+')}:wght@${weight}&display=block`;
}

/** 본문용 명조 — 한글 + 한자(간지·십성) 모두 커버한다. */
export const PDF_SERIF_FONT_URLS = [
  fontCssUrl('Noto Serif KR', 400),
  fontCssUrl('Noto Serif KR', 700),
];

/** 표·달력용 고딕. */
export const PDF_SANS_FONT_URLS = [
  fontCssUrl('Noto Sans KR', 400),
  fontCssUrl('Noto Sans KR', 700),
];

export const PDF_ALL_FONT_URLS = [...PDF_SERIF_FONT_URLS, ...PDF_SANS_FONT_URLS];

/** URL 목록을 <link> 태그 문자열로. */
export function buildFontLinkTags(urls: readonly string[]): string {
  return urls.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');
}

/** 명조 계열 PDF HTML의 <head>에 넣을 폰트 링크. */
export const PDF_SERIF_FONT_LINKS = buildFontLinkTags(PDF_SERIF_FONT_URLS);

/** 고딕 계열 PDF HTML의 <head>에 넣을 폰트 링크. */
export const PDF_SANS_FONT_LINKS = buildFontLinkTags(PDF_SANS_FONT_URLS);

/**
 * font-family 스택. 웹폰트를 맨 앞에 둔다 — OS 폰트를 앞세우면 로컬에서만 그 폰트가 잡혀
 * 프로덕션과 결과가 달라지고, 컨테이너에서는 어차피 해석되지 않는다.
 */
export const PDF_SERIF_STACK = `'Noto Serif KR', 'Batang', serif`;
export const PDF_SANS_STACK = `'Noto Sans KR', 'Malgun Gothic', sans-serif`;
