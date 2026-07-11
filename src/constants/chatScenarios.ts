/**
 * 챗봇 시나리오 정의.
 *
 * 각 주제는 "어떤 엔진 카드를 먼저 보여줄지(cardKind) + LLM에 줄 해석 초점(promptFocus)
 * + 다음 후속 선택지(followups/related)"를 한 세트로 묶는다. 주제 추가 = 이 배열에
 * 항목 하나 추가로 끝나도록 설계한다.
 *
 * 카드 없는 자유 질문은 별도 시나리오가 아니라 하단 입력창이 담당한다(10번째 경로).
 */
export type ScenarioCardKind =
  | 'yearly'
  | 'monthly'
  | 'daily'
  | 'wealth'
  | 'career'
  | 'love'
  | 'health'
  | 'relations'
  | 'daeun';

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
  /** 답변 뒤 함께 제시할 연관 주제(시나리오 id, 2개 내외). */
  related: string[];
}

export const CHAT_SCENARIOS: ChatScenario[] = [
  {
    id: 'yearly',
    label: '올해 운세',
    cardKind: 'yearly',
    seedQuestion: '올해 전체적인 운의 흐름이 어떤가요?',
    promptFocus:
      '제시된 [세운 카드]의 천간십성·지지십성·지지운성만 근거로 올해의 큰 흐름을 짚는다. 카드에 없는 월별 예측이나 다른 연도는 언급하지 않는다.',
    followups: ['올해 재물운은 어떤가요?', '올해 조심해야 할 부분이 있을까요?'],
    related: ['monthly', 'wealth'],
  },
  {
    id: 'monthly',
    label: '이달 운세',
    cardKind: 'monthly',
    seedQuestion: '이번 달 운의 흐름은 어떤가요?',
    promptFocus:
      '제시된 [월운 카드]의 천간십성·지지십성·지지운성만 근거로 이번 달 흐름을 짧게 짚는다. 카드에 없는 날짜별 예측은 하지 않는다.',
    followups: ['이번 달 어떤 일에 집중하면 좋을까요?', '이번 달 인간관계는 어떤가요?'],
    related: ['yearly', 'daily'],
  },
  {
    id: 'daily',
    label: '오늘 운세',
    cardKind: 'daily',
    seedQuestion: '오늘의 운은 어떤가요?',
    promptFocus:
      '제시된 [일진 카드]의 천간십성·지지십성·지지운성만 근거로 오늘 하루의 기운을 가볍게 짚는다. 과도한 단정은 피하고 실천 팁 한 가지를 곁들인다.',
    followups: ['오늘 무엇을 하면 좋을까요?', '오늘 조심할 점이 있나요?'],
    related: ['monthly', 'yearly'],
  },
  {
    id: 'wealth',
    label: '재물·사업',
    cardKind: 'wealth',
    seedQuestion: '제 사주에서 재물운은 어떤가요?',
    promptFocus:
      '먼저 재성(정재·편재)이 무엇인지 1~2문장의 일반 설명을 하고, 문단을 바꿔 [재물 구조 카드]에 드러난 이 사주의 재성 위치와 용신 관계를 별도로 해석한다. 일반 이론과 사용자 적용을 한 문단에 섞지 않는다.',
    followups: ['저는 사업이 맞나요, 직장이 맞나요?', '돈이 모이는 시기는 언제인가요?'],
    related: ['career', 'yearly'],
  },
  {
    id: 'career',
    label: '직업·이직',
    cardKind: 'career',
    seedQuestion: '제게 맞는 직업이나 진로는 어떤가요?',
    promptFocus:
      '먼저 격국과 관성(정관·편관)·인성(정인·편인)이 진로에서 뜻하는 바를 1~2문장 일반 설명하고, 문단을 바꿔 [직업 구조 카드]의 격국·십성 분포·관성/인성 위치를 근거로 이 사주에 맞는 방향을 해석한다.',
    followups: ['조직 생활이 맞을까요, 프리랜서가 맞을까요?', '이직을 고민 중인데 어떤가요?'],
    related: ['wealth', 'relations'],
  },
  {
    id: 'love',
    label: '연애·결혼',
    cardKind: 'love',
    seedQuestion: '제 연애운과 결혼운은 어떤가요?',
    promptFocus:
      '배우자궁(일지)과 지장간, 도화·홍염 신살이 관계운에서 뜻하는 바를 1~2문장 일반 설명하고, 문단을 바꿔 [연애·결혼 카드]에 드러난 이 사주의 일지·신살을 근거로 관계 성향을 해석한다. 결혼 시점을 단정하지 않는다.',
    followups: ['어떤 사람과 잘 맞을까요?', '결혼 시기는 대략 언제쯤일까요?'],
    related: ['relations', 'yearly'],
  },
  {
    id: 'health',
    label: '건강',
    cardKind: 'health',
    seedQuestion: '제 사주로 본 건강은 어떤가요?',
    promptFocus:
      '오행 분포의 과다·부족과 조후(한난)가 건강에서 뜻하는 바를 1~2문장 일반 설명하고, 문단을 바꿔 [건강 카드]의 오행 분포·부족 오행·조후를 근거로 주의할 부분과 보완 방향을 해석한다. 의학적 진단·처방은 하지 않는다.',
    followups: ['어떤 생활 습관이 도움이 될까요?', '계절이나 시기별로 조심할 점이 있나요?'],
    related: ['yearly', 'daeun'],
  },
  {
    id: 'relations',
    label: '대인관계',
    cardKind: 'relations',
    seedQuestion: '제 대인관계 성향은 어떤가요?',
    promptFocus:
      '비겁(형제·동료·경쟁)·관성(윗사람·조직)·인성(조력자)이 대인관계에서 뜻하는 바를 1~2문장 일반 설명하고, 문단을 바꿔 [대인관계 카드]에 드러난 이 사주의 십성 배치를 근거로 관계 패턴을 해석한다.',
    followups: ['직장에서 사람 관계는 어떤가요?', '저와 잘 맞는 유형은 어떤 사람인가요?'],
    related: ['career', 'love'],
  },
  {
    id: 'daeun',
    label: '대운 흐름',
    cardKind: 'daeun',
    seedQuestion: '제 대운의 큰 흐름을 짚어주세요.',
    promptFocus:
      '제시된 [대운 흐름 카드]의 각 대운 간지·십성과 현재 대운(←현재) 표시만 근거로 인생 큰 흐름을 설명한다. 현재 대운을 중심으로 직전·직후 대운과의 변화를 짚는다.',
    followups: ['지금 대운은 저에게 어떤 시기인가요?', '제 인생의 전성기는 언제인가요?'],
    related: ['yearly', 'health'],
  },
];

export const getScenarioById = (id: string): ChatScenario | undefined =>
  CHAT_SCENARIOS.find((s) => s.id === id);
