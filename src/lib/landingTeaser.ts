import { buildSajuAnalysis, type OhaengKey } from './analysis/schema';
import { getSajuData, calculateYongshin } from '../utils/saju';

/**
 * 랜딩 히어로 무료 사주 요약 티저 (사이트 개편).
 * - 규칙 기반 요약: buildSajuAnalysis + calculateYongshin — 즉시(0초)·무료·저장 없음.
 * - AI 코멘트: 기존 /api/gemini/generate 프록시 재사용(신규 api/ 파일 금지 — Vercel 12개 한도).
 * - PII 불변식: AI에는 파생 간지 컨텍스트만 전송 — 이름·생년월일 원문 미포함.
 */

export interface TeaserInput {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  /** 0~23. unknownTime이면 무시. */
  birthHour: string;
  calendarType: 'solar' | 'lunar' | 'leap';
  gender: 'M' | 'F';
  unknownTime: boolean;
}

export interface TeaserSummary {
  /** 명식 한 줄 — 예: "庚午년 辛巳월 乙酉일 辛巳시" (시간 미상이면 시주 생략) */
  myeongsikLine: string;
  /** 일간 — 예: "乙(을) · 목(木)" */
  dayMasterLine: string;
  /** 오행 분포 counts (차트용) */
  ohaeng: Record<OhaengKey, number>;
  /** 신강약 + 용신 한 줄 */
  strengthLine: string;
  /** 올해 세운 한 줄 */
  seunLine: string;
  /** AI 프롬프트용 파생 컨텍스트 — 이름·생년월일 원문 없음 */
  ganzhiContext: string;
}

const OHAENG_KO: Record<OhaengKey, string> = {
  wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)',
};

export function teaserInputToDateStrings(input: TeaserInput): { dateStr: string; timeStr: string; isLunar: boolean; isLeap: boolean } {
  const dateStr = `${input.birthYear}-${input.birthMonth.padStart(2, '0')}-${input.birthDay.padStart(2, '0')}`;
  const timeStr = input.unknownTime ? '12:00' : `${input.birthHour.padStart(2, '0')}:00`;
  return { dateStr, timeStr, isLunar: input.calendarType !== 'solar', isLeap: input.calendarType === 'leap' };
}

export function buildTeaserSummary(input: TeaserInput): TeaserSummary {
  const { dateStr, timeStr, isLunar, isLeap } = teaserInputToDateStrings(input);

  const analysis = buildSajuAnalysis({
    dateStr, timeStr, isLunar, isLeap,
    gender: input.gender,
    unknownTime: input.unknownTime,
  });

  const saju = getSajuData(dateStr, timeStr, isLunar, isLeap, input.unknownTime);
  const yongshin = calculateYongshin(saju);

  const POSITION_SUFFIX: Record<string, string> = { 년주: '년', 월주: '월', 일주: '일', 시주: '시' };
  const myeongsikLine = analysis.myeongsik
    .filter((p) => !(input.unknownTime && p.position === '시주'))
    .map((p) => `${p.ganzhi}${POSITION_SUFFIX[p.position] ?? ''}`)
    .join(' ');

  const dayMasterLine = `${analysis.dayMaster.hanja}(${analysis.dayMaster.hangul}) · ${OHAENG_KO[analysis.dayMaster.element]}`;

  const strengthLine = `일간의 힘은 '${yongshin.strength}' — ${yongshin.yongshin} 기운이 균형을 돕습니다.`;

  const seunLine = `${analysis.seun.sajuYear}년 ${analysis.seun.ganzhi} · ${analysis.seun.sipsin}운의 해`;

  const ohaengText = (Object.keys(analysis.ohaeng) as OhaengKey[])
    .filter((k) => analysis.ohaeng[k] > 0)
    .map((k) => `${OHAENG_KO[k]} ${analysis.ohaeng[k]}`)
    .join(', ');

  const ganzhiContext = [
    `명식: ${myeongsikLine}${input.unknownTime ? ' (시간 미상)' : ''}`,
    `일간: ${dayMasterLine}`,
    `오행 분포: ${ohaengText}`,
    `신강약: ${yongshin.strength}, 용신: ${yongshin.yongshin}`,
    `올해 세운: ${seunLine}`,
    `성별: ${input.gender === 'M' ? '남' : '여'}`,
  ].join('\n');

  return { myeongsikLine, dayMasterLine, ohaeng: analysis.ohaeng, strengthLine, seunLine, ganzhiContext };
}

// ─── AI 한 줄 풀이 ───────────────────────────────────────────────────────────

const TEASER_SYSTEM_PROMPT = [
  '당신은 정통 자평명리 상담가입니다. 아래 명식 요약을 보고 이 사람의 핵심 키메시지를 정확히 4~5줄로 요약해 주세요.',
  '',
  '[형식 — 반드시 지킬 것]',
  '- 각 줄은 "타고난 기질 — ..." 처럼 "주제 — 내용" 형태의 완결된 존댓말 한 문장.',
  '- 줄 주제는 다음에서 4~5개 선택: 타고난 기질 / 강점 / 주의할 점 / 올해의 흐름 / 관계·재물 중 두드러진 것.',
  '- 줄바꿈(\\n)으로만 구분. 머리기호·번호·마크다운·빈 줄 금지.',
  '- 마지막 줄은 올해의 흐름으로 끝내되, 자세한 시기별 흐름은 만세력과 리포트에서 볼 수 있다는 뉘앙스를 담으세요.',
  '',
  '[내용 원칙]',
  '- 단정적 예언·길흉 판정·공포 조장 금지. 가능성과 경향으로 말합니다.',
  '- 이름을 부르지 말고 "당신"이라고 지칭하세요.',
].join('\n');

/** flash 전용 폴백 체인 — 유료 리포트(2.5-pro)와 분리해 저비용·저지연 유지 */
const TEASER_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const TEASER_TIMEOUT_MS = 12_000;

/**
 * AI 2~3문장 코멘트. 실패·타임아웃 시 throw — 호출측은 조용히 생략(규칙 요약만 표시).
 */
export async function fetchTeaserComment(ganzhiContext: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEASER_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  try {
    let lastError: unknown = null;
    for (const model of TEASER_MODELS) {
      try {
        // 2.5 계열은 thinking이 기본 활성 — thinking 토큰이 maxOutputTokens를 잠식해
        // 본문이 중간에 잘리므로 비활성화한다(다른 모델은 필드 미지원 → 생략).
        const generationConfig: Record<string, unknown> = { temperature: 0.7, maxOutputTokens: 1024 };
        if (model.startsWith('gemini-2.5')) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }
        const res = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            systemInstruction: { parts: [{ text: TEASER_SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: ganzhiContext }] }],
            generationConfig,
          }),
        });
        if (!res.ok) {
          lastError = new Error(`teaser comment: ${model} HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text.trim()) return text.trim();
        lastError = new Error(`teaser comment: ${model} empty`);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        lastError = err;
      }
    }
    throw lastError ?? new Error('teaser comment: all models failed');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}
