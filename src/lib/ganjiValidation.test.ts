import { describe, it, expect } from 'vitest';
import {
  extractGanjiToken,
  buildYearGanjiMap,
  findYearGanjiMismatches,
  buildGanjiCorrection,
} from './ganjiValidation';

const PILLARS = [
  { year: 2025, yearPillarHangul: '을사', yearPillarHanja: '乙巳' },
  { year: 2026, yearPillarHangul: '병오', yearPillarHanja: '丙午' },
  { year: 2027, yearPillarHangul: '정미', yearPillarHanja: '丁未' },
];
const MAP = buildYearGanjiMap(PILLARS);

describe('ganjiValidation', () => {
  it('extractGanjiToken: 창에서 첫 간지 토큰(한글/한자)을 찾는다', () => {
    expect(extractGanjiToken('은 병오년의 흐름')).toBe('병오');
    expect(extractGanjiToken('丙午년')).toBe('丙午');
    expect(extractGanjiToken('별다른 간지 없음')).toBeNull();
  });

  it('올바른 세운 간지는 불일치 없음', () => {
    const text = '2026년은 병오년으로 비견의 해입니다. 2027년 정미년에는 변화가 있습니다.';
    expect(findYearGanjiMismatches(text, MAP)).toHaveLength(0);
  });

  it('한자 병기(병오(丙午))도 일치 처리', () => {
    const text = '2026년 병오(丙午)년의 기운은 강합니다.';
    expect(findYearGanjiMismatches(text, MAP)).toHaveLength(0);
  });

  it('틀린 세운 간지를 잡아낸다', () => {
    const text = '2026년은 정미년이라 조심해야 합니다.';
    const result = findYearGanjiMismatches(text, MAP);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ year: 2026, found: '정미', expectedHangul: '병오' });
  });

  it('맵에 없는 연도는 검사하지 않는다', () => {
    const text = '2019년 기해년에는 큰 일이 있었죠.';
    expect(findYearGanjiMismatches(text, MAP)).toHaveLength(0);
  });

  it('연도 뒤 간지 언급이 없으면 검사하지 않는다(오탐 방지)', () => {
    const text = '2026년에는 재물운이 좋아집니다. 건강도 챙기세요.';
    expect(findYearGanjiMismatches(text, MAP)).toHaveLength(0);
  });

  it('같은 연도는 한 번만 보고한다', () => {
    const text = '2026년 정미년. 다시 2026년 정미년.';
    expect(findYearGanjiMismatches(text, MAP)).toHaveLength(1);
  });

  it('여러 연도의 오류를 각각 보고한다', () => {
    const text = '2026년 정미년, 2027년 병오년.';
    const result = findYearGanjiMismatches(text, MAP);
    expect(result.map((r) => r.year).sort()).toEqual([2026, 2027]);
  });

  it('buildGanjiCorrection: 정답 간지를 지시문에 포함', () => {
    const result = findYearGanjiMismatches('2026년 정미년', MAP);
    const correction = buildGanjiCorrection(result);
    expect(correction).toContain('2026년: 병오(丙午)');
    expect(correction).toContain('정정 지시');
  });
});
