import { describe, it, expect } from 'vitest';
import { getSajuData, getDaeunData, calculateYongshin, calculateGyeok } from '../utils/saju';
import {
  buildMyeongsikCard,
  buildWealthCard,
  buildDaeunCard,
  buildPeriodCard,
  buildYearlyCard,
  buildCareerCard,
  buildLoveCard,
  buildHealthCard,
  buildRelationsCard,
  summarizeCard,
} from './chatDataSelectors';

// 고정 입력(1990-05-15 09:30, 양력, 남성) — 엔진이 결정론적이므로 셀렉터 출력도 스냅샷 가능.
const DATE = '1990-05-15';
const TIME = '09:30';
const saju = getSajuData(DATE, TIME, false, false);
const daeun = getDaeunData(DATE, TIME, false, false, 'M');
const yongshin = calculateYongshin(saju);
const gyeok = calculateGyeok(saju);
const dayPillar = saju.find((p: any) => p.title === '일주')!;
const dayMasterHanja = dayPillar.stem.hanja;

const DEITY_SET = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];

describe('chatDataSelectors', () => {
  it('명식 카드는 4주 전부와 일간을 엔진 값 그대로 담는다', () => {
    const card = buildMyeongsikCard(saju, yongshin);
    expect(card.kind).toBe('myeongsik');
    expect(card.pillars).toHaveLength(4);
    expect(card.dayMasterHanja).toBe(dayPillar.stem.hanja);
    expect(card.dayMasterHangul).toBe(dayPillar.stem.hangul);
    expect(card.yongshin).toBe(yongshin.yongshin);
    expect(card.strength).toBe(yongshin.strength);
    card.pillars.forEach((pv, i) => {
      expect(pv.stemHanja).toBe(saju[i].stem.hanja);
      expect(pv.branchHanja).toBe(saju[i].branch.hanja);
      expect(pv.stemDeity).toBe(saju[i].stem.deity);
    });
  });

  it('재물 카드는 천간·지지의 정재/편재만 수집한다', () => {
    const card = buildWealthCard(saju, yongshin);
    expect(card.kind).toBe('wealth');
    card.stars.forEach((s) => expect(['정재', '편재']).toContain(s.label));
    expect(card.hasJeongjae).toBe(card.stars.some((s) => s.label === '정재'));
    expect(card.hasPyeonjae).toBe(card.stars.some((s) => s.label === '편재'));
    expect(card.yongshin).toBe(yongshin.yongshin);
  });

  it('대운 카드는 대운 전부를 담고 현재 대운을 정확히 하나만 표시한다', () => {
    const card = buildDaeunCard(daeun, dayMasterHanja, 35);
    expect(card.kind).toBe('daeun');
    expect(card.steps).toHaveLength(daeun.length);
    expect(card.steps.filter((s) => s.isCurrent).length).toBeLessThanOrEqual(1);
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

  it('기간 카드는 입력 간지를 그대로 반영하고 십성/운성을 채운다', () => {
    const card = buildPeriodCard(dayMasterHanja, '丙午', '병오', '이달 월운');
    expect(card.kind).toBe('period');
    expect(card.periodLabel).toBe('이달 월운');
    expect(card.ganjiHanja).toBe('丙午');
    expect(card.ganjiHangul).toBe('병오');
    expect(card.stemDeity.length).toBeGreaterThan(0);
    expect(card.branchUnseong.length).toBeGreaterThan(0);
  });

  it('세운 카드(buildYearlyCard)는 period 카드로 연주 간지를 반영한다', () => {
    const card = buildYearlyCard(dayMasterHanja, { year: 2026, yearPillarHangul: '병오', yearPillarHanja: '丙午' });
    expect(card.kind).toBe('period');
    expect(card.periodLabel).toContain('2026');
    expect(card.periodLabel).toContain('세운');
    expect(card.ganjiHanja).toBe('丙午');
  });

  it('직업 카드는 격국·십성분포와 관성/인성 위치만 담는다', () => {
    const card = buildCareerCard(saju, gyeok);
    expect(card.kind).toBe('career');
    expect(card.gyeok).toBe(gyeok.gyeok);
    expect(card.composition).toBe(gyeok.composition);
    card.officers.forEach((s) => expect(['정관', '편관']).toContain(s.label));
    card.seals.forEach((s) => expect(['정인', '편인']).toContain(s.label));
  });

  it('연애 카드는 배우자궁(일지)과 지장간을 엔진 값으로, 신살은 도화/홍염만 담는다', () => {
    const card = buildLoveCard(saju, dayMasterHanja);
    expect(card.kind).toBe('love');
    expect(card.spousePalaceHanja).toBe(dayPillar.branch.hanja);
    expect(card.spousePalaceHangul).toBe(dayPillar.branch.hangul);
    expect(card.hiddenStems).toBe(dayPillar.branch.hidden);
    card.romanceStars.forEach((s) => expect(['도화', '홍염']).toContain(s.label));
  });

  it('건강 카드는 오행 5종 분포를 담고 부족 오행을 정확히 집계한다', () => {
    const card = buildHealthCard(saju, yongshin);
    expect(card.kind).toBe('health');
    expect(card.elements).toHaveLength(5);
    // 분포 합 = 명식에서 정의된 오행 글자 수(생시 known이므로 8)
    const definedCount = saju.reduce(
      (n: number, p: any) => n + (p.stem?.element ? 1 : 0) + (p.branch?.element ? 1 : 0),
      0
    );
    const sum = card.elements.reduce((n, e) => n + e.count, 0);
    expect(sum).toBe(definedCount);
    // lacking = count 0인 라벨과 정확히 일치
    expect(card.lacking).toEqual(card.elements.filter((e) => e.count === 0).map((e) => e.label));
    expect(card.johooStatus).toBe(yongshin.johooStatus);
  });

  it('대인관계 카드는 비겁/관성/인성 위치만 각 그룹에 담는다', () => {
    const card = buildRelationsCard(saju);
    expect(card.kind).toBe('relations');
    card.peers.forEach((s) => expect(['비견', '겁재']).toContain(s.label));
    card.authorities.forEach((s) => expect(['정관', '편관']).toContain(s.label));
    card.supporters.forEach((s) => expect(['정인', '편인']).toContain(s.label));
  });

  it('모든 카드의 배치 라벨은 유효한 십성 집합에 속한다', () => {
    const wealth = buildWealthCard(saju, yongshin);
    const career = buildCareerCard(saju, gyeok);
    const relations = buildRelationsCard(saju);
    [...wealth.stars, ...career.officers, ...career.seals, ...relations.peers, ...relations.authorities, ...relations.supporters].forEach(
      (s) => expect(DEITY_SET).toContain(s.label)
    );
  });

  it('summarizeCard는 각 카드 종류를 근거 문자열로 직렬화한다', () => {
    expect(summarizeCard(buildMyeongsikCard(saju, yongshin))).toContain('[명식 카드]');
    expect(summarizeCard(buildWealthCard(saju, yongshin))).toContain('[재물 구조 카드]');
    expect(summarizeCard(buildDaeunCard(daeun, dayMasterHanja, 35))).toContain('[대운 흐름 카드]');
    expect(summarizeCard(buildYearlyCard(dayMasterHanja, { year: 2026, yearPillarHangul: '병오', yearPillarHanja: '丙午' }))).toContain('세운');
    expect(summarizeCard(buildCareerCard(saju, gyeok))).toContain('[직업 구조 카드]');
    expect(summarizeCard(buildLoveCard(saju, dayMasterHanja))).toContain('[연애·결혼 카드]');
    expect(summarizeCard(buildHealthCard(saju, yongshin))).toContain('[건강 카드]');
    expect(summarizeCard(buildRelationsCard(saju))).toContain('[대인관계 카드]');
  });
});
