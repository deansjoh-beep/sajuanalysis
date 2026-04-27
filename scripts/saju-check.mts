import { getSajuData, getDaeunData, calculateYongshin, hanjaToHangul } from '../src/utils/saju.js';
import { getCurrentYearPillarKST } from '../src/lib/seoulDateGanji.js';

const saju = getSajuData('1969-12-02','10:00',false,false,false,'Asia/Seoul');
const daeun = getDaeunData('1969-12-02','10:00',false,false,'M',false);
const yongshin = calculateYongshin(saju);
const cur = getCurrentYearPillarKST();

console.log('=== 사주 원국 (1969.12.02 양력 10:00 남성) ===');
saju.forEach((p: any) => console.log(`  ${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja})  십성: ${p.stem.deity}/${p.branch.deity}`));

console.log('\n=== 용신 분석 ===');
console.log('  강약:', yongshin.strength);
console.log('  조후:', yongshin.johooStatus);
console.log('  용신:', yongshin.yongshin);
console.log('  기신:', yongshin.eokbuYongshin ?? '');
console.log('  논리:', yongshin.logicBasis ?? '');

const age = cur.year - 1969;
const cd = daeun.find((d: any) => cur.year >= d.startYear && cur.year < d.startYear + 10);
console.log(`\n=== 현재 (${cur.year}년, 만 ${age}세) ===`);
if (cd) {
  const sh = hanjaToHangul[cd.stem] || cd.stem;
  const bh = hanjaToHangul[cd.branch] || cd.branch;
  console.log(`  현재 대운: ${cd.startAge}세~ ${sh}(${cd.stem})${bh}(${cd.branch}) (${cd.startYear}~${cd.startYear+9}년)`);
}

console.log('\n=== 전체 대운 ===');
daeun.forEach((d: any) => {
  const sh = hanjaToHangul[d.stem] || d.stem;
  const bh = hanjaToHangul[d.branch] || d.branch;
  const marker = (cur.year >= d.startYear && cur.year < d.startYear+10) ? ' ◀ 현재' : '';
  console.log(`  ${String(d.startAge).padStart(2,'0')}세 (${d.startYear}~${d.startYear+9}년): ${sh}(${d.stem})${bh}(${d.branch})${marker}`);
});
