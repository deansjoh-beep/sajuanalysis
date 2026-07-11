import { describe, it, expect } from 'vitest';
import {
  BUILDER_TOPICS,
  BUILDER_TIMEFRAMES,
  BUILDER_ANSWER_TYPES,
  assembleBuilderQuestion,
} from './questionBuilder';

describe('questionBuilder 문답 트리', () => {
  it('모든 주제는 고유 id·라벨과 2개 이상의 상황을 가진다', () => {
    const ids = BUILDER_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of BUILDER_TOPICS) {
      expect(topic.label.length).toBeGreaterThan(0);
      expect(topic.situations.length).toBeGreaterThanOrEqual(2);
      const situationIds = topic.situations.map((s) => s.id);
      expect(new Set(situationIds).size).toBe(situationIds.length);
    }
  });

  it('모든 상황 서술문은 마침표로 끝난다', () => {
    for (const topic of BUILDER_TOPICS) {
      for (const situation of topic.situations) {
        expect(situation.statement.endsWith('.')).toBe(true);
        expect(situation.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('시기 선택지는 4개이며 "특정 시기 없음"은 빈 절을 가진다', () => {
    expect(BUILDER_TIMEFRAMES.length).toBe(4);
    const none = BUILDER_TIMEFRAMES.find((t) => t.id === 'none');
    expect(none?.clause).toBe('');
    // 나머지 절은 뒤 문장과 이어지도록 공백으로 끝난다.
    for (const t of BUILDER_TIMEFRAMES.filter((t) => t.id !== 'none')) {
      expect(t.clause.endsWith(' ')).toBe(true);
    }
  });

  it('모든 요청문은 마침표로 끝난다', () => {
    expect(BUILDER_ANSWER_TYPES.length).toBeGreaterThanOrEqual(3);
    for (const a of BUILDER_ANSWER_TYPES) {
      expect(a.request.endsWith('.')).toBe(true);
    }
  });
});

describe('assembleBuilderQuestion', () => {
  it('상황 + 시기 + 요청을 자연스러운 한 질문으로 조립한다', () => {
    const q = assembleBuilderQuestion({
      statement: '지금 직장에서 이직을 고민 중입니다.',
      timeframeClause: '올해 기준으로, ',
      request: '언제 움직이는 것이 좋을지 시기를 짚어주세요.',
    });
    expect(q).toBe(
      '지금 직장에서 이직을 고민 중입니다. 올해 기준으로, 제 사주로 볼 때 언제 움직이는 것이 좋을지 시기를 짚어주세요.'
    );
  });

  it('시기 없음이면 절 없이 이어진다', () => {
    const q = assembleBuilderQuestion({
      statement: '돈이 잘 모이지 않아 고민입니다.',
      timeframeClause: '',
      request: '제가 조심해야 할 점을 알려주세요.',
    });
    expect(q).toBe('돈이 잘 모이지 않아 고민입니다. 제 사주로 볼 때 제가 조심해야 할 점을 알려주세요.');
  });

  it('모든 조합이 이중 공백 없이 조립된다', () => {
    for (const topic of BUILDER_TOPICS) {
      for (const situation of topic.situations) {
        for (const timeframe of BUILDER_TIMEFRAMES) {
          for (const answerType of BUILDER_ANSWER_TYPES) {
            const q = assembleBuilderQuestion({
              statement: situation.statement,
              timeframeClause: timeframe.clause,
              request: answerType.request,
            });
            expect(q).not.toMatch(/ {2}/);
            expect(q.endsWith('.')).toBe(true);
          }
        }
      }
    }
  });
});
