import { useCallback } from 'react';
import { CONSULTING_GUIDELINE, BASIC_CONSULTING_GUIDELINE, ADVANCED_CONSULTING_GUIDELINE } from '../constants/guidelines';
import { getTodayDayPillarKST, getCurrentYearPillarKST, getCurrentMonthPillarKST, getNearbyDayPillarsKST } from '../lib/seoulDateGanji';
import { buildConsultingSystemInstruction } from '../lib/promptBuilders';
import { recordModelTelemetry } from '../lib/modelTelemetry';
import { waitForModelCooldownIfNeeded, recordRetryableModelFailure, recordModelRequestSuccess } from '../lib/modelCooldown';
import { parseModelErrorPayload, isRetryableModelError, isModelSelectionError, runWithModelRetry } from '../lib/modelUtils';
import { hanjaToHangul, calculateDeity, getSipseung, getGongmangSummary, getHapChungSummary, getShinsalSummary, getOriginalSipseungSummary } from '../utils/saju';
import { ChatMessage } from './useChatTabState';

interface UseChatSendActionParams {
  input: string;
  loading: boolean;
  guidelines: unknown;
  guidelinesError: string | null;
  sajuResult: any[];
  daeunResult: any[];
  yongshinResult: any | null;
  gyeokResult: any | null;
  birthYear: string;
  messages: ChatMessage[];
  basicSelectedCategory: string;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setBasicAskedByCategory: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  activeChatRequestIdRef: React.MutableRefObject<number>;
  consultationModeRef: React.MutableRefObject<'basic' | 'advanced'>;
  preservedChatContextRef: React.MutableRefObject<ChatMessage[]>;
  isAdmin: boolean;
  getGeminiAI: () => any;
  preferredModels: string[];
  sajuToolDeclaration: any;
  calculateSajuForPerson: (args: any) => any;
}

export const useChatSendAction = ({
  input,
  loading,
  guidelines,
  guidelinesError,
  sajuResult,
  daeunResult,
  yongshinResult,
  gyeokResult,
  birthYear,
  messages,
  basicSelectedCategory,
  setActiveTab,
  setInput,
  setRefreshKey,
  setMessages,
  setLoading,
  setBasicAskedByCategory,
  activeChatRequestIdRef,
  consultationModeRef,
  preservedChatContextRef,
  isAdmin,
  getGeminiAI,
  preferredModels,
  sajuToolDeclaration,
  calculateSajuForPerson
}: UseChatSendActionParams) => {
  const formatRawError = (parsed: { code: number | null; status: string | null; message: string }) => {
    if (!isAdmin) return '';
    const codeText = parsed.code ?? 'N/A';
    const statusText = parsed.status || 'N/A';
    const messageText = parsed.message || 'N/A';
    return `[디버그] 코드: ${codeText} | 상태: ${statusText} | 원문: ${messageText}`;
  };

  const RELATIONSHIP_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
    { canonical: '남자친구', aliases: ['남자친구', '남친'] },
    { canonical: '여자친구', aliases: ['여자친구', '여친'] },
    { canonical: '남편', aliases: ['남편', '신랑'] },
    { canonical: '아내', aliases: ['아내', '부인', '와이프'] },
    { canonical: '아버지', aliases: ['아버지', '아빠', '부친'] },
    { canonical: '어머니', aliases: ['어머니', '엄마', '모친'] },
    { canonical: '아들', aliases: ['아드님', '아들'] },
    { canonical: '딸', aliases: ['따님', '딸'] },
    { canonical: '형', aliases: ['형'] },
    { canonical: '누나', aliases: ['누나'] },
    { canonical: '오빠', aliases: ['오빠'] },
    { canonical: '언니', aliases: ['언니'] },
    { canonical: '동생', aliases: ['동생'] },
    { canonical: '조카', aliases: ['조카'] },
    { canonical: '손자', aliases: ['손자'] },
    { canonical: '손녀', aliases: ['손녀'] },
    { canonical: '친구', aliases: ['친구'] },
    { canonical: '지인', aliases: ['지인'] },
  ];

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const detectLockedRelationship = (texts: string[]): string | null => {
    const userTexts = [...texts].reverse();
    for (const text of userTexts) {
      for (const rel of RELATIONSHIP_ALIASES) {
        for (const alias of rel.aliases) {
          if (text.includes(alias)) {
            return rel.canonical;
          }
        }
      }
    }
    return null;
  };

  const enforceRelationshipLabel = (text: string, lock: string | null): string => {
    if (!lock) return text;
    const locked = RELATIONSHIP_ALIASES.find((rel) => rel.canonical === lock);
    if (!locked) return text;

    let result = text;
    for (const rel of RELATIONSHIP_ALIASES) {
      if (rel.canonical === locked.canonical) continue;
      for (const alias of rel.aliases) {
        result = result.replace(new RegExp(escapeRegex(alias), 'g'), locked.aliases[0]);
      }
    }
    return result;
  };

  const handleSend = useCallback(async (overrideInput?: string) => {
    const userMessage = (overrideInput || input).trim();
    if (!userMessage || loading) return;
    const requestId = ++activeChatRequestIdRef.current;
    const modeAtRequest = consultationModeRef.current;

    if (!guidelines) {
      alert(guidelinesError || '지침 파일을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    if (sajuResult.length === 0) {
      alert('먼저 사주 분석을 완료해 주세요.');
      setActiveTab('welcome');
      return;
    }

    setInput('');
    setRefreshKey((prev) => prev + 1);
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const ai = getGeminiAI();
      const waitedMs = await waitForModelCooldownIfNeeded('chat');
      if (waitedMs > 0) {
        console.warn(`[MODEL_COOLDOWN] chat request delayed ${waitedMs}ms due to recent retryable errors.`);
      }

      const currentYearPillarForContext = getCurrentYearPillarKST();
      const seunStem = currentYearPillarForContext.yearPillarHanja.charAt(0);
      const seunBranch = currentYearPillarForContext.yearPillarHanja.charAt(1);
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
          ? `세운(${currentYearPillarForContext.year}): ${currentYearPillarForContext.yearPillarHangul} | 천간십성: ${seunSipseong} | 지지십성: ${seunBranchSipseong} | 지지운성: ${seunSipseung}`
          : null,
        dayMasterHanja
          ? `월운(${currentMonthPillar.year}-${String(currentMonthPillar.month).padStart(2, '0')}): ${currentMonthPillar.monthPillarHangul} | 천간십성: ${wolunSipseong} | 지지십성: ${wolunBranchSipseong} | 지지운성: ${wolunSipseung}`
          : null,
        hapChungStr || null,
        gongmangStr ? `공망: ${gongmangStr}` : null,
        shinsalStr ? `신살: ${shinsalStr}` : null,
        originalSipseungStr ? `원국운성: ${originalSipseungStr}` : null,
      ].filter(Boolean).join('\n');
      const daeunContext = (() => {
        const birthYearInt = parseInt(birthYear, 10);
        const currentYear = new Date().getFullYear();
        const currentAge = isNaN(birthYearInt) ? 0 : currentYear - birthYearInt + 1;
        return daeunResult
          .map((d, i) => {
            const stemHangul = hanjaToHangul[d.stem] || d.stem;
            const branchHangul = hanjaToHangul[d.branch] || d.branch;
            const stemDeity = dayMasterHanja ? (calculateDeity(dayMasterHanja, d.stem) ?? '') : '';
            const branchDeity = dayMasterHanja ? (calculateDeity(dayMasterHanja, d.branch, true) ?? '') : '';
            const isCurrent = currentAge >= d.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i + 1].startAge);
            return `${d.startAge}세 대운: ${stemHangul}${branchHangul}(천간:${stemDeity}/지지:${branchDeity})${isCurrent ? ' (현재 대운)' : ''}`;
          })
          .join(', ');
      })();

      const isFirstMessage = messages.length === 0;
      const modeOnlyGuideline = modeAtRequest === 'basic'
        ? BASIC_CONSULTING_GUIDELINE
        : ADVANCED_CONSULTING_GUIDELINE;
      const modeSpecificGuideline = `${CONSULTING_GUIDELINE}\n\n${modeOnlyGuideline}`;
      const todayDayPillar = getTodayDayPillarKST();
      const nearbyDayPillars = getNearbyDayPillarsKST();
      const currentYearPillar = currentYearPillarForContext;
      const systemInstruction = buildConsultingSystemInstruction({
        mode: modeAtRequest,
        isFirstMessage,
        latestUserMessage: userMessage,
        sajuContext,
        daeunContext,
        modeSpecificGuideline,
        todayDayPillar,
        currentYearPillar,
        nearbyDayPillars
      });

      const contextMessages = [...preservedChatContextRef.current, ...messages];
      const lockedRelationship = detectLockedRelationship([
        ...contextMessages.filter(m => m.role === 'user').map(m => m.text),
        userMessage
      ]);
      const contents: any[] = contextMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const modelCandidates = preferredModels.length > 0
        ? preferredModels
        : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

      let activeModel = modelCandidates[0];
      const telemetryRequestId = `chat-${requestId}-${Date.now()}`;

      const generateWithModelFallback = async () => {
        let lastError: any = null;
        for (const model of modelCandidates) {
          const startedAt = Date.now();
          try {
            // 503(서버 과부하) 발생 시 즉시 다음 모델로 이동.
            // gemini-1.5-flash는 자원이 풍부해 최후 보루로 최대 3회 재시도.
            const maxAttempts = model === 'gemini-1.5-flash' ? 3 : 1;
            const result = await runWithModelRetry<any>(
              () => ai.models.generateContent({
                model,
                contents,
                config: {
                  systemInstruction,
                  tools: [{ functionDeclarations: [sajuToolDeclaration] }]
                }
              }),
              maxAttempts
            );
            activeModel = model;
            recordModelTelemetry({
              feature: 'chat',
              phase: 'success',
              model,
              requestId: telemetryRequestId,
              durationMs: Date.now() - startedAt
            });
            recordModelRequestSuccess('chat');
            return result;
          } catch (err: any) {
            lastError = err;
            const payload = parseModelErrorPayload(err);
            const retryable = isRetryableModelError(err);
            const modelSelectionError = isModelSelectionError(err);
            recordModelTelemetry({
              feature: 'chat',
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
            const cooldownMs = retryable ? recordRetryableModelFailure('chat') : 0;
            if (cooldownMs > 0) {
              console.warn(`[MODEL_COOLDOWN] chat cooldown armed for ${cooldownMs}ms.`);
            }
            recordModelTelemetry({
              feature: 'chat',
              phase: 'fallback',
              model,
              requestId: telemetryRequestId,
              errorCode: payload.code,
              errorStatus: payload.status
            });
            console.warn(`[MODEL_FALLBACK] chat generateContent failed on ${model}, trying next model.`);
          }
        }
        throw lastError;
      };

      let response = await generateWithModelFallback();

      let functionCalls = response.functionCalls;
      while (Array.isArray(functionCalls) && functionCalls.length > 0) {
        if (requestId !== activeChatRequestIdRef.current) {
          return;
        }

        const functionResponses = [];
        for (const call of functionCalls) {
          if (call.name === 'calculateSajuForPerson') {
            const result = calculateSajuForPerson(call.args);
            functionResponses.push({
              name: call.name,
              response: result,
              id: call.id
            });
          }
        }

        if (functionResponses.length === 0) {
          break;
        }

        const candidateContent = response?.candidates?.[0]?.content;
        if (!candidateContent) {
          break;
        }

        contents.push(candidateContent);
        contents.push({
          role: 'user',
          parts: functionResponses.map((r) => ({ functionResponse: r }))
        });

        try {
          const startedAt = Date.now();
          response = await ai.models.generateContent({
            model: activeModel,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: [sajuToolDeclaration] }]
            }
          });
          recordModelTelemetry({
            feature: 'chat',
            phase: 'success',
            model: activeModel,
            requestId: telemetryRequestId,
            durationMs: Date.now() - startedAt
          });
          recordModelRequestSuccess('chat');
        } catch (err: any) {
          const payload = parseModelErrorPayload(err);
          const retryable = isRetryableModelError(err);
          const modelSelectionError = isModelSelectionError(err);
          recordModelTelemetry({
            feature: 'chat',
            phase: 'failure',
            model: activeModel,
            requestId: telemetryRequestId,
            errorCode: payload.code,
            errorStatus: payload.status
          });
          if (!retryable && !modelSelectionError) {
            throw err;
          }
          const cooldownMs = retryable ? recordRetryableModelFailure('chat') : 0;
          recordModelTelemetry({
            feature: 'chat',
            phase: 'fallback',
            model: activeModel,
            requestId: telemetryRequestId,
            errorCode: payload.code,
            errorStatus: payload.status
          });
          if (cooldownMs > 0) {
            console.warn(`[MODEL_COOLDOWN] chat cooldown armed for ${cooldownMs}ms.`);
          }
          response = await generateWithModelFallback();
        }

        if (requestId !== activeChatRequestIdRef.current) {
          return;
        }

        functionCalls = response.functionCalls;
      }

      if (requestId !== activeChatRequestIdRef.current) {
        return;
      }

      const finalResponseText = enforceRelationshipLabel(
        response.text || '상담 중 오류가 발생했습니다.',
        lockedRelationship
      );
      setMessages((prev) => [...prev, { role: 'model', text: finalResponseText }]);
      if (modeAtRequest === 'basic') {
        setBasicAskedByCategory((prev) => {
          const currentAsked = prev[basicSelectedCategory] || [];
          const updatedAsked = [...currentAsked, userMessage];
          return {
            ...prev,
            [basicSelectedCategory]: updatedAsked
          };
        });
      }
    } catch (err: any) {
      if (requestId !== activeChatRequestIdRef.current) {
        return;
      }

      console.error('Chat error:', err);
      const parsed = parseModelErrorPayload(err);
      const isTransient = isRetryableModelError(err);
      const debugInfo = formatRawError(parsed);
      const baseMessage = isTransient
        ? '현재 AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.'
        : '상담 중 오류가 발생했습니다.';
      const userFacingMessage = debugInfo ? `${baseMessage}\n\n${debugInfo}` : baseMessage;

      setMessages((prev) => [...prev, { role: 'model', text: userFacingMessage }]);
    } finally {
      if (requestId === activeChatRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    input,
    loading,
    guidelines,
    guidelinesError,
    sajuResult,
    daeunResult,
    messages,
    basicSelectedCategory,
    setActiveTab,
    setInput,
    setRefreshKey,
    setMessages,
    setLoading,
    setBasicAskedByCategory,
    activeChatRequestIdRef,
    consultationModeRef,
    preservedChatContextRef,
    isAdmin,
    getGeminiAI,
    preferredModels,
    sajuToolDeclaration,
    calculateSajuForPerson
  ]);

  return { handleSend };
};
