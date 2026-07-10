import React, { Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { buildTeaserSummary, fetchTeaserComment, type TeaserInput, type TeaserSummary } from '../../lib/landingTeaser';
import { toOhaengChartData } from '../../constants/ohaengColors';

const FiveElementsPieChart = React.lazy(() => import('../FiveElementsPieChart'));

/**
 * 히어로 무료 사주 요약 티저 (사이트 개편).
 * 생년월일시만 입력(이름·동의 없음, 저장 없음) → 즉석 규칙 요약 + AI 한 줄 풀이 →
 * 만세력 / 리포트 구매 퍼널로 유도. 구매 CTA는 reportsComingSoon 플래그로 게이트.
 */

export interface HeroSajuTeaserProps {
  currentSeoulYear: number;
  reportsComingSoon: boolean;
  onOpenManse: (input: TeaserInput) => void;
  onOpenCheckout: () => void;
}

const FIELD =
  'px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900';

const SEG_ON = 'bg-ink-900 text-paper-50 shadow-md';
const SEG_OFF = 'text-ink-500';

export function HeroSajuTeaser({ currentSeoulYear, reportsComingSoon, onOpenManse, onOpenCheckout }: HeroSajuTeaserProps) {
  const [input, setInput] = useState<TeaserInput>({
    birthYear: '1990',
    birthMonth: '1',
    birthDay: '1',
    birthHour: '12',
    calendarType: 'solar',
    gender: 'M',
    unknownTime: false,
  });
  const [summary, setSummary] = useState<TeaserSummary | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const set = <K extends keyof TeaserInput>(key: K, value: TeaserInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    setError(null);
    let built: TeaserSummary;
    try {
      built = buildTeaserSummary(input);
    } catch (e) {
      console.error('[teaser] summary failed:', e);
      setError('사주 계산에 실패했습니다. 입력을 확인해 주세요.');
      return;
    }
    setSummary(built);

    // AI 한 줄 풀이 — 실패 시 조용히 생략(규칙 요약만 표시)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiComment(null);
    setAiLoading(true);
    fetchTeaserComment(built.ganzhiContext, controller.signal)
      .then((text) => setAiComment(text))
      .catch(() => undefined)
      .finally(() => setAiLoading(false));
  };

  const chartData = summary ? toOhaengChartData(summary.ohaeng) : [];

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        className="rounded-3xl border border-ink-300/30 bg-paper-50/70 backdrop-blur-sm p-5 md:p-6 space-y-4 text-left"
        style={{ boxShadow: '0 1px 0 rgba(168, 138, 74, 0.1), 0 12px 28px -12px rgba(58, 53, 48, 0.12)' }}
      >
        {!summary ? (
          <>
            <p className="text-[14px] text-ink-700 leading-relaxed">
              생년월일시를 입력하면 사주 요약을 무료로 바로 보여드립니다.
            </p>

            <div className="grid grid-cols-3 gap-2">
              <select value={input.birthYear} onChange={(e) => set('birthYear', e.target.value)} className={FIELD} aria-label="년도">
                {Array.from({ length: 100 }, (_, i) => currentSeoulYear - i).map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select value={input.birthMonth} onChange={(e) => set('birthMonth', e.target.value)} className={FIELD} aria-label="월">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <select value={input.birthDay} onChange={(e) => set('birthDay', e.target.value)} className={FIELD} aria-label="일">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={input.birthHour}
                onChange={(e) => set('birthHour', e.target.value)}
                disabled={input.unknownTime}
                className={`${FIELD} flex-1 disabled:opacity-40`}
                aria-label="태어난 시"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>{h}시</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-[13px] text-ink-500 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={input.unknownTime}
                  onChange={(e) => set('unknownTime', e.target.checked)}
                  className="w-4 h-4 rounded border-ink-500 text-ink-900"
                />
                생시 몰라요
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-paper-100/60 border border-ink-300/30">
                {([['solar', '양력'], ['lunar', '음력(평)'], ['leap', '음력(윤)']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => set('calendarType', value)}
                    className={`flex-1 py-2 min-h-[40px] rounded-lg text-[11px] font-bold transition-all ${
                      input.calendarType === value ? SEG_ON : SEG_OFF
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-paper-100/60 border border-ink-300/30">
                {([['M', '남자'], ['F', '여자']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => set('gender', value)}
                    className={`flex-1 py-2 min-h-[40px] rounded-lg text-[11px] font-bold transition-all ${
                      input.gender === value ? SEG_ON : SEG_OFF
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-[12px] text-red-600">{error}</p>}

            <button
              onClick={handleSubmit}
              className="w-full py-4 min-h-[48px] rounded-full bg-ink-900 hover:bg-ink-700 text-paper-50 font-bold text-[14px] shadow-lg shadow-ink-700/20 active:scale-95 transition-all"
            >
              무료로 사주 보기
            </button>

            <p className="text-center text-[12px] text-ink-500">
              입력 정보는 저장되지 않습니다.
            </p>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-4">
            <div>
              <p className="text-[12px] text-ink-500">당신의 명식</p>
              <p className="font-serif text-[18px] md:text-[22px] font-bold text-ink-900 tracking-wider mt-1">
                {summary.myeongsikLine}
                {input.unknownTime && <span className="text-[12px] font-normal text-ink-500 ml-2">시간 미상</span>}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <p className="text-[14px] text-ink-700">
                  일간 <strong className="font-bold text-ink-900">{summary.dayMasterLine}</strong>
                </p>
                <p className="text-[14px] text-ink-700 leading-relaxed">{summary.strengthLine}</p>
                <p className="text-[14px] text-ink-700 leading-relaxed">올해는 {summary.seunLine}입니다.</p>
              </div>
              {chartData.length > 0 && (
                <div className="w-[150px] shrink-0">
                  <Suspense fallback={<div className="h-[130px]" />}>
                    <FiveElementsPieChart data={chartData} />
                  </Suspense>
                </div>
              )}
            </div>

            {(aiLoading || aiComment) && (
              <div className="border-t border-ink-300/20 pt-3 space-y-1">
                <p className="text-[12px] text-ink-500">AI 한 줄 풀이</p>
                {aiComment ? (
                  <p className="text-[14px] text-ink-700 leading-relaxed">{aiComment}</p>
                ) : (
                  <div className="h-4 w-3/4 rounded bg-ink-300/20 animate-pulse" />
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => onOpenManse(input)}
                className="flex-1 py-3 min-h-[44px] rounded-full border-[1.5px] border-ink-900 text-ink-900 font-bold text-[14px] hover:bg-ink-900 hover:text-paper-50 transition-all"
              >
                만세력 자세히 보기
              </button>
              {reportsComingSoon ? (
                <div className="flex-1 text-center">
                  <button
                    disabled
                    className="w-full py-3 min-h-[44px] rounded-full bg-ink-900/40 text-paper-50 font-bold text-[14px] cursor-not-allowed"
                  >
                    리포트로 깊이 보기
                  </button>
                  <p className="text-[12px] text-ink-500 mt-1">리포트는 곧 오픈합니다.</p>
                </div>
              ) : (
                <button
                  onClick={onOpenCheckout}
                  className="flex-1 py-3 min-h-[44px] rounded-full bg-ink-900 hover:bg-ink-700 text-paper-50 font-bold text-[14px] shadow-lg shadow-ink-700/20 transition-all"
                >
                  리포트로 깊이 보기 · 4,900원부터
                </button>
              )}
            </div>

            <button
              onClick={() => {
                abortRef.current?.abort();
                setSummary(null);
                setAiComment(null);
                setAiLoading(false);
              }}
              className="text-[12px] text-ink-500 underline"
            >
              다시 입력하기
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
