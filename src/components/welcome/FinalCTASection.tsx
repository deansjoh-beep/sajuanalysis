import { motion } from 'motion/react';
import { InkRevealText } from './InkRevealText';

interface FinalCTASectionProps {
  onStartFree: () => void;
  onStartPremium: () => void;
}

export function FinalCTASection({ onStartFree, onStartPremium }: FinalCTASectionProps) {
  return (
    <section className="relative px-4 py-20 md:py-32">
      <div className="max-w-3xl mx-auto text-center space-y-10 md:space-y-14">
        <div className="space-y-6 md:space-y-8">
          <InkRevealText
            as="h2"
            className="font-serif text-[26px] md:text-[38px] font-bold text-ink-900 leading-tight"
            staggerDelay={0.03}
          >
            이제, 당신의 지도를 펼칠 시간입니다.
          </InkRevealText>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.0, delay: 0.4 }}
            className="font-serif italic text-[16px] md:text-[20px] text-ink-700 leading-relaxed pt-2"
          >
            "좋은 지도를 손에 넣었다면,<br />
            이제 걸어야 할 사람은 본인입니다."
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
        >
          <button
            onClick={onStartFree}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[52px] rounded-full border-[1.5px] border-ink-900 text-ink-900 font-bold text-[15px] hover:bg-ink-900 hover:text-paper-50 transition-all"
          >
            <span>사주 입력하고 기본 분석</span>
          </button>
          <button
            onClick={onStartPremium}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[52px] rounded-full bg-ink-900 text-paper-50 font-bold text-[15px] shadow-lg shadow-ink-700/20 hover:bg-ink-700 hover:-translate-y-0.5 active:scale-95 transition-all"
          >
            <span>프리미엄 보고서로 깊이 보기</span>
            <span>→</span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}
