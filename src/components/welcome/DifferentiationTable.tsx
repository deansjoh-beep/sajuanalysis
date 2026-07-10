import { motion } from 'motion/react';
import { InkRevealText } from './InkRevealText';

interface RowData {
  problem: string;
  solution: string;
}

const ROWS: RowData[] = [
  {
    problem: '이름·생년월일을 서버에 쌓아두는 운영',
    solution: '개인정보 무저장 — 원문은 저장하지 않고, 코드 하나로만 리포트를 다시 엽니다',
  },
  {
    problem: '근거를 알 수 없는 즉흥 풀이',
    solution: '자평 명리 기준서 기반 규칙 엔진 — 판정 근거가 표준 규칙으로 남습니다',
  },
  {
    problem: '표준시 그대로 계산한 대략의 만세력',
    solution: '진태양시 보정·역사적 시간대까지 반영한 정밀 만세력',
  },
  {
    problem: '수만 원대 상담에 부적·굿 같은 추가 결제 유도',
    solution: '일년운세·직업·연애 4,900원, 평생 리포트 9,900원 — 1회 결제로 끝',
  },
  {
    problem: '한 번 보고 끝나는 결과지',
    solution: '코드를 저장해 두면 재구매 혜택 — 새해 리포트 10% 할인과 후속 질문 3회',
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
            다섯 가지가 다릅니다.
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
