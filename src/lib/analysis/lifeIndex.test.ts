/**
 * 인생 100년 지수 엔진 스펙 — 유료 열람 탭(CodeLookupTab)에 붙는 재물·인연·관운·건강 4지수.
 * 외부 참고 서비스와의 수치 일치를 목표로 하지 않는다(§lifeIndex.ts 헤더 참고) — 이 테스트는
 * ①구조적 정합성(길이·나이·연도·대운 경계) ②시간 미상·잘못된 명식 방어 ③회귀 방지(스냅샷)를 검증한다.
 */
import { describe, test, expect } from 'vitest';
import { computeLifeIndices, summarizeLifeIndexPeaks, type LifeIndexKey } from './lifeIndex';
import type { MyeongsikParams } from '../buildMyeongsik';

const baseMyeongsik: MyeongsikParams = {
  pillars: { year: '丙戌', month: '戊戌', day: '戊午', hour: '丁巳' },
  gender: 'male',
  daeunsu: 3,
  daeunDirection: 'forward',
  birthYear: 1990,
  timeUnknown: false,
};

const KEYS: LifeIndexKey[] = ['wealth', 'love', 'career', 'health'];
const GANZHI_RE = /^(甲|乙|丙|丁|戊|己|庚|辛|壬|癸)(子|丑|寅|卯|辰|巳|午|未|申|酉|戌|亥)$/;

describe('computeLifeIndices — 구조적 정합성', () => {
  test('0~99세, 100개 포인트를 나이순으로 반환한다', () => {
    const points = computeLifeIndices(baseMyeongsik);
    expect(points).toHaveLength(100);
    points.forEach((p, i) => {
      expect(p.age).toBe(i);
      expect(p.year).toBe(baseMyeongsik.birthYear + i);
    });
  });

  test('모든 지수 값은 유한한 숫자다(NaN·Infinity 없음)', () => {
    const points = computeLifeIndices(baseMyeongsik);
    for (const p of points) {
      for (const k of KEYS) {
        expect(Number.isFinite(p[k])).toBe(true);
      }
    }
  });

  test('대운수 이전은 대운 미배정(null), 이후는 배정된다', () => {
    const points = computeLifeIndices(baseMyeongsik);
    for (let age = 0; age < baseMyeongsik.daeunsu; age++) {
      expect(points[age].daeunGanzhi).toBeNull();
    }
    for (let age = baseMyeongsik.daeunsu; age < 100; age++) {
      expect(points[age].daeunGanzhi).not.toBeNull();
      expect(points[age].daeunGanzhi).toMatch(GANZHI_RE);
    }
  });

  test('세운 간지는 항상 2자 간지 형식이다', () => {
    const points = computeLifeIndices(baseMyeongsik);
    for (const p of points) {
      expect(p.seunGanzhi).toMatch(GANZHI_RE);
    }
  });

  test('역행 대운도 동일하게 100개 포인트를 만든다', () => {
    const points = computeLifeIndices({ ...baseMyeongsik, daeunDirection: 'backward', gender: 'female' });
    expect(points).toHaveLength(100);
    expect(points[50].daeunGanzhi).not.toBeNull();
  });
});

describe('computeLifeIndices — 시간 미상·방어', () => {
  test('시간 미상이면 시주 없이도 100개 포인트를 계산한다', () => {
    const points = computeLifeIndices({ ...baseMyeongsik, pillars: { ...baseMyeongsik.pillars, hour: null }, timeUnknown: true });
    expect(points).toHaveLength(100);
    points.forEach((p) => KEYS.forEach((k) => expect(Number.isFinite(p[k])).toBe(true)));
  });

  test('잘못된 명식(간지 파싱 불가)은 빈 배열을 반환한다', () => {
    const points = computeLifeIndices({ ...baseMyeongsik, pillars: { year: '??', month: '??', day: '??', hour: null } });
    expect(points).toEqual([]);
  });
});

describe('summarizeLifeIndexPeaks — 사용자 적용 단락', () => {
  const points = computeLifeIndices(baseMyeongsik);

  for (const key of KEYS) {
    test(`${key}: 최고·최저 구간이 유효한 나이 범위와 비어있지 않은 문장을 만든다`, () => {
      const summary = summarizeLifeIndexPeaks(points, key, 35);
      expect(summary).not.toBeNull();
      const { high, low } = summary!;
      expect(high.ageStart).toBeLessThanOrEqual(high.ageEnd);
      expect(low.ageStart).toBeLessThanOrEqual(low.ageEnd);
      expect(high.sentence.length).toBeGreaterThan(0);
      expect(low.sentence.length).toBeGreaterThan(0);
      expect(low.ageStart).toBeGreaterThanOrEqual(35);
    });
  }

  test('빈 포인트 배열이면 null을 반환한다', () => {
    expect(summarizeLifeIndexPeaks([], 'wealth')).toBeNull();
  });
});

describe('회귀 방지 스냅샷', () => {
  test('고정 명식의 재물·건강 지수 곡선(10년 간격)', () => {
    const points = computeLifeIndices(baseMyeongsik);
    const sampled = points.filter((p) => p.age % 10 === 0).map((p) => ({
      age: p.age, daeun: p.daeunGanzhi, wealth: p.wealth, love: p.love, career: p.career, health: p.health,
    }));
    expect(sampled).toMatchSnapshot();
  });
});
