/**
 * 챗봇 시나리오 정의.
 *
 * 각 주제는 "어떤 엔진 카드를 먼저 보여줄지(cardKind) + LLM에 줄 해석 초점(promptFocus)
 * + 다음 후속 선택지(followups)"를 한 세트로 묶는다. 주제 추가 = 이 배열에 항목 하나
 * 추가로 끝나도록 설계한다(Phase B에서 10종으로 확장).
 *
 * ⚠️ Phase A 범위: 올해운·재물·대운 3종만.
 */
export type ScenarioCardKind = 'yearly' | 'wealth' | 'daeun';

export interface ChatScenario {
  /** 안정적 식별자(메시지 payload·분석 이벤트 키). */
  id: string;
  /** 버튼에 표시되는 라벨. */
  label: string;
  /** 봇이 해석 전에 먼저 렌더할 결정론적 카드 종류. */
  cardKind: ScenarioCardKind;
  /** LLM에 보낼 사용자 질문(사용자 말풍선으로도 표시). */
  seedQuestion: string;
  /** 시나리오별 해석 초점 — 시스템 지침에 주입된다. */
  promptFocus: string;
  /** 답변 뒤 제시할 후속 자유질문 선택지. */
  followups: string[];
}

export const CHAT_SCENARIOS: ChatScenario[] = [
  {
    id: 'yearly',
    label: '올해 운세',
    cardKind: 'yearly',
    seedQuestion: '올해 전체적인 운의 흐름이 어떤가요?',
    promptFocus:
      '제시된 [올해 세운 카드]의 천간십성·지지십성·지지운성만 근거로 올해의 큰 흐름을 짚는다. 카드에 없는 월별 예측이나 다른 연도는 언급하지 않는다.',
    followups: ['올해 재물운은 어떤가요?', '올해 조심해야 할 부분이 있을까요?', '올해 인간관계 흐름은요?'],
  },
  {
    id: 'wealth',
    label: '재물·사업',
    cardKind: 'wealth',
    seedQuestion: '제 사주에서 재물운은 어떤가요?',
    promptFocus:
      '먼저 재성(정재·편재)이 무엇인지 1~2문장의 일반 설명을 하고, 문단을 바꿔 [재물 구조 카드]에 드러난 이 사주의 재성 위치와 용신 관계를 별도로 해석한다. 일반 이론과 사용자 적용을 한 문단에 섞지 않는다.',
    followups: ['저는 사업이 맞나요, 직장이 맞나요?', '투자를 해도 괜찮은 사주인가요?', '돈이 모이는 시기는 언제인가요?'],
  },
  {
    id: 'daeun',
    label: '대운 흐름',
    cardKind: 'daeun',
    seedQuestion: '제 대운의 큰 흐름을 짚어주세요.',
    promptFocus:
      '제시된 [대운 흐름 카드]의 각 대운 간지·십성과 현재 대운(←현재) 표시만 근거로 인생 큰 흐름을 설명한다. 현재 대운을 중심으로 직전·직후 대운과의 변화를 짚는다.',
    followups: ['지금 대운은 저에게 어떤 시기인가요?', '다음 대운으로 넘어가면 뭐가 달라지나요?', '제 인생의 전성기는 언제인가요?'],
  },
];

export const getScenarioById = (id: string): ChatScenario | undefined =>
  CHAT_SCENARIOS.find((s) => s.id === id);
