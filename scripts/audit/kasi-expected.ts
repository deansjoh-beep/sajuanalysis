/**
 * KASI 기준 독립 기대값(expected 8자) 계산기 (Phase 1-1)
 *
 * 목적: `manseryeok-verify.ts`의 KASI 대조 모드에서 엔진(getSajuData)과 **독립적으로**
 * 사주 8자를 산출해 expected로 주입한다. lunar-javascript를 일절 사용하지 않는다.
 *
 * 산출 근거(소스별):
 *   - 연주·월주 경계: KASI `kasi-jieqi.json` 절입 시각(KST, 권위 기준).
 *     연주는 입춘, 월주는 각 절(節). 간지 배정은 순수 산술(연간 (Y-4) mod 10/12, 오호둔).
 *   - 일주: 율리우스일(JDN) 60갑자 순환. 앵커 1949-10-01 = 甲子 (문헌 정설).
 *     교차 앵커 1900-01-01 = 甲戌, 2000-01-01 = 戊午로 모듈 로드 시 자가검증.
 *   - 시주: 시지(2시간 블록) + 오서둔(五鼠遁). 야자시(23시대)는 익일 일간 기준 —
 *     엔진(lunar-javascript EightChar sect=2)과 동일 유파.
 *   - 진태양시·표준시 정규화: 정책(policy.ts)의 정의를 그대로 재현(경도보정 + EOT).
 *     이 부분은 '정책 정의'라 독립 검증 대상이 아니라 재현 대상이다.
 *
 * KASI 자체 오류 처리:
 *   - 2011 입동(KASI 09:26, 실제 대비 약 5.85h 오류)은 천문계산(jieqi-astro, ±14분 정밀)으로
 *     패치한다. 패치 항의 ±45분 이내 케이스는 정밀도 부족으로 검증 대상에서 제외(호출측 skip).
 *
 * 실행 전제: KASI 커버리지(2000~2028) 내 양력 입력만 지원. 범위 밖이면 null 반환.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEOUL_LONGITUDE, getKstNormalizationOffsetMinutes } from '../../src/lib/manseryeok/policy';
import { solarTermInstant } from '../../src/lib/manseryeok/jieqi-astro';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 절(節) → 월지 인덱스(寅=0 … 丑=11) */
const JEOL_TO_MONTH_INDEX: Record<string, number> = {
  '입춘': 0, '경칩': 1, '청명': 2, '입하': 3, '망종': 4, '소서': 5,
  '입추': 6, '백로': 7, '한로': 8, '입동': 9, '대설': 10, '소한': 11,
};

const KST_MS = 9 * 3600 * 1000;

export type JeolInstant = {
  name: string;
  utcMs: number;
  /** KASI 원본 대신 천문계산으로 패치된 항 (정밀도 ±14분 → 근접 케이스 제외 필요) */
  patched: boolean;
};

/** KASI 자체 오류로 확인되어 천문계산으로 대체하는 절 (연도|절기명) */
const KASI_ERROR_TERMS = new Set(['2011|입동']);

const dir = dirname(fileURLToPath(import.meta.url));

/** kasi-jieqi.json에서 절(節)만 시간순으로 로드. KASI 오류 항은 jieqi-astro로 패치. */
export const loadJeolInstants = (): JeolInstant[] => {
  const raw = JSON.parse(
    readFileSync(resolve(dir, '../../src/lib/manseryeok/data/kasi-jieqi.json'), 'utf-8'),
  );
  const jeol: JeolInstant[] = [];
  for (const t of raw.terms as Array<{ name: string; date: string; time: string; sunLongitude: number; isMonthBoundary: boolean }>) {
    if (!t.isMonthBoundary) continue;
    const key = `${t.date.slice(0, 4)}|${t.name}`;
    if (KASI_ERROR_TERMS.has(key)) {
      const astro = solarTermInstant(Number(t.date.slice(0, 4)), t.sunLongitude);
      if (!astro) throw new Error(`astro fallback failed for ${key}`);
      jeol.push({ name: t.name, utcMs: astro.utc.getTime(), patched: true });
      continue;
    }
    const [y, mo, d] = t.date.split('-').map(Number);
    const [hh, mm] = t.time.split(':').map(Number);
    jeol.push({ name: t.name, utcMs: Date.UTC(y, mo - 1, d, hh, mm) - KST_MS, patched: false });
  }
  jeol.sort((a, b) => a.utcMs - b.utcMs);
  return jeol;
};

/** 그레고리력 → 율리우스일 번호(JDN, 정오 기준 정수) */
export const gregorianToJdn = (y: number, m: number, d: number): number => {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
    Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
  );
};

/** 일주 60갑자 앵커: 1949-10-01 = 甲子(인덱스 0) */
const DAY_ANCHOR_JDN = gregorianToJdn(1949, 10, 1);

const dayCycleIndex = (jdn: number): number => (((jdn - DAY_ANCHOR_JDN) % 60) + 60) % 60;

const pillarFromCycle = (idx: number): string => STEMS[idx % 10] + BRANCHES[idx % 12];

// ── 모듈 로드 시 앵커 자가검증 (문헌 앵커 3건 상호일치 확인) ──
{
  const checks: Array<[number, number, number, string]> = [
    [1949, 10, 1, '甲子'],
    [1900, 1, 1, '甲戌'],
    [2000, 1, 1, '戊午'],
  ];
  for (const [y, m, d, exp] of checks) {
    const got = pillarFromCycle(dayCycleIndex(gregorianToJdn(y, m, d)));
    if (got !== exp) {
      throw new Error(`일주 앵커 자가검증 실패: ${y}-${m}-${d} 기대 ${exp}, 계산 ${got}`);
    }
  }
}

/** 엔진(saju.ts equationOfTime)과 동일한 정책 정의의 균시차(분) 재현 */
const equationOfTimeMinutes = (dayOfYear: number): number => {
  const B = (2 * Math.PI * (dayOfYear - 81)) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
};

const dayOfYear = (y: number, m: number, d: number): number =>
  gregorianToJdn(y, m, d) - gregorianToJdn(y, 1, 1) + 1;

export type ExpectedEightChar = {
  year: string;
  month: string;
  day: string;
  hour: string;
  /** 가장 가까운 절입까지의 거리(분, 절대값) — 근접 케이스 제외 판단용 */
  minutesToNearestJeol: number;
  /** 가장 가까운 절이 천문계산 패치 항인지 */
  nearestJeolPatched: boolean;
};

/**
 * 양력 KST 입력의 기대 8자를 KASI 기준으로 독립 산출.
 * KASI 커버리지를 벗어나 연·월주를 확정할 수 없으면 null.
 */
export const expectedEightChar = (
  jeol: JeolInstant[],
  dateStr: string,
  timeStr: string,
): ExpectedEightChar | null => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [hh, mi] = timeStr.split(':').map(Number);

  // 1) 표준시/서머타임 wall-clock 정규화 (엔진과 동일 정책; KASI 창에서는 항상 0)
  const kstOffsetMin = getKstNormalizationOffsetMinutes(y, mo, d);
  const birthUtcMs = Date.UTC(y, mo - 1, d, hh, mi) - KST_MS + kstOffsetMin * 60000;

  // 2) 연주: 출생 연도의 입춘 순간(KASI) 대비
  const calYear = new Date(birthUtcMs + KST_MS).getUTCFullYear();
  const ipchun = jeol.find(
    (t) => t.name === '입춘' && new Date(t.utcMs + KST_MS).getUTCFullYear() === calYear,
  );
  if (!ipchun) return null; // 커버리지 밖
  const sajuYear = birthUtcMs >= ipchun.utcMs ? calYear : calYear - 1;
  const yearStemIdx = (((sajuYear - 4) % 10) + 10) % 10;
  const yearPillar = STEMS[yearStemIdx] + BRANCHES[(((sajuYear - 4) % 12) + 12) % 12];

  // 3) 월주: 출생 이전 마지막 절(節) → 월지, 오호둔(五虎遁) → 월간
  let prev: JeolInstant | null = null;
  let minDist = Infinity;
  let nearest: JeolInstant | null = null;
  for (const t of jeol) {
    if (t.utcMs <= birthUtcMs) prev = t;
    const dist = Math.abs(t.utcMs - birthUtcMs);
    if (dist < minDist) {
      minDist = dist;
      nearest = t;
    }
  }
  if (!prev || !nearest) return null; // 첫 절 이전 → 커버리지 밖
  const monthIdx = JEOL_TO_MONTH_INDEX[prev.name];
  const monthBranch = BRANCHES[(2 + monthIdx) % 12]; // 寅부터
  const monthStemIdx = ((yearStemIdx % 5) * 2 + 2 + monthIdx) % 10; // 오호둔
  const monthPillar = STEMS[monthStemIdx] + monthBranch;

  // 4) 진태양시 보정 (엔진 applyTrueSolarTime과 동일 산식 재현)
  const normKst = new Date(birthUtcMs + KST_MS);
  const n = dayOfYear(normKst.getUTCFullYear(), normKst.getUTCMonth() + 1, normKst.getUTCDate());
  const adjMin = 4 * (SEOUL_LONGITUDE - 135) + equationOfTimeMinutes(n);
  const adjKst = new Date(birthUtcMs + adjMin * 60000 + KST_MS);
  const ay = adjKst.getUTCFullYear();
  const am = adjKst.getUTCMonth() + 1;
  const ad = adjKst.getUTCDate();
  const ah = adjKst.getUTCHours();
  const ami = adjKst.getUTCMinutes();

  // 5) 일주: 진태양시 날짜의 JDN 60갑자. 야자시(23시대)에도 일주는 당일 유지(sect=2 유파).
  const adjJdn = gregorianToJdn(ay, am, ad);
  const dayIdx = dayCycleIndex(adjJdn);
  const dayPillar = pillarFromCycle(dayIdx);

  // 6) 시주: 시지 2시간 블록(23시 경계) + 오서둔. 야자시 시간(干)은 익일 일간 기준.
  const hourBranchIdx = Math.floor((ah * 60 + ami + 60) / 120) % 12;
  const hourBaseStemIdx = dayCycleIndex(ah === 23 ? adjJdn + 1 : adjJdn) % 10;
  const hourStemIdx = ((hourBaseStemIdx % 5) * 2 + hourBranchIdx) % 10;
  const hourPillar = STEMS[hourStemIdx] + BRANCHES[hourBranchIdx];

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    minutesToNearestJeol: minDist / 60000,
    nearestJeolPatched: nearest.patched,
  };
};
