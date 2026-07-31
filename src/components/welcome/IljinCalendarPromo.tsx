import { useMemo } from 'react';
import { getMonthIljin, getNextMonthKst } from '../../lib/iljinCalendar';

/**
 * 랜딩 — 다음 달 일진 캘린더 무료 제공 안내 (구매자 부가 서비스 홍보).
 * 샘플은 실제 다음 달 일진(간지는 만인 공통)을 예시 일간(甲) 기준 십성·등급으로 보여준다.
 * 계산은 전부 정적 — LLM·API 호출 없음.
 */

const SAMPLE_DAY_PILLAR = '甲子';

interface IljinCalendarPromoProps {
  /** '리포트 받기' CTA → 체크아웃 탭 이동 */
  onGetReport: () => void;
  /** '코드로 내려받기' CTA → 리포트 조회 탭 이동 */
  onGoLookup: () => void;
}

export function IljinCalendarPromo({ onGetReport, onGoLookup }: IljinCalendarPromoProps) {
  const { year, month } = getNextMonthKst();
  // 샘플 첫 7일 — 렌더당 1회 계산이면 충분하다.
  const sample = useMemo(() => getMonthIljin(year, month, SAMPLE_DAY_PILLAR).days.slice(0, 7), [year, month]);

  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 md:mb-12 space-y-4">
          <h2 className="font-serif text-[26px] md:text-[36px] font-bold text-ink-900 leading-tight">
            {month}월 일진 캘린더를 무료로 드립니다
          </h2>
          <p className="text-[13px] md:text-[14px] text-ink-500 max-w-xl mx-auto leading-relaxed">
            리포트를 받으신 분께는 매달, 다음 달의 하루하루를 내 일간 기준으로 풀이한 일진표를
            벽걸이 달력 형태의 PDF로 드립니다. 발급받은 사주 코드로 ‘리포트 조회’에서 언제든
            내려받을 수 있습니다.
          </p>
        </div>

        {/* 샘플 — 다음 달 첫 주 미리보기 */}
        <div className="rounded-2xl border border-ink-300/25 bg-paper-50/60 p-5 md:p-6">
          <p className="text-[12px] text-ink-500 mb-3">
            {year}년 {month}월 첫 주 미리보기 — 예시: 갑목(甲) 일간 기준. 실제 캘린더는 내 일간
            기준의 십성·길흉으로 한 달 전체가 담깁니다.
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {sample.map((d) => (
              <div key={d.day} className="rounded-lg border border-ink-300/25 bg-white px-1 py-2 text-center">
                <p className="text-[12px] text-ink-500">{d.day}일</p>
                <p className="font-serif text-[14px] font-bold text-ink-900 mt-0.5">{d.ganji}</p>
                <p className="text-[12px] text-ink-500 mt-0.5">{d.rating}</p>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-ink-500 mt-3">
            ◎ 대길일 · ○ 길일 · △ 평 · ▲ 주의 — 날마다 간지·십성과 한줄 해설이 함께 표기됩니다.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onGetReport}
            className="px-6 py-3 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold"
          >
            무료로 리포트 받기
          </button>
          <button
            onClick={onGoLookup}
            className="px-6 py-3 rounded-xl border border-ink-300/40 text-ink-700 text-[14px] font-bold"
          >
            이미 코드가 있어요 — 조회하기
          </button>
        </div>
      </div>
    </section>
  );
}
