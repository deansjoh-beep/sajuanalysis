export const DEITY_WESTERN_COMMON = {
  '비견': 'Self-reliance / Personal leadership',
  '겁재': 'Competitive edge / Resourceful drive',
  '식신': 'Creative expression / Talent showcase',
  '상관': 'Idea flow / Intelligent networking',
  '편재': 'Opportunity-based wealth / Flexible income streams',
  '정재': 'Steady wealth / Financial discipline',
  '편관': 'Adaptive authority / Dynamically changing career authority',
  '정관': 'Professional recognition / Workplace leadership and reputation',
  '편인': 'Intuitive support / Mentorship and insight',
  '정인': 'Technical mastery / Stable knowledge foundation',
  '일간': 'Core self / Innate personality and motivations'
};

export const DEITY_KOREAN_COMMON = {
  '비견': '자기 주도적 리더십 및 독립심',
  '겁재': '경쟁적 자원 활용과 동료 간 협업',
  '식신': '창의적 표현과 재능 발현',
  '상관': '아이디어 흐름과 지적 네트워킹',
  '편재': '기회 기반 수입과 유연한 재정',
  '정재': '안정형 재정과 재물 관리',
  '편관': '적응형 권위와 변화하는 직장 권력',
  '정관': '직업적 인정, 리더십, 명성',
  '편인': '직관적 지원, 멘토링, 통찰력',
  '정인': '기술적 전문성과 지식 기반',
  '일간': '핵심 자아 및 타고난 성향'
};

export const getDeityWesternInterpretation = (koreanTerm: string) => {
  return DEITY_WESTERN_COMMON[koreanTerm] || '';
};

export const getDeityKoreanInterpretation = (koreanTerm: string) => {
  return DEITY_KOREAN_COMMON[koreanTerm] || '';
};

export const getDeityLocalizedInterpretation = (koreanTerm: string, locale = 'en') => {
  return locale.startsWith('ko')
    ? getDeityKoreanInterpretation(koreanTerm)
    : getDeityWesternInterpretation(koreanTerm);
};

export const getCareerExpression = (koreanTerm: string, locale: string = 'ko') => {
  const isKorean = locale.startsWith('ko');

  if (koreanTerm === '정관' || koreanTerm === '편관') {
    return isKorean
      ? '직업적 인정과 조직 내 권위, 리더십 가시성이 강조됩니다.'
      : 'Professional recognition / authority in the workplace / leadership visibility';
  }
  if (koreanTerm === '편재' || koreanTerm === '정재') {
    return isKorean
      ? '재정 안정성과 커리어 기반의 수익 기회가 강화됩니다.'
      : 'Financial stability and opportunity for career-based gain';
  }
  if (koreanTerm === '식신' || koreanTerm === '상관') {
    return isKorean
      ? '직무 수행에서 창의성과 혁신 잠재력이 돋보입니다.'
      : 'Career creativity and innovation potential in role execution';
  }
  return '';
};

export const getDeityCareerSummary = (koreanTerm: string, locale: string = 'ko') => {
  const career = getCareerExpression(koreanTerm, locale);
  if (!career) {
    return locale.startsWith('ko')
      ? '고유 강점을 활용할 수 있는 폭넓은 커리어 잠재력이 있습니다.'
      : 'Broad career potential with unique strengths to leverage.';
  }
  return career;
};
