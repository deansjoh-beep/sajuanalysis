/**
 * 생시추정 퀴즈 — 전통 생시추정법 3문항으로 시지(時支)를 좁히는 순수 로직.
 * 스펙: BIRTH_TIME_QUIZ_MODULE.md (판별축·수렴 성질·면책 문구 포함).
 *
 * 세 판별축(수면 자세=그룹, 가마 위치=음양, 전해 들은 시간대=하루 6분면)의
 * 조합으로 12지지가 유일하게 결정된다. 민간 전승 추정법이므로 UI에는
 * 반드시 면책 문구를 함께 표기한다.
 */

export type PostureGroup = '왕' | '생' | '고';
export type GamaSide = '양' | '음';
export type TimeBucket = '한밤' | '새벽' | '오전' | '한낮' | '오후' | '저녁';

export interface TimeBranch {
  branch: string;
  group: PostureGroup;
  yang: boolean;
  bucket: TimeBucket;
  /** 해당 시진의 중앙 정각(대표시각). 시간 입력란에 그대로 넣는 값. */
  hour: number;
  label: string;
}

export const TIME_BRANCHES: TimeBranch[] = [
  { branch: '자', group: '왕', yang: true,  bucket: '한밤', hour: 0,  label: '자시 (23~01시)' },
  { branch: '축', group: '고', yang: false, bucket: '한밤', hour: 2,  label: '축시 (01~03시)' },
  { branch: '인', group: '생', yang: true,  bucket: '새벽', hour: 4,  label: '인시 (03~05시)' },
  { branch: '묘', group: '왕', yang: false, bucket: '새벽', hour: 6,  label: '묘시 (05~07시)' },
  { branch: '진', group: '고', yang: true,  bucket: '오전', hour: 8,  label: '진시 (07~09시)' },
  { branch: '사', group: '생', yang: false, bucket: '오전', hour: 10, label: '사시 (09~11시)' },
  { branch: '오', group: '왕', yang: true,  bucket: '한낮', hour: 12, label: '오시 (11~13시)' },
  { branch: '미', group: '고', yang: false, bucket: '한낮', hour: 14, label: '미시 (13~15시)' },
  { branch: '신', group: '생', yang: true,  bucket: '오후', hour: 16, label: '신시 (15~17시)' },
  { branch: '유', group: '왕', yang: false, bucket: '오후', hour: 18, label: '유시 (17~19시)' },
  { branch: '술', group: '고', yang: true,  bucket: '저녁', hour: 20, label: '술시 (19~21시)' },
  { branch: '해', group: '생', yang: false, bucket: '저녁', hour: 22, label: '해시 (21~23시)' },
];

/** 답하지 않은 문항(null)은 필터하지 않는다. */
export function estimateTimeBranches(
  qPosture: PostureGroup | null,
  qGama: GamaSide | null,
  qTime: TimeBucket | null,
): TimeBranch[] {
  return TIME_BRANCHES.filter(
    (t) =>
      (!qPosture || t.group === qPosture) &&
      (!qGama || (qGama === '양') === t.yang) &&
      (!qTime || t.bucket === qTime),
  );
}

export const BIRTH_TIME_QUIZ_DISCLAIMER =
  '* 수면 자세·가마 위치로 생시를 가늠하는 민간 전승 추정법으로, 과학적 근거는 없으며 참고용입니다. 정확한 생시는 아기수첩이나 출생 병원의 출생증명서로 확인할 수 있습니다.';
