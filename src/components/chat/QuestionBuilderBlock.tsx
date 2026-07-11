import React from 'react';
import type { QuestionBuilder } from '../../hooks/useQuestionBuilder';

/**
 * 질문 만들기 위저드 블록. 상담창 첫 화면에서 시나리오 선택지 자리를 대체해 렌더된다.
 * 버튼 스타일은 ChatOptionsBlock과 동일 — 장식 없이 본문 14px / 보조 12px 원칙 준수.
 */
export const QuestionBuilderBlock: React.FC<{ builder: QuestionBuilder }> = ({ builder }) => {
  const { step } = builder;
  if (!step) return null;

  return (
    <div className="w-full max-w-[96%] md:max-w-[92%] space-y-2">
      <div className="text-[12px] text-ink-500 px-1">
        질문 만들기 {step.stepNumber}/{step.totalSteps}
      </div>
      <p className="text-[14px] text-ink-800 px-1">{step.title}</p>
      <div className="flex flex-wrap gap-2">
        {step.options.map((opt) => (
          <button
            key={`builder-option-${opt.id}`}
            onClick={() => builder.select(opt.id)}
            className="px-3 py-2 min-h-[40px] rounded-xl text-[13px] font-semibold border transition-all bg-paper-50/75 border-ink-300/35 text-ink-700 hover:border-ink-500/50 hover:text-ink-900"
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3 px-1">
        {step.stepNumber > 1 && (
          <button onClick={builder.back} className="text-[13px] text-ink-500 hover:text-ink-900">
            이전
          </button>
        )}
        <button onClick={builder.cancel} className="text-[13px] text-ink-500 hover:text-ink-900">
          그만두기
        </button>
      </div>
    </div>
  );
};
