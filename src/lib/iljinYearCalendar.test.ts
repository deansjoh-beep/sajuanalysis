import { describe, expect, it } from 'vitest';
import { buildIljinCalendarHtml, buildIljinYearCalendarHtml, getMonthIljin, getYearIljin } from './iljinCalendar';
import type { MyeongsikParams } from './buildMyeongsik';

// 연간(12p) 일진 캘린더 — 2027 신년운세 구매자 부가 제공분.
// 픽스처는 iljinCalendar.test.ts의 SINHAE와 동일 (1972-01-21 여성, 辛亥 일주, 대운수 5 순행).
const SINHAE: MyeongsikParams = {
  pillars: { year: '辛亥', month: '辛丑', day: '辛亥', hour: '癸巳' },
  gender: 'female',
  daeunsu: 5,
  daeunDirection: 'forward',
  birthYear: 1972,
  timeUnknown: false,
};

describe('getYearIljin', () => {
  it('1월부터 12월까지 열두 달을 순서대로, 전부 컨텍스트 모드로 돌려준다', () => {
    const months = getYearIljin(2027, SINHAE);
    expect(months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(months.every((m) => m.year === 2027 && m.contextual)).toBe(true);
    // 2027년은 丁未년 — 입춘 이후 달은 세운이 丁未 하나다
    expect(months[5].context!.seun).toEqual(['丁未']);
  });

  it('달마다 날짜 수가 그 달의 길이와 같다 (2027년은 평년)', () => {
    const lens = getYearIljin(2027, '辛亥').map((m) => m.days.length);
    expect(lens).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });
});

describe('buildIljinYearCalendarHtml', () => {
  const html = buildIljinYearCalendarHtml(2027, SINHAE, 'XM-PCYSFG');

  it('한 문서(HTML 1개)에 열두 장이 들어가고 장 번호가 붙는다', () => {
    expect(html.match(/<!DOCTYPE html>/g)).toHaveLength(1);
    expect(html.match(/<section class="page">/g)).toHaveLength(12);
    for (let m = 1; m <= 12; m++) expect(html).toContain(`2027년 ${m}월 일진 캘린더`);
    expect(html).toContain('1 / 12');
    expect(html).toContain('12 / 12');
  });

  it('장마다 인쇄 페이지를 나눈다 (page-break)', () => {
    expect(html).toContain('.page { page-break-after: always; }');
    expect(html).toContain('@page { size: A4 landscape;');
  });

  it('일주·코드·반영된 운은 표기하되 생년월일 원문은 없다 (2-4 원칙)', () => {
    expect(html).toContain('辛亥(');
    expect(html).toContain('사주 코드 XM-PCYSFG');
    expect(html).toContain('세운 丁未');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(html).not.toContain('생년월일');
    expect(html).not.toContain('1972');
  });

  it('월 캘린더(1장)는 같은 페이지 본문을 한 장만 담는다 (리팩터 회귀)', () => {
    const single = buildIljinCalendarHtml(getMonthIljin(2027, 3, SINHAE), '辛亥', 'XM-PCYSFG');
    expect(single.match(/<section class="page">/g)).toHaveLength(1);
    expect(single).toContain('2027년 3월 일진 캘린더');
    expect(single).not.toContain(' / 12');
  });

  it('api/generate-pdf 본문 한도(4MB) 안에 들어온다', () => {
    expect(html.length).toBeLessThan(4_000_000);
  });
});
