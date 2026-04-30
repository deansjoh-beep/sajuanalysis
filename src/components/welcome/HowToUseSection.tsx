import { motion } from 'motion/react';
import { Eye, Scale, Clock, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InkRevealText } from './InkRevealText';

interface QuadrantData {
  Icon: LucideIcon;
  label: string;
  title: string;
  body: string;
}

const QUADRANTS: QuadrantData[] = [
  {
    Icon: Eye,
    label: '01',
    title: '자기 이해의 도구로',
    body: '용어를 외우는 게 중요한 게 아닙니다. "나는 이런 식으로 에너지를 쓰는 사람이구나", "이런 환경에서 빛이 나는구나"를 체감하는 것이 핵심입니다. 자기 이해는 모든 의사결정의 기초가 됩니다.',
  },
  {
    Icon: Scale,
    label: '02',
    title: '의사결정의 보조 자료로',
    body: '사주가 결정해주는 게 아닙니다. 결정할 때 고려할 변수가 하나 늘어나는 겁니다. "지금 시기는 확장보다 안정이 맞다"는 정보가 있으면, 같은 결정의 무게중심이 달라집니다.',
  },
  {
    Icon: Clock,
    label: '03',
    title: '시기별 전략 수립',
    body: '진짜 실용적 가치는 여기 있습니다. 펼칠 때와 접을 때를 구분하는 것. 같은 사람이라도 어떤 해는 새로 벌이기 좋고, 어떤 해는 내실을 다지는 게 맞습니다. 인생의 호흡이 달라집니다.',
  },
  {
    Icon: Users,
    label: '04',
    title: '관계 이해',
    body: '배우자, 자녀, 동료를 "왜 저럴까"라는 답답함 대신 "저런 기질이구나"라는 이해로 보게 됩니다. 상대를 바꾸려는 시도가 줄고, 다른 방식의 소통을 시도하게 됩니다.',
  },
];

export function HowToUseSection() {
  return (
    <section className="relative px-4 py-20 md:py-28 bg-paper-100/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 md:mb-16 space-y-4">
          <InkRevealText
            as="h2"
            className="font-serif text-[26px] md:text-[36px] font-bold text-ink-900 leading-tight"
            staggerDelay={0.03}
          >
            보고서를 어떻게 활용하나요.
          </InkRevealText>
          <p className="text-[13px] md:text-[14px] text-ink-500 max-w-xl mx-auto leading-relaxed">
            "그래서 이걸 어떻게 써먹지?"<br className="md:hidden" /> 활용은 네 가지 방향으로 정리됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-7">
          {QUADRANTS.map((q, i) => (
            <motion.div
              key={q.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.7,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative rounded-3xl border border-ink-300/25 bg-paper-50/70 p-7 md:p-9 backdrop-blur-sm"
              style={{ boxShadow: '0 1px 0 rgba(168, 138, 74, 0.1), 0 12px 28px -12px rgba(58, 53, 48, 0.1)' }}
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-ink-900/5 border border-ink-700/10">
                  <q.Icon className="w-7 h-7 text-ink-700" strokeWidth={1.4} />
                </div>
                <span className="font-serif text-[28px] md:text-[34px] text-brush-gold/60 font-bold leading-none">
                  {q.label}
                </span>
              </div>
              <h3 className="font-serif font-bold text-[18px] md:text-[20px] text-ink-900 leading-snug mb-3">
                {q.title}
              </h3>
              <p className="text-[13px] md:text-[14px] text-ink-700 leading-[1.85]">
                {q.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
