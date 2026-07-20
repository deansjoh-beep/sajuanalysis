/**
 * 컨텍스트 diff 하네스 (Phase 1-3, docs/phase-1-3-plan.md §4-2·§4-3)
 *
 * 기준선 = buildLegacyPromptContext(종전 generateLifeNavReport 조립의 무변경 추출).
 * 대상   = sajuAnalysisToPromptContext(SajuAnalysis 단독 파생, 옵션 B) — **v1(레거시) 엔진 고정**.
 *
 * 2026-07-07 병합 승인 이후 앱 기본 엔진은 v1.5이지만, 이 하네스는 Phase 1-3 당시의
 * 목적(v1 gyeokYongshin 어댑터가 종전 인라인 계산과 일치하는지)을 그대로 유지하기 위해
 * `{ yongshinEngine: 'v1' }`을 명시한다. 기본 엔진(v1.5) 스펙은 promptContext.rules.test.ts.
 *
 * 검증 정책:
 *   - sajuContext·daeunContext·hapchungContext·shinsalContext → **바이트 동일** 요구.
 *   - yongshinContext → 의도적 차이: 값(강약·조후·용신·억부용신)은 동일 prefix, 논리 문구가
 *     구조화 모듈(gyeokyongshin) 표현으로 바뀌고 잠정 경고가 병기된다. 스냅샷으로 문서화.
 *   - sipseungContext → 의도적 교정: 레거시는 saju[2](월간)를 일간으로 잘못 전달했다.
 *     어댑터는 일간 기준(= getOriginalSipseungSummary(일간, saju))과 동일해야 한다.
 *     레거시 vs 교정 diff는 스냅샷으로 문서화.
 */

import { describe, test, expect } from 'vitest';
import {
  getSajuData,
  getDaeunData,
  calculateYongshin,
  getOriginalSipseungSummary,
} from '../../utils/saju';
import { buildSajuAnalysis } from './schema';
import { buildLegacyPromptContext, sajuAnalysisToPromptContext } from './promptContext';

// 고정 조회 시점(결정론) — schema.test.ts와 동일 기준.
const AS_OF = new Date('2026-07-04T03:00:00.000Z');

type Fixture = {
  name: string;
  dateStr: string;
  timeStr: string;
  isLunar: boolean;
  isLeap: boolean;
  gender: 'M' | 'F';
  unknownTime: boolean;
};

const FIXTURES: Fixture[] = [
  { name: '음력 남성 1969-10-23 10:00', dateStr: '1969-10-23', timeStr: '10:00', isLunar: true, isLeap: false, gender: 'M', unknownTime: false },
  { name: '양력 여성 1990-03-15 08:30', dateStr: '1990-03-15', timeStr: '08:30', isLunar: false, isLeap: false, gender: 'F', unknownTime: false },
  { name: '양력 남성 1988-01-05 23:40 (야자시)', dateStr: '1988-01-05', timeStr: '23:40', isLunar: false, isLeap: false, gender: 'M', unknownTime: false },
  { name: '양력 남성 1956-06-15 11:00 (KST +8:30 기간)', dateStr: '1956-06-15', timeStr: '11:00', isLunar: false, isLeap: false, gender: 'M', unknownTime: false },
  { name: '양력 여성 1985-07-01 시간미상', dateStr: '1985-07-01', timeStr: '', isLunar: false, isLeap: false, gender: 'F', unknownTime: true },
];

const buildBoth = (f: Fixture) => {
  const saju = getSajuData(f.dateStr, f.timeStr, f.isLunar, f.isLeap, f.unknownTime, 'Asia/Seoul');
  const daeun = getDaeunData(f.dateStr, f.timeStr, f.isLunar, f.isLeap, f.gender, f.unknownTime);
  const yongshin = calculateYongshin(saju);
  const legacy = buildLegacyPromptContext(saju, daeun, yongshin);

  const analysis = buildSajuAnalysis({
    dateStr: f.dateStr,
    timeStr: f.timeStr,
    isLunar: f.isLunar,
    isLeap: f.isLeap,
    gender: f.gender,
    unknownTime: f.unknownTime,
    asOfDate: AS_OF,
  });
  const adapted = sajuAnalysisToPromptContext(analysis, { yongshinEngine: 'v1' });

  return { saju, legacy, adapted };
};

describe.each(FIXTURES)('컨텍스트 diff 하네스 — $name', (f) => {
  const { saju, legacy, adapted } = buildBoth(f);

  test('sajuContext 바이트 동일', () => {
    expect(adapted.sajuContext).toBe(legacy.sajuContext);
  });

  test('daeunContext 바이트 동일', () => {
    expect(adapted.daeunContext).toBe(legacy.daeunContext);
  });

  test('hapchungContext 바이트 동일', () => {
    expect(adapted.hapchungContext).toBe(legacy.hapchungContext);
  });

  test('shinsalContext 바이트 동일', () => {
    expect(adapted.shinsalContext).toBe(legacy.shinsalContext);
  });

  test('yongshinContext — 값 prefix 동일 + 잠정 경고 병기(의도적 차이)', () => {
    // 강약·조후·용신·억부용신 수치는 동일 알고리즘이므로 prefix가 바이트 동일해야 한다.
    const legacyPrefix = legacy.yongshinContext.split(' | 논리:')[0];
    expect(adapted.yongshinContext.startsWith(legacyPrefix)).toBe(true);
    // 논리 문구는 구조화 모듈 표현 + 잠정 경고 병기.
    expect(adapted.yongshinContext).toContain('논리:');
    expect(adapted.yongshinContext).toContain('잠정 해석');
  });

  test('sipseungContext — 일간 기준으로 교정(의도적 차이)', () => {
    // 어댑터 출력은 "일간을 올바르게 전달했을 때"의 레거시 헬퍼 출력과 동일해야 한다.
    // (getSajuData 반환 순서 [시,일,월,년] → 일주 = saju[1])
    const dayStem = saju[1]?.stem?.hanja ?? '';
    expect(adapted.sipseungContext).toBe(getOriginalSipseungSummary(dayStem, saju));
  });

  test('전체 컨텍스트 스냅샷(사람 검토용 diff 문서)', () => {
    expect({ legacy, adapted }).toMatchSnapshot();
  });
});
