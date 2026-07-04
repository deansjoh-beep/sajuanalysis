import { describe, test, expect } from 'vitest';
import {
  analyzeGyeokYongshin,
  toLegacyYongshin,
  toLegacyGyeok,
  type OhaengElement,
} from './gyeokyongshin';
import { getSajuData, calculateGyeok, calculateYongshin, elementMap, calculateDeity } from '../../utils/saju';

/** 손수 만드는 pillar (element·deity를 실제 규칙으로 채움) */
const mkPillar = (dayStem: string, ganzhi: string) => {
  const stem = ganzhi[0];
  const branch = ganzhi[1];
  return {
    stem: {
      hanja: stem,
      element: elementMap[stem] as OhaengElement,
      deity: stem === dayStem ? '일간' : calculateDeity(dayStem, stem),
    },
    branch: {
      hanja: branch,
      element: elementMap[branch] as OhaengElement,
      deity: calculateDeity(dayStem, branch, true),
    },
  };
};

/** [시, 일, 월, 년] 순으로 조립 (getSajuData 반환 순서와 동일) */
const mkChart = (dayStem: string, hour: string, day: string, month: string, year: string) =>
  [mkPillar(dayStem, hour), mkPillar(dayStem, day), mkPillar(dayStem, month), mkPillar(dayStem, year)];

describe('analyzeGyeokYongshin — 격국', () => {
  test('실제 명식(상관격): 월지 본기 불투 → 본기로 격 판정', () => {
    const saju = getSajuData('1969-10-23', '10:00', true, false, false, 'Asia/Seoul'); // 己酉 乙亥 辛亥 癸巳
    const r = analyzeGyeokYongshin(saju)!;
    expect(r.gyeok.name).toBe('상관격');
    expect(r.gyeok.transparent).toBe(false); // 亥 본기 壬 불투
    expect(r.gyeok.basisStem).toBe('壬');
    expect(r.gyeok.provisional).toBe(true);
  });

  test('건록격: 월지 본기가 비견(甲 일간 · 寅월) → 건록격', () => {
    // 甲 일간, 월지 寅(지장간 戊丙甲) 모두 불투(천간 乙庚己) → 본기 甲 → 비견 → 건록격
    const chart = mkChart('甲', '乙丑', '甲午', '庚寅', '己巳');
    const r = analyzeGyeokYongshin(chart)!;
    expect(r.gyeok.name).toBe('건록격');
  });

  test('양인격: 월지 본기가 겁재(甲 일간 · 卯월) → 양인격', () => {
    // 甲 일간, 월지 卯(본기 乙), 乙 불투 → 겁재 → 양인격
    const chart = mkChart('甲', '丙寅', '甲午', '己卯', '庚申');
    const r = analyzeGyeokYongshin(chart)!;
    expect(r.gyeok.name).toBe('양인격');
  });

  test('정관격(투간): 월지 본기 辛이 천간에 노출 → transparent', () => {
    // 甲 일간, 월지 酉(본기 辛), 년간 辛 투간 → 정관 → 정관격, transparent
    const chart = mkChart('甲', '甲子', '甲午', '丁酉', '辛未');
    const r = analyzeGyeokYongshin(chart)!;
    expect(r.gyeok.name).toBe('정관격');
    expect(r.gyeok.transparent).toBe(true);
    expect(r.gyeok.basisStem).toBe('辛');
  });
});

describe('analyzeGyeokYongshin — 신강/신약 불변식', () => {
  const charts = [
    getSajuData('1969-10-23', '10:00', true, false, false, 'Asia/Seoul'),
    getSajuData('1990-05-05', '14:30', false, false, false, 'Asia/Seoul'),
    getSajuData('2000-12-21', '03:00', false, false, false, 'Asia/Seoul'),
    getSajuData('1984-02-05', '23:30', false, false, false, 'Asia/Seoul'),
  ];

  test('isStrong ⇔ score>=50, deukse == isStrong, strength 밴드 단조', () => {
    for (const saju of charts) {
      const r = analyzeGyeokYongshin(saju)!;
      const g = r.gangyak;
      expect(g.isStrong).toBe(g.score >= 50);
      expect(g.deukse).toBe(g.isStrong);
      const expectedBand =
        g.score >= 80 ? '극신강' : g.score >= 60 ? '신강' : g.score >= 40 ? '중립' : g.score >= 20 ? '신약' : '극신약';
      expect(g.strength).toBe(expectedBand);
      expect(g.score).toBeGreaterThanOrEqual(0);
      expect(g.score).toBeLessThanOrEqual(100);
    }
  });

  test('득령/득지는 월지/일지 생조 여부와 일치', () => {
    for (const saju of charts) {
      const r = analyzeGyeokYongshin(saju)!;
      const rev = [...saju].reverse(); // [년, 월, 일, 시]
      const monthP = rev[1];
      const dayP = rev[2];
      const meSupport: Record<string, string[]> = {
        wood: ['wood', 'water'], fire: ['fire', 'wood'], earth: ['earth', 'fire'],
        metal: ['metal', 'earth'], water: ['water', 'metal'],
      };
      const sup = meSupport[dayP.stem.element];
      expect(r.gangyak.deukryeong).toBe(sup.includes(monthP.branch.element));
      expect(r.gangyak.deukji).toBe(sup.includes(dayP.branch.element));
    }
  });
});

describe('analyzeGyeokYongshin — 용신(억부·조후)', () => {
  test('한랭월(亥子丑) → 조후 우선, 용신 fire', () => {
    for (const mb of ['亥', '子', '丑']) {
      const chart = mkChart('甲', '甲子', '甲午', `甲${mb}`, '甲午');
      const r = analyzeGyeokYongshin(chart)!;
      expect(r.yongshin.johooStatus).toBe('한랭');
      expect(r.yongshin.johoo).toBe('fire');
      expect(r.yongshin.method).toBe('조후');
      expect(r.yongshin.primary).toBe('fire');
    }
  });

  test('조열월(巳午未) → 조후 우선, 용신 water', () => {
    for (const mb of ['巳', '午', '未']) {
      const chart = mkChart('甲', '甲子', '甲寅', `甲${mb}`, '甲子');
      const r = analyzeGyeokYongshin(chart)!;
      expect(r.yongshin.johooStatus).toBe('조열');
      expect(r.yongshin.johoo).toBe('water');
      expect(r.yongshin.method).toBe('조후');
      expect(r.yongshin.primary).toBe('water');
    }
  });

  test('평온월 → 억부 채택 (신강이면 관성, 신약이면 인성)', () => {
    // 甲 일간, 월지 辰(평온), 강한 목/수 세력 → 신강 → 억부 관성(metal)
    const strong = mkChart('甲', '甲子', '甲辰', '壬辰', '壬子');
    const rs = analyzeGyeokYongshin(strong)!;
    expect(rs.yongshin.johooStatus).toBe('평온');
    expect(rs.yongshin.method).toBe('억부');
    if (rs.gangyak.isStrong) expect(rs.yongshin.primary).toBe('metal');

    // 약한 세력 → 신약 → 억부 인성(water)
    const weak = mkChart('甲', '庚午', '甲辰', '戊戌', '庚申');
    const rw = analyzeGyeokYongshin(weak)!;
    expect(rw.yongshin.method).toBe('억부');
    if (!rw.gangyak.isStrong) expect(rw.yongshin.primary).toBe('water');
  });
});

describe('레거시 어댑터 호환 & 위임', () => {
  const saju = getSajuData('1969-10-23', '10:00', true, false, false, 'Asia/Seoul');

  test('calculateGyeok/calculateYongshin가 어댑터와 동일 결과', () => {
    const r = analyzeGyeokYongshin(saju)!;
    expect(calculateGyeok(saju)).toEqual(toLegacyGyeok(r));
    expect(calculateYongshin(saju)).toEqual(toLegacyYongshin(r));
  });

  test('레거시 yongshin 필드 형태 유지(문자열 오행명·strength·score)', () => {
    const y = calculateYongshin(saju);
    expect(typeof y.yongshin).toBe('string');
    expect(y.yongshin).toMatch(/[목화토금수]\([木火土金水]\)/);
    expect(typeof y.strength).toBe('string');
    expect(typeof y.score).toBe('number');
    expect(['한랭(寒冷)', '조열(燥熱)', '평온']).toContain(y.johooStatus);
  });

  test('레거시 gyeok는 상관격 유지(회귀)', () => {
    expect(calculateGyeok(saju).gyeok).toBe('상관격');
  });
});

describe('견고성', () => {
  test('4주 미만 입력 → null', () => {
    expect(analyzeGyeokYongshin([] as any)).toBeNull();
    expect(analyzeGyeokYongshin([{}, {}] as any)).toBeNull();
  });

  test('결정론: 동일 입력 → 동일 출력', () => {
    const saju = getSajuData('1990-05-05', '14:30', false, false, false, 'Asia/Seoul');
    expect(analyzeGyeokYongshin(saju)).toEqual(analyzeGyeokYongshin(saju));
  });

  test('provisional·schoolNote 표기', () => {
    const r = analyzeGyeokYongshin(getSajuData('1990-05-05', '14:30', false, false, false, 'Asia/Seoul'))!;
    expect(r.provisional).toBe(true);
    expect(r.gyeok.provisional).toBe(true);
    expect(r.yongshin.provisional).toBe(true);
    expect(r.schoolNote).toContain('유파');
  });
});
