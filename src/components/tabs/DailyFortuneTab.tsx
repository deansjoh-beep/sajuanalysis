import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { LogIn, Sparkles, RefreshCw, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { TAB_TRANSITION } from '../../constants/styles';
import { PaperBackground } from '../welcome/PaperBackground';
import { fetchDailyFortune, DailyFortuneError, type DailyFortuneResponse } from '../../lib/dailyFortuneClient';
import type { User as FirebaseUser } from 'firebase/auth';

type ActiveTab =
  | 'welcome' | 'dashboard' | 'taekil' | 'chat' | 'report' | 'guide' | 'blog' | 'premium' | 'order';

interface DailyFortuneTabProps {
  user: FirebaseUser | null;
  onLoginClick: () => void;
  setActiveTab: (t: ActiveTab) => void;
}

const PAPER_CARD = 'rounded-3xl border border-ink-300/30 bg-white shadow-sm';
const SECTION_META: { key: keyof DailyFortuneResponse['fortune']['sections']; label: string }[] = [
  { key: 'overall', label: '총운' },
  { key: 'wealth', label: '재물·금전' },
  { key: 'love', label: '애정·관계' },
  { key: 'work', label: '직업·학업' },
  { key: 'health', label: '건강·컨디션' },
];

export default function DailyFortuneTab({ user, onLoginClick, setActiveTab }: DailyFortuneTabProps) {
  const [data, setData] = useState<DailyFortuneResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDailyFortune({ refresh });
      setData(res);
    } catch (err) {
      const e = err instanceof DailyFortuneError ? err : new DailyFortuneError('운세를 불러오지 못했습니다.');
      setError({ code: e.code, message: e.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load(false);
    else {
      setData(null);
      setError(null);
    }
  }, [user, load]);

  return (
    <motion.div
      key="daily"
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
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 헤더 */}
          <header className="text-center space-y-3 pt-2 pb-2">
            <div className="inline-flex items-center gap-2 text-seal">
              <Sparkles className="w-5 h-5" />
              <span className="text-[12px] font-bold tracking-widest uppercase">Daily Fortune</span>
            </div>
            <h2 className="font-serif text-[28px] md:text-[36px] font-bold text-ink-900 leading-tight">
              오늘의 운세
            </h2>
            <p className="text-[14px] text-ink-500 leading-relaxed">
              회원이라면 매일 무료로, 당신의 사주에 맞춘 오늘의 기운을 받아보세요.
            </p>
          </header>

          {/* 비로그인 */}
          {!user && <LoginGate onLoginClick={onLoginClick} />}

          {/* 로그인 + 사주 없음 */}
          {user && error?.code === 'NO_SAJU_PROFILE' && (
            <NoSajuGate onGoAnalyze={() => setActiveTab('welcome')} />
          )}

          {/* 로딩 */}
          {user && loading && <FortuneSkeleton />}

          {/* 일반 에러 */}
          {user && !loading && error && error.code !== 'NO_SAJU_PROFILE' && (
            <div className={`${PAPER_CARD} p-6 flex items-start gap-3`}>
              <AlertCircle className="w-5 h-5 text-seal shrink-0 mt-0.5" />
              <div className="space-y-3">
                <p className="text-[14px] text-ink-900 leading-relaxed">{error.message}</p>
                <button
                  onClick={() => load(false)}
                  className="text-[13px] font-bold text-seal hover:underline inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" /> 다시 시도
                </button>
              </div>
            </div>
          )}

          {/* 운세 표시 */}
          {user && !loading && !error && data && (
            <FortuneView data={data} onRefresh={() => load(true)} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LoginGate({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className={`${PAPER_CARD} p-8 md:p-10 text-center space-y-5`}>
      <div className="w-14 h-14 rounded-2xl border border-seal/30 bg-seal/10 flex items-center justify-center mx-auto">
        <span className="font-serif font-bold text-[22px] text-seal">命</span>
      </div>
      <div className="space-y-2">
        <h3 className="font-serif text-[20px] font-bold text-ink-900">로그인하고 매일 받아보세요</h3>
        <p className="text-[14px] text-ink-500 leading-relaxed">
          회원으로 로그인하면 사주에 맞춘 오늘의 운세를
          <br />
          매일 아침 무료로 확인할 수 있습니다.
        </p>
      </div>
      <button
        onClick={onLoginClick}
        className="inline-flex items-center gap-2 min-h-[48px] px-7 py-3 rounded-full bg-ink-900 text-paper-50 font-bold text-[14px] hover:bg-ink-700 active:scale-95 transition-all"
      >
        <LogIn className="w-4 h-4" /> 로그인하고 시작하기
      </button>
    </div>
  );
}

function NoSajuGate({ onGoAnalyze }: { onGoAnalyze: () => void }) {
  return (
    <div className={`${PAPER_CARD} p-8 md:p-10 text-center space-y-5`}>
      <div className="space-y-2">
        <h3 className="font-serif text-[20px] font-bold text-ink-900">먼저 사주를 등록해 주세요</h3>
        <p className="text-[14px] text-ink-500 leading-relaxed">
          오늘의 운세는 당신의 사주를 기반으로 생성됩니다.
          <br />
          생년월일시를 입력해 만세력 분석을 한 번 진행하면 자동으로 등록됩니다.
        </p>
      </div>
      <button
        onClick={onGoAnalyze}
        className="inline-flex items-center gap-2 min-h-[48px] px-7 py-3 rounded-full bg-ink-900 text-paper-50 font-bold text-[14px] hover:bg-ink-700 active:scale-95 transition-all"
      >
        사주 등록하러 가기 <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function FortuneSkeleton() {
  return (
    <div className={`${PAPER_CARD} p-6 md:p-8 space-y-4`}>
      <p className="text-[14px] text-ink-500 font-medium flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> 오늘의 기운을 읽는 중입니다...
      </p>
      <div className="space-y-2">
        {[100, 90, 82, 70].map((w, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-paper-100 animate-pulse"
            style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function FortuneView({ data, onRefresh }: { data: DailyFortuneResponse; onRefresh: () => void }) {
  const { fortune } = data;
  return (
    <div className="space-y-5">
      {/* 요약 + 점수 카드 */}
      <div className={`${PAPER_CARD} p-6 md:p-8`}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="text-[12px] font-bold text-ink-500">
            {data.date} · {data.dayPillarHangul}({data.dayPillarHanja})일
          </span>
          <ScoreBadge score={fortune.score} />
        </div>
        <p className="font-serif text-[20px] md:text-[24px] font-bold text-ink-900 leading-snug">
          {fortune.summary}
        </p>
      </div>

      {/* 섹션별 */}
      <div className={`${PAPER_CARD} p-6 md:p-8 space-y-5`}>
        {SECTION_META.map(({ key, label }) =>
          fortune.sections[key] ? (
            <div key={key} className="space-y-1.5">
              <h4 className="text-[12px] font-bold text-seal tracking-wide">{label}</h4>
              <p className="text-[14px] leading-[1.85] text-ink-900">{fortune.sections[key]}</p>
            </div>
          ) : null,
        )}
      </div>

      {/* 오늘의 조언 */}
      {fortune.advice && (
        <div className={`${PAPER_CARD} p-6 md:p-7 border-brush-gold/40`}>
          <h4 className="text-[12px] font-bold text-brush-gold mb-2">오늘의 조언</h4>
          <p className="text-[14px] leading-[1.85] text-ink-900 italic font-medium">"{fortune.advice}"</p>
        </div>
      )}

      {/* 행운 정보 */}
      <div className={`${PAPER_CARD} p-6`}>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: '행운의 색', value: fortune.lucky.color },
            { label: '행운의 숫자', value: fortune.lucky.number },
            { label: '행운의 방향', value: fortune.lucky.direction },
          ].map((row) => (
            <div key={row.label} className="space-y-1">
              <p className="text-[12px] text-ink-500">{row.label}</p>
              <p className="text-[14px] font-bold text-ink-900">{row.value || '-'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 재생성 + 안내 */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] text-ink-500/80">오늘의 운세는 매일 아침 갱신됩니다.</p>
        <button
          onClick={onRefresh}
          className="text-[12px] font-bold text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 다시 생성
        </button>
      </div>

      <p className="text-[12px] text-ink-500/70 leading-relaxed text-center pt-2">
        본 운세는 전통 명리학 해석과 AI 보조를 결합한 참고용 자료입니다.
      </p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-emerald-700/15 text-emerald-800'
      : score >= 60
      ? 'bg-brush-gold/15 text-brush-gold'
      : 'bg-seal/15 text-seal';
  return (
    <span className={`text-[13px] font-bold px-3 py-1 rounded-full ${tone}`}>오늘의 기운 {score}점</span>
  );
}
