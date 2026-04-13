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
