import { motion } from 'motion/react';
import { InkRevealText } from './InkRevealText';

interface RowData {
  problem: string;
  solution: string;
}

const ROWS: RowData[] = [
  {
    problem: '"당신 사주는 안 좋다"는 공포 마케팅',
    solution: '절대적 길흉 대신, 기질의 양면성을 설명합니다',
  },
  {
    problem: '부적·굿 같은 추가 결제 유도',
    solution: 'PDF 보고서 1회 결제로 끝, 추가 권유는 없습니다',
  },
  {
    problem: '한 번 보고 끝나는 단발성 상담',
    solution: '시기별로 다시 읽는 활용 가이드를 함께 드립니다',
  },
  {
    problem: '단정적 예언으로 의존성을 만드는 해석',
    solution: '가능성의 폭을 보여주고, 선택은 본인에게 남깁니다',
  },
];

export function DifferentiationTable() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 md:mb-16 space-y-4">
          <InkRevealText
            as="h2"
            className="font-serif text-[26px] md:text-[36px] font-bold text-ink-900 leading-tight"
            staggerDelay={0.03}
          >
            왜 유아이인가요.
          </InkRevealText>
          <p className="text-[13px] md:text-[14px] text-ink-500 max-w-xl mx-auto leading-relaxed">
            함정을 피하는 방식이 곧 차별점입니다.
          </p>
        </div>

        {/* 데스크탑: 2열 비교표 */}
        <div className="hidden md:grid grid-cols-2 gap-0 rounded-3xl overflow-hidden border border-ink-300/30 bg-paper-50/60 backdrop-blur-sm" style={{ boxShadow: '0 1px 0 rgba(168, 138, 74, 0.1), 0 12px 28px -12px rgba(58, 53, 48, 0.1)' }}>
          {/* 헤더 */}
          <div className="px-7 py-5 border-r border-ink-300/25 border-b bg-paper-100/50">
            <p className="text-[11px] tracking-[0.2em] uppercase text-ink-500 font-bold">일반 사주 시장</p>
          </div>
          <div className="px-7 py-5 border-b border-ink-300/25 bg-seal/[0.04]">
            <p className="text-[11px] tracking-[0.2em] uppercase text-seal font-bold">유아이의 접근</p>
          </div>

          {/* 행 — 좌(문제)/우(해결)을 각각 별도 motion으로 처리. display:contents 사용 X */}
          {ROWS.map((row, i) => (
            <div key={i} className="contents">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={`px-7 py-6 border-r border-ink-300/25 ${i < ROWS.length - 1 ? 'border-b' : ''}`}
              >
                <p className="text-[14px] md:text-[15px] text-ink-500 leading-relaxed line-through decoration-ink-500/40 decoration-1">
                  {row.problem}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.08 + 0.15,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`px-7 py-6 ${i < ROWS.length - 1 ? 'border-b border-ink-300/25' : ''} bg-paper-50/50`}
              >
                <p className="text-[14px] md:text-[15px] text-ink-900 leading-relaxed font-medium">
                  {row.solution}
                </p>
              </motion.div>
            </div>
          ))}
        </div>

        {/* 모바일: 카드 스택 */}
        <div className="md:hidden space-y-4">
          {ROWS.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.06 }}
              className="rounded-2xl border border-ink-300/30 bg-paper-50/60 p-5 space-y-3"
            >
              <div className="space-y-1">
                <p className="text-[10px] tracking-widest uppercase text-ink-500 font-bold">일반 시장</p>
                <p className="text-[13px] text-ink-500 line-through decoration-ink-500/40">{row.problem}</p>
              </div>
              <div className="border-t border-ink-300/20 pt-3 space-y-1">
                <p className="text-[10px] tracking-widest uppercase text-seal font-bold">유아이</p>
                <p className="text-[14px] text-ink-900 font-medium leading-relaxed">{row.solution}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
