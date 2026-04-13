// src/utils/sajuAlgorithm.ts

export const STEMS = [
  { hanja: '甲', kor: '갑', eng: 'Gap' },
  { hanja: '乙', kor: '을', eng: 'Eul' },
  { hanja: '丙', kor: '병', eng: 'Byeong' },
  { hanja: '丁', kor: '정', eng: 'Jeong' },
  { hanja: '戊', kor: '무', eng: 'Mu' },
  { hanja: '己', kor: '기', eng: 'Gi' },
  { hanja: '庚', kor: '경', eng: 'Gyeong' },
  { hanja: '辛', kor: '신', eng: 'Sin' },
  { hanja: '壬', kor: '임', eng: 'Im' },
  { hanja: '癸', kor: '계', eng: 'Gye' },
];

export const BRANCHES = [
  { hanja: '子', kor: '자', eng: 'Ja' },
  { hanja: '丑', kor: '축', eng: 'Chuk' },
  { hanja: '寅', kor: '인', eng: 'In' },
  { hanja: '卯', kor: '묘', eng: 'Myo' },
  { hanja: '辰', kor: '진', eng: 'Jin' },
  { hanja: '巳', kor: '사', eng: 'Sa' },
  { hanja: '午', kor: '오', eng: 'O' },
  { hanja: '未', kor: '미', eng: 'Mi' },
  { hanja: '申', kor: '신', eng: 'Sin' },
  { hanja: '酉', kor: '유', eng: 'Yu' },
  { hanja: '戌', kor: '술', eng: 'Sul' },
  { hanja: '亥', kor: '해', eng: 'Hae' },
];

// 21세기 기준 24절기 중 매월의 시작이 되는 절기(입춘, 경칩 등 12개)의 근사치 C값
// 공식: 날짜 = Math.floor(Y * 0.2422 + C) - Math.floor((Y - 1) / 4)
// Y는 연도의 마지막 2자리
const SOLAR_TERMS_C = [
  5.4055, // 1월 소한
  4.6295, // 2월 입춘 (연도 변경 기준)
  5.63,   // 3월 경칩
  4.81,   // 4월 청명
  5.52,   // 5월 입하
  5.678,  // 6월 망종
  7.108,  // 7월 소서
  7.5,    // 8월 입추
  7.646,  // 9월 백로
  8.318,  // 10월 한로
  7.438,  // 11월 입동
  7.18    // 12월 대설
];

/**
 * 간단한 절기 계산 알고리즘
 * 특정 연도와 월의 절기(월의 시작일)를 계산합니다.
 */
export function getSimpleSolarTermDay(year: number, month: number): number {
  const Y = year % 100;
  const D = 0.2422;
  const C = SOLAR_TERMS_C[month - 1];
  let leap = Math.floor((Y - 1) / 4);
  let day = Math.floor(Y * D + C) - leap;
  
  // 20세기(1900년대) 보정
  if (year < 2000) {
    if (month === 2 || month === 3) day += 1;
  }
  return day;
}

/**
 * 사용자가 입력한 날짜를 기준으로 실제 간지(Gap-Ja 등)를 뽑아내는 간단한 알고리즘
 */
export function calculateSimpleSaju(year: number, month: number, day: number, hour: number) {
  // 1. 년주 (Year Pillar) - 입춘 기준
  const ipchunDay = getSimpleSolarTermDay(year, 2);
  let sajuYear = year;
  if (month === 1 || (month === 2 && day < ipchunDay)) {
    sajuYear -= 1;
  }
  const yearStemIdx = (sajuYear - 4 + 60) % 10;
  const yearBranchIdx = (sajuYear - 4 + 60) % 12;

  // 2. 월주 (Month Pillar) - 매월 절기 기준
  const termDay = getSimpleSolarTermDay(year, month);
  let sajuMonth = month;
  if (day < termDay) {
    sajuMonth -= 1;
    if (sajuMonth === 0) sajuMonth = 12;
  }
  const monthBranchIdx = (sajuMonth + 12) % 12; // 1월:축(1), 2월:인(2)...
  const monthStemStart = ((yearStemIdx % 5) * 2 + 2) % 10;
  let monthOffset = sajuMonth - 2;
  if (monthOffset < 0) monthOffset += 12;
  const monthStemIdx = (monthStemStart + monthOffset) % 10;

  // 3. 일주 (Day Pillar) - 1900년 1월 1일(갑술일) 기준
  const baseDate = Date.UTC(1900, 0, 1);
  const targetDate = Date.UTC(year, month - 1, day);
  const diffDays = Math.floor((targetDate - baseDate) / (1000 * 60 * 60 * 24));
  const dayStemIdx = (diffDays + 0) % 10; // 갑(0)
  const dayBranchIdx = (diffDays + 10) % 12; // 술(10)

  // 4. 시주 (Hour Pillar)
  const hourBranchIdx = Math.floor((hour + 1) / 2) % 12;
  const hourStemStart = ((dayStemIdx % 5) * 2) % 10;
  const hourStemIdx = (hourStemStart + hourBranchIdx) % 10;

  return {
    year: { stem: STEMS[yearStemIdx], branch: BRANCHES[yearBranchIdx] },
    month: { stem: STEMS[monthStemIdx], branch: BRANCHES[monthBranchIdx] },
    day: { stem: STEMS[dayStemIdx], branch: BRANCHES[dayBranchIdx] },
    hour: { stem: STEMS[hourStemIdx], branch: BRANCHES[hourBranchIdx] },
  };
}

export function getGanZhiInfo(hanja: string) {
  if (hanja === '?') return { hanja: '?', kor: '모름', eng: 'Unknown' };
  const stem = STEMS.find(s => s.hanja === hanja);
  if (stem) return stem;
  const branch = BRANCHES.find(b => b.hanja === hanja);
  if (branch) return branch;
  return { hanja, kor: hanja, eng: hanja };
}
