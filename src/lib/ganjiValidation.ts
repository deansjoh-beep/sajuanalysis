/**
 * 간지 후처리 검증.
 *
 * LLM 답변이 "20XX년 … <간지>년" 형태로 세운 간지를 언급할 때, 엔진이 계산한
 * 실제 연주 간지와 일치하는지 검사한다. 불일치 시 정정 재생성(1회)의 근거가 된다.
 *
 * 정밀도 우선 설계: "연도(4자리) 뒤에 나오는 간지"만 검사한다. 연도에 앵커되지 않은
 * 간지 언급은 애매하므로 검사하지 않아 오탐(불필요한 재생성)을 최소화한다.
 */
const CHEONGAN = new Set([
  '갑', '을', '병', '정', '무', '기', '경', '신', '임', '계',
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
]);
const JIJI = new Set([
  '자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해',
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
]);

/** 창(window) 안에서 첫 간지(천간+지지 2글자) 토큰을 찾는다. 없으면 null. */
export function extractGanjiToken(window: string): string | null {
  for (let i = 0; i < window.length - 1; i++) {
    if (CHEONGAN.has(window[i]) && JIJI.has(window[i + 1])) {
      return window[i] + window[i + 1];
    }
  }
  return null;
}

export interface YearGanji {
  hangul: string;
  hanja: string;
}

export interface GanjiMismatch {
  year: number;
  found: string;
  expectedHangul: string;
  expectedHanja: string;
}

/** nearbyYearPillars → { [year]: {hangul, hanja} } 맵. */
export function buildYearGanjiMap(
  pillars: Array<{ year: number; yearPillarHangul: string; yearPillarHanja: string }>
): Record<number, YearGanji> {
  const map: Record<number, YearGanji> = {};
  for (const p of pillars) {
    map[p.year] = { hangul: p.yearPillarHangul, hanja: p.yearPillarHanja };
  }
  return map;
}

const WINDOW_AFTER_YEAR = 20;

/**
 * 텍스트에서 "연도 + 간지" 언급을 찾아 엔진 값과 대조한다.
 * 맵에 없는 연도, 또는 간지 언급이 없는 연도는 검사에서 제외한다.
 */
export function findYearGanjiMismatches(
  text: string,
  yearGanjiMap: Record<number, YearGanji>
): GanjiMismatch[] {
  const mismatches: GanjiMismatch[] = [];
  const seen = new Set<number>();
  const re = /(\d{4})\s*년/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const year = parseInt(m[1], 10);
    const expected = yearGanjiMap[year];
    if (!expected || seen.has(year)) continue;
    const start = m.index + m[0].length;
    const window = text.slice(start, start + WINDOW_AFTER_YEAR);
    const found = extractGanjiToken(window);
    if (!found) continue; // 간지 언급 없음 → 검사 대상 아님
    seen.add(year);
    if (found !== expected.hangul && found !== expected.hanja) {
      mismatches.push({ year, found, expectedHangul: expected.hangul, expectedHanja: expected.hanja });
    }
  }
  return mismatches;
}

/** 정정 재생성에 붙일 지시문. 검출된 오류 연도의 정답 간지를 명시한다. */
export function buildGanjiCorrection(mismatches: GanjiMismatch[]): string {
  const lines = mismatches
    .map((mm) => `  ${mm.year}년: ${mm.expectedHangul}(${mm.expectedHanja})`)
    .join('\n');
  return `\n\n[정정 지시 — 최우선] 직전 답변에서 세운 간지를 잘못 표기했습니다. 아래 연도의 간지를 반드시 이 값으로만 표기해 다시 답하세요(임의 계산 금지):\n${lines}`;
}
