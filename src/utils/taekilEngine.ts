import { DateTime } from 'luxon';
import { Lunar, Solar } from 'lunar-javascript';
import { calculateDeity, calculateYongshin, elementMap, getSajuData } from './saju';

export type TaekilCategory =
  | '결혼'
  | '이사'
  | '개업'
  | '출산'
  | '계약'
  | '수술'
  | '시험'
  | '여행'
  | '이장'
  | '만남';

export interface TaekilRequest {
  name: string;
  gender: 'M' | 'F';
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  isLunar: boolean;
  isLeap?: boolean;
  unknownTime?: boolean;
  category: TaekilCategory;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  // 결혼 카테고리용 배우자 정보
  spouseName?: string;
  spouseGender?: 'M' | 'F';
  spouseBirthDate?: string; // YYYY-MM-DD
  spouseBirthTime?: string; // HH:mm
  spouseIsLunar?: boolean;
  spouseIsLeap?: boolean;
  spouseUnknownTime?: boolean;
  preferredWeekdays?: number[]; // 0:Sun ... 6:Sat, 3순위
  avoidDates?: string[]; // YYYY-MM-DD up to 5
  // 이사 카테고리 전용 입력
  moveCurrentAddress?: string;
  moveTargetAddress?: string;
  moveFamilyBirthDates?: string[]; // YYYY-MM-DD
  movePriority?: 'folklore' | 'saju' | 'balanced';
  moveOnlyWeekend?: boolean;
  // 기타 카테고리 입력
  categoryInputs?: Record<string, string>;
  additionalInfo?: string;
}

interface DayEvaluation {
  date: string;
  score: number;
  reasons: string[];
  topTimeSlots: TimeSlotRecommendation[];
  factors: ScoreFactor[];
}

interface ScoreFactor {
  label: string;
  weight: number;
  type: 'plus' | 'minus' | 'info';
}

interface TimeSlotRecommendation {
  time: string;
  score: number;
  reason: string;
}

export interface TaekilResultItem {
  date: string;
  rating: number; // 1-5
  reasons: string[];
  topTimeSlots: TimeSlotRecommendation[];
  factors: ScoreFactor[];
}

const TZ = 'Asia/Seoul';

const CHUNG_MAP: Record<string, string> = {
  子: '午', 丑: '未', 寅: '申', 卯: '酉', 辰: '戌', 巳: '亥',
  午: '子', 未: '丑', 申: '寅', 酉: '卯', 戌: '辰', 亥: '巳'
};

const HAE_MAP: Record<string, string> = {
  子: '未', 丑: '午', 寅: '巳', 卯: '辰', 申: '亥', 酉: '戌',
  午: '丑', 未: '子', 巳: '寅', 辰: '卯', 亥: '申', 戌: '酉'
};

const PA_MAP: Record<string, string> = {
  子: '酉', 丑: '辰', 寅: '亥', 卯: '午', 申: '巳', 酉: '子',
  辰: '丑', 亥: '寅', 午: '卯', 巳: '申', 未: '戌', 戌: '未'
};

const HYEONG_SET = new Set([
  '寅-巳', '巳-申', '申-寅',
  '丑-戌', '戌-未', '未-丑',
  '子-卯', '卯-子',
  '辰-辰', '午-午', '酉-酉', '亥-亥'
]);

const HAP_PAIRS = new Set([
  '子-丑', '丑-子', '寅-亥', '亥-寅', '卯-戌', '戌-卯',
  '辰-酉', '酉-辰', '巳-申', '申-巳', '午-未', '未-午'
]);

const WONJIN_PAIRS = new Set([
  '子-未', '未-子', '丑-午', '午-丑', '寅-酉', '酉-寅',
  '卯-申', '申-卯', '辰-亥', '亥-辰', '巳-戌', '戌-巳'
]);

const SAMHAP_GROUPS = [
  ['申', '子', '辰'],
  ['亥', '卯', '未'],
  ['寅', '午', '戌'],
  ['巳', '酉', '丑']
];

const CHEONEUL_BRANCHES_BY_STEM: Record<string, string[]> = {
  甲: ['丑', '未'],
  乙: ['子', '申'],
  丙: ['亥', '酉'],
  丁: ['亥', '酉'],
  戊: ['丑', '未'],
  己: ['子', '申'],
  庚: ['午', '寅'],
  辛: ['午', '寅'],
  壬: ['卯', '巳'],
  癸: ['卯', '巳']
};

const TABOO_SOLAR_MD = new Set([
  '01-13', '03-13', '05-13', '07-13', '09-13', '11-13'
]);

const YANG_GONG_TABOO_LUNAR_MD = new Set([
  '01-13', '02-11', '03-09', '04-07', '05-05', '06-03',
  '07-01', '07-29', '08-27', '09-25', '10-23', '11-21', '12-19'
]);

const MOVE_BOKDAN_LUNAR_DAYS = new Set([3, 7, 13, 18, 22, 27]);

const BOKDEOK_BRANCHES_BY_DAY_BRANCH: Record<string, string[]> = {
  子: ['申', '子', '辰'],
  丑: ['酉', '丑', '巳'],
  寅: ['午', '寅', '戌'],
  卯: ['亥', '卯', '未'],
  辰: ['申', '子', '辰'],
  巳: ['酉', '丑', '巳'],
  午: ['午', '寅', '戌'],
  未: ['亥', '卯', '未'],
  申: ['申', '子', '辰'],
  酉: ['酉', '丑', '巳'],
  戌: ['午', '寅', '戌'],
  亥: ['亥', '卯', '未']
};

const childbirthCache = new Map<string, TimeSlotRecommendation[]>();

const yongshinTextToElementKey = (text?: string) => {
  if (!text) return '';
  if (text.includes('목')) return 'wood';
  if (text.includes('화')) return 'fire';
  if (text.includes('토')) return 'earth';
  if (text.includes('금')) return 'metal';
  if (text.includes('수')) return 'water';
  return '';
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toSolarYmd(date: string, isLunar: boolean, isLeap: boolean) {
  const [y, m, d] = date.split('-').map(Number);
  if (!isLunar) return { y, m, d };
  const solar = Lunar.fromYmd(y, isLeap ? -m : m, d).getSolar();
  return { y: solar.getYear(), m: solar.getMonth(), d: solar.getDay() };
}

function getPillar(date: DateTime) {
  const solar = Solar.fromYmd(date.year, date.month, date.day);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  try {
    if (eightChar && typeof (eightChar as any).setDayZero === 'function') {
      (eightChar as any).setDayZero(2);
    }
  } catch {
    // ignore and continue with library defaults
  }
  const day = eightChar.getDay();
  const stem = day.charAt(0);
  const branch = day.charAt(1);
  return { stem, branch, lunarDay: lunar.getDay() };
}

function isConflict(userDayBranch: string, targetBranch: string) {
  if (CHUNG_MAP[userDayBranch] === targetBranch) return true;
  if (HAE_MAP[userDayBranch] === targetBranch) return true;
  if (PA_MAP[userDayBranch] === targetBranch) return true;
  if (HYEONG_SET.has(`${userDayBranch}-${targetBranch}`)) return true;
  return false;
}

function isGeneralTaboo(date: DateTime, lunarDay: number) {
  const md = `${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  if (TABOO_SOLAR_MD.has(md)) return true;
  if ([5, 14, 23].includes(lunarDay)) return true;
  return false;
}

function isMarriageTaboo(date: DateTime) {
  const lunar = Solar.fromYmd(date.year, date.month, date.day).getLunar();
  const lunarMd = `${String(lunar.getMonth()).padStart(2, '0')}-${String(lunar.getDay()).padStart(2, '0')}`;
  return YANG_GONG_TABOO_LUNAR_MD.has(lunarMd);
}

function isMoveTaboo(date: DateTime) {
  const lunar = Solar.fromYmd(date.year, date.month, date.day).getLunar();
  const lunarDay = lunar.getDay();
  const lunarMd = `${String(lunar.getMonth()).padStart(2, '0')}-${String(lunarDay).padStart(2, '0')}`;

  if (MOVE_BOKDAN_LUNAR_DAYS.has(lunarDay)) return true;
  if (YANG_GONG_TABOO_LUNAR_MD.has(lunarMd)) return true;
  return false;
}

function normalizeDirectionText(raw: string) {
  const text = raw.toLowerCase();
  if (text.includes('동남') || text.includes('southeast') || text.includes('se')) return 'SE';
  if (text.includes('남서') || text.includes('southwest') || text.includes('sw')) return 'SW';
  if (text.includes('동북') || text.includes('northeast') || text.includes('ne')) return 'NE';
  if (text.includes('서북') || text.includes('northwest') || text.includes('nw')) return 'NW';
  if (text.includes('동') || text.includes('east')) return 'E';
  if (text.includes('서') || text.includes('west')) return 'W';
  if (text.includes('남') || text.includes('south')) return 'S';
  if (text.includes('북') || text.includes('north')) return 'N';
  return '';
}

function getYearBranch(date: DateTime) {
  const lunar = Solar.fromYmd(date.year, date.month, date.day).getLunar();
  const maybeGanZhi =
    (lunar as any).getYearInGanZhiExact?.() ||
    (lunar as any).getYearInGanZhi?.() ||
    (lunar as any).getYearGanZhi?.() ||
    '';
  return typeof maybeGanZhi === 'string' ? maybeGanZhi.charAt(maybeGanZhi.length - 1) : '';
}

function getSamsalDirectionByYearBranch(yearBranch: string) {
  if (['寅', '午', '戌'].includes(yearBranch)) return 'N';
  if (['申', '子', '辰'].includes(yearBranch)) return 'S';
  if (['亥', '卯', '未'].includes(yearBranch)) return 'W';
  if (['巳', '酉', '丑'].includes(yearBranch)) return 'E';
  return '';
}

function directionMatches(base: string, target: string) {
  if (!base || !target) return false;
  if (base === target) return true;
  if (target.length === 2) return target.includes(base);
  if (base.length === 2) return base.includes(target);
  return false;
}

function scoreMoveDirection(
  targetDate: DateTime,
  moveDirection: string,
  movePriority: 'folklore' | 'saju' | 'balanced',
  reasons: string[],
  factors: ScoreFactor[]
) {
  if (!moveDirection) return 0;

  const yearBranch = getYearBranch(targetDate);
  const samsalDir = getSamsalDirectionByYearBranch(yearBranch);
  const dangerDirs = [samsalDir].filter(Boolean);

  let delta = 0;
  if (dangerDirs.some((dangerDir) => directionMatches(dangerDir, moveDirection))) {
    delta -= movePriority === 'folklore' ? 0.9 : 0.6;
    const reason = '방향 분석: 해당 날짜는 연도 기준 삼살 방향과 겹쳐 이동 방향 감점을 반영했습니다.';
    reasons.push(reason);
    factors.push({ label: reason, weight: Number(delta.toFixed(2)), type: 'minus' });
  } else {
    delta += movePriority === 'folklore' ? 0.5 : 0.35;
    const reason = '방향 분석: 연도 기준 삼살 방향과 겹치지 않아 이사 방향 안정 가점을 반영했습니다.';
    reasons.push(reason);
    factors.push({ label: reason, weight: Number(delta.toFixed(2)), type: 'plus' });
  }

  return delta;
}

function applyGenericUserConstraintBoost(
  req: TaekilRequest,
  current: DateTime,
  topTimeSlots: TimeSlotRecommendation[],
  reasons: string[],
  factors: ScoreFactor[]
) {
  const textBlob = [
    ...(req.categoryInputs ? Object.values(req.categoryInputs) : []),
    req.additionalInfo || ''
  ].join(' ').toLowerCase();

  let delta = 0;
  const add = (value: number, reason: string) => {
    delta += value;
    reasons.push(reason);
    factors.push({
      label: reason,
      weight: Number(value.toFixed(2)),
      type: value > 0 ? 'plus' : 'minus'
    });
  };

  if (!textBlob.trim()) return 0;

  const weekday = current.weekday % 7;
  const isWeekend = weekday === 0 || weekday === 6;
  if (textBlob.includes('주말') || textBlob.includes('weekend')) {
    add(isWeekend ? 0.35 : -0.2, isWeekend
      ? '사용자 메모의 주말 선호 조건과 일치합니다.'
      : '사용자 메모의 주말 선호 조건과 일치하지 않아 소폭 감점했습니다.');
  }

  const firstHour = Number((topTimeSlots[0]?.time || '00:00').split(':')[0]);
  if ((textBlob.includes('오전') || textBlob.includes('morning')) && firstHour > 0) {
    add(firstHour < 12 ? 0.25 : -0.15, firstHour < 12
      ? '사용자 메모의 오전 선호 시간대와 정합성이 높습니다.'
      : '사용자 메모의 오전 선호와 시간대가 달라 소폭 감점했습니다.');
  }
  if ((textBlob.includes('오후') || textBlob.includes('afternoon')) && firstHour > 0) {
    add(firstHour >= 12 ? 0.25 : -0.15, firstHour >= 12
      ? '사용자 메모의 오후 선호 시간대와 정합성이 높습니다.'
      : '사용자 메모의 오후 선호와 시간대가 달라 소폭 감점했습니다.');
  }

  return delta;
}

function hasSamhap(branches: string[]) {
  const uniq = Array.from(new Set(branches.filter(Boolean)));
  return SAMHAP_GROUPS.some((group) => group.filter((branch) => uniq.includes(branch)).length >= 2);
}

function isCheoneulDay(dayStem: string, targetBranch: string) {
  return (CHEONEUL_BRANCHES_BY_STEM[dayStem] || []).includes(targetBranch);
}

function scoreByCategory(
  category: TaekilCategory,
  userDayBranch: string,
  userDayStem: string,
  userYongshinElement: string,
  targetDayStem: string,
  targetDayBranch: string,
  reasons: string[],
  factors: ScoreFactor[],
  spouseDayBranch?: string,
  spouseDayStem?: string,
  spouseYongshinElement?: string
) {
  let score = 3.0;
  const deity = calculateDeity(userDayStem, targetDayStem);
  const targetElement = elementMap[targetDayStem] || '';

  const add = (value: number, reason: string) => {
    score += value;
    reasons.push(reason);
    factors.push({
      label: reason,
      weight: Number(value.toFixed(2)),
      type: value > 0 ? 'plus' : 'minus'
    });
  };

  const hasHap = HAP_PAIRS.has(`${userDayBranch}-${targetDayBranch}`);
  const hasBokdeok = (BOKDEOK_BRANCHES_BY_DAY_BRANCH[userDayBranch] || []).includes(targetDayBranch);
  const isJaeseong = deity === '정재' || deity === '편재';
  const isInsung = deity === '정인' || deity === '편인';
  const isSiksin = deity === '식신' || deity === '상관';
  const isGwansung = deity === '정관' || deity === '편관';

  switch (category) {
    case '결혼':
      if (spouseDayBranch && spouseDayStem) {
        const coupleHap = HAP_PAIRS.has(`${userDayBranch}-${spouseDayBranch}`);
        if (coupleHap) {
          add(1.5, '신랑-신부 일지가 합(合)을 이루는 궁합으로 감정 호선이 좋습니다.');
        } else if (!isConflict(userDayBranch, spouseDayBranch)) {
          add(0.3, '신랑-신부 일지가 특별한 충돌이 없어 기본적 조화를 유지합니다.');
        } else {
          add(-0.5, '신랑-신부 일지가 충/형/파/해를 이루어 주의가 필요합니다.');
        }

        if (WONJIN_PAIRS.has(`${userDayBranch}-${spouseDayBranch}`)) {
          add(-0.6, '두 사람의 일지 사이에 원진 기운이 있어 날짜 선택을 더 보수적으로 보았습니다.');
        }

        if (!isConflict(spouseDayBranch, targetDayBranch)) {
          add(0.7, '배우자와 택일이 충돌하지 않아 부부 모두에게 길합니다.');
        } else {
          add(-0.8, '배우자가 택일과 상충되어 주의가 필요합니다.');
        }

        if (WONJIN_PAIRS.has(`${spouseDayBranch}-${targetDayBranch}`) || WONJIN_PAIRS.has(`${userDayBranch}-${targetDayBranch}`)) {
          add(-0.7, '부부 중 한 사람과 일진 사이에 원진살 흐름이 있어 감점을 반영했습니다.');
        }

        if (HAP_PAIRS.has(`${spouseDayBranch}-${targetDayBranch}`)) {
          add(1.0, '배우자 일지와 일진이 육합을 이루어 부부 합이 안정적으로 받쳐줍니다.');
        }

        if (hasSamhap([userDayBranch, spouseDayBranch, targetDayBranch])) {
          add(1.1, '부부 일지와 일진이 삼합 흐름을 이루어 화합의 기운이 강합니다.');
        }

        const spouseDeity = calculateDeity(spouseDayStem, targetDayStem);
        if (spouseYongshinElement && spouseYongshinElement === targetElement) {
          add(0.8, `배우자 용신(${spouseYongshinElement})이 보강되는 날이라 안정감을 더합니다.`);
        }

        if (userYongshinElement && spouseYongshinElement && userYongshinElement === targetElement && spouseYongshinElement === targetElement) {
          add(1.2, '신랑·신부의 공통 용희신 오행이 함께 보강되어 길한 흐름이 강합니다.');
        }

        if (spouseDeity === '정관' || spouseDeity === '편관') {
          add(0.5, '배우자 관성 흐름이 안정적으로 작동해 예식 진행력에 보탬이 됩니다.');
        }

        if (isCheoneulDay(spouseDayStem, targetDayBranch)) {
          add(0.7, '배우자 기준 천을귀인에 해당하는 날이라 보호받는 기운이 있습니다.');
        }
      }

      if (hasHap) add(1.3, '신청자 일지가 택일과 합(合)을 이루어 진행이 순조로울 것 같습니다.');
      if (isSiksin) add(0.7, '식상 기운이 살아 있어 감정 표현과 소통이 유리합니다.');
      if (isJaeseong) add(0.5, '재성 기운이 도와 현실적 안정감을 보탭니다.');
      if (hasSamhap([userDayBranch, targetDayBranch])) add(0.4, '신청자 기준 삼합 흐름 일부가 성립되어 화합성을 더합니다.');
      if (isCheoneulDay(userDayStem, targetDayBranch)) add(0.8, '신청자 기준 천을귀인에 해당하는 날이라 길신 보정을 더했습니다.');
      if (hasBokdeok) add(0.5, '복덕 계열 지지 흐름이라 예식 전체 분위기에 안정감이 있습니다.');
      break;
    case '만남':
      if (hasHap) add(1.3, '일지가 합(合)을 이루는 흐름이라 인연/관계 운이 부드럽습니다.');
      if (isSiksin) add(0.7, '식상 기운이 살아 있어 감정 표현과 소통이 유리합니다.');
      if (isJaeseong) add(0.5, '재성 기운이 도와 관계의 현실적 안정감을 보탭니다.');
      break;
    case '이사':
    case '계약':
      if (isInsung) add(1.0, '인성 기운이 강해 문서/확인/정리 흐름에 유리합니다.');
      if (hasBokdeok) add(0.8, '생기/복덕 계열 길성 배치에 해당하는 지지 흐름입니다.');
      if (category === '이사' && isSiksin) add(0.5, '식신 흐름이 살아 있어 이사 당일 동선과 체력 소모 완화에 도움됩니다.');
      if (category === '이사' && isJaeseong) add(0.4, '재성 흐름이 안정적이라 계약·잔금·생활 재정 흐름에 보탬이 됩니다.');
      break;
    case '개업':
      if (isJaeseong) add(1.2, '재성 기운이 살아 있어 수익성과 자금 흐름에 유리합니다.');
      if (userYongshinElement && userYongshinElement === targetElement) {
        add(1.0, `용신(${userYongshinElement})과 같은 오행이 작동해 실행 안정성이 높습니다.`);
      }
      break;
    case '출산':
      if (isGwansung || isInsung) add(0.6, '관성/인성 밸런스가 비교적 안정적인 날입니다.');
      if (userYongshinElement && userYongshinElement === targetElement) {
        add(0.8, `용신(${userYongshinElement}) 오행이 보강되는 날입니다.`);
      }
      break;
    case '수술':
      if (isInsung) add(0.8, '회복/관리 관점에서 인성 기운이 보조됩니다.');
      if (isGwansung) add(0.6, '절차/통제 흐름이 살아 있는 관성 운입니다.');
      break;
    case '시험':
      if (isInsung) add(1.1, '인성 기운이 학습/집중/정리력에 유리합니다.');
      if (isSiksin) add(0.5, '식상 기운이 답안 표현력과 응용력에 도움됩니다.');
      break;
    case '여행':
      if (hasHap) add(0.8, '합(合) 기운으로 이동/대인 흐름이 비교적 순합니다.');
      if (isSiksin) add(0.5, '식상 기운으로 활동성과 경험 확장성이 좋습니다.');
      break;
    case '이장':
      if (isGwansung) add(0.7, '절차와 의식의 정합성이 필요한 작업에 관성 운이 맞습니다.');
      if (hasBokdeok) add(0.7, '복덕 계열 지지 흐름이라 의례 진행에 안정적입니다.');
      break;
    default:
      break;
  }

  return clamp(score, 1, 5);
}

function evaluateTimeSlots(
  date: DateTime,
  userDayBranch: string,
  userDayStem: string,
  userYongshinElement: string,
  category: TaekilCategory,
  spouseDayBranch?: string,
  spouseDayStem?: string,
  spouseYongshinElement?: string
): TimeSlotRecommendation[] {
  const items: TimeSlotRecommendation[] = [];
  const hours = category === '결혼' ? [11, 13, 15] : Array.from({ length: 12 }, (_, idx) => idx * 2);

  for (const hour of hours) {
    const dt = date.set({ hour, minute: 0 });
    const timeStr = dt.toFormat('HH:mm');

    let score = 2.7;
    let reason = '기본 균형이 무난한 시간대입니다.';

    const saju = getSajuData(date.toFormat('yyyy-LL-dd'), timeStr, false, false, false, TZ);
    const dayPillar = saju.find(p => p.title === '일주');
    const hourPillar = saju.find(p => p.title === '시주');
    const hourStem = hourPillar?.stem?.hanja || '';
    const hourBranch = hourPillar?.branch?.hanja || '';

    if (!hourStem || !hourBranch || !dayPillar) {
      items.push({ time: timeStr, score: 1.5, reason: '시주 산출 정보가 제한되어 보수적으로 평가했습니다.' });
      continue;
    }

    if (isConflict(userDayBranch, hourBranch)) {
      score -= 1.2;
      reason = '사용자 일지와 상충되는 시지라 우선순위를 낮췄습니다.';
    }

    if (category === '결혼' && spouseDayBranch && isConflict(spouseDayBranch, hourBranch)) {
      score -= 1.1;
      reason = '배우자 일지와 상충되는 시지라 예식 시간 후보에서 후순위로 보았습니다.';
    }

    const deity = calculateDeity(userDayStem, hourStem);
    const hourElement = elementMap[hourStem] || '';

    if (userYongshinElement && hourElement === userYongshinElement) {
      score += 1.0;
      reason = `용신(${userYongshinElement}) 오행이 보강되는 시각입니다.`;
    }

    if (category === '출산' && (deity === '정관' || deity === '정인' || deity === '식신')) {
      score += 0.7;
      reason = '출산 택일 기준에서 구조 안정성이 높은 조합입니다.';
    }

    if (category === '계약' && (deity === '정인' || deity === '편인')) {
      score += 0.5;
      reason = '문서/계약 적합성이 높은 인성 시간대입니다.';
    }

    if (category === '결혼') {
      if (HAP_PAIRS.has(`${userDayBranch}-${hourBranch}`) || (spouseDayBranch && HAP_PAIRS.has(`${spouseDayBranch}-${hourBranch}`))) {
        score += 0.7;
        reason = '부부 중 한 사람의 일지와 합을 이루는 예식 시간대입니다.';
      }

      if (spouseYongshinElement && spouseYongshinElement === hourElement) {
        score += 0.4;
        reason = `배우자 용신(${spouseYongshinElement}) 오행이 보강되는 시간대입니다.`;
      }

      if (spouseDayStem && isCheoneulDay(spouseDayStem, hourBranch)) {
        score += 0.4;
      }
    }

    items.push({
      time: timeStr,
      score: clamp(Number(score.toFixed(2)), 1, 5),
      reason
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 2);
}

function getChildbirthTimeSlots(
  date: DateTime,
  req: TaekilRequest,
  userDayBranch: string,
  userDayStem: string,
  userYongshinElement: string
) {
  const cacheKey = [
    req.birthDate,
    req.birthTime,
    String(req.isLunar),
    String(req.isLeap || false),
    date.toISODate()
  ].join('|');

  const cached = childbirthCache.get(cacheKey);
  if (cached) return cached;

  const computed = evaluateTimeSlots(date, userDayBranch, userDayStem, userYongshinElement, '출산');
  childbirthCache.set(cacheKey, computed);
  return computed;
}

export function runTaekilEngine(req: TaekilRequest): TaekilResultItem[] {
  const isLeap = !!req.isLeap;
  const unknownTime = !!req.unknownTime;

  const { y, m, d } = toSolarYmd(req.birthDate, req.isLunar, isLeap);
  const userBirthDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const userSaju = getSajuData(userBirthDate, req.birthTime, false, false, unknownTime, TZ);
  const userDayPillar = userSaju.find(p => p.title === '일주');

  if (!userDayPillar?.stem?.hanja || !userDayPillar?.branch?.hanja) {
    throw new Error('사용자 일주 정보를 계산할 수 없습니다.');
  }

  const userDayStem = userDayPillar.stem.hanja;
  const userDayBranch = userDayPillar.branch.hanja;

  const yongshin = calculateYongshin(userSaju);
  const userYongshinElement = yongshinTextToElementKey(yongshin?.yongshin);

  // 결혼 카테고리 시 배우자 정보 계산
  let spouseDayBranch: string | undefined;
  let spouseDayStem: string | undefined;
  let spouseYongshinElement: string | undefined;
  const movePriority: 'folklore' | 'saju' | 'balanced' = req.movePriority || 'balanced';
  const moveDirection = normalizeDirectionText(`${req.moveCurrentAddress || ''} ${req.moveTargetAddress || ''}`);
  const moveFamilyDayBranches: string[] = [];

  if (req.category === '결혼' && req.spouseBirthDate && req.spouseBirthTime) {
    try {
      const spouseIsLeap = !!req.spouseIsLeap;
      const spouseUnknownTime = !!req.spouseUnknownTime;
      const { y: sy, m: sm, d: sd } = toSolarYmd(req.spouseBirthDate, req.spouseIsLunar ?? false, spouseIsLeap);
      const spouseBirthDateStr = `${sy}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`;
      const spouseSaju = getSajuData(spouseBirthDateStr, req.spouseBirthTime, false, false, spouseUnknownTime, TZ);
      const spousePillar = spouseSaju.find(p => p.title === '일주');

      if (spousePillar?.stem?.hanja && spousePillar?.branch?.hanja) {
        spouseDayStem = spousePillar.stem.hanja;
        spouseDayBranch = spousePillar.branch.hanja;
        const spouseYongshinObj = calculateYongshin(spouseSaju);
        spouseYongshinElement = yongshinTextToElementKey(spouseYongshinObj?.yongshin);
      }
    } catch {
      // 배우자 정보 계산 실패 시 무시하고 진행
    }
  }

  if (req.category === '이사' && Array.isArray(req.moveFamilyBirthDates)) {
    for (const birthDate of req.moveFamilyBirthDates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate))) continue;
      try {
        const familySaju = getSajuData(String(birthDate), '12:00', false, false, false, TZ);
        const familyDayPillar = familySaju.find((p) => p.title === '일주');
        const familyBranch = familyDayPillar?.branch?.hanja || '';
        if (familyBranch) moveFamilyDayBranches.push(familyBranch);
      } catch {
        // 가족 데이터 오류는 개별 무시
      }
    }
  }

  const start = DateTime.fromISO(req.periodStart, { zone: TZ }).startOf('day');
  const end = DateTime.fromISO(req.periodEnd, { zone: TZ }).startOf('day');
  if (!start.isValid || !end.isValid || end < start) {
    throw new Error('희망 기간 형식이 올바르지 않습니다.');
  }

  const preferredWeekdays = (req.preferredWeekdays || [])
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .slice(0, 3);

  const avoidDateSet = new Set(
    (req.avoidDates || [])
      .map((date) => String(date).trim())
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .slice(0, 5)
  );

  const evals: DayEvaluation[] = [];
  for (let current = start; current <= end; current = current.plus({ days: 1 })) {
    const currentDate = current.toFormat('yyyy-LL-dd');

    if (avoidDateSet.has(currentDate)) {
      continue;
    }

    if (req.category === '이사' && req.moveOnlyWeekend) {
      const weekday = current.weekday % 7;
      if (weekday !== 0 && weekday !== 6) {
        continue;
      }
    }

    const pillar = getPillar(current);

    if (isConflict(userDayBranch, pillar.branch)) {
      continue;
    }

    // 결혼 카테고리에서 배우자 정보가 있으면 배우자도 충돌 체크
    if (req.category === '결혼' && spouseDayBranch && isConflict(spouseDayBranch, pillar.branch)) {
      continue;
    }

    if (isGeneralTaboo(current, pillar.lunarDay)) {
      continue;
    }

    if (req.category === '이사' && isMoveTaboo(current)) {
      continue;
    }

    if (req.category === '이사' && moveFamilyDayBranches.some((branch) => isConflict(branch, pillar.branch))) {
      continue;
    }

    const reasons: string[] = [];
    const factors: ScoreFactor[] = [];

    if (req.category === '결혼') {
      reasons.push('1차 필터: 전통 흉일, 충/형/파/해, 요청 회피일 검증을 통과한 날짜입니다.');
      reasons.push('2차 궁합: 신랑·신부 일지와 일진의 구조적 충돌 여부를 우선 검토했습니다.');
      factors.push({ label: '1차 필터 통과', weight: 0, type: 'info' });
      factors.push({ label: '2차 궁합 구조 검토', weight: 0, type: 'info' });
    } else if (req.category === '이사') {
      reasons.push('1차 필터: 월기일·복단일·양공기일과 기본 충돌(충/형/파/해) 여부를 우선 제외했습니다.');
      reasons.push('2차 방위: 이사 방향과 연도 삼살 방향 충돌 가능성을 점검했습니다.');
      factors.push({ label: '1차 전통 흉일 필터 통과', weight: 0, type: 'info' });
      factors.push({ label: '2차 이사 방향 점검 적용', weight: 0, type: 'info' });
    }

    let score = scoreByCategory(
      req.category,
      userDayBranch,
      userDayStem,
      userYongshinElement,
      pillar.stem,
      pillar.branch,
      reasons,
      factors,
      spouseDayBranch,
      spouseDayStem,
      spouseYongshinElement
    );

    if (req.category === '이사') {
      score = clamp(score + scoreMoveDirection(current, moveDirection, movePriority, reasons, factors), 1, 5);
    }

    if (preferredWeekdays.length > 0) {
      const weekday = current.weekday % 7;
      const rank = preferredWeekdays.findIndex((day) => day === weekday);
      if (rank >= 0) {
        const bonuses = req.category === '결혼' ? [0.7, 0.45, 0.25] : [0.55, 0.35, 0.2];
        score = clamp(score + bonuses[rank], 1, 5);
        reasons.push(`3차 사용자 조건: 희망 요일 ${rank + 1}순위에 해당해 우선순위 가중치를 반영했습니다.`);
        factors.push({
          label: `희망 요일 ${rank + 1}순위 가중치`,
          weight: Number(bonuses[rank].toFixed(2)),
          type: 'plus'
        });
      }
    }

    const topTimeSlots = req.category === '출산'
      ? getChildbirthTimeSlots(current, req, userDayBranch, userDayStem, userYongshinElement)
      : evaluateTimeSlots(current, userDayBranch, userDayStem, userYongshinElement, req.category, spouseDayBranch, spouseDayStem, spouseYongshinElement);

    if (!['결혼', '이사'].includes(req.category)) {
      score = clamp(score + applyGenericUserConstraintBoost(req, current, topTimeSlots, reasons, factors), 1, 5);
    }

    if (req.category === '결혼' && isMarriageTaboo(current)) {
      continue;
    }

    if (req.category === '결혼') {
      reasons.push('4차 길신 보정: 천을귀인·복덕 등 보호 계열 신살 가점을 함께 반영했습니다.');
      reasons.push('5차 시간 추출: 예식 현실 시간대(11~15시)에서 흉시를 배제해 추천 시간을 산출했습니다.');
      factors.push({ label: '4차 길신 보정 적용', weight: 0, type: 'info' });
      factors.push({ label: '5차 예식 시간 최적화 적용', weight: 0, type: 'info' });
    } else if (req.category === '이사') {
      reasons.push('4차 민속 보정: 손 없는 날(음력 끝자리 9·0)과 복덕 계열 길신 흐름을 함께 반영했습니다.');
      factors.push({ label: '4차 이사 민속/길신 보정 적용', weight: 0, type: 'info' });

      const lunarDay = Solar.fromYmd(current.year, current.month, current.day).getLunar().getDay();
      if (lunarDay % 10 === 9 || lunarDay % 10 === 0) {
        const folkloreBonus = movePriority === 'folklore' ? 0.8 : 0.45;
        score = clamp(score + folkloreBonus, 1, 5);
        reasons.push('손 없는 날 구간(음력 끝자리 9·0)에 해당하여 이사 민속 가점을 더했습니다.');
        factors.push({
          label: '손 없는 날 가점',
          weight: Number(folkloreBonus.toFixed(2)),
          type: 'plus'
        });
      }
    }

    if (reasons.length === 0) {
      reasons.push('기본 필터(충/형/파/해, 전통 흉일)를 통과한 중립-양호 일자입니다.');
    }

    evals.push({
      date: currentDate,
      score,
      reasons,
      topTimeSlots,
      factors
    });
  }

  const maxCount = 5;

  return evals
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(item => ({
      date: item.date,
      rating: Math.round(clamp(item.score, 1, 5)),
      reasons: item.reasons,
      topTimeSlots: item.topTimeSlots,
      factors: item.factors
    }));
}
