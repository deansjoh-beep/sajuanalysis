import { useCallback, useMemo, useState } from 'react';
import {
  BUILDER_TOPICS,
  BUILDER_TIMEFRAMES,
  BUILDER_ANSWER_TYPES,
  assembleBuilderQuestion,
} from '../constants/questionBuilder';

/** 질문 빌더 진행 상태. done = 완성 질문이 입력창에 채워진 직후(안내 문구 표시용). */
export type BuilderStatus = 'idle' | 'active' | 'done';

export interface BuilderStepView {
  /** 1부터 시작하는 현재 단계 번호(표시용). */
  stepNumber: number;
  totalSteps: number;
  title: string;
  options: Array<{ id: string; label: string }>;
}

const TOTAL_STEPS = 4;

/**
 * 질문 만들기 위저드 상태 훅. 전 단계 결정론(LLM 미호출).
 * 마지막 선택 시 완성 질문을 onComplete로 넘기고(입력창 채우기) 스스로 닫힌다.
 */
export const useQuestionBuilder = (onComplete: (question: string) => void) => {
  const [status, setStatus] = useState<BuilderStatus>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [situationId, setSituationId] = useState<string | null>(null);
  const [timeframeId, setTimeframeId] = useState<string | null>(null);

  const topic = useMemo(
    () => BUILDER_TOPICS.find((t) => t.id === topicId) ?? null,
    [topicId]
  );

  const step: BuilderStepView | null = useMemo(() => {
    if (status !== 'active') return null;
    if (stepIndex === 0) {
      return {
        stepNumber: 1,
        totalSteps: TOTAL_STEPS,
        title: '어떤 주제가 고민이세요?',
        options: BUILDER_TOPICS.map((t) => ({ id: t.id, label: t.label })),
      };
    }
    if (stepIndex === 1) {
      return {
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        title: '지금 상황에 가장 가까운 것은요?',
        options: (topic?.situations ?? []).map((s) => ({ id: s.id, label: s.label })),
      };
    }
    if (stepIndex === 2) {
      return {
        stepNumber: 3,
        totalSteps: TOTAL_STEPS,
        title: '언제가 궁금하세요?',
        options: BUILDER_TIMEFRAMES.map((t) => ({ id: t.id, label: t.label })),
      };
    }
    return {
      stepNumber: 4,
      totalSteps: TOTAL_STEPS,
      title: '어떤 답이 필요하세요?',
      options: BUILDER_ANSWER_TYPES.map((a) => ({ id: a.id, label: a.label })),
    };
  }, [status, stepIndex, topic]);

  const reset = useCallback(() => {
    setStepIndex(0);
    setTopicId(null);
    setSituationId(null);
    setTimeframeId(null);
  }, []);

  const start = useCallback(() => {
    reset();
    setStatus('active');
  }, [reset]);

  const cancel = useCallback(() => {
    reset();
    setStatus('idle');
  }, [reset]);

  const back = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const select = useCallback(
    (optionId: string) => {
      if (stepIndex === 0) {
        setTopicId(optionId);
        setStepIndex(1);
        return;
      }
      if (stepIndex === 1) {
        setSituationId(optionId);
        setStepIndex(2);
        return;
      }
      if (stepIndex === 2) {
        setTimeframeId(optionId);
        setStepIndex(3);
        return;
      }
      // 마지막 단계: 질문 조립 → 입력창 채움 → 닫기.
      const situation = topic?.situations.find((s) => s.id === situationId);
      const timeframe = BUILDER_TIMEFRAMES.find((t) => t.id === timeframeId);
      const answerType = BUILDER_ANSWER_TYPES.find((a) => a.id === optionId);
      if (!situation || !timeframe || !answerType) {
        cancel();
        return;
      }
      onComplete(
        assembleBuilderQuestion({
          statement: situation.statement,
          timeframeClause: timeframe.clause,
          request: answerType.request,
        })
      );
      reset();
      setStatus('done');
    },
    [stepIndex, topic, situationId, timeframeId, onComplete, cancel, reset]
  );

  return { status, step, start, cancel, back, select };
};

export type QuestionBuilder = ReturnType<typeof useQuestionBuilder>;
