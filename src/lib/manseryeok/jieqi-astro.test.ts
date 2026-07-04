import { describe, test, expect } from 'vitest';
import {
  getSolarTermsForYear,
  solarTermInstant,
  sunApparentLongitude,
  sunApparentLongitudeAtUT,
  deltaTSeconds,
  isMonthBoundaryLongitude,
  toJulianDay,
  fromJulianDay,
  SOLAR_TERM_BY_LONGITUDE,
} from './jieqi-astro';
import kasiData from './data/kasi-jieqi.json';

/** KASI 자체 데이터 오류(독립 천문계산·lunar-javascript로 확인됨) — 정확도 대조에서 제외 */
const KNOWN_KASI_ERRORS = new Set([
  '2011|입동', // KASI 09:26 (실제 ≈03:34, 5.85h 오류)
  '2011|대한', // KASI 2011-01-21 (실제 2011-01-20, 1일 오류)
]);

type KasiTerm = { name: string; date: string; time: string; isMonthBoundary: boolean };
const kasiTerms = (kasiData as any).terms as KasiTerm[];
const kasiByKey: Record<string, KasiTerm> = {};
for (const t of kasiTerms) kasiByKey[`${t.date.slice(0, 4)}|${t.name}`] = t;

const kasiUtcMs = (t: KasiTerm): number => {
  const [y, mo, d] = t.date.split('-').map(Number);
  const [hh, mm] = t.time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, hh, mm, 0) - 9 * 3600 * 1000;
};

describe('jieqi-astro — 절/중기 분류', () => {
  test('절(節)은 태양황경 mod 30 === 15', () => {
    expect(isMonthBoundaryLongitude(315)).toBe(true); // 입춘
    expect(isMonthBoundaryLongitude(285)).toBe(true); // 소한
    expect(isMonthBoundaryLongitude(15)).toBe(true); // 청명
    expect(isMonthBoundaryLongitude(0)).toBe(false); // 춘분(중기)
    expect(isMonthBoundaryLongitude(300)).toBe(false); // 대한(중기)
  });

  test('절기명↔황경 매핑 24개', () => {
    expect(Object.keys(SOLAR_TERM_BY_LONGITUDE)).toHaveLength(24);
    expect(SOLAR_TERM_BY_LONGITUDE[315]).toBe('입춘');
    expect(SOLAR_TERM_BY_LONGITUDE[0]).toBe('춘분');
  });
});

describe('jieqi-astro — 율리우스일·ΔT', () => {
  test('JD 왕복 변환', () => {
    const d = new Date('2024-06-15T03:00:00.000Z');
    expect(fromJulianDay(toJulianDay(d)).getTime()).toBe(d.getTime());
  });

  test('J2000.0 = JD 2451545.0 (2000-01-01 12:00 UTC)', () => {
    expect(toJulianDay(new Date('2000-01-01T12:00:00.000Z'))).toBeCloseTo(2451545.0, 6);
  });

  test('ΔT 근사값 — 2000년 약 63.8초, 2024년 약 74초', () => {
    expect(deltaTSeconds(2000)).toBeCloseTo(63.8, 0);
    expect(deltaTSeconds(2024)).toBeGreaterThan(70);
    expect(deltaTSeconds(2024)).toBeLessThan(78);
  });

  test('ΔT는 1900~2028 구간에서 대체로 증가', () => {
    expect(deltaTSeconds(2028)).toBeGreaterThan(deltaTSeconds(2005));
    expect(deltaTSeconds(2005)).toBeGreaterThan(deltaTSeconds(1990));
  });
});

describe('jieqi-astro — 태양황경', () => {
  test('황경은 항상 0~360 범위', () => {
    for (const jd of [2451545, 2440000, 2470000]) {
      const l = sunApparentLongitude(jd);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThan(360);
    }
  });

  test('춘분(3월 하순) 무렵 황경 ≈ 0°, 하지(6월 하순) 무렵 ≈ 90°', () => {
    const spring = sunApparentLongitudeAtUT(Date.UTC(2024, 2, 20, 3, 6, 0)); // 2024 춘분 KST 12:06
    const summer = sunApparentLongitudeAtUT(Date.UTC(2024, 5, 21, 0, 51, 0)); // 2024 하지 KST 09:51
    expect(Math.min(spring, 360 - spring)).toBeLessThan(1); // 0° 근처
    expect(Math.abs(summer - 90)).toBeLessThan(1);
  });
});

describe('jieqi-astro — 연도별 절기 구조', () => {
  for (const year of [1901, 1987, 2024, 2029]) {
    test(`${year}년: 24절기, 12절/12중기, 시간순`, () => {
      const terms = getSolarTermsForYear(year);
      expect(terms).toHaveLength(24);
      expect(terms.filter((t) => t.isMonthBoundary)).toHaveLength(12);
      expect(terms.filter((t) => !t.isMonthBoundary)).toHaveLength(12);
      // 시간 단조증가
      for (let i = 1; i < terms.length; i++) {
        expect(terms[i].utc.getTime()).toBeGreaterThan(terms[i - 1].utc.getTime());
      }
      // 모두 해당 KST 연도 안
      for (const t of terms) expect(t.kstDate.slice(0, 4)).toBe(String(year));
      // 첫 절기는 소한, 마지막은 동지
      expect(terms[0].name).toBe('소한');
      expect(terms[23].name).toBe('동지');
    });
  }

  test('solarTermInstant(2024, 315) → 입춘 2024-02-04', () => {
    const ipchun = solarTermInstant(2024, 315);
    expect(ipchun?.name).toBe('입춘');
    expect(ipchun?.kstDate).toBe('2024-02-04');
    expect(ipchun?.isMonthBoundary).toBe(true);
  });
});

describe('jieqi-astro — KASI 대조 정확도 (거친 기준값 역할)', () => {
  test('2000~2028 절기가 KASI와 30분 이내 (KASI 오류 제외)', () => {
    const absMinutes: number[] = [];
    for (let y = 2000; y <= 2028; y++) {
      for (const t of getSolarTermsForYear(y)) {
        const key = `${y}|${t.name}`;
        if (KNOWN_KASI_ERRORS.has(key)) continue;
        const k = kasiByKey[key];
        if (!k) continue;
        absMinutes.push(Math.abs((t.utc.getTime() - kasiUtcMs(k)) / 60000));
      }
    }
    expect(absMinutes.length).toBeGreaterThan(650);
    const max = Math.max(...absMinutes);
    const mean = absMinutes.reduce((s, x) => s + x, 0) / absMinutes.length;
    // 감시자 등급: 평균 ≤10분, 최대 ≤30분이면 회귀 통과.
    expect(mean).toBeLessThan(10);
    expect(max).toBeLessThan(30);
  });

  test('tie-break: astro가 KASI의 알려진 오류 2건을 크게 벗어난다', () => {
    // 2011 입동: KASI 09:26 vs astro ≈03:3x → 5시간 이상 차이
    const ipdong = solarTermInstant(2011, 225)!;
    const kIpdong = kasiByKey['2011|입동'];
    expect(Math.abs((ipdong.utc.getTime() - kasiUtcMs(kIpdong)) / 60000)).toBeGreaterThan(300);
    // 2011 대한: KASI 2011-01-21 vs astro 2011-01-20 → 하루 차이
    const daehan = solarTermInstant(2011, 300)!;
    expect(daehan.kstDate).toBe('2011-01-20');
    const kDaehan = kasiByKey['2011|대한'];
    expect(kDaehan.date).toBe('2011-01-21'); // KASI 원본은 오류값
  });
});
