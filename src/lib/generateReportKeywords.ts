/**
 * 랜딩 기본 운세 리포트 — 1단계(키워드) 생성.
 *
 * 아코디언 헤더용 6개 섹션 키워드만 저렴·빠르게 만든다(flash 전용, 작은 출력). 본문은
 * 사용자가 처음 섹션을 펼칠 때 generateBasicReport로 별도 생성한다(2단계 지연 생성).
 * 이렇게 하면 둘러보고 이탈하는 다수 방문자는 이 작은 호출 비용만 지불한다.
 *
 * PII 불변식: 파생 간지 컨텍스트(ganzhiContext)만 전송 — 이름·생년월일 원문 미포함.
 */

/** parseReport 섹션 인덱스(1~6)와 정렬되는 섹션 라벨 — 아코디언 헤더 보조 표기용. */
export const REPORT_SECTION_LABELS = [
  '사주 원국',
  '대운·세운',
  '생애 주기',
  '오행 밸런스',
  '용신·개운',
  '테마별 분석',
] as const;

const KEYWORDS_SYSTEM_PROMPT = [
  '당신은 정통 자평명리 상담가입니다. 아래 명식 요약을 보고, 종합 운세 리포트 6개 섹션 각각의',
  "'핵심 키워드 한 줄'을 만들어 주세요. 키워드는 그 섹션 내용을 압축한 매력적인 제목입니다.",
  '',
  '[섹션 순서 — 반드시 이 순서]',
  '1. 사주 원국 — 타고난 기질과 성격',
  '2. 대운·세운 — 지금 지나는 큰 흐름',
  '3. 생애 주기 — 시기별 운의 흐름',
  '4. 오행 밸런스 — 균형과 실생활 코칭',
  '5. 용신·개운 — 삶의 지혜',
  '6. 테마별 — 재물·직업·연애·건강',
  '',
  '[형식 — 반드시 지킬 것]',
  '- 정확히 6줄. 각 줄은 "N. 키워드" 형식(N은 1~6, 순서대로).',
  '- 키워드는 15자 내외의 완결된 한글 명사구. 존댓말·문장·마침표·따옴표·머리기호 금지.',
  '- 키워드 안에 섹션 이름/번호(예: "사주 원국:", "테마별:")를 반복해 넣지 마세요. 내용만.',
  '- 단정적 길흉 판정이나 공포 조장 금지. 경향과 가능성으로 표현합니다.',
].join('\n');

/** flash 전용 폴백 체인 — 저비용·저지연 유지(유료 리포트와 분리). */
const KEYWORD_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const KEYWORD_TIMEOUT_MS = 12_000;

/**
 * 키워드 앞에 붙은 섹션 라벨 접두를 제거(예: "사주 원국: 열정…" → "열정…").
 * 콜론 앞 조각이 해당 섹션 라벨과 일치할 때만 제거해 문체상 콜론은 보존한다.
 */
function stripLabelPrefix(keyword: string, idx: number): string {
  const colon = keyword.search(/[:：]/);
  if (colon <= 0 || colon > 8) return keyword;
  const norm = (s: string) => s.replace(/[\s·]/g, '');
  const prefix = norm(keyword.slice(0, colon));
  const label = norm(REPORT_SECTION_LABELS[idx] ?? '');
  if (!prefix || !label) return keyword;
  const looksLikeLabel =
    label.includes(prefix) || prefix.includes(label) || prefix.startsWith(label.slice(0, 2));
  return looksLikeLabel ? keyword.slice(colon + 1).trim() : keyword;
}

/** "1. 키워드" 형식 6줄을 인덱스 0~5 배열로 파싱. 6개 모두 있어야 성공. */
export function parseKeywordLines(text: string): string[] | null {
  const found: Record<number, string> = {};
  for (const raw of text.split('\n')) {
    const m = raw.trim().match(/^([1-6])[.)]\s*(.+?)\s*$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (!found[idx]) {
        found[idx] = stripLabelPrefix(m[2].replace(/^["'\-–—•\s]+|["'\s]+$/g, '').trim(), idx);
      }
    }
  }
  const result: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (!found[i]) return null;
    result.push(found[i]);
  }
  return result;
}

/**
 * 6개 섹션 키워드 생성. 실패·타임아웃 시 throw(호출측이 에러 표시 + 재시도 유도).
 */
export async function generateReportKeywords(
  ganzhiContext: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KEYWORD_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  try {
    let lastError: unknown = null;
    for (const model of KEYWORD_MODELS) {
      try {
        // 2.5 계열은 thinking이 기본 활성 — thinking 토큰이 출력을 잠식하므로 비활성화.
        const generationConfig: Record<string, unknown> = { temperature: 0.7, maxOutputTokens: 512 };
        if (model.startsWith('gemini-2.5')) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }
        const res = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            systemInstruction: { parts: [{ text: KEYWORDS_SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: ganzhiContext }] }],
            generationConfig,
          }),
        });
        if (!res.ok) {
          lastError = new Error(`report keywords: ${model} HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const parsed = parseKeywordLines(text);
        if (parsed) return parsed;
        lastError = new Error(`report keywords: ${model} parse failed`);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        lastError = err;
      }
    }
    throw lastError ?? new Error('report keywords: all models failed');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}
