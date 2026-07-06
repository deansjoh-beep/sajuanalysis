/**
 * v1.5 용신 컨텍스트 주입 스펙 (플랜 3-1 — 프롬프트에 근거 조항 주입)
 *
 * 2026-07-07 ⛔ OWNER 병합 승인(A/B 벤치 30건, bench-output/ab-30/ab-compare.md):
 * 기본 엔진은 v1.5(자평 표준 규칙 엔진). v1은 회귀 비교·디버깅용으로만 남긴다.
 */
import { describe, test, expect } from 'vitest';
import { buildSajuAnalysis } from './schema';
import { sajuAnalysisToPromptContext, buildRulesYongshinContext } from './promptContext';

const analysis = buildSajuAnalysis({
  dateStr: '1969-10-23',
  timeStr: '10:00',
  isLunar: true,
  isLeap: false,
  gender: 'M',
});

describe('promptContext — v1.5 자평 규칙 엔진(기본 엔진)', () => {
  test('기본 경로는 v1.5 — 자평 표준 판정과 기준서 §조항 근거를 포함한다', () => {
    const ctx = sajuAnalysisToPromptContext(analysis);
    expect(ctx.yongshinContext).toContain('자평 표준 판정');
    expect(ctx.yongshinContext).toContain('§3.2.1'); // 강약 근거
    expect(ctx.yongshinContext).toContain('§5.4.1'); // 성패 근거
    expect(ctx.yongshinContext).toContain('§6.3.1'); // 희기신 근거
    expect(ctx.yongshinContext).not.toContain('잠정 해석');
    // 규칙 엔진 판정값이 그대로 실려야 한다
    expect(ctx.yongshinContext).toContain(analysis.rules!.gyeok.name);
    expect(ctx.yongshinContext).toContain(`용신: ${analysis.rules!.yongshin.primary}`);
    // 명시적으로 v1.5를 지정한 결과와 동일해야 한다(기본값 = v1.5)
    expect(ctx.yongshinContext).toBe(sajuAnalysisToPromptContext(analysis, { yongshinEngine: 'v1.5' }).yongshinContext);
  });

  test('§조항 번호가 용신 외 컨텍스트에는 새지 않는다', () => {
    const ctx = sajuAnalysisToPromptContext(analysis);
    expect(ctx.sajuContext).not.toMatch(/§/);
    expect(ctx.daeunContext).not.toMatch(/§/);
    expect(ctx.hapchungContext).not.toMatch(/§/);
    expect(ctx.shinsalContext).not.toMatch(/§/);
    expect(ctx.sipseungContext).not.toMatch(/§/);
  });

  test('v1(레거시 옵션)은 provisional 문구를 유지 — 회귀 비교용으로만 사용', () => {
    const ctx = sajuAnalysisToPromptContext(analysis, { yongshinEngine: 'v1' });
    expect(ctx.yongshinContext).toContain('잠정 해석');
    expect(ctx.yongshinContext).not.toContain('자평 표준 판정');
  });

  test('용신 외 5개 컨텍스트는 엔진 선택과 무관하게 동일하다', () => {
    const v15 = sajuAnalysisToPromptContext(analysis);
    const v1 = sajuAnalysisToPromptContext(analysis, { yongshinEngine: 'v1' });
    expect(v15.sajuContext).toBe(v1.sajuContext);
    expect(v15.daeunContext).toBe(v1.daeunContext);
    expect(v15.hapchungContext).toBe(v1.hapchungContext);
    expect(v15.shinsalContext).toBe(v1.shinsalContext);
    expect(v15.sipseungContext).toBe(v1.sipseungContext);
  });

  test('rules가 null이면 v1로 폴백한다', () => {
    const crippled = { ...analysis, rules: null };
    expect(buildRulesYongshinContext(crippled)).toContain('잠정 해석');
  });
});

describe('용신=기신 자기모순 회귀 방지 (A/B 벤치 발견 — v1 30건 중 19건 63% 발생)', () => {
  // 시드 고정 픽스처 일부(scripts/report-bench.ts 픽스처와 동일 생년월일대) — 결정론 재현
  const CASES: Array<{ dateStr: string; timeStr: string; isLunar: boolean; gender: 'M' | 'F' }> = [
    { dateStr: '1968-07-04', timeStr: '08:37', isLunar: false, gender: 'M' },
    { dateStr: '1995-06-25', timeStr: '09:08', isLunar: false, gender: 'M' },
    { dateStr: '1961-12-08', timeStr: '09:47', isLunar: false, gender: 'F' },
    { dateStr: '1975-01-03', timeStr: '01:45', isLunar: false, gender: 'F' },
    { dateStr: '1999-12-20', timeStr: '', isLunar: false, gender: 'F' },
  ];

  for (const c of CASES) {
    test(`v1.5 희신/기신/구신/한신은 용신과 겹치지 않는다 — ${c.dateStr}`, () => {
      const a = buildSajuAnalysis({ ...c, isLeap: false, unknownTime: !c.timeStr });
      const y = a.rules!.yongshin;
      const set = new Set([y.primary, y.huisin, y.gisin, y.gusin, y.hansin]);
      expect(set.size).toBe(5); // 5개 전부 서로 다른 오행 — 자기모순 불가능
      expect(y.gisin).not.toBe(y.primary);
    });
  }
});
