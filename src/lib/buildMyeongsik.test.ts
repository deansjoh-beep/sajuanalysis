import { describe, it, expect } from 'vitest';
import { buildMyeongsikFromBirth, myeongsikMatches } from './buildMyeongsik';
import type { BirthFormInput } from './runReportGeneration';

/**
 * 미생성 주문 복구(CodeLookupTab RecoverGenerationForm)의 무결성 검증 로직.
 * 서버에 생년월일 원문이 없으므로, 재입력 생년월일 → 명식(간지) 비교가
 * 다른 사주로 리포트가 생성되는 사고를 막는 유일한 방어선이다.
 */

const BASE: BirthFormInput = {
  dateStr: '1990-05-15',
  timeStr: '10:00',
  isLunar: false,
  gender: 'M',
  unknownTime: false,
};

describe('myeongsikMatches', () => {
  it('같은 생년월일 입력은 항상 일치한다 (라운드트립)', () => {
    const stored = buildMyeongsikFromBirth(BASE);
    const entered = buildMyeongsikFromBirth({ ...BASE });
    expect(myeongsikMatches(stored, entered)).toBe(true);
  });

  it('다른 날짜는 불일치한다', () => {
    const stored = buildMyeongsikFromBirth(BASE);
    const entered = buildMyeongsikFromBirth({ ...BASE, dateStr: '1990-05-16' });
    expect(myeongsikMatches(stored, entered)).toBe(false);
  });

  it('시간 미상과 시간 입력은 불일치한다 (시주 유무)', () => {
    const stored = buildMyeongsikFromBirth(BASE);
    const entered = buildMyeongsikFromBirth({ ...BASE, unknownTime: true });
    expect(myeongsikMatches(stored, entered)).toBe(false);
  });

  it('둘 다 시간 미상이면 나머지 기둥으로 일치 판정한다', () => {
    const stored = buildMyeongsikFromBirth({ ...BASE, unknownTime: true });
    const entered = buildMyeongsikFromBirth({ ...BASE, unknownTime: true, timeStr: '22:00' });
    expect(myeongsikMatches(stored, entered)).toBe(true);
  });

  it('성별이 다르면 불일치한다 (대운 방향이 달라짐)', () => {
    const stored = buildMyeongsikFromBirth(BASE);
    const entered = buildMyeongsikFromBirth({ ...BASE, gender: 'F' });
    expect(myeongsikMatches(stored, entered)).toBe(false);
  });

  it('다른 시진은 불일치한다', () => {
    const stored = buildMyeongsikFromBirth(BASE);
    const entered = buildMyeongsikFromBirth({ ...BASE, timeStr: '22:00' });
    expect(myeongsikMatches(stored, entered)).toBe(false);
  });
});
