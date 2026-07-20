import { useEffect, useRef, useState } from 'react';
import type { ProductType, ReportSection } from '../../lib/premiumOrderStore';
import { runReportGeneration, type BirthFormInput, type ReportAskInput } from '../../lib/runReportGeneration';

/**
 * 자동 생성 파이프 진행 UI (Phase 3-3).
 * 생년월일 입력 직후(리딤/결제 확정) 리포트를 생성·저장하는 카드.
 * 관리자 패널의 진행바/타이머/취소(AbortController) 패턴을 축약 재사용한다.
 */

const PAPER_CARD = 'rounded-3xl border border-ink-300/30 bg-white shadow-sm';
const ESTIMATED_SECONDS = 120;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface ReportGenerationProgressProps {
  code: string;
  orderId: string;
  product: ProductType;
  birth: BirthFormInput;
  /** 구매 시 선택 입력한 질문·고민(선택) — 프롬프트에 전달된다. */
  ask?: ReportAskInput;
  /** true면 마운트 즉시 생성 시작(결제 확정 직후 흐름). 기본은 버튼 클릭 시작. */
  autoStart?: boolean;
  onComplete: (sections: ReportSection[]) => void;
}

export default function ReportGenerationProgress({
  code,
  orderId,
  product,
  birth,
  ask,
  autoStart = false,
  onComplete,
}: ReportGenerationProgressProps) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 실행 토큰 — StrictMode 이중 마운트/재시작 시 이전 실행의 결과가 최신 상태를 덮지 않게 한다.
  const runIdRef = useRef(0);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = async () => {
    if (phase === 'running') return;
    const runId = ++runIdRef.current;
    setPhase('running');
    setError(null);
    setElapsed(0);
    const controller = new AbortController();
    abortRef.current = controller;
    stopTimer();
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);

    const result = await runReportGeneration({
      code,
      orderId,
      product,
      birth,
      ask,
      signal: controller.signal,
    });

    // 추월된(재시작으로 대체된) 실행의 결과는 무시한다.
    if (runId !== runIdRef.current) return;

    stopTimer();
    abortRef.current = null;

    if (result.status === 'ok') {
      onComplete(result.sections);
      return;
    }
    if (result.status === 'aborted') {
      setPhase('idle');
      setError('생성을 취소했습니다.');
      return;
    }
    setPhase('error');
    setError(result.reason);
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopTimer();
  };

  // autoStart: 마운트 시 시작. StrictMode(dev)의 마운트→정리→재마운트에서도
  // 정리 시 abort된 실행을 재마운트 effect가 새 runId로 다시 시작한다.
  useEffect(() => {
    if (autoStart) {
      void start();
    }
    return () => {
      abortRef.current?.abort();
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = Math.max(0, ESTIMATED_SECONDS - elapsed);
  const progress = Math.min(98, (elapsed / ESTIMATED_SECONDS) * 100);

  if (phase === 'running') {
    return (
      <section className={`${PAPER_CARD} p-6 space-y-4`}>
        <div>
          <h3 className="font-serif text-[18px] font-bold text-ink-900">리포트를 생성하고 있습니다</h3>
          <p className="text-[14px] text-ink-500 leading-relaxed mt-1">
            사주를 풀이해 장문 리포트를 작성하는 중입니다. 약 2분 정도 걸리며, 이 화면을 벗어나지 말고
            잠시만 기다려 주세요.
          </p>
        </div>
        <div className="h-2 w-full rounded-full bg-ink-300/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-ink-900 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-ink-500">
            경과 {fmtTime(elapsed)} · 예상 잔여 {fmtTime(remaining)}
          </p>
          <button
            onClick={cancel}
            className="px-4 py-2 rounded-xl border border-ink-300/40 text-ink-700 text-[13px] font-bold"
          >
            취소
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${PAPER_CARD} p-6 space-y-4`}>
      <div>
        <h3 className="font-serif text-[18px] font-bold text-ink-900">리포트 생성</h3>
        <p className="text-[14px] text-ink-500 leading-relaxed mt-1">
          입력하신 사주로 장문 리포트를 생성합니다. 생성에는 약 2분이 걸리며, 완료되면 바로 열람할 수
          있습니다.
        </p>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <button
        onClick={() => void start()}
        className="px-5 py-2.5 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold"
      >
        {phase === 'error' ? '다시 시도' : '리포트 생성 시작'}
      </button>
    </section>
  );
}
