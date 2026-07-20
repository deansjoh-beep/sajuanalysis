import { buildSajuAnalysis } from './analysis/schema';
import type { BirthFormInput } from './runReportGeneration';

/**
 * 생년월일 입력 → 저장용 MyeongsikParams(pillars/대운 방향 등, 개인정보 없음).
 * 선물 코드 리딤(CodeLookupTab)과 결제 확정(CheckoutTab)이 공유한다.
 */

export interface MyeongsikParams {
  pillars: { year: string; month: string; day: string; hour: string | null };
  gender: 'male' | 'female';
  daeunsu: number;
  daeunDirection: 'forward' | 'backward';
  birthYear: number;
  timeUnknown: boolean;
}

const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];

/**
 * 재입력한 생년월일이 코드에 등록된 명식과 같은 사주인지 검증한다.
 * 결제 후 생성 중 이탈한 주문을 복구할 때, 다른 사주로 리포트가 생성되는 사고를 막는
 * 무결성 검증(겸 구매자 본인 확인). 서버에 생년월일 원문이 없으므로 간지 비교가 유일한 수단.
 */
export function myeongsikMatches(stored: MyeongsikParams, entered: MyeongsikParams): boolean {
  return (
    stored.pillars.year === entered.pillars.year &&
    stored.pillars.month === entered.pillars.month &&
    stored.pillars.day === entered.pillars.day &&
    (stored.pillars.hour ?? null) === (entered.pillars.hour ?? null) &&
    stored.gender === entered.gender
  );
}

export function buildMyeongsikFromBirth(input: BirthFormInput): MyeongsikParams {
  const analysis = buildSajuAnalysis({
    dateStr: input.dateStr,
    timeStr: input.unknownTime ? '12:00' : input.timeStr,
    isLunar: input.isLunar,
    isLeap: input.isLeap ?? false,
    gender: input.gender,
    unknownTime: input.unknownTime,
  });
  const [year, month, day, hour] = analysis.myeongsik.map((p) => p.ganzhi);
  const yearStem = year.charAt(0);
  const isYang = YANG_STEMS.includes(yearStem);
  const forward = (isYang && input.gender === 'M') || (!isYang && input.gender === 'F');
  return {
    pillars: { year, month, day, hour: input.unknownTime || hour === '??' ? null : hour },
    gender: input.gender === 'M' ? 'male' : 'female',
    daeunsu: analysis.daeun[0]?.startAge ?? 0,
    daeunDirection: forward ? 'forward' : 'backward',
    birthYear: Number(input.dateStr.slice(0, 4)),
    timeUnknown: input.unknownTime,
  };
}
