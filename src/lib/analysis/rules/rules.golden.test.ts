/**
 * 골든 명식 테스트 — 기준서 9장 (docs/myeongri-standard/golden-set.json)
 *
 * §9.1.1 golden-set.json이 기계 판독 정본이며 규칙 엔진 단위 테스트가 직접 임포트한다.
 * §9.1.3 수치 허용 오차 ±0.1, 범주 값은 정확 일치.
 * §8.5   A-1 월률분야표는 saju.ts hiddenStems와 구성·순서 일치(스펙 테스트로 강제).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeByRulesFromGanzhi } from './index';
import { HIDDEN_STEM_DAYS } from './tables';
import { hiddenStems } from '../../../utils/saju';

type GoldenCase = {
  id: string;
  pillars: { year: string; month: string; day: string; hour: string | null };
  status: string;
  expected: {
    strength: { ally: number; enemy: number; ratio: number; class: string; deukryeong: boolean; deukji: boolean; deukse: boolean };
    johoo: { t: number; status: string; extreme: boolean };
    gyeok: { name: string; basisStem: string; transparent: boolean; damaged: boolean; seongpae: string };
    yongshin: { method: string; primary: string; huisin: string; gisin: string; gusin: string; hansin: string; presentInNatal: boolean; johooHuisin: string | null };
  } | null;
} ;

const golden = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/myeongri-standard/golden-set.json'), 'utf-8'),
) as { tolerances: { score: number }; cases: GoldenCase[] };

const TOL = golden.tolerances.score; // §9.1.3

describe('규칙 엔진 골든 명식 (기준서 9장)', () => {
  const confirmed = golden.cases.filter((c) => c.status === '확정');

  test('확정 케이스 12건 전부 테스트 대상', () => {
    expect(confirmed).toHaveLength(12);
  });

  for (const c of confirmed) {
    const label = `${c.id} ${c.pillars.year} ${c.pillars.month} ${c.pillars.day} ${c.pillars.hour ?? '(시간 미상)'}`;
    test(label, () => {
      const r = analyzeByRulesFromGanzhi(c.pillars);
      expect(r).not.toBeNull();
      const e = c.expected!;

      // 2·3장 세력·강약
      expect(Math.abs(r!.strength.ally - e.strength.ally)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(r!.strength.enemy - e.strength.enemy)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(r!.strength.ratio - e.strength.ratio)).toBeLessThanOrEqual(TOL);
      expect(r!.strength.class).toBe(e.strength.class);
      expect(r!.strength.deukryeong).toBe(e.strength.deukryeong);
      expect(r!.strength.deukji).toBe(e.strength.deukji);
      expect(r!.strength.deukse).toBe(e.strength.deukse);

      // 4장 조후
      expect(r!.johoo.t).toBe(e.johoo.t);
      expect(r!.johoo.status).toBe(e.johoo.status);
      expect(r!.johoo.extreme).toBe(e.johoo.extreme);

      // 5장 격국
      expect(r!.gyeok.name).toBe(e.gyeok.name);
      expect(r!.gyeok.basisStem).toBe(e.gyeok.basisStem);
      expect(r!.gyeok.transparent).toBe(e.gyeok.transparent);
      expect(r!.gyeok.damaged).toBe(e.gyeok.damaged);
      expect(r!.gyeok.seongpae).toBe(e.gyeok.seongpae);

      // 6장 용신
      expect(r!.yongshin.method).toBe(e.yongshin.method);
      expect(r!.yongshin.primary).toBe(e.yongshin.primary);
      expect(r!.yongshin.huisin).toBe(e.yongshin.huisin);
      expect(r!.yongshin.gisin).toBe(e.yongshin.gisin);
      expect(r!.yongshin.gusin).toBe(e.yongshin.gusin);
      expect(r!.yongshin.hansin).toBe(e.yongshin.hansin);
      expect(r!.yongshin.presentInNatal).toBe(e.yongshin.presentInNatal);
      expect(r!.yongshin.johooHuisin).toBe(e.yongshin.johooHuisin);
    });
  }
});

describe('A-1 월률분야표 ↔ hiddenStems 스펙 (§8.5)', () => {
  const HANGUL_TO_HANJA: Record<string, string> = {
    '갑': '甲', '을': '乙', '병': '丙', '정': '丁', '무': '戊',
    '기': '己', '경': '庚', '신': '辛', '임': '壬', '계': '癸',
  };

  test('12지지 전부 구성·순서 일치, 일수 합 30', () => {
    for (const [branch, entries] of Object.entries(HIDDEN_STEM_DAYS)) {
      const fromSaju = (hiddenStems[branch] ?? []).map((h: string) => HANGUL_TO_HANJA[h]);
      expect(entries.map((x) => x.stem)).toEqual(fromSaju);
      expect(entries.reduce((sum, x) => sum + x.days, 0)).toBe(30);
    }
    expect(Object.keys(HIDDEN_STEM_DAYS)).toHaveLength(12);
  });
});
