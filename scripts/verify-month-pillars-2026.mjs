import { getMonthPillarsForYear } from '../src/lib/seoulDateGanji.ts';

const pillars = getMonthPillarsForYear(2026);
console.log('=== 2026년 월별 월주 ===');
pillars.forEach(p => {
  console.log(`${String(p.month).padStart(2, ' ')}월: ${p.monthPillarHanja} (${p.monthPillarHangul})`);
});
