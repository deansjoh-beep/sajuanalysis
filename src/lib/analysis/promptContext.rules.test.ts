/**
 * v1.5 용신 컨텍스트 주입 스펙 (플랜 3-1 — 프롬프트에 근거 조항 주입)
 *
 * - 기본 경로(v1)는 종전과 동일해야 한다(⛔ OWNER 병합 판정 전 런타임 불변).
 * - v1.5는 자평 표준 판정 + 기준서 §조항 인용을 포함해야 한다.
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

describe('promptContext — v1.5 자평 규칙 엔진 주입', () => {
  test('기본(v1)은 provisional 문구를 유지하고 §조항을 포함하지 않는다', () => {
    const ctx = sajuAnalysisToPromptContext(analysis);
    expect(ctx.yongshinContext).toContain('잠정 해석');
    expect(ctx.yongshinContext).not.toContain('자평 표준 판정');
  });

  test('v1.5는 자평 표준 판정과 기준서 §조항 근거를 포함한다', () => {
    const ctx = sajuAnalysisToPromptContext(analysis, { yongshinEngine: 'v1.5' });
    expect(ctx.yongshinContext).toContain('자평 표준 판정');
    expect(ctx.yongshinContext).toContain('§3.2.1'); // 강약 근거
    expect(ctx.yongshinContext).toContain('§5.4.1'); // 성패 근거
    expect(ctx.yongshinContext).toContain('§6.3.1'); // 희기신 근거
    expect(ctx.yongshinContext).not.toContain('잠정 해석');
    // 규칙 엔진 판정값이 그대로 실려야 한다
    expect(ctx.yongshinContext).toContain(analysis.rules!.gyeok.name);
    expect(ctx.yongshinContext).toContain(`용신: ${analysis.rules!.yongshin.primary}`);
    // 용신 외 5개 컨텍스트는 엔진과 무관하게 동일
    const v1 = sajuAnalysisToPromptContext(analysis);
    expect(ctx.sajuContext).toBe(v1.sajuContext);
    expect(ctx.daeunContext).toBe(v1.daeunContext);
    expect(ctx.hapchungContext).toBe(v1.hapchungContext);
    expect(ctx.shinsalContext).toBe(v1.shinsalContext);
    expect(ctx.sipseungContext).toBe(v1.sipseungContext);
  });

  test('rules가 null이면 v1로 폴백한다', () => {
    const crippled = { ...analysis, rules: null };
    expect(buildRulesYongshinContext(crippled)).toContain('잠정 해석');
  });
});
