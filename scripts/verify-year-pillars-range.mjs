import { getYearPillarsForRange } from '../src/lib/seoulDateGanji.ts';

const pillars = getYearPillarsForRange(2024, 2030);
console.log('=== 2024~2030 세운 ===');
pillars.forEach(p => {
  console.log(`${p.year}년: ${p.yearPillarHanja} (${p.yearPillarHangul})`);
});
