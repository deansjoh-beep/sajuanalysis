import { motion } from 'motion/react';
import { Book, Calendar, Briefcase, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InkRevealText } from './InkRevealText';

type ProductType = 'premium' | 'yearly2026' | 'jobCareer' | 'loveMarriage';

interface ProductData {
  type: ProductType;
  Icon: LucideIcon;
  title: string;
  forWhom: string;
  body: string;
  meta: string;
}

const PRODUCTS: ProductData[] = [
  {
    type: 'premium',
    Icon: Book,
    title: '인생가이드북',
    forWhom: '큰 결정을 앞두고, 자기 이해의 깊이가 필요한 분께',
    body: '사주 원국·대운·세운을 통합 분석한 종합 보고서. 당신이라는 사람을 더 잘 이해하고, 남은 인생의 큰 그림을 그릴 수 있도록 돕습니다.',
    meta: '종합 PDF · 1회 결제',
  },
  {
    type: 'yearly2026',
    Icon: Calendar,
    title: '2026 일년운세',
    forWhom: '내년 한 해를 미리 준비하고 싶은 분께',
    body: '2026년 한 해를 사주 원국·대운·세운·월별 흐름으로 통합 분석한 10페이지 맞춤 리포트. 가장 큰 고민에 먼저 직답한 뒤 월별 상세까지 짚어드립니다.',
    meta: '연간 리포트 · 10p',
  },
  {
    type: 'jobCareer',
    Icon: Briefcase,
    title: '직업운 리포트',
    forWhom: '이직·창업·승진 타이밍을 앞두고 있는 분께',
    body: '현재 대운과 향후 3년 세운을 토대로 이직·창업·승진의 최적 타이밍을 분석한 커리어 전문 리포트. 재성·관성·식상으로 직업 DNA를 짚어드립니다.',
    meta: '커리어 전문 · 1회 결제',
  },
  {
    type: 'loveMarriage',
    Icon: Heart,
    title: '연애·결혼운 가이드북',
    forWhom: '관계의 시기와 어울리는 사람을 깊이 보고 싶은 분께',
    body: '연애운(편재·편관·도화)과 결혼운(정재·정관·일지)을 별도 섹션으로 분리해 분석합니다. 작용하는 십성과 시기 단위가 달라 깊이가 사라지지 않습니다.',
    meta: '관계 전문 · 1회 결제',
  },
];

interface PremiumProductsSectionProps {
  onProductClick: (type: ProductType) => void;
}

export function PremiumProductsSection({ onProductClick }: PremiumProductsSectionProps) {
  return (
    <section className="relative px-4 py-20 md:py-28 bg-paper-100/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 md:mb-16 space-y-4">
          <InkRevealText
            as="h2"
            className="font-serif text-[26px] md:text-[36px] font-bold text-ink-900 leading-tight"
            staggerDelay={0.03}
          >
            네 가지 깊이의 보고서.
          </InkRevealText>
          <p className="text-[13px] md:text-[14px] text-ink-500 max-w-xl mx-auto leading-relaxed">
            지금 가장 필요한 한 권을 고르세요.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {PRODUCTS.map((product, i) => (
            <motion.button
              key={product.type}
              type="button"
              onClick={() => onProductClick(product.type)}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group flex flex-col text-left rounded-3xl border border-ink-300/30 bg-paper-50/70 backdrop-blur-sm p-7 md:p-8 hover:-translate-y-1 transition-all"
              style={{ boxShadow: '0 1px 0 rgba(168, 138, 74, 0.1), 0 12px 28px -12px rgba(58, 53, 48, 0.12)' }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-ink-900 text-paper-50 shadow-md shadow-ink-700/20">
                  <product.Icon className="w-6 h-6" strokeWidth={1.6} />
                </div>
                <span className="text-[10px] tracking-widest uppercase text-brush-gold font-bold">
                  {product.meta}
                </span>
              </div>
              <h3 className="font-serif font-bold text-[20px] md:text-[22px] text-ink-900 leading-tight mb-2">
                {product.title}
              </h3>
              <p className="text-[12px] md:text-[13px] text-seal/90 font-medium mb-4 leading-snug">
                {product.forWhom}
              </p>
              <p className="text-[13px] text-ink-700 leading-[1.85] flex-1">
                {product.body}
              </p>
              <div className="mt-6 flex items-center gap-2 text-[13px] text-ink-900 font-bold group-hover:gap-3 transition-all">
                자세히 보기 <span>→</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
