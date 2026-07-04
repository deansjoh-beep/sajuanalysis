import { describe, test, expect } from 'vitest';
import { getWolunData, getCurrentWolun, getSeunGanzhi, type WolunMonth } from './wolun';
import { getSajuData } from '../../utils/saju';
import kasiData from './data/kasi-jieqi.json';

/** KST 벽시계 → 실제 UTC epoch millis */
const kstMs = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600 * 1000;

describe('getSeunGanzhi — 세운 간지', () => {
  test('앵커 연도', () => {
    expect(getSeunGanzhi(1984).ganzhi).toBe('甲子'); // 육십갑자 시작 앵커
    expect(getSeunGanzhi(2025).ganzhi).toBe('乙巳');
    expect(getSeunGanzhi(2026).ganzhi).toBe('丙午');
  });
});

describe('getWolunData — 월운 12개 (절입 기준)', () => {
  const months2026 = getWolunData(2026);

  test('2026(丙午)년 월 간지 시퀀스 — 오호둔', () => {
    expect(months2026.map((m) => m.ganzhi)).toEqual([
      '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未',
      '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑',
    ]);
  });

  test('구간 불변식: 12개, 寅→丑, 절 시퀀스, 빈틈 없는 연속 구간', () => {
    expect(months2026).toHaveLength(12);
    expect(months2026[0].jeolName).toBe('입춘');
    expect(months2026[11].jeolName).toBe('소한');
    expect(months2026[0].branch).toBe('寅');
    expect(months2026[11].branch).toBe('丑');
    for (let i = 0; i < 11; i++) {
      expect(months2026[i].endUtcMs).toBe(months2026[i + 1].startUtcMs);
      expect(months2026[i].startUtcMs).toBeLessThan(months2026[i].endUtcMs);
    }
  });

  test('절입 시각이 KASI 실측과 ±2분 이내', () => {
    const kasiUtcMs = new Map<string, number>();
    for (const t of (kasiData as any).terms as Array<{ name: string; date: string; time: string; isMonthBoundary: boolean }>) {
      if (!t.isMonthBoundary) continue;
      const [y, mo, d] = t.date.split('-').map(Number);
      const [hh, mm] = t.time.split(':').map(Number);
      kasiUtcMs.set(`${y}|${t.name}`, Date.UTC(y, mo - 1, d, hh, mm) - 9 * 3600 * 1000);
    }
    for (const m of months2026) {
      const year = m.index <= 11 ? 2026 : 2027; // 소한만 이듬해
      const kasi = kasiUtcMs.get(`${year}|${m.jeolName}`);
      expect(kasi, `${year} ${m.jeolName}`).toBeDefined();
      expect(Math.abs(m.startUtcMs - (kasi as number)), `${year} ${m.jeolName}`).toBeLessThanOrEqual(2 * 60000);
    }
    // 마지막 달의 끝 = 입춘(2027)
    const nextIpchun = kasiUtcMs.get('2027|입춘') as number;
    expect(Math.abs(months2026[11].endUtcMs - nextIpchun)).toBeLessThanOrEqual(2 * 60000);
  });

  test('KASI 커버리지 밖 연도(1970, 2030)도 산출된다', () => {
    for (const y of [1970, 2030]) {
      const ms = getWolunData(y);
      expect(ms).toHaveLength(12);
      expect(ms[0].jeolName).toBe('입춘');
      expect(new Date(ms[0].startUtcMs + 9 * 3600 * 1000).getUTCFullYear()).toBe(y);
    }
  });
});

describe('월운 ↔ 엔진 월주 정합', () => {
  const pillarAt = (dateStr: string, timeStr: string) => {
    const res = getSajuData(dateStr, timeStr, false, false, false, 'Asia/Seoul');
    return `${res[2].stem.hanja}${res[2].branch.hanja}`; // 월주
  };

  const wolunAt = (utcMs: number): WolunMonth => {
    const { wolun } = getCurrentWolun(new Date(utcMs));
    return wolun;
  };

  test('월 중순 샘플: 엔진 월주 == 해당 시점 월운 간지', () => {
    const samples: Array<[number, number, number]> = [
      [2026, 3, 15], [2026, 6, 20], [2026, 9, 10], [2026, 12, 25], [2027, 1, 20],
    ];
    for (const [y, mo, d] of samples) {
      const engine = pillarAt(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, '12:00');
      const wolun = wolunAt(kstMs(y, mo, d, 12, 0));
      expect(engine, `${y}-${mo}-${d}`).toBe(wolun.ganzhi);
    }
  });

  test('절입 경계 ±5분에서 월운 전환이 엔진과 일치', () => {
    const months = getWolunData(2026);
    const p = (n: number) => String(n).padStart(2, '0');
    for (const m of [months[0], months[5], months[11]]) { // 입춘·소서·소한
      for (const off of [-5, 5]) {
        const t = m.startUtcMs + off * 60000;
        const k = new Date(t + 9 * 3600 * 1000);
        const engine = pillarAt(
          `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}`,
          `${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`,
        );
        const wolun = wolunAt(t);
        expect(engine, `${m.jeolName} ${off >= 0 ? '+' : ''}${off}분`).toBe(wolun.ganzhi);
      }
    }
  });
});

describe('getCurrentWolun — 조회 시점 기준', () => {
  test('입춘 전 1월은 전년 사주 연도의 丑월', () => {
    const r = getCurrentWolun(new Date(kstMs(2026, 1, 15, 12, 0)));
    expect(r.sajuYear).toBe(2025);
    expect(r.seun.ganzhi).toBe('乙巳');
    expect(r.wolun.ganzhi).toBe('己丑'); // 乙년 오호둔 → 丑월 己丑
    expect(r.wolun.jeolName).toBe('소한');
  });

  test('입춘 이후는 당해 사주 연도', () => {
    const r = getCurrentWolun(new Date(kstMs(2026, 8, 15, 12, 0)));
    expect(r.sajuYear).toBe(2026);
    expect(r.seun.ganzhi).toBe('丙午');
    expect(r.wolun.ganzhi).toBe('丙申'); // 입추~백로
    expect(r.months).toHaveLength(12);
  });
});
