import { lazy, Suspense, useMemo, useState } from 'react';
import type { MyeongsikParams } from '../../lib/buildMyeongsik';
import {
  computeLifeIndices, summarizeLifeIndexPeaks,
  LIFE_INDEX_LABELS, LIFE_INDEX_DESCRIPTIONS,
  type LifeIndexKey,
} from '../../lib/analysis/lifeIndex';

const LazyLifeIndexChart = lazy(() => import('./LifeIndexChart'));

const PAPER_CARD = 'rounded-3xl border border-ink-300/30 bg-white shadow-sm';

const KEYS: LifeIndexKey[] = ['wealth', 'love', 'career', 'health'];

const KEY_COLOR: Record<LifeIndexKey, string> = {
  wealth: '#a88a4a',
  love: '#b8392e',
  career: '#0047AB',
  health: '#3f7a52',
};

interface LifeIndexCardProps {
  myeongsik: MyeongsikParams;
}

export default function LifeIndexCard({ myeongsik }: LifeIndexCardProps) {
  const [activeKey, setActiveKey] = useState<LifeIndexKey>('wealth');
  const points = useMemo(() => computeLifeIndices(myeongsik), [myeongsik]);
  const currentAge = useMemo(() => {
    const age = new Date().getFullYear() - myeongsik.birthYear;
    return Number.isFinite(age) ? age : null;
  }, [myeongsik.birthYear]);
  const summary = useMemo(
    () => summarizeLifeIndexPeaks(points, activeKey, currentAge ?? undefined),
    [points, activeKey, currentAge],
  );

  if (points.length === 0) return null;

  return (
    <section className={`${PAPER_CARD} p-6 space-y-4`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-serif text-[18px] font-bold text-ink-900">인생 100년 지수</h3>
        <div className="flex gap-1">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setActiveKey(k)}
              className={`px-3 py-1.5 rounded-xl text-[13px] font-bold ${
                k === activeKey ? 'bg-ink-900 text-paper-50' : 'border border-ink-300/40 text-ink-700'
              }`}
            >
              {LIFE_INDEX_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[14px] text-ink-700 leading-relaxed">{LIFE_INDEX_DESCRIPTIONS[activeKey]}</p>

      <Suspense
        fallback={<div className="h-[200px] flex items-center justify-center text-[14px] text-ink-500">차트를 불러오는 중...</div>}
      >
        <LazyLifeIndexChart points={points} activeKey={activeKey} currentAge={currentAge} color={KEY_COLOR[activeKey]} />
      </Suspense>

      <p className="text-[12px] text-ink-500">
        점선은 대운(10년 흐름)이 바뀌는 지점, 주황 세로선은 현재 나이입니다. 그래프에 손을 대면 그 해의 이유가 표시됩니다.
      </p>

      <details className="border-t border-ink-300/20 pt-3">
        <summary className="text-[14px] font-bold text-ink-900 cursor-pointer select-none">이 차트를 읽는 법</summary>
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-700 leading-relaxed list-disc pl-5">
          <li>가로축은 나이입니다. 태어난 해부터 99세까지, 해마다 하나의 점이 찍힙니다.</li>
          <li>점수는 남과 비교하는 절대 점수가 아니라, 내 인생 안에서 시기끼리 비교하는 상대 지수입니다. 숫자보다 곡선의 높낮이를 보세요.</li>
          <li>높은 구간은 그 주제의 기운이 잘 풀리는 시기, 낮은 구간은 무리한 확장보다 정비가 나은 시기입니다.</li>
          <li>낮은 구간이 나쁜 운명이라는 뜻은 아닙니다. 준비와 관리로 충분히 지나갈 수 있는 시기입니다.</li>
        </ul>
      </details>

      {summary && (
        <div className="border-t border-ink-300/20 pt-3 space-y-2">
          <p className="text-[14px] text-ink-700 leading-relaxed">{summary.high.sentence}</p>
          <p className="text-[14px] text-ink-700 leading-relaxed">{summary.low.sentence}</p>
        </div>
      )}

      <p className="text-[12px] text-ink-500 border-t border-ink-300/20 pt-3">
        이 지수는 명리학 이론에 따른 해석 참고 자료이며, 의학적 진단이나 투자 판단의 근거가 아닙니다.
      </p>
    </section>
  );
}
