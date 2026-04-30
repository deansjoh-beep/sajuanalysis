import { motion } from 'motion/react';
import { InkRevealText } from './InkRevealText';

interface ChecklistItem {
  title: string;
  body: string;
}

const ITEMS: ChecklistItem[] = [
  {
    title: '질문을 정리해 가져오세요',
    body: '"그냥 한번 봐주세요"가 가장 좋지 않은 시작입니다. 지금 가장 큰 고민, 답답한 영역, 알고 싶은 시기를 미리 적어두면 같은 한 시간이 두 배의 효용을 냅니다.',
  },
  {
    title: '단정적인 답을 의심하세요',
    body: '"무조건 이렇게 됩니다"라고 말하는 상담사는 좋은 상담사가 아닙니다. 좋은 해석은 가능성의 폭을 보여주고, 본인이 어떤 선택을 할지 생각하게 합니다.',
  },
  {
    title: '해석이 다른 것이 정상입니다',
    body: '같은 사주를 두 사람에게 보면 해석이 다른 게 자연스럽습니다. 사주는 수학 공식이 아니라 해석학에 가깝습니다. 서로 다른 시각을 비교하면서 본인에게 맞는 부분을 추리세요.',
  },
  {
    title: '기록하고, 시간이 지나서 다시 보세요',
    body: '상담 직후엔 와닿지 않던 말이 1년 후에 정확히 들어맞는 경험을 하게 됩니다. 그때 비로소 사주가 어떤 도구인지 체감하게 됩니다.',
  },
];

/**
 * 결제 전 가이드 — "좋은 상담을 받는 법" 4가지 체크리스트.
 * PremiumOrderForm 상단에도 재사용 가능하도록 단독 컴포넌트로 분리.
 */
export function PreparationChecklist() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12 md:mb-16 space-y-4">
          <InkRevealText
            as="h2"
            className="font-serif text-[26px] md:text-[36px] font-bold text-ink-900 leading-tight"
            staggerDelay={0.03}
          >
            결제 전, 이것만은 기억해주세요.
          </InkRevealText>
          <p className="text-[13px] md:text-[14px] text-ink-500 max-w-xl mx-auto leading-relaxed">
            같은 시간과 비용을 들이고도 결과가 다른 이유는, 준비의 차이입니다.
          </p>
        </div>

        <div className="space-y-4 md:space-y-5">
          {ITEMS.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-5 md:gap-6 items-start rounded-2xl border border-ink-300/25 bg-paper-50/60 p-5 md:p-6"
            >
              <div className="shrink-0 mt-0.5">
                <div className="w-9 h-9 rounded-full border-[1.5px] border-ink-700 bg-paper-50 flex items-center justify-center font-serif font-bold text-[14px] text-ink-900">
                  {String(i + 1).padStart(2, '0')}
                </div>
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-serif font-bold text-[16px] md:text-[18px] text-ink-900 leading-snug">
                  {item.title}
                </h3>
                <p className="text-[13px] md:text-[14px] text-ink-700 leading-[1.85]">
                  {item.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
