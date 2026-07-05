/**
 * 프리미엄 리포트 코어 — 금칙어(단정 표현) 검사 스펙 (OWNER 지시 2026-07-05)
 *
 * 정책: 사망·이혼·파산 등 민감 주제의 "확정 서술"만 위반으로 잡고,
 * 경향·주의 서술("~할 수 있으니 조심")은 허용한다. 규칙 추가는
 * premiumReportCore.ts의 FORBIDDEN_TERMS / SENSITIVE_TOPICS 배열에 한다.
 */

import { describe, test, expect } from 'vitest';
import { checkForbiddenExpressions, evaluatePremiumReportQuality } from './premiumReportCore';

describe('checkForbiddenExpressions — 단정 표현은 위반', () => {
  test.each([
    ['사망 확정 서술', '이 시기에 배우자가 사망하게 됩니다.'],
    ['이혼 확정 서술', '2027년에는 이혼할 것입니다.'],
    ['파산 확정 서술', '사업은 파산을 피할 수 없습니다.'],
    ['부도 확정 서술', '회사가 부도하고 맙니다.'],
    ['운명 단정', '사별은 정해진 운명입니다.'],
    ['수명 단정어 자체 금지', '이 사주는 단명의 기운이 있습니다.'],
    ['수명 단정어 자체 금지(요절)', '요절수가 보입니다.'],
  ])('%s', (_label, text) => {
    expect(checkForbiddenExpressions(text).length).toBeGreaterThan(0);
  });
});

describe('checkForbiddenExpressions — 경향·주의 서술은 허용', () => {
  test.each([
    ['주의 서술', '건강 관리에 소홀하면 큰 병으로 이어질 수 있으니 조심하세요.'],
    ['경향 서술(이혼)', '부부 갈등이 커질 수 있는 시기이니 대화에 신경 쓰세요.'],
    ['경향 서술(재정)', '재정적으로 무리한 확장은 위험이 따를 수 있습니다.'],
    ['일반 본문', '재물운이 강해지는 흐름이며, 안정적인 저축이 도움이 됩니다.'],
    ['문장 경계 분리', '파산이라는 단어가 있다. 하지만 다음 문장은 별개로 좋아집니다.'],
  ])('%s', (_label, text) => {
    expect(checkForbiddenExpressions(text)).toEqual([]);
  });
});

describe('evaluatePremiumReportQuality — 금칙어 통합', () => {
  test('위반 시 이슈 추가 + 점수 감점', () => {
    const clean = evaluatePremiumReportQuality(undefined, '짧은 본문', [], 10);
    const dirty = evaluatePremiumReportQuality(undefined, '짧은 본문. 당신은 곧 파산하게 됩니다.', [], 10);
    expect(dirty.issues.some((i) => i.includes('금칙어'))).toBe(true);
    expect(dirty.score).toBeLessThanOrEqual(clean.score);
    expect(clean.issues.some((i) => i.includes('금칙어'))).toBe(false);
  });
});
