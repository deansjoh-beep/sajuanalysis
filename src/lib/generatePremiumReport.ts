import { getSajuData, calculateYongshin } from "../utils/saju";
import { toLegacyYongshin } from './analysis/gyeokyongshin';
import { assemblePremiumReportPrompt, evaluatePremiumReportQuality } from './premiumReportCore';
import { claudeGenerateContent } from './claudeClient';
import { estimateCostKrw, type CallUsage } from './modelPricing';
import { ReportInputData, ReportSection } from "./premiumOrderStore";

// ─────────────────────────────────────────────────────────────────────────────
// 인생 네비게이션 리포트 생성
// (프롬프트 조립·섹션 파싱·품질 평가는 premiumReportCore.ts — 벤치 하네스와 공유)
// ─────────────────────────────────────────────────────────────────────────────

export const generateLifeNavReport = async (
  inputData: ReportInputData,
  signal?: AbortSignal
): Promise<{
  sections: ReportSection[];
  saju: any;
  daeun: any;
  yongshin: any;
  /** 저장·재파싱용 원문(마커 보존). parseLifeNavSections로 sections를 복원할 수 있다. */
  content: string;
  /** 품질 점수(0–100). save-report의 qualityScore로 사용. */
  qualityScore: number;
  /** 추정 생성 원가(₩, 정수) — 보정 재생성·실패 과금분 포함. 사용량 미수집 시 null. */
  generationCostKrw: number | null;
}> => {
  // 1. 프롬프트 조립 — SajuAnalysis 단일 소스(코어 모듈, 벤치 하네스와 동일 경로).
  const { system, user, analysis } = assemblePremiumReportPrompt(inputData);

  // 미리보기 UI(PremiumReportPreview)는 아직 레거시 saju 배열 형태를 소비하므로 반환용으로만 유지.
  const saju = getSajuData(
    inputData.birthDate,
    inputData.birthTime,
    inputData.isLunar,
    inputData.isLeap,
    inputData.unknownTime,
    'Asia/Seoul'
  );

  const daeun = analysis.daeun;
  const yongshin = analysis.gyeokYongshin
    ? toLegacyYongshin(analysis.gyeokYongshin)
    : calculateYongshin(saju);

  // 2. AI 호출 — Claude Sonnet 5 우선, 실패 시 Gemini 폴백 체인(2.5-pro → 2.5-flash → 2.0-flash → 1.5-flash).
  //    (OWNER 결정 2026-07-05: 유료 장문 리포트는 Claude 우선 + Gemini Pro 백업)
  const PREMIUM_CLAUDE_MODEL = 'claude-sonnet-5';
  const FALLBACK_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  // 원가 집계 — 성공/빈응답 등 과금된 호출의 토큰 사용량을 전부 모은다(보정 재생성 포함).
  const usages: CallUsage[] = [];

  const callGeminiWithFallback = async (
    systemText: string,
    userText: string,
    generationConfig: any,
  ): Promise<string> => {
    let lastError: any = null;
    for (const model of FALLBACK_MODELS) {
      try {
        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
              model,
              systemInstruction: { parts: [{ text: systemText }] },
              contents: [{ role: 'user', parts: [{ text: userText }] }],
              generationConfig,
            }),
          });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          const errMessage = error?.error?.message || 'Unknown error';
          const errCode = error?.error?.code;
          const errStatus = String(error?.error?.status || '').toUpperCase();
          const isTransient =
            response.status === 503 ||
            response.status === 429 ||
            errCode === 503 ||
            errCode === 429 ||
            errStatus === 'UNAVAILABLE' ||
            errStatus === 'RESOURCE_EXHAUSTED';
          const isModelUnavailable = response.status === 404 || errCode === 404 || errStatus === 'NOT_FOUND';
          if (isTransient || isModelUnavailable) {
            console.warn(`[MODEL_FALLBACK] generatePremiumReport: ${model} failed (${response.status} ${errStatus}) — trying next model.`);
            lastError = new Error(`Gemini API error (${model}): ${errMessage}`);
            continue;
          }
          throw new Error(`Gemini API error: ${errMessage}`);
        }

        const data = await response.json();
        if (data?.usageMetadata) {
          usages.push({
            model,
            inputTokens: Number(data.usageMetadata.promptTokenCount ?? 0),
            outputTokens: Number(data.usageMetadata.candidatesTokenCount ?? 0),
          });
        }
        const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!text) {
          console.warn(`[MODEL_FALLBACK] generatePremiumReport: ${model} returned empty — trying next model.`);
          lastError = new Error(`Gemini API returned empty text on ${model}`);
          continue;
        }
        if (model !== FALLBACK_MODELS[0]) {
          console.info(`[MODEL_FALLBACK] generatePremiumReport: succeeded on fallback ${model}`);
        }
        return text;
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        lastError = err;
        console.warn(`[MODEL_FALLBACK] generatePremiumReport: ${model} threw — trying next model.`, err?.message || err);
      }
    }
    throw lastError || new Error('모든 Gemini 모델이 응답하지 않았습니다. 잠시 후 다시 시도해주세요.');
  };

  // Claude 우선 → Gemini 폴백. geminiConfig는 Gemini 폴백 시에만 사용된다
  // (Sonnet 5는 비기본 temperature 등 샘플링 파라미터를 400으로 거부하므로 생략).
  const callWithModelChain = async (
    systemText: string,
    userText: string,
    geminiConfig: any,
  ): Promise<string> => {
    try {
      const { text, usage } = await claudeGenerateContent({
        model: PREMIUM_CLAUDE_MODEL,
        systemInstruction: systemText,
        userMessage: userText,
        maxTokens: 32000,
        // 장문 생성: 프록시 서버측 SSE 조립(헤더 타임아웃 회피) + thinking 비활성
        // (생성 시간을 Vercel 함수 한도 내로 단축 — Sonnet 5는 disabled 허용).
        stream: true,
        thinking: { type: 'disabled' },
        signal,
      });
      if (usage) usages.push(usage); // 빈 응답이어도 과금은 발생 — 폴백 전에 집계.
      if (text) return text;
      console.warn(`[MODEL_FALLBACK] generatePremiumReport: ${PREMIUM_CLAUDE_MODEL} returned empty — falling back to Gemini.`);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      console.warn(`[MODEL_FALLBACK] generatePremiumReport: ${PREMIUM_CLAUDE_MODEL} failed — falling back to Gemini.`, err?.message || err);
    }
    return callGeminiWithFallback(systemText, userText, geminiConfig);
  };

  // system은 코어 모듈이 SAJU_GUIDELINE 포함 완성본으로 반환한다.
  const rawText = await callWithModelChain(
    system,
    user,
    { maxOutputTokens: 32768, temperature: 0.5, topP: 0.9 }
  );

  let quality = evaluatePremiumReportQuality(inputData.productType, rawText, inputData.lifeEvents, daeun.length);

  // 품질 점수가 낮으면 1회 보정 생성 시도
  if (quality.score < 80) {
    const repairInstruction = [
      '[품질 보정 모드 - 최우선]',
      '- 아래 누락/불충분 항목을 반드시 모두 보완하세요.',
      '- 기존 텍스트를 요약하지 말고, 동일 Output Format을 유지한 완전한 본문을 다시 작성하세요.',
      '- 특히 [SECTION] 마커, [DAEUN_START]/[DAEUN_END], [FIELD_직업]~[/FIELD_연애], [ACTION_PLAN] 형식을 정확히 지키세요.',
      '',
      '[보완 필요 항목]',
      ...quality.issues.map((issue) => `- ${issue}`),
    ].join('\n');

    try {
      const repairedRawText = await callWithModelChain(
        `${system}\n\n${repairInstruction}`,
        user,
        { maxOutputTokens: 32768, temperature: 0.3, topP: 0.85 }
      );
      const repairedQuality = evaluatePremiumReportQuality(inputData.productType, repairedRawText, inputData.lifeEvents, daeun.length);
      if (repairedQuality.score >= quality.score) {
        quality = repairedQuality;
      }
    } catch (repairErr: any) {
      // 보정 실패는 치명적이지 않으므로 원본 결과로 진행
      console.warn('[generatePremiumReport] quality repair failed, using original:', repairErr?.message || repairErr);
    }
  }

  // 3. 섹션 파싱
  const sections = quality.sections;

  // 파싱 실패 시 단일 섹션으로 fallback
  if (sections.length === 0) {
    sections.push({
      id: 'raw',
      title: '인생 네비게이션 분석',
      summary: '',
      content: quality.normalizedText,
    });
  }

  const generationCostKrw = usages.length > 0 ? Math.round(estimateCostKrw(usages)) : null;

  return { sections, saju, daeun, yongshin, content: quality.normalizedText, qualityScore: quality.score, generationCostKrw };
};

