import { motion } from 'motion/react';
import { useRef } from 'react';
import { TAB_TRANSITION } from '../../constants/styles';
import { PaperBackground } from '../welcome/PaperBackground';
import { HeroSection } from '../welcome/HeroSection';
import { PhilosophySection } from '../welcome/PhilosophySection';
import { DifferentiationTable } from '../welcome/DifferentiationTable';
import { PremiumProductsSection } from '../welcome/PremiumProductsSection';
import { IljinCalendarPromo } from '../welcome/IljinCalendarPromo';
import { FinalCTASection } from '../welcome/FinalCTASection';
import { WelcomeFooter } from '../welcome/WelcomeFooter';
import { ReviewsSection } from '../ReviewsSection';
import type { TeaserInput } from '../../lib/landingTeaser';
import type { ReviewSource } from '../ReviewModal';

type ProductType = 'premium' | 'yearly2026' | 'jobCareer' | 'loveMarriage';
type ActiveTab =
  | 'welcome'
  | 'dashboard'
  | 'taekil'
  | 'chat'
  | 'report'
  | 'guide'
  | 'blog'
  | 'daily'
  | 'lookup'
  | 'checkout';

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
  userData: UserData;
  setActiveTab: (t: ActiveTab) => void;
  setOrderProductType: (t: ProductType) => void;
  /** 후기 작성 모달 열기 — 진입점을 sourcePage로 남겨 동선별 유입을 집계한다 */
  openReviewModal: (source: ReviewSource) => void;
  /** 후기 작성 완료 후 ReviewsSection 재로드용 카운터 */
  reviewsRefreshKey?: number;
  recommendedPosts: BlogPostLite[];
  onPostClick: (post: BlogPostLite) => void;
  currentSeoulYear: number;
  /** 랜딩 티저 → 만세력 직행 (이름 없이) */
  onTeaserManse: (input: TeaserInput) => void;
  /** 티저 입력을 전역 userData로 머지 — 제출 시·결제 직행 시 공용 (결제 폼 프리필 + 브라우저 보관) */
  onTeaserCheckout: (input: TeaserInput) => void;
  /** 푸터 약관·정책 링크 → 가이드 서브페이지로 이동 */
  onOpenPolicy: (page: 'terms' | 'privacy' | 'refund') => void;
}

export default function WelcomeTab({
  userData,
  setActiveTab,
  setOrderProductType,
  openReviewModal,
  reviewsRefreshKey,
  recommendedPosts,
  onPostClick,
  currentSeoulYear,
  onTeaserManse,
  onTeaserCheckout,
  onOpenPolicy,
}: WelcomeTabProps) {
  // 첫 섹션 다음으로 스크롤할 때 사용
  const philosophyRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScrollDown = () => {
    philosophyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 상품 클릭 → 선택 상품을 넘기고 체크아웃으로.
  const handleProductClick = (type: ProductType) => {
    setOrderProductType(type);
    setActiveTab('checkout');
  };

  // 티저 [리포트로 깊이 보기] → 체크아웃. 티저 입력을 먼저 전역 머지해 결제 폼에 프리필한다.
  const handleOpenCheckout = (input: TeaserInput) => {
    onTeaserCheckout(input);
    setActiveTab('checkout');
  };

  const scrollToHero = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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

        <div className="relative">
            <HeroSection
              onScrollClick={handleScrollDown}
              currentSeoulYear={currentSeoulYear}
              initialBirth={userData}
              onSubmitted={onTeaserCheckout}
              onOpenManse={onTeaserManse}
              onOpenCheckout={handleOpenCheckout}
              onOpenPrivacy={() => onOpenPolicy('privacy')}
              onWriteReview={() => openReviewModal('welcome-teaser')}
            />

            {/* 첫 화면 바로 아래 — 생년월일시 입력 직후에 무료 제공 혜택을 먼저 알린다. */}
            <IljinCalendarPromo
              onGetReport={() => setActiveTab('checkout')}
              onGoLookup={() => setActiveTab('lookup')}
            />

            <div ref={philosophyRef}>
              <PhilosophySection />
            </div>

            <DifferentiationTable />

            <div ref={productsRef}>
              <PremiumProductsSection onProductClick={handleProductClick} />
            </div>

            {/* 후기 — 화선지 톤에 맞춰 컨테이너만 살짝 조정 */}
            <section className="relative px-4 py-16 md:py-20 bg-paper-100/30">
              <div className="max-w-6xl mx-auto">
                <ReviewsSection
                  onWriteReview={() => openReviewModal('welcome-reviews')}
                  refreshKey={reviewsRefreshKey}
                />
              </div>
            </section>

            <FinalCTASection
              onStartFree={scrollToHero}
              onStartPremium={() => handleProductClick('premium')}
            />

            <WelcomeFooter
              recommendedPosts={recommendedPosts}
              onPostClick={onPostClick}
              onOpenBlog={() => setActiveTab('blog')}
              onOpenChat={() => setActiveTab('chat')}
              onOpenReport={() => setActiveTab('report')}
              onOpenPolicy={onOpenPolicy}
            />
          </div>
      </div>
    </motion.div>
  );
}
