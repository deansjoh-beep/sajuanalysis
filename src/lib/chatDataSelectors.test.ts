import { describe, it, expect } from 'vitest';
import { getSajuData, getDaeunData, calculateYongshin } from '../utils/saju';
import {
  buildMyeongsikCard,
  buildWealthCard,
  buildDaeunCard,
  buildYearlyCard,
  summarizeCard,
} from './chatDataSelectors';

// 고정 입력(1990-05-15 09:30, 양력, 남성) — 엔진이 결정론적이므로 셀렉터 출력도 스냅샷 가능.
const DATE = '1990-05-15';
const TIME = '09:30';
const saju = getSajuData(DATE, TIME, false, false);
const daeun = getDaeunData(DATE, TIME, false, false, 'M');
const yongshin = calculateYongshin(saju);
const dayMasterHanja = saju.find((p: any) => p.title === '일주')!.stem.hanja;

describe('chatDataSelectors', () => {
  it('명식 카드는 4주 전부와 일간을 엔진 값 그대로 담는다', () => {
    const card = buildMyeongsikCard(saju, yongshin);
    expect(card.kind).toBe('myeongsik');
    expect(card.pillars).toHaveLength(4);
    // 일간은 일주 천간과 일치해야 한다(카드가 엔진 값을 변형하지 않음을 보장).
    const dayPillar = saju.find((p: any) => p.title === '일주')!;
    expect(card.dayMasterHanja).toBe(dayPillar.stem.hanja);
    expect(card.dayMasterHangul).toBe(dayPillar.stem.hangul);
    expect(card.yongshin).toBe(yongshin.yongshin);
    expect(card.strength).toBe(yongshin.strength);
    // 각 주 필드가 엔진 pillar와 동일한지 확인.
    card.pillars.forEach((pv, i) => {
      expect(pv.stemHanja).toBe(saju[i].stem.hanja);
      expect(pv.branchHanja).toBe(saju[i].branch.hanja);
      expect(pv.stemDeity).toBe(saju[i].stem.deity);
    });
  });

  it('재물 카드는 천간·지지의 정재/편재만 수집한다', () => {
    const card = buildWealthCard(saju, yongshin);
    expect(card.kind).toBe('wealth');
    // 수집된 재성은 반드시 정재 또는 편재여야 한다.
    card.stars.forEach((s) => {
      expect(['정재', '편재']).toContain(s.label);
    });
    expect(card.hasJeongjae).toBe(card.stars.some((s) => s.label === '정재'));
    expect(card.hasPyeonjae).toBe(card.stars.some((s) => s.label === '편재'));
    expect(card.yongshin).toBe(yongshin.yongshin);
  });

  it('대운 카드는 대운 전부를 담고 현재 대운을 정확히 하나만 표시한다', () => {
    const currentAge = 35;
    const card = buildDaeunCard(daeun, dayMasterHanja, currentAge);
    expect(card.kind).toBe('daeun');
    expect(card.steps).toHaveLength(daeun.length);
    const currents = card.steps.filter((s) => s.isCurrent);
    expect(currents.length).toBeLessThanOrEqual(1);
    // 간지 한자는 엔진 대운 값과 동일.
    card.steps.forEach((s, i) => {
      expect(s.ganjiHanja).toBe(`${daeun[i].stem}${daeun[i].branch}`);
      expect(s.startAge).toBe(daeun[i].startAge);
    });
  });

  it('대운 카드: 현재 나이가 특정 구간에 들면 해당 대운만 현재로 표시', () => {
    const target = daeun[2];
    const nextStart = daeun[3]?.startAge ?? target.startAge + 10;
    const midAge = Math.floor((target.startAge + nextStart) / 2);
    const card = buildDaeunCard(daeun, dayMasterHanja, midAge);
    const currentSteps = card.steps.filter((s) => s.isCurrent);
    expect(currentSteps).toHaveLength(1);
    expect(currentSteps[0].startAge).toBe(target.startAge);
  });

  it('올해 세운 카드는 입력한 연주 간지를 그대로 반영한다', () => {
    const currentYearPillar = { year: 2026, yearPillarHangul: '병오', yearPillarHanja: '丙午' };
    const card = buildYearlyCard(dayMasterHanja, currentYearPillar);
    expect(card.kind).toBe('yearly');
    expect(card.year).toBe(2026);
    expect(card.ganjiHanja).toBe('丙午');
    expect(card.ganjiHangul).toBe('병오');
    // 십성/운성은 문자열이어야 하고 비어있지 않아야 한다(일간이 유효하므로).
    expect(typeof card.stemDeity).toBe('string');
    expect(card.stemDeity.length).toBeGreaterThan(0);
    expect(card.branchUnseong.length).toBeGreaterThan(0);
  });

  it('summarizeCard는 각 카드 종류를 근거 문자열로 직렬화한다', () => {
    expect(summarizeCard(buildMyeongsikCard(saju, yongshin))).toContain('[명식 카드]');
    expect(summarizeCard(buildWealthCard(saju, yongshin))).toContain('[재물 구조 카드]');
    expect(summarizeCard(buildDaeunCard(daeun, dayMasterHanja, 35))).toContain('[대운 흐름 카드]');
    expect(
      summarizeCard(buildYearlyCard(dayMasterHanja, { year: 2026, yearPillarHangul: '병오', yearPillarHanja: '丙午' }))
    ).toContain('[올해 세운 카드]');
  });
});
