import { describe, test, expect } from 'vitest';
import {
  YAJASI_MODE,
  SEOUL_LONGITUDE,
  STANDARD_MERIDIAN_KST,
  JIEQI_BOUNDARY_HOURS,
  getKstNormalizationOffsetMinutes,
  POLICY_SNAPSHOT,
} from './policy';

describe('manseryeok policy — 확정 상수', () => {
  test('D-1-1 야자시 유지', () => {
    expect(YAJASI_MODE).toBe('yajasi');
  });

  test('D-1-2 서울 경도 126.9784°', () => {
    expect(SEOUL_LONGITUDE).toBeCloseTo(126.9784, 4);
  });

  test('KST 표준 자오선 135°', () => {
    expect(STANDARD_MERIDIAN_KST).toBe(135);
  });

  test('절입 경계 판정 창 24시간', () => {
    expect(JIEQI_BOUNDARY_HOURS).toBe(24);
  });

  test('스냅샷은 요약 정보를 포함한다', () => {
    expect(POLICY_SNAPSHOT.yajasi).toBe('yajasi');
    expect(POLICY_SNAPSHOT.gmt830PeriodCount).toBe(2);
    expect(POLICY_SNAPSHOT.dstPeriodCount).toBe(12);
  });
});

describe('getKstNormalizationOffsetMinutes — 표준시/DST 정규화', () => {
  test('post-1961 평시 GMT+9는 오프셋 0', () => {
    expect(getKstNormalizationOffsetMinutes(1970, 1, 15)).toBe(0);
    expect(getKstNormalizationOffsetMinutes(2020, 6, 15)).toBe(0);
    expect(getKstNormalizationOffsetMinutes(2000, 12, 31)).toBe(0);
  });

  test('일제기 GMT+9는 오프셋 0 (한국이 일본 표준시 강제 사용)', () => {
    expect(getKstNormalizationOffsetMinutes(1920, 3, 1)).toBe(0);
    expect(getKstNormalizationOffsetMinutes(1954, 3, 20)).toBe(0);
  });

  test('GMT+8:30 재도입기 (1954-03-21 ~ 1961-08-09)는 +30분', () => {
    expect(getKstNormalizationOffsetMinutes(1954, 3, 21)).toBe(30);
    expect(getKstNormalizationOffsetMinutes(1958, 1, 15)).toBe(30);
    expect(getKstNormalizationOffsetMinutes(1961, 8, 9)).toBe(30);
  });

  test('GMT+9 재조정 이후 (1961-08-10~)는 다시 0', () => {
    expect(getKstNormalizationOffsetMinutes(1961, 8, 10)).toBe(0);
    expect(getKstNormalizationOffsetMinutes(1962, 1, 1)).toBe(0);
  });

  test('대한제국 GMT+8:30 (1908-04-01 ~ 1911-12-31)는 +30분', () => {
    expect(getKstNormalizationOffsetMinutes(1908, 4, 1)).toBe(30);
    expect(getKstNormalizationOffsetMinutes(1910, 6, 15)).toBe(30);
    expect(getKstNormalizationOffsetMinutes(1911, 12, 31)).toBe(30);
  });

  test('DST 단독 기간 (1987 여름)은 -60분 (GMT+9)', () => {
    expect(getKstNormalizationOffsetMinutes(1987, 5, 10)).toBe(-60);
    expect(getKstNormalizationOffsetMinutes(1987, 7, 15)).toBe(-60);
    expect(getKstNormalizationOffsetMinutes(1987, 10, 11)).toBe(-60);
  });

  test('DST 시행 전날/다음날 경계는 0', () => {
    expect(getKstNormalizationOffsetMinutes(1987, 5, 9)).toBe(0);
    expect(getKstNormalizationOffsetMinutes(1987, 10, 12)).toBe(0);
  });

  test('GMT+8:30 + DST 중첩 (1955 여름)은 +30 + -60 = -30분', () => {
    expect(getKstNormalizationOffsetMinutes(1955, 5, 5)).toBe(-30);
    expect(getKstNormalizationOffsetMinutes(1955, 7, 15)).toBe(-30);
    expect(getKstNormalizationOffsetMinutes(1955, 9, 9)).toBe(-30);
  });

  test('GMT+8:30 + DST 겹치지 않는 봄/가을은 +30분', () => {
    expect(getKstNormalizationOffsetMinutes(1955, 3, 21)).toBe(30);
    expect(getKstNormalizationOffsetMinutes(1955, 12, 15)).toBe(30);
  });

  test('1948 DST는 6월 시작 (5월은 오프셋 없음)', () => {
    expect(getKstNormalizationOffsetMinutes(1948, 5, 31)).toBe(0);
    expect(getKstNormalizationOffsetMinutes(1948, 6, 1)).toBe(-60);
  });
});
