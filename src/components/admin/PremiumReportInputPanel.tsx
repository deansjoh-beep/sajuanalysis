import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen, LogOut, Plus, X, Sparkles, Loader2, User, Calendar,
  Clock, FlaskConical, MessageSquare, StickyNote, ListChecks,
  Pause, Play, XCircle, ChevronLeft,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { ReportInputData, ReportSection, LifeEvent } from '../../lib/premiumOrderStore';
import { generateLifeNavReport } from '../../lib/generatePremiumReport';
import { CardHeader } from '../CardHeader';

// 샘플 데이터 (개발/검증용)
const SAMPLE_DATA: ReportInputData = {
  name: '오세진',
  gender: 'M',
  birthDate: '1969-12-02',
  birthTime: '10:00',
  isLunar: false,
  isLeap: false,
  unknownTime: false,
  concern: '지금 사업 확장 타이밍이 맞는지, 주요 의사결정에 사주 흐름이 어떻게 연결되는지 궁금합니다.',
  interest: '사업, 투자, 후세 교육',
  reportLevel: 'advanced',
  lifeEvents: [{ year: 1987, description: '서울대 경제학과 입학' }],
  adminNotes: '경제 분야 전문가. 사업 확장 시기 및 자녀 관계도 언급 요망.',
};

const ESTIMATED_SECONDS = 120;

const isPremiumE2EMode = () => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('e2e') === 'premium';
};

interface PremiumReportInputPanelProps {
  user: FirebaseUser;
  onLogout: () => void;
  onBack?: () => void;
  initialData?: ReportInputData;
  onGenerated: (
    data: ReportInputData,
    sections: ReportSection[],
    saju: any,
    daeun: any,
    yongshin: any
  ) => void;
}

const FIELD_CLASS =
  'w-full rounded-2xl border border-white/65 px-4 py-3 text-[13px] outline-none bg-white/70 backdrop-blur text-zinc-900 transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70 placeholder-zinc-400';

const LABEL_CLASS = 'block text-[11px] font-bold text-zinc-600 mb-1.5 uppercase tracking-wider';

const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <div className="rounded-3xl border border-white/60 bg-white/50 backdrop-blur-xl shadow-xl shadow-indigo-200/20 p-6 space-y-5">
    <CardHeader icon={icon} title={title} />
    {children}
  </div>
);

export const PremiumReportInputPanel: React.FC<PremiumReportInputPanelProps> = ({
  user,
  onBack,
  onLogout,
  onGenerated,
  initialData,
}) => {
  const [form, setForm] = useState<ReportInputData>(
    initialData || {
      name: '',
      gender: 'M',
      birthDate: '',
      birthTime: '',
      isLunar: false,
      isLeap: false,
      unknownTime: false,
      concern: '',
      interest: '',
      reportLevel: 'advanced',
      lifeEvents: [],
      adminNotes: '',
    }
  );

  const [generating, setGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!initialData) return;
    setForm({
      ...initialData,
      concern: initialData.concern || '',
      interest: initialData.interest || '',
      lifeEvents: Array.isArray(initialData.lifeEvents) ? initialData.lifeEvents : [],
      adminNotes: initialData.adminNotes || '',
    });
  }, [initialData]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setElapsed(prev => prev + 1);
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPaused(false);
    isPausedRef.current = false;
    setElapsed(0);
  };

  const handlePause = () => {
    setIsPaused(true);
    isPausedRef.current = true;
  };

  const handleResume = () => {
    setIsPaused(false);
    isPausedRef.current = false;
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    stopTimer();
    setGenerating(false);
    setError('분석이 취소되었습니다.');
  };

  const set = <K extends keyof ReportInputData>(key: K, value: ReportInputData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const addEvent = () =>
    set('lifeEvents', [...form.lifeEvents, { year: new Date().getFullYear(), description: '' }]);

  const removeEvent = (i: number) =>
    set('lifeEvents', form.lifeEvents.filter((_, idx) => idx !== i));

  const updateEvent = (i: number, field: keyof LifeEvent, val: string | number) =>
    set(
      'lifeEvents',
      form.lifeEvents.map((e, idx) => (idx === i ? { ...e, [field]: val } : e))
    );

  const handleGenerate = async () => {
    if (!form.name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!form.birthDate) { setError('생년월일을 입력해주세요.'); return; }
    if (!form.unknownTime && !form.birthTime) {
      setError('출생시간을 입력하거나 "모름"을 체크해주세요.');
      return;
    }
    setError(null);
    setGenerating(true);
    cancelledRef.current = false;
    abortRef.current = new AbortController();
    startTimer();
    try {
      if (isPremiumE2EMode()) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        onGenerated(
          form,
          [
            {
              id: 'e2e-overview',
              title: 'E2E 회귀 테스트 개요',
              summary: '주문 기반 자동채움, 미리보기 전환, PDF 생성 흐름을 검증했습니다.',
              content: '이 섹션은 Playwright 회귀 테스트에서만 사용되는 모의 리포트입니다.'
            }
          ],
          [],
          [
            {
              startAge: 31,
              startYear: new Date().getFullYear(),
              stem: '甲',
              branch: '子'
            }
          ],
          { yongshin: '토(土)' }
        );
        return;
      }

      const { sections, saju, daeun, yongshin } = await generateLifeNavReport(
        form,
        abortRef.current.signal
      );
      onGenerated(form, sections, saju, daeun, yongshin);
    } catch (e: any) {
      // 사용자가 직접 취소한 경우에만 AbortError 무시
      if (cancelledRef.current && e?.name === 'AbortError') {
        // 이미 handleCancel에서 에러 메시지 설정됨
      } else {
        console.error('[generateLifeNavReport] error:', e);
        setError(e?.message ?? '리포트 생성 중 오류가 발생했습니다.');
      }
    } finally {
      stopTimer();
      setGenerating(false);
    }
  };

  const remaining = Math.max(0, ESTIMATED_SECONDS - elapsed);
  const progress = Math.min(100, (elapsed / ESTIMATED_SECONDS) * 100);
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-100 via-cyan-50/60 to-indigo-100/70 pb-28">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-zinc-500 hover:bg-white/60 border border-white/60 transition-all mr-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> 관리자
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center shadow-md">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-zinc-800 leading-none">인생 네비게이션</p>
              <p className="text-[11px] text-zinc-400">프리미엄 리포트 제작</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-[11px] text-zinc-400">{user.email}</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-zinc-500 bg-white/60 border border-white/60 hover:bg-zinc-50 transition-all"
            >
              <LogOut className="w-3 h-3" /> 로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* 타이틀 */}
        <div className="text-center space-y-1">
          <h1 className="text-[16px] font-bold text-zinc-900">고객 정보 입력</h1>
          <p className="text-[13px] text-zinc-500">
            사주 데이터를 입력하면 AI가 인생 네비게이션 리포트를 제작합니다.
          </p>
        </div>

        {/* 샘플 불러오기 */}
        <div className="flex justify-end">
          <button
            onClick={() => setForm({ ...SAMPLE_DATA })}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all shadow-sm disabled:opacity-40"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            샘플 데이터 불러오기 (오세진)
          </button>
        </div>

        {/* ── Section 1: 고객 기본 정보 ── */}
        <SectionCard icon={<User className="w-4 h-4 text-amber-600" />} title="고객 기본 정보">
          {/* 이름 + 성별 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>이름</label>
              <input
                type="text"
                placeholder="홍길동"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>성별</label>
              <div className="flex gap-2">
                {(['M', 'F'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => set('gender', g)}
                    className={`flex-1 py-3 rounded-2xl text-[13px] font-bold border transition-all ${
                      form.gender === g
                        ? 'bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-500/20'
                        : 'bg-white/70 text-zinc-600 border-white/65 hover:border-amber-300'
                    }`}
                  >
                    {g === 'M' ? '남' : '여'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 생년월일 + 음양력 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>
                <Calendar className="w-3 h-3 inline mr-1" />
                생년월일
              </label>
              <input
                type="date"
                value={form.birthDate}
                onChange={e => set('birthDate', e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>음/양력</label>
              <div className="flex gap-2">
                {[
                  { v: false, l: '양력' },
                  { v: true, l: '음력' },
                ].map(item => (
                  <button
                    key={String(item.v)}
                    onClick={() => set('isLunar', item.v)}
                    className={`flex-1 py-3 rounded-2xl text-[13px] font-bold border transition-all ${
                      form.isLunar === item.v
                        ? 'bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-500/20'
                        : 'bg-white/70 text-zinc-600 border-white/65 hover:border-amber-300'
                    }`}
                  >
                    {item.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 출생시간 */}
          <div>
            <label className={LABEL_CLASS}>
              <Clock className="w-3 h-3 inline mr-1" />
              출생 시간
            </label>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={form.birthTime}
                onChange={e => set('birthTime', e.target.value)}
                disabled={form.unknownTime}
                className={`${FIELD_CLASS} flex-1 disabled:opacity-40 disabled:cursor-not-allowed`}
              />
              <label className="flex items-center gap-2 text-[13px] text-zinc-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={form.unknownTime}
                  onChange={e => {
                    set('unknownTime', e.target.checked);
                    if (e.target.checked) set('birthTime', '');
                  }}
                  className="w-4 h-4 accent-amber-600 rounded"
                />
                모름
              </label>
            </div>
            {form.unknownTime && (
              <p className="mt-1.5 text-[11px] text-amber-600">
                시간 미상으로 처리합니다. 시주(時柱) 분석이 제외됩니다.
              </p>
            )}
          </div>
        </SectionCard>

        {/* ── Section 2: 고객 궁금사항 & 관심사 ── */}
        <SectionCard
          icon={<MessageSquare className="w-4 h-4 text-amber-600" />}
          title="고객 궁금사항 & 관심사"
        >
          <div>
            <label className={LABEL_CLASS}>고객 고민 / 궁금사항</label>
            <textarea
              value={form.concern}
              onChange={e => set('concern', e.target.value)}
              placeholder="예: 직장 이직 타이밍, 결혼 시기, 사업 확장 가능성..."
              rows={3}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>고객 관심사 / 목표</label>
            <textarea
              value={form.interest}
              onChange={e => set('interest', e.target.value)}
              placeholder="예: 창업, 해외 진출, 학업, 투자..."
              rows={3}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
        </SectionCard>

        {/* ── Section 3: 고객 입력 — 인생 이벤트 ── */}
        <SectionCard
          icon={<ListChecks className="w-4 h-4 text-amber-600" />}
          title="고객 입력 — 인생 이벤트"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-zinc-400">
              주요 인생 사건을 입력하면 해당 대운 분석에 연결됩니다.
            </p>
            <button
              onClick={addEvent}
              className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> 추가
            </button>
          </div>
          <div className="space-y-2">
            {form.lifeEvents.map((event, i) => (
              <div key={i} className="grid grid-cols-[88px_minmax(0,1fr)_40px] items-center gap-2">
                <input
                  type="number"
                  placeholder="연도"
                  value={event.year || ''}
                  onChange={e => updateEvent(i, 'year', Number(e.target.value))}
                  className={FIELD_CLASS}
                  min={1900}
                  max={2100}
                />
                <input
                  type="text"
                  placeholder="예: 서울대 경제학과 입학"
                  value={event.description}
                  onChange={e => updateEvent(i, 'description', e.target.value)}
                  className={`${FIELD_CLASS} min-w-0`}
                />
                <button
                  onClick={() => removeEvent(i)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {form.lifeEvents.length === 0 && (
              <div className="text-[11px] text-zinc-400 italic py-2 text-center">
                이벤트를 추가하면 대운 분석에 반영됩니다.
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Section 4: 관리자 설정 ── */}
        <SectionCard
          icon={<StickyNote className="w-4 h-4 text-amber-600" />}
          title="관리자 설정"
        >
          {/* 분석 레벨 */}
          <div>
            <label className={LABEL_CLASS}>분석 레벨</label>
            <div className="flex gap-2">
              {([
                { v: 'basic', l: '초급', desc: '쉬운 언어, 풀이 중심' },
                { v: 'advanced', l: '고급', desc: '한자 병기, 전문 용어' },
                { v: 'both', l: '초급+고급', desc: '고급 분석 + 쉬운 설명' },
              ] as const).map(item => (
                <button
                  key={item.v}
                  onClick={() => set('reportLevel', item.v)}
                  className={`flex-1 py-3 px-3 rounded-2xl text-[13px] font-bold border transition-all text-left ${
                    form.reportLevel === item.v
                      ? 'bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-500/20'
                      : 'bg-white/70 text-zinc-600 border-white/65 hover:border-amber-300'
                  }`}
                >
                  <div>{item.l}</div>
                  <div
                    className={`text-[11px] font-normal mt-0.5 ${
                      form.reportLevel === item.v ? 'text-amber-100' : 'text-zinc-400'
                    }`}
                  >
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 관리자 추가 분석 요청 */}
          <div>
            <label className={LABEL_CLASS}>관리자 추가 분석 요청</label>
            <textarea
              value={form.adminNotes}
              onChange={e => set('adminNotes', e.target.value)}
              placeholder="예: 부동산 투자 적합성, 재혼 여부, 자녀 관계..."
              rows={3}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
        </SectionCard>

        {/* 오류 메시지 */}
        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 text-[13px] text-rose-700 font-medium flex items-start gap-3">
            <span className="text-rose-500 text-base leading-none mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}
      </main>

      {/* ── 하단 고정 바 ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-2xl">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-2">
          {/* AI 생성 중 상태 패널 */}
          {generating && (
            <div className="space-y-2">
              {/* 상태 텍스트 */}
              <div className="flex items-center justify-between text-[11px]">
                <span className={`font-bold ${isPaused ? 'text-amber-500' : 'text-indigo-600'}`}>
                  {isPaused ? '⏸ 일시정지됨' : '⚙ AI 분석 중...'}
                </span>
                <span className="text-zinc-500 tabular-nums">
                  {isPaused
                    ? `경과 시간: ${fmtTime(elapsed)}`
                    : remaining > 0
                      ? `예상 남은 시간: ${fmtTime(remaining)}`
                      : '마무리 중...'}
                </span>
              </div>
              {/* 프로그레스 바 */}
              <div className="w-full h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isPaused
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-indigo-500 to-amber-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* 컨트롤 버튼 */}
              <div className="flex gap-2">
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" /> 재개
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm"
                  >
                    <Pause className="w-3.5 h-3.5" /> 일시정지
                  </button>
                )}
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[11px] font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-sm"
                >
                  <XCircle className="w-3.5 h-3.5" /> 취소
                </button>
              </div>
            </div>
          )}

          {/* 생성 버튼 */}
          <button
            onClick={() => { void handleGenerate(); }}
            disabled={generating}
            className="w-full py-4 rounded-3xl bg-gradient-to-r from-amber-600 to-orange-700 text-white text-base font-bold shadow-xl shadow-amber-500/30 hover:from-amber-700 hover:to-orange-800 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                AI 분석 중...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                웹 보고서 생성하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
