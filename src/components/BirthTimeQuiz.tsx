import { useState } from 'react';
import {
  BIRTH_TIME_QUIZ_DISCLAIMER,
  estimateTimeBranches,
  type GamaSide,
  type PostureGroup,
  type TimeBucket,
} from '../utils/birthTimeQuiz';

/**
 * 생시추정 퀴즈 패널 — 시간 입력이 "모름"일 때만 호출부가 렌더한다.
 * 후보 클릭 시 onSelect(대표시각)로 시간을 반영하고 패널을 닫는다.
 * 스펙: BIRTH_TIME_QUIZ_MODULE.md
 */
export function BirthTimeQuiz({ onSelect }: { onSelect: (hour: number) => void }) {
  const [open, setOpen] = useState(false);
  const [qPosture, setQPosture] = useState<PostureGroup | null>(null);
  const [qGama, setQGama] = useState<GamaSide | null>(null);
  const [qTime, setQTime] = useState<TimeBucket | null>(null);

  const answered = qPosture !== null || qGama !== null || qTime !== null;
  const candidates = estimateTimeBranches(qPosture, qGama, qTime);

  const pill = (selected: boolean) =>
    `px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
      selected
        ? 'bg-ink-900 text-paper-50'
        : 'border border-ink-300/40 bg-paper-50/80 text-ink-500'
    }`;

  const questions: {
    key: string;
    title: string;
    value: string | null;
    set: (v: string | null) => void;
    options: { v: string; t: string }[];
  }[] = [
    {
      key: 'posture',
      title: '1. 평소 잠자는 자세는?',
      value: qPosture,
      set: (v) => setQPosture(v as PostureGroup | null),
      options: [
        { v: '왕', t: '하늘을 보고 반듯이 잔다' },
        { v: '생', t: '옆으로 누워 잔다' },
        { v: '고', t: '엎드리거나 뒤척이며 잔다' },
      ],
    },
    {
      key: 'gama',
      title: '2. 정수리 가마의 위치는?',
      value: qGama,
      set: (v) => setQGama(v as GamaSide | null),
      options: [
        { v: '양', t: '오른쪽에 있다' },
        { v: '음', t: '왼쪽에 있다' },
      ],
    },
    {
      key: 'time',
      title: '3. 가족에게 들은 대략적인 출생 시간대는?',
      value: qTime,
      set: (v) => setQTime(v as TimeBucket | null),
      options: [
        { v: '한밤', t: '한밤 (23~03시)' },
        { v: '새벽', t: '새벽 (03~07시)' },
        { v: '오전', t: '오전 (07~11시)' },
        { v: '한낮', t: '한낮 (11~15시)' },
        { v: '오후', t: '오후 (15~19시)' },
        { v: '저녁', t: '저녁 (19~23시)' },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[12px] font-medium text-ink-500 underline underline-offset-2"
      >
        {open ? '생시추정 퀴즈 접기' : '생시를 모르시나요? 퀴즈로 짐작해 보기'}
      </button>

      {open && (
        <div className="space-y-4 p-3 rounded-2xl bg-paper-100/60 border border-ink-300/30">
          {questions.map((q) => (
            <div key={q.key} className="space-y-2">
              <p className="text-[14px] font-medium text-ink-900">{q.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => q.set(q.value === o.v ? null : o.v)}
                    className={pill(q.value === o.v)}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {answered && (
            <div className="space-y-2 border-t border-ink-300/30 pt-3">
              {candidates.length === 0 ? (
                <p className="text-[14px] text-ink-700">
                  답변이 서로 어긋나 일치하는 시가 없습니다. 답을 바꾸거나 일부를 해제해 보세요.
                </p>
              ) : (
                <>
                  <p className="text-[14px] text-ink-700">
                    {candidates.length === 1
                      ? '추정된 생시 — 눌러서 시간에 반영하세요'
                      : `후보 ${candidates.length}개 — 가장 가까운 것을 눌러 반영하세요`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.map((c) => (
                      <button
                        key={c.branch}
                        type="button"
                        onClick={() => {
                          onSelect(c.hour);
                          setOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-ink-900 text-paper-50"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-[12px] text-ink-500">{BIRTH_TIME_QUIZ_DISCLAIMER}</p>
        </div>
      )}
    </div>
  );
}
