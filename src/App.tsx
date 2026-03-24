import React, { useState, useEffect, useRef, useMemo } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Send, 
  User, 
  Sparkles, 
  RefreshCw, 
  Moon, 
  Sun,
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
  ExternalLink,
  Ticket
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { jsPDF } from "jspdf";
import * as htmlToImage from "html-to-image";
import { getSajuData, getDaeunData, calculateYongshin, hanjaToHangul, elementMap, yinYangMap, calculateDeity, calculateGyeok } from "./utils/saju";
import { SUGGESTED_QUESTIONS, CATEGORIES } from "./constants/questions";
import { BLOG_POSTS, BlogPost } from "./constants/blog";
import { Newspaper, ArrowLeft, Plus, Trash2, Edit2, X, Save, ArrowRight } from "lucide-react";

import { SAJU_GUIDELINE, CONSULTING_GUIDELINE, REPORT_GUIDELINE } from "./constants/guidelines";
import { db, auth, googleProvider, signInWithPopup, signOut } from "./firebase";
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
    throw new Error("API 키가 설정되지 않았습니다. 관리자에게 문의하세요.");
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

const HanjaBox: React.FC<{ 
  hanja: string, 
  size?: 'sm' | 'md' | 'lg', 
  isDarkMode?: boolean,
  deity?: string,
  deityPosition?: 'top' | 'bottom'
}> = ({ hanja, size = 'md', isDarkMode = true, deity, deityPosition }) => {
  const element = elementMap[hanja];
  const isYang = yinYangMap[hanja] === '+';
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px] rounded',
    md: 'w-10 h-10 text-xl rounded-lg',
    lg: 'w-12 h-12 text-2xl rounded-xl'
  };

  const deityEl = deity ? (
    <span className={`text-[9px] font-title font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} absolute ${deityPosition === 'top' ? '-top-3.5' : '-bottom-3.5'} left-1/2 -translate-x-1/2 whitespace-nowrap`}>
      {deity}
    </span>
  ) : null;

  if (hanja === '?' || !element) {
    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div className={`${sizeClasses[size]} border-2 border-zinc-500/30 flex items-center justify-center opacity-30`}>
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  }

  // Metal Special Rules (庚, 申, 辛, 酉)
  if (element === 'metal') {
    const silverColor = isDarkMode ? 'bg-zinc-400 border-zinc-400' : 'bg-zinc-100 border-zinc-200';
    const whiteColor = isDarkMode ? 'bg-zinc-200 border-zinc-200' : 'bg-white border-zinc-100';
    
    if (isYang) {
      // Yang Metal: White background, Silver text
      return (
        <div className="relative">
          {deityPosition === 'top' && deityEl}
          <div className={`${sizeClasses[size]} ${whiteColor} ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'} border flex items-center justify-center font-bold`}>
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
          <div className={`${sizeClasses[size]} ${silverColor} ${isDarkMode ? 'text-white' : 'text-zinc-600'} border flex items-center justify-center font-bold`}>
            {hanja}
          </div>
          {deityPosition === 'bottom' && deityEl}
        </div>
      );
    }
  }

  const styles: Record<string, { bg: string, text: string, border: string, yinText: string }> = {
    wood: { 
      bg: isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500', 
      text: isDarkMode ? 'text-emerald-400' : 'text-emerald-600', 
      border: isDarkMode ? 'border-emerald-600/50' : 'border-emerald-500', 
      yinText: 'text-white' 
    },
    fire: { 
      bg: isDarkMode ? 'bg-rose-600' : 'bg-red-500', 
      text: isDarkMode ? 'text-rose-400' : 'text-red-600', 
      border: isDarkMode ? 'border-rose-600/50' : 'border-red-500', 
      yinText: 'text-white' 
    },
    earth: { 
      bg: isDarkMode ? 'bg-amber-500' : 'bg-amber-400', 
      text: isDarkMode ? 'text-amber-400' : 'text-amber-600', 
      border: isDarkMode ? 'border-amber-500/50' : 'border-amber-400', 
      yinText: isDarkMode ? 'text-zinc-900' : 'text-zinc-900' 
    },
    water: { 
      bg: isDarkMode ? 'bg-zinc-700' : 'bg-zinc-900', 
      text: isDarkMode ? 'text-zinc-300' : 'text-zinc-900', 
      border: isDarkMode ? 'border-zinc-700' : 'border-zinc-900', 
      yinText: 'text-white' 
    },
  };

  const style = styles[element];

  if (isYang) {
    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div className={`${sizeClasses[size]} bg-transparent border-2 ${style.border} ${style.text} flex items-center justify-center font-bold`}>
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  } else {
    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div className={`${sizeClasses[size]} ${style.bg} border-2 ${style.border} ${style.yinText} flex items-center justify-center font-bold`}>
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  }
};

const ReportAccordion: React.FC<{ content: string; isDarkMode: boolean; forceOpen?: boolean }> = ({ content, isDarkMode, forceOpen }) => {
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
      <div className="markdown-body prose dark:prose-invert max-w-none text-sm p-4">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {greeting && (
        <div className={`p-6 md:p-8 rounded-[2.5rem] ${
          isDarkMode 
            ? 'bg-indigo-950/60 text-indigo-50 border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.1)]' 
            : 'bg-indigo-50 text-indigo-950 border-indigo-100'
        } font-handwriting text-2xl md:text-3xl leading-relaxed mb-8 shadow-sm border`}>
          <ReactMarkdown>{greeting}</ReactMarkdown>
        </div>
      )}
      {sections.map((section, index) => {
        const isOpen = forceOpen || openIndex === index;
        return (
          <div 
            key={index} 
            className={`rounded-2xl border transition-all overflow-hidden ${
              isDarkMode ? 'bg-zinc-900/60 border-white/10' : 'bg-white border-black/5 shadow-sm'
            }`}
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-5 py-4 flex items-center justify-between text-left group"
            >
              <div className="flex-1 pr-4">
                <h3 className={`text-sm font-bold leading-tight transition-colors ${isDarkMode ? 'text-zinc-300 group-hover:text-indigo-400' : 'text-zinc-800 group-hover:text-indigo-600'}`}>
                  {section.header}
                </h3>
              </div>
              {!forceOpen && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isOpen ? 'bg-indigo-500 text-white rotate-180 shadow-lg shadow-indigo-500/20' : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400'
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
                  <div className={`px-5 pb-5 pt-0 text-sm leading-relaxed ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    <div className="w-full h-px bg-black/5 dark:bg-white/5 mb-4" />
                    <div className="markdown-body prose dark:prose-invert max-w-none">
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

const App: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<"welcome" | "dashboard" | "chat" | "report" | "guide" | "blog">("welcome");
  const [guideSubPage, setGuideSubPage] = useState<"main" | "privacy" | "terms" | "about" | "contact">("main");
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
  const [selectedCategory, setSelectedCategory] = useState<string>('재물/사업');
  const [blogCategory, setBlogCategory] = useState<string>('전체');
  const [refreshKey, setRefreshKey] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [guidelines, setGuidelines] = useState<Guidelines | null>({
    saju: SAJU_GUIDELINE,
    consulting: CONSULTING_GUIDELINE,
    report: REPORT_GUIDELINE
  });
  const [guidelinesError, setGuidelinesError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  
  // Weekly Recommended Content Logic
  const recommendedPosts = useMemo(() => {
    const allPosts = blogPosts.length > 0 ? blogPosts : BLOG_POSTS;
    if (allPosts.length === 0) return [];
    
    // Get current week number (0-52)
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    
    // Simple seeded random based on week and year
    const seed = now.getFullYear() * 100 + weekNumber;
    const seededRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    // Shuffle and pick 3
    const shuffled = [...allPosts].sort((a, b) => {
      const hashA = seededRandom(seed + a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      const hashB = seededRandom(seed + b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      return hashA - hashB;
    });

    return shuffled.slice(0, 3);
  }, [blogPosts]);

  const [isEditingPost, setIsEditingPost] = useState<BlogPost | null>(null);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const daeunScrollRef = useRef<HTMLDivElement>(null);

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
    imageUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/800/600`
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Handle Dark Mode Class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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

  const handleAddPost = async () => {
    console.log("[DEBUG] handleAddPost attempt. isAdmin:", isAdmin, "user:", user?.email);
    if (!isAdmin || !user) {
      alert("관리자 권한이 없거나 로그인이 필요합니다.");
      return;
    }
    try {
      const postData = {
        ...newPost,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        authorUid: user.uid
      };
      console.log("[DEBUG] Saving post data:", postData);
      await addDoc(collection(db, "blogPosts"), postData);
      console.log("[DEBUG] Post saved successfully.");
      setIsAddingPost(false);
      setNewPost({
        title: "",
        content: "",
        category: "사주기초",
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
        imageUrl: isEditingPost.imageUrl
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
      setActiveTab("dashboard");
      setShowInputForm(false);
      
      // Reset chat with context
      setMessages([
        { 
          role: "model", 
          text: `만세력에서 당신의 사주팔자를 확인하셨습니다. 이 상담창에 무엇이든 물어 보세요. 유아이 AI 전문상담자가 대답해 드립니다.` 
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
        backgroundColor: isDarkMode ? '#000000' : '#f9fafb',
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
      const currentYear = new Date().getFullYear();
      const birthYear = parseInt(userData.birthYear);
      const age = currentYear - birthYear + 1;
      
      let ageGroup = '10대';
      if (age >= 70) ageGroup = '70대↑';
      else if (age >= 60) ageGroup = '60대';
      else if (age >= 50) ageGroup = '50대';
      else if (age >= 40) ageGroup = '40대';
      else if (age >= 30) ageGroup = '30대';
      else if (age >= 20) ageGroup = '20대';
      else ageGroup = '10대';

      const genderKey = userData.gender === 'M' ? '남' : '여';
      console.log("[DEBUG] Questions:", { ageGroup, genderKey, selectedCategory });
      
      const groupData = SUGGESTED_QUESTIONS[ageGroup as keyof typeof SUGGESTED_QUESTIONS];
      
      if (groupData && groupData[genderKey as keyof typeof groupData]) {
        const categoryQuestions = groupData[genderKey as keyof typeof groupData][selectedCategory as keyof typeof groupData[keyof typeof groupData]];
        if (categoryQuestions) {
          // Shuffle and pick 3 questions
          const shuffled = [...categoryQuestions].sort(() => 0.5 - Math.random());
          setSuggestions(shuffled.slice(0, 3));
        } else {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    }
  }, [activeTab, selectedCategory, userData.birthYear, userData.gender, refreshKey]);

  const handleSend = async (overrideInput?: string) => {
    const userMessage = (overrideInput || input).trim();
    if (!userMessage || loading) return;

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
      const systemInstruction = `
[Role: UI Premium 1:1 Spiritual Counselor - MZ Edition]
당신은 '유아이(UI) 사주상담'의 전문 상담가입니다. 
당신의 상담 스타일은 **'MZ세대 감성'**입니다. 힙하고, 트렌디하며, 때로는 직설적이지만 따뜻한 공감을 잊지 않습니다.

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
- **MZ 말투:** "반말"은 지양하되, 세련되고 깔끔한 말투를 사용하세요. 적절한 이모지(✨, 🍀, 🔥 등)를 섞어주세요.
- **전문성:** 사주 명리학적 근거(음양오행, 십성 등)를 언급하되, 어려운 용어는 현대적인 비유로 풀어서 설명하세요.
- **맥락 유지:** 이전 대화 내용을 기억하고 연결해서 답변하세요.
${isFirstMessage 
  ? "- 첫 인사는 따뜻하고 힙하게! 마지막은 항상 사용자를 응원하며 다음 질문을 유도하세요."
  : "- **중요**: 두 번째 질문부터는 불필요한 인사말이나 반복적인 응원 문구를 생략하고 질문에 대한 핵심 답변만 간결하게 제공하세요."}

2. 법적/윤리적 가이드라인:
- 의료, 범죄, 도박, 생사, 구체적 주식/코인 추천 등 위험한 질문은 정중히 거절하세요.

[사용자 사주 정보]
${sajuContext}
[대운 정보]
${daeunContext}
`;

      const contents: any[] = messages.map(m => ({
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
        functionCalls = response.functionCalls;
      }

      const finalResponseText = response.text || "상담 중 오류가 발생했습니다.";
      setMessages(prev => [...prev, { role: "model", text: finalResponseText }]);
    } catch (err: any) {
      console.error("Chat error:", err);
      const errorMessage = err?.message || String(err);
      // UI에 직접 에러 메시지를 표시하도록 수정
      setMessages(prev => [...prev, { role: "model", text: `[상담 오류] ${errorMessage}` }]);
    } finally {
      setLoading(false);
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

      const systemInstruction = `당신은 깊이 있고 전문적인 조언을 제공하는 **'사주명리 상담가 유아이'**입니다. 
현재 날짜: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
제공된 사용자의 사주 데이터와 대운 정보를 **철저하게 분석한 결과에만 입각하여** 아래의 **[8대 카테고리]**에 맞춰 종합운세리포트를 작성하십시오. 

**[핵심 원칙: 정직과 예방]**
- '좋은 말'만 늘어놓는 리포트가 되어서는 안 됩니다. 사주 원국과 운의 흐름에서 보이는 **리스크, 취약점, 주의해야 할 시기**를 가감 없이 식별하십시오.
- 발견된 부정적인 요소는 사용자가 미리 준비하여 피해를 최소화하거나 예방할 수 있도록 **'전략적 조언'**의 관점에서 서술하십시오. (예: "이 시기에는 재물 손실의 기운이 강하니 무리한 투자는 피하고 내실을 기하는 것이 최고의 개운법입니다.")

[지침 사항]
${guidelines.report}

[출력 규칙 - 매우 중요]
1. **절대로 HTML 태그(<div>, <strong> 등)를 사용하지 마십시오.** 오직 마크다운 텍스트만 사용하십시오.
2. **카테고리 제목에 #, ##, ### 등 마크다운 헤더 기호를 사용하지 마십시오.**
3. 아래에 제공된 [Output Format] 구조를 한 글자도 틀리지 말고 정확히 지켜주십시오. 파싱 로직이 이 태그들에 의존합니다.
4. 모든 답변은 MZ세대의 감성을 담아 트렌디하고 친근하면서도 전문성을 잃지 않아야 합니다. (예: '갓생', '럭키비키', '오운완' 등의 표현을 적절히 섞어 쓰되 명리학적 깊이를 유지)

[Output Format]
[인사말]
(여기에 사용자에게 건네는 따뜻하고 힙한 첫인사를 작성하세요. MZ세대 감성 필수.)

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
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: "나의 사주 정보와 대운 흐름을 바탕으로 MZ세대 감성의 '유아이(UI) 리포트'를 작성해줘. 반드시 정해진 [SECTION] 형식을 지켜야 해." }] }],
        config: { 
          systemInstruction,
          maxOutputTokens: 4096,
          temperature: 0.8
        }
      });
      
      console.log("[DEBUG] Gemini response received.");
      const text = result.text || "리포트 생성 실패";
      console.log("[DEBUG] Gemini response text length:", text.length);
      console.log("[DEBUG] Gemini response text preview:", text.substring(0, 200));
      setReportContent(text);
    } catch (err: any) {
      console.error("[ERROR] Report generation failed:", err);
      const errorMessage = err?.message || String(err);
      setReportContent(`리포트 생성 중 오류가 발생했습니다: ${errorMessage}. 잠시 후 다시 시도해 주세요.`);
    } finally {
      setLoading(false);
    }
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

  const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#94a3b8', '#6366f1'];

  // Render Main App
  return (
    <div className={`h-dvh ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-200'} flex items-center justify-center p-0 md:p-4 overflow-hidden`}>
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

      <div className={`w-full h-full md:h-screen ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8f9fa] text-[#1a1a1a]'} overflow-hidden shadow-2xl relative flex flex-col transition-all duration-300 font-sans`}>
        {/* Navigation Header */}
        <header className={`px-4 py-3 md:px-10 md:py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-white/10 bg-black/80' : 'border-black/5 bg-white/80'} backdrop-blur-xl z-30 sticky top-0 safe-top`}>
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
              { id: "chat", icon: MessageCircle, label: "상담" },
              { id: "report", icon: FileText, label: "리포트" },
              { id: "blog", icon: Newspaper, label: "블로그" },
              { id: "guide", icon: Info, label: "가이드" }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100'}`}
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
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 md:px-4 md:py-2 rounded-full md:rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all flex items-center gap-2">
              {isDarkMode ? <Sun className="w-5 h-5 opacity-70" /> : <Moon className="w-5 h-5 opacity-70" />}
              <span className="hidden md:block text-sm font-bold">{isDarkMode ? '라이트' : '다크'}</span>
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
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-bold tracking-widest uppercase mb-2"
                      >
                        Premium AI Saju Consulting
                      </motion.div>
                      <h2 className={`text-4xl md:text-6xl font-serif font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>
                        당신의 운명을 읽는<br/>
                        <span className="text-indigo-500">가장 명료한 시선</span>
                      </h2>
                      <p className={`text-sm md:text-lg max-w-2xl mx-auto opacity-60 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        수천 년의 지혜와 첨단 AI 기술이 만나 당신의 삶에 가장 정밀한 전략을 제시합니다.
                      </p>
                    </div>

                    {/* Navigation Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <button 
                        onClick={() => setShowInputForm(true)}
                        className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-indigo-600/10 border-indigo-500/30 hover:bg-indigo-600/20' : 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100 shadow-xl shadow-indigo-500/10'}`}
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
                        className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900' : 'bg-white border-indigo-50 hover:bg-zinc-50 shadow-xl shadow-zinc-200/50'}`}
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
                        className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900' : 'bg-white border-indigo-50 hover:bg-zinc-50 shadow-xl shadow-zinc-200/50'}`}
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

                    {/* Content Cards Section */}
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold">추천 컨텐츠</h3>
                        <button onClick={() => setActiveTab("blog")} className="text-sm font-bold text-indigo-500 hover:underline">전체보기</button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recommendedPosts.map((post, idx) => (
                          <div 
                            key={post.id}
                            onClick={() => {
                              setSelectedBlogPost(post);
                              setActiveTab("blog");
                            }}
                            className={`group cursor-pointer rounded-[2rem] overflow-hidden border transition-all hover:shadow-2xl ${isDarkMode ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-indigo-50 shadow-lg shadow-zinc-200/40'}`}
                          >
                            <div className="aspect-video overflow-hidden relative">
                              <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                              <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-widest ${idx === 0 ? 'bg-indigo-600' : idx === 1 ? 'bg-rose-500' : 'bg-amber-500'}`}>
                                {idx === 0 ? 'Latest' : idx === 1 ? 'Popular' : 'Pick'}
                              </div>
                            </div>
                            <div className="p-6 space-y-2">
                              <h4 className="font-bold line-clamp-1 text-zinc-900 dark:text-zinc-100">{post.title}</h4>
                              <p className="text-xs opacity-60 line-clamp-2 text-zinc-600 dark:text-zinc-400">{post.excerpt || post.content.replace(/[#*`]/g, '').slice(0, 80)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Feature Highlight Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-indigo-50 shadow-2xl shadow-indigo-500/5'} space-y-6`}>
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

                      <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-indigo-50 shadow-2xl shadow-indigo-500/5'} space-y-6`}>
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
                          className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900' : 'bg-white border-black/5 hover:bg-zinc-50 shadow-xl shadow-black/5'}`}
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
                          className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900' : 'bg-white border-black/5 hover:bg-zinc-50 shadow-xl shadow-black/5'}`}
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

                    {/* Final CTA Card */}
                    <motion.div 
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setShowInputForm(true)}
                      className="cursor-pointer p-10 md:p-16 rounded-[4rem] bg-gradient-to-br from-indigo-600 to-violet-700 text-white text-center space-y-8 shadow-2xl shadow-indigo-500/30 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-110 transition-transform" />
                      <div className="relative z-10 space-y-4">
                        <Sparkles className="w-12 h-12 mx-auto text-indigo-200 animate-pulse" />
                        <h3 className="text-3xl md:text-5xl font-serif font-bold">운세 분석을 위한 정보 입력</h3>
                        <p className="text-lg text-indigo-100 opacity-80">단 1분이면 당신의 인생 설계도를 확인할 수 있습니다.</p>
                        <div className="pt-4">
                          <span className="inline-flex items-center gap-3 px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xl shadow-xl">
                            지금 바로 시작하기
                            <ArrowRight className="w-6 h-6" />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  <div className="max-w-md mx-auto space-y-6 pb-20">
                    <button 
                      onClick={() => setShowInputForm(false)}
                      className={`flex items-center gap-2 text-sm font-bold mb-4 ${isDarkMode ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'} transition-colors`}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      랜딩페이지로 돌아가기
                    </button>
                    <div className="text-center space-y-2 py-4">
                      <h2 className={`text-3xl md:text-4xl font-handwriting leading-tight ${isDarkMode ? 'text-indigo-400' : 'text-cobalt'}`}>안녕하세요.<br/>유아이 사주상담입니다.</h2>
                      <p className={`text-xs md:text-sm leading-relaxed px-4 ${isDarkMode ? 'text-zinc-400' : 'opacity-60'}`}>
                        정보를 입력하여<br/>당신의 삶을 분석해 보세요.
                      </p>
                    </div>

                    <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-zinc-900/50 border-white/10' : 'bg-white border-indigo-100 shadow-xl'} space-y-6`}>
                      <div className={`flex items-center gap-3 p-4 rounded-2xl transition-all border ${isAgreed ? (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200') : (isDarkMode ? 'bg-zinc-800/50 border-white/5' : 'bg-zinc-50 border-zinc-200')}`}>
                        <input 
                          type="checkbox" 
                          id="privacyAgree"
                          checked={isAgreed}
                          onChange={(e) => setIsAgreed(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="privacyAgree" className={`text-sm font-bold cursor-pointer transition-colors ${isAgreed ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-900') : (isDarkMode ? 'text-zinc-500' : 'text-zinc-400')}`}>
                          개인정보 이용에 동의합니다
                        </label>
                      </div>

                      <div className={`space-y-6 transition-all ${!isAgreed ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>
                        <div className="space-y-1">
                          <label className={`text-[11px] font-bold uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>사용자 이름</label>
                          <input 
                            type="text" 
                            placeholder="이름을 입력하세요"
                            value={userData.name}
                            disabled={!isAgreed}
                            onChange={(e) => setUserData({...userData, name: e.target.value})}
                            className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-base ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-indigo-100'}`}
                          />
                        </div>

                        {/* Dropdown Inputs */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className={`text-[11px] font-bold ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>년도</label>
                              <select 
                                value={userData.birthYear}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({...userData, birthYear: e.target.value})}
                                className={`w-full px-2 py-2 rounded-xl border text-sm outline-none ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-indigo-100'}`}
                              >
                                {Array.from({length: 100}, (_, i) => 2026 - i).map(y => (
                                  <option key={y} value={y} className="dark:bg-zinc-900">{y}년</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className={`text-[11px] font-bold ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>월</label>
                              <select 
                                value={userData.birthMonth}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({...userData, birthMonth: e.target.value})}
                                className={`w-full px-2 py-2 rounded-xl border text-sm outline-none ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-indigo-100'}`}
                              >
                                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                  <option key={m} value={m} className="dark:bg-zinc-900">{m}월</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className={`text-[11px] font-bold ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>일</label>
                              <select 
                                value={userData.birthDay}
                                disabled={!isAgreed}
                                onChange={(e) => setUserData({...userData, birthDay: e.target.value})}
                                className={`w-full px-2 py-2 rounded-xl border text-sm outline-none ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-indigo-100'}`}
                              >
                                {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                  <option key={d} value={d} className="dark:bg-zinc-900">{d}일</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {!userData.unknownTime && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className={`text-[11px] font-bold ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>시</label>
                                <select 
                                  value={userData.birthHour}
                                  disabled={!isAgreed}
                                  onChange={(e) => setUserData({...userData, birthHour: e.target.value})}
                                  className={`w-full px-2 py-2 rounded-xl border text-sm outline-none ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-indigo-100'}`}
                                >
                                  {Array.from({length: 24}, (_, i) => i).map(h => (
                                    <option key={h} value={h} className="dark:bg-zinc-900">{h}시</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className={`text-[11px] font-bold ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>분</label>
                                <select 
                                  value={userData.birthMinute}
                                  disabled={!isAgreed}
                                  onChange={(e) => setUserData({...userData, birthMinute: e.target.value})}
                                  className={`w-full px-2 py-2 rounded-xl border text-sm outline-none ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-indigo-100'}`}
                                >
                                  {Array.from({length: 60}, (_, i) => i).map(m => (
                                    <option key={m} value={m} className="dark:bg-zinc-900">{m}분</option>
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
                            <label htmlFor="unknownTime" className={`text-sm font-medium ${isDarkMode ? 'text-zinc-400' : 'opacity-70'}`}>생시를 몰라요</label>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className={`flex items-center justify-between p-2 rounded-2xl ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-zinc-50 border-indigo-100'} border`}>
                            <div className={`flex items-center gap-1.5 p-1 rounded-xl w-full`}>
                              <button 
                                onClick={() => setUserData({...userData, calendarType: 'solar'})}
                                disabled={!isAgreed}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.calendarType === 'solar' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}
                              >
                                양력
                              </button>
                              <button 
                                onClick={() => setUserData({...userData, calendarType: 'lunar'})}
                                disabled={!isAgreed}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.calendarType === 'lunar' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}
                              >
                                음력(평)
                              </button>
                              <button 
                                onClick={() => setUserData({...userData, calendarType: 'leap'})}
                                disabled={!isAgreed}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.calendarType === 'leap' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}
                              >
                                음력(윤)
                              </button>
                            </div>
                          </div>

                          <div className={`flex items-center justify-between p-2 rounded-2xl ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-zinc-50 border-indigo-100'} border`}>
                            <div className={`flex items-center gap-1.5 p-1 rounded-xl w-full`}>
                              <button onClick={() => setUserData({...userData, gender: 'M'})} disabled={!isAgreed} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.gender === 'M' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>남자</button>
                              <button onClick={() => setUserData({...userData, gender: 'F'})} disabled={!isAgreed} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userData.gender === 'F' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>여자</button>
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
                    
                    <p className={`text-center text-xs tracking-tight pb-2 ${isDarkMode ? 'text-zinc-600' : 'opacity-30'}`}>정확한 분석을 위해 태어난 시간을 꼭 확인해 주세요.</p>
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
                    <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'opacity-60'}`}>사주팔자 (四柱八字)</h3>
                    <div className="grid grid-cols-4 gap-3 md:gap-4">
                      {sajuResult.map((p, i) => {
                        if (userData.unknownTime && p.title === '시주') return null;
                        return (
                          <div key={i} className={`p-3 md:p-5 rounded-3xl border ${isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5 shadow-md'} flex flex-col items-center gap-2 transition-transform hover:scale-[1.02]`}>
                            <span className={`text-[10px] md:text-xs font-bold ${isDarkMode ? 'text-zinc-500' : 'opacity-50'}`}>{p.title}</span>
                            <div className="flex flex-col gap-4 py-2">
                              {[p.stem, p.branch].map((item, j) => (
                                <HanjaBox 
                                  key={j} 
                                  hanja={item.hanja} 
                                  isDarkMode={isDarkMode} 
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
                  <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-xl ${
                    isDarkMode 
                      ? 'bg-indigo-500/5 border-indigo-500/20' 
                      : 'bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border-indigo-500/20'
                  }`}>
                    <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-xl shadow-indigo-500/20">
                        <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="space-y-2">
                          <p className="text-[10px] md:text-xs font-bold text-indigo-500 uppercase tracking-[0.2em]">사주팔자 분석 결론</p>
                          <h4 className={`text-base md:text-xl font-bold leading-tight ${isDarkMode ? 'text-zinc-200' : 'text-zinc-900'}`}>
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
                    <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'opacity-60'}`}>오행분포 (五行分布)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-zinc-200 shadow-lg'} flex flex-col justify-center`}>
                        <p className={`text-sm md:text-base leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600 font-medium'}`}>
                          {userData.name}님의 오행 분포는 <br className="hidden md:block"/>
                          {getChartData().map(d => `${d.name} ${d.value}개`).join(', ')}으로 구성되어 있습니다.
                        </p>
                      </div>
                      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5 shadow-lg'} flex items-center justify-center`}>
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
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/5 text-xs font-bold">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                          <span className={isDarkMode ? 'text-zinc-400' : 'text-zinc-700'}>{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8 md:space-y-12">
                  {/* Jiji and Jijangan */}
                  <div className="space-y-4">
                    <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'opacity-60'}`}>지지와 지장간 (地支/地藏干)</h3>
                    <div className="grid grid-cols-4 gap-3 md:gap-4">
                      {sajuResult.map((p, i) => {
                        if (userData.unknownTime && p.title === '시주') return null;
                        const dayStem = sajuResult.find(p => p.title === '일주')?.stem.hanja || '';
                        
                        return (
                          <div key={i} className={`p-3 md:p-5 rounded-3xl border ${isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5 shadow-md'} flex flex-col items-center gap-2 transition-transform hover:scale-[1.02]`}>
                            <div className="py-2">
                              <HanjaBox 
                                hanja={p.branch.hanja} 
                                isDarkMode={isDarkMode} 
                                deity={p.branch.deity}
                                deityPosition="bottom"
                                size="md"
                              />
                            </div>
                            <span className={`text-[10px] md:text-xs font-bold mt-2 ${isDarkMode ? 'text-zinc-500' : 'opacity-70'}`}>{p.branch.hangul}({p.branch.hanja})</span>
                            <div className="flex gap-1 mt-4 pb-2">
                              {p.branch.hidden.split(', ').map((h, k) => {
                                const hanja = Object.keys(hanjaToHangul).find(key => hanjaToHangul[key] === h) || '';
                                const deity = calculateDeity(dayStem, hanja);
                                return (
                                  <HanjaBox 
                                    key={k} 
                                    hanja={hanja} 
                                    size="sm" 
                                    isDarkMode={isDarkMode} 
                                    deity={deity}
                                    deityPosition="bottom"
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className={`text-xs md:text-sm leading-relaxed mt-4 italic ${isDarkMode ? 'text-zinc-500' : 'opacity-60'}`}>
                      지지와 지장간은 사주의 뿌리이자 에너지가 저장된 곳입니다. 지장간은 지지 속에 숨겨진 천간의 기운으로, 당신의 내면적인 성향과 잠재력을 나타냅니다.
                    </p>
                  </div>

                  {/* Daeun Analysis */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'opacity-60'}`}>대운분석 (大運分析)</h3>
                      {daeunResult.length > 0 && (
                        <span className="text-[10px] md:text-xs font-bold text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full">
                          {daeunResult[0].startAge}대운
                        </span>
                      )}
                    </div>
                    
                    <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5 shadow-lg'}`}>
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
                                : isDarkMode ? 'border-transparent bg-white/5 opacity-40 hover:opacity-100' : 'border-transparent bg-black/5 opacity-40 hover:opacity-100'
                            }`}>
                              <div className={`text-[10px] md:text-xs font-bold ${isDarkMode && isCurrentDaeun ? 'text-indigo-300' : ''}`}>{dy.startAge}세</div>
                              <div className="flex flex-col gap-4 py-2">
                                {daeunResult.length > 0 && [dy.stem, dy.branch].map((hanja, j) => {
                                  const dayStem = sajuResult.find(p => p.title === '일주')?.stem.hanja || '';
                                  const deity = calculateDeity(dayStem, hanja);
                                  return (
                                    <HanjaBox 
                                      key={j} 
                                      hanja={hanja} 
                                      isDarkMode={isDarkMode} 
                                      deity={deity}
                                      deityPosition={j === 0 ? 'top' : 'bottom'}
                                      size="md"
                                    />
                                  );
                                })}
                              </div>
                              <div className={`text-[10px] md:text-xs font-bold opacity-70 ${isDarkMode && isCurrentDaeun ? 'text-indigo-300/70' : ''}`}>{hanjaToHangul[dy.stem]}{hanjaToHangul[dy.branch]}</div>
                              {isCurrentDaeun && isTransitioning && (
                                <div className="mt-1 px-2 py-0.5 bg-rose-500/20 text-rose-500 text-[8px] md:text-[10px] font-bold rounded-full animate-pulse">
                                  교운기
                                </div>
                              )}
                            </div>
                          );
                        }) : (
                          <div className={`text-sm py-8 w-full text-center ${isDarkMode ? 'text-zinc-600' : 'opacity-40'}`}>분석을 시작하면 대운이 표시됩니다.</div>
                        )}
                      </div>
                    </div>

                    {/* Current Daeun Description */}
                    {daeunResult.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'} shadow-sm`}
                      >
                        {daeunResult.map((dy, i) => {
                          const currentAge = 2026 - parseInt(userData.birthYear) + 1;
                          const isCurrentDaeun = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
                          if (!isCurrentDaeun) return null;
                          
                          return (
                            <div key={i} className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-6 bg-indigo-500 rounded-full" />
                                <h4 className={`text-sm md:text-base font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>현재 대운: {dy.startAge}세 {hanjaToHangul[dy.stem]}{hanjaToHangul[dy.branch]}대운</h4>
                              </div>
                              <p className={`text-xs md:text-sm leading-relaxed italic font-medium ${isDarkMode ? 'text-zinc-300' : 'opacity-80'}`}>
                                "{dy.description}"
                              </p>
                              {Math.abs(currentAge - dy.startAge) <= 1 && (
                                <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200'}`}>
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
                    <h3 className={`text-sm md:text-base font-title font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'opacity-60'}`}>용신(用神) 정밀 분석</h3>
                    {yongshinResult && (
                      <div className={`p-6 md:p-8 rounded-[2.5rem] border ${isDarkMode ? 'bg-zinc-900/40 border-white/5 shadow-2xl shadow-black/50' : 'bg-white border-black/5 shadow-2xl'} space-y-6 md:space-y-8`}>
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <p className={`text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] ${isDarkMode ? 'text-zinc-500' : 'opacity-40'}`}>핵심 에너지</p>
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
                          <div className={`p-4 md:p-6 rounded-3xl ${isDarkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                            <p className="text-[10px] md:text-xs font-bold opacity-40 mb-2 uppercase tracking-wider">일간 강약 (억부)</p>
                            <p className="text-sm md:text-lg font-bold">{yongshinResult.strength} ({yongshinResult.score}점)</p>
                            <p className="text-[11px] md:text-sm text-indigo-500 mt-2 font-bold">억부용신: {yongshinResult.eokbuYongshin}</p>
                          </div>
                          <div className={`p-4 md:p-6 rounded-3xl ${isDarkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
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

                        <div className="space-y-4 pt-6 border-t border-black/5 dark:border-white/10">
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
                  <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center ${isDarkMode ? 'bg-zinc-800' : 'bg-white shadow-xl'}`}>
                    <LayoutDashboard className={`w-12 h-12 ${isDarkMode ? 'text-zinc-600' : 'text-zinc-300'}`} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold">사주 데이터가 없습니다</h3>
                    <p className={`max-w-md mx-auto ${isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>
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
                  className={`cursor-pointer p-8 rounded-[3rem] border transition-all ${
                    isDarkMode 
                      ? 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/50' 
                      : 'bg-white border-black/5 shadow-xl hover:shadow-2xl'
                  } space-y-6 group`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="text-violet-500 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">AI와 더 깊은 대화 나누기</h3>
                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'opacity-60'}`}>
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
                  className={`cursor-pointer p-8 rounded-[3rem] border transition-all ${
                    isDarkMode 
                      ? 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/50' 
                      : 'bg-white border-black/5 shadow-xl hover:shadow-2xl'
                  } space-y-6 group`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="text-indigo-500 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">프리미엄 운세 리포트</h3>
                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'opacity-60'}`}>
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
              <div className="max-w-3xl mx-auto p-6 rounded-3xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 mt-12">
                <p className="text-[10px] md:text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed text-center font-medium">
                  본 분석 결과는 인공지능의 해석이며, 과학적 사실이 아닌 참고 용도로만 사용해 주세요. 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
                </p>
              </div>

              {/* External Manse-ryeok Calendar Link */}
              <div className="max-w-3xl mx-auto flex justify-center mt-8 mb-20">
                <a 
                  href="https://k-manseryeok.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg ${
                    isDarkMode 
                      ? 'bg-zinc-800 text-white border border-white/10 hover:bg-zinc-700' 
                      : 'bg-white text-zinc-900 border border-black/5 hover:bg-zinc-50'
                  }`}
                >
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  만세력 으로 표시한 달력
                  <ExternalLink className="w-4 h-4 opacity-40" />
                </a>
              </div>
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col overflow-hidden bg-white dark:bg-black"
            >
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full">
                {/* Desktop Sidebar for Suggestions */}
                <aside className="hidden md:flex w-64 flex-col border-r border-black/5 dark:border-white/10 p-4 space-y-6 overflow-y-auto relative">
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 dark:opacity-60 px-2">상담 카테고리</h4>
                    <div className="flex flex-col gap-1">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-left px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
                            selectedCategory === cat
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                              : 'hover:bg-indigo-500/10 text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 dark:opacity-60">추천 질문</h4>
                      <button 
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        className="p-1 hover:bg-indigo-500/10 rounded-lg text-indigo-500 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(s)}
                          className="text-left p-3 rounded-2xl border border-black/5 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/80 text-[13px] text-zinc-600 dark:text-zinc-300 hover:border-indigo-500/50 hover:text-indigo-500 transition-all leading-relaxed"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Consultation Tips */}
                  <div className="space-y-3 pt-4 border-t border-black/5 dark:border-white/5">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 dark:opacity-60 px-2">상담 팁</h4>
                    <ul className="space-y-2 px-2">
                      <li className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>생년월일시나 MBTI 같은 정보를 먼저 주세요. 상담이 더욱 풍성해 집니다.</span>
                      </li>
                      <li className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>구체적으로 질문하면 더욱 상담이 정교해 집니다.</span>
                      </li>
                      <li className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed flex gap-2">
                        <span className="text-indigo-500 shrink-0">•</span>
                        <span>상대방의 생년월일시를 알려주시면 정확한 궁합 분석이 가능합니다.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Privacy Notice (Desktop) */}
                  <div className="mt-auto pt-6">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
                      상담에 사용된 개인정보 등 모든 정보는 상담이 끝나면 자동으로 파기 됩니다. 마음 편하게 상담해 주세요.
                    </p>
                  </div>
                </aside>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-5 hide-scrollbar">
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                        <MessageCircle className="w-14 h-14" />
                        <p className="text-lg">궁금한 점을 물어보세요.<br/>당신의 사주를 기반으로 답변해 드립니다.</p>
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] md:max-w-[75%] p-4 md:p-5 rounded-2xl text-base md:text-lg leading-relaxed shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : isDarkMode 
                              ? 'bg-zinc-800 border border-white/20 text-gray-100 rounded-tl-none shadow-lg'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                        }`}>
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full w-fit border ${
                        isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'
                      }`}>
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                        <span className={`text-sm ${isDarkMode ? 'opacity-50' : 'text-gray-500'}`}>유아이가 분석 중입니다...</span>
                      </div>
                    )}
                  </div>

                  {/* Input Area */}
                  <div className={`p-2 border-t md:pb-4 ${
                    isDarkMode ? 'border-white/10 bg-black/40' : 'border-gray-200 bg-white/80'
                  }`}>
                    <div className="max-w-4xl mx-auto relative">
                      <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="메시지를 입력하세요..."
                        className={`w-full border rounded-2xl py-3 pl-4 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <button onClick={() => handleSend()} className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg active:scale-90 transition-transform">
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile-only Quick Actions & Privacy Notice */}
                    <div className="md:hidden mt-0.5 space-y-0.5">
                      <div className="grid grid-cols-[1fr_2.5fr] gap-1">
                        {/* Left: Categories */}
                        <div className="flex flex-col gap-1">
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              className={`w-full px-1 py-1 rounded-lg text-[12px] font-bold transition-all border text-center ${
                                selectedCategory === cat
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                  : isDarkMode
                                    ? 'bg-white/5 border-white/10 text-zinc-300'
                                    : 'bg-white border-gray-200 text-gray-500'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                        {/* Right: Suggestions */}
                        <div className="flex flex-col items-end gap-1">
                          {suggestions.slice(0, 3).map((s, i) => (
                            <button
                              key={i}
                              onClick={() => handleSuggestionClick(s)}
                              className={`w-fit text-right px-2 py-1 rounded-lg border text-[12px] leading-tight transition-all flex items-center min-h-[28px] ${
                                isDarkMode 
                                  ? 'bg-white/5 border-white/10 text-zinc-200'
                                  : 'bg-white border-gray-200 text-gray-700 shadow-sm'
                              }`}
                            >
                              <span className="line-clamp-2">{s}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Privacy Notice (Mobile) */}
                      <div className="pt-1 border-t border-black/5 dark:border-white/5">
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-tight">
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
              className="flex-1 overflow-y-auto p-4 md:p-10 hide-scrollbar bg-white dark:bg-black"
            >
              <div className="max-w-6xl mx-auto pb-20">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Desktop Sidebar Actions */}
                  <div className="md:w-64 space-y-4 md:sticky md:top-0 h-fit">
                    <div className="p-6 rounded-3xl bg-indigo-600 text-white space-y-4 shadow-xl shadow-indigo-500/20">
                      <h3 className="font-bold text-lg">운명 리포트</h3>
                      <p className="text-xs opacity-80 leading-relaxed">AI 디렉터가 분석한 당신의 인생 지도를 확인하고 저장하세요.</p>
                      <button 
                        onClick={handleGenerateReport}
                        disabled={loading || sajuResult.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                      >
                        <Compass className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        리포트 생성하기
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={handleDownloadPDF}
                        disabled={loading || isPrinting || !reportContent}
                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all shadow-sm disabled:opacity-50"
                      >
                        <Download className={`w-5 h-5 ${isPrinting ? 'animate-bounce' : ''}`} />
                        <span className="text-[10px] font-bold">PDF 저장</span>
                      </button>
                      <button 
                        onClick={() => alert("이메일 전송 기능은 준비 중입니다.")}
                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all shadow-sm"
                      >
                        <Mail className="w-5 h-5" />
                        <span className="text-[10px] font-bold">이메일</span>
                      </button>
                    </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1">
                    <AnimatePresence mode="wait">
                      {loading ? (
                        <motion.div 
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center py-32 space-y-6 bg-zinc-50 dark:bg-zinc-900/30 rounded-[3rem]"
                        >
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                            <Compass className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          </div>
                          <div className="text-center space-y-2">
                            <p className="text-lg font-bold animate-pulse">운명의 지도를 그리는 중...</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">AI 디렉터가 당신의 사주 로그를 정밀 분석하고 있습니다.</p>
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
                          <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-8 md:p-12 shadow-xl border border-black/5 dark:border-white/5">
                            <ReportAccordion content={reportContent} isDarkMode={isDarkMode} forceOpen={isPrinting} />
                          </div>
                          
                          <div className="mt-10 pt-6 border-t border-black/5 dark:border-white/5">
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed text-center">
                              본 리포트는 인공지능의 명리학적 해석이며, 과학적 사실이 아닙니다. 참고 용도로만 사용해 주시기 바라며, 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
                            </p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center py-32 space-y-8 bg-zinc-50 dark:bg-zinc-900/30 rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800"
                        >
                          <div className="w-24 h-24 rounded-full bg-indigo-500/5 flex items-center justify-center mx-auto border border-indigo-500/10">
                            <FileText className="w-10 h-10 text-indigo-500/30" />
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-2xl font-title font-bold">운세 리포트가 아직 없습니다.</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                              왼쪽의 <strong>'리포트 생성하기'</strong> 버튼을 눌러보세요.<br/>
                              AI 디렉터가 당신의 사주 데이터를 기반으로 힙한 MZ 감성 리포트를 생성해 드립니다.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "guide" && (
            <motion.div 
              key="guide"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 hide-scrollbar bg-white dark:bg-black"
            >
              <div className="max-w-6xl mx-auto space-y-12 pb-20">
                {/* Guide Sub-navigation */}
                {guideSubPage !== "main" && (
                  <button 
                    onClick={() => setGuideSubPage("main")}
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-8 hover:underline transition-all group"
                  >
                    <div className="p-2 rounded-full bg-indigo-50 dark:bg-indigo-950/30 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </div>
                    가이드 메인으로 돌아가기
                  </button>
                )}

                {guideSubPage === "main" ? (
                  <>
                    {/* CEO 인사말 카드 */}
                    <div className="bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden shadow-2xl border border-black/5 dark:border-white/5 flex flex-col md:flex-row">
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
                        <div className="space-y-6 text-base md:text-lg leading-relaxed font-serif text-zinc-700 dark:text-zinc-300">
                          <p className="font-bold text-zinc-900 dark:text-white text-xl">안녕하세요. 삶의 소중한 길목에서 유아이를 찾아주신 귀하께 깊은 감사의 인사를 전합니다.</p>
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
                        <div className="pt-8 border-t border-black/5 dark:border-white/5 text-right">
                          <p className="text-sm font-serif opacity-60 italic">유아이사주상담 디렉터 배상</p>
                        </div>
                      </div>
                    </div>

                    {/* 정보 그리드 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* 카드 1: 유아이 앱의 장점 */}
                      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden shadow-xl border border-black/5 dark:border-white/5 flex flex-col">
                        <div className="bg-[#0047AB] dark:bg-indigo-900/80 p-10 text-center">
                          <h2 className="text-white text-3xl font-handwriting leading-tight">
                            유아이 앱이 다른 앱보다<br/>좋은 세가지 이유
                          </h2>
                        </div>
                        <div className="p-10 space-y-10">
                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                              <div className="relative">
                                <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400 opacity-40" />
                                <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 absolute -bottom-1 -right-1" />
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-rose-500 rotate-45 origin-center translate-y-4"></div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">철저한 프라이버시 보호</p>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                사용자의 개인정보와 프라이버시를 철저히 보호합니다. 분석과 상담을 위해 사용자가 제공한 개인정보와 프라이버시는 서버에 저장되지 않습니다.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                              <Zap className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">정밀한 사주 데이터 학습</p>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                AI 모델에 만세력에서 추출한 정밀한 사주데이타를 학습시켜 확실한 사주 감명이 되도록 시스템을 만들었습니다.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                              <div className="relative">
                                <Bot className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 absolute -top-1 -right-1" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">맞춤형 인생 가이드 제공</p>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                사용자의 고유한 상황을 고려해서 실질적인 인생의 가이드가 되도록 맞춤 상담을 제공합니다.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 카드 2: 정보 입력 방법 */}
                      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden shadow-xl border border-black/5 dark:border-white/5 flex flex-col">
                        <div className="bg-[#0047AB] dark:bg-indigo-900/80 p-10 text-center">
                          <h2 className="text-white text-3xl font-handwriting leading-tight">
                            사용자 정보 입력 방법
                          </h2>
                        </div>
                        <div className="p-10 space-y-10">
                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center shrink-0">
                              <Clock className="w-8 h-8 text-indigo-500" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">생시 미입력 가능</p>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">모르면 비워두세요. 6개의 글자로도 충분합니다.</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center shrink-0">
                              <Calendar className="w-8 h-8 text-indigo-500" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">양력/음력 자동 인식</p>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">별도 선택이 없으면 기본 양력으로 분석합니다.</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                              <Zap className="w-8 h-8 text-white fill-white" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">분석 시작</p>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">버튼을 누르면 당신의 운세 분석이 시작됩니다.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 카드 3: 운세 철학 */}
                      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden shadow-xl border border-black/5 dark:border-white/5 flex flex-col md:col-span-2">
                        <div className="bg-[#0047AB] dark:bg-indigo-900/80 p-10 text-center">
                          <h2 className="text-white text-3xl font-handwriting leading-tight">
                            유아이의 운세분석 과정과<br/>운세에 대한 철학
                          </h2>
                        </div>
                        <div className="p-10 flex flex-col md:flex-row items-center justify-around gap-12">
                          {/* 분석 프로세스 */}
                          <div className="flex flex-col items-center space-y-6">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-black/5 dark:border-white/5">
                                <User className="w-8 h-8 text-zinc-400" />
                              </div>
                              <div className="w-12 h-px bg-zinc-200 dark:bg-zinc-700 border-t border-dashed"></div>
                              <div className="w-24 h-24 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Cpu className="w-12 h-12 text-white animate-pulse" />
                              </div>
                              <div className="w-12 h-px bg-zinc-200 dark:bg-zinc-700 border-t border-dashed"></div>
                              <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-black/5 dark:border-white/5">
                                <FileText className="w-8 h-8 text-indigo-500" />
                              </div>
                            </div>
                            <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest">분석 프로세스</p>
                          </div>

                          <div className="hidden md:block w-px h-40 bg-zinc-100 dark:bg-zinc-800"></div>

                          {/* 운세 철학 */}
                          <div className="flex flex-col items-center text-center space-y-8 max-w-md">
                            <div className="relative w-40 h-40 flex items-center justify-center">
                              <Waves className="w-full h-full text-indigo-500/20 absolute animate-pulse" />
                              <div className="relative z-10 p-6 bg-white dark:bg-zinc-900 rounded-full border-2 border-indigo-500 shadow-2xl">
                                <Compass className="w-14 h-14 text-indigo-600" />
                              </div>
                            </div>
                            <div className="space-y-4">
                              <p className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
                                "운명은 정해진 결말이 아니라,<br/>우리가 조종하는 돛의 방향입니다."
                              </p>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
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
                    className="bg-white dark:bg-zinc-900 rounded-[3rem] p-8 md:p-16 shadow-2xl border border-black/5 dark:border-white/5"
                  >
                    <div className="markdown-body prose dark:prose-invert max-w-none">
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
                <div className="pt-12 border-t border-black/5 dark:border-white/5">
                  <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    <button onClick={() => setGuideSubPage("about")} className="hover:text-indigo-500 transition-colors">소개 (About)</button>
                    <button onClick={() => setGuideSubPage("terms")} className="hover:text-indigo-500 transition-colors">이용약관 (Terms)</button>
                    <button onClick={() => setGuideSubPage("privacy")} className="hover:text-indigo-500 transition-colors">개인정보 처리방침 (Privacy)</button>
                    <button onClick={() => setGuideSubPage("contact")} className="hover:text-indigo-500 transition-colors">문의하기 (Contact)</button>
                  </div>
                  <div className="mt-8 text-center space-y-2">
                    <p className="text-[10px] text-zinc-400 opacity-60">© 2024 UI Saju Consulting. All rights reserved.</p>
                    <p className="text-[9px] text-zinc-400 opacity-40 max-w-2xl mx-auto leading-relaxed">
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
              className="flex-1 overflow-y-auto p-4 md:p-8 hide-scrollbar bg-[#fdfbf7] dark:bg-[#0a0a0a]"
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
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-4 hover:underline transition-all group"
                      >
                        <div className="p-2 rounded-full bg-indigo-50 dark:bg-indigo-950/30 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                          <ArrowLeft className="w-4 h-4" />
                        </div>
                        목록으로 돌아가기
                      </button>
                      
                      <div className="rounded-[3rem] overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 shadow-2xl">
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
                          <div className="markdown-body prose dark:prose-invert max-w-none text-base md:text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
                            <ReactMarkdown>
                              {selectedBlogPost.content.startsWith('# ') 
                                ? selectedBlogPost.content.split('\n').slice(1).join('\n').trim() 
                                : selectedBlogPost.content}
                            </ReactMarkdown>
                          </div>
                          
                          <div className="pt-10 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">UI</div>
                              <div>
                                <p className="text-sm font-bold">유아이 디렉터</p>
                                <p className="text-[10px] opacity-40">전문 사주 분석가</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSelectedBlogPost(null)}
                              className="px-6 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
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
                      <div className="text-center py-16 space-y-4 relative overflow-hidden rounded-[3rem] bg-indigo-600 dark:bg-indigo-950/30 p-10">
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
                                      : 'bg-white dark:bg-zinc-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 border border-black/5 dark:border-white/5'
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
                                  onClick={() => setSelectedBlogPost(post)}
                                  className="group text-left space-y-2.5"
                                >
                                  <p className="text-sm font-bold leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
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
                              className="p-8 md:p-12 rounded-[3rem] bg-white dark:bg-zinc-900 border-2 border-dashed border-indigo-500/30 space-y-8 shadow-2xl"
                            >
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <h3 className="text-2xl font-bold">새 블로그 글 작성</h3>
                                  <p className="text-xs text-zinc-400">당신의 지혜를 세상과 공유하세요.</p>
                                </div>
                                <button onClick={() => setIsAddingPost(false)} className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors">
                                  <X className="w-6 h-6" />
                                </button>
                              </div>
                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">제목</label>
                                  <input 
                                    type="text" 
                                    placeholder="글의 제목을 입력하세요"
                                    className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xl transition-all"
                                    value={newPost.title}
                                    onChange={e => setNewPost({...newPost, title: e.target.value})}
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">카테고리</label>
                                    <select 
                                      className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all"
                                      value={newPost.category}
                                      onChange={e => setNewPost({...newPost, category: e.target.value})}
                                    >
                                      <option value="사주기초">사주기초</option>
                                      <option value="사주이야기">사주이야기</option>
                                      <option value="사주책리뷰">사주책리뷰</option>
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">이미지 URL</label>
                                    <input 
                                      type="text" 
                                      placeholder="https://..."
                                      className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                      value={newPost.imageUrl}
                                      onChange={e => setNewPost({...newPost, imageUrl: e.target.value})}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">내용 (Markdown)</label>
                                  <textarea 
                                    placeholder="마크다운 문법을 사용하여 내용을 작성하세요..."
                                    rows={12}
                                    className="w-full p-6 rounded-3xl bg-zinc-50 dark:bg-black border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed transition-all"
                                    value={newPost.content}
                                    onChange={e => setNewPost({...newPost, content: e.target.value})}
                                  />
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
                              className="p-8 md:p-12 rounded-[3rem] bg-white dark:bg-zinc-900 border-2 border-dashed border-indigo-500/30 space-y-8 shadow-2xl"
                            >
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <h3 className="text-2xl font-bold">블로그 글 수정</h3>
                                  <p className="text-xs text-zinc-400">기존의 지혜를 다듬어 보세요.</p>
                                </div>
                                <button onClick={() => setIsEditingPost(null)} className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors">
                                  <X className="w-6 h-6" />
                                </button>
                              </div>
                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">제목</label>
                                  <input 
                                    type="text" 
                                    placeholder="제목을 입력하세요"
                                    className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xl transition-all"
                                    value={isEditingPost.title}
                                    onChange={e => setIsEditingPost({...isEditingPost, title: e.target.value})}
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">카테고리</label>
                                    <select 
                                      className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all"
                                      value={isEditingPost.category}
                                      onChange={e => setIsEditingPost({...isEditingPost, category: e.target.value})}
                                    >
                                      <option value="사주기초">사주기초</option>
                                      <option value="사주이야기">사주이야기</option>
                                      <option value="사주책리뷰">사주책리뷰</option>
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">이미지 URL</label>
                                    <input 
                                      type="text" 
                                      placeholder="이미지 URL"
                                      className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                      value={isEditingPost.imageUrl}
                                      onChange={e => setIsEditingPost({...isEditingPost, imageUrl: e.target.value})}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-2">내용 (Markdown)</label>
                                  <textarea 
                                    placeholder="내용을 입력하세요"
                                    rows={12}
                                    className="w-full p-6 rounded-3xl bg-zinc-50 dark:bg-black border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed transition-all"
                                    value={isEditingPost.content}
                                    onChange={e => setIsEditingPost({...isEditingPost, content: e.target.value})}
                                  />
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
                                  className="relative w-full text-left rounded-[2.5rem] overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 shadow-xl flex flex-col group transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10"
                                >
                                  <div className="relative h-52 overflow-hidden cursor-pointer" onClick={() => setSelectedBlogPost(post)}>
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
                                          className="p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all backdrop-blur-md shadow-lg"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePost(post.id);
                                          }}
                                          className="p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 text-red-500 hover:bg-red-500 hover:text-white transition-all backdrop-blur-md shadow-lg"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-8 space-y-4 flex-1 flex flex-col">
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                                      <Calendar className="w-3 h-3" />
                                      <span>{post.date}</span>
                                    </div>
                                    <h3 className="font-bold text-xl leading-tight line-clamp-2 text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer" onClick={() => setSelectedBlogPost(post)}>{post.title}</h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed flex-1">
                                      {post.content.replace(/[#*`]/g, '').slice(0, 120)}...
                                    </p>
                                    <button 
                                      onClick={() => setSelectedBlogPost(post)}
                                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-2 pt-4 group/btn"
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
                            <div className="mt-16 pt-10 border-t border-black/5 dark:border-white/5">
                              <div className="max-w-sm mx-auto lg:mx-0">
                                {user && (
                                  <div className="p-6 rounded-[2rem] bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 space-y-4">
                                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                      <span className="text-xs font-bold uppercase tracking-widest">{isAdmin ? '관리자 모드' : '일반 사용자'}</span>
                                    </div>
                                    <button 
                                      onClick={handleLogout}
                                      className="w-full py-3 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors border border-black/5 dark:border-white/5 shadow-sm"
                                    >
                                      로그아웃
                                    </button>
                                  </div>
                                )}

                                {!user && (
                                  <div className="p-8 rounded-[2rem] bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 space-y-4 shadow-xl">
                                    <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">관리자 전용 게이트웨이입니다. 로그인하여 시스템을 관리하세요.</p>
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

      <nav className={`md:hidden px-4 pt-1 border-t ${isDarkMode ? 'border-white/10 bg-black/60' : 'border-black/5 bg-white'} backdrop-blur-xl z-30 safe-bottom-px`}>
        <div className="max-w-md mx-auto flex items-center justify-around">
          {[
            { id: "welcome", icon: User, label: "HOME" },
            { id: "dashboard", icon: LayoutDashboard, label: "만세력" },
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
