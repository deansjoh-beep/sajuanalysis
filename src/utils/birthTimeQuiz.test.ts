import { describe, expect, it } from 'vitest';
import {
  TIME_BRANCHES,
  estimateTimeBranches,
  type GamaSide,
  type PostureGroup,
  type TimeBucket,
} from './birthTimeQuiz';

const GROUPS: PostureGroup[] = ['왕', '생', '고'];
const SIDES: GamaSide[] = ['양', '음'];
const BUCKETS: TimeBucket[] = ['한밤', '새벽', '오전', '한낮', '오후', '저녁'];

// 지지 순서상 6칸 떨어진 쌍이 충(冲) 쌍이다 (자↔오, 축↔미, …).
const BRANCH_ORDER = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const isChungPair = (a: string, b: string) =>
  Math.abs(BRANCH_ORDER.indexOf(a) - BRANCH_ORDER.indexOf(b)) === 6;

describe('birthTimeQuiz 데이터 테이블', () => {
  it('12지지가 하나씩, 대표시각은 시진 중앙 정각', () => {
    expect(TIME_BRANCHES.map((t) => t.branch)).toEqual(BRANCH_ORDER);
    TIME_BRANCHES.forEach((t, i) => {
      expect(t.hour).toBe(i * 2); // 자=0, 축=2, … 해=22
    });
  });
});

describe('estimateTimeBranches 수렴 성질', () => {
  it('Q1+Q2: 항상 정확히 2후보이며 충 쌍(정반대 시간대)', () => {
    for (const g of GROUPS) {
      for (const y of SIDES) {
        const r = estimateTimeBranches(g, y, null);
        expect(r).toHaveLength(2);
        expect(isChungPair(r[0].branch, r[1].branch)).toBe(true);
      }
    }
  });

  it('Q1만: 4후보의 시간대가 전부 다르다', () => {
    for (const g of GROUPS) {
      const r = estimateTimeBranches(g, null, null);
      expect(r).toHaveLength(4);
      expect(new Set(r.map((t) => t.bucket)).size).toBe(4);
    }
  });

  it('Q3만: 정확히 2후보이며 그룹이 서로 다르다', () => {
    for (const b of BUCKETS) {
      const r = estimateTimeBranches(null, null, b);
      expect(r).toHaveLength(2);
      expect(r[0].group).not.toBe(r[1].group);
    }
  });

  it('Q1+Q3: 그룹이 커버하는 시간대에서는 유일 결정, 나머지는 0 (모순)', () => {
    for (const g of GROUPS) {
      const covered = new Set(estimateTimeBranches(g, null, null).map((t) => t.bucket));
      for (const b of BUCKETS) {
        expect(estimateTimeBranches(g, null, b)).toHaveLength(covered.has(b) ? 1 : 0);
      }
    }
  });

  it('Q1+Q2+Q3: 0 또는 1후보 (모순 조합은 0)', () => {
    for (const g of GROUPS) {
      for (const y of SIDES) {
        for (const b of BUCKETS) {
          expect(estimateTimeBranches(g, y, b).length).toBeLessThanOrEqual(1);
        }
      }
    }
    // 대표 모순 조합: 왕지+양지 → 자/오뿐인데 새벽 시간대와 교집합 없음
    expect(estimateTimeBranches('왕', '양', '새벽')).toHaveLength(0);
  });

  it('무응답은 필터하지 않는다', () => {
    expect(estimateTimeBranches(null, null, null)).toHaveLength(12);
  });
});
