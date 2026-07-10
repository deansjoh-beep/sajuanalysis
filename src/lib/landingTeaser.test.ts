import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildTeaserSummary, fetchTeaserComment, teaserInputToDateStrings, type TeaserInput } from './landingTeaser';

const BASE_INPUT: TeaserInput = {
  name: '홍길동',
  birthYear: '1990',
  birthMonth: '5',
  birthDay: '20',
  birthHour: '9',
  calendarType: 'solar',
  gender: 'M',
  unknownTime: false,
};

describe('teaserInputToDateStrings', () => {
  it('패딩·음력 플래그를 올바르게 변환한다', () => {
    expect(teaserInputToDateStrings(BASE_INPUT)).toEqual({
      dateStr: '1990-05-20',
      timeStr: '09:00',
      isLunar: false,
      isLeap: false,
    });
    expect(teaserInputToDateStrings({ ...BASE_INPUT, calendarType: 'leap' })).toMatchObject({
      isLunar: true,
      isLeap: true,
    });
  });

  it('시간 모름이면 12:00으로 고정한다', () => {
    expect(teaserInputToDateStrings({ ...BASE_INPUT, unknownTime: true }).timeStr).toBe('12:00');
  });
});

describe('buildTeaserSummary', () => {
  it('고정 생일 → 안정된 명식·일간·세운 요약을 만든다', () => {
    const s = buildTeaserSummary(BASE_INPUT);
    // 1990-05-20 09:00 양력 남성 — 만세력 검증값 (기존 E2E에서 확인된 명식: 庚午년 辛巳월 乙酉일)
    expect(s.myeongsikLine).toContain('庚午년');
    expect(s.myeongsikLine).toContain('辛巳월');
    expect(s.myeongsikLine).toContain('乙酉일');
    expect(s.dayMasterLine).toContain('乙');
    expect(s.dayMasterLine).toContain('목(木)');
    expect(s.strengthLine).toMatch(/일간의 힘은 '(극신강|신강|중립|신약|극신약)'/);
    expect(s.seunLine).toMatch(/^\d{4}년 .+ · .+운의 해$/);
    // 오행 counts 합 = 가시 8자
    const total = Object.values(s.ohaeng).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });

  it('시간 모름이면 명식에서 시주를 생략하고 표기한다', () => {
    const s = buildTeaserSummary({ ...BASE_INPUT, unknownTime: true });
    expect(s.myeongsikLine).not.toContain('시');
    expect(s.ganzhiContext).toContain('시간 미상');
  });

  it('PII 불변식: ganzhiContext에 이름·생년월일 원문이 없다', () => {
    const s = buildTeaserSummary(BASE_INPUT);
    expect(s.ganzhiContext).not.toContain('1990-05-20');
    expect(s.ganzhiContext).not.toContain('1990');
    expect(s.ganzhiContext).not.toContain('홍길동');
  });
});

describe('fetchTeaserComment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('첫 모델 성공 시 텍스트를 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: ' 좋은 흐름입니다. ' }] } }] }),
    })) as any);
    await expect(fetchTeaserComment('ctx')).resolves.toBe('좋은 흐름입니다.');
  });

  it('전 모델 실패 시 throw한다 (호출측은 조용히 생략)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as any);
    await expect(fetchTeaserComment('ctx')).rejects.toThrow();
  });
});
