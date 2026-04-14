import { Solar } from 'lunar-javascript';
import { hanjaToHangul } from '../utils/saju';

export const getSeoulTodayParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);

  if (!year || !month || !day) {
    throw new Error('서울 기준 현재 날짜 계산에 실패했습니다.');
  }

  return { year, month, day };
};

const formatYmdFromUtcDate = (date: Date) => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const formatYmFromUtcDate = (date: Date) => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getSeoulTodayYmd = () => {
  const { year, month, day } = getSeoulTodayParts();
  const base = new Date(Date.UTC(year, month - 1, day));
  return formatYmdFromUtcDate(base);
};

export const getSeoulYmOffset = (monthOffset: number) => {
  const { year, month } = getSeoulTodayParts();
  const date = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  return formatYmFromUtcDate(date);
};

export const getSeoulMonthEndYmdOffset = (monthOffsetForDayZero: number) => {
  const { year, month } = getSeoulTodayParts();
  const date = new Date(Date.UTC(year, month - 1 + monthOffsetForDayZero, 0));
  return formatYmdFromUtcDate(date);
};

export const getDayPillarKST = (dayOffset: number = 0) => {
  const { year, month, day } = getSeoulTodayParts();
  const base = new Date(Date.UTC(year, month - 1, day + dayOffset));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = base.getUTCDate();

  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  try {
    if (eightChar && typeof (eightChar as any).setDayZero === 'function') {
      (eightChar as any).setDayZero(2);
    }
  } catch {
    // library default를 사용합니다.
  }

  const dayPillarHanja = eightChar.getDay();
  const stem = dayPillarHanja.charAt(0);
  const branch = dayPillarHanja.charAt(1);
  const dayPillarHangul = `${hanjaToHangul[stem] || stem}${hanjaToHangul[branch] || branch}`;

  return {
    dateText: `${y}년 ${m}월 ${d}일`,
    dayPillarHanja,
    dayPillarHangul
  };
};

export const getTodayDayPillarKST = () => getDayPillarKST(0);

export const getNearbyDayPillarsKST = () => ({
  yesterday: getDayPillarKST(-1),
  today: getDayPillarKST(0),
  tomorrow: getDayPillarKST(1),
  dayAfterTomorrow: getDayPillarKST(2),
});

export const getCurrentYearPillarKST = () => {
  const { year, month, day } = getSeoulTodayParts();

  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  const yearPillarHanja = eightChar.getYear();
  const stem = yearPillarHanja.charAt(0);
  const branch = yearPillarHanja.charAt(1);
  const yearPillarHangul = `${hanjaToHangul[stem] || stem}${hanjaToHangul[branch] || branch}`;

  return {
    year,
    yearPillarHanja,
    yearPillarHangul
  };
};

/**
 * 지정 연도의 12개 양력 달 각각에 해당하는 월주(月柱) 간지를 계산합니다.
 * 각 달의 15일을 기준으로 lunar-javascript가 절기를 반영해 월주를 반환합니다.
 * (양력 15일은 해당 양력 달의 월절기 이후가 확실하므로 안전합니다.)
 *
 * 프리미엄 일년운세 리포트에서 2026년 월별 흐름을 서술할 때 모델에 주입하여
 * 할루시네이션을 방지합니다.
 */
export const getMonthPillarsForYear = (
  year: number
): Array<{ month: number; monthPillarHanja: string; monthPillarHangul: string }> => {
  const out: Array<{ month: number; monthPillarHanja: string; monthPillarHangul: string }> = [];
  for (let m = 1; m <= 12; m++) {
    const solar = Solar.fromYmd(year, m, 15);
    const lunar = solar.getLunar();
    const eightChar = lunar.getEightChar();
    const monthPillarHanja = eightChar.getMonth();
    const stem = monthPillarHanja.charAt(0);
    const branch = monthPillarHanja.charAt(1);
    const monthPillarHangul = `${hanjaToHangul[stem] || stem}${hanjaToHangul[branch] || branch}`;
    out.push({ month: m, monthPillarHanja, monthPillarHangul });
  }
  return out;
};

export const getCurrentMonthPillarKST = () => {
  const { year, month, day } = getSeoulTodayParts();

  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  const monthPillarHanja = eightChar.getMonth();
  const stem = monthPillarHanja.charAt(0);
  const branch = monthPillarHanja.charAt(1);
  const monthPillarHangul = `${hanjaToHangul[stem] || stem}${hanjaToHangul[branch] || branch}`;

  return {
    year,
    month,
    monthPillarHanja,
    monthPillarHangul,
  };
};
