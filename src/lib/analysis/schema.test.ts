import { describe, test, expect } from 'vitest';
import { buildSajuAnalysis } from './schema';
import { getCurrentWolun } from '../manseryeok/wolun';
import { getDaeunData } from '../../utils/saju';

// 고정 조회 시점(결정론). 2026-07-04 12:00 KST = 2026-07-04T03:00:00Z
const AS_OF = new Date('2026-07-04T03:00:00.000Z');

const baseInput = {
  dateStr: '1969-10-23',
  timeStr: '10:00',
  isLunar: true,
  isLeap: false,
  gender: 'M' as const,
  asOfDate: AS_OF,
};

describe('buildSajuAnalysis — 명식·일간·오행', () => {
  const a = buildSajuAnalysis(baseInput);

  test('명식 8자: 년월일시 순 간지', () => {
    expect(a.myeongsik.map((p) => p.position)).toEqual(['년주', '월주', '일주', '시주']);
    expect(a.myeongsik.map((p) => p.ganzhi)).toEqual(['己酉', '乙亥', '辛亥', '癸巳']);
  });

  test('일간 辛(금), 일주 stem 십신은 일간', () => {
    expect(a.dayMaster).toEqual({ hanja: '辛', hangul: '신', element: 'metal' });
    const day = a.myeongsik.find((p) => p.position === '일주')!;
    expect(day.stem!.sipsin).toBe('일간');
  });

  test('오행 분포(가시 8자) 합 8, 수3·금2', () => {
    const sum = Object.values(a.ohaeng).reduce((s, x) => s + x, 0);
    expect(sum).toBe(8);
    expect(a.ohaeng.water).toBe(3);
    expect(a.ohaeng.metal).toBe(2);
  });

  test('지지 지장간·십이운성·십신 채워짐', () => {
    const month = a.myeongsik.find((p) => p.position === '월주')!;
    expect(month.branch!.hiddenStems.length).toBeGreaterThan(0);
    expect(typeof month.branch!.sibiUnseong).toBe('string');
    expect(typeof month.branch!.sipsin).toBe('string');
  });
});

describe('buildSajuAnalysis — 대운·세운·월운', () => {
  const a = buildSajuAnalysis(baseInput);

  test('대운 10개, 현재 대운은 조회연도 포함 구간', () => {
    expect(a.daeun).toHaveLength(10);
    const cur = a.currentDaeun;
    expect(cur).not.toBeNull();
    expect(cur!.isCurrent).toBe(true);
    // 현재 대운 startYear <= 2026, 다음 대운 startYear > 2026
    const idx = a.daeun.findIndex((d) => d.isCurrent);
    expect(a.daeun[idx].startYear).toBeLessThanOrEqual(2026);
    if (idx + 1 < a.daeun.length) expect(a.daeun[idx + 1].startYear).toBeGreaterThan(2026);
    // isCurrent는 정확히 1개
    expect(a.daeun.filter((d) => d.isCurrent)).toHaveLength(1);
  });

  test('대운 원본(getDaeunData)과 간지 일치', () => {
    const raw = getDaeunData('1969-10-23', '10:00', true, false, 'M', false, 'Asia/Seoul');
    expect(a.daeun.map((d) => d.ganzhi)).toEqual(raw.map((d) => `${d.stem}${d.branch}`));
  });

  test('세운·월운은 getCurrentWolun(asOf)과 정합', () => {
    const cur = getCurrentWolun(AS_OF);
    expect(a.seun.sajuYear).toBe(cur.sajuYear);
    expect(a.seun.ganzhi).toBe(cur.seun.ganzhi);
    expect(a.wolun).toHaveLength(12);
    expect(a.currentWolunIndex).toBe(cur.wolun.index);
    const curMonth = a.wolun.find((m) => m.isCurrent)!;
    expect(curMonth.ganzhi).toBe(cur.wolun.ganzhi);
    expect(a.wolun.filter((m) => m.isCurrent)).toHaveLength(1);
  });

  test('세운 간지의 십신은 일간 대비로 계산', () => {
    // 辛 일간 vs 세운 丙(2026 丙午): 丙 화가 辛 금을 극 → 정관/편관
    expect(a.seun.ganzhi).toBe('丙午');
    expect(['정관', '편관']).toContain(a.seun.sipsin);
  });
});

describe('buildSajuAnalysis — 공망·신살·합충·격국용신', () => {
  const a = buildSajuAnalysis(baseInput);

  test('공망: 일주 기준 단일(기준서 A-6) — 辛亥일(甲辰旬) → 寅卯 공망, 원국 해당 없음', () => {
    expect(a.gongmang.branches).toEqual(['寅', '卯']);
    expect(a.gongmang.natalHits).toEqual([]);
    expect(typeof a.gongmang.seunInGongmang).toBe('boolean');
  });

  test('신살은 구조화 배열(연지 12신살 + 일간 귀인)', () => {
    expect(Array.isArray(a.shinsal)).toBe(true);
    for (const s of a.shinsal) {
      expect(['원국', '세운', '월운']).toContain(s.scope);
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  test('합충 이벤트는 태그 배열, 관여 2곳 포함', () => {
    expect(Array.isArray(a.hapChungEvents)).toBe(true);
    for (const e of a.hapChungEvents) {
      expect(e.between).toHaveLength(2);
      expect(e.tag.length).toBeGreaterThan(0);
    }
  });

  test('격국용신은 provisional(널 허용 예약 필드에 값 채움)', () => {
    expect(a.gyeokYongshin).not.toBeNull();
    expect(a.gyeokYongshin!.provisional).toBe(true);
    expect(a.gyeokYongshin!.gyeok.name).toBe('상관격');
    expect(a.provisionalNote).toContain('잠정');
    expect(a.meta.manseryeokVerified).toBe(true);
  });

  test('절입 경계 플래그 노출', () => {
    expect(typeof a.nearJieqiBoundary).toBe('boolean');
    expect(a.minHoursToJieqi === null || typeof a.minHoursToJieqi === 'number').toBe(true);
  });
});

describe('buildSajuAnalysis — 견고성', () => {
  test('시간 미상: 시주 stem/branch null, ganzhi ??', () => {
    const a = buildSajuAnalysis({ ...baseInput, unknownTime: true });
    const hour = a.myeongsik.find((p) => p.position === '시주')!;
    expect(hour.ganzhi).toBe('??');
    expect(hour.stem).toBeNull();
    expect(hour.branch).toBeNull();
    // 오행 분포는 시주 제외 6자 → 합 6
    expect(Object.values(a.ohaeng).reduce((s, x) => s + x, 0)).toBe(6);
  });

  test('결정론: 동일 입력+동일 asOf → deep equal', () => {
    expect(buildSajuAnalysis(baseInput)).toEqual(buildSajuAnalysis(baseInput));
  });
});
