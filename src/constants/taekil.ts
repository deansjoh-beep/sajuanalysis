import { TaekilCategory } from '../utils/taekilEngine';

export interface TaekilFieldOption {
  value: string;
  label: string;
}

export interface TaekilFieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'select';
  options?: TaekilFieldOption[];
}

export const TAEKIL_CATEGORIES: TaekilCategory[] = ['결혼', '이사', '개업', '출산', '계약', '수술', '시험', '여행', '이장', '만남'];

export const WEEKDAY_OPTIONS = [
  { value: '0', label: '일요일' },
  { value: '1', label: '월요일' },
  { value: '2', label: '화요일' },
  { value: '3', label: '수요일' },
  { value: '4', label: '목요일' },
  { value: '5', label: '금요일' },
  { value: '6', label: '토요일' }
];

export const TAEKIL_CATEGORY_CONTENT: Record<TaekilCategory, {
  eyebrow: string;
  title: string;
  description: string;
  checklist: string[];
  detailLabel: string;
  detailPlaceholder: string;
}> = {
  결혼: {
    eyebrow: 'Marriage Taekil',
    title: '신랑·신부 기준 결혼 택일',
    description: '양가 일정, 예식 진행감, 두 사람의 사주 흐름을 함께 고려하는 결혼 전용 페이지입니다.',
    checklist: ['신부 기본 사주 확인', '신랑 생년월일시 입력', '예식 희망 기간 설정'],
    detailLabel: '예식 관련 메모',
    detailPlaceholder: '예: 토요일 예식 선호, 양가 상견례 일정 고려, 하객 이동 거리 등'
  },
  이사: {
    eyebrow: 'Moving Taekil',
    title: '이사 일정 중심 택일',
    description: '입주일, 계약 잔금일, 짐 이동일처럼 실제 생활 일정에 맞춘 이사 전용 페이지입니다.',
    checklist: ['이사 기간 범위', '입주/잔금 일정 메모', '가족 동행 여부 정리'],
    detailLabel: '이사 관련 메모',
    detailPlaceholder: '예: 남향 집, 잔금일 우선, 주말 이사만 가능 등'
  },
  개업: {
    eyebrow: 'Business Opening',
    title: '오픈일 중심 개업 택일',
    description: '업종과 영업 개시 타이밍을 반영해서 오픈일 검토에 집중한 개업 전용 페이지입니다.',
    checklist: ['오픈 목표 기간', '업종/상권 메모', '행사 오픈 여부 정리'],
    detailLabel: '개업 관련 메모',
    detailPlaceholder: '예: 카페 오픈, 오전 커팅식 예정, 유동인구 많은 금토 희망 등'
  },
  출산: {
    eyebrow: 'Childbirth Taekil',
    title: '출산 일정 중심 택일',
    description: '예정일과 병원 스케줄을 바탕으로 출산 시기 판단에 집중하는 페이지입니다.',
    checklist: ['예정 기간 설정', '병원 일정 확인', '자연분만/수술 여부 메모'],
    detailLabel: '출산 관련 메모',
    detailPlaceholder: '예: 제왕절개 후보일 검토, 오전 수술 가능, 병원 휴진일 제외 등'
  },
  계약: {
    eyebrow: 'Contract Taekil',
    title: '서명·체결 중심 계약 택일',
    description: '계약 체결, 서명, 입금과 같이 문서 효력이 발생하는 시점 검토에 맞춘 페이지입니다.',
    checklist: ['계약 희망 기간', '계약 성격 메모', '상대방 일정 고려'],
    detailLabel: '계약 관련 메모',
    detailPlaceholder: '예: 부동산 계약, 오후 서명, 상대방 해외 체류 일정 고려 등'
  },
  수술: {
    eyebrow: 'Surgery Taekil',
    title: '수술 일정 중심 택일',
    description: '의학적 우선순위를 해치지 않는 범위에서 일정 검토를 돕는 수술 전용 페이지입니다.',
    checklist: ['병원 가능 기간', '회복 일정 메모', '가족 보호자 동행 여부'],
    detailLabel: '수술 관련 메모',
    detailPlaceholder: '예: 오전 수술 희망, 입원 3일 예정, 보호자 동행 가능일 등'
  },
  시험: {
    eyebrow: 'Exam Taekil',
    title: '시험·면접 일정 중심 택일',
    description: '시험 응시, 구술 면접, 발표일정 등 긴장도가 높은 이벤트를 위한 페이지입니다.',
    checklist: ['시험 기간 설정', '시험 종류 메모', '오전/오후 선호 여부'],
    detailLabel: '시험 관련 메모',
    detailPlaceholder: '예: 자격증 면접, 오전 응시 선호, 발표 전날 컨디션 관리 등'
  },
  여행: {
    eyebrow: 'Travel Taekil',
    title: '출발일 중심 여행 택일',
    description: '출국일, 출발일, 이동 시작 시점처럼 여행의 첫 리듬을 잡는 페이지입니다.',
    checklist: ['출발 기간 설정', '목적지 메모', '동행인 일정 고려'],
    detailLabel: '여행 관련 메모',
    detailPlaceholder: '예: 일본 가족여행, 새벽 비행기 제외, 2박 3일 일정 등'
  },
  이장: {
    eyebrow: 'Relocation of Grave',
    title: '이장 일정 중심 택일',
    description: '가족 일정과 현장 진행을 고려해 이장 후보일을 정리하는 페이지입니다.',
    checklist: ['가족 가능 기간', '현장 준비 메모', '주요 참여자 일정 정리'],
    detailLabel: '이장 관련 메모',
    detailPlaceholder: '예: 주말만 가능, 장지 이동 거리 고려, 형제자매 전원 참석 희망 등'
  },
  만남: {
    eyebrow: 'Meeting Taekil',
    title: '중요한 만남 중심 택일',
    description: '상견례, 첫 만남, 중요한 제안 미팅처럼 관계의 시작점을 고려하는 페이지입니다.',
    checklist: ['만남 기간 설정', '만남 목적 메모', '상대 일정 고려'],
    detailLabel: '만남 관련 메모',
    detailPlaceholder: '예: 상견례, 첫 투자 미팅, 저녁 만남 선호 등'
  }
};

export const TAEKIL_CATEGORY_FORM_FIELDS: Record<Exclude<TaekilCategory, '결혼'>, TaekilFieldConfig[]> = {
  이사: [
    { key: 'moveType', label: '이사 유형', type: 'select', options: [{ value: '입주', label: '입주' }, { value: '전세/매매', label: '전세/매매' }, { value: '사무실 이전', label: '사무실 이전' }] },
    { key: 'moveDirection', label: '우선 고려 방향', placeholder: '예: 남향, 동남향, 방향 무관' },
    { key: 'moveConstraint', label: '실무 제약사항', placeholder: '예: 잔금일 우선, 주말만 가능, 엘리베이터 작업 예약 등' }
  ],
  개업: [
    { key: 'openingBusinessType', label: '업종', placeholder: '예: 카페, 병원, 온라인 쇼핑몰' },
    { key: 'openingStyle', label: '오픈 방식', type: 'select', options: [{ value: '소프트 오픈', label: '소프트 오픈' }, { value: '정식 오픈', label: '정식 오픈' }, { value: '행사 오픈', label: '행사 오픈' }] },
    { key: 'openingPriority', label: '우선순위', placeholder: '예: 유동인구 많은 금요일, 오전 커팅식, 점심 영업 전 시작 등' }
  ],
  출산: [
    { key: 'childbirthMethod', label: '출산 방식', type: 'select', options: [{ value: '자연분만', label: '자연분만' }, { value: '제왕절개', label: '제왕절개' }, { value: '미정', label: '미정' }] },
    { key: 'childbirthHospital', label: '병원/일정 메모', placeholder: '예: 오전 수술 가능, 주치의 가능일 있음' },
    { key: 'childbirthPriority', label: '우선 고려사항', placeholder: '예: 산모 회복 우선, 주말 제외, 38주차 안쪽 선호' }
  ],
  계약: [
    { key: 'contractType', label: '계약 종류', placeholder: '예: 부동산, 투자, 프리랜서, 법인 계약' },
    { key: 'contractCounterparty', label: '상대방/기관', placeholder: '예: 개인 임대인, 법인, 투자사' },
    { key: 'contractPriority', label: '체결 포인트', placeholder: '예: 오후 서명, 입금일 연동, 대리인 참석 가능 등' }
  ],
  수술: [
    { key: 'surgeryDepartment', label: '수술 종류/진료과', placeholder: '예: 정형외과, 치과, 안과' },
    { key: 'surgerySchedule', label: '병원 가능 일정', placeholder: '예: 화목 오전만 가능, 입원 2박 3일 예정' },
    { key: 'surgeryPriority', label: '우선 고려사항', placeholder: '예: 보호자 동행, 회복 기간, 연차 사용 일정 등' }
  ],
  시험: [
    { key: 'examType', label: '시험/면접 종류', placeholder: '예: 공무원 면접, 자격증 실기, 대학원 구술' },
    { key: 'examSession', label: '응시 시간대', type: 'select', options: [{ value: '오전', label: '오전' }, { value: '오후', label: '오후' }, { value: '종일', label: '종일' }, { value: '미정', label: '미정' }] },
    { key: 'examPriority', label: '컨디션 관리 포인트', placeholder: '예: 발표 전날 안정감, 아침 컨디션 좋음 등' }
  ],
  여행: [
    { key: 'travelDestination', label: '목적지', placeholder: '예: 일본 오사카, 제주도, 유럽' },
    { key: 'travelCompanion', label: '동행인', placeholder: '예: 가족 4인, 배우자, 친구 2명' },
    { key: 'travelPriority', label: '출발 조건', placeholder: '예: 새벽 비행 제외, 주말 출발, 장거리 이동 최소화 등' }
  ],
  이장: [
    { key: 'graveLocation', label: '장지/이장 위치', placeholder: '예: 선산, 공원묘지, 지방 이동' },
    { key: 'graveParticipants', label: '참여 인원', placeholder: '예: 형제자매 전원, 장손 포함, 가족 대표만 참석' },
    { key: 'gravePriority', label: '진행 조건', placeholder: '예: 주말만 가능, 현장 이동 2시간 이내, 비 예보 회피 등' }
  ],
  만남: [
    { key: 'meetingPurpose', label: '만남 목적', placeholder: '예: 상견례, 첫 투자 미팅, 중요한 제안' },
    { key: 'meetingCounterparty', label: '상대 정보', placeholder: '예: 예비 사돈, 투자자, 거래처 대표' },
    { key: 'meetingPriority', label: '선호 조건', placeholder: '예: 저녁 시간대, 식사 자리 포함, 주중만 가능 등' }
  ]
};
