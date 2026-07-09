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

export function buildMyeongsikFromBirth(input: BirthFormInput): MyeongsikParams {
  const analysis = buildSajuAnalysis({
    dateStr: input.dateStr,
    timeStr: input.unknownTime ? '12:00' : input.timeStr,
    isLunar: input.isLunar,
    isLeap: false,
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
