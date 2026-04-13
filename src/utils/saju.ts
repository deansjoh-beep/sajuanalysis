import { Solar, Lunar } from 'lunar-javascript';
import { DateTime } from 'luxon';
import { getDeityLocalizedInterpretation, getCareerExpression } from '../constants/deityInterpretation';

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

const equationOfTime = (dateTime: DateTime) => {
  const n = dateTime.ordinal; // day of year
  const B = (2 * Math.PI * (n - 81)) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
};

const applyTrueSolarTime = (dateTime: DateTime, longitude?: number) => {
  if (longitude === undefined || longitude === null || Number.isNaN(longitude)) {
    return dateTime;
  }

  const offsetHours = dateTime.offset / 60; // country zone offset in hours
  const standardMeridian = offsetHours * 15;

  const longitudeCorrection = 4 * (longitude - standardMeridian); // minutes
  const eot = equationOfTime(dateTime);

  return dateTime.plus({ minutes: longitudeCorrection + eot });
};

// 지장간: [여기(余氣), 중기(中氣), 본기(本氣)] — 본기가 배열 마지막
export const hiddenStems: Record<string, string[]> = {
  '子': ['임', '계'],           // 壬10일, 癸20일
  '丑': ['계', '신', '기'],     // 癸9일, 辛3일, 己18일
  '寅': ['무', '병', '갑'],     // 戊7일, 丙7일, 甲16일
  '卯': ['갑', '을'],           // 甲10일, 乙20일
  '辰': ['을', '계', '무'],     // 乙9일, 癸3일, 戊18일
  '巳': ['무', '경', '병'],     // 戊7일, 庚7일, 丙16일
  '午': ['병', '기', '정'],     // 丙11일, 己9일, 丁10일
  '未': ['정', '을', '기'],     // 丁9일, 乙3일, 己18일
  '申': ['무', '임', '경'],     // 戊7일, 壬7일, 庚16일
  '酉': ['경', '신'],           // 庚10일, 辛20일
  '戌': ['신', '정', '무'],     // 辛9일, 丁3일, 戊18일
  '亥': ['무', '갑', '임'],     // 戊7일, 甲5일, 壬18일
};

const getSolarFromBirthInput = (
  dateTime: DateTime,
  isLunar: boolean,
  isLeap: boolean
) => {
  if (isLunar) {
    return Lunar.fromYmdHms(
      dateTime.year,
      isLeap ? -dateTime.month : dateTime.month,
      dateTime.day,
      dateTime.hour,
      dateTime.minute,
      dateTime.second
    ).getSolar();
  }

  return Solar.fromYmdHms(
    dateTime.year,
    dateTime.month,
    dateTime.day,
    dateTime.hour,
    dateTime.minute,
    dateTime.second
  );
};

export const calculateDeity = (dayStem: string, targetChar: string, isBranch: boolean = false) => {
  let targetStem = targetChar;
  if (isBranch && hiddenStems[targetChar]) {
    // Use the last element of hiddenStems as the main energy (Yong/Main Energy/본기)
    const mainHiddenStemHangul = hiddenStems[targetChar][hiddenStems[targetChar].length - 1];
    // Find the corresponding hanja for the hangul
    const entry = Object.entries(hanjaToHangul).find(([h, hangul]) => hangul === mainHiddenStemHangul);
    if (entry) {
      targetStem = entry[0];
    }
  }

  if (dayStem === targetStem) return '비견';
  const meE = elementMap[dayStem];
  const meY = yinYangMap[dayStem];
  const targetE = elementMap[targetStem];
  const targetY = yinYangMap[targetStem];
  
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
  const pillars = [...sajuData].reverse();
  const dayMaster = pillars[2].stem;
  const dayMasterElement = dayMaster.element;
  
  const elementNames: Record<string, string> = {
    wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)'
  };

  let score = 0;
  const weights = {
    yearStem: 10, yearBranch: 10,
    monthStem: 10, monthBranch: 35,
    dayBranch: 15,
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

  const monthBranch = pillars[1].branch.hanja;
  const hourBranch = pillars[3].branch.hanja;
  
  let johooStatus = '평온';
  let johooYongshinRaw = '';

  if (['亥', '子', '丑'].includes(monthBranch)) {
    johooStatus = '한랭(寒冷)';
    johooYongshinRaw = 'fire';
  } else if (['巳', '午', '未'].includes(monthBranch)) {
    johooStatus = '조열(燥熱)';
    johooYongshinRaw = 'water';
  }

  const johooYongshin = johooYongshinRaw ? elementNames[johooYongshinRaw] : '균형 잡힘';

  let finalYongshinRaw = '';
  let logicBasis = '';

  if (johooYongshinRaw) {
    finalYongshinRaw = johooYongshinRaw;
    logicBasis = `계절적 요인(${johooStatus})이 매우 강하여 조후 균형을 맞추는 것이 최우선입니다.`;
  } else {
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

export const getAdjustedTime = (year: number, month: number, day: number, hour: number, minute: number) => {
  let offsetMinutes = 0;
  const dateNum = year * 10000 + month * 100 + day;

  if ((dateNum >= 19120101 && dateNum <= 19540320) || dateNum >= 19610810) {
    offsetMinutes -= 30;
  }

  const isDST = (y: number, m: number, d: number) => {
    if (y >= 1948 && y <= 1951) return m >= 5 && m <= 9;
    if (y >= 1955 && y <= 1960) return m >= 5 && m <= 9;
    if (y >= 1987 && y <= 1988) return m >= 5 && m <= 10;
    return false;
  };

  if (isDST(year, month, day)) {
    offsetMinutes -= 60;
  }

  return offsetMinutes;
};

export const getSajuData = (
  dateStr: string,
  timeStr: string,
  isLunar: boolean,
  isLeap: boolean,
  unknownTime: boolean = false,
  timezone: string = 'Asia/Seoul',
  longitude?: number,
  latitude?: number
) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  let [hour, minute] = unknownTime ? [12, 0] : timeStr.split(':').map(Number);

  let localDateTime = DateTime.fromObject({ year, month, day, hour, minute }, { zone: timezone });

  if (unknownTime) {
    localDateTime = localDateTime.set({ hour: 12, minute: 0 });
  }

  const trueSolarDateTime = applyTrueSolarTime(localDateTime, longitude);
  const adjustedSolar = getSolarFromBirthInput(trueSolarDateTime, isLunar, isLeap);
  
  const lunar = adjustedSolar.getLunar();
  const eightChar = lunar.getEightChar();
  try {
    if (eightChar && typeof (eightChar as any).setDayZero === 'function') {
      (eightChar as any).setDayZero(2);
    }
  } catch (e) {
    console.warn('Failed to setDayZero in getSajuData:', e);
  }
  
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

    const stemDeity = idx === 2 ? '일간' : calculateDeity(dayStem, stem);
    const branchDeity = calculateDeity(dayStem, branch, true);

    return {
      title: p.title,
      stem: {
        hanja: stem,
        hangul: hanjaToHangul[stem],
        element: elementMap[stem],
        deity: stemDeity,
        western: getDeityLocalizedInterpretation(stemDeity, 'en'),
        korean: getDeityLocalizedInterpretation(stemDeity, 'ko'),
        careers: getCareerExpression(stemDeity)
      },
      branch: {
        hanja: branch,
        hangul: hanjaToHangul[branch],
        element: elementMap[branch],
        deity: branchDeity,
        western: getDeityLocalizedInterpretation(branchDeity, 'en'),
        korean: getDeityLocalizedInterpretation(branchDeity, 'ko'),
        careers: getCareerExpression(branchDeity),
        hidden: (hiddenStems[branch] || []).join(', ')
      }
    };
  }).reverse();
};

export const getDeityEnglishExplanation = (deity: string) => {
  if (!deity) return '';
  return getDeityLocalizedInterpretation(deity, 'en') || '';
};

export const getCareerFocus = (sajuData: any[], locale: string = 'ko') => {
  if (!sajuData || sajuData.length === 0) {
    return locale.startsWith('ko')
      ? '핵심 역량을 중심으로 한 전반적 직업 잠재력이 보입니다.'
      : 'General professional potential with emphasis on your core capabilities.';
  }

  const careerItems = new Set<string>();
  sajuData.forEach(p => {
    const stems = [p.stem?.deity, p.branch?.deity];
    stems.forEach(d => {
      if (d) {
        const desc = getCareerExpression(d, locale);
        if (desc) careerItems.add(desc);
      }
    });
  });

  if (careerItems.size === 0) {
    return locale.startsWith('ko')
      ? '핵심 역량을 중심으로 한 전반적 직업 잠재력이 보입니다.'
      : 'General professional potential with emphasis on your core capabilities.';
  }

  return Array.from(careerItems).join(' | ');
};

export const getGyeokInterpretation = (sajuData: any[], locale: string = 'ko') => {
  const isKorean = locale.startsWith('ko');
  const { gyeok } = calculateGyeok(sajuData);

  const key = gyeok.replace('격', '');
  const koMap: Record<string, { summary: string; caution: string; usage: string }> = {
    '비견': {
      summary: '자기주도성과 독립성이 강한 격으로, 스스로 기준을 세울 때 성과가 큽니다.',
      caution: '고집이 강해져 협업 리듬이 깨지지 않도록 의견 조율이 필요합니다.',
      usage: '주도권을 갖는 역할, 독립 프로젝트, 책임이 분명한 업무에서 강점을 살리세요.'
    },
    '겁재': {
      summary: '경쟁과 협업이 동시에 작동하는 격으로, 관계망 속 기회 포착력이 좋습니다.',
      caution: '과한 경쟁심이나 자원 분산으로 체력과 재정이 새지 않게 관리해야 합니다.',
      usage: '팀 기반 영업, 파트너십, 네트워크 비즈니스에서 선택과 집중 전략을 쓰세요.'
    },
    '식신': {
      summary: '꾸준한 생산성과 실행력이 강점인 격으로, 성실한 누적이 큰 결과로 이어집니다.',
      caution: '안정 지향이 과해 변화 타이밍을 놓치지 않도록 주기적 점검이 필요합니다.',
      usage: '장기 프로젝트, 전문직 실무, 콘텐츠 축적형 업무에서 꾸준함을 무기로 삼으세요.'
    },
    '상관': {
      summary: '아이디어와 표현력, 문제해결력이 두드러지는 격으로 창의적 전개에 강합니다.',
      caution: '직설적 표현이 갈등으로 번지지 않도록 메시지 톤과 타이밍을 조절하세요.',
      usage: '기획, 마케팅, 브랜딩, 문제 해결형 업무에서 창의성을 구조화해 성과로 연결하세요.'
    },
    '편재': {
      summary: '기회 포착과 유연한 수익화 감각이 뛰어난 격으로, 실전 감각이 좋습니다.',
      caution: '단기 기회 추종이 과해지면 리스크가 커지므로 분산과 손절 기준이 필요합니다.',
      usage: '신사업, 거래, 투자, 영업 영역에서 빠른 판단과 포트폴리오 전략을 활용하세요.'
    },
    '정재': {
      summary: '안정적 재정 운영과 현실 감각이 강한 격으로, 관리 능력이 우수합니다.',
      caution: '안전성만 추구하면 성장 기회를 놓칠 수 있으니 적정 위험을 허용하세요.',
      usage: '재무, 운영, 관리 직무에서 계획적 축적과 루틴 최적화로 강점을 극대화하세요.'
    },
    '편관': {
      summary: '압박 상황에서 대응력이 좋은 격으로, 위기에서 통제력과 결단력이 빛납니다.',
      caution: '긴장도가 높아지면 대인 마찰이 생길 수 있으니 유연한 소통을 의식하세요.',
      usage: '리더십, 운영 총괄, 위기 대응 역할에서 규율과 민첩성을 함께 활용하세요.'
    },
    '정관': {
      summary: '규범과 신뢰를 기반으로 성장하는 격으로, 조직 내 평판 자산이 큽니다.',
      caution: '원칙 중심이 과하면 변화 대응이 늦어질 수 있어 유연성을 확보해야 합니다.',
      usage: '공공/대기업/전문직처럼 신뢰와 절차가 중요한 환경에서 장점을 살리세요.'
    },
    '편인': {
      summary: '직관과 통찰, 기획력이 강한 격으로 깊이 있는 분석 역량이 돋보입니다.',
      caution: '생각이 과해 실행 속도가 떨어지지 않게 의사결정 마감선을 두세요.',
      usage: '전략기획, 연구, 컨설팅, 콘텐츠 설계 등 고차원 분석 업무에 집중하세요.'
    },
    '정인': {
      summary: '학습력과 안정적 전문성 구축에 강한 격으로 지식 기반 경쟁력이 좋습니다.',
      caution: '준비가 길어져 실행이 늦어지지 않도록 학습-실행 사이클을 짧게 운영하세요.',
      usage: '자격/학위/전문기술 축적형 커리어에서 체계적 성장 전략을 가져가세요.'
    }
  };

  const enMap: Record<string, { summary: string; caution: string; usage: string }> = {
    '비견': {
      summary: 'This pattern emphasizes self-direction and independence with strong ownership.',
      caution: 'Avoid becoming overly rigid in collaboration and decision-making.',
      usage: 'Use your strength in owner-type roles and independently driven projects.'
    },
    '겁재': {
      summary: 'Competition and collaboration coexist, with strong network-driven opportunities.',
      caution: 'Prevent resource leakage from over-competition or scattered focus.',
      usage: 'Apply selective focus in team sales, partnerships, and relationship-based business.'
    },
    '식신': {
      summary: 'Steady productivity and execution are your core assets.',
      caution: 'Do not miss turning points by staying only in safe routines.',
      usage: 'Leverage consistency in long-term projects and skill-compounding work.'
    },
    '상관': {
      summary: 'Idea power, expression, and problem-solving stand out strongly.',
      caution: 'Manage tone and timing so direct communication does not create friction.',
      usage: 'Use structured creativity in planning, marketing, and brand/problem-solving roles.'
    },
    '편재': {
      summary: 'Opportunity sensing and flexible monetization ability are strong.',
      caution: 'Control downside risk with clear diversification and stop-loss rules.',
      usage: 'Use fast judgement in business development, sales, and portfolio strategies.'
    },
    '정재': {
      summary: 'Stable financial discipline and operational realism are notable strengths.',
      caution: 'Do not over-prioritize safety at the cost of growth opportunities.',
      usage: 'Maximize strengths in finance, operations, and structured management roles.'
    },
    '편관': {
      summary: 'You are strong under pressure, with decisive control in complex situations.',
      caution: 'High tension can create interpersonal friction without flexible communication.',
      usage: 'Perform best in leadership, operations, and crisis-response positions.'
    },
    '정관': {
      summary: 'Growth comes through trust, standards, and institutional credibility.',
      caution: 'Balance principles with adaptability to avoid slow responses to change.',
      usage: 'Excel in environments where reputation, process, and reliability matter.'
    },
    '편인': {
      summary: 'Insight, intuition, and strategic thinking are dominant strengths.',
      caution: 'Set decision deadlines to avoid overthinking and delayed execution.',
      usage: 'Focus on strategy, research, consulting, and high-level analytical work.'
    },
    '정인': {
      summary: 'Learning capacity and stable expertise-building are major assets.',
      caution: 'Avoid prolonged preparation without practical execution.',
      usage: 'Use structured learning paths in certification and expert-track careers.'
    }
  };

  if (gyeok === '특수격' || gyeok === '분석 불가') {
    if (isKorean) {
      return `## ${gyeok}\n### ${gyeok}에 대한 요약 결론\n격국 성향이 복합적으로 나타나므로 핵심 십성과 대운 흐름을 함께 보는 종합 해석이 필요합니다.\n### 주의점\n단일 키워드로 단정하지 말고 시기별 흐름과 현실 상황을 함께 점검하세요.\n### 활용법\n주요 의사결정 전에는 사주 원국, 대운, 현재 환경을 함께 비교해 전략을 세우세요.`;
    }
    return `## ${gyeok}\n### Summary Conclusion\nThe chart shows a mixed structure and should be interpreted with major deity and luck-cycle context together.\n### Caution\nAvoid single-keyword conclusions without timing and real-world context.\n### How to Use\nBefore major decisions, compare natal chart patterns with current luck flow and environment.`;
  }

  const map = isKorean ? koMap : enMap;
  const item = map[key];

  if (!item) {
    if (isKorean) {
      return `## ${gyeok}\n### ${gyeok}에 대한 요약 결론\n${gyeok}의 성향이 나타나며 강점 활용 시 성과가 커집니다.\n### 주의점\n강점이 과해지면 균형이 무너질 수 있어 조절이 필요합니다.\n### 활용법\n핵심 강점을 중심으로 역할과 실행 방식을 설계하세요.`;
    }
    return `## ${gyeok}\n### Summary Conclusion\nTraits of ${gyeok} are present and can produce strong outcomes when leveraged well.\n### Caution\nBalance overactive tendencies so strengths do not become weaknesses.\n### How to Use\nDesign your role and execution style around your strongest pattern.`;
  }

  if (isKorean) {
    return `## ${gyeok}\n### ${gyeok}에 대한 요약 결론\n${item.summary}\n### 주의점\n${item.caution}\n### 활용법\n${item.usage}`;
  }

  return `## ${gyeok}\n### Summary Conclusion\n${item.summary}\n### Caution\n${item.caution}\n### How to Use\n${item.usage}`;
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

export const getDaeunData = (
  dateStr: string,
  timeStr: string,
  isLunar: boolean,
  isLeap: boolean,
  gender: 'M' | 'F',
  unknownTime: boolean = false,
  timezone: string = 'Asia/Seoul',
  longitude?: number,
  latitude?: number
) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [rawHour, rawMinute] = timeStr.split(':').map(Number);
  const hour = unknownTime ? 12 : rawHour;
  const minute = unknownTime ? 0 : rawMinute;

  let localDateTime = DateTime.fromObject({ year, month, day, hour, minute }, { zone: timezone });
  const trueSolarDateTime = applyTrueSolarTime(localDateTime, longitude);
  const adjustedSolar = getSolarFromBirthInput(trueSolarDateTime, isLunar, isLeap);
  
  const lunar = adjustedSolar.getLunar();
  const eightChar = lunar.getEightChar();
  try {
    if (eightChar && typeof (eightChar as any).setDayZero === 'function') {
      (eightChar as any).setDayZero(2);
    }
  } catch (e) {
    console.warn('Failed to setDayZero in getDaeunData:', e);
  }
  const yearStem = eightChar.getYear().charAt(0);
  const isYangYear = yinYangMap[yearStem] === '+';
  
  const isForward = gender === 'M' ? isYangYear : !isYangYear;

  const targetJie = isForward ? lunar.getNextJie() : lunar.getPrevJie();
  const targetSolar = targetJie.getSolar();
  
  const birthTime = Date.UTC(adjustedSolar.getYear(), adjustedSolar.getMonth() - 1, adjustedSolar.getDay(), adjustedSolar.getHour(), adjustedSolar.getMinute(), adjustedSolar.getSecond());
  const jieTime = Date.UTC(targetSolar.getYear(), targetSolar.getMonth() - 1, targetSolar.getDay(), targetSolar.getHour(), targetSolar.getMinute(), targetSolar.getSecond());
  const diffSeconds = Math.abs(jieTime - birthTime) / 1000;
  
  const diffDays = diffSeconds / (24 * 3600);
  
  let daeunSu = Math.round(diffDays / 3);
  if (daeunSu === 0) daeunSu = 1;

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
      startYear: adjustedSolar.getYear() + startAge - 1,
      stem: stem,
      branch: branch,
      description: branchDescription[branch] || ''
    });
  }

  return daeuns;
};

export const calculateGyeok = (sajuData: any[]) => {
  if (!sajuData || sajuData.length < 4) return { gyeok: '분석 불가', composition: '' };
  
  const pillars = [...sajuData].reverse(); // [Year, Month, Day, Hour]
  const dayMaster = pillars[2].stem.hanja;
  const monthBranch = pillars[1].branch.hanja;
  
  // Get hidden stems of Month Branch
  const hidden = hiddenStems[monthBranch] || [];
  const hiddenHanjas = hidden.map(h => Object.keys(hanjaToHangul).find(key => hanjaToHangul[key] === h) || '');
  
  // Heavenly Stems (excluding Day Master)
  const heavenlyStems = [pillars[0].stem.hanja, pillars[1].stem.hanja, pillars[3].stem.hanja];
  
  let gyeokStem = '';
  
  // 1. Check if any hidden stem appears in Heavenly Stems
  // Priority: Main (Bon-gi) > Middle (Jung-gi) > Initial (Yeo-gi)
  // hiddenStems array is [Initial, (Middle), Main]
  for (let i = hiddenHanjas.length - 1; i >= 0; i--) {
    if (heavenlyStems.includes(hiddenHanjas[i])) {
      gyeokStem = hiddenHanjas[i];
      break;
    }
  }
  
  // 2. If none appear, use Main energy (Bon-gi)
  if (!gyeokStem && hiddenHanjas.length > 0) {
    gyeokStem = hiddenHanjas[hiddenHanjas.length - 1];
  }
  
  const deity = calculateDeity(dayMaster, gyeokStem);
  const gyeokName = deity ? `${deity}격` : '특수격';
  
  // Calculate composition
  const allDeities: string[] = [];
  pillars.forEach((p, i) => {
    if (p.stem.deity && p.stem.deity !== '일간') allDeities.push(p.stem.deity);
    if (p.branch.deity) allDeities.push(p.branch.deity);
  });
  
  const counts: Record<string, number> = {};
  allDeities.forEach(d => {
    counts[d] = (counts[d] || 0) + 1;
  });
  
  const composition = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} ${count}개`)
    .join(', ');
    
  return { gyeok: gyeokName, composition };
};

/** 십이운성(十二運星) 조견표: 일간 한자 + 지지 한자 → 운성 이름 */
export const getSipseung = (dayMaster: string, branch: string): string => {
  const table: Record<string, Record<string, string>> = {
    '甲': { '子': '목욕', '丑': '관대', '寅': '건록', '卯': '제왕', '辰': '쇠', '巳': '병', '午': '사', '未': '묘', '申': '절', '酉': '태', '戌': '양', '亥': '장생' },
    '乙': { '子': '병', '丑': '쇠', '寅': '제왕', '卯': '건록', '辰': '관대', '巳': '목욕', '午': '장생', '未': '양', '申': '태', '酉': '절', '戌': '묘', '亥': '사' },
    '丙': { '子': '태', '丑': '양', '寅': '장생', '卯': '목욕', '辰': '관대', '巳': '건록', '午': '제왕', '未': '쇠', '申': '병', '酉': '사', '戌': '묘', '亥': '절' },
    '戊': { '子': '태', '丑': '양', '寅': '장생', '卯': '목욕', '辰': '관대', '巳': '건록', '午': '제왕', '未': '쇠', '申': '병', '酉': '사', '戌': '묘', '亥': '절' },
    '丁': { '子': '절', '丑': '묘', '寅': '사', '卯': '병', '辰': '쇠', '巳': '제왕', '午': '건록', '未': '관대', '申': '목욕', '酉': '장생', '戌': '양', '亥': '태' },
    '己': { '子': '절', '丑': '묘', '寅': '사', '卯': '병', '辰': '쇠', '巳': '제왕', '午': '건록', '未': '관대', '申': '목욕', '酉': '장생', '戌': '양', '亥': '태' },
    '庚': { '子': '사', '丑': '묘', '寅': '절', '卯': '태', '辰': '양', '巳': '장생', '午': '목욕', '未': '관대', '申': '건록', '酉': '제왕', '戌': '쇠', '亥': '병' },
    '辛': { '子': '장생', '丑': '양', '寅': '태', '卯': '절', '辰': '묘', '巳': '사', '午': '병', '未': '쇠', '申': '제왕', '酉': '건록', '戌': '관대', '亥': '목욕' },
    '壬': { '子': '제왕', '丑': '쇠', '寅': '병', '卯': '사', '辰': '묘', '巳': '절', '午': '태', '未': '양', '申': '장생', '酉': '목욕', '戌': '관대', '亥': '건록' },
    '癸': { '子': '건록', '丑': '관대', '寅': '목욕', '卯': '장생', '辰': '양', '巳': '태', '午': '절', '未': '묘', '申': '사', '酉': '병', '戌': '쇠', '亥': '제왕' },
  };
  return table[dayMaster]?.[branch] ?? '';
};

// ===== 공망(空亡) =====

/** 년주 천간·지지를 받아 공망에 해당하는 지지 2개를 반환합니다. */
export const getGongmang = (yearStem: string, yearBranch: string): string[] => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const stemIdx = stems.indexOf(yearStem);
  const branchIdx = branches.indexOf(yearBranch);
  if (stemIdx < 0 || branchIdx < 0) return [];
  const startBranchIdx = (branchIdx - stemIdx + 60) % 12;
  return [branches[(startBranchIdx + 10) % 12], branches[(startBranchIdx + 11) % 12]];
};

/** 원국(sajuData) 기준 공망 요약 문자열을 반환합니다. */
export const getGongmangSummary = (yearStem: string, yearBranch: string, sajuData: any[]): string => {
  const gm = getGongmang(yearStem, yearBranch);
  if (!gm.length) return '';
  const gmHangul = gm.map((b) => hanjaToHangul[b] || b).join('·');
  const matching = sajuData
    .filter((p) => p.branch?.hanja && gm.includes(p.branch.hanja))
    .map((p) => p.title);
  return matching.length
    ? `${gmHangul} — ${matching.join('·')} 해당`
    : `${gmHangul} — 원국 해당 없음`;
};

// ===== 합(合) · 충(沖) =====

const _STEM_HAP: [string, string, string][] = [
  ['甲', '己', '토합화'], ['乙', '庚', '금합화'], ['丙', '辛', '수합화'],
  ['丁', '壬', '목합화'], ['戊', '癸', '화합화'],
];
const _BRANCH_YUKHAP: [string, string, string][] = [
  ['子', '丑', '토합'], ['寅', '亥', '목합'], ['卯', '戌', '화합'],
  ['辰', '酉', '금합'], ['巳', '申', '수합'], ['午', '未', '화합'],
];
const _BRANCH_SAMHAP: [string[], string][] = [
  [['申', '子', '辰'], '수삼합'], [['巳', '酉', '丑'], '금삼합'],
  [['寅', '午', '戌'], '화삼합'], [['亥', '卯', '未'], '목삼합'],
];
const _BRANCH_CHUNG: [string, string][] = [
  ['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
];
const _STEM_CHUNG: [string, string][] = [
  ['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸'],
];

/** 원국 내 합·충 관계를 분석하여 요약 문자열을 반환합니다. */
export const getHapChungSummary = (sajuData: any[]): string => {
  if (!sajuData || sajuData.length < 2) return '';
  const valid = sajuData
    .filter((p) => p.stem?.hanja && p.stem.hanja !== '?' && p.branch?.hanja && p.branch.hanja !== '?')
    .map((p) => ({ title: p.title as string, stem: p.stem.hanja as string, branch: p.branch.hanja as string }));

  const hapList: string[] = [];
  const chungList: string[] = [];

  // 천간합
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (const [s1, s2, result] of _STEM_HAP) {
        if ((valid[i].stem === s1 && valid[j].stem === s2) || (valid[i].stem === s2 && valid[j].stem === s1)) {
          hapList.push(`${valid[i].title}간·${valid[j].title}간 ${result}`);
        }
      }
    }
  }
  // 지지육합
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (const [b1, b2, result] of _BRANCH_YUKHAP) {
        if ((valid[i].branch === b1 && valid[j].branch === b2) || (valid[i].branch === b2 && valid[j].branch === b1)) {
          hapList.push(`${valid[i].title}지·${valid[j].title}지 ${result}`);
        }
      }
    }
  }
  // 지지삼합 (2개 이상 충족)
  const allBranches = valid.map((p) => p.branch);
  for (const [combo, result] of _BRANCH_SAMHAP) {
    const matched = combo.filter((b) => allBranches.includes(b));
    if (matched.length >= 2) {
      const matchTitles = matched.map((b) => valid[allBranches.indexOf(b)].title);
      hapList.push(`${matchTitles.join('·')} ${result}`);
    }
  }
  // 천간충
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (const [s1, s2] of _STEM_CHUNG) {
        if ((valid[i].stem === s1 && valid[j].stem === s2) || (valid[i].stem === s2 && valid[j].stem === s1)) {
          chungList.push(`${valid[i].title}간·${valid[j].title}간 천간충`);
        }
      }
    }
  }
  // 지지충
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (const [b1, b2] of _BRANCH_CHUNG) {
        if ((valid[i].branch === b1 && valid[j].branch === b2) || (valid[i].branch === b2 && valid[j].branch === b1)) {
          chungList.push(`${valid[i].title}지·${valid[j].title}지 지지충`);
        }
      }
    }
  }

  const parts: string[] = [];
  if (hapList.length) parts.push(`합: ${hapList.join(', ')}`);
  if (chungList.length) parts.push(`충: ${chungList.join(', ')}`);
  return parts.join(' | ');
};

// ===== 십이신살(十二神殺) =====

const _SHINSAL_TABLE: Record<string, string[]> = {
  // 인오술(寅午戌) 화국
  '寅': ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
  '午': ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
  '戌': ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
  // 해묘미(亥卯未) 목국
  '亥': ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'],
  '卯': ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'],
  '未': ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'],
  // 사유축(巳酉丑) 금국
  '巳': ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
  '酉': ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
  '丑': ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
  // 신자진(申子辰) 수국
  '申': ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
  '子': ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
  '辰': ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
};
const _SHINSAL_NAMES = ['겁살', '재살', '천살', '지살', '도화', '월살', '망신살', '장성살', '반안살', '역마살', '육해살', '화개살'];

/** 연지 기준 특정 지지의 12신살 이름을 반환합니다. */
export const getShinsal = (yearBranch: string, targetBranch: string): string => {
  const row = _SHINSAL_TABLE[yearBranch];
  if (!row) return '';
  const idx = row.indexOf(targetBranch);
  return idx >= 0 ? _SHINSAL_NAMES[idx] : '';
};

/** 원국 각 주의 신살을 요약하여 반환합니다. */
export const getShinsalSummary = (sajuData: any[]): string => {
  if (!sajuData || sajuData.length < 4) return '';
  const yearBranch = sajuData[3]?.branch?.hanja;
  if (!yearBranch || yearBranch === '?') return '';
  const row = _SHINSAL_TABLE[yearBranch];
  if (!row) return '';

  return sajuData
    .filter((p) => p.branch?.hanja && p.branch.hanja !== '?')
    .map((p) => {
      const idx = row.indexOf(p.branch.hanja);
      const name = idx >= 0 ? _SHINSAL_NAMES[idx] : '';
      return name ? `${p.title}(${name})` : '';
    })
    .filter(Boolean)
    .join(', ');
};

// ===== 원국 십이운성 요약 =====

/** 일간 기준 원국 각 주의 십이운성을 요약하여 반환합니다. */
export const getOriginalSipseungSummary = (dayMaster: string, sajuData: any[]): string => {
  if (!dayMaster || !sajuData || sajuData.length < 2) return '';
  return sajuData
    .filter((p) => p.branch?.hanja && p.branch.hanja !== '?')
    .map((p) => {
      const us = getSipseung(dayMaster, p.branch.hanja);
      return us ? `${p.title}(${us})` : '';
    })
    .filter(Boolean)
    .join(', ');
};

// ===== 기타 신살 함수 =====

/** 양인살(羊刃殺): 일간 기준, 양인에 해당하는 지지 반환 */
export const getYangin = (dayMaster: string): string => {
  const table: Record<string, string> = {
    '甲': '卯', '乙': '辰', '丙': '午', '丁': '未',
    '戊': '午', '己': '未', '庚': '酉', '辛': '戌',
    '壬': '子', '癸': '丑',
  };
  return table[dayMaster] ?? '';
};

/** 천을귀인(天乙貴人): 일간 기준, 천을귀인에 해당하는 지지 배열 반환 */
export const getCheoneulGuiin = (dayStem: string): string[] => {
  const table: Record<string, string[]> = {
    '甲': ['丑', '未'], '乙': ['子', '申'], '丙': ['亥', '酉'], '丁': ['亥', '酉'],
    '戊': ['丑', '未'], '己': ['子', '申'], '庚': ['午', '寅'], '辛': ['午', '寅'],
    '壬': ['卯', '巳'], '癸': ['卯', '巳'],
  };
  return table[dayStem] ?? [];
};

/** 원진살(怨嗔殺): 두 지지가 원진 관계인지 확인 */
export const isWonjin = (branch1: string, branch2: string): boolean => {
  const pairs = new Set([
    '子-未', '未-子', '丑-午', '午-丑', '寅-酉', '酉-寅',
    '卯-申', '申-卯', '辰-亥', '亥-辰', '巳-戌', '戌-巳',
  ]);
  return pairs.has(`${branch1}-${branch2}`);
};

/** 괴강살(魁罡殺): 일주 천간+지지 조합 확인 */
export const isGoegang = (stem: string, branch: string): boolean => {
  return ['庚辰', '庚戌', '壬辰', '戊戌'].includes(`${stem}${branch}`);
};

/** 지지간 형(刑) 관계 확인 */
export const isHyeong = (branch1: string, branch2: string): boolean => {
  const set = new Set([
    '寅-巳', '巳-申', '申-寅', '丑-戌', '戌-未', '未-丑',
    '子-卯', '卯-子', '辰-辰', '午-午', '酉-酉', '亥-亥',
  ]);
  return set.has(`${branch1}-${branch2}`);
};

/** 지지간 파(破) 관계 확인 */
export const isPa = (branch1: string, branch2: string): boolean => {
  const map: Record<string, string> = {
    '子': '酉', '丑': '辰', '寅': '亥', '卯': '午', '申': '巳', '酉': '子',
    '辰': '丑', '亥': '寅', '午': '卯', '巳': '申', '未': '戌', '戌': '未',
  };
  return map[branch1] === branch2;
};

/** 지지간 해(害/穿) 관계 확인 */
export const isHae = (branch1: string, branch2: string): boolean => {
  const map: Record<string, string> = {
    '子': '未', '丑': '午', '寅': '巳', '卯': '辰', '申': '亥', '酉': '戌',
    '午': '丑', '未': '子', '巳': '寅', '辰': '卯', '亥': '申', '戌': '酉',
  };
  return map[branch1] === branch2;
};

/** 지지간 충(沖) 관계 확인 */
export const isChung = (branch1: string, branch2: string): boolean => {
  const map: Record<string, string> = {
    '子': '午', '丑': '未', '寅': '申', '卯': '酉', '辰': '戌', '巳': '亥',
    '午': '子', '未': '丑', '申': '寅', '酉': '卯', '戌': '辰', '亥': '巳',
  };
  return map[branch1] === branch2;
};

/** 지지간 육합(六合) 확인 및 결과 반환 */
export const getYukhap = (branch1: string, branch2: string): string | null => {
  for (const [b1, b2, result] of _BRANCH_YUKHAP) {
    if ((branch1 === b1 && branch2 === b2) || (branch1 === b2 && branch2 === b1)) return result;
  }
  return null;
};

/** 문창귀인(文昌貴人): 일간 기준 */
export const getMunchang = (dayStem: string): string => {
  const table: Record<string, string> = {
    '甲': '巳', '乙': '午', '丙': '申', '丁': '酉',
    '戊': '申', '己': '酉', '庚': '亥', '辛': '子',
    '壬': '寅', '癸': '卯',
  };
  return table[dayStem] ?? '';
};

/** 학당귀인(學堂貴人): 일간 기준 */
export const getHakdang = (dayStem: string): string => {
  const table: Record<string, string> = {
    '甲': '亥', '乙': '午', '丙': '寅', '丁': '酉',
    '戊': '寅', '己': '酉', '庚': '巳', '辛': '子',
    '壬': '申', '癸': '卯',
  };
  return table[dayStem] ?? '';
};
