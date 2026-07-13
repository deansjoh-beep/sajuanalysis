/**
 * 질문 만들기(질문 빌더) 문답 트리.
 *
 * 상담창 첫 화면에서 막연한 고민을 4단계 객관식 문답(주제 → 상황 → 시기 → 답의 형태)으로
 * 좁혀 구체적인 질문 한 문장으로 조립한다. 전 과정 결정론 — LLM 호출 없음, 무료 턴 미소모.
 * 완성 질문은 자동 전송하지 않고 입력창에 채워 사용자가 수정·확정하게 한다.
 *
 * 선택지 추가 = 이 배열들에 항목 하나 추가로 끝나도록 설계한다(chatScenarios.ts와 동일 원칙).
 */

export interface BuilderSituation {
  id: string;
  /** 버튼에 표시되는 라벨. */
  label: string;
  /** 완성 질문의 첫 문장(고민 서술문). 마침표로 끝난다. */
  statement: string;
}

export interface BuilderTopic {
  id: string;
  label: string;
  situations: BuilderSituation[];
}

export interface BuilderTimeframe {
  id: string;
  label: string;
  /** 질문에 삽입되는 부사절. 뒤 문장에 자연스럽게 이어지도록 끝 공백/쉼표 포함, 없으면 ''. */
  clause: string;
}

export interface BuilderAnswerType {
  id: string;
  label: string;
  /** "제 사주로 볼 때 ..." 뒤에 붙는 요청문. 마침표로 끝난다. */
  request: string;
}

export const BUILDER_TOPICS: BuilderTopic[] = [
  {
    id: 'wealth',
    label: '재물·사업',
    situations: [
      { id: 'saving', label: '돈이 잘 안 모여요', statement: '돈이 잘 모이지 않아 고민입니다.' },
      { id: 'invest', label: '투자를 고민 중', statement: '투자를 해도 될지 고민하고 있습니다.' },
      { id: 'startup', label: '사업·창업 고민', statement: '사업(창업)을 시작할지 고민 중입니다.' },
      { id: 'income', label: '수입을 늘리고 싶어요', statement: '수입을 늘릴 방법을 찾고 있습니다.' },
    ],
  },
  {
    id: 'career',
    label: '직업·진로',
    situations: [
      { id: 'jobchange', label: '이직 고민', statement: '지금 직장에서 이직을 고민 중입니다.' },
      { id: 'independent', label: '독립·창업 vs 직장', statement: '직장 생활과 독립(창업·프리랜서) 사이에서 고민하고 있습니다.' },
      { id: 'lost', label: '진로 자체가 막막해요', statement: '진로 방향 자체가 막막한 상태입니다.' },
      { id: 'promotion', label: '승진·평가를 앞둠', statement: '승진·평가를 앞두고 있습니다.' },
    ],
  },
  {
    id: 'love',
    label: '연애·결혼',
    situations: [
      { id: 'meet', label: '좋은 인연을 만나고 싶어요', statement: '좋은 인연을 만나고 싶은데 잘 되지 않습니다.' },
      { id: 'current', label: '지금 만나는 사람이 고민', statement: '지금 만나는 사람과의 관계가 고민입니다.' },
      { id: 'marriage', label: '결혼을 고민 중', statement: '결혼을 진지하게 고민하고 있습니다.' },
      { id: 'breakup', label: '이별·재회 문제', statement: '이별(재회) 문제로 마음이 복잡합니다.' },
    ],
  },
  {
    id: 'health',
    label: '건강',
    situations: [
      { id: 'stamina', label: '체력이 예전 같지 않아요', statement: '체력이 예전 같지 않아 걱정입니다.' },
      { id: 'manage', label: '건강 관리법이 궁금해요', statement: '건강 관리를 어떻게 해야 할지 막막합니다.' },
      { id: 'mind', label: '스트레스·마음 건강', statement: '스트레스와 마음 건강이 고민입니다.' },
    ],
  },
  {
    id: 'relations',
    label: '대인관계',
    situations: [
      { id: 'work', label: '직장 인간관계가 힘들어요', statement: '직장(조직)에서의 인간관계가 힘듭니다.' },
      { id: 'family', label: '가족 관계 고민', statement: '가족과의 관계가 고민입니다.' },
      { id: 'friends', label: '친구·주변 사람 고민', statement: '친구·주변 사람과의 관계가 고민입니다.' },
      { id: 'partner', label: '동업·협력 관계 고민', statement: '동업·협력 관계를 고민 중입니다.' },
    ],
  },
  {
    id: 'timing',
    label: '시기·운세',
    situations: [
      { id: 'decision', label: '중요한 결정을 앞둠', statement: '중요한 결정을 앞두고 있습니다.' },
      { id: 'newstart', label: '새로운 일을 시작하려 해요', statement: '새로운 일을 시작하려고 합니다.' },
      { id: 'stuck', label: '요즘 일이 잘 안 풀려요', statement: '요즘 일이 잘 풀리지 않는 느낌입니다.' },
      { id: 'move', label: '이사·이동 등 큰 변화 계획', statement: '이사·이동 같은 큰 변화를 계획하고 있습니다.' },
    ],
  },
];

export const BUILDER_TIMEFRAMES: BuilderTimeframe[] = [
  { id: 'year', label: '올해', clause: '올해 기준으로, ' },
  { id: 'month', label: '이번 달', clause: '이번 달 기준으로, ' },
  { id: 'years', label: '향후 2~3년', clause: '향후 2~3년을 기준으로, ' },
  { id: 'none', label: '특정 시기 없음', clause: '' },
];

export const BUILDER_ANSWER_TYPES: BuilderAnswerType[] = [
  { id: 'go', label: '해도 될지(가부)', request: '지금 생각하는 방향으로 진행해도 좋을지 판단해 주세요.' },
  { id: 'when', label: '언제가 좋을지(시기)', request: '언제 움직이는 것이 좋을지 시기를 짚어주세요.' },
  { id: 'caution', label: '조심할 점(주의점)', request: '제가 조심해야 할 점을 알려주세요.' },
  { id: 'direction', label: '방향 제안', request: '어떤 방향으로 가면 좋을지 제안해 주세요.' },
];

/** 선택 결과를 질문 한 문장(고민 서술 + 시기 + 요청)으로 조립한다. */
export const assembleBuilderQuestion = (args: {
  statement: string;
  timeframeClause: string;
  request: string;
}): string => `${args.statement} ${args.timeframeClause}제 사주로 볼 때 ${args.request}`;
