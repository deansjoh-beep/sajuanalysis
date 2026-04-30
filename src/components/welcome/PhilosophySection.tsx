import { motion } from 'motion/react';
import { InkRevealText } from './InkRevealText';

/**
 * 섹션 2 — "사주는 예언이 아니라 지도입니다"
 * 좌측에 명조체 큰 인용, 우측에 본문.
 */
export function PhilosophySection() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
        {/* 좌측 큰 인용 */}
        <motion.div
          className="md:col-span-5"
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="font-serif text-[22px] md:text-[28px] leading-[1.6] text-ink-900 font-bold">
            사주는<br />
            예언이 아니라<br />
            <span className="text-seal">지도입니다.</span>
          </p>
        </motion.div>

        {/* 우측 본문 */}
        <div className="md:col-span-7 space-y-5 text-[14px] md:text-[15px] leading-[1.9] text-ink-700">
          <InkRevealText as="p" staggerDelay={0.012} duration={0.45}>
            지도는 길을 막아주지 않습니다. 다만 어디에 산이 있고 어디에 강이 흐르는지 알려줄 뿐입니다.
          </InkRevealText>
          <InkRevealText as="p" staggerDelay={0.012} duration={0.45} delay={0.3}>
            일기예보가 비를 멈추게 할 수는 없지만 우산을 챙기게 해주는 것처럼, 사주는 미래를 통제해주는 것이 아니라 준비할 수 있게 해주는 정보입니다.
          </InkRevealText>
          <InkRevealText as="p" staggerDelay={0.012} duration={0.45} delay={0.6}>
            내 기질의 윤곽, 강점과 약점, 인생의 시기별 흐름. 이것을 큰 그림으로 보여주는 것이 사주 상담의 핵심 가치입니다.
          </InkRevealText>

          <motion.p
            className="pt-3 font-serif text-[15px] md:text-[17px] text-ink-900 italic border-l-2 border-seal/40 pl-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.9, delay: 1.2 }}
          >
            "올해 결혼합니다"가 아니라<br />
            "올해 어떤 에너지가 들어오니 이런 가능성에 마음이 열려 있을 겁니다"가<br />
            제대로 된 해석입니다.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
