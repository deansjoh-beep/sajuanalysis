import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { BrushText } from './BrushText';
import { InkRevealText } from './InkRevealText';

interface HeroSectionProps {
  onStartClick: () => void;
  onScrollClick: () => void;
}

export function HeroSection({ onStartClick, onScrollClick }: HeroSectionProps) {
  return (
    <section className="relative min-h-[88vh] flex flex-col items-center justify-center px-4 py-16 md:py-24">
      {/* 메인 헤드라인 — 붓글씨 stroke 애니메이션 */}
      <div className="w-full max-w-4xl mx-auto text-center space-y-3 md:space-y-5">
        <div className="flex flex-col items-center gap-2 md:gap-3">
          <div className="w-full max-w-[680px]">
            <BrushText fontSize={72} delay={0.3} duration={2.2} fillColor="#1a1a1a" strokeColor="#1a1a1a">
              운명을 맞히지 않습니다.
            </BrushText>
          </div>
          <div className="w-full max-w-[680px]">
            <BrushText fontSize={72} delay={2.0} duration={2.4} fillColor="#3a3530" strokeColor="#1a1a1a">
              당신을 이해하도록 돕습니다.
            </BrushText>
          </div>
        </div>

        {/* 서브카피 — 글자 단위 잉크 번짐 */}
        <div className="pt-6 md:pt-10">
          <InkRevealText
            as="p"
            className="text-[15px] md:text-[17px] text-ink-700 leading-relaxed font-medium"
            delay={4.4}
            staggerDelay={0.025}
            triggerOnView={false}
          >
            1,000년의 명리학과 AI가 만나, 당신만의 인생 지도를 만듭니다.
          </InkRevealText>
        </div>

        {/* CTA */}
        <motion.div
          className="pt-8 md:pt-12 flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 5.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            onClick={onStartClick}
            className="group inline-flex items-center gap-2 px-8 py-4 min-h-[52px] rounded-full bg-ink-900 text-paper-50 font-bold text-[15px] md:text-[16px] shadow-lg shadow-ink-700/20 hover:bg-ink-700 hover:-translate-y-0.5 active:scale-95 transition-all"
          >
            <span>내 사주 지도 시작하기</span>
            <span className="text-paper-50/70 group-hover:translate-x-1 transition-transform">→</span>
          </button>

          <button
            onClick={onScrollClick}
            className="inline-flex flex-col items-center gap-1 text-ink-500 hover:text-ink-700 text-[12px] tracking-widest mt-4 transition-colors"
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
