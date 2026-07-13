import { describe, it, expect } from 'vitest';
import { parseKeywordLines, REPORT_SECTION_LABELS } from './generateReportKeywords';

describe('parseKeywordLines', () => {
  it('정상 6줄을 인덱스 0~5 배열로 파싱한다', () => {
    const text = [
      '1. 타고난 리더의 기질',
      '2. 변화와 확장의 시기',
      '3. 성장과 전환의 흐름',
      '4. 뜨거운 기운의 조절',
      '5. 지혜로 방향을 잡는 법',
      '6. 재물·직업·관계의 균형',
    ].join('\n');
    expect(parseKeywordLines(text)).toEqual([
      '타고난 리더의 기질',
      '변화와 확장의 시기',
      '성장과 전환의 흐름',
      '뜨거운 기운의 조절',
      '지혜로 방향을 잡는 법',
      '재물·직업·관계의 균형',
    ]);
  });

  it('6개 미만이면 null', () => {
    expect(parseKeywordLines('1. 하나\n2. 둘')).toBeNull();
  });

  it('빈 문자열이면 null', () => {
    expect(parseKeywordLines('')).toBeNull();
  });

  it('") " 형식과 잡음 줄이 섞여도 파싱한다', () => {
    const text = [
      '아래는 키워드입니다.',
      '1) 하나',
      '2) 둘',
      '3) 셋',
      '4) 넷',
      '5) 다섯',
      '6) 여섯',
    ].join('\n');
    expect(parseKeywordLines(text)).toEqual(['하나', '둘', '셋', '넷', '다섯', '여섯']);
  });

  it('섹션 라벨 접두("사주 원국: …")를 제거한다', () => {
    const text = [
      '1. 사주 원국: 열정과 재능의 불꽃',
      '2. 대운·세운: 주체적 선택의 시기',
      '3. 생애 주기: 지혜로운 전환',
      '4. 오행 밸런스: 내면의 평화',
      '5. 용신·개운: 삶의 방향 잡기',
      '6. 테마별: 재물·직업의 균형', // 라벨 축약형도 제거
    ].join('\n');
    expect(parseKeywordLines(text)).toEqual([
      '열정과 재능의 불꽃',
      '주체적 선택의 시기',
      '지혜로운 전환',
      '내면의 평화',
      '삶의 방향 잡기',
      '재물·직업의 균형',
    ]);
  });

  it('라벨과 무관한 문체상 콜론은 보존한다', () => {
    // 접두가 섹션 라벨과 다르면 그대로 둔다.
    const text = [
      '1. 봄: 새로운 시작의 기운',
      '2. 둘',
      '3. 셋',
      '4. 넷',
      '5. 다섯',
      '6. 여섯',
    ].join('\n');
    expect(parseKeywordLines(text)?.[0]).toBe('봄: 새로운 시작의 기운');
  });

  it('라벨 상수는 6개다', () => {
    expect(REPORT_SECTION_LABELS).toHaveLength(6);
  });
});
