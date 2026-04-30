import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Ticket,
  Gift,
  Star
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSajuData, getDaeunData, calculateYongshin, hanjaToHangul, elementMap, yinYangMap, calculateDeity, calculateGyeok, getSipseung, getShinsal, getGongmang, getYangin, getCheoneulGuiin, isWonjin, isGoegang, isHyeong, isPa, isHae, isChung, getYukhap, getMunchang, getHakdang } from "./utils/saju";
import { SUGGESTED_QUESTIONS, CATEGORIES, BASIC_CHAT_CATEGORIES, BASIC_CATEGORY_QUESTION_POOL } from "./constants/questions";
import { TAEKIL_CATEGORIES, WEEKDAY_OPTIONS, TAEKIL_CATEGORY_CONTENT, TAEKIL_CATEGORY_FORM_FIELDS } from "./constants/taekil";
import { TAEKIL_SECTION_CARD_CLASS, TAEKIL_Q_BADGE_CLASS, TAEKIL_LABEL_CLASS, TAEKIL_HELP_TEXT_CLASS, TAEKIL_FIELD_CLASS, TAEKIL_FIELD_PLACEHOLDER_CLASS, GLASS_TAB_BG_CLASS, GLASS_PANEL_CLASS, GLASS_PANEL_STRONG_CLASS, TAB_TRANSITION } from "./constants/styles";
import { BlogPost } from "./constants/blog";
import { Newspaper, ArrowLeft, Trash2, Briefcase, Heart } from "lucide-react";
import { BlogMediaAsset } from "./components/BlogMediaLibrary";
import { ChatTab } from "./components/tabs/ChatTab";
import { TaekilTab } from "./components/tabs/TaekilTab";
import { useChatTabState } from "./hooks/useChatTabState";
import { useReportTabState } from "./hooks/useReportTabState";
import { useTaekilTabState } from "./hooks/useTaekilTabState";
import { useChatTabActions } from "./hooks/useChatTabActions";
import { useTaekilTabActions } from "./hooks/useTaekilTabActions";
import { useChatSendAction } from "./hooks/useChatSendAction";
import { useReportGenerationAction } from "./hooks/useReportGenerationAction";
import { useAdminAuthActions } from "./hooks/useAdminAuthActions";
import { useBlogTabState } from "./hooks/useBlogTabState";

import { SAJU_GUIDELINE, CONSULTING_GUIDELINE, REPORT_GUIDELINE, BASIC_CONSULTING_GUIDELINE, ADVANCED_CONSULTING_GUIDELINE, BASIC_REPORT_GUIDELINE, ADVANCED_REPORT_GUIDELINE } from "./constants/guidelines";
import { AdminPage, GUIDELINE_KEYS } from "./components/admin/AdminPage";
import { getSeoulTodayParts } from "./lib/seoulDateGanji";
import { getModelTelemetrySnapshot, clearModelTelemetry } from "./lib/modelTelemetry";
import { parseModelErrorPayload, isRetryableModelError, isModelSelectionError, runWithModelRetry, waitMs } from "./lib/modelUtils";
import { db, auth, ref, uploadBytes, getDownloadURL, listAll, storage } from "./firebase";
import { 
  collection, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  getDocFromServer, 
  increment,
  doc,
  getDoc
} from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

const FiveElementsPieChart = React.lazy(() => import("./components/FiveElementsPieChart"));
const LazyBlogTab = React.lazy(() => import("./components/tabs/BlogTab").then((mod) => ({ default: mod.BlogTab })));

// 현재 URL이 관리자 페이지인지 감지
const isAdminRoute = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/admin' ||
    window.location.hash === '#admin' ||
    new URLSearchParams(window.location.search).get('admin') === 'true';
};

// 현재 URL이 리포트 제작 페이지인지 감지
const isReportMakerRoute = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/report-maker' ||
    window.location.hash === '#report-maker';
};

const isPremiumE2EMode = () => {
  if (typeof window === 'undefined') return false;
  const enabled = new URLSearchParams(window.location.search).get('e2e') === 'premium';
  return enabled && (import.meta.env.DEV || import.meta.env.MODE === 'test');
};

const LazyPremiumReportMakerPage = React.lazy(() => import("./components/admin/PremiumReportMakerPage").then((mod) => ({ default: mod.PremiumReportMakerPage })));
const LazyPremiumOrdersPanel = React.lazy(() => import("./components/PremiumOrdersPanel").then((mod) => ({ default: mod.PremiumOrdersPanel })));
const LazyReportTabContent = React.lazy(() => import("./components/tabs/ReportTabContent").then((mod) => ({ default: mod.ReportTabContent })));
const LazyGuideTabContent = React.lazy(() => import("./components/tabs/GuideTabContent").then((mod) => ({ default: mod.GuideTabContent })));
const LazyPremiumOrderForm = React.lazy(() => import("./components/PremiumOrderForm").then((mod) => ({ default: mod.PremiumOrderForm })));
import { ReviewModal } from "./components/ReviewModal";
import { ReviewsSection } from "./components/ReviewsSection";

const stripRichText = (content: string) => {
  return content
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const createDefaultNewPost = (): Partial<BlogPost> => ({
  title: "",
  content: "",
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  category: "사주기초",
  excerpt: "",
  readTime: "3분",
  imageUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/800/600`
});

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
    const rawBirthDate = String(args?.birthDate || '').trim();
    const rawBirthTime = String(args?.birthTime || '').trim();
    const rawGender = String(args?.gender || '').trim().toUpperCase();
    const normalizedGender: 'M' | 'F' = rawGender === 'F' || rawGender === '여' || rawGender === '여성' ? 'F' : 'M';
    const normalizedUnknownTime = !!args?.unknownTime || !rawBirthTime;
    const normalizedBirthTime = normalizedUnknownTime ? '12:00' : rawBirthTime;
    const normalizedIsLunar = !!args?.isLunar;
    const normalizedIsLeap = !!args?.isLeap;
    const personName = String(args?.personName || '대상자');

    if (!rawBirthDate) {
      return { error: '생년월일이 누락되어 사주 계산을 진행할 수 없습니다. YYYY-MM-DD 형식으로 알려주세요.' };
    }

    const saju = getSajuData(rawBirthDate, normalizedBirthTime, normalizedIsLunar, normalizedIsLeap, normalizedUnknownTime);
    const daeun = getDaeunData(rawBirthDate, normalizedBirthTime, normalizedIsLunar, normalizedIsLeap, normalizedGender, normalizedUnknownTime);
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
      birthTime: { type: Type.STRING, description: "생시 (HH:mm 형식, 모를 경우 생략 가능)" },
      isLunar: { type: Type.BOOLEAN, description: "음력 여부 (true: 음력, false: 양력)" },
      isLeap: { type: Type.BOOLEAN, description: "윤달 여부 (음력일 경우에만 해당)" },
      gender: { type: Type.STRING, description: "성별 ('M': 남성, 'F': 여성)" },
      personName: { type: Type.STRING, description: "대상자의 이름 또는 호칭 (예: '남자친구', '상대방', '어머니')" },
      unknownTime: { type: Type.BOOLEAN, description: "생시를 모르는지 여부" }
    },
    required: ["birthDate", "isLunar", "gender"]
  }
};

// Helper to get Gemini AI instance
const getGeminiAI = () => {
  const windowKey = (window as any).GEMINI_API_KEY;
  const viteKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const processKey = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY);

  const apiKey = windowKey || viteKey || processKey;

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    console.error("[ERROR] Gemini API Key is missing.");
    throw new Error("API 키가 설정되지 않았습니다. 프로젝트 루트의 .env.local 파일에 GEMINI_API_KEY 또는 VITE_GEMINI_API_KEY를 설정한 뒤 개발 서버를 재시작해 주세요.");
  }
  return new GoogleGenAI({ apiKey });
};

const DEFAULT_GEMINI_MODEL_PRIORITY = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
const DEPRECATED_GEMINI_MODEL_REPLACEMENTS: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'models/gemini-2.0-flash': 'gemini-2.5-flash'
};
const DEFAULT_ADMIN_EMAILS = ['dean.uitrading@gmail.com', 'dean.sj.oh@gmail.com'];

const normalizeModelName = (model: string) => {
  const trimmed = String(model || '').trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.replace(/^models\//i, '');
  const withoutAction = withoutPrefix.replace(/:generatecontent$/i, '');
  return withoutAction.toLowerCase();
};

const toSafeModelName = (model: string) => {
  const normalized = normalizeModelName(model);
  if (!normalized) return '';
  return DEPRECATED_GEMINI_MODEL_REPLACEMENTS[normalized] || normalized;
};

const getPreferredGeminiModels = (): string[] => {
  const fromWindow = String((window as any).GEMINI_MODEL_PRIORITY || '').trim();
  const fromVite = String((import.meta as any).env.VITE_GEMINI_MODEL_PRIORITY || '').trim();
  const fromProcess = String((typeof process !== 'undefined' && process.env && process.env.GEMINI_MODEL_PRIORITY) || '').trim();

  const raw = fromWindow || fromVite || fromProcess;
  const parsed = raw
    .split(',')
    .map((m) => toSafeModelName(m))
    .filter(Boolean)
    .filter((m) => m !== 'gemini-2.0-flash');

  const baseCandidates = raw ? parsed : [];
  const deduped = Array.from(new Set([...baseCandidates, ...DEFAULT_GEMINI_MODEL_PRIORITY]));
  return deduped.length > 0 ? deduped : DEFAULT_GEMINI_MODEL_PRIORITY;
};

const normalizeEmail = (email: string | null | undefined) => {
  return String(email || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();
};

const normalizeEmailForCompare = (email: string | null | undefined) => {
  const normalized = normalizeEmail(email);
  const [localPartRaw, domainRaw] = normalized.split('@');
  const localPart = localPartRaw || '';
  const domain = domainRaw || '';

  if (!localPart || !domain) {
    return normalized;
  }

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const withoutPlus = localPart.split('+')[0] || '';
    const withoutDots = withoutPlus.replace(/\./g, '');
    return `${withoutDots}@gmail.com`;
  }

  return `${localPart}@${domain}`;
};

const getAllowedAdminEmails = (): string[] => {
  const fromWindow = String((window as any).ADMIN_EMAILS || '').trim();
  const fromVite = String((import.meta as any).env.VITE_ADMIN_EMAILS || '').trim();
  const fromProcess = String((typeof process !== 'undefined' && process.env && process.env.ADMIN_EMAILS) || '').trim();

  const raw = fromWindow || fromVite || fromProcess;
  if (!raw) {
    return DEFAULT_ADMIN_EMAILS;
  }

  const parsed = raw
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  const deduped = Array.from(new Set(parsed));
  return deduped.length > 0 ? deduped : DEFAULT_ADMIN_EMAILS;
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

type SuggestionSource = 'static' | 'dynamic' | 'fallback' | null;

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
    sm: 'w-6 h-6 text-[11px] rounded',
    md: 'w-10 h-10 text-[16px] rounded-lg',
    lg: 'w-12 h-12 text-[16px] rounded-xl'
  };

  const deityEl = deity ? (
    <span className={`text-[11px] font-title font-bold text-indigo-600 absolute ${deityPosition === 'top' ? '-top-3.5' : '-bottom-3.5'} left-1/2 -translate-x-1/2 whitespace-nowrap`}>
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

const App: React.FC = () => {
  // 관리자 라우트 감지 (마운트 시 1회)
  const [showAdminPage, setShowAdminPage] = useState(isAdminRoute);
  // 리포트 제작 라우트 감지 (마운트 시 1회)
  const [showReportMakerPage] = useState(isReportMakerRoute);

  // Navigation
  const [activeTab, setActiveTab] = useState<"welcome" | "dashboard" | "taekil" | "chat" | "report" | "guide" | "blog" | "premium" | "order">("welcome");
  const [orderProductType, setOrderProductType] = useState<'premium' | 'yearly2026' | 'jobCareer' | 'loveMarriage'>('premium');
  const [guideSubPage, setGuideSubPage] = useState<"main" | "privacy" | "terms" | "about" | "contact" | "taekil">("main");
  const isDarkMode = false;
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
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
  const [selectedDaeunIdx, setSelectedDaeunIdx] = useState<number | null>(null);
  const [yongshinResult, setYongshinResult] = useState<any>(null);
  const [gyeokResult, setGyeokResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  // 지침 기본 하드코딩값
  const defaultGuidelines: Record<string, string> = {
    saju: SAJU_GUIDELINE,
    consulting: CONSULTING_GUIDELINE,
    basicConsulting: BASIC_CONSULTING_GUIDELINE,
    advancedConsulting: ADVANCED_CONSULTING_GUIDELINE,
    report: REPORT_GUIDELINE,
    basicReport: BASIC_REPORT_GUIDELINE,
    advancedReport: ADVANCED_REPORT_GUIDELINE,
  };

  const [guidelines, setGuidelines] = useState<Guidelines | null>({
    saju: SAJU_GUIDELINE,
    consulting: CONSULTING_GUIDELINE,
    report: REPORT_GUIDELINE
  });
  const [guidelinesError, setGuidelinesError] = useState<string | null>(null);
  // 가이드 페이지 커스텀 콘텐츠 (Firestore)
  const [guideAboutContent, setGuideAboutContent] = useState<string>('');
  const [guideTermsContent, setGuideTermsContent] = useState<string>('');
  const [guidePrivacyContent, setGuidePrivacyContent] = useState<string>('');
  const [guideContactContent, setGuideContactContent] = useState<string>('');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const {
    messages,
    setMessages,
    consultationMode,
    setConsultationMode,
    basicSelectedCategory,
    setBasicSelectedCategory,
    basicAskedByCategory,
    setBasicAskedByCategory,
    selectedCategory,
    setSelectedCategory,
    refreshKey,
    setRefreshKey,
    input,
    setInput,
    loading,
    setLoading,
    modeNotice,
    setModeNotice,
    isListening,
    setIsListening,
    voiceStatusMessage,
    setVoiceStatusMessage,
    activeChatRequestIdRef,
    consultationModeRef,
    preservedChatContextRef,
    modeNoticeTimerRef,
    recognitionRef
  } = useChatTabState(BASIC_CHAT_CATEGORIES[0]);

  const {
    reportContent,
    setReportContent,
    isPrinting,
    setIsPrinting
  } = useReportTabState();

  const {
    taekilActiveCategory,
    setTaekilActiveCategory,
    taekilStartMonth,
    setTaekilStartMonth,
    taekilEndMonth,
    setTaekilEndMonth,
    marriagePeriodStart,
    setMarriagePeriodStart,
    marriagePeriodEnd,
    setMarriagePeriodEnd,
    taekilLoading,
    setTaekilLoading,
    taekilError,
    setTaekilError,
    taekilNotice,
    setTaekilNotice,
    taekilResults,
    setTaekilResults,
    selectedTaekilDate,
    setSelectedTaekilDate,
    spouseName,
    setSpouseName,
    spouseGender,
    setSpouseGender,
    spouseBirthYear,
    setSpouseBirthYear,
    spouseBirthMonth,
    setSpouseBirthMonth,
    spouseBirthDay,
    setSpouseBirthDay,
    spouseBirthHour,
    setSpouseBirthHour,
    spouseBirthMinute,
    setSpouseBirthMinute,
    spouseCalendarType,
    setSpouseCalendarType,
    spouseUnknownTime,
    setSpouseUnknownTime,
    preferredWeekday1,
    setPreferredWeekday1,
    preferredWeekday2,
    setPreferredWeekday2,
    preferredWeekday3,
    setPreferredWeekday3,
    avoidDateInputs,
    setAvoidDateInputs,
    moveFamilyBirthDates,
    setMoveFamilyBirthDates,
    moveCurrentAddress,
    setMoveCurrentAddress,
    moveTargetAddress,
    setMoveTargetAddress,
    movePeriodStart,
    setMovePeriodStart,
    movePeriodEnd,
    setMovePeriodEnd,
    movePreferredWeekday1,
    setMovePreferredWeekday1,
    movePreferredWeekday2,
    setMovePreferredWeekday2,
    movePreferredWeekday3,
    setMovePreferredWeekday3,
    movePriority,
    setMovePriority,
    moveOnlyWeekend,
    setMoveOnlyWeekend,
    childFatherBirthDate,
    setChildFatherBirthDate,
    childFatherBirthTime,
    setChildFatherBirthTime,
    childMotherBirthDate,
    setChildMotherBirthDate,
    childMotherBirthTime,
    setChildMotherBirthTime,
    childFetusGender,
    setChildFetusGender,
    childbirthPeriodStart,
    setChildbirthPeriodStart,
    childbirthPeriodEnd,
    setChildbirthPeriodEnd,
    generalPeriodStart,
    setGeneralPeriodStart,
    generalPeriodEnd,
    setGeneralPeriodEnd,
    generalPreferredWeekday1,
    setGeneralPreferredWeekday1,
    generalPreferredWeekday2,
    setGeneralPreferredWeekday2,
    generalPreferredWeekday3,
    setGeneralPreferredWeekday3,
    generalAvoidDateInputs,
    setGeneralAvoidDateInputs,
    taekilAdditionalInfo,
    setTaekilAdditionalInfo,
    taekilFormValues,
    setTaekilFormValues,
    setTaekilFormValue,
    taekilActiveFields,
    taekilPreviewItems
  } = useTaekilTabState(TAEKIL_CATEGORY_FORM_FIELDS);
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const daeunScrollRef = useRef<HTMLDivElement>(null);
  const currentSeoulYear = getSeoulTodayParts().year;

  // 대운 스크롤: 현재 대운을 화면 중앙으로
  const scrollDaeunToCenter = useCallback(() => {
    if (!daeunScrollRef.current || daeunResult.length === 0) return;
    const currentAge = currentSeoulYear - parseInt(userData.birthYear) + 1;
    const activeIndex = daeunResult.findIndex((dy: any, i: number) =>
      currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i + 1].startAge)
    );
    if (activeIndex === -1) return;
    const container = daeunScrollRef.current;
    const el = container?.children[activeIndex] as HTMLElement | undefined;
    if (container && el) {
      const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [daeunResult, userData.birthYear, currentSeoulYear]);

  useEffect(() => {
    if (activeTab === "dashboard" && daeunResult.length > 0) {
      // 탭 전환/분석 완료 후 여유를 두고 스크롤
      const t1 = setTimeout(scrollDaeunToCenter, 400);
      const t2 = setTimeout(scrollDaeunToCenter, 900); // 렌더링 완료 보장
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [activeTab, daeunResult, scrollDaeunToCenter]);

  const [showInputForm, setShowInputForm] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [showInlineSuggestions, setShowInlineSuggestions] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const allowedAdminEmails = getAllowedAdminEmails();
  const premiumE2EMode = isPremiumE2EMode();
  const e2eAdminUser = useMemo(
    () => ({ uid: 'e2e-admin', email: 'e2e-admin@test.local' } as FirebaseUser),
    []
  );
  const effectiveUser = premiumE2EMode ? (user ?? e2eAdminUser) : user;
  const effectiveIsAdmin = premiumE2EMode ? true : isAdmin;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsSource, setSuggestionsSource] = useState<SuggestionSource>(null);
  const [aiSuggestionRequestCount, setAiSuggestionRequestCount] = useState(0);
  const suggestionCacheRef = useRef<Record<string, { questions: string[]; source: SuggestionSource; createdAt: number }>>({});
  const activeSuggestionRequestIdRef = useRef(0);

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
      const normalizedUserEmail = normalizeEmail(firebaseUser?.email);
      const comparableUserEmail = normalizeEmailForCompare(firebaseUser?.email);
      const adminEmailSet = new Set(getAllowedAdminEmails().map((email) => normalizeEmailForCompare(email)));
      const adminMatched = adminEmailSet.has(comparableUserEmail);

      setUser(firebaseUser);
      setIsAdmin(adminMatched);

      console.info('[AUTH_DEBUG]', {
        email: firebaseUser?.email || null,
        normalizedEmail: normalizedUserEmail || null,
        comparableEmail: comparableUserEmail || null,
        adminMatched,
        allowedAdmins: Array.from(adminEmailSet)
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === "premium" && !isAdmin) {
      setActiveTab("welcome");
    }
  }, [activeTab, isAdmin]);

  const blogTab = useBlogTabState({
    activeTab,
    setActiveTab,
    user,
    isAdmin,
    handleFirestoreError,
    stripRichText,
    createDefaultNewPost
  });
  const recommendedPosts = blogTab.recommendedPosts;

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
      setGyeokResult(null);
      preservedChatContextRef.current = [];
      setReportContent(null);
      setActiveTab("welcome");
      setInput("");
      setLoading(false);
      setIsAnalyzing(false);
      setAnalysisStep(0);
      setAiSuggestionRequestCount(0);
    }
  };

  // Firestore에서 지침 로드 (관리자가 저장한 값 우선 적용)
  useEffect(() => {
    const loadGuidelinesFromFirestore = async () => {
      const keyMap: Record<string, keyof Guidelines> = {
        [GUIDELINE_KEYS.saju]: 'saju',
        [GUIDELINE_KEYS.consulting]: 'consulting',
        [GUIDELINE_KEYS.report]: 'report',
      };

      const updates: Partial<Guidelines> = {};
      for (const [firestoreKey, guidelineField] of Object.entries(keyMap)) {
        try {
          const snap = await getDoc(doc(db, 'system_config', firestoreKey));
          if (snap.exists()) {
            const content = snap.data()?.content;
            if (content && typeof content === 'string' && content.trim()) {
              updates[guidelineField] = content;
            }
          }
        } catch {
          // 로드 실패 시 하드코딩 기본값 유지
        }
      }

      if (Object.keys(updates).length > 0) {
        setGuidelines(prev => prev ? { ...prev, ...updates } : prev);
      }

      // 가이드 서브페이지 커스텀 콘텐츠 로드
      const guidePageKeys: { key: string; setter: (v: string) => void }[] = [
        { key: GUIDELINE_KEYS.guideAbout, setter: setGuideAboutContent },
        { key: GUIDELINE_KEYS.guideTerms, setter: setGuideTermsContent },
        { key: GUIDELINE_KEYS.guidePrivacy, setter: setGuidePrivacyContent },
        { key: GUIDELINE_KEYS.guideContact, setter: setGuideContactContent },
      ];
      await Promise.all(guidePageKeys.map(async ({ key, setter }) => {
        try {
          const snap = await getDoc(doc(db, 'system_config', key));
          if (snap.exists()) {
            const content = snap.data()?.content;
            if (typeof content === 'string') setter(content);
          }
        } catch {
          // 무시
        }
      }));
    };

    loadGuidelinesFromFirestore();
  }, []);

  // 관리자 지침 변경 핸들러 (AdminPage에서 저장 후 실시간 반영)
  const handleGuidelinesChange = useCallback((key: string, value: string) => {
    if (key === 'saju') setGuidelines(prev => prev ? { ...prev, saju: value } : prev);
    else if (key === 'consulting') setGuidelines(prev => prev ? { ...prev, consulting: value } : prev);
    else if (key === 'report') setGuidelines(prev => prev ? { ...prev, report: value } : prev);
    else if (key === 'guideAbout') setGuideAboutContent(value);
    else if (key === 'guideTerms') setGuideTermsContent(value);
    else if (key === 'guidePrivacy') setGuidePrivacyContent(value);
    else if (key === 'guideContact') setGuideContactContent(value);
  }, []);

  // Auto scroll
  // Force rebuild
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setShowInlineSuggestions(false);
  }, [messages.length]);

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
      const daeun = getDaeunData(dateStr, timeStr, isLunar, isLeap, userData.gender, userData.unknownTime);
      const yongshin = calculateYongshin(result);
      const gyeok = calculateGyeok(result);
      
      setSajuResult(result);
      setDaeunResult(daeun);
      // 현재 대운 자동 선택
      {
        const age = currentSeoulYear - parseInt(userData.birthYear) + 1;
        const idx = daeun.findIndex((dy: any, i: number) =>
          age >= dy.startAge && (i === daeun.length - 1 || age < daeun[i + 1].startAge)
        );
        setSelectedDaeunIdx(idx >= 0 ? idx : 0);
      }
      setYongshinResult(yongshin);
      setGyeokResult(gyeok);
      setReportContent(null);
      setConsultationMode('basic');
      consultationModeRef.current = 'basic';
      setActiveTab("dashboard");
      setShowInputForm(false);
      
      // Reset chat with context
      if (consultationMode === 'basic') {
        setBasicSelectedCategory(BASIC_CHAT_CATEGORIES[0]);
        setBasicAskedByCategory({});
      } else {
        setRefreshKey(prev => prev + 1);
      }
      setAiSuggestionRequestCount(0);
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

  const extractQuestionsFromModelText = (rawText: string, exclude: string[]) => {
    const safeText = String(rawText || '').trim();
    if (!safeText) return [];

    const excluded = new Set(exclude.map((q) => q.trim()));
    let questions: string[] = [];

    const arrayMatch = safeText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          questions = parsed.map((item) => String(item || '').trim());
        }
      } catch {
        // fallback parser below
      }
    }

    if (questions.length === 0) {
      questions = safeText
        .split('\n')
        .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
        .filter(Boolean);
    }

    const deduped = Array.from(new Set(questions))
      .filter((q) => q.length >= 6 && q.length <= 80)
      .filter((q) => !excluded.has(q));

    return deduped.slice(0, 3);
  };

  const generateDynamicSuggestions = useCallback(async () => {
    if (activeTab !== 'chat' || sajuResult.length === 0 || guidelinesError) {
      return;
    }

    const modeCategory = consultationMode === 'basic' ? basicSelectedCategory : selectedCategory;
    const ageGroup = getCurrentAgeGroup();
    const genderText = userData.gender === 'M' ? '남성' : '여성';
    const alreadyAsked = consultationMode === 'basic' ? (basicAskedByCategory[basicSelectedCategory] || []) : [];
    const profileKey = [
      consultationMode,
      modeCategory,
      ageGroup,
      userData.gender,
      refreshKey,
      'ai'
    ].join('::');

    const cache = suggestionCacheRef.current[profileKey];
    const cacheTtlMs = 15 * 60 * 1000;
    if (cache && Date.now() - cache.createdAt < cacheTtlMs) {
      setSuggestions(cache.questions);
      setSuggestionsSource(cache.source);
      setSuggestionsError(null);
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);
    const requestId = ++activeSuggestionRequestIdRef.current;

    const fallback = consultationMode === 'basic'
      ? getBasicCategorySuggestions(basicSelectedCategory, alreadyAsked)
      : pickRandomQuestions(getProfileCategoryQuestions(), 3);

    try {
      const ai = getGeminiAI();
      const models = getPreferredGeminiModels();
      const prompt = [
        '당신은 한국 사용자에게 사주 상담 시작 질문을 추천하는 도우미다.',
        `상담 모드: ${consultationMode === 'basic' ? '초급자' : '고급자'}`,
        `카테고리: ${modeCategory}`,
        `연령대: ${ageGroup}`,
        `성별: ${genderText}`,
        `이미 사용한 질문(피할 것): ${alreadyAsked.join(' | ') || '없음'}`,
        '요구사항:',
        '1) 실제 운세 상담에서 많이 묻는 자연스러운 한국어 질문 3개',
        '2) 서로 중복되지 않게 작성',
        '3) 공격적/선정적/의학적 진단 표현 금지',
        '4) 결과는 JSON 배열만 출력. 예: ["...", "...", "..."]'
      ].join('\n');

      let generated: string[] = [];
      let lastError: any = null;

      for (const model of models) {
        try {
          const result = await runWithModelRetry(
            () => ai.models.generateContent({
              model,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                temperature: 0.7,
                maxOutputTokens: 512
              }
            }),
            2
          );

          generated = extractQuestionsFromModelText((result as any)?.text || '', alreadyAsked);
          if (generated.length >= 3) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          if (!isRetryableModelError(err) && !isModelSelectionError(err)) {
            throw err;
          }
        }
      }

      if (requestId !== activeSuggestionRequestIdRef.current) {
        return;
      }

      if (generated.length < 3) {
        throw lastError || new Error('추천 질문 생성 실패');
      }

      setSuggestions(generated.slice(0, 3));
      setSuggestionsSource('dynamic');
      setSuggestionsError(null);
      suggestionCacheRef.current[profileKey] = {
        questions: generated.slice(0, 3),
        source: 'dynamic',
        createdAt: Date.now()
      };
    } catch (err: any) {
      if (requestId !== activeSuggestionRequestIdRef.current) {
        return;
      }

      const parsed = parseModelErrorPayload(err);
      console.warn('[SUGGESTIONS] dynamic generation failed, fallback to static pool', parsed);

      const fallbackQuestions = fallback.length > 0 ? fallback : [
        '올해 운세에서 가장 중요한 포인트 3가지를 알려주세요.',
        '지금 시점에 가장 조심해야 할 선택은 무엇인가요?',
        '다음 3개월 행동전략을 간단히 알려주세요.'
      ];

      setSuggestions(fallbackQuestions.slice(0, 3));
      setSuggestionsSource('fallback');
      setSuggestionsError('일시적으로 기본 추천 질문으로 표시 중입니다.');
      suggestionCacheRef.current[profileKey] = {
        questions: fallbackQuestions.slice(0, 3),
        source: 'fallback',
        createdAt: Date.now()
      };
    } finally {
      if (requestId === activeSuggestionRequestIdRef.current) {
        setSuggestionsLoading(false);
      }
    }
  }, [
    activeTab,
    sajuResult.length,
    guidelinesError,
    consultationMode,
    basicSelectedCategory,
    selectedCategory,
    userData.gender,
    userData.birthYear,
    basicAskedByCategory,
    refreshKey
  ]);

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

  useEffect(() => {
    if (activeTab !== 'chat') return;

    const asked = consultationMode === 'basic'
      ? (basicAskedByCategory[basicSelectedCategory] || [])
      : [];

    const staticSuggestions = consultationMode === 'basic'
      ? getBasicCategorySuggestions(basicSelectedCategory, asked)
      : pickRandomQuestions(getProfileCategoryQuestions(), 3);

    setSuggestions(staticSuggestions);
    setSuggestionsSource('static');
    setSuggestionsError(null);
  }, [activeTab, consultationMode, basicSelectedCategory, basicAskedByCategory, selectedCategory, userData.birthYear, userData.gender, refreshKey]);

  const handleGenerateAiSuggestions = useCallback(async () => {
    if (aiSuggestionRequestCount >= 2) {
      setSuggestionsError('AI 추천 질문 생성은 상담당 2회까지 가능합니다.');
      return;
    }

    setAiSuggestionRequestCount((prev) => prev + 1);
    await generateDynamicSuggestions();
  }, [aiSuggestionRequestCount, generateDynamicSuggestions]);

  useEffect(() => {
    consultationModeRef.current = consultationMode;
  }, [consultationMode]);

  useEffect(() => {
    (window as any).getModelTelemetrySnapshot = getModelTelemetrySnapshot;
    (window as any).clearModelTelemetry = clearModelTelemetry;
    (window as any).getAuthDebugState = () => ({
      email: user?.email || null,
      normalizedEmail: normalizeEmail(user?.email),
      comparableEmail: normalizeEmailForCompare(user?.email),
      isAdmin,
      allowedAdmins: getAllowedAdminEmails(),
      allowedAdminsComparable: getAllowedAdminEmails().map((email) => normalizeEmailForCompare(email))
    });
  }, [user, isAdmin]);

  const { handleSend } = useChatSendAction({
    input,
    loading,
    guidelines,
    guidelinesError,
    sajuResult,
    daeunResult,
    yongshinResult,
    gyeokResult,
    birthYear: userData.birthYear,
    messages,
    basicSelectedCategory,
    setActiveTab,
    setInput,
    setRefreshKey,
    setMessages,
    setLoading,
    setBasicAskedByCategory,
    activeChatRequestIdRef,
    consultationModeRef,
    preservedChatContextRef,
    isAdmin,
    getGeminiAI,
    preferredModels: getPreferredGeminiModels(),
    sajuToolDeclaration,
    calculateSajuForPerson
  });

  const { handleGenerateReport } = useReportGenerationAction({
    loading,
    guidelines,
    guidelinesError,
    sajuResult,
    daeunResult,
    yongshinResult,
    gyeokResult,
    birthYear: userData.birthYear,
    userName: userData.name,
    consultationModeRef,
    isAdmin,
    setActiveTab,
    setLoading,
    setReportContent,
    getGeminiAI,
    preferredModels: getPreferredGeminiModels(),
  });

  const { handleLogin, handleLogout } = useAdminAuthActions({
    setIsLoggingIn
  });

  const {
    switchConsultationMode,
    handleSuggestionClick,
    handleVoiceInput
  } = useChatTabActions({
    isListening,
    loading,
    messages,
    consultationMode,
    basicSelectedCategory,
    setLoading,
    setMessages,
    setInput,
    setRefreshKey,
    setBasicAskedByCategory,
    setConsultationMode,
    setModeNotice,
    setIsListening,
    setVoiceStatusMessage,
    activeChatRequestIdRef,
    consultationModeRef,
    preservedChatContextRef,
    modeNoticeTimerRef,
    recognitionRef,
    handleSend
  });

  const { handleGenerateTaekil } = useTaekilTabActions({
    userData,
    taekilActiveCategory,
    taekilActiveFields,
    taekilFormValues,
    marriagePeriodStart,
    marriagePeriodEnd,
    spouseName,
    spouseGender,
    spouseBirthYear,
    spouseBirthMonth,
    spouseBirthDay,
    spouseBirthHour,
    spouseBirthMinute,
    spouseCalendarType,
    spouseUnknownTime,
    preferredWeekday1,
    preferredWeekday2,
    preferredWeekday3,
    avoidDateInputs,
    moveCurrentAddress,
    moveTargetAddress,
    movePeriodStart,
    movePeriodEnd,
    movePreferredWeekday1,
    movePreferredWeekday2,
    movePreferredWeekday3,
    moveFamilyBirthDates,
    movePriority,
    moveOnlyWeekend,
    childFatherBirthDate,
    childFatherBirthTime,
    childMotherBirthDate,
    childMotherBirthTime,
    childFetusGender,
    childbirthPeriodStart,
    childbirthPeriodEnd,
    generalPeriodStart,
    generalPeriodEnd,
    generalPreferredWeekday1,
    generalPreferredWeekday2,
    generalPreferredWeekday3,
    generalAvoidDateInputs,
    taekilAdditionalInfo,
    setTaekilLoading,
    setTaekilError,
    setTaekilNotice,
    setTaekilResults,
    setSelectedTaekilDate
  });

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

  const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#94a3b8', '#6366f1'];

  // Render Admin Page (when URL is /admin, #admin, or ?admin=true)
  if (showAdminPage) {
    return (
      <AdminPage
        user={effectiveUser}
        isAdmin={effectiveIsAdmin}
        isLoggingIn={isLoggingIn}
        allowedAdminEmails={allowedAdminEmails}
        blog={blogTab}
        defaultGuidelines={defaultGuidelines}
        onGuidelinesChange={handleGuidelinesChange}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    );
  }

  // Render Report Maker Page (when URL is /report-maker or #report-maker)
  if (showReportMakerPage) {
    return (
      <React.Suspense fallback={<div className="h-full bg-gradient-to-br from-slate-100 via-cyan-50/60 to-indigo-100/70 flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>}>
        <LazyPremiumReportMakerPage
          user={effectiveUser}
          isAdmin={effectiveIsAdmin}
          isLoggingIn={isLoggingIn}
          allowedAdminEmails={allowedAdminEmails}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
      </React.Suspense>
    );
  }

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
                  className="text-[16px] font-medium text-white"
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
                
                <p className="text-[11px] text-white/40">잠시만 기다려 주세요. 정밀한 분석이 진행 중입니다.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`w-full h-full md:h-screen text-[#1a1a1a] overflow-hidden shadow-2xl relative flex flex-col transition-all duration-300 font-sans ${GLASS_TAB_BG_CLASS}`}>
        {/* Navigation Header */}
        <header className={`px-4 py-3 md:px-10 md:py-4 flex items-center justify-between border-b border-white/60 bg-white/55 backdrop-blur-xl z-30 sticky top-0 safe-top shadow-sm shadow-indigo-200/20`}>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="text-white w-4 h-4 md:w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base md:text-[16px] font-title font-bold tracking-tight">유아이 사주상담</h1>
              <p className="hidden md:block text-[11px] opacity-40 uppercase tracking-widest font-bold">전문 사주 분석</p>
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
              ...(isAdmin ? [{ id: "premium", icon: Gift, label: "프리미엄" }] : []),
              { id: "blog", icon: Newspaper, label: "블로그" },
              { id: "guide", icon: Info, label: "HELP" }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-black/5 opacity-60 hover:opacity-100'}`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-base font-bold">{tab.label}</span>
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
                <span className="hidden md:block text-base font-bold">텍스트 저장</span>
              </button>
            )}
            {/* 후기 남기기 버튼 */}
            <button
              onClick={() => setReviewModalOpen(true)}
              className="p-2 md:px-4 md:py-2 rounded-full md:rounded-xl hover:bg-amber-500/10 text-amber-500 transition-all flex items-center gap-2 group"
              title="후기 남기기"
            >
              <Star className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:fill-amber-400 transition-all" />
              <span className="hidden md:block text-base font-bold">후기 남기기</span>
            </button>
            <button
              onClick={handleReset}
              className="p-2 md:px-4 md:py-2 rounded-full md:rounded-xl hover:bg-rose-500/10 text-rose-500 transition-all flex items-center gap-2 group"
              title="상담 종료 및 데이터 삭제"
            >
              <Trash2 className="w-5 h-5 opacity-70 group-hover:opacity-100" />
              <span className="hidden md:block text-base font-bold">상담 종료</span>
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
              transition={TAB_TRANSITION}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-12 hide-scrollbar">
                {!showInputForm ? (
                  <div className="max-w-6xl mx-auto pb-16 md:pb-20 relative">
                    <div className="absolute -top-12 left-0 h-40 w-40 md:h-56 md:w-56 rounded-full bg-cyan-400/30 blur-3xl pointer-events-none" />
                    <div className="absolute top-14 right-0 h-44 w-44 md:h-64 md:w-64 rounded-full bg-violet-400/30 blur-3xl pointer-events-none" />

                    <div className="relative space-y-6 md:space-y-10">
                      <section className="rounded-[2rem] md:rounded-[2.5rem] border border-white/40 bg-gradient-to-br from-white/70 to-white/40 backdrop-blur-2xl shadow-2xl shadow-indigo-300/30 p-6 md:p-12 text-center">
                        <h2 className="mt-3 md:mt-4 text-3xl sm:text-4xl md:text-6xl font-serif font-bold leading-tight text-zinc-900">
                          당신의 운명을 읽는<br />
                          <span className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">가장 명료한 시선</span>
                        </h2>
                        <p className="mt-3 md:mt-4 text-[13px] md:text-[16px] max-w-2xl mx-auto text-zinc-600/90 leading-relaxed">
                          사주명리학의 정교함을 AI와 결합한 현대적 사주명리 스튜디오. 오늘의 고민을 내일의 전략으로 바꿔드립니다.
                        </p>
                      </section>

                      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
                        <button
                          onClick={() => setShowInputForm(true)}
                          className="group flex flex-col text-left rounded-[1.6rem] md:rounded-[2rem] border border-white/50 bg-white/45 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-zinc-300/20 hover:-translate-y-1 transition-all"
                        >
                          <div className="flex items-center gap-3 mb-4 min-h-[52px]">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-400/30">
                              <User className="w-6 h-6" />
                            </div>
                            <h3 className="text-[16px] font-bold leading-tight text-zinc-900">사주 입력 시작</h3>
                          </div>
                          <p className="text-[13px] text-zinc-600 leading-relaxed">
                            당신이 태어난 날을 알려주세요. 사주분석을 시작합니다.
                            <br />
                            당신의 사주에 대해 궁금하면 리포트로 가서 운세리포트를 보세요.
                            <br />
                            상담을 원하면 상담창으로 가세요.
                          </p>
                        </button>

                        <button
                          onClick={() => { setOrderProductType('premium'); setActiveTab("order"); }}
                          className="group flex flex-col text-left rounded-[1.6rem] md:rounded-[2rem] border border-white/50 bg-white/45 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-zinc-300/20 hover:-translate-y-1 transition-all"
                        >
                          <div className="flex items-center gap-3 mb-4 min-h-[52px]">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-400/30">
                              <Ticket className="w-6 h-6" />
                            </div>
                            <h3 className="text-[16px] font-bold leading-tight text-zinc-900">인생가이드북 주문(유료)</h3>
                          </div>
                          <p className="text-[13px] text-zinc-600 leading-relaxed">
                            유아이의 과학적 만세력 데이타분석으로 만들어낸 당신만의 인생가이드북을 만나보세요. 당신이라는 사람을 더 잘 이해하게 해드립니다. 당신의 인생흐름을 통찰하고 남은 인생을 더 잘 살기 위한 방법을 알려드립니다.
                          </p>
                        </button>

                        <button
                          onClick={() => { setOrderProductType('yearly2026'); setActiveTab("order"); }}
                          className="group flex flex-col text-left rounded-[1.6rem] md:rounded-[2rem] border border-amber-300/60 bg-gradient-to-br from-amber-50/90 via-rose-50/60 to-indigo-50/70 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-rose-300/20 hover:-translate-y-1 transition-all"
                        >
                          <div className="flex items-center gap-3 mb-4 min-h-[52px]">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-rose-400/30">
                              <Calendar className="w-6 h-6" />
                            </div>
                            <h3 className="text-[16px] font-bold leading-tight text-zinc-900">프리미엄 2026 일년운세(유료)</h3>
                          </div>
                          <p className="text-[13px] text-zinc-600 leading-relaxed">
                            2026년 한 해를 사주 원국·대운·세운·월별 흐름으로 통합 분석한 10페이지 맞춤 리포트. 가장 알고 싶은 것과 가장 큰 고민에 먼저 직답한 뒤 월별 상세까지 짚어드립니다.
                          </p>
                        </button>

                        <button
                          onClick={() => { setOrderProductType('jobCareer'); setActiveTab("order"); }}
                          className="group flex flex-col text-left rounded-[1.6rem] md:rounded-[2rem] border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-cyan-50/70 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-emerald-300/20 hover:-translate-y-1 transition-all"
                        >
                          <div className="flex items-center gap-3 mb-4 min-h-[52px]">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-emerald-400/30">
                              <Briefcase className="w-6 h-6" />
                            </div>
                            <h3 className="text-[16px] font-bold leading-tight text-zinc-900">직업운 리포트(유료)</h3>
                          </div>
                          <p className="text-[13px] text-zinc-600 leading-relaxed">
                            현재 대운·향후 3년 세운을 토대로 이직·창업·승진 최적 타이밍을 분석한 커리어 전문 리포트. 재성·관성·식상 삼각관계로 직업 DNA를 짚어드립니다.
                          </p>
                        </button>

                        <button
                          onClick={() => { setOrderProductType('loveMarriage'); setActiveTab("order"); }}
                          className="group flex flex-col text-left rounded-[1.6rem] md:rounded-[2rem] border border-rose-200/60 bg-gradient-to-br from-rose-50/90 via-pink-50/60 to-fuchsia-50/70 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-rose-300/20 hover:-translate-y-1 transition-all"
                        >
                          <div className="flex items-center gap-3 mb-4 min-h-[52px]">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-rose-400/30">
                              <Heart className="w-6 h-6" />
                            </div>
                            <h3 className="text-[16px] font-bold leading-tight text-zinc-900">연애·결혼운 가이드북(유료)</h3>
                          </div>
                          <p className="text-[13px] text-zinc-600 leading-relaxed">
                            연애운(편재·편관·도화)과 결혼운(정재·정관·일지)을 별도 섹션으로 분석. 관계 시기·배우자상·향후 3년 로드맵까지 짚어드립니다.
                          </p>
                        </button>

                        <button
                          onClick={() => setActiveTab("blog")}
                          className="group flex flex-col text-left rounded-[1.6rem] md:rounded-[2rem] border border-white/50 bg-white/45 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-zinc-300/20 hover:-translate-y-1 transition-all"
                        >
                          <div className="flex items-center gap-3 mb-4 min-h-[52px]">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-400/30">
                              <Newspaper className="w-6 h-6" />
                            </div>
                            <h3 className="text-[16px] font-bold leading-tight text-zinc-900">사주팔자란? 공부하기</h3>
                          </div>
                          <p className="mt-2 text-[13px] text-zinc-600">사주용어가 어렵죠? 쉽게 설명한 글을 보세요. 재미있는 사주 이야기도 계속 올릴께요. 사주에 대해 좀 더 깊게 공부해보려면 블로그를 방문해주세요.</p>
                        </button>

                        <button
                          onClick={() => setActiveTab("guide")}
                          className="group flex flex-col text-left rounded-[1.6rem] md:rounded-[2rem] border border-white/50 bg-white/45 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-zinc-300/20 hover:-translate-y-1 transition-all"
                        >
                          <div className="flex items-center gap-3 mb-4 min-h-[52px]">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-400/30">
                              <Compass className="w-6 h-6" />
                            </div>
                            <h3 className="text-[16px] font-bold leading-tight text-zinc-900">이용 가이드</h3>
                          </div>
                          <p className="mt-2 text-[13px] text-zinc-600">서비스를 200% 활용하는 흐름을 빠르게 익힙니다.</p>
                        </button>
                      </section>

                      <section className="space-y-3 md:space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[16px] md:text-[16px] font-bold text-zinc-900">블로그 추천 컨텐츠</h3>
                          <button onClick={() => setActiveTab("blog")} className="px-3 min-h-[44px] inline-flex items-center text-[13px] font-bold text-indigo-600 hover:underline">전체보기</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                          {recommendedPosts.map((post, idx) => (
                            <article
                              key={`${post.id}-${idx}`}
                              onClick={() => blogTab.handlePostClick(post)}
                              className="group cursor-pointer rounded-[1.8rem] overflow-hidden border border-white/50 bg-white/45 backdrop-blur-xl shadow-xl shadow-zinc-300/20 hover:-translate-y-1 transition-all"
                            >
                              <div className="aspect-video overflow-hidden relative">
                                <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                                <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-white text-[11px] font-bold uppercase tracking-widest ${idx === 0 ? 'bg-indigo-600' : idx === 1 ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                                  {idx === 0 ? "Latest" : idx === 1 ? "Popular" : "Pick"}
                                </div>
                              </div>
                              <div className="p-4 md:p-5 space-y-2">
                                <h4 className="font-bold line-clamp-1 text-zinc-900">{post.title}</h4>
                                <p className="text-[11px] text-zinc-600 line-clamp-2">{post.excerpt || stripRichText(post.content).slice(0, 80)}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>

                      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div
                          onClick={() => setActiveTab("chat")}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setActiveTab("chat");
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="rounded-[1.8rem] md:rounded-[2.2rem] border border-white/50 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 backdrop-blur-2xl p-5 md:p-7 shadow-2xl shadow-violet-300/20 space-y-4 md:space-y-5 cursor-pointer hover:-translate-y-1 transition-all focus:outline-none focus:ring-2 focus:ring-violet-400"
                        >
                          <div className="flex items-center gap-3 min-h-[56px]">
                            <div className="w-14 h-14 rounded-2xl bg-white/40 flex items-center justify-center border border-white/60 shrink-0">
                              <Zap className="text-violet-600 w-8 h-8" />
                            </div>
                            <h3 className="text-[16px] md:text-[16px] font-bold text-zinc-900">당신만을 위한 일대일상담, 경험해 보세요.</h3>
                          </div>
                          <ul className="space-y-2">
                            {[
                              "상담내용은 철저히 보호됩니다.",
                              "중요한 이벤트를 앞두고 물어보세요",
                              "남들에게 말하지 못하는 고민을 여기에 물어보세요.",
                              "자기 MBTI를 알려주면 더욱 재미있는 상담이 됩니다."
                            ].map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-700">
                                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div
                          onClick={() => setActiveTab("report")}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setActiveTab("report");
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="rounded-[1.8rem] md:rounded-[2.2rem] border border-white/50 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 backdrop-blur-2xl p-5 md:p-7 shadow-2xl shadow-cyan-300/20 space-y-4 md:space-y-5 cursor-pointer hover:-translate-y-1 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400"
                        >
                          <div className="flex items-center gap-3 min-h-[56px]">
                            <div className="w-14 h-14 rounded-2xl bg-white/40 flex items-center justify-center border border-white/60 shrink-0">
                              <FileText className="text-indigo-600 w-8 h-8" />
                            </div>
                            <h3 className="text-[16px] md:text-[16px] font-bold text-zinc-900">당신을 분석해 드립니다</h3>
                          </div>
                          <ul className="space-y-2">
                            {[
                              "리포트 탭에서 사주 데이터를 바탕으로 운세 리포트를 바로 생성할 수 있습니다.",
                              "궁금한 주제를 입력하면 핵심 흐름과 포인트를 한눈에 정리해 드립니다.",
                              "분석 결과를 확인한 뒤 상담 탭과 함께 활용하면 더 깊게 이해할 수 있습니다."
                            ].map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-700">
                                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </section>

                      <section className="space-y-3 md:space-y-4">
                        <h3 className="text-[16px] md:text-[16px] font-bold text-zinc-900">유아이가 제공하는 특별서비스</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                          <a
                            href="https://k-manseryeok.vercel.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group rounded-[1.6rem] md:rounded-[2rem] border border-white/50 bg-white/45 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-zinc-300/20 hover:-translate-y-1 transition-all"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-indigo-400/30">
                              <Calendar className="w-6 h-6" />
                            </div>
                            <h4 className="text-[16px] md:text-[16px] font-bold text-zinc-900">만세력으로 표시한 달력</h4>
                            <p className="mt-2 text-[13px] text-zinc-600">일진과 절기를 일정처럼 확인하는 별도 도구입니다.</p>
                            <div className="mt-4 flex items-center gap-2 text-indigo-600 font-bold text-[13px]">바로가기 <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></div>
                          </a>

                          <a
                            href="https://lucky-number-generator-deansjoh.replit.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group rounded-[1.6rem] md:rounded-[2rem] border border-white/50 bg-white/45 backdrop-blur-xl p-5 md:p-6 shadow-xl shadow-zinc-300/20 hover:-translate-y-1 transition-all"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-rose-400/30">
                              <Ticket className="w-6 h-6" />
                            </div>
                            <h4 className="text-[16px] md:text-[16px] font-bold text-zinc-900">내 사주에 맞는 로또 번호</h4>
                            <p className="mt-2 text-[13px] text-zinc-600">오늘 운세와 오행을 조합해 행운 번호를 추천합니다.</p>
                            <div className="mt-4 flex items-center gap-2 text-rose-600 font-bold text-[13px]">바로가기 <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></div>
                          </a>
                        </div>
                      </section>

                      {/* 고객 후기 섹션 */}
                      <ReviewsSection onWriteReview={() => setReviewModalOpen(true)} />

                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto pb-16 md:pb-20 space-y-4 md:space-y-5 relative">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-44 w-44 md:h-52 md:w-52 rounded-full bg-cyan-400/25 blur-3xl pointer-events-none" />

                    <button
                      onClick={() => setShowInputForm(false)}
                      className="relative inline-flex items-center gap-2 min-h-[44px] px-2 text-[13px] font-bold text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      랜딩페이지로 돌아가기
                    </button>

                    <section className="relative rounded-[1.8rem] md:rounded-[2.2rem] border border-white/60 bg-white/50 backdrop-blur-2xl shadow-2xl shadow-indigo-300/20 p-5 md:p-8 space-y-5 md:space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-zinc-900 leading-tight">당신의 생년월일시를 입력해 주세요</h2>
                      </div>

                      <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${isAgreed ? "bg-emerald-50/90 border-emerald-200" : "bg-zinc-100/70 border-zinc-200"}`}>
                        <input
                          type="checkbox"
                          id="privacyAgree"
                          checked={isAgreed}
                          onChange={(e) => setIsAgreed(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="privacyAgree" className="text-[13px] font-bold text-zinc-700 cursor-pointer">개인정보 이용에 동의합니다</label>
                      </div>

                      <div className={`space-y-5 transition-all ${!isAgreed ? "opacity-40 pointer-events-none grayscale" : "opacity-100"}`}>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold uppercase tracking-widest ml-1 text-zinc-500">사용자 이름</label>
                          <input
                            type="text"
                            placeholder="이름을 입력하세요"
                            value={userData.name}
                            disabled={!isAgreed}
                            onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                            className="w-full px-4 py-3 min-h-[44px] rounded-xl border border-white/70 bg-white/70 backdrop-blur-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-base"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold ml-1 text-zinc-500">년도</label>
                              <select
                                value={userData.birthYear}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({ ...userData, birthYear: e.target.value })}
                                className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-white/70 bg-white/70 text-[13px] outline-none"
                              >
                                {Array.from({ length: 100 }, (_, i) => currentSeoulYear - i).map((y) => (
                                  <option key={y} value={y}>{y}년</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold ml-1 text-zinc-500">월</label>
                              <select
                                value={userData.birthMonth}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({ ...userData, birthMonth: e.target.value })}
                                className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-white/70 bg-white/70 text-[13px] outline-none"
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                  <option key={m} value={m}>{m}월</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold ml-1 text-zinc-500">일</label>
                              <select
                                value={userData.birthDay}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({ ...userData, birthDay: e.target.value })}
                                className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-white/70 bg-white/70 text-[13px] outline-none"
                              >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                  <option key={d} value={d}>{d}일</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {!userData.unknownTime && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold ml-1 text-zinc-500">시</label>
                                <select
                                  value={userData.birthHour}
                                  disabled={!isAgreed}
                                  onChange={(e) => setUserData({ ...userData, birthHour: e.target.value })}
                                  className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-white/70 bg-white/70 text-[13px] outline-none"
                                >
                                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                                    <option key={h} value={h}>{h}시</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold ml-1 text-zinc-500">분</label>
                                <select
                                  value={userData.birthMinute}
                                  disabled={!isAgreed}
                                  onChange={(e) => setUserData({ ...userData, birthMinute: e.target.value })}
                                  className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-white/70 bg-white/70 text-[13px] outline-none"
                                >
                                  {Array.from({ length: 60 }, (_, i) => i).map((m) => (
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
                              onChange={(e) => setUserData({ ...userData, unknownTime: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="unknownTime" className="text-[13px] font-medium opacity-70">생시를 몰라요</label>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between p-2 rounded-2xl bg-white/55 border border-white/70 backdrop-blur-xl">
                            <div className="flex items-center gap-1.5 p-1 rounded-xl w-full">
                              <button onClick={() => setUserData({ ...userData, calendarType: "solar" })} disabled={!isAgreed} className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${userData.calendarType === "solar" ? "bg-indigo-600 text-white shadow-md" : "text-zinc-500"}`}>양력</button>
                              <button onClick={() => setUserData({ ...userData, calendarType: "lunar" })} disabled={!isAgreed} className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${userData.calendarType === "lunar" ? "bg-indigo-600 text-white shadow-md" : "text-zinc-500"}`}>음력(평)</button>
                              <button onClick={() => setUserData({ ...userData, calendarType: "leap" })} disabled={!isAgreed} className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${userData.calendarType === "leap" ? "bg-indigo-600 text-white shadow-md" : "text-zinc-500"}`}>음력(윤)</button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-2xl bg-white/55 border border-white/70 backdrop-blur-xl">
                            <div className="flex items-center gap-1.5 p-1 rounded-xl w-full">
                              <button onClick={() => setUserData({ ...userData, gender: "M" })} disabled={!isAgreed} className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${userData.gender === "M" ? "bg-indigo-600 text-white shadow-md" : "text-zinc-500"}`}>남자</button>
                              <button onClick={() => setUserData({ ...userData, gender: "F" })} disabled={!isAgreed} className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${userData.gender === "F" ? "bg-indigo-600 text-white shadow-md" : "text-zinc-500"}`}>여자</button>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleStart}
                          disabled={!isAgreed}
                          className={`w-full py-4 min-h-[44px] rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-bold shadow-xl shadow-cyan-400/30 flex items-center justify-center gap-2 active:scale-95 transition-all ${!isAgreed ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          운세 분석 시작
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </section>

                    <p className="text-center text-[11px] tracking-tight text-zinc-500/70">
                      생시를 알면 더 정확한 운세 분석이 가능합니다. 몰라도 상담은 가능합니다.
                      <br />
                      유아이는 사용자의 개인 정보를 저장하지 않습니다.
                    </p>
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
              transition={TAB_TRANSITION}
              className={`absolute inset-0 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 hide-scrollbar ${GLASS_TAB_BG_CLASS}`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden">
                <div className="absolute -left-12 top-12 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl" />
                <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" />
              </div>

              {/* Navigation Guidance for Dashboard */}
              <div className="relative z-10 max-w-7xl mx-auto mt-2">
                <div className="rounded-[2.4rem] border border-white/60 bg-white/45 backdrop-blur-xl shadow-xl shadow-indigo-200/20 p-3 md:p-5">
                  <div className="grid grid-cols-2 gap-3 md:gap-6">
                    <motion.button
                      whileHover={{ y: -5 }}
                      type="button"
                      onClick={() => setActiveTab("chat")}
                      className={`h-full cursor-pointer text-left p-4 md:p-8 rounded-[1.6rem] md:rounded-[3rem] border border-white/60 bg-white/55 backdrop-blur-xl transition-all shadow-xl shadow-violet-200/30 hover:shadow-2xl space-y-3 md:space-y-6 group`}
                    >
                      <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MessageCircle className="text-violet-500 w-5 h-5 md:w-10 md:h-10" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[13px] md:text-[16px] font-bold leading-tight">AI와 더 깊은 대화 나누기</h3>
                        <p className={`text-[11px] md:text-[13px] leading-relaxed opacity-60`}>
                          분석된 사주를 바탕으로 지금 가장 필요한 질문의 답을 빠르게 받아보세요.
                        </p>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ y: -5 }}
                      type="button"
                      onClick={() => setActiveTab("report")}
                      className={`h-full cursor-pointer text-left p-4 md:p-8 rounded-[1.6rem] md:rounded-[3rem] border border-white/60 bg-white/55 backdrop-blur-xl transition-all shadow-xl shadow-indigo-200/30 hover:shadow-2xl space-y-3 md:space-y-6 group`}
                    >
                      <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileText className="text-indigo-500 w-5 h-5 md:w-10 md:h-10" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[13px] md:text-[16px] font-bold leading-tight">프리미엄 운세 리포트</h3>
                        <p className={`text-[11px] md:text-[13px] leading-relaxed opacity-60`}>
                          핵심 흐름을 압축한 정밀 운세 리포트를 생성하고 PDF로 저장할 수 있습니다.
                        </p>
                      </div>
                    </motion.button>
                  </div>
                </div>
              </div>

              {sajuResult.length > 0 ? (
                <>
                <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 mt-10">
                {/* Left Column */}
                <div className="space-y-8 md:space-y-12">
                  {/* Saju Grid - 2x4 Layout */}
                  <div className="space-y-4">
                    <h3 className={`text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>사주팔자 (四柱八字)</h3>
                    <div className="grid grid-cols-4 gap-3 md:gap-4">
                      {sajuResult.map((p, i) => {
                        if (userData.unknownTime && p.title === '시주') return null;
                        return (
                          <div key={i} className={`p-3 md:p-5 rounded-3xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-xl shadow-indigo-200/20 flex flex-col items-center gap-2 transition-transform hover:scale-[1.02]`}>
                            <span className={`text-[11px] md:text-[11px] font-bold opacity-50`}>{p.title}</span>
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
                  <div className={`p-6 md:p-8 rounded-[2.5rem] border border-white/55 bg-gradient-to-br from-cyan-500/10 via-white/30 to-indigo-500/15 backdrop-blur-2xl shadow-2xl shadow-indigo-200/30`}>
                    <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-xl shadow-indigo-500/20">
                        <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="space-y-2">
                          <p className="text-[11px] md:text-[11px] font-bold text-indigo-500 uppercase tracking-[0.2em]">사주팔자 분석 결론</p>
                          <h4 className={`text-base md:text-[16px] font-bold leading-tight text-zinc-900`}>
                            {userData.name}님의 사주는 <span className="text-indigo-500">{gyeokResult?.composition}</span>로 구성되어 있으며, <br className="hidden md:block"/><span className="text-indigo-500 font-black">[{gyeokResult?.gyeok}]</span>의 사주입니다.
                          </h4>
                        </div>
                        
                        {/* Navigation Guidance */}
                        <div className="flex flex-wrap gap-3 pt-2">
                          <button 
                            onClick={() => setActiveTab("chat")}
                            className="flex min-h-[44px] items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            AI와 상담하기
                          </button>
                          <button 
                            onClick={() => setActiveTab("report")}
                            className="flex min-h-[44px] items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-[11px] font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-all"
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
                    <h3 className={`text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>오행분포 (五行分布)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(() => {
                        const chartData = getChartData();
                        return (
                          <>
                      <div className={`p-6 rounded-3xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-xl shadow-indigo-200/20 flex flex-col justify-center gap-4`}>
                        <p className={`text-[13px] md:text-base leading-relaxed text-zinc-600 font-medium`}>
                          {userData.name}님의 오행 분포는 <br className="hidden md:block"/>
                          {chartData.map(d => `${d.name} ${d.value}개`).join(', ')}으로 구성되어 있습니다.
                        </p>
                        {yongshinResult && (() => {
                          const s = yongshinResult.strength as string;
                          const strengthLabel: Record<string, { label: string; desc: string; color: string; bg: string }> = {
                            '극신강': { label: '극신강 (極身强)', desc: '일간의 기운이 매우 강합니다. 기운을 억제·분산하는 흐름이 유리합니다.', color: 'text-red-700', bg: 'bg-red-50 border-red-100' },
                            '신강':   { label: '신강 (身强)',   desc: '일간의 기운이 강한 편입니다. 설기(洩氣)하거나 극(剋)하는 오행이 도움이 됩니다.', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
                            '중립':   { label: '중화 (中和)',   desc: '일간의 강약이 균형 잡혀 있습니다. 현재의 흐름을 유지하면 안정적입니다.', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
                            '신약':   { label: '신약 (身弱)',   desc: '일간의 기운이 약한 편입니다. 일간을 생(生)하거나 비(比)하는 오행이 도움이 됩니다.', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
                            '극신약': { label: '극신약 (極身弱)', desc: '일간의 기운이 매우 약합니다. 일간을 강하게 뒷받침하는 오행이 반드시 필요합니다.', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100' },
                          };
                          const info = strengthLabel[s] ?? { label: s, desc: '', color: 'text-zinc-700', bg: 'bg-zinc-50 border-zinc-100' };
                          return (
                            <div className={`rounded-2xl border px-4 py-3 ${info.bg}`}>
                              <p className={`text-[11px] font-bold mb-1 ${info.color}`}>{info.label}</p>
                              <p className={`text-[11px] leading-relaxed ${info.color} opacity-80`}>{info.desc}</p>
                            </div>
                          );
                        })()}
                      </div>
                      <div className={`p-6 rounded-3xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-xl shadow-indigo-200/20 flex items-center justify-center`}>
                        <Suspense fallback={<div className="text-[11px] text-zinc-500">차트 불러오는 중...</div>}>
                          <FiveElementsPieChart data={chartData} />
                        </Suspense>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                      {getChartData().map((d, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/55 bg-white/55 backdrop-blur text-[11px] font-bold shadow-sm shadow-indigo-200/30">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                          <span className={'text-zinc-700'}>{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Jiji and Jijangan */}
                  <div className="space-y-4">
                    <h3 className={`text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>지지와 지장간 (地支/地藏干)</h3>
                    <div className="grid grid-cols-4 gap-3 md:gap-4">
                      {sajuResult.map((p, i) => {
                        if (userData.unknownTime && p.title === '시주') return null;
                        const dayStem = sajuResult.find(p => p.title === '일주')?.stem.hanja || '';
                        
                        return (
                          <div key={i} className={`p-3 md:p-5 rounded-3xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-xl shadow-indigo-200/20 flex flex-col items-center gap-2 transition-transform hover:scale-[1.02]`}>
                            <div className="py-2">
                              <HanjaBox 
                                hanja={p.branch.hanja} 
                                deity={p.branch.deity}
                                deityPosition="bottom"
                                size="md"
                              />
                            </div>
                            <span className={`text-[11px] md:text-[11px] font-bold mt-2 opacity-70`}>{p.branch.hangul}({p.branch.hanja})</span>
                            <div className="flex gap-2 mt-4 pb-2">
                              {(p.branch.hidden ? p.branch.hidden.split(', ') : []).map((h, k, hiddenArray) => {
                                const hanja = Object.keys(hanjaToHangul).find(key => hanjaToHangul[key] === h) || '';
                                const deity = calculateDeity(dayStem, hanja);
                                const isMainHiddenStem = k === hiddenArray.length - 1;
                                const labels: string[] = hiddenArray.length === 1
                                  ? ['본기']
                                  : hiddenArray.length === 2
                                    ? ['여기', '본기']
                                    : ['여기', '중기', '본기'];
                                const label = labels[k];
                                const labelColor = label === '본기'
                                  ? 'text-indigo-600'
                                  : label === '중기'
                                    ? 'text-violet-500'
                                    : 'text-zinc-400';
                                return (
                                  <div key={k} className="flex flex-col items-center gap-1">
                                    <span className={`text-[11px] font-bold ${labelColor}`}>{label}</span>
                                    <HanjaBox
                                      hanja={hanja}
                                      size="sm"
                                      deity={deity}
                                      deityPosition="bottom"
                                      highlight={isMainHiddenStem}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className={`text-[11px] md:text-[13px] leading-relaxed mt-4 italic opacity-60`}>
                      지지와 지장간은 사주의 뿌리이자 에너지가 저장된 곳입니다. 지장간은 지지 속에 숨겨진 천간의 기운으로, 당신의 내면적인 성향과 잠재력을 나타냅니다.
                      {hiddenStemExposureText ? (
                        <>
                          <br />
                          {hiddenStemExposureText}
                        </>
                      ) : null}
                    </p>
                  </div>

                  {/* ===== 12운성 (봉법) ===== */}
                  {sajuResult.length > 0 && (() => {
                    const dayStem = sajuResult.find((p: any) => p.title === '일주')?.stem.hanja || '';
                    return (
                      <div className="space-y-4">
                        <h3 className="text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60">12운성 (十二運星)</h3>
                        <div className="grid grid-cols-4 gap-3 md:gap-4">
                          {sajuResult.map((p: any, i: number) => {
                            if (userData.unknownTime && p.title === '시주') return null;
                            const unseong = getSipseung(dayStem, p.branch.hanja);
                            const isStrong = ['건록', '제왕', '관대'].includes(unseong);
                            const isMid = ['장생', '목욕', '양', '태'].includes(unseong);
                            return (
                              <div key={i} className="p-3 md:p-4 rounded-2xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-lg flex flex-col items-center gap-2">
                                <span className="text-[11px] font-bold opacity-50">{p.title}</span>
                                <span className="text-[13px] font-bold opacity-70">{p.branch.hangul}({p.branch.hanja})</span>
                                <span className={`text-[13px] font-bold px-3 py-1 rounded-full ${
                                  isStrong ? 'bg-emerald-500/20 text-emerald-700' :
                                  isMid ? 'bg-blue-500/15 text-blue-600' :
                                  'bg-zinc-500/10 text-zinc-500'
                                }`}>
                                  {unseong || '-'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Right Column */}
                <div className="space-y-8 md:space-y-12">
                  {/* ===== 형충회합 ===== */}
                  {sajuResult.length >= 2 && (() => {
                    const pillars = sajuResult.filter((p: any) => !(userData.unknownTime && p.title === '시주'));
                    const pillarLabel = (t: string) => t === '년주' ? '연지' : t === '월주' ? '월지' : t === '일주' ? '일지' : t === '시주' ? '시지' : t;
                    const pillarDomain = (l: string) => {
                      if (l === '연지') return '조상·뿌리·초년기';
                      if (l === '월지') return '부모·직장·사회';
                      if (l === '일지') return '배우자·가정·자신';
                      if (l === '시지') return '자녀·말년·미래';
                      return '';
                    };
                    const josaWa = (hanja: string) => (['丑', '寅', '辰', '申', '戌'].includes(hanja) ? '과' : '와');
                    const josaGa = (hanja: string) => (['丑', '寅', '辰', '申', '戌'].includes(hanja) ? '이' : '가');

                    type Rel = { p1: string; p2: string; b1: string; b2: string; kind: string; sentence: string };
                    const relations: Rel[] = [];

                    for (let a = 0; a < pillars.length; a++) {
                      for (let b = a + 1; b < pillars.length; b++) {
                        const b1 = pillars[a].branch.hanja;
                        const b2 = pillars[b].branch.hanja;
                        const p1 = pillarLabel(pillars[a].title);
                        const p2 = pillarLabel(pillars[b].title);
                        const d1 = pillarDomain(p1);
                        const d2 = pillarDomain(p2);
                        const bh1 = hanjaToHangul[b1];
                        const bh2 = hanjaToHangul[b2];

                        if (isChung(b1, b2)) {
                          relations.push({
                            p1, p2, b1, b2, kind: '충',
                            sentence: `${bh1}${bh2}충을 이룹니다. 강한 에너지 충돌로 ${d1}과 ${d2} 축이 부딪히며, 이사·이직·이별·큰 계획 전환 같은 변동이 촉발되기 쉽습니다.`,
                          });
                        }
                        if (isHyeong(b1, b2)) {
                          const self = b1 === b2;
                          relations.push({
                            p1, p2, b1, b2, kind: '형',
                            sentence: self
                              ? `${bh1}${bh2} 자형(自刑)을 이룹니다. 같은 글자가 겹쳐 스스로를 찌르는 형태로, ${d1}·${d2} 영역의 내면 갈등·자책·건강 관리 이슈로 드러나기 쉽습니다.`
                              : `${bh1}${bh2}형을 이룹니다. 마찰·구설·수술·법적 분쟁의 소지가 있고, 같은 글자가 돌아오는 세운에 갈등이 표면화되기 쉽습니다.`,
                          });
                        }
                        if (isHae(b1, b2)) {
                          relations.push({
                            p1, p2, b1, b2, kind: '해',
                            sentence: `${bh1}${bh2}해를 이룹니다. ${d1}과 ${d2} 사이에 은근한 방해·배신·오해·지체가 잠복하며, 겉으로 드러나지 않는 갈등으로 작용합니다.`,
                          });
                        }
                        if (isPa(b1, b2)) {
                          relations.push({
                            p1, p2, b1, b2, kind: '파',
                            sentence: `${bh1}${bh2}파를 이룹니다. 일시적인 단절·깨짐을 암시하며, 충·형보다 약하지만 ${d1}과 ${d2} 축에 작은 균열이 반복됩니다.`,
                          });
                        }
                        const yukhap = getYukhap(b1, b2);
                        if (yukhap) {
                          relations.push({
                            p1, p2, b1, b2, kind: '육합',
                            sentence: `${bh1}${bh2} 육합(${yukhap})을 이룹니다. 두 지지가 화합·결합하여 ${d1}과 ${d2} 사이에 협력·계약·인연의 유리한 배경을 제공합니다.`,
                          });
                        }
                        if (isWonjin(b1, b2)) {
                          relations.push({
                            p1, p2, b1, b2, kind: '원진',
                            sentence: `${bh1}${bh2} 원진을 이룹니다. 서로를 미워하는 기운이 흘러 ${d1}과 ${d2} 관계에서 원망·질시·지속적인 불화로 드러나기 쉽습니다.`,
                          });
                        }
                      }
                    }

                    // 삼합
                    const allBranches = pillars.map((p: any) => p.branch.hanja);
                    const samhapGroups: { combo: string[]; name: string; meaning: string }[] = [
                      { combo: ['申', '子', '辰'], name: '수삼합', meaning: '지혜·흐름·재물' },
                      { combo: ['巳', '酉', '丑'], name: '금삼합', meaning: '결단·원칙·마무리' },
                      { combo: ['寅', '午', '戌'], name: '화삼합', meaning: '열정·추진·창의' },
                      { combo: ['亥', '卯', '未'], name: '목삼합', meaning: '성장·학문·인덕' },
                    ];
                    const samhapSentences: string[] = [];
                    for (const { combo, name, meaning } of samhapGroups) {
                      const matched = combo.filter(b => allBranches.includes(b));
                      if (matched.length >= 2) {
                        const full = matched.length === 3;
                        const mk = matched.map(b => hanjaToHangul[b]).join('·');
                        samhapSentences.push(
                          full
                            ? `${name}(${mk})이 완전히 구성되어 ${meaning}의 기운이 강하게 모입니다. 인생 전반의 방향성이 이 주제로 수렴되는 구조입니다.`
                            : `${name} 반합(${mk})이 구성되어 ${meaning}의 기운이 어느 정도 모입니다. 빠진 한 글자가 돌아오는 세운·대운에 완전한 국이 성립되어 해당 주제의 일이 크게 불거집니다.`
                        );
                      }
                    }

                    // 방합
                    const banghapGroups: { combo: string[]; name: string; ohaeng: string; season: string }[] = [
                      { combo: ['寅', '卯', '辰'], name: '동방목국', ohaeng: '목', season: '봄의 성장' },
                      { combo: ['巳', '午', '未'], name: '남방화국', ohaeng: '화', season: '여름의 활발' },
                      { combo: ['申', '酉', '戌'], name: '서방금국', ohaeng: '금', season: '가을의 수확' },
                      { combo: ['亥', '子', '丑'], name: '북방수국', ohaeng: '수', season: '겨울의 저장' },
                    ];
                    const banghapSentences: string[] = [];
                    for (const { combo, name, ohaeng, season } of banghapGroups) {
                      const matched = combo.filter(b => allBranches.includes(b));
                      if (matched.length >= 2) {
                        const full = matched.length === 3;
                        const mk = matched.map(b => hanjaToHangul[b]).join('·');
                        banghapSentences.push(
                          full
                            ? `${name}(${mk})이 완전히 구성되어 ${season} 기운이 모이고 ${ohaeng} 오행이 크게 강해집니다.`
                            : `${name} 반합(${mk})이 구성되어 ${season} 기운이 부분적으로 모이고 ${ohaeng} 오행이 보강됩니다.`
                        );
                      }
                    }

                    const isEmpty = relations.length === 0 && samhapSentences.length === 0 && banghapSentences.length === 0;

                    return (
                      <div className="space-y-4">
                        <h3 className="text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60">형충회합 (刑沖會合)</h3>
                        <div className="p-5 rounded-2xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-lg">
                          {isEmpty ? (
                            <p className="text-[13px] text-zinc-600 leading-relaxed">원국 지지 사이에 특별한 형·충·회·합 관계가 감지되지 않습니다. 큰 변동 신호가 약하고, 전반적으로 안정적인 구조입니다.</p>
                          ) : (
                            <ul className="space-y-3 list-disc pl-5">
                              {relations.map((r, i) => (
                                <li key={`r-${i}`} className="text-[13px] leading-relaxed text-zinc-700">
                                  <span className="font-bold text-zinc-900">{r.p1}의 {hanjaToHangul[r.b1]}({r.b1})</span>
                                  {josaWa(r.b1)}{' '}
                                  <span className="font-bold text-zinc-900">{r.p2}의 {hanjaToHangul[r.b2]}({r.b2})</span>
                                  {josaGa(r.b2)} {r.sentence}
                                </li>
                              ))}
                              {samhapSentences.map((s, i) => (
                                <li key={`sh-${i}`} className="text-[13px] leading-relaxed text-zinc-700">{s}</li>
                              ))}
                              {banghapSentences.map((s, i) => (
                                <li key={`bh-${i}`} className="text-[13px] leading-relaxed text-zinc-700">{s}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ===== 공망 (연주·월주·일주 기준) ===== */}
                  {sajuResult.length >= 3 && (() => {
                    const yearStem = sajuResult.find((p: any) => p.title === '년주')?.stem.hanja || '';
                    const yearBranch = sajuResult.find((p: any) => p.title === '년주')?.branch.hanja || '';
                    const monthStem = sajuResult.find((p: any) => p.title === '월주')?.stem.hanja || '';
                    const monthBranch = sajuResult.find((p: any) => p.title === '월주')?.branch.hanja || '';
                    const dayStem = sajuResult.find((p: any) => p.title === '일주')?.stem.hanja || '';
                    const dayBranch = sajuResult.find((p: any) => p.title === '일주')?.branch.hanja || '';
                    const yearGongmang = getGongmang(yearStem, yearBranch);
                    const monthGongmang = getGongmang(monthStem, monthBranch);
                    const dayGongmang = getGongmang(dayStem, dayBranch);
                    const pillars = sajuResult.filter((p: any) => !(userData.unknownTime && p.title === '시주'));
                    const pillarLabel = (t: string) => t === '년주' ? '연지' : t === '월주' ? '월지' : t === '일주' ? '일지' : t === '시주' ? '시지' : t;
                    const pillarDomain = (l: string) => {
                      if (l === '연지') return '조상·뿌리·초년기';
                      if (l === '월지') return '부모·직장·사회';
                      if (l === '일지') return '배우자·가정·자신';
                      if (l === '시지') return '자녀·말년·미래';
                      return '';
                    };
                    const josaGa = (hanja: string) => (['丑', '寅', '辰', '申', '戌'].includes(hanja) ? '이' : '가');

                    const describe = (label: string, gm: string[], key: string) => {
                      if (!gm || gm.length === 0) return null;
                      const matches = pillars
                        .filter((p: any) => gm.includes(p.branch.hanja))
                        .map((p: any) => ({ pos: pillarLabel(p.title), branch: p.branch.hanja }));
                      const gmKor = gm.map(b => `${hanjaToHangul[b]}(${b})`).join('·');

                      return (
                        <li key={key} className="text-[13px] leading-relaxed text-zinc-700">
                          <span className="font-bold text-zinc-900">{label} 공망은 {gmKor}</span>
                          {'입니다. '}
                          {matches.length === 0 ? (
                            '원국에 해당 지지가 나타나 있지 않아 직접적 공망 작용은 발현되지 않습니다.'
                          ) : (
                            matches.map((m, i) => (
                              <span key={i}>
                                <span className="font-bold text-amber-700">{m.pos}의 {hanjaToHangul[m.branch]}({m.branch})</span>
                                {josaGa(m.branch)} 공망에 해당합니다. {pillarDomain(m.pos)} 영역의 실질 작용이 비어있는 상태로, 해당 자리가 상징하는 것에 허탈감·공허감을 느끼기 쉽고 물질적 성취가 약하게 나타납니다. 정신적·종교적·예술적 방향으로 전환하면 오히려 긍정적으로 활용할 수 있습니다.
                                {i < matches.length - 1 ? ' ' : ''}
                              </span>
                            ))
                          )}
                        </li>
                      );
                    };

                    return (
                      <div className="space-y-4">
                        <h3 className="text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60">공망 (空亡)</h3>
                        <div className="p-5 rounded-2xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-lg">
                          <ul className="space-y-3 list-disc pl-5">
                            {describe('연주 기준', yearGongmang, 'year')}
                            {describe('월주 기준', monthGongmang, 'month')}
                            {describe('일주 기준', dayGongmang, 'day')}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ===== 12신살 (연지·일지 기준) ===== */}
                  {sajuResult.length >= 3 && (() => {
                    const yearBranch = sajuResult.find((p: any) => p.title === '년주')?.branch.hanja || '';
                    const dayBranch = sajuResult.find((p: any) => p.title === '일주')?.branch.hanja || '';
                    const pillars = sajuResult.filter((p: any) => !(userData.unknownTime && p.title === '시주'));

                    const renderShinsalRow = (label: string, baseBranch: string) => (
                      <div>
                        <p className="text-[11px] font-bold opacity-50 mb-2">{label} ({hanjaToHangul[baseBranch]}{baseBranch})</p>
                        <div className="grid grid-cols-4 gap-2">
                          {pillars.map((p: any, i: number) => {
                            const shinsal = getShinsal(baseBranch, p.branch.hanja);
                            const isNotable = ['도화', '역마살', '겁살', '재살', '천살'].includes(shinsal);
                            return (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <span className="text-[11px] opacity-40">{p.title}</span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  shinsal === '도화' ? 'bg-pink-500/15 text-pink-600' :
                                  shinsal === '역마살' ? 'bg-violet-500/15 text-violet-600' :
                                  isNotable ? 'bg-red-500/10 text-red-500' :
                                  'bg-indigo-500/10 text-indigo-500'
                                }`}>
                                  {shinsal || '-'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );

                    return (
                      <div className="space-y-4">
                        <h3 className="text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60">12신살 (十二神殺)</h3>
                        <div className="p-5 rounded-2xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-lg space-y-4">
                          {renderShinsalRow('연지 기준', yearBranch)}
                          {renderShinsalRow('일지 기준', dayBranch)}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ===== 기타 신살 ===== */}
                  {sajuResult.length >= 3 && (() => {
                    const dayStem = sajuResult.find((p: any) => p.title === '일주')?.stem.hanja || '';
                    const dayBranch = sajuResult.find((p: any) => p.title === '일주')?.branch.hanja || '';
                    const pillars = sajuResult.filter((p: any) => !(userData.unknownTime && p.title === '시주'));
                    const allBranches = pillars.map((p: any) => p.branch.hanja);

                    const yanginBranch = getYangin(dayStem);
                    const cheoneul = getCheoneulGuiin(dayStem);
                    const munchang = getMunchang(dayStem);
                    const hakdang = getHakdang(dayStem);
                    const goegang = isGoegang(dayStem, dayBranch);

                    // 원국에서 해당하는 주 찾기
                    const findPillarsWith = (targetBranch: string) =>
                      pillars.filter((p: any) => p.branch.hanja === targetBranch).map((p: any) => p.title).join('·');
                    const findPillarsByArr = (branches: string[]) =>
                      pillars.filter((p: any) => branches.includes(p.branch.hanja)).map((p: any) => `${p.title}(${hanjaToHangul[p.branch.hanja]})`).join('·');

                    const shinsalItems: { name: string; condition: string; hit: string; color: string }[] = [];

                    // 양인살 — 원국에 해당하는 경우만
                    if (yanginBranch) {
                      const hitPillars = findPillarsWith(yanginBranch);
                      if (hitPillars) {
                        shinsalItems.push({
                          name: '양인살(羊刃)',
                          condition: `${hanjaToHangul[yanginBranch]}(${yanginBranch})`,
                          hit: hitPillars,
                          color: 'bg-red-500/15 text-red-600',
                        });
                      }
                    }
                    // 천을귀인 — 원국에 해당하는 경우만
                    if (cheoneul.length > 0) {
                      const hitPillars = findPillarsByArr(cheoneul);
                      if (hitPillars) {
                        shinsalItems.push({
                          name: '천을귀인(天乙)',
                          condition: cheoneul.map(b => `${hanjaToHangul[b]}(${b})`).join('·'),
                          hit: hitPillars,
                          color: 'bg-emerald-500/15 text-emerald-600',
                        });
                      }
                    }
                    // 문창귀인 — 원국에 해당하는 경우만
                    if (munchang) {
                      const hitPillars = findPillarsWith(munchang);
                      if (hitPillars) {
                        shinsalItems.push({
                          name: '문창귀인(文昌)',
                          condition: `${hanjaToHangul[munchang]}(${munchang})`,
                          hit: hitPillars,
                          color: 'bg-blue-500/15 text-blue-600',
                        });
                      }
                    }
                    // 학당귀인 — 원국에 해당하는 경우만
                    if (hakdang) {
                      const hitPillars = findPillarsWith(hakdang);
                      if (hitPillars) {
                        shinsalItems.push({
                          name: '학당귀인(學堂)',
                          condition: `${hanjaToHangul[hakdang]}(${hakdang})`,
                          hit: hitPillars,
                          color: 'bg-blue-500/15 text-blue-600',
                        });
                      }
                    }
                    // 괴강살
                    if (goegang) {
                      shinsalItems.push({
                        name: '괴강살(魁罡)',
                        condition: `${hanjaToHangul[dayStem]}${hanjaToHangul[dayBranch]}(${dayStem}${dayBranch})`,
                        hit: '일주 해당',
                        color: 'bg-purple-500/15 text-purple-600',
                      });
                    }
                    // 원진살 (원국 내)
                    const wonjinPairs: string[] = [];
                    for (let a = 0; a < pillars.length; a++) {
                      for (let b = a + 1; b < pillars.length; b++) {
                        if (isWonjin(pillars[a].branch.hanja, pillars[b].branch.hanja)) {
                          wonjinPairs.push(`${pillars[a].title}↔${pillars[b].title}`);
                        }
                      }
                    }
                    if (wonjinPairs.length > 0) {
                      shinsalItems.push({
                        name: '원진살(怨嗔)',
                        condition: '원국 내',
                        hit: wonjinPairs.join(', '),
                        color: 'bg-rose-500/15 text-rose-600',
                      });
                    }

                    if (shinsalItems.length === 0) return null;

                    return (
                      <div className="space-y-4">
                        <h3 className="text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60">기타 신살</h3>
                        <div className="p-5 rounded-2xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-lg">
                            <div className="space-y-2">
                              {shinsalItems.map((item, i) => (
                                <div key={i} className="flex items-center gap-3 text-[11px]">
                                  <span className={`shrink-0 px-2.5 py-1 rounded-lg font-bold text-[11px] ${item.color}`}>{item.name}</span>
                                  <span className="opacity-50 shrink-0">{item.condition}</span>
                                  <span className="font-bold opacity-70">→ {item.hit}</span>
                                </div>
                              ))}
                            </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Full-width: 대운 · 세운 · 용신 */}
              <div className="relative z-10 max-w-7xl mx-auto mt-8 md:mt-12 space-y-8 md:space-y-12">
                  {/* Daeun Analysis */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>대운분석 (大運分析)</h3>
                      {daeunResult.length > 0 && (
                        <span className="text-[11px] md:text-[11px] font-bold text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full">
                          {daeunResult[0].startAge}대운
                        </span>
                      )}
                    </div>

                    <div className={`p-6 rounded-3xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-xl shadow-indigo-200/20`}>
                      <div ref={daeunScrollRef} className="flex overflow-x-auto horizontal-scrollbar gap-6 pb-6 snap-x snap-mandatory scroll-smooth">
                        {daeunResult.length > 0 ? daeunResult.map((dy, i) => {
                          const currentAge = currentSeoulYear - parseInt(userData.birthYear) + 1;
                          const isCurrentDaeun = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
                          const isTransitioning = Math.abs(currentAge - dy.startAge) <= 1 || 
                                                (daeunResult[i+1] && Math.abs(currentAge - daeunResult[i+1].startAge) <= 1);

                          const isSelectedDaeun = selectedDaeunIdx === i;
                          const dayStem = sajuResult.find(p => p.title === '일주')?.stem.hanja || '';
                          const yearBranch = sajuResult.find(p => p.title === '년주')?.branch.hanja || '';
                          const yearStem = sajuResult.find(p => p.title === '년주')?.stem.hanja || '';
                          const unseong = getSipseung(dayStem, dy.branch);
                          const shinsal = getShinsal(yearBranch, dy.branch);
                          const gongmangList = getGongmang(yearStem, yearBranch);
                          const isGongmang = gongmangList.includes(dy.branch);
                          return (
                            <div
                              key={i}
                              onClick={() => setSelectedDaeunIdx(i)}
                              className={`w-28 shrink-0 snap-center p-4 rounded-3xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                                isCurrentDaeun
                                  ? 'border-indigo-500 bg-indigo-600/35 text-white shadow-2xl shadow-indigo-500/40 ring-4 ring-indigo-500/30 scale-110 z-10'
                                  : isSelectedDaeun
                                    ? 'border-violet-400 bg-violet-100/70 shadow-lg shadow-violet-300/40 ring-2 ring-violet-400/40 scale-105 z-10'
                                    : 'border-white/50 bg-white/60 backdrop-blur opacity-60 hover:opacity-100'
                              }`}
                            >
                              <div className="text-[11px] md:text-[11px] font-bold">{dy.startAge}세</div>
                              <div className="flex flex-col gap-4 py-2">
                                {[dy.stem, dy.branch].map((hanja, j) => {
                                  const isBranch = j === 1;
                                  const deity = calculateDeity(dayStem, hanja, isBranch);
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
                              <div className="text-[11px] md:text-[11px] font-bold opacity-70">{hanjaToHangul[dy.stem]}{hanjaToHangul[dy.branch]}</div>
                              {/* 12운성 */}
                              {unseong && (
                                <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  ['건록', '제왕', '관대'].includes(unseong)
                                    ? 'bg-emerald-500/15 text-emerald-700'
                                    : ['장생', '목욕', '양', '태'].includes(unseong)
                                      ? 'bg-blue-500/15 text-blue-600'
                                      : 'bg-zinc-500/10 text-zinc-500'
                                }`}>
                                  {unseong}
                                </div>
                              )}
                              {/* 12신살 */}
                              {shinsal && (
                                <div className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                                  ['도화', '역마살'].includes(shinsal)
                                    ? 'bg-pink-500/15 text-pink-600'
                                    : ['겁살', '재살', '천살', '망신살'].includes(shinsal)
                                      ? 'bg-red-500/10 text-red-500'
                                      : 'bg-indigo-500/10 text-indigo-500'
                                }`}>
                                  {shinsal}
                                </div>
                              )}
                              {/* 공망 */}
                              {isGongmang && (
                                <div className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                                  공망
                                </div>
                              )}
                              {isCurrentDaeun && isTransitioning && (
                                <div className="mt-1 px-2 py-0.5 bg-rose-500/20 text-rose-500 text-[11px] md:text-[11px] font-bold rounded-full animate-pulse">
                                  교운기
                                </div>
                              )}
                            </div>
                          );
                        }) : (
                          <div className={`text-[13px] py-8 w-full text-center opacity-40`}>분석을 시작하면 대운이 표시됩니다.</div>
                        )}
                      </div>
                    </div>

                    {/* Current Daeun Description */}
                    {daeunResult.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 rounded-3xl border border-indigo-300/40 bg-white/55 backdrop-blur-xl shadow-xl shadow-indigo-200/20`}
                      >
                        {daeunResult.map((dy, i) => {
                          const currentAge = currentSeoulYear - parseInt(userData.birthYear) + 1;
                          const isCurrentDaeun = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
                          if (!isCurrentDaeun) return null;
                          
                          return (
                            <div key={i} className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-6 bg-indigo-500 rounded-full" />
                                <h4 className={`text-[13px] md:text-base font-bold text-indigo-900`}>현재 대운: {dy.startAge}세 {hanjaToHangul[dy.stem]}{hanjaToHangul[dy.branch]}대운</h4>
                              </div>
                              <p className={`text-[11px] md:text-[13px] leading-relaxed italic font-medium opacity-80`}>
                                "{dy.description}"
                              </p>
                              {Math.abs(currentAge - dy.startAge) <= 1 && (
                                <div className={`flex items-start gap-3 p-4 rounded-2xl border border-rose-300/50 bg-rose-100/50 backdrop-blur`}> 
                                  <Info className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                                  <p className="text-[11px] md:text-[11px] text-rose-500 leading-relaxed">
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

                  {/* 세운 (歲運) */}
                  {daeunResult.length > 0 && selectedDaeunIdx !== null && (() => {
                    const STEMS_LIST = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
                    const BRANCHES_LIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
                    const selDaeun = daeunResult[selectedDaeunIdx];
                    const seunList = Array.from({ length: 10 }, (_, i) => {
                      const year = selDaeun.startYear + i;
                      const stem = STEMS_LIST[(year + 6) % 10];
                      const branch = BRANCHES_LIST[(year + 8) % 12];
                      const age = year - parseInt(userData.birthYear) + 1;
                      return { year, stem, branch, age };
                    });
                    const dayStem = sajuResult.find((p: any) => p.title === '일주')?.stem.hanja || '';
                    const yearBranch = sajuResult.find((p: any) => p.title === '년주')?.branch.hanja || '';
                    const yearStem = sajuResult.find((p: any) => p.title === '년주')?.stem.hanja || '';
                    const gongmangList = getGongmang(yearStem, yearBranch);

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className={`text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>세운분석 (歲運分析)</h3>
                          <span className="text-[11px] md:text-[11px] font-bold text-violet-500 bg-violet-500/10 px-3 py-1 rounded-full">
                            {selDaeun.startAge}세 {hanjaToHangul[selDaeun.stem]}{hanjaToHangul[selDaeun.branch]}대운 기간
                          </span>
                        </div>
                        <div className={`p-6 rounded-3xl border border-white/55 bg-white/45 backdrop-blur-xl shadow-xl shadow-violet-200/20`}>
                          <div className="flex overflow-x-auto horizontal-scrollbar gap-4 pb-6 snap-x snap-mandatory scroll-smooth">
                            {seunList.map((sy, i) => {
                              const isCurrentYear = sy.year === currentSeoulYear;
                              const isPastYear = sy.year < currentSeoulYear;
                              const syUnseong = getSipseung(dayStem, sy.branch);
                              const syShinsal = getShinsal(yearBranch, sy.branch);
                              const syGongmang = gongmangList.includes(sy.branch);
                              return (
                                <div key={i} className={`w-24 shrink-0 snap-center p-3 rounded-3xl border flex flex-col items-center gap-1.5 transition-all ${
                                  isCurrentYear
                                    ? 'border-violet-500 bg-violet-600/30 shadow-2xl shadow-violet-500/40 ring-4 ring-violet-400/30 scale-110 z-10'
                                    : isPastYear
                                      ? 'border-white/30 bg-white/30 backdrop-blur opacity-40'
                                      : 'border-white/50 bg-white/60 backdrop-blur opacity-70 hover:opacity-100'
                                }`}>
                                  <div className="text-[11px] font-bold opacity-70">{sy.year}</div>
                                  <div className="text-[11px] opacity-50">{sy.age}세</div>
                                  <div className="flex flex-col gap-3 py-1">
                                    {[sy.stem, sy.branch].map((hanja, j) => {
                                      const isBranch = j === 1;
                                      const deity = calculateDeity(dayStem, hanja, isBranch);
                                      return (
                                        <HanjaBox
                                          key={j}
                                          hanja={hanja}
                                          deity={deity}
                                          deityPosition={j === 0 ? 'top' : 'bottom'}
                                          size="sm"
                                        />
                                      );
                                    })}
                                  </div>
                                  <div className="text-[11px] font-bold opacity-70">{hanjaToHangul[sy.stem]}{hanjaToHangul[sy.branch]}</div>
                                  {/* 12운성 */}
                                  {syUnseong && (
                                    <div className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                                      ['건록', '제왕', '관대'].includes(syUnseong)
                                        ? 'bg-emerald-500/15 text-emerald-700'
                                        : ['장생', '목욕', '양', '태'].includes(syUnseong)
                                          ? 'bg-blue-500/15 text-blue-600'
                                          : 'bg-zinc-500/10 text-zinc-500'
                                    }`}>
                                      {syUnseong}
                                    </div>
                                  )}
                                  {/* 12신살 */}
                                  {syShinsal && (
                                    <div className={`text-[11px] font-bold px-1 py-0.5 rounded-full ${
                                      ['도화', '역마살'].includes(syShinsal)
                                        ? 'bg-pink-500/15 text-pink-600'
                                        : ['겁살', '재살', '천살', '망신살'].includes(syShinsal)
                                          ? 'bg-red-500/10 text-red-500'
                                          : 'bg-indigo-500/10 text-indigo-500'
                                    }`}>
                                      {syShinsal}
                                    </div>
                                  )}
                                  {/* 공망 */}
                                  {syGongmang && (
                                    <div className="text-[11px] font-bold px-1 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                                      공망
                                    </div>
                                  )}
                                  {isCurrentYear && (
                                    <div className="px-1.5 py-0.5 bg-violet-500/20 text-violet-600 text-[11px] font-bold rounded-full">
                                      올해
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <p className={`text-[11px] md:text-[13px] leading-relaxed italic opacity-60`}>
                          세운은 해마다 바뀌는 연도별 천간지지의 기운입니다. 대운의 큰 흐름 안에서 각 해의 특성이 어떻게 작용하는지를 보여줍니다.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Yongshin Analysis */}
                  <div className="space-y-4">
                    <h3 className={`text-[13px] md:text-base font-title font-bold uppercase tracking-widest opacity-60`}>용신(用神) 정밀 분석</h3>
                    {yongshinResult && (
                      <div className={`p-6 md:p-8 rounded-[2.5rem] border border-white/55 bg-white/45 backdrop-blur-2xl shadow-2xl shadow-indigo-200/30 space-y-6 md:space-y-8`}>
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <p className={`text-[11px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-40`}>핵심 에너지</p>
                            <h4 className="text-2xl md:text-3xl font-title font-bold text-indigo-500">{userData.name}님의 용신: {yongshinResult.yongshin}</h4>
                          </div>
                          <div className={`w-16 h-16 md:w-20 md:h-20 rounded-3xl flex items-center justify-center text-white font-bold text-[16px] md:text-[16px] shadow-2xl ${
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
                          <div className={`p-4 md:p-6 rounded-3xl border border-white/55 bg-white/65 backdrop-blur`}>
                            <p className="text-[11px] md:text-[11px] font-bold opacity-40 mb-2 uppercase tracking-wider">일간 강약 (억부)</p>
                            <p className="text-[13px] md:text-[16px] font-bold">{yongshinResult.strength} ({yongshinResult.score}점)</p>
                            <p className="text-[11px] md:text-[13px] text-indigo-500 mt-2 font-bold">억부용신: {yongshinResult.eokbuYongshin}</p>
                          </div>
                          <div className={`p-4 md:p-6 rounded-3xl border border-white/55 bg-white/65 backdrop-blur`}>
                            <p className="text-[11px] md:text-[11px] font-bold opacity-40 mb-2 uppercase tracking-wider">계절 기운 (조후)</p>
                            <p className="text-[13px] md:text-[16px] font-bold">{yongshinResult.johooStatus}</p>
                            <p className="text-[11px] md:text-[13px] text-indigo-500 mt-2 font-bold">조후용신: {yongshinResult.johooYongshin}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[11px] md:text-[11px] font-bold opacity-40 uppercase tracking-[0.2em]">분석 근거</p>
                          <p className="text-[11px] md:text-[13px] opacity-70 leading-relaxed font-medium">
                            {yongshinResult.logicBasis}
                          </p>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-white/60">
                          <p className="text-[11px] md:text-[11px] font-bold opacity-40 uppercase tracking-[0.2em]">실생활 가이드</p>
                          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-[11px] opacity-50">행운의 색:</span>
                              <span className="text-[11px] font-bold">{yongshinResult.advice.color}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-[11px] opacity-50">행운의 숫자:</span>
                              <span className="text-[11px] font-bold">{yongshinResult.advice.numbers}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-[11px] opacity-50">행운의 방향:</span>
                              <span className="text-[11px] font-bold">{yongshinResult.advice.direction}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-[11px] opacity-50">추천 행위:</span>
                              <span className="text-[11px] font-bold">{yongshinResult.advice.action}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
              </div>
                </>
            ) : (
                <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center justify-center py-20 px-6 text-center space-y-8">
                  <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center border border-white/60 bg-white/55 backdrop-blur-xl shadow-2xl shadow-indigo-200/30`}>
                    <LayoutDashboard className={`w-12 h-12 text-zinc-300`} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-[16px] font-bold">사주 데이터가 없습니다</h3>
                    <p className={`max-w-md mx-auto text-zinc-500`}>
                      HOME 탭에서 생년월일 정보를 입력하시면<br/>
                      정밀한 만세력 분석과 대운 정보를 확인하실 수 있습니다.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab("welcome")}
                    className="inline-flex min-h-[44px] items-center justify-center px-8 py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
                  >
                    정보 입력하러 가기
                  </button>
                </div>
              )}

              {/* Disclaimer (Moved to bottom) */}
              <div className="relative z-10 max-w-3xl mx-auto p-6 rounded-3xl border border-white/60 bg-white/55 backdrop-blur-xl shadow-xl shadow-indigo-200/20 mt-12">
                <p className="text-[11px] md:text-[11px] text-zinc-600 leading-relaxed text-center font-medium">
                  본 분석 결과는 인공지능의 해석이며, 과학적 사실이 아닌 참고 용도로만 사용해 주세요. 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === "taekil" && (
            <TaekilTab tabTransition={TAB_TRANSITION} glassTabBgClass={GLASS_TAB_BG_CLASS}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden">
                <div className="absolute -left-10 top-10 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl" />
                <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" />
              </div>
              <div className="relative z-10 max-w-7xl mx-auto pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
                  <aside className={`rounded-[2rem] border border-white/60 p-4 md:p-5 lg:sticky lg:top-6 bg-white/55 backdrop-blur-xl shadow-xl shadow-indigo-200/20`}>
                    <div className="mb-4 px-2">
                      <p className={`text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600`}>카테고리</p>
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
                            className={`w-full min-h-[44px] rounded-2xl border px-4 py-3 text-left text-[13px] font-bold transition-all ${
                              isActive
                                ? 'bg-indigo-500/15 border-indigo-300 text-indigo-700 shadow-lg shadow-indigo-300/20'
                                : enabled
                                  ? 'bg-white/60 border-white/65 text-zinc-700 hover:border-indigo-200 hover:text-indigo-600'
                                  : 'bg-zinc-100/70 border-zinc-200 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>
                  </aside>

                  <section className={`rounded-[2rem] border border-white/60 p-4 md:p-8 bg-white/55 backdrop-blur-xl shadow-2xl shadow-indigo-200/20`}>
                  <div className="mb-6 md:mb-8">
                    <p className={`text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500`}>
                      {taekilActiveCategory === '이사' ? 'Moving Taekil' : 'Marriage Taekil'}
                    </p>
                    <h2 className="mt-2 text-2xl md:text-4xl font-bold tracking-tight">{taekilActiveCategory} 택일</h2>
                    <p className={`mt-3 text-[13px] md:text-base text-zinc-600`}>
                      프로세스 Q1-Q4를 입력한 뒤 {taekilActiveCategory} 길일 조회를 실행하세요.
                    </p>
                  </div>

                  <div className="space-y-4 md:space-y-5">
                    {taekilActiveCategory === '결혼' ? (
                      <>
                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                            <h3 className="text-[16px] font-bold leading-tight">배우자의 생년월일시는 언제 입니까?</h3>
                          </div>
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
                            <label className={`flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/65 px-4 py-3 cursor-pointer bg-white/70 text-zinc-700 backdrop-blur`}>
                              <input type="checkbox" checked={spouseUnknownTime} onChange={(e) => setSpouseUnknownTime(e.target.checked)} />
                              <span className="text-[13px] font-medium">생시 미상</span>
                            </label>
                          </div>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                            <h3 className="text-[16px] font-bold leading-tight">희망하는 결혼식 일정은 언제부터 언제까지 인가요?</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                            <h3 className="text-[16px] font-bold leading-tight">희망하는 요일은 언제 인가요? 3순위까지 입력하세요.</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                            <h3 className="text-[16px] font-bold leading-tight">꼭 피해야 하는 날을 입력해 주세요. (최대 5개)</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                            <h3 className="text-[16px] font-bold leading-tight">가구주 및 가족 생년월일을 입력해 주세요.</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                            <h3 className="text-[16px] font-bold leading-tight">현재 거주지와 이사 갈 주소를 입력해 주세요.</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                            <h3 className="text-[16px] font-bold leading-tight">희망 이사 기간과 선호 요일을 입력해 주세요.</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                            <h3 className="text-[16px] font-bold leading-tight">무엇을 더 중시할지 선택해 주세요.</h3>
                          </div>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <label className="space-y-2">
                              <span className={TAEKIL_LABEL_CLASS}>중요도 설정</span>
                              <select value={movePriority} onChange={(e) => setMovePriority(e.target.value as 'folklore' | 'saju' | 'balanced')} className={TAEKIL_FIELD_CLASS}>
                                <option value="balanced">균형형(민속+사주)</option>
                                <option value="folklore">손없는날/민속 우선</option>
                                <option value="saju">사주 맞춤 우선</option>
                              </select>
                            </label>
                            <label className={`flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/65 px-4 py-3 mt-6 md:mt-0 cursor-pointer bg-white/70 text-zinc-700 backdrop-blur`}>
                              <input type="checkbox" checked={moveOnlyWeekend} onChange={(e) => setMoveOnlyWeekend(e.target.checked)} />
                              <span className="text-[13px] font-medium">주말만 가능</span>
                            </label>
                          </div>
                        </div>
                      </>
                    ) : taekilActiveCategory === '출산' ? (
                      <>
                        <div className={`rounded-3xl border border-indigo-300/40 p-4 md:p-6 bg-white/60 backdrop-blur-xl shadow-xl shadow-indigo-200/20`}>
                          <p className={`text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-700`}>출산 택일 프롬프트</p>
                          <p className={`mt-2 text-[13px] leading-relaxed text-zinc-700`}>
                            "당신은 사주팔자를 설계하는 명리학 대가입니다. 아래 조건에 맞는 최상의 출산 택일을 수행하세요."
                          </p>
                          <ul className={`mt-3 text-[11px] space-y-1 text-zinc-600`}>
                            <li>1순위: 오행 중화 및 조후 적합</li>
                            <li>2순위: 초년/중년 대운 희신 방향</li>
                            <li>3순위: 부모와 원진/충 회피</li>
                          </ul>
                        </div>

                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                            <h3 className="text-[16px] font-bold leading-tight">부모 데이터 (생년월일시)</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                            <h3 className="text-[16px] font-bold leading-tight">태아 데이터</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                            <h3 className="text-[16px] font-bold leading-tight">분만 가능일</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                            <h3 className="text-[16px] font-bold leading-tight">결과 형식</h3>
                          </div>
                          <p className={`mt-2 text-[13px] leading-relaxed text-zinc-600`}>
                            추천 날짜/시진 3안, 각 안의 성격·진로·건강운 요약을 기준으로 해석합니다.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={TAEKIL_SECTION_CARD_CLASS}>
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                            <h3 className="text-[16px] font-bold leading-tight">희망 기간을 입력해 주세요.</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                            <h3 className="text-[16px] font-bold leading-tight">{taekilActiveCategory}에 필요한 핵심 정보를 입력해 주세요.</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                            <h3 className="text-[16px] font-bold leading-tight">희망 요일 우선순위를 입력해 주세요.</h3>
                          </div>
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
                          <div className="flex items-center gap-2 min-h-[28px]">
                            <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                            <h3 className="text-[16px] font-bold leading-tight">피해야 할 날(선택)과 추가 메모를 입력해 주세요.</h3>
                          </div>
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
                        className={`w-full md:w-auto min-h-[44px] px-6 py-3 rounded-2xl text-white text-[13px] font-bold transition-all bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 ${taekilLoading ? 'opacity-60 cursor-wait' : ''}`}
                      >
                        {taekilLoading ? '계산 중...' : `${taekilActiveCategory} 길일 조회`}
                      </button>
                    </div>

                    {taekilNotice && (
                      <div className={`rounded-2xl border border-sky-300/45 px-4 py-3 text-[13px] bg-sky-100/55 backdrop-blur text-sky-700`}>
                        {taekilNotice}
                      </div>
                    )}

                    {taekilError && (
                      <div className={`rounded-2xl border border-rose-300/45 px-4 py-3 text-[13px] bg-rose-100/55 backdrop-blur text-rose-700`}>
                        {taekilError}
                      </div>
                    )}

                    {taekilDisplayResults.length > 0 && (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-base md:text-[16px] font-bold">
                            {taekilActiveCategory === '출산' ? '출산 택일 추천 3안' : `${taekilActiveCategory} 택일 추천`}
                          </h4>
                          <span className={`text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-700 border border-indigo-300/50`}>
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
                              className={`rounded-2xl border p-4 text-left transition-all backdrop-blur ${selectedTaekilDate === item.date ? ('bg-indigo-500/15 border-indigo-300 shadow-lg shadow-indigo-200/20') : ('bg-white/65 border-white/65 hover:border-indigo-200')}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[13px] font-bold">{index + 1}안 · {item.date}</p>
                                  <p className={TAEKIL_HELP_TEXT_CLASS}>
                                    추천 시진: {item.topTimeSlots?.[0]?.time || '산출 없음'}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 space-y-1.5">
                                {item.reasons.slice(0, 2).map((reason, reasonIdx) => (
                                  <p key={`${item.date}-reason-${reasonIdx}`} className={`text-[11px] leading-relaxed text-zinc-600`}>
                                    {reason}
                                  </p>
                                ))}
                                {profileSummary && (
                                  <div className={`mt-2 rounded-xl border px-3 py-2 space-y-1 border-white/65 bg-white/70 backdrop-blur`}>
                                    <p className={`text-[11px] leading-relaxed text-zinc-700`}>{profileSummary.personality}</p>
                                    <p className={`text-[11px] leading-relaxed text-zinc-700`}>{profileSummary.career}</p>
                                    <p className={`text-[11px] leading-relaxed text-zinc-700`}>{profileSummary.health}</p>
                                    <p className={`text-[11px] leading-relaxed text-zinc-600`}>{profileSummary.caution}</p>
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
                          <div className={`rounded-2xl border border-white/65 p-4 bg-white/65 backdrop-blur-xl shadow-lg shadow-indigo-200/20`}>
                            <p className="text-[13px] font-bold">선택 후보: {selectedTaekilDetail.date}</p>
                            <div className="mt-2 space-y-1.5">
                              {selectedTaekilDetail.reasons.slice(0, 4).map((reason, idx) => (
                                <p key={`detail-reason-${idx}`} className={`text-[11px] leading-relaxed text-zinc-600`}>
                                  {reason}
                                </p>
                              ))}
                              {detailProfileSummary && (
                                <div className={`mt-2 rounded-xl border px-3 py-2 space-y-1 border-white/65 bg-white/75 backdrop-blur`}>
                                  <p className={`text-[11px] leading-relaxed text-zinc-700`}>{detailProfileSummary.personality}</p>
                                  <p className={`text-[11px] leading-relaxed text-zinc-700`}>{detailProfileSummary.career}</p>
                                  <p className={`text-[11px] leading-relaxed text-zinc-700`}>{detailProfileSummary.health}</p>
                                  <p className={`text-[11px] leading-relaxed text-zinc-600`}>{detailProfileSummary.caution}</p>
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
            </TaekilTab>
          )}

          {activeTab === "chat" && (
            <ChatTab tabTransition={TAB_TRANSITION} glassTabBgClass={GLASS_TAB_BG_CLASS}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
                <div className="absolute -left-10 top-8 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
                <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-indigo-300/25 blur-3xl" />
              </div>
              <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full">
                {/* Desktop Sidebar for Suggestions */}
                <aside className="hidden md:flex w-64 flex-col border-r border-white/55 bg-white/45 backdrop-blur-xl p-4 space-y-6 overflow-y-auto relative shadow-xl shadow-indigo-200/20">
                  <div className="space-y-3">
                    <h4 className="text-[13px] font-bold uppercase tracking-[0.2em] opacity-40 px-2">상담 모드</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => switchConsultationMode('basic')}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                          consultationMode === 'basic'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-white/60 border border-white/60 text-zinc-500'
                        }`}
                      >
                        초급자
                      </button>
                      <button
                        onClick={() => switchConsultationMode('advanced')}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                          consultationMode === 'advanced'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-white/60 border border-white/60 text-zinc-500'
                        }`}
                      >
                        고급자
                      </button>
                    </div>
                  </div>

                  {/* Consultation Tips */}
                  <div className="space-y-3 pt-4 border-t border-white/55">
                    <h4 className="text-[13px] font-bold uppercase tracking-[0.2em] opacity-40 px-2">사주상담시 유용한 팁</h4>
                    <ul className="space-y-2 px-2">
                      <li className="text-[13px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>질문에 "어떻게"를 넣어보세요. 고민의 해결은 나의 행동에서 출발합니다. 내가 어떻게 하는가가 많은 걸 바꿉니다.</span>
                      </li>
                      <li className="text-[13px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>구체적인 상황을 알려주세요. 사주상담이 더욱 풍성해지고 알차집니다. 여기에서 알려주시는 모든 사적인 내용은 철저하게 보호해드립니다.</span>
                      </li>
                      <li className="text-[13px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>상담내용에 다른 사람의 개인 정보(물론 그분의 동의가 필요합니다)를 넣으시면 더 좋은 상담결과가 나옵니다.</span>
                      </li>
                      <li className="text-[13px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>MBTI 등 추가적인 정보를 넣으시면 관련하여 더욱 알찬 상담이 될 수 있습니다.</span>
                      </li>
                      <li className="text-[13px] text-zinc-500 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>상담을 진행하다 맥락을 리프레시하고 상담을 재개하면 객관적인 상담이 유지될 수 있습니다.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Order CTA + Privacy Notice (Desktop) */}
                  <div className="mt-auto space-y-3">
                    <button
                      onClick={() => { setOrderProductType('premium'); setActiveTab("order"); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl text-[11px] font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-all"
                    >
                      <Ticket className="w-4 h-4" />
                      프리미엄 리포트 주문하기
                    </button>
                    <div className="border-t border-white/55 pt-3">
                      <p className="text-[13px] text-zinc-500 text-center leading-relaxed">
                        상담에 사용된 개인정보 등 모든 정보는 상담이 끝나면 자동으로 파기 됩니다. 마음 편하게 상담해 주세요.
                      </p>
                    </div>
                  </div>
                </aside>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative text-[13px]">
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-5 hide-scrollbar">
                    <div className="md:hidden grid grid-cols-2 gap-1 pb-1">
                      <button
                        onClick={() => switchConsultationMode('basic')}
                        className={`px-2 py-1 min-h-[44px] rounded-lg text-[13px] font-bold border ${consultationMode === 'basic' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/75 border-white/65 text-gray-500 backdrop-blur'}`}
                      >
                        초급자
                      </button>
                      <button
                        onClick={() => switchConsultationMode('advanced')}
                        className={`px-2 py-1 min-h-[44px] rounded-lg text-[13px] font-bold border ${consultationMode === 'advanced' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/75 border-white/65 text-gray-500 backdrop-blur'}`}
                      >
                        고급자
                      </button>
                    </div>

                    {modeNotice && (
                      <div className="mx-auto max-w-3xl rounded-xl border border-indigo-300/45 bg-indigo-100/55 backdrop-blur px-4 py-2 text-center text-[13px] text-indigo-700">
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
                            : 'bg-white/75 backdrop-blur border border-white/65 text-gray-800 rounded-tl-none'
                        }`}>
                          {renderChatPlainText(msg.text)}
                        </div>

                        {msg.role === 'model' && i === messages.length - 1 && !loading && (suggestionsLoading || suggestionsError || suggestions.length > 0) && (
                          <div className="w-full max-w-[96%] md:max-w-[92%]">
                            <button
                              onClick={() => setShowInlineSuggestions((prev) => !prev)}
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-indigo-200/60 bg-white/50 text-zinc-600 hover:text-indigo-600 text-[13px] font-semibold"
                            >
                              {showInlineSuggestions ? '추천 질문 접기' : suggestionsLoading ? '추천 질문 생성 중...' : '추천 질문 보기'}
                            </button>

                            {showInlineSuggestions && (
                              <div className="mt-2 p-3 rounded-2xl border bg-indigo-100/45 backdrop-blur border-indigo-300/30">
                                <div className="mb-2 px-2 text-[11px] text-zinc-600 flex items-center justify-between gap-2">
                                  <span>
                                    {suggestionsLoading
                                      ? '질문을 생성하고 있습니다...'
                                      : suggestionsSource === 'static'
                                        ? '기본 추천 질문'
                                      : suggestionsSource === 'dynamic'
                                        ? 'AI 맞춤 추천'
                                        : suggestionsSource === 'fallback'
                                          ? '기본 추천(비상 모드)'
                                          : '추천 준비 중'}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {!suggestionsLoading && (
                                      <button
                                        onClick={() => setRefreshKey((prev) => prev + 1)}
                                        className="rounded-md px-2 py-1 text-indigo-600 hover:text-indigo-700"
                                        title="기본 추천 질문 새로고침"
                                      >
                                        기본 새로고침
                                      </button>
                                    )}
                                    <button
                                      onClick={() => { void handleGenerateAiSuggestions(); }}
                                      disabled={suggestionsLoading || aiSuggestionRequestCount >= 2}
                                      className="rounded-md px-2 py-1 text-indigo-700 border border-indigo-200 bg-white/70 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="AI 추천 질문 생성"
                                    >
                                      AI 생성 ({Math.max(0, 2 - aiSuggestionRequestCount)}회 남음)
                                    </button>
                                  </div>
                                </div>

                                {suggestionsError && (
                                  <div className="mb-2 px-2 py-1.5 rounded-lg bg-amber-100/70 border border-amber-200 text-[11px] text-amber-800">
                                    {suggestionsError}
                                  </div>
                                )}

                                <div className="grid grid-cols-[3fr_7fr] gap-3">
                                  <div className="space-y-1 pr-1">
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
                                        className={`w-full text-center px-1 py-0.5 min-h-[28px] rounded-md text-[11px] leading-tight transition-all border bg-transparent ${
                                          (consultationMode === 'basic' ? basicSelectedCategory : selectedCategory) === cat
                                            ? 'text-indigo-700 font-bold border-indigo-400/70'
                                            : 'text-zinc-500 border-indigo-200/70 hover:border-indigo-300 hover:text-indigo-600'
                                        }`}
                                      >
                                        {cat}
                                      </button>
                                    ))}
                                    <div className="w-full min-h-[32px] rounded-md border-0 bg-transparent text-indigo-600 flex items-center justify-center">
                                      <RefreshCw className={`w-4 h-4 ${suggestionsLoading ? 'animate-spin' : ''}`} />
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 pl-1">
                                    {!suggestionsLoading && suggestions.map((s, idx) => (
                                      <button
                                        key={`inline-chat-suggestion-${idx}`}
                                        onClick={() => handleSuggestionClick(s)}
                                        className="w-full text-right px-3 py-1.5 min-h-[32px] rounded-lg border-0 bg-transparent transition-all text-zinc-700 hover:text-indigo-600"
                                      >
                                        {s}
                                      </button>
                                    ))}
                                    {!suggestionsLoading && suggestions.length === 0 && (
                                      <div className="px-3 py-1.5 text-[13px] text-zinc-500">추천 질문을 준비 중입니다. 잠시만 기다려 주세요.</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {loading && (
                      <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full w-fit border bg-white/70 backdrop-blur border-white/65`}>
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                        <span className={`text-gray-500`}>유아이가 분석 중입니다...</span>
                      </div>
                    )}

                  </div>

                  {/* Input Area */}
                  <div className={`p-2 border-t md:pb-4 border-white/55 bg-white/50 backdrop-blur-xl`}>
                    <div className="max-w-4xl mx-auto mb-2 flex flex-wrap gap-2">
                      {/* 왼쪽: 기간 단축 버튼 */}
                      <div className="flex flex-wrap gap-2">
                        {["올해운세", "내년운세", "이번달운세", "오늘의 운세"].map((shortcut) => (
                          <button
                            key={`fortune-shortcut-${shortcut}`}
                            onClick={() => {
                              const query = selectedTopics.length > 0
                                ? `${shortcut} ${selectedTopics.join(' ')}`
                                : shortcut;
                              handleSuggestionClick(query);
                            }}
                            disabled={loading}
                            className={`px-3 py-1.5 min-h-[40px] rounded-full text-[13px] font-semibold border transition-all disabled:opacity-50 bg-white/75 backdrop-blur border-indigo-200/60 text-zinc-700 hover:border-indigo-300 hover:text-indigo-600`}
                          >
                            {shortcut}{selectedTopics.length > 0 ? ` + ${selectedTopics.join('·')}` : ''}
                          </button>
                        ))}
                      </div>
                      {/* 오른쪽: 주제 토글 버튼 (데스크탑 우측 정렬, 모바일 다음 행) */}
                      <div className="flex flex-wrap gap-2 md:ml-auto">
                        {["재물운", "건강운", "인간관계", "연애운"].map((topic) => {
                          const isActive = selectedTopics.includes(topic);
                          return (
                            <button
                              key={`topic-filter-${topic}`}
                              onClick={() => {
                                setSelectedTopics((prev) =>
                                  prev.includes(topic)
                                    ? prev.filter((t) => t !== topic)
                                    : [...prev, topic]
                                );
                              }}
                              disabled={loading}
                              className={`px-3 py-1.5 min-h-[40px] rounded-full text-[13px] font-semibold border transition-all disabled:opacity-50 ${
                                isActive
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-300/30'
                                  : 'bg-white/75 backdrop-blur border-indigo-200/60 text-zinc-600 hover:border-indigo-300 hover:text-indigo-600'
                              }`}
                            >
                              {isActive ? `✓ ${topic}` : topic}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="max-w-4xl mx-auto relative">
                      <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={consultationMode === 'basic' ? '음성 또는 직접 입력으로 질문해 주세요...' : '메시지를 입력하세요...'}
                        className={`w-full border rounded-2xl py-3 pl-4 pr-24 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm bg-white/75 backdrop-blur border-white/65 text-gray-900`}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleVoiceInput}
                            className={`p-2 min-h-[44px] min-w-[44px] rounded-xl shadow-lg active:scale-90 transition-transform ${isListening ? 'bg-rose-500 text-white' : 'bg-white/75 backdrop-blur border border-white/60 text-zinc-700'}`}
                            title="음성 입력"
                          >
                            <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                          </button>
                          <button onClick={() => handleSend()} className="p-2 min-h-[44px] min-w-[44px] bg-indigo-600 rounded-xl text-white shadow-lg active:scale-90 transition-transform">
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {voiceStatusMessage && (
                      <p className={`max-w-4xl mx-auto mt-1 text-[13px] text-rose-600`}>
                        {voiceStatusMessage}
                      </p>
                    )}

                    {/* Mobile-only Quick Actions & Privacy Notice */}
                    <div className="md:hidden mt-0.5 space-y-0.5">
                      {/* Privacy Notice (Mobile) */}
                      <div className="pt-1 border-t border-white/55">
                        <p className="text-[11px] text-zinc-500 text-center leading-tight">
                          상담 정보는 상담 종료 시 자동 파기됩니다.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </ChatTab>
          )}

          {activeTab === "report" && (
            <Suspense fallback={<div className="p-8 text-center text-[13px] text-zinc-500">리포트 탭을 불러오는 중...</div>}>
              <LazyReportTabContent
                tabTransition={TAB_TRANSITION}
                glassTabBgClass={GLASS_TAB_BG_CLASS}
                glassPanelStrongClass={GLASS_PANEL_STRONG_CLASS}
                loading={loading}
                sajuResultLength={sajuResult.length}
                reportContent={reportContent}
                isPrinting={isPrinting}
                userName={userData.name}
                consultationMode={consultationMode}
                consultationModeRef={consultationModeRef}
                setIsPrinting={setIsPrinting}
                setConsultationMode={setConsultationMode}
                setReportContent={setReportContent}
                handleGenerateReport={handleGenerateReport}
                onGoToOrder={() => { setOrderProductType('premium'); setActiveTab("order"); }}
                onGoToYearlyOrder={() => { setOrderProductType('yearly2026'); setActiveTab("order"); }}
                onGoToJobCareer={() => { setOrderProductType('jobCareer'); setActiveTab("order"); }}
                onGoToLoveMarriage={() => { setOrderProductType('loveMarriage'); setActiveTab("order"); }}
              />
            </Suspense>
          )}

          {activeTab === "guide" && (
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-[13px] text-zinc-500">가이드 화면 불러오는 중...</div>}>
              <LazyGuideTabContent
                tabTransition={TAB_TRANSITION}
                glassTabBgClass={GLASS_TAB_BG_CLASS}
                glassPanelClass={GLASS_PANEL_CLASS}
                glassPanelStrongClass={GLASS_PANEL_STRONG_CLASS}
                guideSubPage={guideSubPage}
                setGuideSubPage={setGuideSubPage}
                guideAboutContent={guideAboutContent}
                guideTermsContent={guideTermsContent}
                guidePrivacyContent={guidePrivacyContent}
                guideContactContent={guideContactContent}
              />
            </Suspense>
          )}

          {activeTab === "blog" && (
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-[13px] text-zinc-500">블로그 화면 불러오는 중...</div>}>
              <LazyBlogTab
                tabTransition={TAB_TRANSITION}
                glassTabBgClass={GLASS_TAB_BG_CLASS}
                glassPanelStrongClass={GLASS_PANEL_STRONG_CLASS}
                blog={blogTab}
                isAdmin={isAdmin}
                allowedAdminEmails={allowedAdminEmails}
                user={user}
                isLoggingIn={isLoggingIn}
                stripRichText={stripRichText}
                onLogin={handleLogin}
                onLogout={handleLogout}
              />
            </Suspense>
          )}

          {activeTab === "premium" && isAdmin && (
            <motion.div 
              key="premium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col overflow-hidden bg-white dark:bg-black"
            >
              <Suspense fallback={<div className="h-full flex items-center justify-center text-[13px] text-zinc-500">프리미엄 패널 불러오는 중...</div>}>
                <LazyPremiumOrdersPanel isDarkMode={isDarkMode} />
              </Suspense>
            </motion.div>
          )}

          {activeTab === "order" && (
            <motion.div
              key="order"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-slate-50 to-indigo-50/30"
            >
              <Suspense fallback={<div className="h-full flex items-center justify-center text-[13px] text-zinc-500">주문 폼 불러오는 중...</div>}>
                <LazyPremiumOrderForm
                  productType={orderProductType}
                  initialUserData={userData.name ? userData : undefined}
                />
              </Suspense>
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
            ...(isAdmin ? [{ id: "premium", icon: Gift, label: "프리미엄" }] : []),
            { id: "blog", icon: Newspaper, label: "블로그" },
            { id: "guide", icon: Info, label: "HELP" }
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
              <span className="text-[11px] font-title font-bold tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* 후기 작성 모달 */}
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        sourcePage={activeTab}
      />
      </div>
    </div>
  );
};

export default App;
