import { describe, expect, it } from 'vitest';
import { buildIljinCalendarHtml, getMonthIljin } from './iljinCalendar';

// 앵커: 2026-08-01 = 丁未일, 2026년 8월은 입추(8/7)로 丙申월 절입 (일진 캘린더 스킬 예시와 동일)
describe('getMonthIljin', () => {
  it('2026년 8월 일진 간지 앵커가 맞다', () => {
    const m = getMonthIljin(2026, 8, '壬子');
    expect(m.days).toHaveLength(31);
    expect(m.days[0].ganji).toBe('丁未');
    expect(m.days[0].ganjiHangul).toBe('정미');
    // 60갑자 순환: 8/1 丁未 → 8/31 丁丑
    expect(m.days[30].ganji).toBe('丁丑');
  });

  it('절입 정보를 양력 월 기준으로 찾는다 (2026-08 = 입추 8/7, 丙申월)', () => {
    const m = getMonthIljin(2026, 8, '壬子');
    expect(m.jeolip).not.toBeNull();
    expect(m.jeolip!.name).toBe('입추');
    expect(m.jeolip!.day).toBe(7);
    expect(m.jeolip!.ganzhi).toBe('丙申');
  });

  it('십성은 일간 기준으로 계산된다 (壬 일간 vs 丁 = 정재)', () => {
    const m = getMonthIljin(2026, 8, '壬子');
    expect(m.days[0].sipsin.startsWith('정재')).toBe(true);
  });

  it('천간합 태그가 등급을 올린다 (壬 일간 + 丁 천간 = 丁壬합)', () => {
    const m = getMonthIljin(2026, 8, '壬子');
    expect(m.days[0].note).toContain('천간합');
  });

  it('등급은 허용 어휘만 사용한다', () => {
    const allowed = new Set(['◎◎', '◎', '○', '△', '▲', '▲▲']);
    const m = getMonthIljin(2026, 8, '甲子');
    for (const d of m.days) expect(allowed.has(d.rating)).toBe(true);
  });

  it('같은 입력이면 항상 같은 결과 (결정적)', () => {
    const a = getMonthIljin(2026, 8, '辛亥');
    const b = getMonthIljin(2026, 8, '辛亥');
    expect(a).toEqual(b);
  });

  it('복음일(일주와 동일 간지)은 평(△)으로 고정된다', () => {
    // 2026-08-01 = 丁未 → 丁未 일주면 그날이 복음
    const m = getMonthIljin(2026, 8, '丁未');
    expect(m.days[0].rating).toBe('△');
    expect(m.days[0].note).toContain('복음');
  });

  it('모든 날에 해설이 있다', () => {
    const m = getMonthIljin(2026, 8, '庚午');
    for (const d of m.days) expect(d.note.length).toBeGreaterThan(0);
  });
});

describe('buildIljinCalendarHtml', () => {
  it('일주·코드·절입·범례를 표기하고 생년월일 원문은 없다', () => {
    const m = getMonthIljin(2026, 8, '辛亥');
    const html = buildIljinCalendarHtml(m, '辛亥', 'HW-3F9K2A');
    expect(html).toContain('2026년 8월 일진 캘린더');
    expect(html).toContain('辛亥');
    expect(html).toContain('HW-3F9K2A');
    expect(html).toContain('입추');
    expect(html).toContain('대길일');
    expect(html).toContain('A4 landscape');
    // 생년월일 형식(YYYY-MM-DD, YYYY년 M월 D일생)은 어디에도 없어야 한다
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(html).not.toContain('생년월일');
  });

  it('31일 달은 6주 병합 규칙으로도 전 일자가 렌더된다', () => {
    // 2026-08은 일요일 시작 6주 그리드 → 마지막 주가 이전 주 칸에 병합(dual)된다
    const m = getMonthIljin(2026, 8, '甲子');
    const html = buildIljinCalendarHtml(m, '甲子', 'AB-CDEFGH');
    for (let d = 1; d <= 31; d++) {
      expect(html).toContain(`>${d}<span`);
    }
    expect(html).toContain('daycell dual');
  });
});
