import React, { Suspense, useMemo } from 'react';
import { motion } from 'motion/react';
import { TAB_TRANSITION } from '../../constants/styles';
import {
  hanjaToHangul,
  calculateDeity,
  getSipseung,
  getShinsal,
  getGongmang,
  getYangin,
  getCheoneulGuiin,
  getMunchang,
  getHakdang,
  isGoegang,
  isWonjin,
  isHyeong,
  isPa,
  isHae,
  isChung,
  getYukhap,
} from '../../utils/saju';
import { PaperBackground } from '../welcome/PaperBackground';
import { HanjaBox } from '../manse/HanjaBox';
import { InsightPanel } from '../manse/InsightPanel';
import { AIReportSection, ReportModeToggle } from '../manse/AIReportSection';
import { parseReport, getSectionByIndex } from '../manse/reportSectionUtils';
import {
  SAJU_GENERAL,
  GYEOK_GENERAL,
  sajuPersonalInsight,
  FIVE_ELEMENTS_GENERAL,
  fiveElementsPersonalInsight,
  JIJANGGAN_GENERAL,
  SIBIUNSEONG_GENERAL,
  HYUNGCHUNG_GENERAL,
  GONGMANG_GENERAL,
  SIBISINSAL_GENERAL,
  SHINSAL_OTHER_GENERAL,
  DAEUN_GENERAL,
  SEUN_GENERAL,
  YONGSHIN_GENERAL,
} from '../manse/insights';

const FiveElementsPieChart = React.lazy(() => import('../FiveElementsPieChart'));

type ActiveTab =
  | 'welcome'
  | 'dashboard'
  | 'taekil'
  | 'chat'
  | 'report'
  | 'guide'
  | 'blog'
  | 'premium'
  | 'order';

interface UserData {
  name: string;
  birthYear: string;
  unknownTime: boolean;
}

interface SajuPillar {
  title: string;
  stem: { hanja: string; element: string; deity?: string };
  branch: { hanja: string; element: string; hangul: string; deity?: string; hidden?: string };
}

interface DaeunYear {
  startAge: number;
  startYear: number;
  stem: string;
  branch: string;
  description: string;
}

interface YongshinResult {
  yongshin: string;
  strength: string;
  score: number;
  eokbuYongshin: string;
  johooStatus: string;
  johooYongshin: string;
  logicBasis: string;
  advice: { color: string; numbers: string; direction: string; action: string };
}

interface GyeokResult {
  composition: string;
  gyeok: string;
}

interface ManseTabProps {
  userData: UserData;
  sajuResult: SajuPillar[];
  daeunResult: DaeunYear[];
  yongshinResult: YongshinResult | null;
  gyeokResult: GyeokResult | null;
  selectedDaeunIdx: number | null;
  setSelectedDaeunIdx: (i: number) => void;
  daeunScrollRef: React.RefObject<HTMLDivElement | null>;
  currentSeoulYear: number;
  setActiveTab: (t: ActiveTab) => void;
  // ── AI 기본 리포트 통합 ──
  reportContent: string | null;
  reportLoading: boolean;
  consultationMode: 'basic' | 'advanced';
  setConsultationMode: (m: 'basic' | 'advanced') => void;
  setReportContent: (v: string | null) => void;
  consultationModeRef: React.MutableRefObject<'basic' | 'advanced'>;
}

// ──────────────────────────────────────────────────────────
// 작은 헬퍼: 섹션 헤더 (한지·먹 톤)
// ──────────────────────────────────────────────────────────
function SectionHeader({ title, badge }: { title: string; hanja?: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <h3 className="font-serif text-[18px] md:text-[22px] font-bold text-ink-900 leading-tight">
        {title}
      </h3>
      {badge}
    </div>
  );
}

const PAPER_CARD =
  'rounded-3xl border border-ink-300/30 bg-paper-50/65 backdrop-blur-sm';
const PAPER_CARD_SHADOW = {
  boxShadow:
    '0 1px 0 rgba(168, 138, 74, 0.08), 0 8px 22px -10px rgba(58, 53, 48, 0.1)',
};

export default function ManseTab({
  userData,
  sajuResult,
  daeunResult,
  yongshinResult,
  gyeokResult,
  selectedDaeunIdx,
  setSelectedDaeunIdx,
  daeunScrollRef,
  currentSeoulYear,
  setActiveTab,
  reportContent,
  reportLoading,
  consultationMode,
  setConsultationMode,
  setReportContent,
  consultationModeRef,
}: ManseTabProps) {
  // ──────────────────────────────────────────────────────────
  // 오행 차트 데이터
  // ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {
      wood: 0,
      fire: 0,
      earth: 0,
      metal: 0,
      water: 0,
    };
    sajuResult
      .filter((p) => !userData.unknownTime || p.title !== '시주')
      .forEach((p) => {
        counts[p.stem.element]++;
        counts[p.branch.element]++;
      });
    return [
      { name: '목(木)', value: counts.wood, color: '#10b981' },
      { name: '화(火)', value: counts.fire, color: '#b8392e' },
      { name: '토(土)', value: counts.earth, color: '#a88a4a' },
      { name: '금(金)', value: counts.metal, color: '#9c8e7e' },
      { name: '수(水)', value: counts.water, color: '#1a1a1a' },
    ].filter((d) => d.value > 0);
  }, [sajuResult, userData.unknownTime]);

  const hiddenStemExposureText = useMemo(() => {
    if (!sajuResult || sajuResult.length === 0) return '';
    const visiblePillars = sajuResult.filter(
      (p) => !userData.unknownTime || p.title !== '시주',
    );
    const heavenlyStems = visiblePillars.map((p) => p.stem.hanja).filter(Boolean);
    const descriptions = visiblePillars
      .map((p) => {
        const hiddenHanguls = p.branch.hidden ? p.branch.hidden.split(', ') : [];
        const hiddenHanjas = hiddenHanguls
          .map(
            (h: string) =>
              Object.keys(hanjaToHangul).find((key) => hanjaToHangul[key] === h) || '',
          )
          .filter(Boolean);
        const exposedHanjas = hiddenHanjas.filter((h) => heavenlyStems.includes(h));
        if (exposedHanjas.length === 0) return '';
        const exposedLabel = exposedHanjas
          .map((h) => `${hanjaToHangul[h]}(${h})`)
          .join(', ');
        return `${p.title} ${p.branch.hangul}(${p.branch.hanja})의 지장간 중 ${exposedLabel}이(가) 천간에 투출되어 실제 작용력이 더 뚜렷하게 드러납니다.`;
      })
      .filter(Boolean);
    if (descriptions.length === 0) return '';
    return `투출 해석: ${descriptions.join(' ')}`;
  }, [sajuResult, userData.unknownTime]);

  const dayStem = sajuResult.find((p) => p.title === '일주')?.stem.hanja || '';

  // ──────────────────────────────────────────────────────────
  // AI 기본 리포트 파싱 (6 섹션)
  // ──────────────────────────────────────────────────────────
  const parsedReport = useMemo(() => parseReport(reportContent), [reportContent]);
  const sec = (idx: number) => getSectionByIndex(parsedReport, idx);

  const hasData = sajuResult.length > 0;
  // AI 호출 진행 중인지
  const aiPending = reportLoading && !reportContent;
  // reportContent가 있는데 섹션이 없으면 에러 문자열로 취급
  const reportError =
    !reportLoading && !!reportContent && parsedReport.sections.length === 0
      ? parsedReport.greeting || 'AI 해설 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      : undefined;

  // 모드 토글 핸들러 — 변경 시 리포트 재생성을 위해 reportContent를 null로
  const handleModeChange = (m: 'basic' | 'advanced') => {
    if (m === consultationMode) return;
    setConsultationMode(m);
    consultationModeRef.current = m;
    setReportContent(null);
  };

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={TAB_TRANSITION}
      className="absolute inset-0 overflow-y-auto hide-scrollbar bg-paper-50"
      data-theme="light"
    >
      <div className="sticky top-0 left-0 w-full h-screen pointer-events-none -mb-[100vh]">
        <PaperBackground />
      </div>

      <div className="relative px-4 py-10 md:py-14 md:px-10">
        {!hasData ? (
          <EmptyState onGoToWelcome={() => setActiveTab('welcome')} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-12 md:space-y-16">
            {/* ─────────── 페이지 헤더 ─────────── */}
            <header className="relative pt-2 pb-2">
              {/* 모드 토글: 우측 상단 한 곳에만 */}
              <div className="absolute top-0 right-0">
                <ReportModeToggle
                  mode={consultationMode}
                  onChange={handleModeChange}
                  disabled={reportLoading}
                />
              </div>
              <div className="text-center space-y-4 pt-14 md:pt-12">
                <h2 className="font-serif text-[28px] md:text-[40px] font-bold text-ink-900 leading-tight">
                  {userData.name}님의 사주 분석
                </h2>
                <p className="text-[14px] text-ink-500 leading-relaxed max-w-2xl mx-auto">
                  태어난 시점의 천간·지지가 그리는 당신만의 지도입니다.<br className="hidden md:block" />
                  각 영역의 의미와 AI가 풀어내는 당신만의 해설을 함께 보여드립니다.
                </p>
              </div>
            </header>

            {/* ─────────── 1. 사주팔자 ─────────── */}
            <section className="space-y-5">
              <SectionHeader title="사주팔자" hanja="四柱八字" />
              <InsightPanel
                general={SAJU_GENERAL}
                personal={dayStem ? sajuPersonalInsight(userData.name, dayStem) : undefined}
              />
              <div className="grid grid-cols-4 gap-3 md:gap-4">
                {sajuResult.map((p, i) => {
                  if (userData.unknownTime && p.title === '시주') return null;
                  return (
                    <div
                      key={i}
                      className={`p-3 md:p-5 ${PAPER_CARD} flex flex-col items-center gap-2`}
                      style={PAPER_CARD_SHADOW}
                    >
                      <span className="text-[12px] font-bold text-ink-500">{p.title}</span>
                      <div className="flex flex-col gap-4 py-2">
                        {[p.stem, p.branch].map((item, j) => (
                          <HanjaBox
                            key={j}
                            hanja={item.hanja}
                            deity={item.deity}
                            deityPosition={j === 0 ? 'top' : 'bottom'}
                            size="md"
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ─────────── 격국 (사주분석 결과) ─────────── */}
            {gyeokResult && (
              <section className="space-y-5">
                <SectionHeader title="격국" hanja="格局" />
                <InsightPanel general={GYEOK_GENERAL} />
                <div className={`${PAPER_CARD} p-6 md:p-8`} style={PAPER_CARD_SHADOW}>
                  <p className="text-[14px] leading-[1.85] text-ink-900 font-medium">
                    {userData.name}님의 사주는{' '}
                    <span className="text-seal font-bold">{gyeokResult.composition}</span>로
                    구성되어 있으며,{' '}
                    <span className="text-seal font-bold">[{gyeokResult.gyeok}]</span>의
                    사주입니다.
                  </p>
                </div>
              </section>
            )}

            {/* ─────────── [AI] SECTION 1: 사주 원국 분석 ─────────── */}
            <AIReportSection
              section={sec(1)}
              loading={aiPending}
              errorMessage={reportError}
              loadingLabel="AI가 사주 전체를 분석하고 있습니다. 해설 생성에 1~2분 정도 소요되니 잠시만 기다려 주세요."
            />

            {/* ─────────── 2. 오행 분포 ─────────── */}
            <section className="space-y-5">
              <SectionHeader title="오행 분포" hanja="五行分布" />
              <InsightPanel
                general={FIVE_ELEMENTS_GENERAL}
                personal={fiveElementsPersonalInsight(chartData)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div
                  className={`p-6 ${PAPER_CARD} flex flex-col justify-center gap-4`}
                  style={PAPER_CARD_SHADOW}
                >
                  <p className="text-[14px] leading-[1.85] text-ink-700 font-medium">
                    {userData.name}님의 오행 분포는{' '}
                    <br className="hidden md:block" />
                    {chartData.map((d) => `${d.name} ${d.value}개`).join(', ')}으로
                    구성되어 있습니다.
                  </p>
                  {yongshinResult &&
                    (() => {
                      const s = yongshinResult.strength as string;
                      const labels: Record<string, { label: string; desc: string }> = {
                        극신강: {
                          label: '극신강 (極身强)',
                          desc: '일간의 기운이 매우 강합니다. 기운을 억제·분산하는 흐름이 유리합니다.',
                        },
                        신강: {
                          label: '신강 (身强)',
                          desc: '일간의 기운이 강한 편입니다. 설기(洩氣)하거나 극(剋)하는 오행이 도움이 됩니다.',
                        },
                        중립: {
                          label: '중화 (中和)',
                          desc: '일간의 강약이 균형 잡혀 있습니다. 현재의 흐름을 유지하면 안정적입니다.',
                        },
                        신약: {
                          label: '신약 (身弱)',
                          desc: '일간의 기운이 약한 편입니다. 일간을 생(生)하거나 비(比)하는 오행이 도움이 됩니다.',
                        },
                        극신약: {
                          label: '극신약 (極身弱)',
                          desc: '일간의 기운이 매우 약합니다. 일간을 강하게 뒷받침하는 오행이 반드시 필요합니다.',
                        },
                      };
                      const info = labels[s] ?? { label: s, desc: '' };
                      return (
                        <div className="rounded-2xl border border-brush-gold/25 bg-paper-100/40 px-4 py-3">
                          <p className="text-[12px] font-bold text-ink-900 mb-1">{info.label}</p>
                          <p className="text-[12px] leading-relaxed text-ink-700">{info.desc}</p>
                        </div>
                      );
                    })()}
                </div>
                <div
                  className={`p-6 ${PAPER_CARD} flex items-center justify-center`}
                  style={PAPER_CARD_SHADOW}
                >
                  <Suspense
                    fallback={<div className="text-[12px] text-ink-500">차트 불러오는 중...</div>}
                  >
                    <FiveElementsPieChart data={chartData} />
                  </Suspense>
                </div>
              </div>
            </section>

            {/* ─────────── [AI] SECTION 4: 오행 밸런스 & 실생활 코칭 ─────────── */}
            <AIReportSection
              section={sec(4)}
              loading={aiPending}
              errorMessage={reportError}
              loadingLabel="오행 밸런스 해설 준비 중..."
            />

            {/* ─────────── 3. 지지와 지장간 ─────────── */}
            <section className="space-y-5">
              <SectionHeader title="지지와 지장간" hanja="地支/地藏干" />
              <InsightPanel
                general={JIJANGGAN_GENERAL}
                personal={hiddenStemExposureText || undefined}
              />
              <div className="grid grid-cols-4 gap-3 md:gap-4">
                {sajuResult.map((p, i) => {
                  if (userData.unknownTime && p.title === '시주') return null;
                  return (
                    <div
                      key={i}
                      className={`p-3 md:p-5 ${PAPER_CARD} flex flex-col items-center gap-2`}
                      style={PAPER_CARD_SHADOW}
                    >
                      <div className="py-2">
                        <HanjaBox
                          hanja={p.branch.hanja}
                          deity={p.branch.deity}
                          deityPosition="bottom"
                          size="md"
                        />
                      </div>
                      <span className="text-[12px] font-bold mt-2 text-ink-700">
                        {p.branch.hangul}({p.branch.hanja})
                      </span>
                      <div className="flex gap-2 mt-4 pb-2">
                        {(p.branch.hidden ? p.branch.hidden.split(', ') : []).map(
                          (h, k, hiddenArray) => {
                            const hanja =
                              Object.keys(hanjaToHangul).find(
                                (key) => hanjaToHangul[key] === h,
                              ) || '';
                            const deity = calculateDeity(dayStem, hanja);
                            const isMain = k === hiddenArray.length - 1;
                            const labels: string[] =
                              hiddenArray.length === 1
                                ? ['본기']
                                : hiddenArray.length === 2
                                ? ['여기', '본기']
                                : ['여기', '중기', '본기'];
                            const label = labels[k];
                            const labelColor =
                              label === '본기'
                                ? 'text-seal'
                                : label === '중기'
                                ? 'text-brush-gold'
                                : 'text-ink-500';
                            return (
                              <div key={k} className="flex flex-col items-center gap-1">
                                <span className={`text-[12px] font-bold ${labelColor}`}>{label}</span>
                                <HanjaBox
                                  hanja={hanja}
                                  size="sm"
                                  deity={deity}
                                  deityPosition="bottom"
                                  highlight={isMain}
                                />
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ─────────── 4. 12운성 ─────────── */}
            <section className="space-y-5">
              <SectionHeader title="12운성" hanja="十二運星" />
              <InsightPanel general={SIBIUNSEONG_GENERAL} />
              <div className="grid grid-cols-4 gap-3 md:gap-4">
                {sajuResult.map((p, i) => {
                  if (userData.unknownTime && p.title === '시주') return null;
                  const unseong = getSipseung(dayStem, p.branch.hanja);
                  const isStrong = ['건록', '제왕', '관대'].includes(unseong);
                  const isMid = ['장생', '목욕', '양', '태'].includes(unseong);
                  return (
                    <div
                      key={i}
                      className={`p-3 md:p-4 ${PAPER_CARD} flex flex-col items-center gap-2`}
                      style={PAPER_CARD_SHADOW}
                    >
                      <span className="text-[12px] font-bold text-ink-500">{p.title}</span>
                      <span className="text-[14px] font-bold text-ink-700">
                        {p.branch.hangul}({p.branch.hanja})
                      </span>
                      <span
                        className={`text-[12px] font-bold px-3 py-1 rounded-full ${
                          isStrong
                            ? 'bg-emerald-700/15 text-emerald-800'
                            : isMid
                            ? 'bg-brush-gold/15 text-brush-gold'
                            : 'bg-ink-500/10 text-ink-500'
                        }`}
                      >
                        {unseong || '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ─────────── 5. 형충회합 ─────────── */}
            <HyungChungSection sajuResult={sajuResult} unknownTime={userData.unknownTime} />

            {/* ─────────── 6. 공망 ─────────── */}
            <GongmangSection sajuResult={sajuResult} unknownTime={userData.unknownTime} />

            {/* ─────────── 7. 12신살 ─────────── */}
            <SibisinsalSection sajuResult={sajuResult} unknownTime={userData.unknownTime} />

            {/* ─────────── 8. 기타 신살 ─────────── */}
            <ShinsalOtherSection sajuResult={sajuResult} unknownTime={userData.unknownTime} />

            {/* ─────────── 9. 대운 ─────────── */}
            <DaeunSection
              userData={userData}
              sajuResult={sajuResult}
              daeunResult={daeunResult}
              selectedDaeunIdx={selectedDaeunIdx}
              setSelectedDaeunIdx={setSelectedDaeunIdx}
              daeunScrollRef={daeunScrollRef}
              currentSeoulYear={currentSeoulYear}
            />

            {/* ─────────── [AI] SECTION 3: 생애 주기별 운세 ─────────── */}
            <AIReportSection
              section={sec(3)}
              loading={aiPending}
              errorMessage={reportError}
              loadingLabel="생애 주기 해설 준비 중..."
            />

            {/* ─────────── 10. 세운 ─────────── */}
            {daeunResult.length > 0 && selectedDaeunIdx !== null && (
              <SeunSection
                userData={userData}
                sajuResult={sajuResult}
                daeun={daeunResult[selectedDaeunIdx]}
                currentSeoulYear={currentSeoulYear}
              />
            )}

            {/* ─────────── [AI] SECTION 2: 대운 & 세운 흐름 ─────────── */}
            <AIReportSection
              section={sec(2)}
              loading={aiPending}
              errorMessage={reportError}
              loadingLabel="대운·세운 해설 준비 중..."
            />

            {/* ─────────── 11. 용신 ─────────── */}
            {yongshinResult && (
              <YongshinSection name={userData.name} yongshin={yongshinResult} />
            )}

            {/* ─────────── [AI] SECTION 5: 용신과 지혜의 길 ─────────── */}
            <AIReportSection
              section={sec(5)}
              loading={aiPending}
              errorMessage={reportError}
              loadingLabel="용신 해설 준비 중..."
            />

            {/* ─────────── [AI] SECTION 6: 테마별 분석 ─────────── */}
            <AIReportSection
              section={sec(6)}
              loading={aiPending}
              errorMessage={reportError}
              loadingLabel="테마별 해설 준비 중..."
            />

            {/* ─────────── Disclaimer ─────────── */}
            <div className={`${PAPER_CARD} p-5 md:p-6`} style={PAPER_CARD_SHADOW}>
              <p className="text-[12px] text-ink-500 leading-relaxed text-center">
                본 분석 결과는 전통 명리학 해석과 AI 보조를 결합한 참고용 자료입니다.
                과학적 사실이 아니며, 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────
function EmptyState({ onGoToWelcome }: { onGoToWelcome: () => void }) {
  return (
    <div className="relative max-w-4xl mx-auto flex flex-col items-center justify-center py-20 px-6 text-center space-y-8">
      <div className="space-y-3">
        <h3 className="font-serif text-[20px] md:text-[24px] font-bold text-ink-900">
          사주 데이터가 없습니다
        </h3>
        <p className="max-w-md mx-auto text-ink-500 text-[14px] leading-relaxed">
          HOME 탭에서 생년월일 정보를 입력하시면
          <br />
          정밀한 만세력 분석과 AI 해설을 함께 확인하실 수 있습니다.
        </p>
      </div>
      <button
        onClick={onGoToWelcome}
        className="inline-flex min-h-[44px] items-center justify-center px-8 py-4 rounded-full bg-ink-900 text-paper-50 font-bold shadow-md hover:bg-ink-700 transition-all"
      >
        정보 입력하러 가기
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 형충회합
// ──────────────────────────────────────────────────────────
function HyungChungSection({
  sajuResult,
  unknownTime,
}: {
  sajuResult: SajuPillar[];
  unknownTime: boolean;
}) {
  if (sajuResult.length < 2) return null;

  const pillars = sajuResult.filter((p) => !(unknownTime && p.title === '시주'));
  const pillarLabel = (t: string) =>
    t === '년주' ? '연지' : t === '월주' ? '월지' : t === '일주' ? '일지' : t === '시주' ? '시지' : t;
  const pillarDomain = (l: string) =>
    l === '연지'
      ? '조상·뿌리·초년기'
      : l === '월지'
      ? '부모·직장·사회'
      : l === '일지'
      ? '배우자·가정·자신'
      : l === '시지'
      ? '자녀·말년·미래'
      : '';
  const josaWa = (h: string) => (['丑', '寅', '辰', '申', '戌'].includes(h) ? '과' : '와');
  const josaGa = (h: string) => (['丑', '寅', '辰', '申', '戌'].includes(h) ? '이' : '가');

  type Rel = { p1: string; p2: string; b1: string; b2: string; sentence: string };
  const relations: Rel[] = [];

  for (let a = 0; a < pillars.length; a++) {
    for (let b = a + 1; b < pillars.length; b++) {
      const b1 = pillars[a].branch.hanja;
      const b2 = pillars[b].branch.hanja;
      const p1 = pillarLabel(pillars[a].title);
      const p2 = pillarLabel(pillars[b].title);
      const d1 = pillarDomain(p1);
      const d2 = pillarDomain(p2);
      const bh1 = hanjaToHangul[b1];
      const bh2 = hanjaToHangul[b2];

      if (isChung(b1, b2)) {
        relations.push({
          p1,
          p2,
          b1,
          b2,
          sentence: `${bh1}${bh2}충을 이룹니다. 강한 에너지 충돌로 ${d1}과 ${d2} 축이 부딪히며, 이사·이직·이별·큰 계획 전환 같은 변동이 촉발되기 쉽습니다.`,
        });
      }
      if (isHyeong(b1, b2)) {
        const self = b1 === b2;
        relations.push({
          p1,
          p2,
          b1,
          b2,
          sentence: self
            ? `${bh1}${bh2} 자형(自刑)을 이룹니다. 같은 글자가 겹쳐 스스로를 찌르는 형태로, ${d1}·${d2} 영역의 내면 갈등·자책·건강 관리 이슈로 드러나기 쉽습니다.`
            : `${bh1}${bh2}형을 이룹니다. 마찰·구설·수술·법적 분쟁의 소지가 있고, 같은 글자가 돌아오는 세운에 갈등이 표면화되기 쉽습니다.`,
        });
      }
      if (isHae(b1, b2)) {
        relations.push({
          p1,
          p2,
          b1,
          b2,
          sentence: `${bh1}${bh2}해를 이룹니다. ${d1}과 ${d2} 사이에 은근한 방해·배신·오해·지체가 잠복하며, 겉으로 드러나지 않는 갈등으로 작용합니다.`,
        });
      }
      if (isPa(b1, b2)) {
        relations.push({
          p1,
          p2,
          b1,
          b2,
          sentence: `${bh1}${bh2}파를 이룹니다. 일시적인 단절·깨짐을 암시하며, 충·형보다 약하지만 ${d1}과 ${d2} 축에 작은 균열이 반복됩니다.`,
        });
      }
      const yukhap = getYukhap(b1, b2);
      if (yukhap) {
        relations.push({
          p1,
          p2,
          b1,
          b2,
          sentence: `${bh1}${bh2} 육합(${yukhap})을 이룹니다. 두 지지가 화합·결합하여 ${d1}과 ${d2} 사이에 협력·계약·인연의 유리한 배경을 제공합니다.`,
        });
      }
      if (isWonjin(b1, b2)) {
        relations.push({
          p1,
          p2,
          b1,
          b2,
          sentence: `${bh1}${bh2} 원진을 이룹니다. 서로를 미워하는 기운이 흘러 ${d1}과 ${d2} 관계에서 원망·질시·지속적인 불화로 드러나기 쉽습니다.`,
        });
      }
    }
  }

  const allBranches = pillars.map((p) => p.branch.hanja);
  const samhapGroups = [
    { combo: ['申', '子', '辰'], name: '수삼합', meaning: '지혜·흐름·재물' },
    { combo: ['巳', '酉', '丑'], name: '금삼합', meaning: '결단·원칙·마무리' },
    { combo: ['寅', '午', '戌'], name: '화삼합', meaning: '열정·추진·창의' },
    { combo: ['亥', '卯', '未'], name: '목삼합', meaning: '성장·학문·인덕' },
  ];
  const samhapSentences: string[] = [];
  for (const { combo, name, meaning } of samhapGroups) {
    const matched = combo.filter((b) => allBranches.includes(b));
    if (matched.length >= 2) {
      const full = matched.length === 3;
      const mk = matched.map((b) => hanjaToHangul[b]).join('·');
      samhapSentences.push(
        full
          ? `${name}(${mk})이 완전히 구성되어 ${meaning}의 기운이 강하게 모입니다. 인생 전반의 방향성이 이 주제로 수렴되는 구조입니다.`
          : `${name} 반합(${mk})이 구성되어 ${meaning}의 기운이 어느 정도 모입니다. 빠진 한 글자가 돌아오는 세운·대운에 완전한 국이 성립되어 해당 주제의 일이 크게 불거집니다.`,
      );
    }
  }

  const banghapGroups = [
    { combo: ['寅', '卯', '辰'], name: '동방목국', ohaeng: '목', season: '봄의 성장' },
    { combo: ['巳', '午', '未'], name: '남방화국', ohaeng: '화', season: '여름의 활발' },
    { combo: ['申', '酉', '戌'], name: '서방금국', ohaeng: '금', season: '가을의 수확' },
    { combo: ['亥', '子', '丑'], name: '북방수국', ohaeng: '수', season: '겨울의 저장' },
  ];
  const banghapSentences: string[] = [];
  for (const { combo, name, ohaeng, season } of banghapGroups) {
    const matched = combo.filter((b) => allBranches.includes(b));
    if (matched.length >= 2) {
      const full = matched.length === 3;
      const mk = matched.map((b) => hanjaToHangul[b]).join('·');
      banghapSentences.push(
        full
          ? `${name}(${mk})이 완전히 구성되어 ${season} 기운이 모이고 ${ohaeng} 오행이 크게 강해집니다.`
          : `${name} 반합(${mk})이 구성되어 ${season} 기운이 부분적으로 모이고 ${ohaeng} 오행이 보강됩니다.`,
      );
    }
  }

  const isEmpty =
    relations.length === 0 && samhapSentences.length === 0 && banghapSentences.length === 0;

  return (
    <section className="space-y-5">
      <SectionHeader title="형충회합" hanja="刑沖會合" />
      <InsightPanel general={HYUNGCHUNG_GENERAL} />
      <div className={`p-5 md:p-6 ${PAPER_CARD}`} style={PAPER_CARD_SHADOW}>
        {isEmpty ? (
          <p className="text-[14px] text-ink-700 leading-relaxed">
            원국 지지 사이에 특별한 형·충·회·합 관계가 감지되지 않습니다. 큰 변동 신호가 약하고, 전반적으로 안정적인 구조입니다.
          </p>
        ) : (
          <ul className="space-y-3 list-disc pl-5">
            {relations.map((r, i) => (
              <li key={`r-${i}`} className="text-[14px] leading-[1.85] text-ink-700">
                <span className="font-bold text-ink-900">
                  {r.p1}의 {hanjaToHangul[r.b1]}({r.b1})
                </span>
                {josaWa(r.b1)}{' '}
                <span className="font-bold text-ink-900">
                  {r.p2}의 {hanjaToHangul[r.b2]}({r.b2})
                </span>
                {josaGa(r.b2)} {r.sentence}
              </li>
            ))}
            {samhapSentences.map((s, i) => (
              <li key={`sh-${i}`} className="text-[14px] leading-[1.85] text-ink-700">
                {s}
              </li>
            ))}
            {banghapSentences.map((s, i) => (
              <li key={`bh-${i}`} className="text-[14px] leading-[1.85] text-ink-700">
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// 공망
// ──────────────────────────────────────────────────────────
function GongmangSection({
  sajuResult,
  unknownTime,
}: {
  sajuResult: SajuPillar[];
  unknownTime: boolean;
}) {
  if (sajuResult.length < 3) return null;

  const yearStem = sajuResult.find((p) => p.title === '년주')?.stem.hanja || '';
  const yearBranch = sajuResult.find((p) => p.title === '년주')?.branch.hanja || '';
  const monthStem = sajuResult.find((p) => p.title === '월주')?.stem.hanja || '';
  const monthBranch = sajuResult.find((p) => p.title === '월주')?.branch.hanja || '';
  const dayStem = sajuResult.find((p) => p.title === '일주')?.stem.hanja || '';
  const dayBranch = sajuResult.find((p) => p.title === '일주')?.branch.hanja || '';
  const yearGongmang = getGongmang(yearStem, yearBranch);
  const monthGongmang = getGongmang(monthStem, monthBranch);
  const dayGongmang = getGongmang(dayStem, dayBranch);

  const pillars = sajuResult.filter((p) => !(unknownTime && p.title === '시주'));
  const pillarLabel = (t: string) =>
    t === '년주' ? '연지' : t === '월주' ? '월지' : t === '일주' ? '일지' : t === '시주' ? '시지' : t;
  const pillarDomain = (l: string) =>
    l === '연지'
      ? '조상·뿌리·초년기'
      : l === '월지'
      ? '부모·직장·사회'
      : l === '일지'
      ? '배우자·가정·자신'
      : l === '시지'
      ? '자녀·말년·미래'
      : '';
  const josaGa = (h: string) => (['丑', '寅', '辰', '申', '戌'].includes(h) ? '이' : '가');

  const describe = (label: string, gm: string[], key: string) => {
    if (!gm || gm.length === 0) return null;
    const matches = pillars
      .filter((p) => gm.includes(p.branch.hanja))
      .map((p) => ({ pos: pillarLabel(p.title), branch: p.branch.hanja }));
    const gmKor = gm.map((b) => `${hanjaToHangul[b]}(${b})`).join('·');
    return (
      <li key={key} className="text-[14px] leading-[1.85] text-ink-700">
        <span className="font-bold text-ink-900">
          {label} 공망은 {gmKor}
        </span>
        {'입니다. '}
        {matches.length === 0
          ? '원국에 해당 지지가 나타나 있지 않아 직접적 공망 작용은 발현되지 않습니다.'
          : matches.map((m, i) => (
              <span key={i}>
                <span className="font-bold text-brush-gold">
                  {m.pos}의 {hanjaToHangul[m.branch]}({m.branch})
                </span>
                {josaGa(m.branch)} 공망에 해당합니다. {pillarDomain(m.pos)} 영역의 실질 작용이 비어있는 상태로, 해당 자리가 상징하는 것에 허탈감·공허감을 느끼기 쉽고 물질적 성취가 약하게 나타납니다. 정신적·종교적·예술적 방향으로 전환하면 오히려 긍정적으로 활용할 수 있습니다.
                {i < matches.length - 1 ? ' ' : ''}
              </span>
            ))}
      </li>
    );
  };

  return (
    <section className="space-y-5">
      <SectionHeader title="공망" hanja="空亡" />
      <InsightPanel general={GONGMANG_GENERAL} />
      <div className={`p-5 md:p-6 ${PAPER_CARD}`} style={PAPER_CARD_SHADOW}>
        <ul className="space-y-3 list-disc pl-5">
          {describe('연주 기준', yearGongmang, 'year')}
          {describe('월주 기준', monthGongmang, 'month')}
          {describe('일주 기준', dayGongmang, 'day')}
        </ul>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// 12신살
// ──────────────────────────────────────────────────────────
const SHINSAL_DESC: Record<string, string> = {
  겁살: '재물과 기운이 외부로 빠져나가는 기운입니다. 강한 경쟁과 도전이 따르며, 재물 관리와 계약에 신중함이 필요합니다.',
  재살: '재난·구설수의 기운입니다. 예상치 못한 사고나 건강 이슈가 불쑥 나타날 수 있어 주의가 필요합니다.',
  천살: '하늘의 시험을 받는 기운으로, 계획하지 않은 변수가 발생하기 쉬운 자리입니다.',
  지살: '이동·여행·변화의 기운입니다. 한곳에 오래 머무르기보다 새로운 환경으로 나아가는 흐름이 자주 찾아옵니다.',
  년살: '인기와 매력의 기운으로, 도화살과 유사한 작용을 합니다. 대인관계가 넓고 이성 인연이 많이 따릅니다.',
  월살: '막힘과 지체의 기운입니다. 계획이 뜻대로 풀리지 않거나, 고집으로 인해 어려움이 생기기도 합니다.',
  망신살: '체면과 명예가 손상되는 기운입니다. 언행을 신중히 하고 충동적인 행동을 자제하는 것이 중요합니다.',
  장성살: '강한 추진력과 리더십의 기운입니다. 목표를 향해 밀고 나가는 힘이 강하고, 주변을 이끄는 역할을 하게 됩니다.',
  반안살: '기존의 것이 무너지고 새 것이 세워지는 전환의 기운입니다. 변화에 유연하게 대처하면 오히려 도약의 기회가 됩니다.',
  역마살: '이동과 분주함의 기운입니다. 여행·이직·이사가 잦고, 한 자리보다 늘 새로운 곳을 향해 달리는 에너지가 있습니다.',
  육해살: '인간관계에서 보이지 않는 방해와 갈등이 잠복하는 기운입니다. 주변의 도움이 기대만큼 이어지지 않을 수 있습니다.',
  화개살: '예술·종교·철학적 기질이 강한 기운입니다. 정신세계가 깊고 고독을 즐기는 면이 있으며, 창작·수행·연구 분야에 소질이 있습니다.',
  도화: '매력과 인기의 기운입니다. 이성에게 인기가 있고 예술적 감각이 뛰어나며, 사람을 끌어당기는 힘이 있습니다.',
};

function SibisinsalSection({
  sajuResult,
  unknownTime,
}: {
  sajuResult: SajuPillar[];
  unknownTime: boolean;
}) {
  if (sajuResult.length < 3) return null;
  const yearBranch = sajuResult.find((p) => p.title === '년주')?.branch.hanja || '';
  const dayBranch = sajuResult.find((p) => p.title === '일주')?.branch.hanja || '';
  const pillars = sajuResult.filter((p) => !(unknownTime && p.title === '시주'));

  const posLabel = (t: string) =>
    t === '년주' ? '연지' : t === '월주' ? '월지' : t === '일주' ? '일지' : '시지';
  const josaNeun = (h: string) => (['丑', '寅', '辰', '申', '戌'].includes(h) ? '은' : '는');

  // 연지·일지 기준 신살을 수집하고, 같은 위치·같은 신살은 기준만 합산
  type Entry = { pos: string; branchHanja: string; branchHangul: string; shinsal: string; bases: string[] };
  const map = new Map<string, Entry>();

  const add = (pillar: SajuPillar, shinsal: string, basis: string) => {
    if (!shinsal) return;
    const key = `${pillar.title}-${shinsal}`;
    if (map.has(key)) {
      map.get(key)!.bases.push(basis);
    } else {
      map.set(key, {
        pos: posLabel(pillar.title),
        branchHanja: pillar.branch.hanja,
        branchHangul: hanjaToHangul[pillar.branch.hanja] || pillar.branch.hangul,
        shinsal,
        bases: [basis],
      });
    }
  };

  pillars.forEach((p) => {
    add(p, getShinsal(yearBranch, p.branch.hanja), '연지');
    add(p, getShinsal(dayBranch, p.branch.hanja), '일지');
  });

  const entries = Array.from(map.values());

  return (
    <section className="space-y-5">
      <SectionHeader title="12신살" />
      <InsightPanel general={SIBISINSAL_GENERAL} />
      <div className={`p-5 md:p-6 ${PAPER_CARD}`} style={PAPER_CARD_SHADOW}>
        {entries.length === 0 ? (
          <p className="text-[14px] text-ink-700 leading-relaxed">
            원국에서 특별히 두드러지는 신살이 발견되지 않습니다.
          </p>
        ) : (
          <ul className="space-y-3 list-disc pl-5">
            {entries.map((e, i) => (
              <li key={i} className="text-[14px] leading-[1.85] text-ink-700">
                <span className="font-bold text-ink-900">
                  {e.pos}의 {e.branchHangul}({e.branchHanja})
                </span>
                {josaNeun(e.branchHanja)}{' '}
                {e.bases.join('·')} 기준으로{' '}
                <span className="font-bold text-ink-900">{e.shinsal}</span>
                에 해당합니다.{' '}
                {SHINSAL_DESC[e.shinsal] ?? ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// 기타 신살
// ──────────────────────────────────────────────────────────
function ShinsalOtherSection({
  sajuResult,
  unknownTime,
}: {
  sajuResult: SajuPillar[];
  unknownTime: boolean;
}) {
  if (sajuResult.length < 3) return null;
  const dayStem = sajuResult.find((p) => p.title === '일주')?.stem.hanja || '';
  const dayBranch = sajuResult.find((p) => p.title === '일주')?.branch.hanja || '';
  const pillars = sajuResult.filter((p) => !(unknownTime && p.title === '시주'));

  const yanginBranch = getYangin(dayStem);
  const cheoneul = getCheoneulGuiin(dayStem);
  const munchang = getMunchang(dayStem);
  const hakdang = getHakdang(dayStem);
  const goegang = isGoegang(dayStem, dayBranch);

  const findPillarsWith = (target: string) =>
    pillars.filter((p) => p.branch.hanja === target).map((p) => p.title).join('·');
  const findPillarsByArr = (branches: string[]) =>
    pillars
      .filter((p) => branches.includes(p.branch.hanja))
      .map((p) => `${p.title}(${hanjaToHangul[p.branch.hanja]})`)
      .join('·');

  type TextItem = { position: string; name: string; desc: string; impact: string };
  const items: TextItem[] = [];

  if (yanginBranch) {
    const hit = findPillarsWith(yanginBranch);
    if (hit) {
      items.push({
        position: `${hit}의 ${hanjaToHangul[yanginBranch]}(${yanginBranch})`,
        name: '양인살(羊刃)',
        desc: '강한 일간 기운이 극단으로 치달을 때 발현하는 살기로, 고집과 과격함이 드러날 수 있습니다. 절제하면 강한 추진력과 결단력으로 전환되며, 의료·법조·군경 분야와 친화력이 높습니다.',
        impact: '영향력 강함 — 다스리는 만큼 강력한 자산이 되고, 방치하면 충돌과 사고의 위험이 따릅니다.',
      });
    }
  }
  if (cheoneul.length > 0) {
    const hit = findPillarsByArr(cheoneul);
    if (hit) {
      items.push({
        position: hit,
        name: '천을귀인(天乙貴人)',
        desc: '사주에서 가장 강력한 귀인입니다. 위기의 순간마다 구원자가 나타나고, 고귀한 인연과 후원자가 뒤따르며, 큰 어려움을 타개하는 보호막이 됩니다.',
        impact: '영향력 매우 강함 — 평생에 걸쳐 귀인의 도움이 반복되며, 어려울수록 더 빛나는 기운입니다.',
      });
    }
  }
  if (munchang) {
    const hit = findPillarsWith(munchang);
    if (hit) {
      items.push({
        position: `${hit}의 ${hanjaToHangul[munchang]}(${munchang})`,
        name: '문창귀인(文昌貴人)',
        desc: '학문·문서·계약에 유리한 귀인입니다. 문필과 예술적 재능이 뛰어나고, 시험·자격증·서류 작업에서 도움을 받는 기운입니다.',
        impact: '영향력 강함 — 지적 탐구와 기록·발표 영역에서 재능이 두드러집니다.',
      });
    }
  }
  if (hakdang) {
    const hit = findPillarsWith(hakdang);
    if (hit) {
      items.push({
        position: `${hit}의 ${hanjaToHangul[hakdang]}(${hakdang})`,
        name: '학당귀인(學堂貴人)',
        desc: '배움과 연구에 탁월한 귀인입니다. 전문 지식을 쌓는 데 유리하고, 교육 환경에서 잘 성장하는 기운입니다.',
        impact: '영향력 중간 — 학업·자격·전문직 분야에서 두드러지게 작용합니다.',
      });
    }
  }
  if (goegang) {
    items.push({
      position: `일주 ${hanjaToHangul[dayStem]}${hanjaToHangul[dayBranch]}(${dayStem}${dayBranch})`,
      name: '괴강살(魁罡)',
      desc: '일주에만 성립하는 강렬한 살입니다. 총명하고 강한 카리스마를 지니지만 고집이 세고 충돌이 잦습니다. 부귀와 고난이 함께 오며, 끝까지 밀어붙이는 결단력이 성공의 열쇠입니다.',
      impact: '영향력 매우 강함 — 성공과 좌절의 진폭이 크고, 다스리는 만큼 명예가 따릅니다.',
    });
  }
  const wonjinPairs: string[] = [];
  for (let a = 0; a < pillars.length; a++) {
    for (let b = a + 1; b < pillars.length; b++) {
      if (isWonjin(pillars[a].branch.hanja, pillars[b].branch.hanja)) {
        wonjinPairs.push(`${pillars[a].title}↔${pillars[b].title}`);
      }
    }
  }
  if (wonjinPairs.length > 0) {
    items.push({
      position: `${wonjinPairs.join(', ')} 사이`,
      name: '원진살(怨嗔)',
      desc: '서로를 미워하고 원망하는 기운이 흘러, 해당 자리 간에 원망·반목·지속적인 불화로 드러나기 쉽습니다.',
      impact: '영향력 중간~강함 — 해당 자리가 상징하는 가족·인연과의 갈등이 반복될 수 있습니다.',
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="space-y-5">
      <SectionHeader title="귀인 및 기타 신살" />
      <InsightPanel general={SHINSAL_OTHER_GENERAL} />
      <div className={`p-5 md:p-6 ${PAPER_CARD}`} style={PAPER_CARD_SHADOW}>
        <ul className="space-y-3 list-disc pl-5">
          {items.map((item, i) => (
            <li key={i} className="text-[14px] leading-[1.85] text-ink-700">
              <span className="font-bold text-ink-900">{item.position}</span>에{' '}
              <span className="font-bold text-ink-900">{item.name}</span>이 있습니다.{' '}
              {item.desc}{' '}
              <span className="font-bold text-brush-gold">{item.impact}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// 대운
// ──────────────────────────────────────────────────────────
function DaeunSection({
  userData,
  sajuResult,
  daeunResult,
  selectedDaeunIdx,
  setSelectedDaeunIdx,
  daeunScrollRef,
  currentSeoulYear,
}: {
  userData: UserData;
  sajuResult: SajuPillar[];
  daeunResult: DaeunYear[];
  selectedDaeunIdx: number | null;
  setSelectedDaeunIdx: (i: number) => void;
  daeunScrollRef: React.RefObject<HTMLDivElement | null>;
  currentSeoulYear: number;
}) {
  const dayStem = sajuResult.find((p) => p.title === '일주')?.stem.hanja || '';
  const yearBranch = sajuResult.find((p) => p.title === '년주')?.branch.hanja || '';
  const yearStem = sajuResult.find((p) => p.title === '년주')?.stem.hanja || '';

  const currentAge = currentSeoulYear - parseInt(userData.birthYear) + 1;
  const currentDaeunIdx = daeunResult.findIndex(
    (dy, i) =>
      currentAge >= dy.startAge &&
      (i === daeunResult.length - 1 || currentAge < daeunResult[i + 1].startAge),
  );
  const currentDaeun = currentDaeunIdx >= 0 ? daeunResult[currentDaeunIdx] : null;
  const isTransitioning =
    currentDaeun != null && Math.abs(currentAge - currentDaeun.startAge) <= 1;

  return (
    <section className="space-y-5">
      <SectionHeader
        title="대운분석"
        hanja="大運分析"
        badge={
          daeunResult.length > 0 ? (
            <span className="text-[12px] font-bold text-ink-900 bg-paper-100/70 border border-brush-gold/30 px-3 py-1 rounded-full">
              {daeunResult[0].startAge}대운부터
            </span>
          ) : undefined
        }
      />
      <InsightPanel general={DAEUN_GENERAL} />
      <div className={`p-5 md:p-6 ${PAPER_CARD}`} style={PAPER_CARD_SHADOW}>
        <div
          ref={daeunScrollRef}
          className="flex overflow-x-auto horizontal-scrollbar gap-5 pb-6 snap-x snap-mandatory scroll-smooth"
        >
          {daeunResult.length > 0 ? (
            daeunResult.map((dy, i) => {
              const isCurrent = i === currentDaeunIdx;
              const isSelected = selectedDaeunIdx === i;
              const unseong = getSipseung(dayStem, dy.branch);
              const shinsal = getShinsal(yearBranch, dy.branch);
              const gongmangList = getGongmang(yearStem, yearBranch);
              const isGongmang = gongmangList.includes(dy.branch);
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDaeunIdx(i)}
                  className={`w-28 shrink-0 snap-center p-4 rounded-3xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-ink-900 bg-ink-900 text-paper-50 shadow-md scale-110 z-10'
                      : isSelected
                      ? 'border-brush-gold/60 bg-paper-100/70 ring-2 ring-brush-gold/30 scale-105 z-10'
                      : 'border-ink-300/30 bg-paper-50/50 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="text-[12px] font-bold">{dy.startAge}세</div>
                  <div className="flex flex-col gap-4 py-2">
                    {[dy.stem, dy.branch].map((hanja, j) => {
                      const isBranch = j === 1;
                      const deity = calculateDeity(dayStem, hanja, isBranch);
                      return (
                        <HanjaBox
                          key={j}
                          hanja={hanja}
                          deity={deity}
                          deityPosition={j === 0 ? 'top' : 'bottom'}
                          size="md"
                        />
                      );
                    })}
                  </div>
                  <div className="text-[12px] font-bold">
                    {hanjaToHangul[dy.stem]}
                    {hanjaToHangul[dy.branch]}
                  </div>
                  {unseong && (
                    <div
                      className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${
                        isCurrent
                          ? 'bg-paper-50/20 text-paper-50'
                          : ['건록', '제왕', '관대'].includes(unseong)
                          ? 'bg-emerald-700/15 text-emerald-800'
                          : ['장생', '목욕', '양', '태'].includes(unseong)
                          ? 'bg-brush-gold/15 text-brush-gold'
                          : 'bg-ink-300/15 text-ink-500'
                      }`}
                    >
                      {unseong}
                    </div>
                  )}
                  {shinsal && (
                    <div
                      className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full ${
                        isCurrent
                          ? 'bg-paper-50/20 text-paper-50'
                          : ['도화', '역마살'].includes(shinsal)
                          ? 'bg-seal/15 text-seal'
                          : ['겁살', '재살', '천살', '망신살'].includes(shinsal)
                          ? 'bg-ink-700/10 text-ink-700'
                          : 'bg-ink-300/15 text-ink-500'
                      }`}
                    >
                      {shinsal}
                    </div>
                  )}
                  {isGongmang && (
                    <div
                      className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full ${
                        isCurrent
                          ? 'bg-paper-50/20 text-paper-50'
                          : 'bg-brush-gold/20 text-brush-gold'
                      }`}
                    >
                      공망
                    </div>
                  )}
                  {isCurrent && isTransitioning && (
                    <div className="mt-1 px-2 py-0.5 bg-seal/30 text-seal text-[12px] font-bold rounded-full animate-pulse">
                      교운기
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-[14px] py-8 w-full text-center text-ink-500">
              분석을 시작하면 대운이 표시됩니다.
            </div>
          )}
        </div>
      </div>

      {currentDaeun && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 md:p-7 ${PAPER_CARD} border-brush-gold/40`}
          style={PAPER_CARD_SHADOW}
        >
          <div className="space-y-4">
            <h4 className="font-serif text-[15px] md:text-[18px] font-bold text-ink-900">
              현재 대운: {currentDaeun.startAge}세{' '}
              {hanjaToHangul[currentDaeun.stem]}
              {hanjaToHangul[currentDaeun.branch]}대운
            </h4>
            <p className="text-[14px] leading-[1.85] text-ink-700 italic font-medium">
              "{currentDaeun.description}"
            </p>
            {isTransitioning && (
              <div className="p-4 rounded-2xl border border-seal/30 bg-seal/5">
                <p className="text-[14px] text-ink-700 leading-relaxed">
                  현재 <strong className="text-seal">교운기(인생의 변동기)</strong>에 진입해 있습니다. 환경의 변화나 심리적 변동이 클 수 있으니 신중한 판단이 필요합니다.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// 세운
// ──────────────────────────────────────────────────────────
function SeunSection({
  userData,
  sajuResult,
  daeun,
  currentSeoulYear,
}: {
  userData: UserData;
  sajuResult: SajuPillar[];
  daeun: DaeunYear;
  currentSeoulYear: number;
}) {
  const STEMS_LIST = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const BRANCHES_LIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const seunList = Array.from({ length: 10 }, (_, i) => {
    const year = daeun.startYear + i;
    const stem = STEMS_LIST[(year + 6) % 10];
    const branch = BRANCHES_LIST[(year + 8) % 12];
    const age = year - parseInt(userData.birthYear) + 1;
    return { year, stem, branch, age };
  });
  const dayStem = sajuResult.find((p) => p.title === '일주')?.stem.hanja || '';
  const yearBranch = sajuResult.find((p) => p.title === '년주')?.branch.hanja || '';
  const yearStem = sajuResult.find((p) => p.title === '년주')?.stem.hanja || '';
  const gongmangList = getGongmang(yearStem, yearBranch);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="세운분석"
        hanja="歲運分析"
        badge={
          <span className="text-[12px] font-bold text-ink-900 bg-paper-100/70 border border-brush-gold/30 px-3 py-1 rounded-full">
            {daeun.startAge}세 {hanjaToHangul[daeun.stem]}
            {hanjaToHangul[daeun.branch]}대운 기간
          </span>
        }
      />
      <InsightPanel general={SEUN_GENERAL} />
      <div className={`p-5 md:p-6 ${PAPER_CARD}`} style={PAPER_CARD_SHADOW}>
        <div className="flex overflow-x-auto horizontal-scrollbar gap-3 pb-6 snap-x snap-mandatory scroll-smooth">
          {seunList.map((sy, i) => {
            const isCurrent = sy.year === currentSeoulYear;
            const isPast = sy.year < currentSeoulYear;
            const unseong = getSipseung(dayStem, sy.branch);
            const shinsal = getShinsal(yearBranch, sy.branch);
            const isGongmang = gongmangList.includes(sy.branch);
            return (
              <div
                key={i}
                className={`w-24 shrink-0 snap-center p-3 rounded-3xl border flex flex-col items-center gap-1.5 transition-all ${
                  isCurrent
                    ? 'border-ink-900 bg-ink-900 text-paper-50 shadow-md scale-110 z-10'
                    : isPast
                    ? 'border-ink-300/20 bg-paper-50/30 opacity-50'
                    : 'border-ink-300/30 bg-paper-50/60 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="text-[12px] font-bold">{sy.year}</div>
                <div className="text-[12px]">{sy.age}세</div>
                <div className="flex flex-col gap-3 py-1">
                  {[sy.stem, sy.branch].map((hanja, j) => {
                    const isBranch = j === 1;
                    const deity = calculateDeity(dayStem, hanja, isBranch);
                    return (
                      <HanjaBox
                        key={j}
                        hanja={hanja}
                        deity={deity}
                        deityPosition={j === 0 ? 'top' : 'bottom'}
                        size="sm"
                      />
                    );
                  })}
                </div>
                <div className="text-[12px] font-bold">
                  {hanjaToHangul[sy.stem]}
                  {hanjaToHangul[sy.branch]}
                </div>
                {unseong && (
                  <div
                    className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full ${
                      isCurrent
                        ? 'bg-paper-50/20 text-paper-50'
                        : ['건록', '제왕', '관대'].includes(unseong)
                        ? 'bg-emerald-700/15 text-emerald-800'
                        : ['장생', '목욕', '양', '태'].includes(unseong)
                        ? 'bg-brush-gold/15 text-brush-gold'
                        : 'bg-ink-300/15 text-ink-500'
                    }`}
                  >
                    {unseong}
                  </div>
                )}
                {shinsal && (
                  <div
                    className={`text-[12px] font-bold px-1 py-0.5 rounded-full ${
                      isCurrent
                        ? 'bg-paper-50/20 text-paper-50'
                        : ['도화', '역마살'].includes(shinsal)
                        ? 'bg-seal/15 text-seal'
                        : ['겁살', '재살', '천살', '망신살'].includes(shinsal)
                        ? 'bg-ink-700/10 text-ink-700'
                        : 'bg-ink-300/15 text-ink-500'
                    }`}
                  >
                    {shinsal}
                  </div>
                )}
                {isGongmang && (
                  <div
                    className={`text-[12px] font-bold px-1 py-0.5 rounded-full ${
                      isCurrent
                        ? 'bg-paper-50/20 text-paper-50'
                        : 'bg-brush-gold/20 text-brush-gold'
                    }`}
                  >
                    공망
                  </div>
                )}
                {isCurrent && (
                  <div className="px-1.5 py-0.5 bg-seal/30 text-seal text-[12px] font-bold rounded-full">
                    올해
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// 용신
// ──────────────────────────────────────────────────────────
function YongshinSection({ name, yongshin }: { name: string; yongshin: YongshinResult }) {
  return (
    <section className="space-y-5">
      <SectionHeader title="용신 정밀 분석" hanja="用神精密" />
      <InsightPanel general={YONGSHIN_GENERAL} />
      <div className={`p-6 md:p-8 ${PAPER_CARD} space-y-6 md:space-y-8`} style={PAPER_CARD_SHADOW}>
        <h4 className="font-serif text-[22px] md:text-[28px] font-bold text-ink-900">
          {name}님의 용신: <span className="text-seal">{yongshin.yongshin}</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 md:p-5 rounded-2xl border border-ink-300/25 bg-paper-100/40">
            <p className="text-[14px] md:text-[16px] font-bold text-ink-900">
              {yongshin.strength} ({yongshin.score}점)
            </p>
            <p className="text-[14px] text-seal mt-2 font-bold">
              억부용신: {yongshin.eokbuYongshin}
            </p>
          </div>
          <div className="p-4 md:p-5 rounded-2xl border border-ink-300/25 bg-paper-100/40">
            <p className="text-[14px] md:text-[16px] font-bold text-ink-900">{yongshin.johooStatus}</p>
            <p className="text-[14px] text-seal mt-2 font-bold">조후용신: {yongshin.johooYongshin}</p>
          </div>
        </div>

        <p className="text-[14px] text-ink-700 leading-[1.85] font-medium">
          {yongshin.logicBasis}
        </p>

        <div className="pt-6 border-t border-ink-300/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {[
              { label: '행운의 색', value: yongshin.advice.color },
              { label: '행운의 숫자', value: yongshin.advice.numbers },
              { label: '행운의 방향', value: yongshin.advice.direction },
              { label: '추천 행위', value: yongshin.advice.action },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-[12px] text-ink-500 shrink-0">{row.label}:</span>
                <span className="text-[14px] font-bold text-ink-900">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
