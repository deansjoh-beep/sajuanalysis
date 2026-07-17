import { REPORT_GUIDELINE, BASIC_REPORT_GUIDELINE, ADVANCED_REPORT_GUIDELINE } from '../constants/guidelines';
import { getCurrentYearPillarKST, getCurrentMonthPillarKST } from './seoulDateGanji';
import { buildReportSystemInstruction } from './promptBuilders';
import { recordModelTelemetry } from './modelTelemetry';
import { waitForModelCooldownIfNeeded, recordRetryableModelFailure, recordModelRequestSuccess } from './modelCooldown';
import { parseModelErrorPayload, isRetryableModelError, isModelSelectionError, runWithModelRetry } from './modelUtils';
import { getClaudeApiKey, claudeGenerateContent, DEFAULT_CLAUDE_MODELS } from './claudeClient';
import { proxyGenerateContent, streamGeminiContent } from './geminiClient';
import { hanjaToHangul, calculateDeity, getSipseung, getGongmangSummary, getHapChungSummary, getShinsalSummary, getOriginalSipseungSummary } from '../utils/saju';
import { selectCoreHook, type CoreHook } from './hookEngine';

/**
 * AI 기본 리포트(만세력 페이지에 통합되는 [SECTION] 형식 장문) 생성 코어.
 *
 * 만세력 자동 생성(useReportGenerationAction)과 랜딩 히어로 무료 요약(HeroSajuTeaser)이
 * 공유한다. React 상태에 의존하지 않는 순수 async — 컨텍스트 조립 + 모델 폴백(제미나이 →
 * 클로드)만 담당하고, 최종 텍스트와 잘림 여부를 반환한다. 실패 시 throw(호출측이 처리).
 */

export interface GenerateBasicReportParams {
  sajuResult: any[];
  daeunResult: any[];
  yongshinResult: any | null;
  gyeokResult: any | null;
  birthYear: string;
  userName: string;
  mode: 'basic' | 'advanced';
  preferredModels: string[];
  /**
   * 지정하면 Gemini 스트리밍(SSE)으로 생성하며 누적 텍스트를 청크마다 전달한다.
   * 미지정 시 기존 단발 생성. Claude 폴백은 스트리밍 미지원(전체 반환).
   */
  onProgress?: (accumulated: string) => void;
}

/** gemini-2.5 계열은 thinking이 기본 ON — 지연·비용 절감 위해 리포트 생성에선 끈다. */
const noThinkingConfig = (model: string) =>
  model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {};

export interface GenerateBasicReportResult {
  /** 생성된 리포트 텍스트([SECTION] 형식). */
  text: string;
  /** finishReason이 MAX_TOKENS라 출력이 잘렸는지. */
  truncated: boolean;
  /** 엔진이 선정한 핵심 훅 (프롬프트에 회수 규칙으로 주입됨). 판정 불가 시 null. */
  coreHook: CoreHook | null;
}

export async function generateBasicReport(
  params: GenerateBasicReportParams,
): Promise<GenerateBasicReportResult> {
  const { sajuResult, daeunResult, yongshinResult, gyeokResult, birthYear, userName, mode, preferredModels, onProgress } = params;

  if (sajuResult.length === 0) {
    throw new Error('사주 데이터가 없습니다.');
  }

  const waitedMs = await waitForModelCooldownIfNeeded('report');
  if (waitedMs > 0) {
    console.warn(`[MODEL_COOLDOWN] report request delayed ${waitedMs}ms due to recent retryable errors.`);
  }

  const currentYearPillar = getCurrentYearPillarKST();
  const seunStem = currentYearPillar.yearPillarHanja.charAt(0);
  const seunBranch = currentYearPillar.yearPillarHanja.charAt(1);
  const dayMasterHanja = sajuResult.length >= 2 ? sajuResult[1].stem.hanja : '';
  const seunSipseong = dayMasterHanja ? (calculateDeity(dayMasterHanja, seunStem) ?? '') : '';
  const seunBranchSipseong = dayMasterHanja ? (calculateDeity(dayMasterHanja, seunBranch, true) ?? '') : '';
  const seunSipseung = dayMasterHanja ? getSipseung(dayMasterHanja, seunBranch) : '';

  // 월운 산출
  const currentMonthPillar = getCurrentMonthPillarKST();
  const wolunStem = currentMonthPillar.monthPillarHanja.charAt(0);
  const wolunBranch = currentMonthPillar.monthPillarHanja.charAt(1);
  const wolunSipseong = dayMasterHanja ? (calculateDeity(dayMasterHanja, wolunStem) ?? '') : '';
  const wolunBranchSipseong = dayMasterHanja ? (calculateDeity(dayMasterHanja, wolunBranch, true) ?? '') : '';
  const wolunSipseung = dayMasterHanja ? getSipseung(dayMasterHanja, wolunBranch) : '';

  // 합·충·공망·신살·원국운성
  const hapChungStr = sajuResult.length >= 2 ? getHapChungSummary(sajuResult) : '';
  const dayStemHanja = sajuResult.length >= 2 ? sajuResult[1].stem.hanja : '';
  const dayBranchHanja = sajuResult.length >= 2 ? sajuResult[1].branch.hanja : '';
  const gongmangStr = (dayStemHanja && dayBranchHanja && dayBranchHanja !== '?')
    ? getGongmangSummary(dayStemHanja, dayBranchHanja, sajuResult)
    : '';
  const shinsalStr = getShinsalSummary(sajuResult);
  const originalSipseungStr = dayMasterHanja ? getOriginalSipseungSummary(dayMasterHanja, sajuResult) : '';

  const sajuContext = [
    ...sajuResult.map((p) => `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja}) - 십성: ${p.stem.deity}/${p.branch.deity}`),
    yongshinResult
      ? `용신: ${yongshinResult.yongshin} | 일간강약: ${yongshinResult.strength}(${yongshinResult.score}점) | 억부용신: ${yongshinResult.eokbuYongshin} | 조후용신: ${yongshinResult.johooYongshin}`
      : null,
    gyeokResult
      ? `격국: ${gyeokResult.gyeok} | 구성: ${gyeokResult.composition}`
      : null,
    dayMasterHanja
      ? `세운(${currentYearPillar.year}): ${currentYearPillar.yearPillarHangul} | 천간십성: ${seunSipseong} | 지지십성: ${seunBranchSipseong} | 지지운성: ${seunSipseung}`
      : null,
    dayMasterHanja
      ? `월운(${currentMonthPillar.year}-${String(currentMonthPillar.month).padStart(2, '0')}): ${currentMonthPillar.monthPillarHangul} | 천간십성: ${wolunSipseong} | 지지십성: ${wolunBranchSipseong} | 지지운성: ${wolunSipseung}`
      : null,
    hapChungStr || null,
    gongmangStr ? `공망: ${gongmangStr}` : null,
    shinsalStr ? `신살: ${shinsalStr}` : null,
    originalSipseungStr ? `원국운성: ${originalSipseungStr}` : null,
  ].filter(Boolean).join('\n');

  const birthYearInt = parseInt(birthYear, 10);
  const currentYear = new Date().getFullYear();
  const currentAge = isNaN(birthYearInt) ? 0 : currentYear - birthYearInt; // 만 나이 기준

  const daeunContext = daeunResult
    .map((dy, i) => {
      const isCurrent = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i + 1].startAge);
      const stemHangul = hanjaToHangul[dy.stem] || dy.stem;
      const branchHangul = hanjaToHangul[dy.branch] || dy.branch;
      const stemDeity = dayMasterHanja ? (calculateDeity(dayMasterHanja, dy.stem) ?? '') : '';
      const branchDeity = dayMasterHanja ? (calculateDeity(dayMasterHanja, dy.branch, true) ?? '') : '';
      return `${dy.startAge}세~${daeunResult[i + 1]?.startAge || dy.startAge + 9}세: ${stemHangul}${branchHangul}(천간:${stemDeity}/지지:${branchDeity})${isCurrent ? ' (현재 대운)' : ''}`;
    })
    .join('\n');

  // 핵심 훅 — 엔진이 결정론적으로 선정. 실패해도 리포트 생성은 계속한다.
  let coreHook: CoreHook | null = null;
  try {
    coreHook = selectCoreHook({ sajuResult, daeunResult, yongshinResult, currentAge });
  } catch (e) {
    console.warn('[HOOK] selectCoreHook failed:', e);
  }

  const modeGuideline = mode === 'basic' ? BASIC_REPORT_GUIDELINE : ADVANCED_REPORT_GUIDELINE;
  const reportGuideline = `${REPORT_GUIDELINE}\n\n${modeGuideline}`;
  const baseSystemInstruction = buildReportSystemInstruction({
    currentDateText: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
    currentYearPillar,
    reportGuideline,
    userName,
    sajuContext,
    daeunContext,
    currentAge,
    coreHook,
  });

  const modelCandidates = preferredModels.length > 0
    ? preferredModels
    : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  const telemetryRequestId = `report-${Date.now()}`;
  const USER_PROMPT = '나의 사주 정보와 대운 흐름을 바탕으로 종합 운세 리포트를 작성해줘. 반드시 정해진 [SECTION] 형식을 지켜야 해.';

  let result: any = null;
  let lastError: any = null;

  for (const model of modelCandidates) {
    const startedAt = Date.now();
    try {
      // 503(서버 과부하) 발생 시 즉시 다음 모델로 이동.
      // 마지막 모델은 최후 보루로 2회 재시도(이후 Claude 폴백).
      const isLastModel = model === modelCandidates[modelCandidates.length - 1];
      const maxAttempts = isLastModel ? 2 : 1;
      const genConfig = {
        systemInstruction: baseSystemInstruction,
        maxOutputTokens: 16384,
        temperature: 0.8,
        ...noThinkingConfig(model),
      };
      result = await runWithModelRetry(
        () => onProgress
          ? streamGeminiContent({
              model,
              contents: [{ role: 'user', parts: [{ text: USER_PROMPT }] }],
              config: genConfig,
              onText: onProgress,
            })
          : proxyGenerateContent({
              model,
              contents: [{ role: 'user', parts: [{ text: USER_PROMPT }] }],
              config: genConfig,
            }),
        maxAttempts,
      );
      recordModelTelemetry({
        feature: 'report',
        phase: 'success',
        model,
        requestId: telemetryRequestId,
        durationMs: Date.now() - startedAt,
      });
      recordModelRequestSuccess('report');
      break;
    } catch (err: any) {
      lastError = err;
      const payload = parseModelErrorPayload(err);
      const retryable = isRetryableModelError(err);
      const modelSelectionError = isModelSelectionError(err);
      recordModelTelemetry({
        feature: 'report',
        phase: 'failure',
        model,
        requestId: telemetryRequestId,
        durationMs: Date.now() - startedAt,
        errorCode: payload.code,
        errorStatus: payload.status,
      });
      if (!retryable && !modelSelectionError) {
        throw err;
      }
      const cooldownMs = retryable ? recordRetryableModelFailure('report') : 0;
      recordModelTelemetry({
        feature: 'report',
        phase: 'fallback',
        model,
        requestId: telemetryRequestId,
        errorCode: payload.code,
        errorStatus: payload.status,
      });
      if (cooldownMs > 0) {
        console.warn(`[MODEL_COOLDOWN] report cooldown armed for ${cooldownMs}ms.`);
      }
      console.warn(`[MODEL_FALLBACK] report generateContent failed on ${model}, trying next model.`);
    }
  }

  // Gemini 전체 실패 시 Claude 폴백
  if (!result && getClaudeApiKey()) {
    console.info('[MODEL_FALLBACK] All Gemini models failed, trying Claude fallback...');
    for (const model of DEFAULT_CLAUDE_MODELS) {
      try {
        result = await claudeGenerateContent({
          model,
          systemInstruction: baseSystemInstruction,
          userMessage: USER_PROMPT,
          maxTokens: 16384,
          temperature: 0.8,
        });
        console.info(`[MODEL_FALLBACK] Claude fallback succeeded: ${model}`);
        break;
      } catch (claudeErr: any) {
        console.warn(`[MODEL_FALLBACK] Claude ${model} failed:`, claudeErr?.message);
      }
    }
  }

  if (!result) {
    throw lastError || new Error('리포트 생성 실패');
  }

  const text = result?.text || '리포트 생성 실패';
  const finishReason = result?.candidates?.[0]?.finishReason as string | undefined;
  if (finishReason === 'MAX_TOKENS') {
    console.warn('[REPORT] finishReason=MAX_TOKENS: output was cut off by token limit');
  }

  return { text, truncated: finishReason === 'MAX_TOKENS', coreHook };
}
