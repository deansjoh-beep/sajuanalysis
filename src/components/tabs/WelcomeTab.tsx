import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { TAB_TRANSITION } from '../../constants/styles';
import { PaperBackground } from '../welcome/PaperBackground';
import { HeroSection } from '../welcome/HeroSection';
import { PhilosophySection } from '../welcome/PhilosophySection';
import { WhenToUseSection } from '../welcome/WhenToUseSection';
import { HowToUseSection } from '../welcome/HowToUseSection';
import { DifferentiationTable } from '../welcome/DifferentiationTable';
import { PremiumProductsSection } from '../welcome/PremiumProductsSection';
import { PreparationChecklist } from '../welcome/PreparationChecklist';
import { FinalCTASection } from '../welcome/FinalCTASection';
import { WelcomeFooter } from '../welcome/WelcomeFooter';
import { ReviewsSection } from '../ReviewsSection';

type ProductType = 'premium' | 'yearly2026' | 'jobCareer' | 'loveMarriage';
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
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  calendarType: 'solar' | 'lunar' | 'leap';
  gender: 'M' | 'F';
  unknownTime: boolean;
}

interface BlogPostLite {
  id: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  content?: string;
}

interface WelcomeTabProps {
  showInputForm: boolean;
  setShowInputForm: (v: boolean) => void;
  userData: UserData;
  setUserData: (u: UserData) => void;
  isAgreed: boolean;
  setIsAgreed: (v: boolean) => void;
  setActiveTab: (t: ActiveTab) => void;
  setOrderProductType: (t: ProductType) => void;
  setReviewModalOpen: (v: boolean) => void;
  recommendedPosts: BlogPostLite[];
  onPostClick: (post: BlogPostLite) => void;
  currentSeoulYear: number;
  handleStart: () => void;
}

export default function WelcomeTab({
  showInputForm,
  setShowInputForm,
  userData,
  setUserData,
  isAgreed,
  setIsAgreed,
  setActiveTab,
  setOrderProductType,
  setReviewModalOpen,
  recommendedPosts,
  onPostClick,
  currentSeoulYear,
  handleStart,
}: WelcomeTabProps) {
  // 첫 섹션 다음으로 스크롤할 때 사용
  const philosophyRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScrollDown = () => {
    philosophyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStartClick = () => {
    setShowInputForm(true);
    // 입력폼이 위에 보이도록 스크롤 리셋
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  const handleProductClick = (type: ProductType) => {
    setOrderProductType(type);
    setActiveTab('order');
  };

  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={TAB_TRANSITION}
      className="absolute inset-0 flex flex-col overflow-hidden"
      data-theme="light"
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto hide-scrollbar relative bg-paper-50"
      >
        {/* 화선지 배경 — sticky로 뷰포트 고정처럼 동작 (스크롤해도 항상 보임) */}
        <div className="sticky top-0 left-0 w-full h-screen pointer-events-none -mb-[100vh]">
          <PaperBackground />
        </div>

        {!showInputForm ? (
          <div className="relative">
            <HeroSection onStartClick={handleStartClick} onScrollClick={handleScrollDown} />

            <div ref={philosophyRef}>
              <PhilosophySection />
            </div>

            <WhenToUseSection />

            <HowToUseSection />

            <DifferentiationTable />

            <PremiumProductsSection onProductClick={handleProductClick} />

            <PreparationChecklist />

            {/* 후기 — 화선지 톤에 맞춰 컨테이너만 살짝 조정 */}
            <section className="relative px-4 py-16 md:py-20 bg-paper-100/30">
              <div className="max-w-6xl mx-auto">
                <ReviewsSection onWriteReview={() => setReviewModalOpen(true)} />
              </div>
            </section>

            <FinalCTASection
              onStartFree={handleStartClick}
              onStartPremium={() => handleProductClick('premium')}
            />

            <WelcomeFooter
              recommendedPosts={recommendedPosts}
              onPostClick={onPostClick}
              onOpenBlog={() => setActiveTab('blog')}
              onOpenChat={() => setActiveTab('chat')}
              onOpenReport={() => setActiveTab('report')}
            />
          </div>
        ) : (
          <div className="relative px-4 py-10 md:py-16">
            <div className="max-w-2xl mx-auto pb-16 md:pb-20 space-y-5 md:space-y-7">
              <button
                onClick={() => setShowInputForm(false)}
                className="relative inline-flex items-center gap-2 min-h-[44px] px-2 text-[13px] font-bold text-ink-500 hover:text-ink-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                랜딩페이지로 돌아가기
              </button>

              <section
                className="relative rounded-3xl border border-ink-300/30 bg-paper-50/70 backdrop-blur-sm p-5 md:p-8 space-y-5 md:space-y-6"
                style={{ boxShadow: '0 1px 0 rgba(168, 138, 74, 0.1), 0 12px 28px -12px rgba(58, 53, 48, 0.12)' }}
              >
                <div className="text-center space-y-2">
                  <h2 className="font-serif text-2xl sm:text-3xl md:text-[34px] font-bold text-ink-900 leading-tight">
                    당신의 생년월일시를 입력해 주세요
                  </h2>
                </div>

                <div
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isAgreed
                      ? 'bg-paper-100/70 border-ink-300/40'
                      : 'bg-paper-100/40 border-ink-300/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    id="privacyAgree"
                    checked={isAgreed}
                    onChange={(e) => setIsAgreed(e.target.checked)}
                    className="w-5 h-5 rounded border-ink-500 text-ink-900 focus:ring-ink-500 cursor-pointer"
                  />
                  <label
                    htmlFor="privacyAgree"
                    className="text-[13px] font-bold text-ink-700 cursor-pointer"
                  >
                    개인정보 이용에 동의합니다
                  </label>
                </div>

                <div
                  className={`space-y-5 transition-all ${
                    !isAgreed ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'
                  }`}
                >
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest ml-1 text-ink-500">
                      사용자 이름
                    </label>
                    <input
                      type="text"
                      placeholder="이름을 입력하세요"
                      value={userData.name}
                      disabled={!isAgreed}
                      onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                      className="w-full px-4 py-3 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 focus:ring-2 focus:ring-ink-500/40 outline-none transition-all text-base text-ink-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold ml-1 text-ink-500">년도</label>
                        <select
                          value={userData.birthYear}
                          disabled={!isAgreed}
                          onChange={(e) => setUserData({ ...userData, birthYear: e.target.value })}
                          className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
                        >
                          {Array.from({ length: 100 }, (_, i) => currentSeoulYear - i).map((y) => (
                            <option key={y} value={y}>
                              {y}년
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold ml-1 text-ink-500">월</label>
                        <select
                          value={userData.birthMonth}
                          disabled={!isAgreed}
                          onChange={(e) =>
                            setUserData({ ...userData, birthMonth: e.target.value })
                          }
                          className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                              {m}월
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold ml-1 text-ink-500">일</label>
                        <select
                          value={userData.birthDay}
                          disabled={!isAgreed}
                          onChange={(e) => setUserData({ ...userData, birthDay: e.target.value })}
                          className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>
                              {d}일
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {!userData.unknownTime && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold ml-1 text-ink-500">시</label>
                          <select
                            value={userData.birthHour}
                            disabled={!isAgreed}
                            onChange={(e) =>
                              setUserData({ ...userData, birthHour: e.target.value })
                            }
                            className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
                          >
                            {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                              <option key={h} value={h}>
                                {h}시
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold ml-1 text-ink-500">분</label>
                          <select
                            value={userData.birthMinute}
                            disabled={!isAgreed}
                            onChange={(e) =>
                              setUserData({ ...userData, birthMinute: e.target.value })
                            }
                            className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
                          >
                            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                              <option key={m} value={m}>
                                {m}분
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 ml-1">
                      <input
                        type="checkbox"
                        id="unknownTime"
                        disabled={!isAgreed}
                        checked={userData.unknownTime}
                        onChange={(e) =>
                          setUserData({ ...userData, unknownTime: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-ink-500 text-ink-900 focus:ring-ink-500"
                      />
                      <label
                        htmlFor="unknownTime"
                        className="text-[13px] font-medium text-ink-500"
                      >
                        생시를 몰라요
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between p-2 rounded-2xl bg-paper-100/60 border border-ink-300/30">
                      <div className="flex items-center gap-1.5 p-1 rounded-xl w-full">
                        <button
                          onClick={() => setUserData({ ...userData, calendarType: 'solar' })}
                          disabled={!isAgreed}
                          className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                            userData.calendarType === 'solar'
                              ? 'bg-ink-900 text-paper-50 shadow-md'
                              : 'text-ink-500'
                          }`}
                        >
                          양력
                        </button>
                        <button
                          onClick={() => setUserData({ ...userData, calendarType: 'lunar' })}
                          disabled={!isAgreed}
                          className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                            userData.calendarType === 'lunar'
                              ? 'bg-ink-900 text-paper-50 shadow-md'
                              : 'text-ink-500'
                          }`}
                        >
                          음력(평)
                        </button>
                        <button
                          onClick={() => setUserData({ ...userData, calendarType: 'leap' })}
                          disabled={!isAgreed}
                          className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                            userData.calendarType === 'leap'
                              ? 'bg-ink-900 text-paper-50 shadow-md'
                              : 'text-ink-500'
                          }`}
                        >
                          음력(윤)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-2xl bg-paper-100/60 border border-ink-300/30">
                      <div className="flex items-center gap-1.5 p-1 rounded-xl w-full">
                        <button
                          onClick={() => setUserData({ ...userData, gender: 'M' })}
                          disabled={!isAgreed}
                          className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                            userData.gender === 'M'
                              ? 'bg-ink-900 text-paper-50 shadow-md'
                              : 'text-ink-500'
                          }`}
                        >
                          남자
                        </button>
                        <button
                          onClick={() => setUserData({ ...userData, gender: 'F' })}
                          disabled={!isAgreed}
                          className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                            userData.gender === 'F'
                              ? 'bg-ink-900 text-paper-50 shadow-md'
                              : 'text-ink-500'
                          }`}
                        >
                          여자
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleStart}
                    disabled={!isAgreed}
                    className={`w-full py-4 min-h-[44px] rounded-full bg-ink-900 hover:bg-ink-700 text-paper-50 font-bold shadow-lg shadow-ink-700/20 flex items-center justify-center gap-2 active:scale-95 transition-all ${
                      !isAgreed ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    운세 분석 시작
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </section>

              <p className="text-center text-[11px] tracking-tight text-ink-500/80">
                생시를 알면 더 정확한 운세 분석이 가능합니다. 몰라도 상담은 가능합니다.
                <br />
                유아이는 사용자의 개인 정보를 저장하지 않습니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
