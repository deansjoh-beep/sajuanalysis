// 리포트 생성 파이프가 공유하는 타입 정의.
// (레거시 Firestore premiumOrders 주문 흐름은 제거됨 — 이 파일은 이제 타입 전용이다.)

export interface LifeEvent {
  year: number;
  description: string;
}

export type ProductType = 'premium' | 'yearly2026' | 'jobCareer' | 'loveMarriage';

export interface ReportInputData {
  name: string;
  gender: 'M' | 'F';
  birthDate: string;
  birthTime: string;
  isLunar: boolean;
  isLeap: boolean;
  unknownTime: boolean;
  concern: string;
  interest: string;
  reportLevel: 'basic' | 'advanced' | 'both';
  lifeEvents: LifeEvent[];
  adminNotes: string;
  productType?: ProductType;
  currentJob?: string;
  workHistory?: string;
  relationshipStatus?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  summary: string;
  content: string;
  daeunBlocks?: DaeunBlock[];
}

export interface DaeunBlock {
  label: string;
  startAge: number;
  endAge: number;
  content: string;
  lifeEvents: LifeEvent[];
}
