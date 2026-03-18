import { Solar, Lunar } from 'lunar-javascript';

export const hanjaToHangul: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'
};

export const elementMap: Record<string, string> = {
  '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth', '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water',
  '子': 'water', '丑': 'earth', '寅': 'wood', '卯': 'wood', '辰': 'earth', '巳': 'fire', '午': 'fire', '未': 'earth', '申': 'metal', '酉': 'metal', '戌': 'earth', '亥': 'water'
};

export const yinYangMap: Record<string, string> = {
  '甲': '+', '丙': '+', '戊': '+', '庚': '+', '壬': '+', '子': '+', '寅': '+', '辰': '+', '午': '+', '申': '+', '戌': '+',
  '乙': '-', '丁': '-', '己': '-', '辛': '-', '癸': '-', '丑': '-', '卯': '-', '巳': '-', '未': '-', '酉': '-', '亥': '-'
};

export const hiddenStems: Record<string, string[]> = {
  '子': ['임', '계'], '丑': ['계', '신', '기'], '寅': ['무', '병', '갑'], '卯': ['갑', '을'],
  '辰': ['을', '계', '무'], '巳': ['무', '경', '병'], '午': ['병', '기', '정'], '未': ['정', '을', '기'],
  '申': ['무', '임', '경'], '酉': ['경', '신'], '戌': ['신', '정', '무'], '亥': ['무', '갑', '임']
};

export const calculateDeity = (dayStem: string, targetChar: string) => {
  if (dayStem === targetChar) return '비견';
  const meE = elementMap[dayStem];
  const meY = yinYangMap[dayStem];
  const targetE = elementMap[targetChar];
  const targetY = yinYangMap[targetChar];
  
  if (!meE || !targetE) return '';

  const sameYinYang = meY === targetY;

  if (meE === targetE) return sameYinYang ? '비견' : '겁재';
  
  // Me produces Target (Output)
  if (
    (meE === 'wood' && targetE === 'fire') ||
    (meE === 'fire' && targetE === 'earth') ||
    (meE === 'earth' && targetE === 'metal') ||
    (meE === 'metal' && targetE === 'water') ||
    (meE === 'water' && targetE === 'wood')
  ) return sameYinYang ? '식신' : '상관';

  // Me controls Target (Wealth)
  if (
    (meE === 'wood' && targetE === 'earth') ||
    (meE === 'fire' && targetE === 'metal') ||
    (meE === 'earth' && targetE === 'water') ||
    (meE === 'metal' && targetE === 'wood') ||
    (meE === 'water' && targetE === 'fire')
  ) return sameYinYang ? '편재' : '정재';

  // Target controls Me (Influence)
  if (
    (meE === 'wood' && targetE === 'metal') ||
    (meE === 'fire' && targetE === 'water') ||
    (meE === 'earth' && targetE === 'wood') ||
    (meE === 'metal' && targetE === 'fire') ||
    (meE === 'water' && targetE === 'earth')
  ) return sameYinYang ? '편관' : '정관';

  // Target produces Me (Resource)
  if (
    (meE === 'wood' && targetE === 'water') ||
    (meE === 'fire' && targetE === 'wood') ||
    (meE === 'earth' && targetE === 'fire') ||
    (meE === 'metal' && targetE === 'earth') ||
    (meE === 'water' && targetE === 'metal')
  ) return sameYinYang ? '편인' : '정인';

  return '';
};

export const calculateYongshin = (sajuData: any[]) => {
  // sajuData is [Year, Month, Day, Hour] in reverse order from getSajuData
  // Let's re-map to standard order for easier logic: [Year, Month, Day, Hour]
  const pillars = [...sajuData].reverse();
  const dayMaster = pillars[2].stem;
  const dayMasterElement = dayMaster.element;
  
  const elementNames: Record<string, string> = {
    wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)'
  };

  // 1. Eokbu Analysis (Strength)
  let score = 0;
  const weights = {
    yearStem: 10, yearBranch: 10,
    monthStem: 10, monthBranch: 35, // Month branch is most influential (Deuk-ryeong)
    dayBranch: 15, // Deuk-ji
    hourStem: 10, hourBranch: 10
  };

  const supportElements: Record<string, string[]> = {
    wood: ['wood', 'water'],
    fire: ['fire', 'wood'],
    earth: ['earth', 'fire'],
    metal: ['metal', 'earth'],
    water: ['water', 'metal']
  };

  const meSupport = supportElements[dayMasterElement];

  // Calculate score
  const checkSupport = (el: string) => meSupport.includes(el);

  if (checkSupport(pillars[0].stem.element)) score += weights.yearStem;
  if (checkSupport(pillars[0].branch.element)) score += weights.yearBranch;
  if (checkSupport(pillars[1].stem.element)) score += weights.monthStem;
  if (checkSupport(pillars[1].branch.element)) score += weights.monthBranch;
  if (checkSupport(pillars[2].branch.element)) score += weights.dayBranch;
  if (checkSupport(pillars[3].stem.element)) score += weights.hourStem;
  if (checkSupport(pillars[3].branch.element)) score += weights.hourBranch;

  let strength = '중립';
  if (score >= 80) strength = '극신강';
  else if (score >= 60) strength = '신강';
  else if (score >= 40) strength = '중립';
  else if (score >= 20) strength = '신약';
  else strength = '극신약';

  const opposites: Record<string, string> = {
    wood: 'metal', fire: 'water', earth: 'wood', metal: 'fire', water: 'earth'
  };
  const supports: Record<string, string> = {
    wood: 'water', fire: 'wood', earth: 'fire', metal: 'earth', water: 'metal'
  };

  const eokbuYongshinRaw = score >= 50 ? opposites[dayMasterElement] : supports[dayMasterElement];
  const eokbuYongshin = elementNames[eokbuYongshinRaw];

  // 2. Johoo Analysis (Season/Temperature)
  const monthBranch = pillars[1].branch.hanja;
  const hourBranch = pillars[3].branch.hanja;
  
  let johooStatus = '평온';
  let johooYongshinRaw = '';

  // Winter (Hae, Ja, Chuk)
  if (['亥', '子', '丑'].includes(monthBranch)) {
    johooStatus = '한랭(寒冷)';
    johooYongshinRaw = 'fire';
  }
  // Summer (Sa, Oh, Mi)
  else if (['巳', '午', '未'].includes(monthBranch)) {
    johooStatus = '조열(燥熱)';
    johooYongshinRaw = 'water';
  }
  // Spring/Autumn with extreme time
  else if (['寅', '卯', '辰'].includes(monthBranch) && ['巳', '午', '未'].includes(hourBranch)) {
    johooStatus = '온난(溫暖)';
  }
  else if (['申', '酉', '戌'].includes(monthBranch) && ['亥', '子', '丑'].includes(hourBranch)) {
    johooStatus = '숙살(肅殺)';
  }

  const johooYongshin = johooYongshinRaw ? elementNames[johooYongshinRaw] : '균형 잡힘';

  // 3. Final Synthesis
  let finalYongshinRaw = '';
  let logicBasis = '';

  // Priority 1: Johoo if extreme
  if (johooYongshinRaw) {
    finalYongshinRaw = johooYongshinRaw;
    logicBasis = `계절적 요인(${johooStatus})이 매우 강하여 조후 균형을 맞추는 것이 최우선입니다.`;
  } 
  // Priority 2: Eokbu
  else {
    finalYongshinRaw = eokbuYongshinRaw;
    logicBasis = `일간의 기운이 ${strength}하므로 억부 균형을 맞추는 기운이 필요합니다.`;
  }

  const advice: Record<string, any> = {
    wood: { color: '초록색', direction: '동쪽', numbers: '3, 8', action: '독서, 산책, 새로운 시작' },
    fire: { color: '빨간색', direction: '남쪽', numbers: '2, 7', action: '운동, 열정적인 활동, 예절' },
    earth: { color: '노란색', direction: '중앙', numbers: '5, 10', action: '명상, 신용 유지, 안정' },
    metal: { color: '흰색', direction: '서쪽', numbers: '4, 9', action: '정리정돈, 결단력, 운동' },
    water: { color: '검은색', direction: '북쪽', numbers: '1, 6', action: '지혜 습득, 휴식, 유연함' }
  };

  return {
    strength,
    score,
    johooStatus,
    eokbuYongshin,
    johooYongshin,
    yongshin: elementNames[finalYongshinRaw],
    logicBasis,
    advice: advice[finalYongshinRaw]
  };
};

export const getSajuData = (dateStr: string, timeStr: string, isLunar: boolean, isLeap: boolean, unknownTime: boolean = false) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = unknownTime ? [12, 0] : timeStr.split(':').map(Number);

  // Apply 30-minute offset for Korea (UTC+9 -> Solar Time approx UTC+8.5)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (!unknownTime) {
    date.setUTCMinutes(date.getUTCMinutes() - 30);
  }
  
  const adjY = date.getUTCFullYear();
  const adjM = date.getUTCMonth() + 1;
  const adjD = date.getUTCDate();
  const adjH = date.getUTCHours();
  const adjMin = date.getUTCMinutes();

  let lunar;
  if (!isLunar) {
    const solar = Solar.fromYmdHms(adjY, adjM, adjD, adjH, adjMin, 0);
    lunar = solar.getLunar();
  } else {
    lunar = Lunar.fromYmdHms(adjY, isLeap ? -adjM : adjM, adjD, adjH, adjMin, 0);
  }

  const eightChar = lunar.getEightChar();
  // setDayZero(2): Day changes at 23:00 (Ja-si), and 23:00-00:00 is Jo-ja-si of the NEXT day.
  // This is the standard for most Korean Saju practitioners.
  eightChar.setDayZero(2);
  
  const pillars = [
    { title: '년주', char: eightChar.getYear() },
    { title: '월주', char: eightChar.getMonth() },
    { title: '일주', char: eightChar.getDay() },
    { title: '시주', char: unknownTime ? '??' : eightChar.getTime() }
  ];

  const dayStem = pillars[2].char.charAt(0);

  return pillars.map((p, idx) => {
    if (p.char === '??') {
      return {
        title: p.title,
        stem: { hanja: '?', hangul: '?', element: '', deity: '' },
        branch: { hanja: '?', hangul: '?', element: '', deity: '', hidden: '' }
      };
    }
    const stem = p.char.charAt(0);
    const branch = p.char.charAt(1);
    return {
      title: p.title,
      stem: {
        hanja: stem,
        hangul: hanjaToHangul[stem],
        element: elementMap[stem],
        deity: idx === 2 ? '일간' : calculateDeity(dayStem, stem)
      },
      branch: {
        hanja: branch,
        hangul: hanjaToHangul[branch],
        element: elementMap[branch],
        deity: calculateDeity(dayStem, branch),
        hidden: (hiddenStems[branch] || []).join(', ')
      }
    };
  }).reverse();
};

export const branchDescription: Record<string, string> = {
  '子': '지혜와 유연함의 시기입니다. 내면의 성장을 도모하고 새로운 시작을 준비하는 환경입니다.',
  '丑': '인내와 결실의 시기입니다. 묵묵히 노력하여 결과를 만들어내고 기반을 다지는 환경입니다.',
  '寅': '도전과 성장의 시기입니다. 새로운 일을 시작하고 활발하게 움직이며 뻗어나가는 환경입니다.',
  '卯': '창의와 조화의 시기입니다. 자신의 재능을 펼치고 대인관계를 넓히며 성장하는 환경입니다.',
  '辰': '변화와 확장의 시기입니다. 큰 포부를 가지고 활동 범위를 넓히며 성취를 이루는 환경입니다.',
  '巳': '열정과 확산의 시기입니다. 에너지가 넘치고 사교적인 활동이 많아지며 빛을 발하는 환경입니다.',
  '午': '절정과 화려함의 시기입니다. 가장 활발한 활동을 보이며 결과가 명확히 드러나는 환경입니다.',
  '未': '안정과 성숙의 시기입니다. 지금까지의 성과를 정리하고 내실을 기하며 다음을 준비하는 환경입니다.',
  '申': '결실과 이동의 시기입니다. 실질적인 이득을 챙기고 변화를 통해 새로운 기회를 잡는 환경입니다.',
  '酉': '완성과 수확의 시기입니다. 자신의 가치를 인정받고 정교하게 다듬어 결실을 맺는 환경입니다.',
  '戌': '보존과 정리의 시기입니다. 경험을 축적하고 내면의 가치를 지키며 차분히 마무리하는 환경입니다.',
  '亥': '준비와 휴식의 시기입니다. 지식을 쌓고 정신적인 성숙을 이루며 다음 단계를 기약하는 환경입니다.'
};

export const getDaeunData = (dateStr: string, timeStr: string, isLunar: boolean, isLeap: boolean, gender: 'M' | 'F') => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Apply 30-minute offset for Korea
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  date.setUTCMinutes(date.getUTCMinutes() - 30);
  
  const adjY = date.getUTCFullYear();
  const adjM = date.getUTCMonth() + 1;
  const adjD = date.getUTCDate();
  const adjH = date.getUTCHours();
  const adjMin = date.getUTCMinutes();

  let solar: Solar;
  let lunar: Lunar;
  if (!isLunar) {
    solar = Solar.fromYmdHms(adjY, adjM, adjD, adjH, adjMin, 0);
    lunar = solar.getLunar();
  } else {
    lunar = Lunar.fromYmdHms(adjY, isLeap ? -adjM : adjM, adjD, adjH, adjMin, 0);
    solar = lunar.getSolar();
  }

  const eightChar = lunar.getEightChar();
  eightChar.setDayZero(2);
  const yearStem = eightChar.getYear().charAt(0);
  const isYangYear = yinYangMap[yearStem] === '+';
  
  // Determine direction
  // Male + Yang = Forward, Male + Yin = Backward
  // Female + Yang = Backward, Female + Yin = Forward
  const isForward = gender === 'M' ? isYangYear : !isYangYear;

  // Calculate Daeun-su (Major Fortune Number)
  // Find the nearest Jie (Sectional Term)
  const targetJie = isForward ? lunar.getNextJie() : lunar.getPrevJie();
  const targetSolar = targetJie.getSolar();
  
  // Calculate difference in seconds
  const birthTime = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()).getTime();
  const jieTime = new Date(targetSolar.getYear(), targetSolar.getMonth() - 1, targetSolar.getDay(), targetSolar.getHour(), targetSolar.getMinute(), targetSolar.getSecond()).getTime();
  const diffSeconds = Math.abs(jieTime - birthTime) / 1000;
  
  // Convert to days (precise)
  const diffDays = diffSeconds / (24 * 3600);
  
  // Daeun-su calculation: days / 3
  // Rounding: remainder 1 -> down, remainder 2 -> up
  const wholeDays = Math.floor(diffDays);
  const remainder = wholeDays % 3;
  let daeunSu = Math.floor(wholeDays / 3);
  if (remainder === 2) daeunSu += 1;
  if (daeunSu === 0) daeunSu = 1; // Minimum Daeun-su is 1

  // Generate 10 Daeun Pillars starting from Month Pillar
  const monthPillar = eightChar.getMonth();
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  
  let currentStemIdx = stems.indexOf(monthPillar.charAt(0));
  let currentBranchIdx = branches.indexOf(monthPillar.charAt(1));
  
  const daeuns = [];
  for (let i = 1; i <= 10; i++) {
    if (isForward) {
      currentStemIdx = (currentStemIdx + 1) % 10;
      currentBranchIdx = (currentBranchIdx + 1) % 12;
    } else {
      currentStemIdx = (currentStemIdx - 1 + 10) % 10;
      currentBranchIdx = (currentBranchIdx - 1 + 12) % 12;
    }
    
    const stem = stems[currentStemIdx];
    const branch = branches[currentBranchIdx];
    const startAge = daeunSu + (i - 1) * 10;
    
    daeuns.push({
      startAge: startAge,
      startYear: year + startAge, // Simplified start year
      stem: stem,
      branch: branch,
      description: branchDescription[branch] || ''
    });
  }

  return daeuns;
};
