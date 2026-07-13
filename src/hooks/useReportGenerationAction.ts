import { useCallback } from 'react';
import { parseModelErrorPayload, isRetryableModelError } from '../lib/modelUtils';
import { generateBasicReport } from '../lib/generateBasicReport';

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
    // 만세력 페이지에 통합되어 표시되므로 자동 탭 전환 없음.
    // 호출 측이 필요하면 별도로 setActiveTab 호출.

    try {
      const { text, truncated } = await generateBasicReport({
        sajuResult,
        daeunResult,
        yongshinResult,
        gyeokResult,
        birthYear,
        userName,
        mode: consultationModeRef.current,
        preferredModels,
      });

      // finishReason이 MAX_TOKENS이면 출력이 잘린 것 — 사용자에게 알림
      if (truncated) {
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
    yongshinResult,
    gyeokResult,
    birthYear,
    userName,
    consultationModeRef,
    isAdmin,
    setActiveTab,
    setLoading,
    setReportContent,
    preferredModels,
  ]);

  return { handleGenerateReport };
};
