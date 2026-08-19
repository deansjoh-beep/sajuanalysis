import { describe, expect, it } from 'vitest';
import { buildIljinCalendarHtml, getMonthIljin } from './iljinCalendar';
import type { MyeongsikParams } from './buildMyeongsik';

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

// ─────────────────────────────────────────────────────────────────────────────
// 컨텍스트 모드 — 원국(강약·용신) + 대운·세운·월운을 등급에 반영한다.
//
// 고정 명식: 1972-01-21 여성 → 원국 辛亥 辛丑 辛亥 癸巳 (辛亥 일주),
// 2026년 대운 丙午 · 세운 丙午. 사용자 제보(사주코드 XM-PCYSFG, 辛亥 일주)에서
// 2026-09-29 丙午일이 최고 등급으로 나온다고 지적된 조건을 그대로 재현한 것이다.
// ─────────────────────────────────────────────────────────────────────────────

const SINHAE: MyeongsikParams = {
  pillars: { year: '辛亥', month: '辛丑', day: '辛亥', hour: '癸巳' },
  gender: 'female',
  daeunsu: 5,
  daeunDirection: 'forward',
  birthYear: 1972,
  timeUnknown: false,
};

describe('getMonthIljin — 운 반영', () => {
  it('일주 문자열만 주면 샘플 모드다 (원국·운 미반영)', () => {
    const m = getMonthIljin(2026, 9, '辛亥');
    expect(m.contextual).toBe(false);
    expect(m.context).toBeNull();
  });

  it('명식을 주면 대운·세운·월운을 산출해 컨텍스트로 돌려준다', () => {
    const m = getMonthIljin(2026, 9, SINHAE);
    expect(m.contextual).toBe(true);
    // 대운수 5 · 순행 · 월주 辛丑 → 2026년(54세) 대운은 여섯 번째 구간 丙午
    expect(m.context!.daeun).toBe('丙午');
    expect(m.context!.seun).toEqual(['丙午']);
    // 2026-09는 백로(9/7) 절입 — 丙申월과 丁酉월이 함께 걸린다
    expect(m.context!.wolun).toEqual(['丙申', '丁酉']);
  });

  it('대운 간지는 사용자 입력 없이 저장된 명식에서만 나온다', () => {
    // daeunsu·대운 방향·월주만으로 결정된다 — 별도 입력란이 필요 없다는 근거
    const younger = getMonthIljin(2026, 9, { ...SINHAE, birthYear: 1992 });
    expect(younger.context!.daeun).toBe('甲辰');
    expect(younger.context!.daeun).not.toBe(getMonthIljin(2026, 9, SINHAE).context!.daeun);
  });

  it('오행이 과다 누적되면 길신이 겹쳐도 등급을 올리지 않는다 (제보 사례 2026-09-29 丙午)', () => {
    const before = getMonthIljin(2026, 9, '辛亥').days.find((d) => d.day === 29)!;
    const after = getMonthIljin(2026, 9, SINHAE).days.find((d) => d.day === 29)!;

    expect(before.ganji).toBe('丙午');
    // 기존: 丙辛합 +1, 천을귀인 +1이 그대로 누적돼 최고 등급
    expect(before.rating).toBe('◎◎');
    // 개선: 대운 午 + 세운 丙午 + 일진 丙午로 火 과다 → 가산 취소 + 하향
    expect(after.rating).not.toBe('◎◎');
    expect(after.note).toContain('화과다');
  });

  it('과다로 가산이 취소되면 해설에 용신을 길한 표시로 남기지 않는다', () => {
    const m = getMonthIljin(2026, 9, SINHAE);
    for (const d of m.days) {
      if (d.note.includes('과다')) expect(d.note).not.toContain('용신');
    }
  });

  it('대운·세운 지지가 같으면 충을 한 번만 센다', () => {
    // 2026-09-11 戊子 — 대운 午·세운 午가 모두 子午충이지만 감점은 1회여야 한다
    const m = getMonthIljin(2026, 9, SINHAE);
    const day = m.days.find((d) => d.day === 11)!;
    expect(day.ganji).toBe('戊子');
    expect(day.note).toContain('대운충');
    expect(day.note).not.toContain('세운충');
  });

  it('12일 주기 반복이 깨진다 (같은 지지라도 등급·해설이 달라진다)', () => {
    const sample = getMonthIljin(2026, 9, '辛亥').days;
    const ctx = getMonthIljin(2026, 9, SINHAE).days;
    const at = (arr: typeof sample, day: number) => arr.find((d) => d.day === day)!;

    // 午일 3회: 5일 壬午 · 17일 甲午 · 29일 丙午
    for (const [a, b] of [[5, 17], [17, 29], [5, 29]] as const) {
      expect(at(sample, a).ganji.charAt(1)).toBe(at(sample, b).ganji.charAt(1));
    }
    const ratings = new Set([at(ctx, 5).rating, at(ctx, 17).rating, at(ctx, 29).rating]);
    expect(ratings.size).toBeGreaterThan(1);
  });

  it('등급은 컨텍스트 모드에서도 허용 어휘만 사용한다', () => {
    const allowed = new Set(['◎◎', '◎', '○', '△', '▲', '▲▲']);
    const m = getMonthIljin(2026, 9, SINHAE);
    for (const d of m.days) {
      expect(allowed.has(d.rating)).toBe(true);
      expect(d.note.length).toBeGreaterThan(0);
    }
  });

  it('같은 명식이면 항상 같은 결과 (결정적)', () => {
    expect(getMonthIljin(2026, 9, SINHAE)).toEqual(getMonthIljin(2026, 9, SINHAE));
  });

  it('과다 경고가 달을 뒤덮지 않고, 쓸 날이 남는다 (임계값 7 확정 — decisions.md 2026-08-20)', () => {
    // 임계값이 5 이하로 내려가면 경고가 과반을 넘고 길일이 0인 달이 생겨 캘린더가 기능을 잃는다.
    // 이 명식은 2026년 대운 丙午 · 세운 丙午로 火가 가장 몰리는 조건이라 상한 검증에 적합하다.
    for (const month of [3, 6, 9, 12]) {
      const days = getMonthIljin(2026, month, SINHAE).days;
      const excess = days.filter((d) => d.note.includes('과다')).length;
      const good = days.filter((d) => ['◎◎', '◎', '○'].includes(d.rating)).length;
      expect(excess).toBeLessThan(days.length / 2);
      expect(good).toBeGreaterThan(0);
    }
  });
});

describe('buildIljinCalendarHtml — 운 반영 표기', () => {
  it('반영된 대운·세운을 표기하되 생년월일 원문은 없다', () => {
    const m = getMonthIljin(2026, 9, SINHAE);
    const html = buildIljinCalendarHtml(m, '辛亥', 'XM-PCYSFG');
    expect(html).toContain('대운 丙午');
    expect(html).toContain('세운 丙午');
    expect(html).toContain('대운·세운·월운');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(html).not.toContain('생년월일');
    expect(html).not.toContain('1972');
  });

  it('샘플 모드에서는 운 표기를 하지 않는다', () => {
    const html = buildIljinCalendarHtml(getMonthIljin(2026, 9, '辛亥'), '辛亥', 'HW-3F9K2A');
    expect(html).not.toContain('대운');
    expect(html).not.toContain('세운');
  });
});
