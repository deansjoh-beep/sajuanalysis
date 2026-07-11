import { describe, it, expect } from 'vitest';
import { CHAT_SCENARIOS, getScenarioById, ScenarioCardKind } from './chatScenarios';

const VALID_CARD_KINDS: ScenarioCardKind[] = [
  'yearly',
  'monthly',
  'daily',
  'wealth',
  'career',
  'love',
  'health',
  'relations',
  'daeun',
];

describe('CHAT_SCENARIOS 무결성', () => {
  it('Phase B 주제 9종이 정의돼 있다(자유 질문은 입력창 담당)', () => {
    expect(CHAT_SCENARIOS).toHaveLength(9);
  });

  it('id가 고유하다', () => {
    const ids = CHAT_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 시나리오가 필수 필드와 유효한 cardKind를 가진다', () => {
    for (const s of CHAT_SCENARIOS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.seedQuestion.length).toBeGreaterThan(0);
      expect(s.promptFocus.length).toBeGreaterThan(0);
      expect(s.followups.length).toBeGreaterThan(0);
      expect(VALID_CARD_KINDS).toContain(s.cardKind);
    }
  });

  it('related는 실제 존재하는 시나리오 id만 참조한다', () => {
    const ids = new Set(CHAT_SCENARIOS.map((s) => s.id));
    for (const s of CHAT_SCENARIOS) {
      for (const rid of s.related) {
        expect(ids.has(rid)).toBe(true);
        expect(rid).not.toBe(s.id); // 자기 자신 참조 금지
      }
    }
  });

  it('getScenarioById는 존재하는 id를 찾고 없는 id엔 undefined를 반환한다', () => {
    expect(getScenarioById('wealth')?.label).toBe('재물·사업');
    expect(getScenarioById('nope')).toBeUndefined();
  });
});
