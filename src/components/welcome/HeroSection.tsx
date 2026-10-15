import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { BrushText } from './BrushText';
import { InkRevealText } from './InkRevealText';
import { HeroSajuTeaser } from './HeroSajuTeaser';
import type { TeaserInput } from '../../lib/landingTeaser';
import type { UserData } from '../../types/app';
import { PRODUCT_ACCESS } from '@/db/productAccess';

interface HeroSectionProps {
  onScrollClick: () => void;
  currentSeoulYear: number;
  initialBirth: UserData;
  onSubmitted: (input: TeaserInput) => void;
  onOpenManse: (input: TeaserInput) => void;
  onOpenCheckout: (input: TeaserInput) => void;
  onOpenPrivacy: () => void;
  onWriteReview: () => void;
  /** 첫 화면 2027 신년운세 안내 → 체크아웃(상품 선택 상태로) */
  onOpenYearly2027: () => void;
}

export function HeroSection({
  onScrollClick,
  currentSeoulYear,
  initialBirth,
  onSubmitted,
  onOpenManse,
  onOpenCheckout,
  onOpenPrivacy,
  onWriteReview,
  onOpenYearly2027,
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[88vh] flex flex-col items-center justify-center px-4 py-16 md:py-24">
      {/* 메인 헤드라인 — 붓글씨 stroke 애니메이션 (티저가 전환점이므로 타이밍 단축) */}
      <div className="w-full max-w-4xl mx-auto text-center space-y-3 md:space-y-5">
        <div className="flex flex-col items-center gap-2 md:gap-3">
          <div className="w-full max-w-[680px]">
            <BrushText fontSize={72} delay={0.2} duration={1.2} fillColor="#1a1a1a" strokeColor="#1a1a1a">
              만세력은 AI가 읽고,
            </BrushText>
          </div>
          <div className="w-full max-w-[680px]">
            <BrushText fontSize={72} delay={1.0} duration={1.3} fillColor="#3a3530" strokeColor="#1a1a1a">
              풀이는 정통 명리로 씁니다.
            </BrushText>
          </div>
        </div>

        {/* 서브카피 — 글자 단위 잉크 번짐 */}
        <div className="pt-4 md:pt-6">
          <InkRevealText
            as="p"
            className="text-[15px] md:text-[17px] text-ink-700 leading-relaxed font-medium"
            delay={2.0}
            staggerDelay={0.02}
            triggerOnView={false}
          >
            천년을 내려온 명리학과 AI가 만나, 당신만의 인생 지도를 만듭니다.
          </InkRevealText>
        </div>

        {/* 2027 신년운세 출시 안내 — 스크롤 없이 첫 화면에서 보이도록 입력창 위에 둔다.
            판매 종료(PRODUCT_ACCESS) 시 자동 숨김. ⚠️ 가격은 db/payment.ts PRODUCT_PRICES·PremiumProductsSection과 동기화 */}
        {PRODUCT_ACCESS.yearly2027 === 'open' && (
          <motion.div
            className="pt-5 md:pt-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 2.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onOpenYearly2027}
              className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border border-ink-900/20 bg-paper-50/80 px-4 py-2 text-[13px] text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors"
            >
              <span className="font-bold text-ink-900">2027 신년운세 리포트</span>
              <span className="text-ink-500">새로 나왔습니다 · 열두 달 일진 캘린더 PDF(12p) 포함 · 4,900원</span>
              <span aria-hidden="true">→</span>
            </button>
          </motion.div>
        )}

        {/* 무료 사주 요약 티저 — 첫 화면 전환점 */}
        <motion.div
          className="pt-6 md:pt-8 flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 2.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <HeroSajuTeaser
            currentSeoulYear={currentSeoulYear}
            initialBirth={initialBirth}
            onSubmitted={onSubmitted}
            onOpenManse={onOpenManse}
            onOpenCheckout={onOpenCheckout}
            onOpenPrivacy={onOpenPrivacy}
            onWriteReview={onWriteReview}
          />

          <button
            onClick={onScrollClick}
            className="inline-flex flex-col items-center gap-1 text-ink-500 hover:text-ink-700 text-[12px] tracking-widest mt-2 transition-colors"
          >
            <span>먼저 알아보기</span>
            <motion.span
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}
