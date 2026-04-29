import { motion } from 'motion/react';
import { ArrowRight, Briefcase, Calendar, Sparkles } from 'lucide-react';
import { TAB_TRANSITION } from '../../constants/styles';
import { PaperBackground } from '../welcome/PaperBackground';

/**
 * 리포트 탭 — 프리미엄 3종 상품 진열 페이지.
 *
 * AI 리포트 생성 기능은 만세력(dashboard) 페이지로 이전되었으므로 이 페이지는
 * 단순한 상품 쇼케이스 + 한지·먹 톤 적용으로 단순화.
 *
 * App.tsx의 기존 props 시그니처를 깨지 않기 위해 모든 props를 그대로 받지만
 * 실제로는 onGoToOrder / onGoToYearlyOrder / onGoToJobCareer 만 사용.
 */
export interface ReportTabContentProps {
  tabTransition?: any;
  glassTabBgClass?: string;
  glassPanelStrongClass?: string;
  loading?: boolean;
  sajuResultLength?: number;
  reportContent?: string | null;
  isPrinting?: boolean;
  userName?: string;
  consultationMode?: 'basic' | 'advanced';
  consultationModeRef?: React.MutableRefObject<'basic' | 'advanced'>;
  setIsPrinting?: React.Dispatch<React.SetStateAction<boolean>>;
  setConsultationMode?: React.Dispatch<React.SetStateAction<'basic' | 'advanced'>>;
  setReportContent?: React.Dispatch<React.SetStateAction<string | null>>;
  handleGenerateReport?: () => void;
  onGoToOrder?: () => void;
  onGoToYearlyOrder?: () => void;
  onGoToJobCareer?: () => void;
}

interface ProductCardData {
  badge: string;
  title: string;
  hanja: string;
  tagline: string;
  description: string;
  bullets: string[];
  price: string;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export function ReportTabContent({
  onGoToOrder,
  onGoToYearlyOrder,
  onGoToJobCareer,
}: ReportTabContentProps) {
  const products: ProductCardData[] = [
    {
      badge: 'Lifetime Guide',
      title: '인생가이드북',
      hanja: '人生指南',
      tagline: '평생을 곁에 두고 보는 한 권의 명리 지도',
      description:
        '사주 원국과 격국, 대운의 전체 흐름을 한 권으로 정리해 드립니다. 자기 이해의 출발점이 되는 가장 기본이자 가장 깊은 리포트입니다.',
      bullets: [
        '사주팔자 원국 정밀 해설 + 지장간 풀이',
        '격국·용신 분석으로 자기 이해의 뼈대',
        '인생 전반의 대운 흐름 — 펼칠 때와 다듬을 때',
        '재물·연애·직업·건강 분야별 활용 가이드',
      ],
      price: '5,000원',
      cta: '인생가이드북 주문하기',
      icon: Sparkles,
      onClick: onGoToOrder,
    },
    {
      badge: 'Yearly 2026',
      title: '프리미엄 일년운세 2026',
      hanja: '丙午年運勢',
      tagline: '2026년 한 해, 달마다 무엇을 펼치고 거둘 것인가',
      description:
        '2026년 세운(歲運)과 12개월 월운(月運)을 사용자 사주 원국과 결합해 풀어드립니다. 한 해의 호흡을 미리 가늠하고 실행 리듬을 잡는 데 쓰는 리포트입니다.',
      bullets: [
        '2026 세운 — 한 해의 큰 결',
        '12개월 월별 흐름과 주의 시점',
        '연간 체크리스트 — 무엇을 펼치고 무엇을 다듬을 것인가',
        '대운과 세운이 만나는 핵심 길흉 포인트',
      ],
      price: '5,000원',
      cta: '일년운세 2026 주문하기',
      icon: Calendar,
      onClick: onGoToYearlyOrder,
    },
    {
      badge: 'Career & Job',
      title: '직업운 리포트',
      hanja: '職業運報告',
      tagline: '나는 어떤 환경에서 가장 빛나는 사람인가',
      description:
        '사주 구조에서 본 적성·강점·환경 적합도를 분석합니다. 이직·창업·승진 타이밍을 실제 결정에 쓸 수 있는 형태로 정리합니다.',
      bullets: [
        '커리어 DNA — 본질적 적성과 강점',
        '잘 맞는 환경 vs 소진되는 환경',
        '이직·창업·승진 타이밍 가늠표',
        '함께할 때 시너지 나는 동료/상사 유형',
      ],
      price: '5,000원',
      cta: '직업운 리포트 주문하기',
      icon: Briefcase,
      onClick: onGoToJobCareer,
    },
  ];

  return (
    <motion.div
      key="report"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={TAB_TRANSITION}
      className="absolute inset-0 overflow-y-auto hide-scrollbar bg-paper-50"
      data-theme="light"
    >
      {/* 한지 배경 — sticky로 스크롤 영역 고정 */}
      <div className="sticky top-0 left-0 w-full h-screen pointer-events-none -mb-[100vh]">
        <PaperBackground />
      </div>

      <div className="relative px-4 py-12 md:py-20 md:px-10">
        <div className="max-w-3xl mx-auto space-y-12 md:space-y-16">
          {/* 페이지 헤더 */}
          <header className="text-center space-y-4">
            <p className="text-[10px] tracking-[0.3em] uppercase text-brush-gold font-bold">
              Premium Reports
            </p>
            <h2 className="font-serif text-[28px] md:text-[40px] font-bold text-ink-900 leading-tight">
              깊이 보고 싶은 분께
            </h2>
            <p className="text-[13px] md:text-[15px] text-ink-700 leading-[1.85] max-w-2xl mx-auto">
              만세력의 즉시 해설로는 다 풀어내지 못하는 영역이 있습니다.
              <br className="hidden md:block" />
              세 가지 프리미엄 리포트는 각각 한 가지 주제를 깊이 다룹니다.
              <br className="hidden md:block" />
              필요한 시점에 필요한 한 권만 골라 보세요.
            </p>
          </header>

          {/* 3종 세로 진열 */}
          <div className="space-y-8 md:space-y-10">
            {products.map((p, i) => (
              <ProductCard key={p.title} product={p} index={i} />
            ))}
          </div>

          {/* 풀이 노트 */}
          <div
            className="rounded-3xl border border-brush-gold/30 bg-gradient-to-br from-paper-50/75 to-paper-100/55 px-6 py-6 md:px-8 md:py-7"
            style={{
              boxShadow:
                '0 1px 0 rgba(168, 138, 74, 0.1), 0 10px 28px -12px rgba(58, 53, 48, 0.12)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brush-gold mb-3">
              구매 전 안내
            </p>
            <ul className="space-y-2 text-[13px] md:text-[14px] text-ink-700 leading-[1.85]">
              <li className="flex gap-2">
                <span className="text-brush-gold shrink-0">·</span>
                <span>주문 후 1~2일 내 PDF로 메일 발송됩니다.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brush-gold shrink-0">·</span>
                <span>전문 술사가 작성한 정밀 리포트로, 만세력의 즉시 해설보다 분량과 깊이가 큽니다.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brush-gold shrink-0">·</span>
                <span>한 번 받은 리포트는 평생 다시 읽으며 활용하실 수 있습니다.</span>
              </li>
            </ul>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-ink-500 leading-relaxed text-center pt-4">
            본 리포트는 전통 명리학 해석에 기반한 참고용 자료입니다. 과학적 사실이 아니며, 모든
            최종 결정과 책임은 사용자 본인에게 있습니다.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────
// 상품 카드 — 한지·먹 톤
// ──────────────────────────────────────────────────────────
function ProductCard({ product, index }: { product: ProductCardData; index: number }) {
  const Icon = product.icon;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-[2rem] border border-ink-300/30 bg-paper-50/70 backdrop-blur-sm overflow-hidden"
      style={{
        boxShadow:
          '0 1px 0 rgba(168, 138, 74, 0.1), 0 14px 36px -16px rgba(58, 53, 48, 0.16)',
      }}
    >
      {/* 카드 상단 골드 라인 */}
      <div className="h-px bg-gradient-to-r from-transparent via-brush-gold/40 to-transparent" />

      <div className="p-6 md:p-10 space-y-5 md:space-y-6">
        {/* 헤더: 배지 + 아이콘 */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brush-gold">
              {product.badge}
            </p>
            <div className="flex items-baseline gap-3">
              <h3 className="font-serif text-[22px] md:text-[28px] font-bold text-ink-900 leading-tight">
                {product.title}
              </h3>
              <span className="font-serif text-[13px] md:text-[15px] text-brush-gold/70">
                {product.hanja}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-ink-900 flex items-center justify-center shrink-0 shadow-md">
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-paper-50" />
          </div>
        </div>

        {/* 태그라인 */}
        <p className="font-serif text-[15px] md:text-[18px] text-ink-700 italic leading-snug">
          "{product.tagline}"
        </p>

        {/* 설명 */}
        <p className="text-[13px] md:text-[14px] text-ink-700 leading-[1.95]">
          {product.description}
        </p>

        {/* 핵심 내용 */}
        <ul className="space-y-2 pt-2 border-t border-ink-300/20">
          {product.bullets.map((b, i) => (
            <li
              key={i}
              className="flex gap-3 text-[13px] md:text-[14px] text-ink-700 leading-[1.85]"
            >
              <span className="text-brush-gold shrink-0 mt-1.5 w-1 h-1 rounded-full bg-brush-gold" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* 가격 + CTA */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-ink-300/20 flex-wrap">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
              가격
            </p>
            <p className="font-serif text-[20px] md:text-[24px] font-bold text-ink-900">
              {product.price}
            </p>
          </div>
          <button
            type="button"
            onClick={product.onClick}
            disabled={!product.onClick}
            className="inline-flex items-center gap-2 px-5 py-3 md:px-6 md:py-3.5 rounded-full bg-ink-900 text-paper-50 text-[13px] md:text-[14px] font-bold hover:bg-ink-700 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {product.cta}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
