import { motion } from 'motion/react';
import { Compass, RotateCcw, Heart, Sunrise, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InkRevealText } from './InkRevealText';

interface CardData {
  Icon: LucideIcon;
  title: string;
  scenario: string;
  insight: string;
}

const CARDS: CardData[] = [
  {
    Icon: Compass,
    title: '큰 결정을 앞두고',
    scenario: '"이직을 1년째 고민 중이에요."',
    insight: '되돌리기 어려운 선택 앞에서, 검토할 변수를 하나 더 가져갑니다.',
  },
  {
    Icon: RotateCcw,
    title: '반복되는 패턴이 보일 때',
    scenario: '"왜 매번 비슷한 사람을 만날까요."',
    insight: '구조적 원인을 짚으면, 패턴을 끊어낼 단서가 보입니다.',
  },
  {
    Icon: Heart,
    title: '자녀의 기질을 이해하고 싶을 때',
    scenario: '"우리 아이를 어떻게 키워야 할지 막막해요."',
    insight: '강요가 아닌 이해의 도구로 쓰일 때, 양육이 가벼워집니다.',
  },
  {
    Icon: Sunrise,
    title: '대운이 바뀌는 시기에',
    scenario: '"10년 단위로 인생의 결이 달라지는 전환점."',
    insight: '방향을 점검할 가장 효율적인 시점을 짚어드립니다.',
  },
  {
    Icon: Moon,
    title: '슬럼프가 길어질 때',
    scenario: '"노력해도 안 풀리는 시기가 너무 길어요."',
    insight: '"지금이 어떤 시기인지" 객관화만으로 자책에서 벗어납니다.',
  },
];

export function WhenToUseSection() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 md:mb-16 space-y-4">
          <InkRevealText
            as="h2"
            className="font-serif text-[26px] md:text-[36px] font-bold text-ink-900 leading-tight"
            staggerDelay={0.03}
          >
            이런 분께 권합니다.
          </InkRevealText>
          <p className="text-[13px] md:text-[14px] text-ink-500 max-w-xl mx-auto leading-relaxed">
            사주 상담은 아무 때나 받아도 되지만,<br className="md:hidden" /> 활용도가 특히 높은 시점이 따로 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.6,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group rounded-3xl border border-ink-300/30 bg-paper-50/60 backdrop-blur-sm p-6 md:p-7 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              style={{ boxShadow: '0 1px 0 rgba(168, 138, 74, 0.08), 0 8px 20px -8px rgba(58, 53, 48, 0.08)' }}
            >
              <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-2xl border border-ink-700/15 bg-paper-100/60">
                <card.Icon className="w-6 h-6 text-ink-700" strokeWidth={1.4} />
              </div>
              <h3 className="font-serif font-bold text-[17px] md:text-[18px] text-ink-900 leading-snug mb-2">
                {card.title}
              </h3>
              <p className="font-serif italic text-[13px] text-ink-500 mb-3 leading-relaxed">
                {card.scenario}
              </p>
              <p className="text-[13px] text-ink-700 leading-relaxed">
                {card.insight}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
