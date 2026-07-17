import React, { Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { buildTeaserSummary, fetchTeaserComment, teaserInputToDateStrings, type TeaserInput, type TeaserSummary } from '../../lib/landingTeaser';
import { toOhaengChartData } from '../../constants/ohaengColors';
import { getSajuData, getDaeunData, calculateYongshin, calculateGyeok } from '../../utils/saju';
import { DEFAULT_USER_DATA } from '../../types/app';
import { getPreferredGeminiModels } from '../../lib/geminiClient';
import { generateBasicReport } from '../../lib/generateBasicReport';
import { generateReportKeywords } from '../../lib/generateReportKeywords';
import { isRetryableModelError } from '../../lib/modelUtils';
import { parseReport, type ParsedReport } from '../manse/reportSectionUtils';
import { selectCoreHook, formatHookPct, type CoreHook } from '../../lib/hookEngine';
import { ReportAccordion } from './ReportAccordion';

const FiveElementsPieChart = React.lazy(() => import('../FiveElementsPieChart'));

/**
 * 히어로 무료 사주 요약 티저 (사이트 개편).
 * 생년월일시만 입력(이름·동의 없음, 저장 없음) → 즉석 규칙 요약 + AI 한 줄 풀이 →
 * 만세력 / 리포트 구매 퍼널로 유도. 구매 CTA는 reportsComingSoon 플래그로 게이트.
 */

export interface HeroSajuTeaserProps {
  currentSeoulYear: number;
  onOpenManse: (input: TeaserInput) => void;
  onOpenCheckout: () => void;
}

const FIELD =
  'px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900';

const SEG_ON = 'bg-ink-900 text-paper-50 shadow-md';
const SEG_OFF = 'text-ink-500';

export function HeroSajuTeaser({ currentSeoulYear, onOpenManse, onOpenCheckout }: HeroSajuTeaserProps) {
  const [input, setInput] = useState<TeaserInput>({
    name: DEFAULT_USER_DATA.name,
    birthYear: DEFAULT_USER_DATA.birthYear,
    birthMonth: DEFAULT_USER_DATA.birthMonth,
    birthDay: DEFAULT_USER_DATA.birthDay,
    birthHour: DEFAULT_USER_DATA.birthHour,
    calendarType: DEFAULT_USER_DATA.calendarType,
    gender: DEFAULT_USER_DATA.gender,
    unknownTime: DEFAULT_USER_DATA.unknownTime,
  });
  const [summary, setSummary] = useState<TeaserSummary | null>(null);
  // 엔진 선정 핵심 훅 — AI 호출 없이 제출 즉시 결정론적으로 계산·노출.
  const [coreHook, setCoreHook] = useState<CoreHook | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 무료 기본 리포트 — 2단계 지연 생성.
  // 1단계: 제출 시 키워드 6개만(저렴·빠름) → 아코디언 헤더.
  const [keywords, setKeywords] = useState<string[] | null>(null);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  // 2단계: 첫 섹션 펼침 시 본문 전체(만세력 백색 [SECTION] 장문)를 한 번 생성·캐시.
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  // 늦게 도착한 결과가 "다시 입력하기" 이후 화면에 끼어드는 것 방지용 요청 토큰.
  const reportReqRef = useRef(0);

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

    // 핵심 훅 — 희소성 통계 기반 결정론 선정. 실패해도 요약 표시는 계속.
    try {
      const { dateStr, timeStr, isLunar, isLeap } = teaserInputToDateStrings(input);
      const sajuResult = getSajuData(dateStr, timeStr, isLunar, isLeap, input.unknownTime);
      const daeunResult = getDaeunData(dateStr, timeStr, isLunar, isLeap, input.gender, input.unknownTime);
      const yongshinResult = calculateYongshin(sajuResult);
      const birthYearInt = parseInt(input.birthYear, 10);
      const currentAge = isNaN(birthYearInt) ? 0 : currentSeoulYear - birthYearInt;
      setCoreHook(selectCoreHook({ sajuResult, daeunResult, yongshinResult, currentAge }));
    } catch (e) {
      console.warn('[teaser] core hook failed:', e);
      setCoreHook(null);
    }

    // 이전 진행분 취소 + 2단계 결과 폐기.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    reportReqRef.current++;
    setReport(null);
    setReportError(null);
    setReportLoading(false);

    // AI 한 줄 풀이 — 실패 시 조용히 생략(규칙 요약만 표시)
    setAiComment(null);
    setAiLoading(true);
    fetchTeaserComment(built.ganzhiContext, controller.signal)
      .then((text) => setAiComment(text))
      .catch(() => undefined)
      .finally(() => setAiLoading(false));

    // 1단계: 리포트 섹션 키워드만 생성(저렴). 본문은 첫 펼침 때.
    setKeywords(null);
    setKeywordsError(null);
    setKeywordsLoading(true);
    generateReportKeywords(built.ganzhiContext, controller.signal)
      .then((kw) => setKeywords(kw))
      .catch((e) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        console.error('[teaser] keywords failed:', e);
        setKeywordsError('키워드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      })
      .finally(() => setKeywordsLoading(false));
  };

  /**
   * 2단계: 무료 기본 리포트 본문 생성 — 만세력과 동일한 초급자 [SECTION] 장문.
   * 아코디언 첫 펼침 시 1회 호출(성공하면 캐시, 재호출 방지).
   */
  const generateReport = async () => {
    if (report || reportLoading) return; // 이미 생성됨/진행 중
    const reqId = ++reportReqRef.current;
    setReportError(null);
    setReportLoading(true);
    try {
      const { dateStr, timeStr, isLunar, isLeap } = teaserInputToDateStrings(input);
      const sajuResult = getSajuData(dateStr, timeStr, isLunar, isLeap, input.unknownTime);
      const daeunResult = getDaeunData(dateStr, timeStr, isLunar, isLeap, input.gender, input.unknownTime);
      const yongshinResult = calculateYongshin(sajuResult);
      const gyeokResult = calculateGyeok(sajuResult);

      // 스트리밍: 청크마다 부분 파싱해 아코디언 섹션을 점진적으로 채운다(체감 지연↓).
      let lastTick = 0;
      const { text } = await generateBasicReport({
        sajuResult,
        daeunResult,
        yongshinResult,
        gyeokResult,
        birthYear: input.birthYear,
        userName: input.name,
        mode: 'basic',
        preferredModels: getPreferredGeminiModels(),
        onProgress: (acc) => {
          if (reqId !== reportReqRef.current) return;
          const now = Date.now();
          if (now - lastTick < 250) return; // 과도한 리렌더 억제
          lastTick = now;
          const partial = parseReport(acc);
          if (partial.sections.length > 0) setReport(partial);
        },
      });
      if (reqId !== reportReqRef.current) return; // 추월/취소됨
      const parsed = parseReport(text);
      if (parsed.sections.length === 0) {
        setReport(null); // 재시도 가능하도록 초기화
        setReportError('리포트를 받아오지 못했어요. 아래에서 다시 시도해 주세요.');
      } else {
        setReport(parsed);
      }
    } catch (e) {
      console.error('[teaser] report failed:', e);
      if (reqId !== reportReqRef.current) return;
      setReport(null); // 부분 스트림 폐기 → 재시도 가능
      setReportError(
        isRetryableModelError(e)
          ? '지금 요청이 많아 잠시 지연되고 있어요. 잠시 후 다시 시도해 주세요.'
          : '리포트를 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      if (reqId === reportReqRef.current) setReportLoading(false);
    }
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

            <input
              type="text"
              value={input.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="이름 (선택)"
              className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
              aria-label="이름"
            />

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
            {coreHook && (
              <div className="rounded-2xl border border-ink-300/30 bg-white px-4 py-4 space-y-1.5">
                <p className="text-[12px] text-ink-500">
                  당신의 사주에서 가장 특징적인 포인트
                  {coreHook.rarityPercent != null && ` · 전체의 약 ${formatHookPct(coreHook.rarityPercent)}%`}
                </p>
                <p className="text-[14px] font-bold text-ink-900 leading-relaxed">{coreHook.headline}</p>
                <p className="text-[14px] text-ink-700 leading-relaxed">{coreHook.detail}</p>
                <p className="text-[12px] text-ink-500 pt-1.5">핵심 조언</p>
                <p className="text-[14px] text-ink-700 leading-relaxed">{coreHook.advice}</p>
              </div>
            )}

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
              <div className="border-t border-ink-300/20 pt-3 space-y-2">
                <p className="text-[12px] text-ink-500">AI 핵심 요약</p>
                {aiComment ? (
                  <div className="space-y-1.5">
                    {aiComment
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, i) => {
                        const dash = line.indexOf('—');
                        const topic = dash > 0 ? line.slice(0, dash).trim() : null;
                        const body = dash > 0 ? line.slice(dash + 1).trim() : line;
                        return (
                          <p key={i} className="text-[14px] text-ink-700 leading-relaxed">
                            {topic && <strong className="font-bold text-ink-900">{topic}</strong>}
                            {topic && ' — '}
                            {body}
                          </p>
                        );
                      })}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="h-4 w-3/4 rounded bg-ink-300/20 animate-pulse" />
                    <div className="h-4 w-2/3 rounded bg-ink-300/20 animate-pulse" />
                    <div className="h-4 w-4/5 rounded bg-ink-300/20 animate-pulse" />
                  </div>
                )}
              </div>
            )}

            {(keywordsLoading || keywords || keywordsError) && (
              <div className="border-t border-ink-300/20 pt-3 space-y-3">
                <p className="text-[12px] text-ink-500">기본 운세 리포트 · 키워드를 눌러 펼쳐보세요</p>
                {keywordsError ? (
                  <p className="text-[13px] text-ink-500">{keywordsError}</p>
                ) : keywords ? (
                  <ReportAccordion
                    keywords={keywords}
                    report={report}
                    reportLoading={reportLoading}
                    reportError={reportError}
                    onFirstExpand={() => { void generateReport(); }}
                  />
                ) : (
                  <div className="space-y-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-[52px] rounded-2xl bg-ink-300/15 animate-pulse" />
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-[14px] font-bold text-ink-900 leading-relaxed border-t border-ink-300/20 pt-3">
              더 자세한 당신의 운세는 만세력(FREE)과 유료 리포트에서 확인하세요.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => onOpenManse(input)}
                className="flex-1 py-3 min-h-[44px] rounded-full border-[1.5px] border-ink-900 text-ink-900 font-bold text-[14px] hover:bg-ink-900 hover:text-paper-50 transition-all"
              >
                만세력 자세히 보기
              </button>
              <button
                onClick={onOpenCheckout}
                className="flex-1 py-3 min-h-[44px] rounded-full bg-ink-900 hover:bg-ink-700 text-paper-50 font-bold text-[14px] shadow-lg shadow-ink-700/20 transition-all"
              >
                리포트로 깊이 보기
              </button>
            </div>

            <button
              onClick={() => {
                abortRef.current?.abort();
                reportReqRef.current++; // 진행 중 키워드·리포트 생성 결과 폐기
                setSummary(null);
                setCoreHook(null);
                setAiComment(null);
                setAiLoading(false);
                setKeywords(null);
                setKeywordsError(null);
                setKeywordsLoading(false);
                setReport(null);
                setReportError(null);
                setReportLoading(false);
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
