import { Solar } from 'lunar-javascript';

function test(y, m, d, h, gender) {
  const solar = Solar.fromYmdHms(y, m, d, h, 0, 0);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  const yun = eightChar.getYun(gender);
  const daYunArr = yun.getDaYun(12);
  console.log(daYunArr.map(d => ({ age: d.getStartAge(), year: d.getStartYear(), ganzhi: d.getGanZhi() })));
}

test(1969, 12, 2, 10, 1);
