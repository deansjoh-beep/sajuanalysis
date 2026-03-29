import React, { useState, useEffect, useRef, useMemo } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Send, 
  User, 
  Sparkles, 
  RefreshCw, 
  MessageCircle,
  FileText,
  LayoutDashboard,
  Compass,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  Info,
  Database,
  Lock,
  Puzzle,
  Bot,
  BookOpen,
  Zap,
  Cpu,
  Waves,
  Download,
  Mail,
  Check,
  Mic,
  ExternalLink,
  Ticket
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from 'rehype-raw';
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { jsPDF } from "jspdf";
import * as htmlToImage from "html-to-image";
import { getSajuData, getDaeunData, calculateYongshin, hanjaToHangul, elementMap, yinYangMap, calculateDeity, calculateGyeok } from "./utils/saju";
import { TaekilCategory } from "./utils/taekilEngine";
import { SUGGESTED_QUESTIONS, CATEGORIES, BASIC_CHAT_CATEGORIES, BASIC_CATEGORY_QUESTION_POOL } from "./constants/questions";
import { BLOG_POSTS, BlogPost } from "./constants/blog";
import { Newspaper, ArrowLeft, Plus, Trash2, Edit2, X, Save, ArrowRight, Image as ImageIcon, Maximize } from "lucide-react";

import { SAJU_GUIDELINE, CONSULTING_GUIDELINE, REPORT_GUIDELINE, BASIC_CONSULTING_GUIDELINE, ADVANCED_CONSULTING_GUIDELINE, BASIC_REPORT_GUIDELINE, ADVANCED_REPORT_GUIDELINE } from "./constants/guidelines";
import { db, auth, googleProvider, signInWithPopup, signOut, ref, uploadBytes, getDownloadURL, storage } from "./firebase";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  getDocFromServer, 
  increment,
  doc 
} from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

// Types
interface Message {
  role: "user" | "model";
  text: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Saju Calculation Tool for Gemini
const calculateSajuForPerson = (args: any) => {
  try {
    const { birthDate, birthTime, isLunar, isLeap, gender, personName, unknownTime } = args;
    const saju = getSajuData(birthDate, birthTime, isLunar, !!isLeap, !!unknownTime);
    const daeun = getDaeunData(birthDate, birthTime, isLunar, !!isLeap, gender as 'M' | 'F');
    const yongshin = calculateYongshin(saju);
    const gyeok = calculateGyeok(saju);
    
    const sajuText = saju.map(p => `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja}) - 십성: ${p.stem.deity}/${p.branch.deity}`).join('\n');
    const daeunText = daeun.map(d => `${d.startAge}세 대운: ${d.stem.hangul}${d.branch.hangul} (${hanjaToHangul[d.stem]}${hanjaToHangul[d.branch]})`).join(', ');
    
    return {
      personName,
      saju: sajuText,
      daeun: daeunText,
      yongshin: `${yongshin.yongshin} (기운: ${yongshin.strength}, 점수: ${yongshin.score})`,
      gyeok: `${gyeok.gyeok} (구성: ${gyeok.composition})`
    };
  } catch (e) {
    return { error: "사주 계산 중 오류가 발생했습니다. 날짜와 시간 형식을 확인해주세요. (예: 1990-01-01, 14:30)" };
  }
};

const sajuToolDeclaration = {
  name: "calculateSajuForPerson",
  parameters: {
    type: Type.OBJECT,
    description: "타인의 생년월일시 정보를 바탕으로 사주 팔자와 대운을 계산합니다. 궁합 분석이나 제3자(가족, 친구 등) 상담 시 반드시 이 도구를 사용하여 정확한 데이터를 얻어야 합니다.",
    properties: {
      birthDate: { type: Type.STRING, description: "생년월일 (YYYY-MM-DD 형식)" },
      birthTime: { type: Type.STRING, description: "생시 (HH:mm 형식, 모를 경우 '12:00')" },
      isLunar: { type: Type.BOOLEAN, description: "음력 여부 (true: 음력, false: 양력)" },
      isLeap: { type: Type.BOOLEAN, description: "윤달 여부 (음력일 경우에만 해당)" },
      gender: { type: Type.STRING, description: "성별 ('M': 남성, 'F': 여성)" },
      personName: { type: Type.STRING, description: "대상자의 이름 또는 호칭 (예: '남자친구', '상대방', '어머니')" },
      unknownTime: { type: Type.BOOLEAN, description: "생시를 모르는지 여부" }
    },
    required: ["birthDate", "birthTime", "isLunar", "gender"]
  }
};

// Helper to get Gemini AI instance
const getGeminiAI = () => {
  const windowKey = (window as any).GEMINI_API_KEY;
  const viteKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const processKey = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY);

  console.log("[DEBUG] API Key Retrieval Attempt:");
  console.log("  window.GEMINI_API_KEY:", !!windowKey);
  console.log("  import.meta.env.VITE_GEMINI_API_KEY:", !!viteKey);
  console.log("  process.env.GEMINI_API_KEY:", !!processKey);

  const apiKey = windowKey || viteKey || processKey;

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    console.error("[ERROR] Gemini API Key is missing.");
    throw new Error("API 키가 설정되지 않았습니다. 프로젝트 루트의 .env.local 파일에 GEMINI_API_KEY 또는 VITE_GEMINI_API_KEY를 설정한 뒤 개발 서버를 재시작해 주세요.");
  }
  return new GoogleGenAI({ apiKey });
};

interface Guidelines {
  saju: string;
  consulting: string;
  report: string;
}

interface UserData {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  calendarType: 'solar' | 'lunar' | 'leap';
  gender: 'M' | 'F';
  unknownTime: boolean;
}

interface TaekilTimeSlot {
  time: string;
  score: number;
  reason: string;
}

interface TaekilScoreFactor {
  label: string;
  weight: number;
  type: 'plus' | 'minus' | 'info';
}

interface TaekilResultItem {
  date: string;
  rating: number;
  reasons: string[];
  topTimeSlots: TaekilTimeSlot[];
  factors: TaekilScoreFactor[];
}

interface TaekilFieldOption {
  value: string;
  label: string;
}

interface TaekilFieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'select';
  options?: TaekilFieldOption[];
}

const TAEKIL_CATEGORIES: TaekilCategory[] = ['결혼', '이사', '개업', '출산', '계약', '수술', '시험', '여행', '이장', '만남'];

const WEEKDAY_OPTIONS = [
  { value: '0', label: '일요일' },
  { value: '1', label: '월요일' },
  { value: '2', label: '화요일' },
  { value: '3', label: '수요일' },
  { value: '4', label: '목요일' },
  { value: '5', label: '금요일' },
  { value: '6', label: '토요일' }
];

const TAEKIL_CATEGORY_CONTENT: Record<TaekilCategory, {
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

const TAEKIL_CATEGORY_FORM_FIELDS: Record<Exclude<TaekilCategory, '결혼'>, TaekilFieldConfig[]> = {
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

const TAEKIL_SECTION_CARD_CLASS = 'rounded-3xl border p-4 md:p-6 bg-zinc-50 border-zinc-200';
const TAEKIL_Q_BADGE_CLASS = 'text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-500';
const TAEKIL_LABEL_CLASS = 'text-xs font-bold text-zinc-500';
const TAEKIL_HELP_TEXT_CLASS = 'mt-1 text-xs text-zinc-500';
const TAEKIL_FIELD_CLASS = 'w-full rounded-2xl border px-4 py-3 text-sm outline-none bg-white border-zinc-200 text-zinc-900';
const TAEKIL_FIELD_PLACEHOLDER_CLASS = `${TAEKIL_FIELD_CLASS} placeholder:text-zinc-500`;

const HanjaBox: React.FC<{ 
  hanja: string, 
  size?: 'sm' | 'md' | 'lg', 
  deity?: string,
  deityPosition?: 'top' | 'bottom',
  highlight?: boolean
}> = ({ hanja, size = 'md', deity, deityPosition, highlight = false }) => {
  const element = elementMap[hanja];
  const isYang = yinYangMap[hanja] === '+';
  const emphasisClasses = highlight ? 'ring-2 ring-indigo-500/70 shadow-lg shadow-indigo-500/20 scale-110' : '';
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px] rounded',
    md: 'w-10 h-10 text-xl rounded-lg',
    lg: 'w-12 h-12 text-2xl rounded-xl'
  };

  const deityEl = deity ? (
    <span className={`text-[9px] font-title font-bold text-indigo-600 absolute ${deityPosition === 'top' ? '-top-3.5' : '-bottom-3.5'} left-1/2 -translate-x-1/2 whitespace-nowrap`}>
      {deity}
    </span>
  ) : null;

  if (hanja === '?' || !element) {
    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div className={`${sizeClasses[size]} border-2 border-zinc-500/30 flex items-center justify-center opacity-30 ${emphasisClasses}`}>
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  }

  // Metal Special Rules (庚, 申, 辛, 酉)
  if (element === 'metal') {
    const silverColor = 'bg-zinc-100 border-zinc-200';
    const whiteColor = 'bg-white border-zinc-100';
    
    if (isYang) {
      // Yang Metal: White background, Silver text
      return (
        <div className="relative">
          {deityPosition === 'top' && deityEl}
          <div className={`${sizeClasses[size]} ${whiteColor} text-zinc-500 border flex items-center justify-center font-bold ${emphasisClasses}`}>
            {hanja}
          </div>
          {deityPosition === 'bottom' && deityEl}
        </div>
      );
    } else {
      // Yin Metal: Silver background, White text
      return (
        <div className="relative">
          {deityPosition === 'top' && deityEl}
          <div className={`${sizeClasses[size]} ${silverColor} text-zinc-600 border flex items-center justify-center font-bold ${emphasisClasses}`}>
            {hanja}
          </div>
          {deityPosition === 'bottom' && deityEl}
        </div>
      );
    }
  }

  const styles: Record<string, { bg: string, text: string, border: string, yinText: string }> = {
    wood: { 
      bg: 'bg-emerald-500', 
      text: 'text-emerald-600', 
      border: 'border-emerald-500', 
      yinText: 'text-white' 
    },
    fire: { 
      bg: 'bg-red-500', 
      text: 'text-red-600', 
      border: 'border-red-500', 
      yinText: 'text-white' 
    },
    earth: { 
      bg: 'bg-amber-400', 
      text: 'text-amber-600', 
      border: 'border-amber-400', 
      yinText: 'text-zinc-900' 
    },
    water: { 
      bg: 'bg-zinc-900', 
      text: 'text-zinc-900', 
      border: 'border-zinc-900', 
      yinText: 'text-white' 
    },
  };

  const style = styles[element];

  if (isYang) {
    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div className={`${sizeClasses[size]} bg-transparent border-2 ${style.border} ${style.text} flex items-center justify-center font-bold ${emphasisClasses}`}>
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  } else {
    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div className={`${sizeClasses[size]} ${style.bg} border-2 ${style.border} ${style.yinText} flex items-center justify-center font-bold ${emphasisClasses}`}>
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  }
};

const ReportAccordion: React.FC<{ content: string; forceOpen?: boolean }> = ({ content, forceOpen }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Parse the content into sections
  const { greeting, sections } = useMemo(() => {
    if (!content) return { greeting: "", sections: [] };

    try {
      // 1. Extract greeting: everything before the first [SECTION]
      const firstSectionIndex = content.indexOf('[SECTION]');
      let greetingText = "";
      let sectionsPart = content;

      if (firstSectionIndex !== -1) {
        greetingText = content.substring(0, firstSectionIndex).replace(/\[인사말\]/g, '').trim();
        sectionsPart = content.substring(firstSectionIndex);
      } else {
        // If no [SECTION] found, treat everything as greeting or raw content
        greetingText = content.replace(/\[인사말\]/g, '').trim();
        sectionsPart = "";
      }

      // 2. Parse sections
      // We split by [SECTION] and then parse each part
      const parts = sectionsPart.split(/\[SECTION\]/).filter(p => p.trim());
      const parsedSections = parts.map(part => {
        // Each part looks like: "Title [KEYWORD] Key [CONTENT] Body [END]"
        const match = part.match(/^(.*?)\s*\[KEYWORD\]\s*(.*?)\s*\[CONTENT\]\s*([\s\S]*)$/);
        if (match) {
          const title = match[1].trim();
          const keyword = match[2].trim();
          const body = match[3].replace(/\[END\]/g, '').trim();
          
          return {
            header: `${title} : ${keyword}`,
            body: body
          };
        }
        // Fallback for malformed section: treat the whole part as body with a generic title
        return {
          header: "상세 분석",
          body: part.replace(/\[KEYWORD\]|\[CONTENT\]|\[END\]/g, '').trim()
        };
      });

      return { greeting: greetingText, sections: parsedSections };
    } catch (err) {
      console.error("[ERROR] Failed to parse report content:", err);
      return { greeting: "", sections: [] };
    }
  }, [content]);

  // Debug log to see raw content if needed
  useEffect(() => {
    if (content) {
      console.log("[DEBUG] Report Content Length:", content.length);
      console.log("[DEBUG] Sections Found:", sections.length);
    }
  }, [content, sections]);

  if (sections.length === 0) {
    return (
      <div className="markdown-body prose max-w-none text-sm p-4">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {greeting && (
        <div className={`p-6 md:p-8 rounded-[2.5rem] bg-indigo-50 text-indigo-950 border-indigo-100 font-handwriting text-2xl md:text-3xl leading-relaxed mb-8 shadow-sm border`}>
          <ReactMarkdown>{greeting}</ReactMarkdown>
        </div>
      )}
      {sections.map((section, index) => {
        const isOpen = forceOpen || openIndex === index;
        return (
          <div 
            key={index} 
            className={`rounded-2xl border transition-all overflow-hidden bg-white border-black/5 shadow-sm`}
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-5 py-4 flex items-center justify-between text-left group"
            >
              <div className="flex-1 pr-4">
                <h3 className={`text-sm font-bold leading-tight transition-colors text-zinc-800 group-hover:text-indigo-600`}>
                  {section.header}
                </h3>
              </div>
              {!forceOpen && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isOpen ? 'bg-indigo-500 text-white rotate-180 shadow-lg shadow-indigo-500/20' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              )}
            </button>
            
            <AnimatePresence initial={!forceOpen}>
              {isOpen && (
                <motion.div
                  initial={forceOpen ? { opacity: 1, height: 'auto' } : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <div className={`px-5 pb-5 pt-0 text-sm leading-relaxed text-zinc-700`}>
                    <div className="w-full h-px bg-black/5 mb-4" />
                    <div className="markdown-body prose max-w-none">
                      <ReactMarkdown>{section.body}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

const renderChatPlainText = (text: string) => {
  const blocks = text
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return <p className="whitespace-pre-line">{text}</p>;
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => (
        <p key={idx} className="whitespace-pre-line leading-relaxed">
          {block}
        </p>
      ))}
    </div>
  );
};

const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseModelErrorPayload = (err: any) => {
  const directCode = err?.error?.code ?? err?.code;
  const directStatus = err?.error?.status ?? err?.status;

  if (directCode || directStatus) {
    return {
      code: Number(directCode) || null,
      status: String(directStatus || '').toUpperCase() || null,
      message: String(err?.error?.message || err?.message || '')
    };
  }

  const rawMessage = String(err?.message || '');
  const jsonStart = rawMessage.indexOf('{"error"');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart));
      return {
        code: Number(parsed?.error?.code) || null,
        status: String(parsed?.error?.status || '').toUpperCase() || null,
        message: String(parsed?.error?.message || rawMessage)
      };
    } catch {
      // keep fallback below
    }
  }

  return {
    code: null,
    status: null,
    message: rawMessage
  };
};

const isRetryableModelError = (err: any) => {
  const payload = parseModelErrorPayload(err);
  return payload.code === 429 || payload.code === 503 || payload.status === 'UNAVAILABLE' || payload.status === 'RESOURCE_EXHAUSTED';
};

const runWithModelRetry = async <T,>(
  task: () => Promise<T>,
  maxAttempts = 3
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (err: any) {
      lastError = err;
      if (!isRetryableModelError(err) || attempt === maxAttempts) {
        throw err;
      }

      const backoff = 1200 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 300);
      console.warn(`[RETRY] Gemini request failed with transient load error. attempt=${attempt}/${maxAttempts}, wait=${backoff}ms`);
      await waitMs(backoff);
    }
  }

  throw lastError;
};

const App: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<"welcome" | "dashboard" | "taekil" | "chat" | "report" | "guide" | "blog">("welcome");
  const [guideSubPage, setGuideSubPage] = useState<"main" | "privacy" | "terms" | "about" | "contact" | "taekil">("main");
  const [selectedBlogPost, setSelectedBlogPost] = useState<BlogPost | null>(null);
  
  // State
  const [userData, setUserData] = useState<UserData>({
    name: "사용자",
    birthYear: "1990",
    birthMonth: "1",
    birthDay: "1",
    birthHour: "12",
    birthMinute: "0",
    calendarType: 'solar',
    gender: 'M',
    unknownTime: false
  });
  const [sajuResult, setSajuResult] = useState<any[]>([]);
  const [daeunResult, setDaeunResult] = useState<any[]>([]);
  const [yongshinResult, setYongshinResult] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [consultationMode, setConsultationMode] = useState<'basic' | 'advanced'>('basic');
  const [basicSelectedCategory, setBasicSelectedCategory] = useState<string>(BASIC_CHAT_CATEGORIES[0]);
  const [basicAskedByCategory, setBasicAskedByCategory] = useState<Record<string, string[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('재물/사업');
  const [blogCategory, setBlogCategory] = useState<string>('전체');
  const [refreshKey, setRefreshKey] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const activeChatRequestIdRef = useRef(0);
  const consultationModeRef = useRef<'basic' | 'advanced'>('basic');
  const preservedChatContextRef = useRef<Message[]>([]);
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const modeNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoGenerateReportRef = useRef(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [guidelines, setGuidelines] = useState<Guidelines | null>({
    saju: SAJU_GUIDELINE,
    consulting: CONSULTING_GUIDELINE,
    report: REPORT_GUIDELINE
  });
  const [guidelinesError, setGuidelinesError] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [taekilActiveCategory, setTaekilActiveCategory] = useState<TaekilCategory>('결혼');
  const [taekilStartMonth, setTaekilStartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [taekilEndMonth, setTaekilEndMonth] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
  });
  const [marriagePeriodStart, setMarriagePeriodStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [marriagePeriodEnd, setMarriagePeriodEnd] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  });
  const [taekilLoading, setTaekilLoading] = useState(false);
  const [taekilError, setTaekilError] = useState<string | null>(null);
  const [taekilNotice, setTaekilNotice] = useState<string | null>(null);
  const [taekilResults, setTaekilResults] = useState<TaekilResultItem[]>([]);
  const [selectedTaekilDate, setSelectedTaekilDate] = useState<string | null>(null);
  const [spouseName, setSpouseName] = useState('');
  const [spouseGender, setSpouseGender] = useState<'M' | 'F'>('M');
  const [spouseBirthYear, setSpouseBirthYear] = useState('');
  const [spouseBirthMonth, setSpouseBirthMonth] = useState('');
  const [spouseBirthDay, setSpouseBirthDay] = useState('');
  const [spouseBirthHour, setSpouseBirthHour] = useState('12');
  const [spouseBirthMinute, setSpouseBirthMinute] = useState('0');
  const [spouseCalendarType, setSpouseCalendarType] = useState<'solar' | 'lunar'>('lunar');
  const [spouseUnknownTime, setSpouseUnknownTime] = useState(false);
  const [preferredWeekday1, setPreferredWeekday1] = useState('6');
  const [preferredWeekday2, setPreferredWeekday2] = useState('0');
  const [preferredWeekday3, setPreferredWeekday3] = useState('5');
  const [avoidDateInputs, setAvoidDateInputs] = useState<string[]>(['', '', '', '', '']);
  const [moveFamilyBirthDates, setMoveFamilyBirthDates] = useState<string[]>(['', '', '', '', '']);
  const [moveCurrentAddress, setMoveCurrentAddress] = useState('');
  const [moveTargetAddress, setMoveTargetAddress] = useState('');
  const [movePeriodStart, setMovePeriodStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [movePeriodEnd, setMovePeriodEnd] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  });
  const [movePreferredWeekday1, setMovePreferredWeekday1] = useState('6');
  const [movePreferredWeekday2, setMovePreferredWeekday2] = useState('0');
  const [movePreferredWeekday3, setMovePreferredWeekday3] = useState('5');
  const [movePriority, setMovePriority] = useState<'folklore' | 'saju' | 'balanced'>('balanced');
  const [moveOnlyWeekend, setMoveOnlyWeekend] = useState(false);
  const [childFatherBirthDate, setChildFatherBirthDate] = useState('');
  const [childFatherBirthTime, setChildFatherBirthTime] = useState('12:00');
  const [childMotherBirthDate, setChildMotherBirthDate] = useState('');
  const [childMotherBirthTime, setChildMotherBirthTime] = useState('12:00');
  const [childFetusGender, setChildFetusGender] = useState<'남' | '여'>('남');
  const [childbirthPeriodStart, setChildbirthPeriodStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [childbirthPeriodEnd, setChildbirthPeriodEnd] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  });
  const [generalPeriodStart, setGeneralPeriodStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [generalPeriodEnd, setGeneralPeriodEnd] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  });
  const [generalPreferredWeekday1, setGeneralPreferredWeekday1] = useState('6');
  const [generalPreferredWeekday2, setGeneralPreferredWeekday2] = useState('0');
  const [generalPreferredWeekday3, setGeneralPreferredWeekday3] = useState('5');
  const [generalAvoidDateInputs, setGeneralAvoidDateInputs] = useState<string[]>(['', '', '', '', '']);
  const [taekilAdditionalInfo, setTaekilAdditionalInfo] = useState('');
  const [taekilFormValues, setTaekilFormValues] = useState<Record<string, string>>({});

  const setTaekilFormValue = (key: string, value: string) => {
    setTaekilFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const taekilActiveFields = taekilActiveCategory === '결혼'
    ? []
    : TAEKIL_CATEGORY_FORM_FIELDS[taekilActiveCategory as Exclude<TaekilCategory, '결혼'>];

  const taekilPreviewItems = taekilActiveCategory === '결혼'
    ? [
        spouseName ? `배우자: ${spouseName}` : '',
        spouseBirthYear ? `출생: ${spouseBirthYear}-${spouseBirthMonth || 'MM'}-${spouseBirthDay || 'DD'}` : '',
        spouseUnknownTime ? '생시 미상' : `출생시각: ${spouseBirthHour}:${String(spouseBirthMinute).padStart(2, '0')}`
      ].filter(Boolean)
    : taekilActiveFields
        .map((field) => taekilFormValues[field.key] ? `${field.label}: ${taekilFormValues[field.key]}` : '')
        .filter(Boolean)
        .slice(0, 3);
  
  // Weekly Recommended Content Logic
  const recommendedPosts = useMemo(() => {
    const allPosts = blogPosts.length > 0 ? blogPosts : BLOG_POSTS;
    if (allPosts.length === 0) return [];
    
    // 1. Latest: Sort by date descending
    const sortedByDate = [...allPosts].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.()?.getTime() || new Date(a.date).getTime();
      const dateB = b.createdAt?.toDate?.()?.getTime() || new Date(b.date).getTime();
      return dateB - dateA;
    });
    const latest = sortedByDate[0];

    // 2. Popular: Sort by views descending (excluding latest)
    const sortedByViews = [...allPosts]
      .filter(p => p.id !== latest.id)
      .sort((a, b) => (b.views || 0) - (a.views || 0));
    const popular = sortedByViews[0] || latest;

    // 3. Picks: 2 random posts (excluding latest and popular), stable for a month
    const now = new Date();
    const monthSeed = now.getFullYear() * 100 + now.getMonth();
    
    const seededRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    const eligibleForPicks = allPosts.filter(p => p.id !== latest.id && p.id !== popular.id);
    
    const shuffledPicks = [...eligibleForPicks].sort((a, b) => {
      const hashA = seededRandom(monthSeed + a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      const hashB = seededRandom(monthSeed + b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      return hashA - hashB;
    });

    const pick1 = shuffledPicks[0] || (allPosts.find(p => p.id !== latest.id && p.id !== popular.id) || latest);
    const pick2 = shuffledPicks[1] || (allPosts.find(p => p.id !== latest.id && p.id !== popular.id && p.id !== pick1.id) || latest);

    // Ensure unique posts for the 4 slots
    const result: BlogPost[] = [];
    const seenIds = new Set<string>();
    
    [latest, popular, pick1, pick2].forEach(post => {
      if (!seenIds.has(post.id)) {
        result.push(post);
        seenIds.add(post.id);
      }
    });
    
    return result;
  }, [blogPosts]);

  const [isEditingPost, setIsEditingPost] = useState<BlogPost | null>(null);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState<string | null>(null);
  const daeunScrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (activeTab === "dashboard" && daeunScrollRef.current && daeunResult.length > 0) {
      const timer = setTimeout(() => {
        const currentAge = 2026 - parseInt(userData.birthYear) + 1;
        const activeIndex = daeunResult.findIndex((dy, i) => 
          currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge)
        );
        
        if (activeIndex !== -1) {
          const container = daeunScrollRef.current;
          if (container && container.children[activeIndex]) {
            const activeElement = container.children[activeIndex] as HTMLElement;
            const scrollLeft = activeElement.offsetLeft - (container.offsetWidth / 2) + (activeElement.offsetWidth / 2);
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
          }
        }
      }, 300); // Give enough time for the tab transition animation
      return () => clearTimeout(timer);
    }
  }, [activeTab, daeunResult, userData.birthYear]);

  const [showInputForm, setShowInputForm] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [newPost, setNewPost] = useState<Partial<BlogPost>>({
    title: "",
    content: "",
    category: "사주기초",
    excerpt: "",
    readTime: "3분",
    imageUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/800/600`
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAdmin(firebaseUser?.email === "dean.uitrading@gmail.com" || firebaseUser?.email === "dean.sj.oh@gmail.com");
    });
    return () => unsubscribe();
  }, []);

  // Fetch Blog Posts from Firestore
  useEffect(() => {
    // Hidden Admin Gate: Check for secret query param or path
    const params = new URLSearchParams(window.location.search);
    if (params.get('ui_gate') === 'premium_777') {
      setShowAdminGate(true);
      // Clean up URL without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const q = query(collection(db, "blogPosts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BlogPost[];
      setBlogPosts(posts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "blogPosts");
    });
    return () => unsubscribe();
  }, []);

  // Admin Functions
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      console.log("Attempting login...");
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Login successful", result.user.email);
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "로그인 중 오류가 발생했습니다.";
      
      if (error.code === 'auth/unauthorized-domain') {
        errorMessage = `현재 도메인이 Firebase 승인 도메인에 등록되어 있지 않습니다. Firebase 콘솔에서 다음 도메인을 '승인된 도메인'에 추가해 주세요:\n\n${window.location.hostname}`;
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "브라우저에서 팝업이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해 주세요.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "로그인 창이 닫혔습니다. 다시 시도해 주세요.";
      } else {
        errorMessage = `로그인 실패 (${error.code || 'unknown'}): ${error.message || '알 수 없는 오류가 발생했습니다.'}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("상담을 종료하고 모든 입력 데이터를 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)")) {
      setUserData({
        name: "사용자",
        birthYear: "1990",
        birthMonth: "1",
        birthDay: "1",
        birthHour: "12",
        birthMinute: "0",
        calendarType: 'solar',
        gender: 'M',
        unknownTime: false
      });
      setMessages([]);
      setSajuResult([]);
      setDaeunResult([]);
      setYongshinResult(null);
      preservedChatContextRef.current = [];
      setReportContent(null);
      setActiveTab("welcome");
      setInput("");
      setLoading(false);
      setIsAnalyzing(false);
      setAnalysisStep(0);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const insertMarkdown = (type: 'image' | 'size-image', isEdit: boolean) => {
    const template = type === 'image' 
      ? '![이미지 설명](이미지 URL)' 
      : '<img src="이미지 URL" width="500" alt="이미지 설명" />';
    
    if (isEdit && isEditingPost) {
      setIsEditingPost({
        ...isEditingPost,
        content: isEditingPost.content + '\n' + template
      });
    } else {
      setNewPost({
        ...newPost,
        content: newPost.content + '\n' + template
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `blog/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (isEdit && isEditingPost) {
        setIsEditingPost({ ...isEditingPost, imageUrl: url });
      } else {
        setNewPost({ ...newPost, imageUrl: url });
      }
      alert("이미지가 성공적으로 업로드되었습니다.");
    } catch (error) {
      console.error("Image upload error:", error);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePostClick = async (post: BlogPost) => {
    setSelectedBlogPost(post);
    setActiveTab("blog");
    
    // Increment views in Firestore
    try {
      const postRef = doc(db, "blogPosts", post.id);
      await updateDoc(postRef, {
        views: increment(1)
      });
    } catch (error) {
      console.error("Error incrementing views:", error);
    }
  };

  const handleAddPost = async () => {
    console.log("[DEBUG] handleAddPost attempt. isAdmin:", isAdmin, "user:", user?.email);
    if (!isAdmin || !user) {
      alert("관리자 권한이 없거나 로그인이 필요합니다.");
      return;
    }
    try {
      const postData = {
        ...newPost,
        excerpt: newPost.excerpt || (newPost.content ? newPost.content.replace(/[#*`]/g, '').slice(0, 120) + "..." : ""),
        readTime: newPost.readTime || "3분",
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        authorUid: user.uid,
        views: 0
      };
      console.log("[DEBUG] Saving post data:", postData);
      await addDoc(collection(db, "blogPosts"), postData);
      console.log("[DEBUG] Post saved successfully.");
      setIsAddingPost(false);
      setNewPost({
        title: "",
        content: "",
        category: "사주기초",
        excerpt: "",
        readTime: "3분",
        imageUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/800/600`
      });
      alert("블로그 글이 성공적으로 저장되었습니다.");
    } catch (error) {
      console.error("[DEBUG] Error saving post:", error);
      handleFirestoreError(error, OperationType.CREATE, "blogPosts");
      alert("블로그 글 저장 중 오류가 발생했습니다.");
    }
  };

  const handleUpdatePost = async () => {
    console.log("[DEBUG] handleUpdatePost attempt. isAdmin:", isAdmin, "isEditingPost:", isEditingPost?.id);
    if (!isAdmin || !isEditingPost) {
      alert("관리자 권한이 없거나 수정할 글이 선택되지 않았습니다.");
      return;
    }
    try {
      const postRef = doc(db, "blogPosts", isEditingPost.id);
      const updateData = {
        title: isEditingPost.title,
        content: isEditingPost.content,
        category: isEditingPost.category,
        imageUrl: isEditingPost.imageUrl,
        excerpt: isEditingPost.excerpt || isEditingPost.content.replace(/[#*`]/g, '').slice(0, 120) + "...",
        readTime: isEditingPost.readTime || "3분"
      };
      console.log("[DEBUG] Updating post data:", updateData);
      await updateDoc(postRef, updateData);
      console.log("[DEBUG] Post updated successfully.");
      setIsEditingPost(null);
      alert("블로그 글이 성공적으로 수정되었습니다.");
    } catch (error) {
      console.error("[DEBUG] Error updating post:", error);
      handleFirestoreError(error, OperationType.UPDATE, `blogPosts/${isEditingPost.id}`);
      alert("블로그 글 수정 중 오류가 발생했습니다.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!isAdmin || !window.confirm("정말 이 글을 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, "blogPosts", postId));
      if (selectedBlogPost?.id === postId) setSelectedBlogPost(null);
      alert("블로그 글이 삭제되었습니다.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `blogPosts/${postId}`);
      alert("블로그 글 삭제 중 오류가 발생했습니다.");
    }
  };

  // Fetch guidelines with retry logic - REMOVED for hardcoded reliability
  useEffect(() => {
    // Guidelines are now hardcoded in src/constants/guidelines.ts
  }, []);

  // Auto scroll
  // Force rebuild
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Saju Calculation Trigger
  const handleStart = async () => {
    setIsAnalyzing(true);
    setAnalysisStep(0);

    try {
      const steps = [
        "천문 데이터를 분석하고 있습니다...",
        "사주 팔자를 산출하고 있습니다...",
        "대운의 흐름을 파악하고 있습니다...",
        "현대적 해석을 준비하고 있습니다..."
      ];

      for (let i = 0; i < steps.length; i++) {
        setAnalysisStep(i);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      const dateStr = `${userData.birthYear}-${userData.birthMonth.padStart(2, '0')}-${userData.birthDay.padStart(2, '0')}`;
      const timeStr = `${userData.birthHour.padStart(2, '0')}:${userData.birthMinute.padStart(2, '0')}`;
      const isLunar = userData.calendarType !== 'solar';
      const isLeap = userData.calendarType === 'leap';
      
      const result = getSajuData(dateStr, timeStr, isLunar, isLeap, userData.unknownTime);
      const daeun = getDaeunData(dateStr, timeStr, isLunar, isLeap, userData.gender);
      const yongshin = calculateYongshin(result);
      
      setSajuResult(result);
      setDaeunResult(daeun);
      setYongshinResult(yongshin);
      setReportContent(null);
      setConsultationMode('basic');
      consultationModeRef.current = 'basic';
      setActiveTab("report");
      setShowInputForm(false);
      autoGenerateReportRef.current = true;
      
      // Reset chat with context
      if (consultationMode === 'basic') {
        setBasicSelectedCategory(BASIC_CHAT_CATEGORIES[0]);
        setBasicAskedByCategory({});
        setSuggestions(getBasicCategorySuggestions(BASIC_CHAT_CATEGORIES[0]));
      } else {
        setRefreshKey(prev => prev + 1);
      }
      preservedChatContextRef.current = [];
      setMessages([
        { 
          role: "model", 
          text: consultationMode === 'basic'
            ? `만세력 분석이 완료되었습니다. 무엇이 궁금하신가요? 아래 추천 질문을 선택하거나 음성/직접 입력으로 질문해 주세요.`
            : `만세력에서 당신의 사주팔자를 확인하셨습니다. 이 상담창에 무엇이든 물어 보세요. 유아이 AI 전문상담자가 대답해 드립니다.` 
        }
      ]);
    } catch (err: any) {
      console.error("Analysis error:", err);
      alert("사주 분석 중 오류가 발생했습니다. 입력 정보를 확인해 주세요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const pickRandomQuestions = (source: string[], count: number, exclude: string[] = []) => {
    const excluded = new Set(exclude);
    const filtered = source.filter(q => !excluded.has(q));
    const base = filtered.length >= count ? filtered : source;
    return [...base].sort(() => 0.5 - Math.random()).slice(0, Math.min(count, base.length));
  };

  const getBasicCategorySuggestions = (category: string, exclude: string[] = []) => {
    const pool = BASIC_CATEGORY_QUESTION_POOL[category] || [];
    if (pool.length === 0) return [];
    return pickRandomQuestions(pool, 3, exclude);
  };

  const getCurrentAgeGroup = () => {
    const currentYear = new Date().getFullYear();
    const birthYear = parseInt(userData.birthYear);
    const age = currentYear - birthYear + 1;

    if (age >= 70) return '70대↑';
    if (age >= 60) return '60대';
    if (age >= 50) return '50대';
    if (age >= 40) return '40대';
    if (age >= 30) return '30대';
    if (age >= 20) return '20대';
    return '10대';
  };

  const getProfileCategoryQuestions = () => {
    const ageGroup = getCurrentAgeGroup();
    const genderKey = userData.gender === 'M' ? '남' : '여';
    const groupData = SUGGESTED_QUESTIONS[ageGroup as keyof typeof SUGGESTED_QUESTIONS];
    const genderData = groupData?.[genderKey as keyof typeof groupData];
    const categoryQuestions = genderData?.[selectedCategory as keyof typeof genderData] as string[] | undefined;
    return categoryQuestions || [];
  };

  const handleVoiceInput = () => {
    setVoiceStatusMessage(null);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      setVoiceStatusMessage('음성 입력은 HTTPS 또는 localhost 환경에서만 동작합니다.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatusMessage('현재 브라우저는 음성 입력(Web Speech API)을 지원하지 않습니다.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatusMessage('듣고 있습니다... 말씀해 주세요.');
    };
    recognition.onend = () => {
      setIsListening(false);
      setVoiceStatusMessage(null);
    };
    recognition.onerror = (event: any) => {
      setIsListening(false);
      const code = event?.error;
      const mapped =
        code === 'not-allowed'
          ? '마이크 권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 마이크를 허용해 주세요.'
          : code === 'no-speech'
            ? '음성이 감지되지 않았습니다. 다시 시도해 주세요.'
            : code === 'network'
              ? '음성 인식 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
              : `음성 입력 오류가 발생했습니다(${code || 'unknown'}).`;
      setVoiceStatusMessage(mapped);
    };
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const current = event.results[i];
        const text = current?.[0]?.transcript || '';
        if (current.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      const merged = (finalTranscript || interimTranscript).trim();
      if (merged) {
        setInput(merged);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setVoiceStatusMessage('음성 입력을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleDownloadChat = () => {
    if (messages.length === 0) return;
    
    const chatContent = messages.map(msg => {
      const role = msg.role === 'user' ? '나' : '유아이';
      return `[${role}]\n${msg.text}\n`;
    }).join('\n---\n\n');
    
    const blob = new Blob([`유아이 사주상담 내역\n날짜: ${new Date().toLocaleString()}\n\n${chatContent}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `유아이_상담내역_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !reportContent || isPrinting) return;
    
    setIsPrinting(true);
    
    // Wait for state update and potential re-renders
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        backgroundColor: '#f9fafb',
        quality: 1,
        pixelRatio: 2
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Handle multi-page if height exceeds A4
      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`유아이_운세리포트_${userData.name}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsPrinting(false);
    }
  };

  // Update suggestions based on user profile and selected category
  useEffect(() => {
    if (activeTab === 'chat') {
      if (consultationMode === 'basic') {
        const asked = basicAskedByCategory[basicSelectedCategory] || [];
        setSuggestions(getBasicCategorySuggestions(basicSelectedCategory, asked));
        return;
      }

      const categoryQuestions = getProfileCategoryQuestions();
      if (categoryQuestions.length > 0) {
        setSuggestions(pickRandomQuestions(categoryQuestions, 3));
      } else {
        setSuggestions([]);
      }
    }
  }, [activeTab, selectedCategory, userData.birthYear, userData.gender, refreshKey, consultationMode, basicSelectedCategory, basicAskedByCategory]);

  useEffect(() => {
    consultationModeRef.current = consultationMode;
  }, [consultationMode]);

  useEffect(() => {
    return () => {
      if (modeNoticeTimerRef.current) {
        clearTimeout(modeNoticeTimerRef.current);
      }
    };
  }, []);

  const showTransientNotice = (message: string) => {
    setModeNotice(message);

    if (modeNoticeTimerRef.current) {
      clearTimeout(modeNoticeTimerRef.current);
    }

    modeNoticeTimerRef.current = setTimeout(() => {
      setModeNotice(null);
    }, 2500);
  };

  const refreshSuggestionsAfterChatClear = (resetBasicAsked: boolean) => {
    if (consultationModeRef.current === 'basic') {
      if (resetBasicAsked) {
        setBasicAskedByCategory({});
        setSuggestions(getBasicCategorySuggestions(basicSelectedCategory));
      } else {
        const asked = basicAskedByCategory[basicSelectedCategory] || [];
        setSuggestions(getBasicCategorySuggestions(basicSelectedCategory, asked));
      }
      return;
    }

    setRefreshKey(prev => prev + 1);
  };

  const clearChatWindowOnly = () => {
    if (loading) {
      activeChatRequestIdRef.current += 1;
      setLoading(false);
    }

    if (messages.length > 0) {
      preservedChatContextRef.current = [...preservedChatContextRef.current, ...messages];
    }

    setMessages([]);
    setInput("");
    refreshSuggestionsAfterChatClear(false);
    showTransientNotice("채팅창을 비웠습니다. 이전 상담 맥락은 유지됩니다.");
  };

  const clearChatWindowAndContext = () => {
    if (loading) {
      activeChatRequestIdRef.current += 1;
      setLoading(false);
    }

    preservedChatContextRef.current = [];
    setMessages([]);
    setInput("");
    refreshSuggestionsAfterChatClear(true);
    showTransientNotice("채팅창과 상담 맥락을 모두 초기화했습니다.");
  };

  const switchConsultationMode = (mode: 'basic' | 'advanced') => {
    if (mode === consultationMode) return;

    // 모드 변경 시 기존 요청을 무효화해, 다음 질문부터 새 모드가 즉시 반영되도록 합니다.
    if (loading) {
      activeChatRequestIdRef.current += 1;
      setLoading(false);
    }

    setConsultationMode(mode);
    showTransientNotice(`상담 모드가 ${mode === 'basic' ? '초급자' : '고급자'}로 변경되었습니다. 다음 질문부터 바로 적용됩니다.`);
  };

  useEffect(() => {
    if (consultationMode === 'basic') {
      const asked = basicAskedByCategory[basicSelectedCategory] || [];
      setSuggestions(getBasicCategorySuggestions(basicSelectedCategory, asked));
    } else {
      setRefreshKey(prev => prev + 1);
    }
  }, [consultationMode, basicSelectedCategory, basicAskedByCategory, selectedCategory, userData.birthYear, userData.gender]);

  const handleSend = async (overrideInput?: string) => {
    const userMessage = (overrideInput || input).trim();
    if (!userMessage || loading) return;
    const requestId = ++activeChatRequestIdRef.current;
    const modeAtRequest = consultationModeRef.current;

    if (!guidelines) {
      alert(guidelinesError || "지침 파일을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (sajuResult.length === 0) {
      alert("먼저 사주 분석을 완료해 주세요.");
      setActiveTab("welcome");
      return;
    }

    setInput("");
    setRefreshKey(prev => prev + 1);
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setLoading(true);

    try {
      const ai = getGeminiAI();
      
      const sajuContext = sajuResult.map(p => `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja}) - 십성: ${p.stem.deity}/${p.branch.deity}`).join('\n');
      const daeunContext = daeunResult.map(d => `${d.age}세 대운: ${d.stem.hangul}${d.branch.hangul} (${d.deity})`).join(', ');

      const isFirstMessage = messages.length === 0;
      const modeSpecificGuideline = modeAtRequest === 'basic'
        ? BASIC_CONSULTING_GUIDELINE
        : ADVANCED_CONSULTING_GUIDELINE;
      const personaInstruction = modeAtRequest === 'basic'
        ? "당신의 상담 스타일은 초급자 친화형입니다. 사주를 처음 접하는 사람 기준으로 쉽게 설명합니다."
        : "당신의 상담 스타일은 **'MZ세대 감성'**입니다. 힙하고, 트렌디하며, 때로는 직설적이지만 따뜻한 공감을 잊지 않습니다.";
      const toneInstruction = modeAtRequest === 'basic'
        ? "- **초급자 말투:** 사주 용어를 모르는 사람도 이해할 수 있는 쉬운 한국어로 설명하세요."
        : "- **고급자 말투:** 반말은 지양하고, 전문성을 유지하되 과장 없이 명확하게 설명하세요.\n- **간지 한자 병기(고급자 전용 필수):** 천간(갑·을·병·정·무·기·경·신·임·계)과 지지(자·축·인·묘·진·사·오·미·신(申)·유·술·해)를 본문에서 언급할 때는 반드시 한자를 괄호에 병기하세요. 단독 표기: 갑(甲)·을(乙)·병(丙)·정(丁)·무(戊)·기(己)·경(庚)·신(辛)·임(壬)·계(癸)·자(子)·축(丑)·인(寅)·묘(卯)·진(辰)·사(巳)·오(午)·미(未)·신(申)·유(酉)·술(戌)·해(亥). 두 글자 간지 조합 예시: 갑자(甲子)·을축(乙丑). 사용자가 이미 한자로 표기된 용어를 쓴 경우에도 한글(한자) 형태로 통일하여 응답하세요.";
      const systemInstruction = `
[Role: UI Premium 1:1 Spiritual Counselor - MZ Edition]
당신은 '유아이(UI) 사주상담'의 전문 상담가입니다. 
${personaInstruction}

현재 날짜: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}

1. 상담 원칙:
- **균형 잡힌 분석:** 무조건적인 긍정보다는 현실적이고 객관적인 분석을 제공하세요. 사주상의 리스크나 주의점(충, 형, 불균형 등)을 명확히 식별하고 전달해야 합니다.
- **예방적 조언:** 안 좋은 흐름이나 약점이 발견될 경우, 이를 미리 대비하고 예방할 수 있는 구체적인 행동 지침을 반드시 포함하세요. "위기를 기회로 만드는 법"에 집중하세요.
- **철저한 분석 기반:** 반드시 제공된 사용자의 사주 정보(${sajuContext})와 대운 흐름(${daeunContext})을 명리학적으로 정밀 분석한 결과에만 입각하여 답변하세요.
- **타인 사주 분석(궁합 등) 및 개인정보 보호:** 사용자가 본인 외의 타인(궁합 상대, 가족 등)의 생년월일시를 제공하며 상담을 요청할 경우, **반드시 먼저 분석 승인을 얻어야 합니다.** 
  1. 먼저 "제공해주신 정보를 바탕으로 유아이의 정밀 간명 로직을 통해 더욱 정확한 분석을 진행해 드려도 될까요?"라고 정중히 물어보며 승인을 구하세요. 
  2. 사용자가 동의(승인)한 후에만 \`calculateSajuForPerson\` 도구를 사용하여 데이터를 가져오십시오. 
  3. 당신이 임의로 계산한 데이터로 상담하는 것은 엄격히 금지됩니다. 반드시 도구를 통해 얻은 정밀 데이터를 바탕으로 분석하세요. 
  4. 이는 개인정보를 소중히 다루고 상담의 신뢰도를 높이기 위한 필수 절차임을 사용자에게 인지시켜 신뢰를 구축하세요.
${toneInstruction}
- **전문성:** 사주 명리학적 근거(음양오행, 십성 등)를 언급하되, 어려운 용어는 현대적인 비유로 풀어서 설명하세요.
- **맥락 유지:** 이전 대화 내용을 기억하고 연결해서 답변하세요.
${isFirstMessage 
  ? "- 첫 인사는 따뜻하고 힙하게! 마지막은 항상 사용자를 응원하며 다음 질문을 유도하세요."
  : "- **중요**: 두 번째 질문부터는 불필요한 인사말이나 반복적인 응원 문구를 생략하고 질문에 대한 핵심 답변만 간결하게 제공하세요."}

2. 법적/윤리적 가이드라인:
- 의료, 범죄, 도박, 생사, 구체적 주식/코인 추천 등 위험한 질문은 정중히 거절하세요.

3. 출력 형식 규칙 (두 모드 공통, 반드시 준수):
- 이모지는 절대 사용하지 마세요.
- Markdown 문법(예: #, *, -, 1., **, 코드블록)을 사용하지 마세요.
- 일반 텍스트로만 답변하세요.
- 읽기 쉽게 2~4개의 짧은 문단으로 나누어 작성하세요.
- 불필요한 장식 없이 핵심 결론과 이유, 실천 포인트를 간결하게 제시하세요.

[사용자 사주 정보]
${sajuContext}
[대운 정보]
${daeunContext}

[상담 모드 지침]
${modeSpecificGuideline}
`;

      const contextMessages = [...preservedChatContextRef.current, ...messages];
      const contents: any[] = contextMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      let response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
        config: { 
          systemInstruction,
          tools: [{ functionDeclarations: [sajuToolDeclaration] }]
        }
      });

      // Handle function calls
      let functionCalls = response.functionCalls;
      while (functionCalls) {
        if (requestId !== activeChatRequestIdRef.current) {
          return;
        }

        const functionResponses = [];
        for (const call of functionCalls) {
          if (call.name === "calculateSajuForPerson") {
            const result = calculateSajuForPerson(call.args);
            functionResponses.push({
              name: call.name,
              response: result,
              id: call.id
            });
          }
        }
        
        // Add model's call to contents
        contents.push(response.candidates[0].content);
        
        // Add function response to contents
        contents.push({
          role: 'user',
          parts: functionResponses.map(r => ({ functionResponse: r }))
        });
        
        response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents,
          config: { 
            systemInstruction,
            tools: [{ functionDeclarations: [sajuToolDeclaration] }]
          }
        });

        if (requestId !== activeChatRequestIdRef.current) {
          return;
        }

        functionCalls = response.functionCalls;
      }

      if (requestId !== activeChatRequestIdRef.current) {
        return;
      }

      const finalResponseText = response.text || "상담 중 오류가 발생했습니다.";
      setMessages(prev => [...prev, { role: "model", text: finalResponseText }]);
      if (modeAtRequest === 'basic') {
        setBasicAskedByCategory(prev => {
          const currentAsked = prev[basicSelectedCategory] || [];
          const updatedAsked = [...currentAsked, userMessage];
          const nextSuggestions = getBasicCategorySuggestions(basicSelectedCategory, updatedAsked);
          setSuggestions(nextSuggestions);
          return {
            ...prev,
            [basicSelectedCategory]: updatedAsked
          };
        });
      }
    } catch (err: any) {
      if (requestId !== activeChatRequestIdRef.current) {
        return;
      }

      console.error("Chat error:", err);
      const errorMessage = err?.message || String(err);
      // UI에 직접 에러 메시지를 표시하도록 수정
      setMessages(prev => [...prev, { role: "model", text: `[상담 오류] ${errorMessage}` }]);
    } finally {
      if (requestId === activeChatRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleGenerateReport = async () => {
    if (loading) return;

    if (!guidelines) {
      alert(guidelinesError || "지침 파일을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (sajuResult.length === 0) {
      alert("먼저 사주 분석을 완료해 주세요.");
      setActiveTab("welcome");
      return;
    }

    setLoading(true);
    setActiveTab("report");

    try {
      console.log("[DEBUG] Starting report generation...");
      const ai = getGeminiAI();
      const sajuContext = sajuResult.map(p => `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja})`).join('\n');
      
      const birthYearInt = parseInt(userData.birthYear);
      const currentYear = new Date().getFullYear();
      const currentAge = isNaN(birthYearInt) ? 0 : currentYear - birthYearInt + 1;
      
      const daeunContext = daeunResult.map((dy, i) => {
        const isCurrent = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
        const stemHangul = hanjaToHangul[dy.stem] || dy.stem;
        const branchHangul = hanjaToHangul[dy.branch] || dy.branch;
        return `${dy.startAge}세~${daeunResult[i+1]?.startAge || dy.startAge + 9}세: ${stemHangul}${branchHangul}${isCurrent ? ' (현재 대운)' : ''}`;
      }).join('\n');

      console.log("[DEBUG] Saju Context:", sajuContext);
      console.log("[DEBUG] Daeun Context:", daeunContext);

      const reportGuideline = consultationModeRef.current === 'basic' ? BASIC_REPORT_GUIDELINE : ADVANCED_REPORT_GUIDELINE;

      const systemInstruction = `당신은 깊이 있고 전문적인 조언을 제공하는 **'사주명리 상담가 유아이'**입니다. 
현재 날짜: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
제공된 사용자의 사주 데이터와 대운 정보를 **철저하게 분석한 결과에만 입각하여** 아래의 **[8대 카테고리]**에 맞춰 종합운세리포트를 작성하십시오. 

**[핵심 원칙: 정직과 예방]**
- '좋은 말'만 늘어놓는 리포트가 되어서는 안 됩니다. 사주 원국과 운의 흐름에서 보이는 **리스크, 취약점, 주의해야 할 시기**를 가감 없이 식별하십시오.
- 발견된 부정적인 요소는 사용자가 미리 준비하여 피해를 최소화하거나 예방할 수 있도록 **'전략적 조언'**의 관점에서 서술하십시오. (예: "이 시기에는 재물 손실의 기운이 강하니 무리한 투자는 피하고 내실을 기하는 것이 최고의 개운법입니다.")

[지침 사항]
${reportGuideline}

[출력 규칙 - 매우 중요]
1. **절대로 HTML 태그(<div>, <strong> 등)를 사용하지 마십시오.** 오직 마크다운 텍스트만 사용하십시오.
2. **카테고리 제목에 #, ##, ### 등 마크다운 헤더 기호를 사용하지 마십시오.**
3. 아래에 제공된 [Output Format] 구조를 한 글자도 틀리지 말고 정확히 지켜주십시오. 파싱 로직이 이 태그들에 의존합니다.

[Output Format]
[인사말]
(여기에 사용자에게 건네는 따뜻하고 진심 어린 첫인사를 작성하세요.)

[SECTION] 카테고리 이름 [KEYWORD] 핵심 키워드 한 줄 [CONTENT]
(여기에 상세 분석 내용을 마크다운으로 작성하세요. 문단 사이 공백 필수. 불필요한 서론 없이 바로 본론으로 들어가세요.)
[END]

(위 [SECTION] 구조를 8개 카테고리에 대해 반복하십시오. 각 섹션 끝에 반드시 [END]를 붙이세요.)

[분석 대상 정보]
이름: ${userData.name || '사용자'}
사주 원국:
${sajuContext}

대운 흐름:
${daeunContext}

현재 나이: ${currentAge}세

[8대 카테고리 리스트]
1. 본질적 기질과 성격, 사회성
2. 용신 분석 및 결핍 보완 (개운법)
3. 전체 인생 흐름 (대운 분석)
4. 재물운
5. 사회 및 직장운
6. 건강운 (주의: 질병 진단 절대 금지)
7. 연애 및 결혼운
8. 운명을 이끄는 가장 중요한 조언
`;

      console.log("[DEBUG] Sending request to Gemini...");
      const result = await runWithModelRetry(
        () => ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: "나의 사주 정보와 대운 흐름을 바탕으로 종합 운세 리포트를 작성해줘. 반드시 정해진 [SECTION] 형식을 지켜야 해." }] }],
          config: {
            systemInstruction,
            maxOutputTokens: 4096,
            temperature: 0.8
          }
        }),
        3
      );
      
      console.log("[DEBUG] Gemini response received.");
      const text = result.text || "리포트 생성 실패";
      console.log("[DEBUG] Gemini response text length:", text.length);
      console.log("[DEBUG] Gemini response text preview:", text.substring(0, 200));
      setReportContent(text);
    } catch (err: any) {
      console.error("[ERROR] Report generation failed:", err);
      const parsed = parseModelErrorPayload(err);
      if (isRetryableModelError(err)) {
        setReportContent(`리포트 생성 중 모델 사용량이 일시적으로 높아 자동 재시도 후에도 완료되지 않았습니다. 잠시 후 다시 시도해 주세요. (상태: ${parsed.status || 'UNAVAILABLE'}, 코드: ${parsed.code || 'N/A'})`);
      } else {
        const errorMessage = parsed.message || String(err);
        setReportContent(`리포트 생성 중 오류가 발생했습니다: ${errorMessage}. 잠시 후 다시 시도해 주세요.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchReportMode = (mode: 'basic' | 'advanced') => {
    consultationModeRef.current = mode;
    setConsultationMode(mode);
    setReportContent(null);
    handleGenerateReport();
  };

  const handleGenerateTaekil = async () => {
    const padTwo = (value: string) => String(value).padStart(2, '0');
    const basePayload = {
      name: userData.name,
      gender: userData.gender,
      birthDate: `${userData.birthYear}-${padTwo(userData.birthMonth)}-${padTwo(userData.birthDay)}`,
      birthTime: `${padTwo(userData.birthHour)}:${padTwo(userData.birthMinute)}`,
      isLunar: userData.calendarType !== 'solar',
      isLeap: userData.calendarType === 'leap',
      unknownTime: userData.unknownTime
    };

    let payload: Record<string, any>;

    if (taekilActiveCategory === '결혼') {
      setTaekilNotice(null);
      if (!spouseName.trim() || !spouseBirthYear || !spouseBirthMonth || !spouseBirthDay) {
        setTaekilError('결혼 택일을 위해 배우자 이름과 생년월일을 입력해 주세요.');
        return;
      }

      if (!marriagePeriodStart || !marriagePeriodEnd) {
        setTaekilError('희망 결혼식 일정의 시작일과 종료일을 입력해 주세요.');
        return;
      }

      if (marriagePeriodEnd < marriagePeriodStart) {
        setTaekilError('희망 일정의 종료일이 시작일보다 빠를 수 없습니다.');
        return;
      }

      const preferredWeekdays = Array.from(new Set([
        Number(preferredWeekday1),
        Number(preferredWeekday2),
        Number(preferredWeekday3)
      ].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).slice(0, 3);

      const avoidDates = avoidDateInputs
        .map((value) => value.trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .slice(0, 5);

      payload = {
        ...basePayload,
        category: '결혼',
        periodStart: marriagePeriodStart,
        periodEnd: marriagePeriodEnd,
        spouseName: spouseName.trim(),
        spouseGender,
        spouseBirthDate: `${spouseBirthYear}-${padTwo(spouseBirthMonth)}-${padTwo(spouseBirthDay)}`,
        spouseBirthTime: `${padTwo(spouseBirthHour)}:${padTwo(spouseBirthMinute)}`,
        spouseIsLunar: spouseCalendarType === 'lunar',
        spouseIsLeap: false,
        spouseUnknownTime,
        preferredWeekdays,
        avoidDates
      };
    } else {
      if (taekilActiveCategory === '이사') {
        if (!moveCurrentAddress.trim() || !moveTargetAddress.trim()) {
          setTaekilError('이사 택일을 위해 현재 주소와 이사 갈 주소를 입력해 주세요. (동 단위 입력 가능)');
          return;
        }

        if (!movePeriodStart || !movePeriodEnd) {
          setTaekilError('희망 이사 기간의 시작일과 종료일을 입력해 주세요.');
          return;
        }

        if (movePeriodEnd < movePeriodStart) {
          setTaekilError('희망 이사 기간의 종료일이 시작일보다 빠를 수 없습니다.');
          return;
        }

        const movePreferredWeekdays = Array.from(new Set([
          Number(movePreferredWeekday1),
          Number(movePreferredWeekday2),
          Number(movePreferredWeekday3)
        ].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).slice(0, 3);

        const familyBirthDates = moveFamilyBirthDates
          .map((value) => value.trim())
          .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
          .slice(0, 5);

        const notices: string[] = [];
        if (familyBirthDates.length === 0) {
          notices.push('가족 생년월일 미입력으로 가구주 사주 기준으로 우선 계산합니다.');
        }
        const shortAddressMode = moveCurrentAddress.trim().includes('동') || moveTargetAddress.trim().includes('동');
        if (shortAddressMode) {
          notices.push('주소를 동 단위로 입력해도 조회 가능하며, 방향 분석은 입력 텍스트 기준으로 간략 적용됩니다.');
        }
        setTaekilNotice(notices.length > 0 ? notices.join(' ') : null);

        payload = {
          ...basePayload,
          category: '이사',
          periodStart: movePeriodStart,
          periodEnd: movePeriodEnd,
          preferredWeekdays: movePreferredWeekdays,
          moveCurrentAddress: moveCurrentAddress.trim(),
          moveTargetAddress: moveTargetAddress.trim(),
          moveFamilyBirthDates: familyBirthDates,
          movePriority,
          moveOnlyWeekend
        };
      } else if (taekilActiveCategory === '출산') {
        if (!childFatherBirthDate || !childMotherBirthDate) {
          setTaekilError('출산 택일을 위해 부/모 생년월일을 입력해 주세요.');
          return;
        }

        if (!childbirthPeriodStart || !childbirthPeriodEnd) {
          setTaekilError('분만 가능일 시작/종료일을 입력해 주세요.');
          return;
        }

        if (childbirthPeriodEnd < childbirthPeriodStart) {
          setTaekilError('분만 가능일 종료일이 시작일보다 빠를 수 없습니다.');
          return;
        }

        setTaekilNotice('출산 택일은 상위 3안을 핵심 후보로 해석해 활용해 주세요.');

        payload = {
          ...basePayload,
          category: '출산',
          periodStart: childbirthPeriodStart,
          periodEnd: childbirthPeriodEnd,
          categoryInputs: {
            fatherBirthDate: childFatherBirthDate,
            fatherBirthTime: childFatherBirthTime,
            motherBirthDate: childMotherBirthDate,
            motherBirthTime: childMotherBirthTime,
            fetusGender: childFetusGender,
            designPrompt: '1순위 오행 중화/조후, 2순위 초중년 대운 희신 방향, 3순위 부모와 원진/충 회피'
          },
          additionalInfo: '추천 날짜와 시진을 3안 중심으로 해석하고 성격/진로/건강운을 함께 요약'
        };
      } else {
        if (!generalPeriodStart || !generalPeriodEnd) {
          setTaekilError(`${taekilActiveCategory} 택일을 위해 시작일과 종료일을 입력해 주세요.`);
          return;
        }

        if (generalPeriodEnd < generalPeriodStart) {
          setTaekilError(`${taekilActiveCategory} 기간의 종료일이 시작일보다 빠를 수 없습니다.`);
          return;
        }

        const missingField = taekilActiveFields.find((field) => !(taekilFormValues[field.key] || '').trim());
        if (missingField) {
          setTaekilError(`${taekilActiveCategory} 택일을 위해 '${missingField.label}' 입력이 필요합니다.`);
          return;
        }

        const genericPreferredWeekdays = Array.from(new Set([
          Number(generalPreferredWeekday1),
          Number(generalPreferredWeekday2),
          Number(generalPreferredWeekday3)
        ].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).slice(0, 3);

        const genericAvoidDates = generalAvoidDateInputs
          .map((value) => value.trim())
          .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
          .slice(0, 5);

        setTaekilNotice('입력하신 카테고리 조건(우선순위/메모)을 반영해 상위 5개를 추천합니다.');

        payload = {
          ...basePayload,
          category: taekilActiveCategory,
          periodStart: generalPeriodStart,
          periodEnd: generalPeriodEnd,
          preferredWeekdays: genericPreferredWeekdays,
          avoidDates: genericAvoidDates,
          categoryInputs: taekilActiveFields.reduce((acc, field) => {
            acc[field.key] = (taekilFormValues[field.key] || '').trim();
            return acc;
          }, {} as Record<string, string>),
          additionalInfo: taekilAdditionalInfo.trim()
        };
      }
    }

    setTaekilLoading(true);
    setTaekilError(null);

    try {
      const response = await fetch('/api/taekil/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || `${taekilActiveCategory} 택일 조회에 실패했습니다.`);
      }

      const results = Array.isArray(data?.results) ? data.results as TaekilResultItem[] : [];
      setTaekilResults(results);
      setSelectedTaekilDate(results[0]?.date ?? null);
    } catch (error: any) {
      setTaekilError(error?.message || `${taekilActiveCategory} 택일 조회 중 오류가 발생했습니다.`);
      setTaekilResults([]);
      setSelectedTaekilDate(null);
    } finally {
      setTaekilLoading(false);
    }
  };

  const selectedTaekilDetail = taekilResults.find((item) => item.date === selectedTaekilDate) ?? null;
  const taekilDisplayResults = taekilActiveCategory === '출산'
    ? taekilResults.slice(0, 3)
    : taekilResults;

  const getChildbirthProfileSummary = (item: TaekilResultItem) => {
    const mergedReason = item.reasons.join(' ');
    const topTime = item.topTimeSlots?.[0]?.time || '미정';

    const hasInsung = mergedReason.includes('인성');
    const hasGwansung = mergedReason.includes('관성');
    const hasSiksang = mergedReason.includes('식신') || mergedReason.includes('식상');
    const hasJaeseong = mergedReason.includes('재성');
    const hasYongshin = mergedReason.includes('용신');
    const hasConflictNote = mergedReason.includes('충') || mergedReason.includes('형') || mergedReason.includes('파') || mergedReason.includes('해');

    const month = Number(item.date.split('-')[1] || '0');
    const hour = Number(topTime.split(':')[0] || '12');
    const coolTime = hour <= 7 || hour >= 21;
    const warmSeason = month >= 5 && month <= 9;
    const seasonTag = warmSeason ? '화기 편중 구간' : '한습 구간';
    const jowhuTag = warmSeason
      ? (coolTime ? '수기 보완형 조후' : '화기 유지형 조후')
      : (coolTime ? '한습 보강형 조후' : '온기 보완형 조후');

    const personality = hasInsung && hasGwansung
      ? '성격: 관인상생 구조가 살아 있어 규범의식, 집중력, 학습 흡수력이 안정적으로 발현될 가능성이 큽니다.'
      : hasSiksang
        ? '성격: 식상 발현이 도와 표현력과 창의 반응성이 빠르며, 대인 소통에서 유연한 성향이 강화될 수 있습니다.'
        : '성격: 일간 균형이 과도하게 치우치지 않는 중화형 흐름으로, 정서 기복이 완만한 안정 성향이 예상됩니다.';

    const career = hasGwansung
      ? `진로: 관성 축이 견고해 제도·전문성 기반 트랙(의학/법학/공공/연구)과의 정합성이 좋습니다. (주요 시진 ${topTime})`
      : hasJaeseong
        ? `진로: 재성 운용력이 살아 실무·운영·기획 계열에서 성과 전환력이 유리한 편입니다. (주요 시진 ${topTime})`
        : hasInsung
          ? `진로: 인성 기반의 축적형 성장(학업-자격-전문직)으로 초년/중년 대운의 희신 활용 폭이 넓습니다. (주요 시진 ${topTime})`
          : `진로: 특정 십성 과잉 없이 균형 분포에 가까워, 초년에는 탐색형·중년에는 전문화형 경로가 무난합니다. (주요 시진 ${topTime})`;

    const health = hasYongshin
      ? `건강운: 용희신 보강 신호가 확인되며 ${seasonTag}에서 ${jowhuTag}가 성립해 성장기 체력 리듬이 안정될 가능성이 높습니다.`
      : `건강운: ${seasonTag} 기준 ${jowhuTag}를 목표로 한 시진 배치입니다. 생활 리듬 관리 시 체질 편중 리스크를 낮추는 데 유리합니다.`;

    const caution = hasConflictNote
      ? '보완 포인트: 부모 명식과의 충형 신호가 일부 언급되어 초년 환경(수면/양육 리듬)을 보수적으로 설계하는 것이 유리합니다.'
      : '보완 포인트: 부모 명식과의 강한 충형 신호가 두드러지지 않아, 가정 내 양육 리듬의 합치도를 확보하기 좋은 편입니다.';

    return { personality, career, health, caution };
  };

  const getChartData = () => {
    const counts: Record<string, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    sajuResult.filter(p => !userData.unknownTime || p.title !== '시주').forEach(p => {
      counts[p.stem.element]++;
      counts[p.branch.element]++;
    });
    return [
      { name: '목(木)', value: counts.wood, color: '#10b981' },
      { name: '화(火)', value: counts.fire, color: '#f43f5e' },
      { name: '토(土)', value: counts.earth, color: '#f59e0b' },
      { name: '금(金)', value: counts.metal, color: '#94a3b8' },
      { name: '수(水)', value: counts.water, color: '#6366f1' },
    ].filter(d => d.value > 0);
  };

  const hiddenStemExposureText = useMemo(() => {
    if (!sajuResult || sajuResult.length === 0) return '';

    const visiblePillars = sajuResult.filter(p => !userData.unknownTime || p.title !== '시주');
    const heavenlyStems = visiblePillars.map(p => p.stem.hanja).filter(Boolean);

    const descriptions = visiblePillars
      .map(p => {
        const hiddenHanguls = p.branch.hidden ? p.branch.hidden.split(', ') : [];
        const hiddenHanjas = hiddenHanguls
          .map((h: string) => Object.keys(hanjaToHangul).find(key => hanjaToHangul[key] === h) || '')
          .filter(Boolean);

        const exposedHanjas = hiddenHanjas.filter(h => heavenlyStems.includes(h));
        if (exposedHanjas.length === 0) return '';

        const exposedLabel = exposedHanjas
          .map(h => `${hanjaToHangul[h]}(${h})`)
          .join(', ');

        return `${p.title} ${p.branch.hangul}(${p.branch.hanja})의 지장간 중 ${exposedLabel}이(가) 천간에 투출되어 실제 작용력이 더 뚜렷하게 드러납니다.`;
      })
      .filter(Boolean);

    if (descriptions.length === 0) return '';
    return `투출 해석: ${descriptions.join(' ')}`;
  }, [sajuResult, userData.unknownTime]);

  // Auto-generate report when navigating to report tab after 운세 분석
  useEffect(() => {
    if (autoGenerateReportRef.current && sajuResult.length > 0 && !loading) {
      autoGenerateReportRef.current = false;
      handleGenerateReport();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sajuResult]);

  const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#94a3b8', '#6366f1'];
  // Render Main App
  return (
    <div className={`h-dvh bg-zinc-200 flex items-center justify-center p-0 md:p-4 overflow-hidden`}>
      {/* Analysis Progress Overlay */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="text-center space-y-8 max-w-xs w-full px-6">
              <div className="relative w-24 h-24 mx-auto">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-2 border-indigo-500/30 rounded-full border-t-indigo-500"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-4 border border-emerald-500/30 rounded-full border-b-emerald-500"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-4">
                <motion.p 
                  key={analysisStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg font-medium text-white"
                >
                  {[
                    "천문 데이터를 분석하고 있습니다...",
                    "사주 팔자를 산출하고 있습니다...",
                    "대운의 흐름을 파악하고 있습니다...",
                    "현대적 해석을 준비하고 있습니다..."
                  ][analysisStep]}
                </motion.p>
                
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: `${(analysisStep + 1) * 25}%` }}
                    className="h-full bg-indigo-500"
                  />
                </div>
                
                <p className="text-xs text-white/40">잠시만 기다려 주세요. 정밀한 분석이 진행 중입니다.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`w-full h-full md:h-screen bg-[#f8f9fa] text-[#1a1a1a] overflow-hidden shadow-2xl relative flex flex-col transition-all duration-300 font-sans`}>
        {/* Navigation Header */}
        <header className={`px-4 py-3 md:px-10 md:py-4 flex items-center justify-between border-b border-black/5 bg-white/80 backdrop-blur-xl z-30 sticky top-0 safe-top`}>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="text-white w-4 h-4 md:w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base md:text-xl font-title font-bold tracking-tight">유아이 사주상담</h1>
              <p className="hidden md:block text-[10px] opacity-40 uppercase tracking-widest font-bold">전문 사주 분석</p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2 lg:gap-4">
            {[
              { id: "welcome", icon: User, label: "HOME" },
              { id: "dashboard", icon: LayoutDashboard, label: "만세력" },
              { id: "taekil", icon: Calendar, label: "택일" },
              { id: "chat", icon: MessageCircle, label: "상담" },
              { id: "report", icon: FileText, label: "리포트" },
              { id: "blog", icon: Newspaper, label: "블로그" },
              { id: "guide", icon: Info, label: "가이드" }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-black/5 opacity-60 hover:opacity-100'}`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-bold">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1 md:gap-4">
            {activeTab === "chat" && (
              <button 
                onClick={handleDownloadChat}
                disabled={messages.length === 0}
                className="p-2 md:px-4 md:py-2 rounded-full md:rounded-xl hover:bg-indigo-500/10 text-indigo-500 transition-all flex items-center gap-2 disabled:opacity-30 group"
                title="상담 내용 저장"
              >
                <Download className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                <span className="hidden md:block text-sm font-bold">텍스트 저장</span>
              </button>
            )}
            <button 
              onClick={handleReset} 
              className="p-2 md:px-4 md:py-2 rounded-full md:rounded-xl hover:bg-rose-500/10 text-rose-500 transition-all flex items-center gap-2 group"
              title="상담 종료 및 데이터 삭제"
            >
              <Trash2 className="w-5 h-5 opacity-70 group-hover:opacity-100" />
              <span className="hidden md:block text-sm font-bold">상담 종료</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
          {activeTab === "welcome" && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-12 hide-scrollbar">
                {!showInputForm ? (
                  <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    {/* Hero Section */}
                    <div className="text-center space-y-4 py-8">
                      <h2 className={`text-4xl md:text-6xl font-serif font-bold leading-tight text-zinc-900`}>
                        당신의 운명을 읽는<br/>
                        <span className="text-indigo-500">가장 명료한 시선</span>
                      </h2>
                      <p className={`text-sm md:text-lg max-w-2xl mx-auto opacity-60 text-zinc-600`}>
                        수천 년의 지혜와 첨단 AI 기술이 만나 당신의 삶에 가장 정밀한 전략을 제시합니다.
                      </p>
                    </div>

                    {/* Content Cards Section */}
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold">추천 컨텐츠</h3>
                        <button onClick={() => setActiveTab("blog")} className="text-sm font-bold text-indigo-500 hover:underline">전체보기</button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {recommendedPosts.map((post, idx) => (
                          <div 
                            key={`${post.id}-${idx}`}
                            onClick={() => handlePostClick(post)}
                            className={`group cursor-pointer rounded-[2rem] overflow-hidden border transition-all hover:shadow-2xl bg-white border-indigo-50 shadow-lg shadow-zinc-200/40`}
                          >
                            <div className="aspect-video overflow-hidden relative">
                              <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                              <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-widest ${idx === 0 ? 'bg-indigo-600' : idx === 1 ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                                {idx === 0 ? 'Latest' : idx === 1 ? 'Popular' : 'Pick'}
                              </div>
                            </div>
                            <div className="p-6 space-y-2">
                              <h4 className="font-bold line-clamp-1 text-zinc-900">{post.title}</h4>
                              <p className="text-xs opacity-60 line-clamp-2 text-zinc-600">{post.excerpt || post.content.replace(/[#*`]/g, '').slice(0, 80)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Navigation Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <button 
                        onClick={() => setShowInputForm(true)}
                        className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 bg-indigo-50 border-indigo-100 hover:bg-indigo-100 shadow-xl shadow-indigo-500/10`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                          <User className="text-white w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">정보 입력하기</h3>
                        <p className="text-sm opacity-60 mb-6">생년월일시를 입력하여 나만의 정밀 만세력을 확인하세요.</p>
                        <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
                          바로가기 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>

                      <button 
                        onClick={() => setActiveTab("blog")}
                        className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 bg-white border-indigo-50 hover:bg-zinc-50 shadow-xl shadow-zinc-200/50`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                          <Newspaper className="text-white w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">블로그 읽기</h3>
                        <p className="text-sm opacity-60 mb-6">명리학 기초부터 2026년 운세까지 다양한 지식을 만나보세요.</p>
                        <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                          바로가기 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>

                      <button 
                        onClick={() => setActiveTab("guide")}
                        className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 bg-white border-indigo-50 hover:bg-zinc-50 shadow-xl shadow-zinc-200/50`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                          <Compass className="text-white w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">이용 가이드</h3>
                        <p className="text-sm opacity-60 mb-6">유아이 사주상담을 200% 활용하는 방법을 안내해 드립니다.</p>
                        <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                          바로가기 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    </div>

                    {/* Feature Highlight Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className={`p-8 rounded-[3rem] border bg-white border-indigo-50 shadow-2xl shadow-indigo-500/5 space-y-6`}>
                        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                          <Zap className="text-violet-500 w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold">상담을 통해 얻을 수 있는 효과</h3>
                        <ul className="space-y-3">
                          {[
                            "나의 타고난 기질과 잠재력의 명확한 파악",
                            "현재 운의 흐름에 따른 최적의 결정 시기 포착",
                            "관계의 갈등을 해소하는 명리학적 솔루션",
                            "심리적 불안 해소와 삶의 방향성 정립"
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm opacity-80">
                              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                        <button 
                          onClick={() => setActiveTab("chat")}
                          className="w-full py-4 rounded-2xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-colors"
                        >
                          AI 상담 시작하기
                        </button>
                      </div>

                      <div className={`p-8 rounded-[3rem] border bg-white border-indigo-50 shadow-2xl shadow-indigo-500/5 space-y-6`}>
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                          <FileText className="text-indigo-500 w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold">유아이가 제공하는 운세리포트</h3>
                        <ul className="space-y-3">
                          {[
                            "8대 카테고리별 정밀 분석 데이터",
                            "MZ세대 감성의 트렌디하고 명확한 해석",
                            "인생의 리스크를 예방하는 전략적 가이드",
                            "PDF 저장을 통한 영구 소장 가능"
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm opacity-80">
                              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                        <button 
                          onClick={() => setActiveTab("report")}
                          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors"
                        >
                          프리미엄 리포트 확인
                        </button>
                      </div>
                    </div>

                    {/* Special Services Section */}
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold">유아이가 제공하는 특별서비스</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <a 
                          href="https://k-manseryeok.vercel.app/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 bg-white border-black/5 hover:bg-zinc-50 shadow-xl shadow-black/5`}
                        >
                          <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                            <Calendar className="text-white w-6 h-6" />
                          </div>
                          <h3 className="text-xl font-bold mb-2">만세력으로 표시한 달력</h3>
                          <p className="text-sm opacity-60 mb-6">나의 일진과 절기를 한눈에 확인하는 만세력 달력 서비스입니다.</p>
                          <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
                            바로가기 <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </a>

                        <a 
                          href="https://lucky-number-generator-deansjoh.replit.app/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 bg-white border-black/5 hover:bg-zinc-50 shadow-xl shadow-black/5`}
                        >
                          <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center mb-6 shadow-lg shadow-rose-500/20">
                            <Ticket className="text-white w-6 h-6" />
                          </div>
                          <h3 className="text-xl font-bold mb-2">내 사주에 맞는 로또 번호는?</h3>
                          <p className="text-sm opacity-60 mb-6">오늘의 운세와 사주 오행을 분석하여 행운의 번호를 생성해 드립니다.</p>
                          <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                            바로가기 <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </a>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="max-w-md mx-auto space-y-6 pb-20">
                    <button 
                      onClick={() => setShowInputForm(false)}
                      className={`flex items-center gap-2 text-sm font-bold mb-4 text-zinc-500 hover:text-zinc-900 transition-colors`}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      랜딩페이지로 돌아가기
                    </button>
                    <div className="text-center space-y-2 py-4">
                      <h2 className={`text-3xl md:text-4xl font-handwriting leading-tight text-cobalt`}>안녕하세요.<br/>유아이 사주상담입니다.</h2>
                      <p className={`text-xs md:text-sm leading-relaxed px-4 opacity-60`}>
                        정보를 입력하여<br/>당신의 삶을 분석해 보세요.
                      </p>
                    </div>

                    <div className={`p-6 rounded-[2rem] border bg-white border-indigo-100 shadow-xl space-y-6`}>
                      <div className={`flex items-center gap-3 p-4 rounded-2xl transition-all border ${isAgreed ? ('bg-indigo-50 border-indigo-200') : ('bg-zinc-50 border-zinc-200')}`}>
                        <input 
                          type="checkbox" 
                          id="privacyAgree"
                          checked={isAgreed}
                          onChange={(e) => setIsAgreed(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="privacyAgree" className={`text-sm font-bold cursor-pointer transition-colors ${isAgreed ? ('text-indigo-900') : ('text-zinc-500')}`}>
                          개인정보 이용에 동의합니다
                        </label>
                      </div>

                      <div className={`space-y-6 transition-all ${!isAgreed ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>
                        <div className="space-y-1">
                          <label className={`text-[11px] font-bold uppercase tracking-widest ml-1 text-zinc-500`}>사용자 이름</label>
                          <input 
                            type="text" 
                            placeholder="이름을 입력하세요"
                            value={userData.name}
                            disabled={!isAgreed}
                            onChange={(e) => setUserData({...userData, name: e.target.value})}
                            className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-base bg-white border-indigo-100`}
                          />
                        </div>

                        {/* Dropdown Inputs */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className={`text-[11px] font-bold ml-1 text-zinc-500`}>년도</label>
                              <select 
                                value={userData.birthYear}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({...userData, birthYear: e.target.value})}
                                className={`w-full px-2 py-2 rounded-xl border text-sm outline-none bg-white border-indigo-100`}
                              >
                                {Array.from({length: 100}, (_, i) => 2026 - i).map(y => (
                                  <option key={y} value={y}>{y}년</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className={`text-[11px] font-bold ml-1 text-zinc-500`}>월</label>
                              <select 
                                value={userData.birthMonth}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({...userData, birthMonth: e.target.value})}
                                className={`w-full px-2 py-2 rounded-xl border text-sm outline-none bg-white border-indigo-100`}
                              >
                                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                  <option key={m} value={m}>{m}월</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className={`text-[11px] font-bold ml-1 text-zinc-500`}>일</label>
                              <select 
                                value={userData.birthDay}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({...userData, birthDay: e.target.value})}
                                className={`w-full px-2 py-2 rounded-xl border text-sm outline-none bg-white border-indigo-100`}
                              >
                                {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                  <option key={d} value={d}>{d}일</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {!userData.unknownTime && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className={`text-[11px] font-bold ml-1 text-zinc-500`}>시</label>
                                <select 
                                  value={userData.birthHour}
                                  disabled={!isAgreed}
                                  onChange={(e) => setUserData({...userData, birthHour: e.target.value})}
                                  className={`w-full px-2 py-2 rounded-xl border text-sm outline-none bg-white border-indigo-100`}
                                >
                                  {Array.from({length: 24}, (_, i) => i).map(h => (
                                    <option key={h} value={h}>{h}시</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className={`text-[11px] font-bold ml-1 text-zinc-500`}>분</label>
                                <select 
                                  value={userData.birthMinute}
                                  disabled={!isAgreed}
                                  onChange={(e) => setUserData({...userData, birthMinute: e.target.value})}
                                  className={`w-full px-2 py-2 rounded-xl border text-sm outline-none bg-white border-indigo-100`}
                                >
                                  {Array.from({length: 60}, (_, i) => i).map(m => (
                                    <option key={m} value={m}>{m}분</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 ml-1">
                            <input 
                              type="checkbox" 
                              id="unknownTime"
                              disabled={!isAgreed}
                              checked={userData.unknownTime}
                              onChange={(e) => setUserData({...userData, unknownTime: e.target.checked})}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="unknownTime" className={`text-sm font-medium opacity-70`}>생시를 몰라요</label>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className={`flex items-center justify-between p-2 rounded-2xl bg-zinc-50 border-indigo-100 border`}>
                            <div className={`flex items-center gap-1.5 p-1 rounded-xl w-full`}>
                              <button 
                                onClick={() => setUserData({...userData, calendarType: 'solar'})}
                                disabled={!isAgreed}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.calendarType === 'solar' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500'}`}
                              >
                                양력
                              </button>
                              <button 
                                onClick={() => setUserData({...userData, calendarType: 'lunar'})}
                                disabled={!isAgreed}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.calendarType === 'lunar' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500'}`}
                              >
                                음력(평)
                              </button>
                              <button 
                                onClick={() => setUserData({...userData, calendarType: 'leap'})}
                                disabled={!isAgreed}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.calendarType === 'leap' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500'}`}
                              >
                                음력(윤)
                              </button>
                            </div>
                          </div>

                          <div className={`flex items-center justify-between p-2 rounded-2xl bg-zinc-50 border-indigo-100 border`}>
                            <div className={`flex items-center gap-1.5 p-1 rounded-xl w-full`}>
                              <button onClick={() => setUserData({...userData, gender: 'M'})} disabled={!isAgreed} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.gender === 'M' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500'}`}>남자</button>
                              <button onClick={() => setUserData({...userData, gender: 'F'})} disabled={!isAgreed} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.gender === 'F' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500'}`}>여자</button>
                            </div>
                          </div>
                        </div>
                        
                        <button 
                          onClick={handleStart}
                          disabled={!isAgreed}
                          className={`w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all ${!isAgreed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          운세 분석 시작
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <p className={`text-center text-xs tracking-tight pb-2 opacity-30`}>정확한 분석을 위해 태어난 시간을 꼭 확인해 주세요.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 hide-scrollbar"
            >
              {sajuResult.length > 0 ? (
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                {/* Left Column */}
                <div className="space-y-8 md:space-y-12">
                  {/* Saju Grid - 2x4 Layout */}
                  <div className="space-y-4">
                    <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>사주팔자 (四柱八字)</h3>
                    <div className="grid grid-cols-4 gap-3 md:gap-4">
                      {sajuResult.map((p, i) => {
                        if (userData.unknownTime && p.title === '시주') return null;
                        return (
                          <div key={i} className={`p-3 md:p-5 rounded-3xl border bg-white border-black/5 shadow-md flex flex-col items-center gap-2 transition-transform hover:scale-[1.02]`}>
                            <span className={`text-[10px] md:text-xs font-bold opacity-50`}>{p.title}</span>
                            <div className="flex flex-col gap-4 py-2">
                              {[p.stem, p.branch].map((item, j) => (
                                <HanjaBox 
                                  key={j} 
                                  hanja={item.hanja} 
                                  deity={item.deity}
                                  deityPosition={j === 0 ? 'top' : 'bottom'}
                                  size="md"
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Saju Conclusion */}
                  <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border-indigo-500/20`}>
                    <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-xl shadow-indigo-500/20">
                        <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="space-y-2">
                          <p className="text-[10px] md:text-xs font-bold text-indigo-500 uppercase tracking-[0.2em]">사주팔자 분석 결론</p>
                          <h4 className={`text-base md:text-xl font-bold leading-tight text-zinc-900`}>
                            {userData.name}님의 사주는 <span className="text-indigo-500">{calculateGyeok(sajuResult).composition}</span>로 구성되어 있으며, <br className="hidden md:block"/><span className="text-indigo-500 font-black">[{calculateGyeok(sajuResult).gyeok}]</span>의 사주입니다.
                          </h4>
                        </div>
                        
                        {/* Navigation Guidance */}
                        <div className="flex flex-wrap gap-3 pt-2">
                          <button 
                            onClick={() => setActiveTab("chat")}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            AI와 상담하기
                          </button>
                          <button 
                            onClick={() => setActiveTab("report")}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            운세리포트 생성
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Five Elements Distribution */}
                  <div className="space-y-4">
                    <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>오행분포 (五行分布)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-6 rounded-3xl border bg-white border-zinc-200 shadow-lg flex flex-col justify-center`}>
                        <p className={`text-sm md:text-base leading-relaxed text-zinc-600 font-medium`}>
                          {userData.name}님의 오행 분포는 <br className="hidden md:block"/>
                          {getChartData().map(d => `${d.name} ${d.value}개`).join(', ')}으로 구성되어 있습니다.
                        </p>
                      </div>
                      <div className={`p-6 rounded-3xl border bg-white border-black/5 shadow-lg flex items-center justify-center`}>
                        <ResponsiveContainer width="100%" height={150}>
                          <PieChart>
                            <Pie data={getChartData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                              {getChartData().map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                      {getChartData().map((d, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 text-xs font-bold">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                          <span className={'text-zinc-700'}>{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8 md:space-y-12">
                  {/* Jiji and Jijangan */}
                  <div className="space-y-4">
                    <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>지지와 지장간 (地支/地藏干)</h3>
                    <div className="grid grid-cols-4 gap-3 md:gap-4">
                      {sajuResult.map((p, i) => {
                        if (userData.unknownTime && p.title === '시주') return null;
                        const dayStem = sajuResult.find(p => p.title === '일주')?.stem.hanja || '';
                        
                        return (
                          <div key={i} className={`p-3 md:p-5 rounded-3xl border bg-white border-black/5 shadow-md flex flex-col items-center gap-2 transition-transform hover:scale-[1.02]`}>
                            <div className="py-2">
                              <HanjaBox 
                                hanja={p.branch.hanja} 
                                deity={p.branch.deity}
                                deityPosition="bottom"
                                size="md"
                              />
                            </div>
                            <span className={`text-[10px] md:text-xs font-bold mt-2 opacity-70`}>{p.branch.hangul}({p.branch.hanja})</span>
                            <div className="flex gap-1 mt-4 pb-2">
                              {(p.branch.hidden ? p.branch.hidden.split(', ') : []).map((h, k, hiddenArray) => {
                                const hanja = Object.keys(hanjaToHangul).find(key => hanjaToHangul[key] === h) || '';
                                const deity = calculateDeity(dayStem, hanja);
                                const isMainHiddenStem = k === hiddenArray.length - 1;
                                return (
                                  <HanjaBox 
                                    key={k} 
                                    hanja={hanja} 
                                    size="sm" 
                                    deity={deity}
                                    deityPosition="bottom"
                                    highlight={isMainHiddenStem}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className={`text-xs md:text-sm leading-relaxed mt-4 italic opacity-60`}>
                      지지와 지장간은 사주의 뿌리이자 에너지가 저장된 곳입니다. 지장간은 지지 속에 숨겨진 천간의 기운으로, 당신의 내면적인 성향과 잠재력을 나타냅니다.
                      {hiddenStemExposureText ? (
                        <>
                          <br />
                          {hiddenStemExposureText}
                        </>
                      ) : null}
                    </p>
                  </div>

                  {/* Daeun Analysis */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>대운분석 (大運分析)</h3>
                      {daeunResult.length > 0 && (
                        <span className="text-[10px] md:text-xs font-bold text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full">
                          {daeunResult[0].startAge}대운
                        </span>
                      )}
                    </div>

                    <div className={`p-6 rounded-3xl border bg-white border-black/5 shadow-lg`}>
                      <div ref={daeunScrollRef} className="flex overflow-x-auto horizontal-scrollbar gap-6 pb-6 snap-x snap-mandatory scroll-smooth">
                        {daeunResult.length > 0 ? daeunResult.map((dy, i) => {
                          const currentAge = 2026 - parseInt(userData.birthYear) + 1;
                          const isCurrentDaeun = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
                          const isTransitioning = Math.abs(currentAge - dy.startAge) <= 1 || 
                                                (daeunResult[i+1] && Math.abs(currentAge - daeunResult[i+1].startAge) <= 1);

                          return (
                            <div key={i} className={`w-24 shrink-0 snap-center p-4 rounded-3xl border flex flex-col items-center gap-3 transition-all ${
                              isCurrentDaeun 
                                ? 'border-indigo-500 bg-indigo-600/30 shadow-2xl shadow-indigo-500/40 ring-4 ring-indigo-500/30 scale-110 z-10' 
                                : 'border-transparent bg-black/5 opacity-40 hover:opacity-100'
                            }`}>
                              <div className="text-[10px] md:text-xs font-bold">{dy.startAge}세</div>
                              <div className="flex flex-col gap-4 py-2">
                                {daeunResult.length > 0 && [dy.stem, dy.branch].map((hanja, j) => {
                                  const dayStem = sajuResult.find(p => p.title === '일주')?.stem.hanja || '';
                                  const deity = calculateDeity(dayStem, hanja);
                                  return (
                                    <HanjaBox 
                                      key={j} 
                                      hanja={hanja} 
                                      deity={deity}
                                      deityPosition={j === 0 ? 'top' : 'bottom'}
                                      size="md"
                                    />
                                  );
                                })}
                              </div>
                              <div className="text-[10px] md:text-xs font-bold opacity-70">{hanjaToHangul[dy.stem]}{hanjaToHangul[dy.branch]}</div>
                              {isCurrentDaeun && isTransitioning && (
                                <div className="mt-1 px-2 py-0.5 bg-rose-500/20 text-rose-500 text-[8px] md:text-[10px] font-bold rounded-full animate-pulse">
                                  교운기
                                </div>
                              )}
                            </div>
                          );
                        }) : (
                          <div className={`text-sm py-8 w-full text-center opacity-40`}>분석을 시작하면 대운이 표시됩니다.</div>
                        )}
                      </div>
                    </div>

                    {/* Current Daeun Description */}
                    {daeunResult.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 rounded-3xl border bg-indigo-50 border-indigo-200 shadow-sm`}
                      >
                        {daeunResult.map((dy, i) => {
                          const currentAge = 2026 - parseInt(userData.birthYear) + 1;
                          const isCurrentDaeun = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
                          if (!isCurrentDaeun) return null;
                          
                          return (
                            <div key={i} className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-6 bg-indigo-500 rounded-full" />
                                <h4 className={`text-sm md:text-base font-bold text-indigo-900`}>현재 대운: {dy.startAge}세 {hanjaToHangul[dy.stem]}{hanjaToHangul[dy.branch]}대운</h4>
                              </div>
                              <p className={`text-xs md:text-sm leading-relaxed italic font-medium opacity-80`}>
                                "{dy.description}"
                              </p>
                              {Math.abs(currentAge - dy.startAge) <= 1 && (
                                <div className={`flex items-start gap-3 p-4 rounded-2xl border bg-rose-50 border-rose-200`}>
                                  <Info className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                                  <p className="text-[11px] md:text-xs text-rose-500 leading-relaxed">
                                    현재 <strong>교운기(인생의 변동기)</strong>에 진입해 있습니다. 환경의 변화나 심리적 변동이 클 수 있으니 신중한 판단이 필요합니다.
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>

                  {/* Yongshin Analysis */}
                  <div className="space-y-4">
                    <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>용신(用神) 정밀 분석</h3>
                    {yongshinResult && (
                      <div className={`p-6 md:p-8 rounded-[2.5rem] border bg-white border-black/5 shadow-2xl space-y-6 md:space-y-8`}>
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <p className={`text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] opacity-40`}>핵심 에너지</p>
                            <h4 className="text-2xl md:text-3xl font-title font-bold text-indigo-500">{userData.name}님의 용신: {yongshinResult.yongshin}</h4>
                          </div>
                          <div className={`w-16 h-16 md:w-20 md:h-20 rounded-3xl flex items-center justify-center text-white font-bold text-xl md:text-2xl shadow-2xl ${
                            yongshinResult.yongshin.includes('목') ? 'bg-emerald-500' :
                            yongshinResult.yongshin.includes('화') ? 'bg-red-500' :
                            yongshinResult.yongshin.includes('토') ? 'bg-amber-700' :
                            yongshinResult.yongshin.includes('금') ? 'bg-zinc-400' :
                            'bg-indigo-600'
                          }`}>
                            {yongshinResult.yongshin.charAt(0)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className={`p-4 md:p-6 rounded-3xl bg-zinc-50 border border-black/5`}>
                            <p className="text-[10px] md:text-xs font-bold opacity-40 mb-2 uppercase tracking-wider">일간 강약 (억부)</p>
                            <p className="text-sm md:text-lg font-bold">{yongshinResult.strength} ({yongshinResult.score}점)</p>
                            <p className="text-[11px] md:text-sm text-indigo-500 mt-2 font-bold">억부용신: {yongshinResult.eokbuYongshin}</p>
                          </div>
                          <div className={`p-4 md:p-6 rounded-3xl bg-zinc-50 border border-black/5`}>
                            <p className="text-[10px] md:text-xs font-bold opacity-40 mb-2 uppercase tracking-wider">계절 기운 (조후)</p>
                            <p className="text-sm md:text-lg font-bold">{yongshinResult.johooStatus}</p>
                            <p className="text-[11px] md:text-sm text-indigo-500 mt-2 font-bold">조후용신: {yongshinResult.johooYongshin}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] md:text-xs font-bold opacity-40 uppercase tracking-[0.2em]">분석 근거</p>
                          <p className="text-xs md:text-sm opacity-70 leading-relaxed font-medium">
                            {yongshinResult.logicBasis}
                          </p>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-black/5">
                          <p className="text-[10px] md:text-xs font-bold opacity-40 uppercase tracking-[0.2em]">실생활 가이드</p>
                          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-xs opacity-50">행운의 색:</span>
                              <span className="text-xs font-bold">{yongshinResult.advice.color}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-xs opacity-50">행운의 숫자:</span>
                              <span className="text-xs font-bold">{yongshinResult.advice.numbers}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-xs opacity-50">행운의 방향:</span>
                              <span className="text-xs font-bold">{yongshinResult.advice.direction}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-xs opacity-50">추천 행위:</span>
                              <span className="text-xs font-bold">{yongshinResult.advice.action}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
                <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 px-6 text-center space-y-8">
                  <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center bg-white shadow-xl`}>
                    <LayoutDashboard className={`w-12 h-12 text-zinc-300`} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold">사주 데이터가 없습니다</h3>
                    <p className={`max-w-md mx-auto text-zinc-500`}>
                      HOME 탭에서 생년월일 정보를 입력하시면<br/>
                      정밀한 만세력 분석과 대운 정보를 확인하실 수 있습니다.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab("welcome")}
                    className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
                  >
                    정보 입력하러 가기
                  </button>
                </div>
              )}

              {/* Navigation Guidance for Dashboard */}
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                <motion.div 
                  whileHover={{ y: -5 }}
                  onClick={() => setActiveTab("chat")}
                  className={`cursor-pointer p-8 rounded-[3rem] border transition-all bg-white border-black/5 shadow-xl hover:shadow-2xl space-y-6 group`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="text-violet-500 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">AI와 더 깊은 대화 나누기</h3>
                    <p className={`text-sm leading-relaxed opacity-60`}>
                      분석된 사주를 바탕으로 궁금한 점을 직접 물어보세요. 직업, 연애, 재물운 등 구체적인 조언을 얻을 수 있습니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-violet-500 font-bold text-sm">
                    AI 상담 시작하기
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>

                <motion.div 
                  whileHover={{ y: -5 }}
                  onClick={() => setActiveTab("report")}
                  className={`cursor-pointer p-8 rounded-[3rem] border transition-all bg-white border-black/5 shadow-xl hover:shadow-2xl space-y-6 group`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="text-indigo-500 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">프리미엄 운세 리포트</h3>
                    <p className={`text-sm leading-relaxed opacity-60`}>
                      당신의 인생 설계도를 한눈에 볼 수 있는 정밀 리포트를 생성합니다. PDF로 저장하여 언제든 다시 꺼내볼 수 있습니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
                    리포트 생성하기
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              </div>

              {/* Disclaimer (Moved to bottom) */}
              <div className="max-w-3xl mx-auto p-6 rounded-3xl bg-white border border-zinc-200 mt-12">
                <p className="text-[10px] md:text-xs text-zinc-600 leading-relaxed text-center font-medium">
                  본 분석 결과는 인공지능의 해석이며, 과학적 사실이 아닌 참고 용도로만 사용해 주세요. 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
                </p>
              </div>

              {/* External Manse-ryeok Calendar Link */}
              <div className="max-w-3xl mx-auto flex justify-center mt-8 mb-20">
                <a 
                  href="https://k-manseryeok.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg bg-white text-zinc-900 border border-black/5 hover:bg-zinc-50`}
                >
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  만세력 으로 표시한 달력
                  <ExternalLink className="w-4 h-4 opacity-40" />
                </a>
              </div>
            </motion.div>
          )}

          {activeTab === "taekil" && (
            <motion.div
              key="taekil"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="absolute inset-0 overflow-y-auto p-4 md:p-8 hide-scrollbar bg-white"
            >
              <div className="max-w-7xl mx-auto pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
                  <aside className={`rounded-[2rem] border p-4 md:p-5 lg:sticky lg:top-6 bg-zinc-50 border-zinc-200`}>
                    <div className="mb-4 px-2">
                      <p className={`text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500`}>카테고리</p>
                      <p className={TAEKIL_HELP_TEXT_CLASS}>10개 카테고리 모두 조회 가능합니다.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                      {TAEKIL_CATEGORIES.map((category) => {
                        const enabled = true;
                        const isActive = taekilActiveCategory === category;

                        return (
                          <button
                            key={category}
                            type="button"
                            disabled={!enabled}
                            onClick={() => {
                              if (!enabled) return;
                              setTaekilActiveCategory(category);
                              setTaekilError(null);
                              setTaekilNotice(null);
                            }}
                            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all ${
                              isActive
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                : enabled
                                  ? 'bg-white border-zinc-200 text-zinc-700 hover:border-indigo-200 hover:text-indigo-600'
                                  : 'bg-zinc-100 border-zinc-200 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>
                  </aside>

                  <section className={`rounded-[2rem] border p-4 md:p-8 bg-white border-zinc-200 shadow-sm`}>
                  <div className="mb-6 md:mb-8">
                    <p className={`text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500`}>
                      {taekilActiveCategory === '이사' ? 'Moving Taekil' : 'Marriage Taekil'}
                    </p>
                    <h2 className="mt-2 text-2xl md:text-4xl font-bold tracking-tight">{taekilActiveCategory} 택일</h2>
                    <p className={`mt-3 text-sm md:text-base text-zinc-600`}>
                      프로세스 Q1-Q4를 입력한 뒤 {taekilActiveCategory} 길일 조회를 실행하세요.
                    </p>
                  </div>

                  <div className="space-y-4 md:space-y-5">
                    {taekilActiveCategory === '결혼' ? (
                      <>
                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">배우자의 생년월일시는 언제 입니까?</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>배우자 이름</span>
                              <input type="text" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} placeholder="이름 입력" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>성별</span>
                              <select value={spouseGender} onChange={(e) => setSpouseGender(e.target.value as 'M' | 'F')} className={TAEKIL_FIELD_CLASS}>
                                <option value="M">남성</option>
                                <option value="F">여성</option>
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>출생 연도</span>
                              <input type="text" value={spouseBirthYear} onChange={(e) => setSpouseBirthYear(e.target.value)} placeholder="1990" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                            </label>
                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                              <label className="space-y-2">
                                <span className={TAEKIL_LABEL_CLASS}>월</span>
                                <input type="text" value={spouseBirthMonth} onChange={(e) => setSpouseBirthMonth(e.target.value)} placeholder="1" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                              </label>
                              <label className="space-y-2">
                                <span className={TAEKIL_LABEL_CLASS}>일</span>
                                <input type="text" value={spouseBirthDay} onChange={(e) => setSpouseBirthDay(e.target.value)} placeholder="1" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                              </label>
                            </div>
                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                              <label className="space-y-2">
                                <span className={TAEKIL_LABEL_CLASS}>시</span>
                                <input type="text" value={spouseBirthHour} onChange={(e) => setSpouseBirthHour(e.target.value)} placeholder="12" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                              </label>
                              <label className="space-y-2">
                                <span className={TAEKIL_LABEL_CLASS}>분</span>
                                <input type="text" value={spouseBirthMinute} onChange={(e) => setSpouseBirthMinute(e.target.value)} placeholder="0" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                              </label>
                            </div>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>달력 기준</span>
                              <select value={spouseCalendarType} onChange={(e) => setSpouseCalendarType(e.target.value as 'solar' | 'lunar')} className={TAEKIL_FIELD_CLASS}>
                                <option value="solar">양력</option>
                                <option value="lunar">음력</option>
                              </select>
                            </label>
                            <label className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer bg-white border-zinc-200 text-zinc-700`}>
                              <input type="checkbox" checked={spouseUnknownTime} onChange={(e) => setSpouseUnknownTime(e.target.checked)} />
                              <span className="text-sm font-medium">생시 미상</span>
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">희망하는 결혼식 일정은 언제부터 언제까지 인가요?</h3>
                          <p className={TAEKIL_HELP_TEXT_CLASS}>형식: YYYY-MM-DD</p>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>시작일</span>
                              <input type="date" value={marriagePeriodStart} onChange={(e) => setMarriagePeriodStart(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>종료일</span>
                              <input type="date" value={marriagePeriodEnd} onChange={(e) => setMarriagePeriodEnd(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">희망하는 요일은 언제 인가요? 3순위까지 입력하세요.</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>1순위</span>
                              <select value={preferredWeekday1} onChange={(e) => setPreferredWeekday1(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`w1-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>2순위</span>
                              <select value={preferredWeekday2} onChange={(e) => setPreferredWeekday2(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`w2-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>3순위</span>
                              <select value={preferredWeekday3} onChange={(e) => setPreferredWeekday3(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`w3-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">꼭 피해야 하는 날을 입력해 주세요. (최대 5개)</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {avoidDateInputs.map((value, idx) => (
                              <label key={`avoid-date-${idx}`} className="space-y-2">
                                <span className={TAEKIL_LABEL_CLASS}>회피일 {idx + 1}</span>
                                <input
                                  type="date"
                                  value={value}
                                  onChange={(e) => setAvoidDateInputs((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                                  className={TAEKIL_FIELD_CLASS}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : taekilActiveCategory === '이사' ? (
                      <>
                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">가구주 및 가족 생년월일을 입력해 주세요.</h3>
                          <p className={TAEKIL_HELP_TEXT_CLASS}>가구주 정보는 상단 기본 사주를 사용하며, 가족은 양력 YYYY-MM-DD 기준으로 입력합니다. 가족 정보는 비워도 조회 가능합니다.</p>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {moveFamilyBirthDates.map((value, idx) => (
                              <label key={`move-family-${idx}`} className="space-y-2">
                                <span className={TAEKIL_LABEL_CLASS}>가족 구성원 {idx + 1}</span>
                                <input
                                  type="date"
                                  value={value}
                                  onChange={(e) => setMoveFamilyBirthDates((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                                  className={TAEKIL_FIELD_CLASS}
                                />
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">현재 거주지와 이사 갈 주소를 입력해 주세요.</h3>
                          <p className={TAEKIL_HELP_TEXT_CLASS}>예: 역삼동, 정자동처럼 동 단위까지만 입력해도 조회 가능합니다.</p>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>현재 주소</span>
                              <input type="text" value={moveCurrentAddress} onChange={(e) => setMoveCurrentAddress(e.target.value)} placeholder="예: 서울시 강남구 ..." className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>이사 갈 주소</span>
                              <input type="text" value={moveTargetAddress} onChange={(e) => setMoveTargetAddress(e.target.value)} placeholder="예: 경기도 성남시 ..." className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">희망 이사 기간과 선호 요일을 입력해 주세요.</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>시작일</span>
                              <input type="date" value={movePeriodStart} onChange={(e) => setMovePeriodStart(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>종료일</span>
                              <input type="date" value={movePeriodEnd} onChange={(e) => setMovePeriodEnd(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                          </div>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>1순위</span>
                              <select value={movePreferredWeekday1} onChange={(e) => setMovePreferredWeekday1(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`mw1-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>2순위</span>
                              <select value={movePreferredWeekday2} onChange={(e) => setMovePreferredWeekday2(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`mw2-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>3순위</span>
                              <select value={movePreferredWeekday3} onChange={(e) => setMovePreferredWeekday3(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`mw3-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">무엇을 더 중시할지 선택해 주세요.</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>중요도 설정</span>
                              <select value={movePriority} onChange={(e) => setMovePriority(e.target.value as 'folklore' | 'saju' | 'balanced')} className={TAEKIL_FIELD_CLASS}>
                                <option value="balanced">균형형(민속+사주)</option>
                                <option value="folklore">손없는날/민속 우선</option>
                                <option value="saju">사주 맞춤 우선</option>
                              </select>
                            </label>
                            <label className={`flex items-center gap-3 rounded-2xl border px-4 py-3 mt-6 md:mt-0 cursor-pointer bg-white border-zinc-200 text-zinc-700`}>
                              <input type="checkbox" checked={moveOnlyWeekend} onChange={(e) => setMoveOnlyWeekend(e.target.checked)} />
                              <span className="text-sm font-medium">주말만 가능</span>
                            </label>
                          </div>
                        </div>
                      </>
                    ) : taekilActiveCategory === '출산' ? (
                      <>
                        <div className={`rounded-3xl border p-4 md:p-6 bg-indigo-50 border-indigo-200`}>
                          <p className={`text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-700`}>출산 택일 프롬프트</p>
                          <p className={`mt-2 text-sm leading-relaxed text-zinc-700`}>
                            "당신은 사주팔자를 설계하는 명리학 대가입니다. 아래 조건에 맞는 최상의 출산 택일을 수행하세요."
                          </p>
                          <ul className={`mt-3 text-xs space-y-1 text-zinc-600`}>
                            <li>1순위: 오행 중화 및 조후 적합</li>
                            <li>2순위: 초년/중년 대운 희신 방향</li>
                            <li>3순위: 부모와 원진/충 회피</li>
                          </ul>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">부모 데이터 (생년월일시)</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>부 생년월일</span>
                              <input type="date" value={childFatherBirthDate} onChange={(e) => setChildFatherBirthDate(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>부 출생시각 (HH:mm)</span>
                              <input type="time" value={childFatherBirthTime} onChange={(e) => setChildFatherBirthTime(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>모 생년월일</span>
                              <input type="date" value={childMotherBirthDate} onChange={(e) => setChildMotherBirthDate(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>모 출생시각 (HH:mm)</span>
                              <input type="time" value={childMotherBirthTime} onChange={(e) => setChildMotherBirthTime(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">태아 데이터</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>태아 성별</span>
                              <select value={childFetusGender} onChange={(e) => setChildFetusGender(e.target.value as '남' | '여')} className={TAEKIL_FIELD_CLASS}>
                                <option value="남">남</option>
                                <option value="여">여</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">분만 가능일</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>시작일</span>
                              <input type="date" value={childbirthPeriodStart} onChange={(e) => setChildbirthPeriodStart(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>종료일</span>
                              <input type="date" value={childbirthPeriodEnd} onChange={(e) => setChildbirthPeriodEnd(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">결과 형식</h3>
                          <p className={`mt-2 text-sm leading-relaxed text-zinc-600`}>
                            추천 날짜/시진 3안, 각 안의 성격·진로·건강운 요약을 기준으로 해석합니다.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">희망 기간을 입력해 주세요.</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>시작일</span>
                              <input type="date" value={generalPeriodStart} onChange={(e) => setGeneralPeriodStart(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>종료일</span>
                              <input type="date" value={generalPeriodEnd} onChange={(e) => setGeneralPeriodEnd(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">{taekilActiveCategory}에 필요한 핵심 정보를 입력해 주세요.</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {taekilActiveFields.map((field) => (
                              <label key={`${taekilActiveCategory}-${field.key}`} className={`space-y-2 ${field.key.endsWith('Priority') ? 'md:col-span-2' : ''}`}>
                                <span className={TAEKIL_LABEL_CLASS}>{field.label}</span>
                                {field.type === 'select' ? (
                                  <select
                                    value={taekilFormValues[field.key] ?? ''}
                                    onChange={(e) => setTaekilFormValue(field.key, e.target.value)}
                                    className={TAEKIL_FIELD_CLASS}
                                  >
                                    <option value="">선택하세요</option>
                                    {field.options?.map((option) => (
                                      <option key={`${field.key}-${option.value}`} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={taekilFormValues[field.key] ?? ''}
                                    onChange={(e) => setTaekilFormValue(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={TAEKIL_FIELD_PLACEHOLDER_CLASS}
                                  />
                                )}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">희망 요일 우선순위를 입력해 주세요.</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>1순위</span>
                              <select value={generalPreferredWeekday1} onChange={(e) => setGeneralPreferredWeekday1(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`gw1-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>2순위</span>
                              <select value={generalPreferredWeekday2} onChange={(e) => setGeneralPreferredWeekday2(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`gw2-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>3순위</span>
                              <select value={generalPreferredWeekday3} onChange={(e) => setGeneralPreferredWeekday3(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                                {WEEKDAY_OPTIONS.map((option) => <option key={`gw3-${option.value}`} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                          <h3 className="mt-1 text-base md:text-lg font-bold">피해야 할 날(선택)과 추가 메모를 입력해 주세요.</h3>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {generalAvoidDateInputs.map((value, idx) => (
                              <label key={`generic-avoid-date-${idx}`} className="space-y-2">
                                <span className={TAEKIL_LABEL_CLASS}>회피일 {idx + 1}</span>
                                <input
                                  type="date"
                                  value={value}
                                  onChange={(e) => setGeneralAvoidDateInputs((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                                  className={TAEKIL_FIELD_CLASS}
                                />
                              </label>
                            ))}
                          </div>
                          <label className="space-y-2 block mt-4">
                            <span className={TAEKIL_LABEL_CLASS}>추가 메모 (선택)</span>
                            <textarea
                              value={taekilAdditionalInfo}
                              onChange={(e) => setTaekilAdditionalInfo(e.target.value)}
                              rows={3}
                              placeholder="예: 오전 일정 선호, 서류 확인이 중요한 날 선호, 가족 이동 동선 최소화"
                              className={`${TAEKIL_FIELD_PLACEHOLDER_CLASS} resize-none`}
                            />
                          </label>
                        </div>
                      </>
                    )}

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleGenerateTaekil}
                        disabled={taekilLoading}
                        className={`w-full md:w-auto px-6 py-3 rounded-2xl text-white text-sm font-bold transition-all bg-indigo-600 hover:bg-indigo-700 ${taekilLoading ? 'opacity-60 cursor-wait' : ''}`}
                      >
                        {taekilLoading ? '계산 중...' : `${taekilActiveCategory} 길일 조회`}
                      </button>
                    </div>

                    {taekilNotice && (
                      <div className={`rounded-2xl border px-4 py-3 text-sm bg-sky-50 border-sky-200 text-sky-700`}>
                        {taekilNotice}
                      </div>
                    )}

                    {taekilError && (
                      <div className={`rounded-2xl border px-4 py-3 text-sm bg-rose-50 border-rose-200 text-rose-700`}>
                        {taekilError}
                      </div>
                    )}

                    {taekilDisplayResults.length > 0 && (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-base md:text-lg font-bold">
                            {taekilActiveCategory === '출산' ? '출산 택일 추천 3안' : `${taekilActiveCategory} 택일 추천`}
                          </h4>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200`}>
                            {taekilDisplayResults.length}개
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {taekilDisplayResults.map((item, index) => (
                            (() => {
                              const profileSummary = taekilActiveCategory === '출산'
                                ? getChildbirthProfileSummary(item)
                                : null;

                              return (
                            <button
                              key={`${item.date}-${index}`}
                              type="button"
                              onClick={() => setSelectedTaekilDate(item.date)}
                              className={`rounded-2xl border p-4 text-left transition-all ${selectedTaekilDate === item.date ? ('bg-indigo-50 border-indigo-300') : ('bg-white border-zinc-200 hover:border-indigo-200')}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-bold">{index + 1}안 · {item.date}</p>
                                  <p className={TAEKIL_HELP_TEXT_CLASS}>
                                    추천 시진: {item.topTimeSlots?.[0]?.time || '산출 없음'}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 space-y-1.5">
                                {item.reasons.slice(0, 2).map((reason, reasonIdx) => (
                                  <p key={`${item.date}-reason-${reasonIdx}`} className={`text-xs leading-relaxed text-zinc-600`}>
                                    {reason}
                                  </p>
                                ))}
                                {profileSummary && (
                                  <div className={`mt-2 rounded-xl border px-3 py-2 space-y-1 border-zinc-200 bg-zinc-50`}>
                                    <p className={`text-xs leading-relaxed text-zinc-700`}>{profileSummary.personality}</p>
                                    <p className={`text-xs leading-relaxed text-zinc-700`}>{profileSummary.career}</p>
                                    <p className={`text-xs leading-relaxed text-zinc-700`}>{profileSummary.health}</p>
                                    <p className={`text-xs leading-relaxed text-zinc-600`}>{profileSummary.caution}</p>
                                  </div>
                                )}
                              </div>
                            </button>
                              );
                            })()
                          ))}
                        </div>

                        {selectedTaekilDetail && (
                          (() => {
                            const detailProfileSummary = taekilActiveCategory === '출산'
                              ? getChildbirthProfileSummary(selectedTaekilDetail)
                              : null;

                            return (
                          <div className={`rounded-2xl border p-4 bg-zinc-50 border-zinc-200`}>
                            <p className="text-sm font-bold">선택 후보: {selectedTaekilDetail.date}</p>
                            <div className="mt-2 space-y-1.5">
                              {selectedTaekilDetail.reasons.slice(0, 4).map((reason, idx) => (
                                <p key={`detail-reason-${idx}`} className={`text-xs leading-relaxed text-zinc-600`}>
                                  {reason}
                                </p>
                              ))}
                              {detailProfileSummary && (
                                <div className={`mt-2 rounded-xl border px-3 py-2 space-y-1 border-zinc-200 bg-white`}>
                                  <p className={`text-xs leading-relaxed text-zinc-700`}>{detailProfileSummary.personality}</p>
                                  <p className={`text-xs leading-relaxed text-zinc-700`}>{detailProfileSummary.career}</p>
                                  <p className={`text-xs leading-relaxed text-zinc-700`}>{detailProfileSummary.health}</p>
                                  <p className={`text-xs leading-relaxed text-zinc-600`}>{detailProfileSummary.caution}</p>
                                </div>
                              )}
                            </div>
                          </div>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col overflow-hidden bg-white"
            >
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full">
                {/* Desktop Sidebar for Suggestions */}
                <aside className="hidden md:flex w-64 flex-col border-r border-black/5 p-4 space-y-6 overflow-y-auto relative">
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 px-2">상담 모드</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => switchConsultationMode('basic')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          consultationMode === 'basic'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        초급자
                      </button>
                      <button
                        onClick={() => switchConsultationMode('advanced')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          consultationMode === 'advanced'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        고급자
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-black/5">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 px-2">상담 초기화</h4>
                    <div className="grid grid-cols-1 gap-2 px-2">
                      <button
                        onClick={clearChatWindowOnly}
                        className={`px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all bg-white border-gray-200 text-zinc-700 hover:border-indigo-300 hover:text-indigo-600`}
                        title="화면만 정리하고 이전 상담 맥락은 유지"
                      >
                        채팅창 비우기(맥락 유지)
                      </button>
                      <button
                        onClick={clearChatWindowAndContext}
                        className={`px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all bg-rose-50 border-rose-200 text-rose-700 hover:border-rose-300`}
                        title="화면과 상담 맥락을 함께 초기화"
                      >
                        채팅+상담기록 초기화
                      </button>
                    </div>
                  </div>

                  {/* Consultation Tips */}
                  <div className="space-y-3 pt-4 border-t border-black/5">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 px-2">사주상담시 유용한 팁</h4>
                    <ul className="space-y-2 px-2">
                      <li className="text-[12px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>질문에 "어떻게"를 넣어보세요. 고민의 해결은 나의 행동에서 출발합니다. 내가 어떻게 하는가가 많은 걸 바꿉니다.</span>
                      </li>
                      <li className="text-[12px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>구체적인 상황을 알려주세요. 사주상담이 더욱 풍성해지고 알차집니다. 여기에서 알려주시는 모든 사적인 내용은 철저하게 보호해드립니다.</span>
                      </li>
                      <li className="text-[12px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>상담내용에 다른 사람의 개인 정보(물론 그분의 동의가 필요합니다)를 넣으시면 더 좋은 상담결과가 나옵니다.</span>
                      </li>
                      <li className="text-[12px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>MBTI 등 추가적인 정보를 넣으시면 관련하여 더욱 알찬 상담이 될 수 있습니다.</span>
                      </li>
                      <li className="text-[12px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>상담을 진행하다 맥락을 리프레시하고 상담을 재개하면 객관적인 상담이 유지될 수 있습니다.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Privacy Notice (Desktop) */}
                  <div className="mt-auto pt-6">
                    <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                      상담에 사용된 개인정보 등 모든 정보는 상담이 끝나면 자동으로 파기 됩니다. 마음 편하게 상담해 주세요.
                    </p>
                  </div>
                </aside>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative text-[12pt]">
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-5 hide-scrollbar">
                    {modeNotice && (
                      <div className="mx-auto max-w-3xl rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-center text-[12px] text-indigo-700">
                        {modeNotice}
                      </div>
                    )}
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                        <MessageCircle className="w-14 h-14" />
                        <p>
                          {consultationMode === 'basic'
                            ? '무엇이 궁금하신가요?\n아래 추천 질문을 선택하거나 음성/직접 입력해 주세요.'
                            : '궁금한 점을 물어보세요.\n당신의 사주를 기반으로 답변해 드립니다.'}
                        </p>
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} className={`space-y-2 ${msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
                        <div className={`max-w-[96%] md:max-w-[92%] p-4 md:p-5 rounded-2xl leading-relaxed shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                        }`}>
                          {renderChatPlainText(msg.text)}
                        </div>

                        {msg.role === 'model' && i === messages.length - 1 && !loading && suggestions.length > 0 && (
                          <div className={`w-full max-w-[96%] md:max-w-[92%] p-3 rounded-2xl border bg-indigo-50/70 border-indigo-100`}>
                            <div className="flex flex-wrap justify-center gap-2 mb-2">
                              {(consultationMode === 'basic' ? BASIC_CHAT_CATEGORIES : CATEGORIES).map((cat) => (
                                <button
                                  key={`inline-basic-category-${cat}`}
                                  onClick={() => {
                                    if (consultationMode === 'basic') {
                                      setBasicSelectedCategory(cat);
                                    } else {
                                      setSelectedCategory(cat);
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-xl border text-sm transition-all ${
                                    (consultationMode === 'basic' ? basicSelectedCategory : selectedCategory) === cat
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'bg-white border-indigo-100 text-zinc-600 hover:border-indigo-300'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                            <div className="flex flex-wrap justify-center gap-2">
                              {suggestions.map((s, idx) => (
                                <button
                                  key={`inline-chat-suggestion-${idx}`}
                                  onClick={() => handleSuggestionClick(s)}
                                  className={`text-left px-3 py-2 rounded-xl border transition-all bg-white border-indigo-100 text-zinc-700 hover:border-indigo-300 hover:text-indigo-600`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {loading && (
                      <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full w-fit border bg-gray-100 border-gray-200`}>
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                        <span className={`text-gray-500`}>유아이가 분석 중입니다...</span>
                      </div>
                    )}

                  </div>

                  {/* Input Area */}
                  <div className={`p-2 border-t md:pb-4 border-gray-200 bg-white/80`}>
                    <div className="max-w-4xl mx-auto relative">
                      <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={consultationMode === 'basic' ? '음성 또는 직접 입력으로 질문해 주세요...' : '메시지를 입력하세요...'}
                        className={`w-full border rounded-2xl py-3 pl-4 pr-24 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm bg-white border-gray-300 text-gray-900`}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleVoiceInput}
                            className={`p-2 rounded-xl shadow-lg active:scale-90 transition-transform ${isListening ? 'bg-rose-500 text-white' : 'bg-zinc-200 text-zinc-700'}`}
                            title="음성 입력"
                          >
                            <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                          </button>
                          <button onClick={() => handleSend()} className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg active:scale-90 transition-transform">
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {voiceStatusMessage && (
                      <p className={`max-w-4xl mx-auto mt-1 text-[11px] text-rose-600`}>
                        {voiceStatusMessage}
                      </p>
                    )}

                    <div className="max-w-4xl mx-auto mt-2 flex flex-wrap justify-center gap-2">
                      {["올해운세", "내년운세", "이번달운세", "오늘의 운세"].map((shortcut) => (
                        <button
                          key={`fortune-shortcut-${shortcut}`}
                          onClick={() => handleSuggestionClick(shortcut)}
                          disabled={loading}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all disabled:opacity-50 bg-white border-indigo-100 text-zinc-700 hover:border-indigo-300 hover:text-indigo-600`}
                        >
                          {shortcut}
                        </button>
                      ))}
                    </div>

                    {/* Mobile-only Quick Actions & Privacy Notice */}
                    <div className="md:hidden mt-0.5 space-y-0.5">
                      <div className="grid grid-cols-2 gap-1 pb-1">
                        <button
                          onClick={() => switchConsultationMode('basic')}
                          className={`px-2 py-1 rounded-lg text-[12px] font-bold border ${consultationMode === 'basic' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500'}`}
                        >
                          초급자
                        </button>
                        <button
                          onClick={() => switchConsultationMode('advanced')}
                          className={`px-2 py-1 rounded-lg text-[12px] font-bold border ${consultationMode === 'advanced' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500'}`}
                        >
                          고급자
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-1 pb-1">
                        <button
                          onClick={clearChatWindowOnly}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border bg-white border-gray-200 text-zinc-700`}
                          title="화면만 정리하고 이전 상담 맥락은 유지"
                        >
                          채팅창 비우기(맥락 유지)
                        </button>
                        <button
                          onClick={clearChatWindowAndContext}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border bg-rose-50 border-rose-200 text-rose-700`}
                          title="화면과 상담 맥락을 함께 초기화"
                        >
                          채팅+상담기록 초기화
                        </button>
                      </div>

                      {/* Privacy Notice (Mobile) */}
                      <div className="pt-1 border-t border-black/5">
                        <p className="text-[10px] text-zinc-500 text-center leading-tight">
                          상담 정보는 상담 종료 시 자동 파기됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "report" && (
            <motion.div 
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 overflow-y-auto p-4 md:p-10 hide-scrollbar bg-white"
            >
              <div className="max-w-4xl mx-auto pb-20">
                {/* Top control bar */}
                <div className="flex items-center justify-between mb-6">
                  {/* Mode toggle */}
                  <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-100">
                    <button
                      onClick={() => switchReportMode('basic')}
                      disabled={loading}
                      className={`px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                        consultationMode === 'basic'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      초급자
                    </button>
                    <button
                      onClick={() => switchReportMode('advanced')}
                      disabled={loading}
                      className={`px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                        consultationMode === 'advanced'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      고급자
                    </button>
                  </div>

                  {/* PDF save */}
                  <button
                    onClick={handleDownloadPDF}
                    disabled={loading || isPrinting || !reportContent}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-40"
                  >
                    <Download className={`w-4 h-4 ${isPrinting ? 'animate-bounce' : ''}`} />
                    PDF 저장
                  </button>
                </div>

                {/* Main Content Area */}
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-32 space-y-6 bg-zinc-50 rounded-[3rem]"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                        <Compass className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-lg font-bold animate-pulse">운명의 지도를 그리는 중...</p>
                        <p className="text-xs text-zinc-500">AI 디렉터가 당신의 사주 로그를 정밀 분석하고 있습니다.</p>
                      </div>
                    </motion.div>
                  ) : reportContent ? (
                    <motion.div 
                      key="content"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                      ref={reportRef}
                    >
                      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-xl border border-black/5">
                        <ReportAccordion content={reportContent} forceOpen={isPrinting} />
                      </div>
                      <div className="mt-10 pt-6 border-t border-black/5">
                        <p className="text-[10px] text-zinc-500 leading-relaxed text-center">
                          본 리포트는 인공지능의 명리학적 해석이며, 과학적 사실이 아닙니다. 참고 용도로만 사용해 주시기 바라며, 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-32 space-y-8 bg-zinc-50 rounded-[3rem] border-2 border-dashed border-zinc-200"
                    >
                      <div className="w-24 h-24 rounded-full bg-indigo-500/5 flex items-center justify-center mx-auto border border-indigo-500/10">
                        <FileText className="w-10 h-10 text-indigo-500/30" />
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-2xl font-title font-bold">운세 리포트가 아직 없습니다.</h3>
                        <p className="text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
                          위의 모드 버튼을 선택하면<br/>
                          AI 디렉터가 사주 데이터를 기반으로 리포트를 생성해 드립니다.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === "guide" && (
            <motion.div 
              key="guide"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 hide-scrollbar bg-white"
            >
              <div className="max-w-6xl mx-auto space-y-12 pb-20">
                {/* Guide Sub-navigation */}
                {guideSubPage !== "main" && (
                  <button 
                    onClick={() => setGuideSubPage("main")}
                    className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-8 hover:underline transition-all group"
                  >
                    <div className="p-2 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </div>
                    가이드 메인으로 돌아가기
                  </button>
                )}

                {guideSubPage === "main" ? (
                  <>
                    {/* CEO 인사말 카드 */}
                    <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-black/5 flex flex-col md:flex-row">
                      <div className="md:w-1/3 bg-indigo-600 p-10 text-center relative overflow-hidden flex flex-col items-center justify-center">
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <circle cx="100" cy="0" r="80" fill="none" stroke="white" strokeWidth="0.5" />
                            <circle cx="100" cy="0" r="60" fill="none" stroke="white" strokeWidth="0.5" />
                          </svg>
                        </div>
                        <div className="relative z-10 space-y-4">
                          <h2 className="text-white text-3xl font-serif font-bold leading-tight">
                            CEO 인사말
                          </h2>
                          <p className="text-indigo-100 text-xs font-serif opacity-70">당신의 삶을 비추는 고요한 등불</p>
                        </div>
                      </div>
                      <div className="flex-1 p-10 md:p-14 space-y-8">
                        <div className="space-y-6 text-base md:text-lg leading-relaxed font-serif text-zinc-700">
                          <p className="font-bold text-zinc-900 text-xl">안녕하세요. 삶의 소중한 길목에서 유아이를 찾아주신 귀하께 깊은 감사의 인사를 전합니다.</p>
                          <div className="space-y-4">
                            <p>
                              유아이는 단순히 정해진 운명을 말하는 곳이 아닙니다. 
                              우리는 수천 년을 이어온 명리학의 깊은 지혜를 가장 정밀한 AI 기술과 결합하여, 
                              당신만을 위한 <strong>'삶의 전략'</strong>을 도출해 내는 전문 사주 상담 플랫폼입니다.
                            </p>
                            <p>
                              <strong>최고의 전문성을 지향합니다:</strong> 유아이는 AI에게 방대하고 정교한 사주 전문 소스를 학습시켜, 
                              그 어떤 곳보다 깊이 있고 체계적인 분석 결과를 제공합니다. 단순한 키워드 나열이 아닌, 
                              당신의 삶을 관통하는 거대한 흐름을 읽어드립니다.
                            </p>
                            <p>
                              <strong>당신의 평온을 최우선으로 합니다:</strong> 고민의 무게를 누구보다 잘 알기에, 
                              유아이는 상담자의 프라이버시를 철저히 보장합니다. 로그인 없이도 당신의 속 깊은 이야기를 나눌 수 있으며, 
                              모든 상담은 오직 당신만을 위한 맞춤형 공간에서 안전하게 진행됩니다.
                            </p>
                            <p>
                              누구에게도 꺼내놓지 못한 고민이 있다면, 이제 유아이의 지혜를 빌려보십시오. 
                              당신의 내일이 오늘보다 더 명료해질 수 있도록 정성을 다해 돕겠습니다.
                            </p>
                          </div>
                        </div>
                        <div className="pt-8 border-t border-black/5 text-right">
                          <p className="text-sm font-serif opacity-60 italic">유아이사주상담 디렉터 배상</p>
                        </div>
                      </div>
                    </div>

                    {/* 정보 그리드 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* 카드 1: 유아이 앱의 장점 */}
                      <div className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-black/5 flex flex-col">
                        <div className="bg-[#0047AB] p-10 text-center">
                          <h2 className="text-white text-3xl font-handwriting leading-tight">
                            유아이 앱이 다른 앱보다<br/>좋은 세가지 이유
                          </h2>
                        </div>
                        <div className="p-10 space-y-10">
                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                              <div className="relative">
                                <Database className="w-8 h-8 text-indigo-600 opacity-40" />
                                <Lock className="w-5 h-5 text-indigo-600 absolute -bottom-1 -right-1" />
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-rose-500 rotate-45 origin-center translate-y-4"></div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800">철저한 프라이버시 보호</p>
                              <p className="text-sm text-zinc-500 leading-relaxed">
                                사용자의 개인정보와 프라이버시를 철저히 보호합니다. 분석과 상담을 위해 사용자가 제공한 개인정보와 프라이버시는 서버에 저장되지 않습니다.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                              <Zap className="w-8 h-8 text-indigo-600" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800">정밀한 사주 데이터 학습</p>
                              <p className="text-sm text-zinc-500 leading-relaxed">
                                AI 모델에 만세력에서 추출한 정밀한 사주데이타를 학습시켜 확실한 사주 감명이 되도록 시스템을 만들었습니다.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                              <div className="relative">
                                <Bot className="w-8 h-8 text-indigo-600" />
                                <BookOpen className="w-4 h-4 text-indigo-600 absolute -top-1 -right-1" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800">맞춤형 인생 가이드 제공</p>
                              <p className="text-sm text-zinc-500 leading-relaxed">
                                사용자의 고유한 상황을 고려해서 실질적인 인생의 가이드가 되도록 맞춤 상담을 제공합니다.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 카드 2: 정보 입력 방법 */}
                      <div className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-black/5 flex flex-col">
                        <div className="bg-[#0047AB] p-10 text-center">
                          <h2 className="text-white text-3xl font-handwriting leading-tight">
                            사용자 정보 입력 방법
                          </h2>
                        </div>
                        <div className="p-10 space-y-10">
                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                              <Clock className="w-8 h-8 text-indigo-500" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800">생시 미입력 가능</p>
                              <p className="text-sm text-zinc-500 leading-relaxed">모르면 비워두세요. 6개의 글자로도 충분합니다.</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                              <Calendar className="w-8 h-8 text-indigo-500" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800">양력/음력 자동 인식</p>
                              <p className="text-sm text-zinc-500 leading-relaxed">별도 선택이 없으면 기본 양력으로 분석합니다.</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                              <Zap className="w-8 h-8 text-white fill-white" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-indigo-600">분석 시작</p>
                              <p className="text-sm text-zinc-500 leading-relaxed">버튼을 누르면 당신의 운세 분석이 시작됩니다.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 카드 3: 운세 철학 */}
                      <div className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-black/5 flex flex-col md:col-span-2">
                        <div className="bg-[#0047AB] p-10 text-center">
                          <h2 className="text-white text-3xl font-handwriting leading-tight">
                            유아이의 운세분석 과정과<br/>운세에 대한 철학
                          </h2>
                        </div>
                        <div className="p-10 flex flex-col md:flex-row items-center justify-around gap-12">
                          {/* 분석 프로세스 */}
                          <div className="flex flex-col items-center space-y-6">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center border border-black/5">
                                <User className="w-8 h-8 text-zinc-500" />
                              </div>
                              <div className="w-12 h-px bg-zinc-200 border-t border-dashed"></div>
                              <div className="w-24 h-24 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Cpu className="w-12 h-12 text-white animate-pulse" />
                              </div>
                              <div className="w-12 h-px bg-zinc-200 border-t border-dashed"></div>
                              <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center border border-black/5">
                                <FileText className="w-8 h-8 text-indigo-500" />
                              </div>
                            </div>
                            <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">분석 프로세스</p>
                          </div>

                          <div className="hidden md:block w-px h-40 bg-zinc-100"></div>

                          {/* 운세 철학 */}
                          <div className="flex flex-col items-center text-center space-y-8 max-w-md">
                            <div className="relative w-40 h-40 flex items-center justify-center">
                              <Waves className="w-full h-full text-indigo-500/20 absolute animate-pulse" />
                              <div className="relative z-10 p-6 bg-white rounded-full border-2 border-indigo-500 shadow-2xl">
                                <Compass className="w-14 h-14 text-indigo-600" />
                              </div>
                            </div>
                            <div className="space-y-4">
                              <p className="text-xl font-bold text-zinc-800">
                                "운명은 정해진 결말이 아니라,<br/>우리가 조종하는 돛의 방향입니다."
                              </p>
                              <p className="text-sm text-zinc-500 leading-relaxed">
                                만세력 기반의 정밀 분석과 AI의 전략적 해석으로,<br/>
                                당신의 삶을 능동적으로 이끌 최고의 대응 전략을 제시합니다.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[3rem] p-8 md:p-16 shadow-2xl border border-black/5"
                  >
                    <div className="markdown-body prose max-w-none">
                      {guideSubPage === "about" && (
                        <ReactMarkdown>{`
# 유아이사주(UI Saju) 소개

유아이(UI) 사주상담은 수천 년의 역사를 가진 동양의 명리학적 지혜와 현대의 최첨단 인공지능 기술을 결합하여, 현대인들에게 가장 정밀하고 실질적인 인생의 전략을 제시하는 프리미엄 사주 분석 플랫폼입니다.

## 우리의 미션
동양에서 예전부터 나라의 중요한 행정, 정치, 경제 운영에 광범위하게 활용되었던 사주명리학을 기반으로 현대의 첨단 인공지능 기술을 결합하여 각 개인이 더 나은 삶을 살아가는데 도움이 되는 것입니다. 삶의 중요한 결정의 순간에 최선의 선택을 할 수 있도록 돕겠습니다.

## 주요 서비스
- **정밀 만세력 분석**: 전통 명리학의 원칙에 충실한 8자 분석
- **AI 전략 도출**: 방대한 사주 데이터를 학습한 AI의 현대적 해석
- **실시간 상담**: 궁금한 점을 즉시 해소할 수 있는 대화형 인터페이스
- **운명 리포트**: 당신의 삶을 관통하는 거대한 흐름을 담은 종합 분석서

## 가치와 철학
우리는 운명이 고정된 것이 아니라, 자신의 기운을 이해하고 적절한 전략을 세움으로써 개선할 수 있는 것이라고 믿습니다. 유아이는 단순한 점술을 넘어, 데이터에 기반한 삶의 가이드라인을 제공합니다.

## 운영 정보
- **운영팀**: 유아이 사주 전략 연구소 (UI Saju Lab)
- **대표 디렉터**: 오세진
- **문의**: [dean.uitrading@gmail.com](mailto:dean.uitrading@gmail.com)
- **웹사이트**: [https://ais-pre-wuknjkjkvoeqlkc6y4jenr-502458168031.asia-east1.run.app](https://ais-pre-wuknjkjkvoeqlkc6y4jenr-502458168031.asia-east1.run.app)
                        `}</ReactMarkdown>
                      )}
                      {guideSubPage === "terms" && (
                        <ReactMarkdown>{`
# 이용약관 (Terms of Service)

본 약관은 유아이 사주상담(이하 "서비스")이 제공하는 모든 서비스의 이용 조건 및 절차에 관한 사항을 규정합니다.

## 제1조 (목적)
본 서비스는 인공지능 기술을 활용한 사주 분석 및 상담을 제공하며, 사용자의 자기 이해와 삶의 참고 자료로 활용됨을 목적으로 합니다.

## 제2조 (서비스의 성격 및 책임의 한계)
1. 본 서비스에서 제공하는 모든 분석 결과는 인공지능의 명리학적 해석이며, 과학적 사실이나 절대적인 예언이 아닙니다.
2. 서비스의 결과는 사용자의 주관적인 판단에 도움을 주기 위한 참고 자료일 뿐이며, 의료, 법률, 금융 등 전문적인 조언을 대체할 수 없습니다.
3. 사용자가 서비스의 결과를 바탕으로 내린 모든 결정과 그로 인해 발생하는 결과에 대한 책임은 사용자 본인에게 있습니다.

## 제3조 (콘텐츠 저작권)
1. 서비스가 제공하는 분석 결과 및 리포트의 저작권은 서비스 운영자에게 있습니다.
2. 사용자는 개인적인 용도로만 결과를 활용할 수 있으며, 상업적 목적으로 무단 복제, 배포, 수정하는 행위는 금지됩니다.

## 제4조 (개인정보 보호)
서비스는 사용자의 사주 분석을 위해 입력된 정보를 분석 목적으로만 사용하며, 별도의 동의 없이 서버에 영구 저장하거나 제3자에게 제공하지 않습니다. 상세한 내용은 개인정보 처리방침을 따릅니다.

## 제5조 (광고 게재)
1. 서비스는 운영 유지를 위해 구글 애드센스 등 제3자 광고를 게재할 수 있습니다.
2. 광고 클릭 및 이용 과정에서 발생하는 제3자 서비스와의 상호작용은 해당 서비스의 약관을 따릅니다.

## 제6조 (이용 제한)
서비스의 정상적인 운영을 방해하거나, 부적절한 방법으로 시스템에 접근하는 경우 이용이 제한될 수 있습니다.
                        `}</ReactMarkdown>
                      )}
                      {guideSubPage === "privacy" && (
                        <ReactMarkdown>{`
# 개인정보 처리방침 (Privacy Policy)

유아이 사주상담(이하 "서비스")은 사용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다. 본 방침은 구글 애드센스 광고 게재와 관련된 내용을 포함하고 있습니다.

## 1. 수집하는 개인정보 항목
서비스는 사주 분석 및 상담을 위해 다음과 같은 정보를 수집합니다.
- 필수 항목: 생년월일, 태어난 시간(선택), 성별, 양력/음력 구분
- 상담 항목: 사용자가 채팅창에 직접 입력한 질문 내용
- 자동 수집 항목: IP 주소, 쿠키, 서비스 이용 기록, 기기 정보 (광고 및 분석 목적)

## 2. 개인정보의 수집 및 이용 목적
수집된 정보는 오직 다음과 같은 목적에만 사용됩니다.
- 만세력 기반의 사주 분석 및 AI 상담 결과 도출
- 서비스 품질 개선 및 사용자 맞춤형 가이드 제공
- **광고 게재**: 구글 애드센스를 통한 맞춤형 광고 제공

## 3. 쿠키(Cookie) 및 제3자 광고
본 서비스는 광고 게재를 위해 쿠키를 사용합니다.
- **Google AdSense**: 구글을 포함한 제3자 업체는 사용자의 이전 방문 기록을 바탕으로 광고를 게재하기 위해 쿠키를 사용합니다.
- **광고 개인 정보 보호**: 구글의 광고 쿠키를 사용함으로써 구글 및 파트너 업체는 사용자의 본 사이트 및 기타 사이트 방문 기록을 바탕으로 사용자에게 적절한 광고를 게재할 수 있습니다.
- **거부 방법**: 사용자는 [구글 광고 설정](https://www.google.com/settings/ads)을 방문하여 개인 맞춤형 광고를 해제할 수 있습니다. 또는 [www.aboutads.info](http://www.aboutads.info)를 방문하여 제3자 업체의 쿠키 사용을 중단할 수 있습니다.

## 4. 개인정보의 보유 및 파기
**유아이는 사용자의 민감한 사주 데이터를 서버에 영구 저장하지 않는 것을 원칙으로 합니다.**
- 입력된 사주 정보는 세션 동안 분석을 위해서만 일시적으로 사용됩니다.
- 사용자가 브라우저를 종료하거나 세션이 만료되면 해당 정보는 즉시 파기됩니다.

## 5. 제3자 제공 및 위탁
서비스는 사용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 서비스 운영을 위해 다음과 같은 외부 플랫폼을 활용합니다.
- **Google Firebase**: 데이터베이스 및 시스템 운영
- **Google AdSense**: 광고 게재 및 수익화

## 6. 사용자의 권리
사용자는 언제든지 자신의 정보 입력을 중단할 수 있으며, 브라우저의 캐시 및 쿠키 삭제를 통해 로컬 데이터를 관리할 수 있습니다.
                        `}</ReactMarkdown>
                      )}
                      {guideSubPage === "contact" && (
                        <ReactMarkdown>{`
# 문의하기 (Contact Us)

유아이 사주상담 서비스 이용 중 궁금한 점이나 제안하고 싶은 내용이 있다면 언제든지 연락해 주세요.

## 연락처 정보
- **이메일**: [dean.uitrading@gmail.com](mailto:dean.uitrading@gmail.com)
- **운영 시간**: 언제든 가능

## 제휴 및 비즈니스 문의
유아이의 AI 사주 분석 기술을 활용한 제휴나 비즈니스 협업 제안도 환영합니다. 이메일로 상세 내용을 보내주시면 검토 후 연락드리겠습니다.

---
*보내주신 소중한 의견은 서비스 개선에 큰 힘이 됩니다.*
                        `}</ReactMarkdown>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Footer Section */}
                <div className="pt-12 border-t border-black/5">
                  <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                    <button onClick={() => setGuideSubPage("about")} className="hover:text-indigo-500 transition-colors">소개 (About)</button>
                    <button onClick={() => setGuideSubPage("terms")} className="hover:text-indigo-500 transition-colors">이용약관 (Terms)</button>
                    <button onClick={() => setGuideSubPage("privacy")} className="hover:text-indigo-500 transition-colors">개인정보 처리방침 (Privacy)</button>
                    <button onClick={() => setGuideSubPage("contact")} className="hover:text-indigo-500 transition-colors">문의하기 (Contact)</button>
                  </div>
                  <div className="mt-8 text-center space-y-2">
                    <p className="text-[10px] text-zinc-500 opacity-60">© 2024 UI Saju Consulting. All rights reserved.</p>
                    <p className="text-[9px] text-zinc-500 opacity-40 max-w-2xl mx-auto leading-relaxed">
                      유아이 사주상담은 인공지능 기술을 활용한 명리학 가이드 서비스입니다. 모든 분석 결과는 참고용이며, 삶의 최종 결정은 본인의 판단하에 이루어져야 합니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-10 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 text-center">
                <p className="text-sm font-bold text-indigo-400/70 leading-relaxed">
                  유아이(UI)와 함께 당신의 운명을 디자인하세요.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === "blog" && (
            <motion.div 
              key="blog"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 overflow-y-auto p-4 md:p-8 hide-scrollbar bg-[#fdfbf7]"
            >
              <div className={`mx-auto pb-20 ${selectedBlogPost ? 'max-w-4xl' : 'max-w-7xl'}`}>
                <AnimatePresence mode="wait">
                  {selectedBlogPost ? (
                    <motion.div
                      key="blog-detail"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-8"
                    >
                      <button 
                        onClick={() => setSelectedBlogPost(null)}
                        className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-4 hover:underline transition-all group"
                      >
                        <div className="p-2 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                          <ArrowLeft className="w-4 h-4" />
                        </div>
                        목록으로 돌아가기
                      </button>
                      
                      <div className="rounded-[3rem] overflow-hidden bg-white border border-black/5 shadow-2xl">
                        <div className="relative h-64 md:h-[30rem]">
                          <img 
                            src={selectedBlogPost.imageUrl} 
                            alt={selectedBlogPost.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute bottom-8 left-8 right-8 space-y-4">
                            <div className="flex items-center gap-3">
                              <span className="px-3 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                                {selectedBlogPost.category}
                              </span>
                              <span className="text-xs text-white/70 font-medium">{selectedBlogPost.date}</span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight text-white drop-shadow-lg">{selectedBlogPost.title}</h1>
                          </div>
                        </div>
                        <div className="p-8 md:p-16 space-y-10">
                          <div className="markdown-body prose max-w-none text-base md:text-lg leading-relaxed text-zinc-700">
                            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                              {selectedBlogPost.content.startsWith('# ') 
                                ? selectedBlogPost.content.split('\n').slice(1).join('\n').trim() 
                                : selectedBlogPost.content}
                            </ReactMarkdown>
                          </div>
                          
                          <div className="pt-10 border-t border-black/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">UI</div>
                              <div>
                                <p className="text-sm font-bold">유아이 디렉터</p>
                                <p className="text-[10px] opacity-40">전문 사주 분석가</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSelectedBlogPost(null)}
                              className="px-6 py-2 rounded-xl bg-zinc-100 text-xs font-bold hover:bg-zinc-200 transition-colors"
                            >
                              목록보기
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="blog-list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-12"
                    >
                      <div className="text-center py-16 space-y-4 relative overflow-hidden rounded-[3rem] bg-indigo-600 p-10">
                        <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none">
                          <Sparkles className="w-full h-full text-white" />
                        </div>
                        <h2 className="text-4xl md:text-7xl font-handwriting text-white">유아이 사주 블로그</h2>
                        <p className="text-sm md:text-lg text-indigo-100/70 max-w-2xl mx-auto">깊이 있는 사주 명리학 이야기와 당신의 삶을 위한 지혜를 만나보세요.</p>
                      </div>

                      <div className="flex flex-col lg:flex-row gap-12">
                        {/* Sidebar Navigation */}
                        <aside className="w-full lg:w-64 shrink-0 space-y-10">
                          <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">글카테고리</h4>
                              {isAdmin && (
                                <button 
                                  onClick={() => setIsAddingPost(true)}
                                  className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                  title="새 글 작성"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 no-scrollbar px-1">
                              {['전체', '사주기초', '사주이야기', '사주책리뷰'].map(cat => (
                                <button 
                                  key={cat} 
                                  onClick={() => setBlogCategory(cat)}
                                  className={`whitespace-nowrap text-left px-6 py-4 rounded-[1.25rem] text-sm font-bold transition-all duration-300 ${
                                    blogCategory === cat 
                                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 scale-[1.02]' 
                                      : 'bg-white hover:bg-indigo-50 text-zinc-600 hover:text-indigo-600 border border-black/5'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="hidden lg:block space-y-8">
                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 px-2">최근 인기 글</h4>
                            <div className="flex flex-col gap-6">
                              {(blogPosts.length > 0 ? blogPosts : BLOG_POSTS).slice(0, 3).map(post => (
                                <button 
                                  key={post.id} 
                                  onClick={() => handlePostClick(post)}
                                  className="group text-left space-y-2.5"
                                >
                                  <p className="text-sm font-bold leading-snug text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                                    {post.title}
                                  </p>
                                  <div className="flex items-center gap-2 opacity-40">
                                    <Calendar className="w-3 h-3" />
                                    <span className="text-[10px] uppercase tracking-wider">{post.date}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Admin Login/Logout moved to bottom */}
                        </aside>

                        {/* Main Content List */}
                        <div className="flex-1 space-y-10">
                          {isAddingPost && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-8 md:p-12 rounded-[3rem] bg-white border-2 border-dashed border-indigo-500/30 space-y-8 shadow-2xl"
                            >
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <h3 className="text-2xl font-bold">새 블로그 글 작성</h3>
                                  <p className="text-xs text-zinc-500">당신의 지혜를 세상과 공유하세요.</p>
                                </div>
                                <button onClick={() => setIsAddingPost(false)} className="p-3 hover:bg-zinc-100 rounded-2xl transition-colors">
                                  <X className="w-6 h-6" />
                                </button>
                              </div>
                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">제목</label>
                                  <input 
                                    type="text" 
                                    placeholder="글의 제목을 입력하세요"
                                    className="w-full p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xl transition-all"
                                    value={newPost.title}
                                    onChange={e => setNewPost({...newPost, title: e.target.value})}
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">카테고리</label>
                                    <select 
                                      className="w-full p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all"
                                      value={newPost.category}
                                      onChange={e => setNewPost({...newPost, category: e.target.value})}
                                    >
                                      <option value="사주기초">사주기초</option>
                                      <option value="사주이야기">사주이야기</option>
                                      <option value="사주책리뷰">사주책리뷰</option>
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">이미지 (URL 또는 업로드)</label>
                                    <div className="flex gap-3">
                                      <input 
                                        type="text" 
                                        placeholder="https://..."
                                        className="flex-1 p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={newPost.imageUrl}
                                        onChange={e => setNewPost({...newPost, imageUrl: e.target.value})}
                                      />
                                      <label className="cursor-pointer px-6 py-5 rounded-2xl bg-indigo-500/10 text-indigo-600 font-bold text-xs hover:bg-indigo-500/20 transition-all flex items-center gap-2 border border-indigo-500/20">
                                        <ImageIcon className="w-4 h-4" />
                                        {isUploading ? "업로드 중..." : "파일 선택"}
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          accept="image/*"
                                          onChange={e => handleImageUpload(e, false)}
                                          disabled={isUploading}
                                        />
                                      </label>
                                    </div>
                                    {newPost.imageUrl && (
                                      <div className="mt-4 relative h-40 rounded-2xl overflow-hidden border border-black/5">
                                        <img 
                                          src={newPost.imageUrl} 
                                          alt="Preview" 
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                          <span className="text-white text-[10px] font-bold uppercase tracking-widest">이미지 미리보기</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">요약 (Excerpt)</label>
                                    <input 
                                      type="text" 
                                      placeholder="글의 짧은 요약을 입력하세요"
                                      className="w-full p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                      value={newPost.excerpt}
                                      onChange={e => setNewPost({...newPost, excerpt: e.target.value})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">읽기 시간 (예: 3분)</label>
                                    <input 
                                      type="text" 
                                      placeholder="3분"
                                      className="w-full p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                      value={newPost.readTime}
                                      onChange={e => setNewPost({...newPost, readTime: e.target.value})}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between ml-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">내용 (Rich Text / Markdown)</label>
                                  </div>
                                  <div className="prose-editor">
                                    <SimpleMDE 
                                      value={newPost.content}
                                      onChange={value => setNewPost({...newPost, content: value})}
                                      options={{
                                        spellChecker: false,
                                        autofocus: false,
                                        placeholder: "마크다운 문법을 사용하여 내용을 작성하세요...",
                                        status: false,
                                        minHeight: "300px"
                                      }}
                                    />
                                  </div>
                                </div>
                                <button 
                                  onClick={handleAddPost}
                                  className="w-full py-5 rounded-[1.5rem] bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 text-lg active:scale-[0.98]"
                                >
                                  <Save className="w-6 h-6" />
                                  게시물 저장하기
                                </button>
                              </div>
                            </motion.div>
                          )}

                          {isEditingPost && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-8 md:p-12 rounded-[3rem] bg-white border-2 border-dashed border-indigo-500/30 space-y-8 shadow-2xl"
                            >
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <h3 className="text-2xl font-bold">블로그 글 수정</h3>
                                  <p className="text-xs text-zinc-500">기존의 지혜를 다듬어 보세요.</p>
                                </div>
                                <button onClick={() => setIsEditingPost(null)} className="p-3 hover:bg-zinc-100 rounded-2xl transition-colors">
                                  <X className="w-6 h-6" />
                                </button>
                              </div>
                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">제목</label>
                                  <input 
                                    type="text" 
                                    placeholder="제목을 입력하세요"
                                    className="w-full p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xl transition-all"
                                    value={isEditingPost.title}
                                    onChange={e => setIsEditingPost({...isEditingPost, title: e.target.value})}
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">카테고리</label>
                                    <select 
                                      className="w-full p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all"
                                      value={isEditingPost.category}
                                      onChange={e => setIsEditingPost({...isEditingPost, category: e.target.value})}
                                    >
                                      <option value="사주기초">사주기초</option>
                                      <option value="사주이야기">사주이야기</option>
                                      <option value="사주책리뷰">사주책리뷰</option>
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">이미지 (URL 또는 업로드)</label>
                                    <div className="flex gap-3">
                                      <input 
                                        type="text" 
                                        placeholder="이미지 URL"
                                        className="flex-1 p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={isEditingPost.imageUrl}
                                        onChange={e => setIsEditingPost({...isEditingPost, imageUrl: e.target.value})}
                                      />
                                      <label className="cursor-pointer px-6 py-5 rounded-2xl bg-indigo-500/10 text-indigo-600 font-bold text-xs hover:bg-indigo-500/20 transition-all flex items-center gap-2 border border-indigo-500/20">
                                        <ImageIcon className="w-4 h-4" />
                                        {isUploading ? "업로드 중..." : "파일 선택"}
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          accept="image/*"
                                          onChange={e => handleImageUpload(e, true)}
                                          disabled={isUploading}
                                        />
                                      </label>
                                    </div>
                                    {isEditingPost.imageUrl && (
                                      <div className="mt-4 relative h-40 rounded-2xl overflow-hidden border border-black/5">
                                        <img 
                                          src={isEditingPost.imageUrl} 
                                          alt="Preview" 
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                          <span className="text-white text-[10px] font-bold uppercase tracking-widest">이미지 미리보기</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">요약 (Excerpt)</label>
                                    <input 
                                      type="text" 
                                      placeholder="글의 짧은 요약을 입력하세요"
                                      className="w-full p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                      value={isEditingPost.excerpt}
                                      onChange={e => setIsEditingPost({...isEditingPost, excerpt: e.target.value})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">읽기 시간 (예: 3분)</label>
                                    <input 
                                      type="text" 
                                      placeholder="3분"
                                      className="w-full p-5 rounded-2xl bg-zinc-50 border border-black/5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                      value={isEditingPost.readTime}
                                      onChange={e => setIsEditingPost({...isEditingPost, readTime: e.target.value})}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between ml-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">내용 (Rich Text / Markdown)</label>
                                  </div>
                                  <div className="prose-editor">
                                    <SimpleMDE 
                                      value={isEditingPost.content}
                                      onChange={value => setIsEditingPost({...isEditingPost, content: value})}
                                      options={{
                                        spellChecker: false,
                                        autofocus: false,
                                        placeholder: "내용을 입력하세요...",
                                        status: false,
                                        minHeight: "300px"
                                      }}
                                    />
                                  </div>
                                </div>
                                <button 
                                  onClick={handleUpdatePost}
                                  className="w-full py-5 rounded-[1.5rem] bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 text-lg active:scale-[0.98]"
                                >
                                  <Save className="w-6 h-6" />
                                  수정 완료하기
                                </button>
                              </div>
                            </motion.div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                            {(blogPosts.length > 0 ? blogPosts : BLOG_POSTS)
                              .filter(post => blogCategory === '전체' || post.category === blogCategory)
                              .map((post) => (
                                <motion.div
                                  key={post.id}
                                  whileHover={{ y: -10 }}
                                  className="relative w-full text-left rounded-[2.5rem] overflow-hidden bg-white border border-black/5 shadow-xl flex flex-col group transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10"
                                >
                                  <div className="relative h-52 overflow-hidden cursor-pointer" onClick={() => handlePostClick(post)}>
                                    <img 
                                      src={post.imageUrl} 
                                      alt={post.title}
                                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                                    
                                    <div className="absolute top-4 left-4">
                                      <span className="px-3 py-1 rounded-full bg-indigo-600/90 text-white text-[9px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg">
                                        {post.category}
                                      </span>
                                    </div>

                                    {isAdmin && (
                                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditingPost(post);
                                          }}
                                          className="p-2.5 rounded-xl bg-white/90 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all backdrop-blur-md shadow-lg"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePost(post.id);
                                          }}
                                          className="p-2.5 rounded-xl bg-white/90 text-red-500 hover:bg-red-500 hover:text-white transition-all backdrop-blur-md shadow-lg"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-8 space-y-4 flex-1 flex flex-col">
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                                      <Calendar className="w-3 h-3" />
                                      <span>{post.date}</span>
                                    </div>
                                    <h3 className="font-bold text-xl leading-tight line-clamp-2 text-zinc-900 group-hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => handlePostClick(post)}>{post.title}</h3>
                                    <p className="text-sm text-zinc-600 line-clamp-3 leading-relaxed flex-1">
                                      {post.content.replace(/[#*`]/g, '').slice(0, 120)}...
                                    </p>
                                    <button 
                                      onClick={() => handlePostClick(post)}
                                      className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-2 pt-4 group/btn"
                                    >
                                      자세히 읽기 
                                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                          </div>
                          
                          {(blogPosts.length > 0 ? blogPosts : BLOG_POSTS).filter(post => blogCategory === '전체' || post.category === blogCategory).length === 0 && (
                            <div className="text-center py-40 opacity-20">
                              <Newspaper className="w-20 h-20 mx-auto mb-6 text-indigo-500" />
                              <p className="text-xl font-bold">해당 카테고리에 게시된 글이 없습니다.</p>
                              <p className="text-sm mt-2">다른 카테고리를 선택해 보세요.</p>
                            </div>
                          )}

                          {/* Admin Login/Logout Section (Hidden Gate) */}
                          {showAdminGate && (
                            <div className="mt-16 pt-10 border-t border-black/5">
                              <div className="max-w-sm mx-auto lg:mx-0">
                                {user && (
                                  <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/20 space-y-4">
                                    <div className="flex items-center gap-2 text-indigo-600">
                                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                      <span className="text-xs font-bold uppercase tracking-widest">{isAdmin ? '관리자 모드' : '일반 사용자'}</span>
                                    </div>
                                    <button 
                                      onClick={handleLogout}
                                      className="w-full py-3 rounded-xl bg-white text-xs font-bold hover:bg-zinc-50 transition-colors border border-black/5 shadow-sm"
                                    >
                                      로그아웃
                                    </button>
                                  </div>
                                )}

                                {!user && (
                                  <div className="p-8 rounded-[2rem] bg-white border border-black/5 space-y-4 shadow-xl">
                                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">관리자 전용 게이트웨이입니다. 로그인하여 시스템을 관리하세요.</p>
                                    <button 
                                      onClick={handleLogin}
                                      disabled={isLoggingIn}
                                      className="w-full py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                      {isLoggingIn ? (
                                        <>
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                          로그인 중...
                                        </>
                                      ) : "관리자 로그인"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className={`md:hidden px-4 pt-1 border-t border-black/5 bg-white backdrop-blur-xl z-30 safe-bottom-px`}>
        <div className="max-w-md mx-auto flex items-center justify-around">
          {[
            { id: "welcome", icon: User, label: "HOME" },
            { id: "dashboard", icon: LayoutDashboard, label: "만세력" },
            { id: "taekil", icon: Calendar, label: "택일" },
            { id: "chat", icon: MessageCircle, label: "상담" },
            { id: "report", icon: FileText, label: "리포트" },
            { id: "blog", icon: Newspaper, label: "블로그" },
            { id: "guide", icon: Info, label: "가이드" }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === tab.id ? 'text-indigo-400' : 'opacity-30'}`}
            >
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute -top-3 w-1 h-1 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
              )}
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-title font-bold tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
      </div>
    </div>
  );
};

export default App;
