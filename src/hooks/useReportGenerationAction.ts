import { useCallback } from 'react';
import { REPORT_GUIDELINE, BASIC_REPORT_GUIDELINE, ADVANCED_REPORT_GUIDELINE } from '../constants/guidelines';
import { getCurrentYearPillarKST, getCurrentMonthPillarKST } from '../lib/seoulDateGanji';
import { buildReportSystemInstruction } from '../lib/promptBuilders';
import { recordModelTelemetry } from '../lib/modelTelemetry';
import { waitForModelCooldownIfNeeded, recordRetryableModelFailure, recordModelRequestSuccess } from '../lib/modelCooldown';
import { parseModelErrorPayload, isRetryableModelError, isModelSelectionError, runWithModelRetry } from '../lib/modelUtils';
import { hanjaToHangul, calculateDeity, getSipseung, getGongmangSummary, getHapChungSummary, getShinsalSummary, getOriginalSipseungSummary } from '../utils/saju';

interface UseReportGenerationActionParams {
  loading: boolean;
  guidelines: unknown;
  guidelinesError: string | null;
  sajuResult: any[];
  daeunResult: any[];
  yongshinResult: any | null;
  gyeokResult: any | null;
  birthYear: string;
  userName: string;
  consultationModeRef: React.MutableRefObject<'basic' | 'advanced'>;
  isAdmin: boolean;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setReportContent: React.Dispatch<React.SetStateAction<string | null>>;
  getGeminiAI: () => any;
  preferredModels: string[];
}

export const useReportGenerationAction = ({
  loading,
  guidelines,
  guidelinesError,
  sajuResult,
  daeunResult,
  yongshinResult,
  gyeokResult,
  birthYear,
  userName,
  consultationModeRef,
  isAdmin,
  setActiveTab,
  setLoading,
  setReportContent,
  getGeminiAI,
  preferredModels,
}: UseReportGenerationActionParams) => {
  const appendRawError = (baseMessage: string, parsed: { code?: number | null; status?: string | null; message?: string }) => {
    if (!isAdmin) {
      return baseMessage;
    }

    const codeText = parsed.code ?? 'N/A';
    const statusText = parsed.status || 'N/A';
    const messageText = parsed.message || 'N/A';
    return `${baseMessage}\n\n[디버그] 코드: ${codeText} | 상태: ${statusText} | 원문: ${messageText}`;
  };

  const handleGenerateReport = useCallback(async () => {
    if (loading) return;

    if (!guidelines) {
      alert(guidelinesError || '지침 파일을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    if (sajuResult.length === 0) {
      alert('먼저 사주 분석을 완료해 주세요.');
      setActiveTab('welcome');
      return;
    }

    setLoading(true);
    setActiveTab('report');

    try {
      const ai = getGeminiAI();
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

      // 6순위: 월운 산출
      const currentMonthPillar = getCurrentMonthPillarKST();
      const wolunStem = currentMonthPillar.monthPillarHanja.charAt(0);
      const wolunBranch = currentMonthPillar.monthPillarHanja.charAt(1);
      const wolunSipseong = dayMasterHanja ? (calculateDeity(dayMasterHanja, wolunStem) ?? '') : '';
      const wolunBranchSipseong = dayMasterHanja ? (calculateDeity(dayMasterHanja, wolunBranch, true) ?? '') : '';
      const wolunSipseung = dayMasterHanja ? getSipseung(dayMasterHanja, wolunBranch) : '';

      // 7순위: 합·충·공망·신살·원국운성
      const yearStemHanja = sajuResult.length >= 4 ? sajuResult[3].stem.hanja : '';
      const yearBranchHanja = sajuResult.length >= 4 ? sajuResult[3].branch.hanja : '';
      const hapChungStr = sajuResult.length >= 2 ? getHapChungSummary(sajuResult) : '';
      const gongmangStr = (yearStemHanja && yearBranchHanja && yearBranchHanja !== '?')
        ? getGongmangSummary(yearStemHanja, yearBranchHanja, sajuResult)
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
      const currentAge = isNaN(birthYearInt) ? 0 : currentYear - birthYearInt + 1;

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

      const modeGuideline = consultationModeRef.current === 'basic' ? BASIC_REPORT_GUIDELINE : ADVANCED_REPORT_GUIDELINE;
      const reportGuideline = `${REPORT_GUIDELINE}\n\n${modeGuideline}`;
      const baseSystemInstruction = buildReportSystemInstruction({
        currentDateText: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
        currentYearPillar,
        reportGuideline,
        userName,
        sajuContext,
        daeunContext,
        currentAge
      });

      const modelCandidates = preferredModels.length > 0
        ? preferredModels
        : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
      const telemetryRequestId = `report-${Date.now()}`;

      let result: any = null;
      let lastError: any = null;

      for (const model of modelCandidates) {
        const startedAt = Date.now();
        try {
          // 503(서버 과부하) 발생 시 즉시 다음 모델로 이동.
          // gemini-1.5-flash는 자원이 풍부해 최후 보루로 최대 3회 재시도.
          const maxAttempts = model === 'gemini-1.5-flash' ? 3 : 1;
          result = await runWithModelRetry(
            () => ai.models.generateContent({
              model,
              contents: [{ parts: [{ text: '나의 사주 정보와 대운 흐름을 바탕으로 종합 운세 리포트를 작성해줘. 반드시 정해진 [SECTION] 형식을 지켜야 해.' }] }],
              config: {
                systemInstruction: baseSystemInstruction,
                maxOutputTokens: 16384,
                temperature: 0.8
              }
            }),
            maxAttempts
          );
          recordModelTelemetry({
            feature: 'report',
            phase: 'success',
            model,
            requestId: telemetryRequestId,
            durationMs: Date.now() - startedAt
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
            errorStatus: payload.status
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
            errorStatus: payload.status
          });
          if (cooldownMs > 0) {
            console.warn(`[MODEL_COOLDOWN] report cooldown armed for ${cooldownMs}ms.`);
          }
          console.warn(`[MODEL_FALLBACK] report generateContent failed on ${model}, trying next model.`);
        }
      }

      if (!result) {
        throw lastError || new Error('리포트 생성 실패');
      }

      const text = result?.text || '리포트 생성 실패';

      // finishReason이 MAX_TOKENS이면 출력이 잘린 것 — 사용자에게 알림
      const finishReason = result?.candidates?.[0]?.finishReason as string | undefined;
      if (finishReason === 'MAX_TOKENS') {
        console.warn('[REPORT] finishReason=MAX_TOKENS: output was cut off by token limit');
        setReportContent(text + '\n\n---\n⚠️ 리포트 일부가 토큰 한도로 잘렸을 수 있습니다. 다시 시도해보세요.');
        return;
      }

      setReportContent(text);
    } catch (err: any) {
      console.error('[ERROR] Report generation failed:', err);
      const parsed = parseModelErrorPayload(err);
      const rawMessage = String(parsed.message || err?.message || '').toLowerCase();

      if (isRetryableModelError(err)) {
        setReportContent(appendRawError('현재 리포트 요청이 많아 생성이 지연되고 있어요. 20~30초 후 다시 시도해 주세요.', parsed));
      } else if (parsed.status === 'UNAUTHENTICATED' || parsed.status === 'PERMISSION_DENIED' || rawMessage.includes('api key') || rawMessage.includes('permission')) {
        setReportContent(appendRawError('서비스 연결 설정 문제로 리포트를 만들지 못했어요. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.', parsed));
      } else if (parsed.status === 'INVALID_ARGUMENT' || rawMessage.includes('invalid')) {
        setReportContent(appendRawError('입력 정보 일부를 처리하지 못했어요. 생년월일/시간 정보를 다시 확인한 뒤 시도해 주세요.', parsed));
      } else {
        setReportContent(appendRawError('리포트를 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', parsed));
      }
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    guidelines,
    guidelinesError,
    sajuResult,
    daeunResult,
    birthYear,
    userName,
    consultationModeRef,
    isAdmin,
    setActiveTab,
    setLoading,
    setReportContent,
    getGeminiAI,
    preferredModels,

  ]);

  return { handleGenerateReport };
};
