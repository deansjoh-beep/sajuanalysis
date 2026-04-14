import { getSajuData, getDaeunData, calculateYongshin, calculateGyeok, getHapChungSummary, getShinsalSummary, getGongmangSummary, getOriginalSipseungSummary, getSipseung } from '../src/utils/saju.ts';
import { getCurrentYearPillarKST } from '../src/lib/seoulDateGanji.ts';

// 오세진 1969-12-02 양력 남성. 시간 미상 → unknownTime=true
const saju = getSajuData('1969-12-02', '12:00', false, false, true);
console.log('=== 사주 원국 (년/월/일/시 순, 배열은 역순으로 시→년) ===');
saju.forEach(p => {
  console.log(`${p.title}: ${p.stem.hanja}${p.branch.hanja} (${p.stem.hangul}${p.branch.hangul}) - 천간십성:${p.stem.deity} 지지십성:${p.branch.deity} 지장간:${p.branch.hidden}`);
});

const daeun = getDaeunData('1969-12-02', '12:00', false, false, 'M', true);
console.log('\n=== 대운 ===');
daeun.forEach(d => {
  console.log(`${d.startAge}세(${d.startYear}년~): ${d.stem}${d.branch}`);
});

// saju array is [시, 일, 월, 년] after internal reverse
const dayStem = saju[1].stem.hanja; // 일간
console.log('\n=== 일간 ===', dayStem, `(${saju[2].stem.hangul})`);

const yongshin = calculateYongshin(saju);
console.log('\n=== 용신 ===');
console.log(JSON.stringify(yongshin, null, 2));

console.log('\n=== 격국 ===');
console.log(calculateGyeok(saju));

const cy = getCurrentYearPillarKST();
console.log('\n=== 2026 세운 ===');
console.log(JSON.stringify(cy, null, 2));

// 2026년 세운 십성 (일간 기준)
const seunStem2026 = '丙'; // 2026 = 丙午
const seunBranch2026 = '午';
// 실제 KST 올해는 2026일 것
const realSeunStem = cy.yearPillarHanja.charAt(0);
const realSeunBranch = cy.yearPillarHanja.charAt(1);
import('../src/utils/saju.ts').then(m => {
  console.log('\n2026 세운 천간십성:', m.calculateDeity(dayStem, realSeunStem));
  console.log('2026 세운 지지십성:', m.calculateDeity(dayStem, realSeunBranch, true));
  console.log('2026 세운 운성:', getSipseung(dayStem, realSeunBranch));
});

console.log('\n합충:', getHapChungSummary(saju));
console.log('신살:', getShinsalSummary(saju));
console.log('공망:', getGongmangSummary(saju[3].stem.hanja, saju[3].branch.hanja, saju));
console.log('원국십성:', getOriginalSipseungSummary(dayStem, saju));
