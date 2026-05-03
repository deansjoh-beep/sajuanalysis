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
import { TAEKIL_CATEGORY_FORM_FIELDS } from "./constants/taekil";
import { GLASS_TAB_BG_CLASS, GLASS_PANEL_CLASS, GLASS_PANEL_STRONG_CLASS, TAB_TRANSITION } from "./constants/styles";
import { BlogPost } from "./constants/blog";
import { Newspaper, ArrowLeft, Trash2, Briefcase } from "lucide-react";
import { BlogMediaAsset } from "./components/BlogMediaLibrary";
import { ChatTab } from "./components/tabs/ChatTab";
import { TaekilTabContent } from "./components/tabs/TaekilTabContent";
import WelcomeTab from "./components/tabs/WelcomeTab";
import ManseTab from "./components/tabs/ManseTab";
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

// 라우트/Gemini/관리자/Firestore 에러/블로그 헬퍼/타입/renderChatPlainText
// 는 모두 전용 모듈로 분리됨. (App.tsx 슬림화)
import { isAdminRoute, isReportMakerRoute, isPremiumE2EMode } from "./lib/routes";
import {
  calculateSajuForPerson,
  sajuToolDeclaration,
  proxyGenerateContent,
  getPreferredGeminiModels,
} from "./lib/geminiClient";
import {
  normalizeEmail,
  normalizeEmailForCompare,
  getAllowedAdminEmails,
} from "./lib/adminAuth";
import { handleFirestoreError } from "./lib/firestoreErrors";
import { stripRichText, createDefaultNewPost } from "./lib/blogHelpers";
import type {
  Guidelines,
  UserData,
  SuggestionSource,
} from "./types/app";
import { renderChatPlainText } from "./components/chat/renderChatPlainText";

const LazyPremiumReportMakerPage = React.lazy(() => import("./components/admin/PremiumReportMakerPage").then((mod) => ({ default: mod.PremiumReportMakerPage })));
const LazyPremiumOrdersPanel = React.lazy(() => import("./components/PremiumOrdersPanel").then((mod) => ({ default: mod.PremiumOrdersPanel })));
const LazyReportTabContent = React.lazy(() => import("./components/tabs/ReportTabContent").then((mod) => ({ default: mod.ReportTabContent })));
const LazyGuideTabContent = React.lazy(() => import("./components/tabs/GuideTabContent").then((mod) => ({ default: mod.GuideTabContent })));
const LazyPremiumOrderForm = React.lazy(() => import("./components/PremiumOrderForm").then((mod) => ({ default: mod.PremiumOrderForm })));
import { ReviewModal } from "./components/ReviewModal";
import { ReviewsSection } from "./components/ReviewsSection";

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

  const taekilState = useTaekilTabState(TAEKIL_CATEGORY_FORM_FIELDS);
  
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
            () => proxyGenerateContent({
              model,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                temperature: 0.7,
                maxOutputTokens: 512
              }
            }),
            2
          );

          generated = extractQuestionsFromModelText(result?.text || '', alreadyAsked);
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
    preferredModels: getPreferredGeminiModels(),
  });

  // 만세력 페이지에 통합된 AI 기본 리포트 자동 생성 트리거.
  // 운세분석이 끝나(sajuResult가 채워짐) 그리고 리포트가 아직 없으면 호출.
  // 모드 토글 시 setReportContent(null)을 호출하면 자동으로 재생성.
  // ref 가드로 동일 (sajuResult, mode) 조합에 대해 중복 호출 방지 (React StrictMode·재실행 대비).
  const reportTriggeredKeyRef = useRef<string>('');
  useEffect(() => {
    if (sajuResult.length === 0) return;
    if (reportContent !== null) return;
    if (loading) return;
    const key = `${sajuResult.map(p => `${p.stem.hanja}${p.branch.hanja}`).join('|')}::${consultationMode}`;
    if (reportTriggeredKeyRef.current === key) return;
    reportTriggeredKeyRef.current = key;
    handleGenerateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sajuResult, reportContent, consultationMode, loading]);

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
    taekilActiveCategory: taekilState.taekilActiveCategory,
    taekilActiveFields: taekilState.taekilActiveFields,
    taekilFormValues: taekilState.taekilFormValues,
    marriagePeriodStart: taekilState.marriagePeriodStart,
    marriagePeriodEnd: taekilState.marriagePeriodEnd,
    spouseName: taekilState.spouseName,
    spouseGender: taekilState.spouseGender,
    spouseBirthYear: taekilState.spouseBirthYear,
    spouseBirthMonth: taekilState.spouseBirthMonth,
    spouseBirthDay: taekilState.spouseBirthDay,
    spouseBirthHour: taekilState.spouseBirthHour,
    spouseBirthMinute: taekilState.spouseBirthMinute,
    spouseCalendarType: taekilState.spouseCalendarType,
    spouseUnknownTime: taekilState.spouseUnknownTime,
    preferredWeekday1: taekilState.preferredWeekday1,
    preferredWeekday2: taekilState.preferredWeekday2,
    preferredWeekday3: taekilState.preferredWeekday3,
    avoidDateInputs: taekilState.avoidDateInputs,
    moveCurrentAddress: taekilState.moveCurrentAddress,
    moveTargetAddress: taekilState.moveTargetAddress,
    movePeriodStart: taekilState.movePeriodStart,
    movePeriodEnd: taekilState.movePeriodEnd,
    movePreferredWeekday1: taekilState.movePreferredWeekday1,
    movePreferredWeekday2: taekilState.movePreferredWeekday2,
    movePreferredWeekday3: taekilState.movePreferredWeekday3,
    moveFamilyBirthDates: taekilState.moveFamilyBirthDates,
    movePriority: taekilState.movePriority,
    moveOnlyWeekend: taekilState.moveOnlyWeekend,
    childFatherBirthDate: taekilState.childFatherBirthDate,
    childFatherBirthTime: taekilState.childFatherBirthTime,
    childMotherBirthDate: taekilState.childMotherBirthDate,
    childMotherBirthTime: taekilState.childMotherBirthTime,
    childFetusGender: taekilState.childFetusGender,
    childbirthPeriodStart: taekilState.childbirthPeriodStart,
    childbirthPeriodEnd: taekilState.childbirthPeriodEnd,
    generalPeriodStart: taekilState.generalPeriodStart,
    generalPeriodEnd: taekilState.generalPeriodEnd,
    generalPreferredWeekday1: taekilState.generalPreferredWeekday1,
    generalPreferredWeekday2: taekilState.generalPreferredWeekday2,
    generalPreferredWeekday3: taekilState.generalPreferredWeekday3,
    generalAvoidDateInputs: taekilState.generalAvoidDateInputs,
    taekilAdditionalInfo: taekilState.taekilAdditionalInfo,
    setTaekilLoading: taekilState.setTaekilLoading,
    setTaekilError: taekilState.setTaekilError,
    setTaekilNotice: taekilState.setTaekilNotice,
    setTaekilResults: taekilState.setTaekilResults,
    setSelectedTaekilDate: taekilState.setSelectedTaekilDate,
  });

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
        {/* Navigation Header — 기와집 스타일 */}
        <div className="sticky top-0 z-30">
        <header
          className="px-4 py-3 md:px-10 md:py-4 flex items-center justify-between safe-top"
          style={{
            backgroundColor: '#181a26',
            backgroundImage: [
              'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 22px)',
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 22px)',
              'linear-gradient(180deg, #1e2030 0%, #181a26 100%)',
            ].join(', '),
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-seal/40 bg-seal/10 flex items-center justify-center">
              <span className="font-serif font-bold text-[13px] text-seal">命</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-[15px] md:text-[16px] font-title font-bold tracking-tight text-white">유아이 사주상담</h1>
              <p className="hidden md:block text-[11px] text-white/35 uppercase tracking-widest font-bold">전문 사주 분석</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {[
              { id: "welcome", label: "HOME" },
              { id: "dashboard", label: "만세력" },
              { id: "chat", label: "상담" },
              { id: "report", label: "프리미엄리포트" },
              ...(isAdmin ? [{ id: "premium", label: "프리미엄" }] : []),
              { id: "blog", label: "블로그" },
              { id: "guide", label: "HELP" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl transition-all text-[14px] font-bold tracking-tight ${
                  activeTab === tab.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white/85 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1 md:gap-2">
            {activeTab === "chat" && (
              <button
                onClick={handleDownloadChat}
                disabled={messages.length === 0}
                className="p-2 md:px-3 md:py-1.5 rounded-lg hover:bg-white/10 text-white/55 hover:text-white transition-all flex items-center gap-2 disabled:opacity-30"
                title="상담 내용 저장"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:block text-[13px] font-bold">텍스트 저장</span>
              </button>
            )}
            {/* 후기 남기기 버튼 */}
            <button
              onClick={() => setReviewModalOpen(true)}
              className="p-2 md:px-3 md:py-1.5 rounded-lg hover:bg-white/10 text-amber-400/70 hover:text-amber-300 transition-all flex items-center gap-2"
              title="후기 남기기"
            >
              <Star className="w-4 h-4" />
              <span className="hidden md:block text-[13px] font-bold">후기 남기기</span>
            </button>
            <button
              onClick={handleReset}
              className="p-2 md:px-3 md:py-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-red-400 transition-all flex items-center gap-2"
              title="상담 종료 및 데이터 삭제"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:block text-[13px] font-bold">상담 종료</span>
            </button>
          </div>
        </header>
        {/* 막새기와 처마 장식 — 기와 이미지 기반 스캘럽 에지 */}
        <div
          aria-hidden="true"
          style={{
            height: '20px',
            backgroundImage: 'radial-gradient(circle at 50% 0%, #181a26 0%, #181a26 73%, transparent 74%)',
            backgroundSize: '28px 20px',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: '0 0',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 5px 8px rgba(0,0,0,0.45))',
          }}
        />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
          {activeTab === "welcome" && (
            <WelcomeTab
              showInputForm={showInputForm}
              setShowInputForm={setShowInputForm}
              userData={userData}
              setUserData={setUserData}
              isAgreed={isAgreed}
              setIsAgreed={setIsAgreed}
              setActiveTab={setActiveTab}
              setOrderProductType={setOrderProductType}
              setReviewModalOpen={setReviewModalOpen}
              recommendedPosts={recommendedPosts}
              onPostClick={blogTab.handlePostClick}
              currentSeoulYear={currentSeoulYear}
              handleStart={handleStart}
            />
          )}

          {activeTab === "dashboard" && (
            <ManseTab
              userData={userData}
              sajuResult={sajuResult}
              daeunResult={daeunResult}
              yongshinResult={yongshinResult}
              gyeokResult={gyeokResult}
              selectedDaeunIdx={selectedDaeunIdx}
              setSelectedDaeunIdx={setSelectedDaeunIdx}
              daeunScrollRef={daeunScrollRef}
              currentSeoulYear={currentSeoulYear}
              setActiveTab={setActiveTab}
              reportContent={reportContent}
              reportLoading={loading}
              consultationMode={consultationMode}
              setConsultationMode={setConsultationMode}
              setReportContent={setReportContent}
              consultationModeRef={consultationModeRef}
            />
          )}

          {activeTab === "taekil" && (
            <TaekilTabContent taekil={taekilState} onGenerate={handleGenerateTaekil} />
          )}

          {activeTab === "chat" && (
            <ChatTab tabTransition={TAB_TRANSITION} glassTabBgClass={GLASS_TAB_BG_CLASS}>
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex w-64 flex-col border-r border-ink-300/25 bg-paper-50/60 p-4 space-y-6 overflow-y-auto relative">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => switchConsultationMode('basic')}
                        className={`px-3 py-2 rounded-xl text-[13px] font-bold transition-all ${
                          consultationMode === 'basic'
                            ? 'bg-ink-900 text-paper-50'
                            : 'bg-paper-50/60 border border-ink-300/30 text-ink-700'
                        }`}
                      >
                        초급자
                      </button>
                      <button
                        onClick={() => switchConsultationMode('advanced')}
                        className={`px-3 py-2 rounded-xl text-[13px] font-bold transition-all ${
                          consultationMode === 'advanced'
                            ? 'bg-ink-900 text-paper-50'
                            : 'bg-paper-50/60 border border-ink-300/30 text-ink-700'
                        }`}
                      >
                        고급자
                      </button>
                    </div>
                  </div>

                  {/* Consultation Tips */}
                  <div className="space-y-3 pt-4 border-t border-ink-300/25">
                    <ul className="space-y-2">
                      <li className="text-[14px] text-ink-500 leading-relaxed">질문에 "어떻게"를 넣어보세요. 고민의 해결은 나의 행동에서 출발합니다.</li>
                      <li className="text-[14px] text-ink-500 leading-relaxed">구체적인 상황을 알려주세요. 모든 사적인 내용은 철저하게 보호해드립니다.</li>
                      <li className="text-[14px] text-ink-500 leading-relaxed">MBTI 등 추가 정보를 넣으시면 더욱 알찬 상담이 됩니다.</li>
                      <li className="text-[14px] text-ink-500 leading-relaxed">맥락을 리프레시하고 재개하면 객관적인 상담이 유지됩니다.</li>
                    </ul>
                  </div>

                  {/* Order CTA + Privacy Notice (Desktop) */}
                  <div className="mt-auto space-y-3">
                    <button
                      onClick={() => { setOrderProductType('premium'); setActiveTab("order"); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl text-[13px] font-bold bg-ink-900 text-paper-50 hover:bg-ink-700 transition-all"
                    >
                      <Ticket className="w-4 h-4" />
                      프리미엄 리포트 주문하기
                    </button>
                    <div className="border-t border-ink-300/25 pt-3">
                      <p className="text-[12px] text-ink-500 text-center leading-relaxed">
                        상담에 사용된 개인정보 등 모든 정보는 상담이 끝나면 자동으로 파기 됩니다.
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
                        className={`px-2 py-1 min-h-[44px] rounded-lg text-[13px] font-bold border ${consultationMode === 'basic' ? 'bg-ink-900 border-ink-900 text-paper-50' : 'bg-paper-50/75 border-ink-300/30 text-ink-700'}`}
                      >
                        초급자
                      </button>
                      <button
                        onClick={() => switchConsultationMode('advanced')}
                        className={`px-2 py-1 min-h-[44px] rounded-lg text-[13px] font-bold border ${consultationMode === 'advanced' ? 'bg-ink-900 border-ink-900 text-paper-50' : 'bg-paper-50/75 border-ink-300/30 text-ink-700'}`}
                      >
                        고급자
                      </button>
                    </div>

                    {modeNotice && (
                      <div className="mx-auto max-w-3xl rounded-xl border border-brush-gold/30 bg-paper-100/60 px-4 py-2 text-center text-[14px] text-ink-700">
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
                        <div className={`max-w-[96%] md:max-w-[92%] p-4 md:p-5 rounded-2xl leading-relaxed shadow-sm text-[14px] ${
                          msg.role === 'user'
                            ? 'bg-ink-900 text-paper-50 rounded-tr-none'
                            : 'bg-paper-50/80 border border-ink-300/30 text-ink-800 rounded-tl-none'
                        }`}>
                          {renderChatPlainText(msg.text)}
                        </div>

                        {msg.role === 'model' && i === messages.length - 1 && !loading && (suggestionsLoading || suggestionsError || suggestions.length > 0) && (
                          <div className="w-full max-w-[96%] md:max-w-[92%]">
                            <button
                              onClick={() => setShowInlineSuggestions((prev) => !prev)}
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-ink-300/30 bg-paper-50/60 text-ink-600 hover:text-ink-900 text-[13px] font-semibold"
                            >
                              {showInlineSuggestions ? '추천 질문 접기' : suggestionsLoading ? '추천 질문 생성 중...' : '추천 질문 보기'}
                            </button>

                            {showInlineSuggestions && (
                              <div className="mt-2 p-3 rounded-2xl border bg-paper-100/60 border-ink-300/25">
                                <div className="mb-2 px-2 text-[12px] text-ink-500 flex items-center justify-between gap-2">
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
                                        className="rounded-md px-2 py-1 text-ink-600 hover:text-ink-900"
                                        title="기본 추천 질문 새로고침"
                                      >
                                        기본 새로고침
                                      </button>
                                    )}
                                    <button
                                      onClick={() => { void handleGenerateAiSuggestions(); }}
                                      disabled={suggestionsLoading || aiSuggestionRequestCount >= 2}
                                      className="rounded-md px-2 py-1 text-ink-700 border border-ink-300/40 bg-paper-50/70 hover:bg-paper-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        className={`w-full text-center px-1 py-0.5 min-h-[28px] rounded-md text-[12px] leading-tight transition-all border bg-transparent ${
                                          (consultationMode === 'basic' ? basicSelectedCategory : selectedCategory) === cat
                                            ? 'text-ink-900 font-bold border-ink-700/50'
                                            : 'text-ink-500 border-ink-300/40 hover:border-ink-500/50 hover:text-ink-700'
                                        }`}
                                      >
                                        {cat}
                                      </button>
                                    ))}
                                    <div className="w-full min-h-[32px] rounded-md border-0 bg-transparent text-ink-500 flex items-center justify-center">
                                      <RefreshCw className={`w-4 h-4 ${suggestionsLoading ? 'animate-spin' : ''}`} />
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 pl-1">
                                    {!suggestionsLoading && suggestions.map((s, idx) => (
                                      <button
                                        key={`inline-chat-suggestion-${idx}`}
                                        onClick={() => handleSuggestionClick(s)}
                                        className="w-full text-right px-3 py-1.5 min-h-[32px] rounded-lg border-0 bg-transparent transition-all text-ink-700 hover:text-ink-900"
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
                      <div className="flex items-center gap-3 px-5 py-2.5 rounded-full w-fit border bg-paper-50/80 border-ink-300/30">
                        <RefreshCw className="w-5 h-5 animate-spin text-brush-gold" />
                        <span className="text-[14px] text-ink-500">유아이가 분석 중입니다...</span>
                      </div>
                    )}

                  </div>

                  {/* Input Area */}
                  <div className="p-2 border-t md:pb-4 border-ink-300/25 bg-paper-50/70">
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
                            className="px-3 py-1.5 min-h-[40px] rounded-full text-[13px] font-semibold border transition-all disabled:opacity-50 bg-paper-50/75 border-ink-300/35 text-ink-700 hover:border-ink-500/50 hover:text-ink-900"
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
                                  ? 'bg-ink-900 text-paper-50 border-ink-900'
                                  : 'bg-paper-50/75 border-ink-300/35 text-ink-700 hover:border-ink-500/50 hover:text-ink-900'
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
                        className="w-full border rounded-2xl py-3 pl-4 pr-24 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brush-gold/40 transition-all shadow-sm bg-paper-50/80 border-ink-300/35 text-ink-900 placeholder:text-ink-400"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleVoiceInput}
                            className={`p-2 min-h-[44px] min-w-[44px] rounded-xl active:scale-90 transition-transform ${isListening ? 'bg-seal text-paper-50' : 'bg-paper-50/80 border border-ink-300/35 text-ink-700'}`}
                            title="음성 입력"
                          >
                            <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                          </button>
                          <button onClick={() => handleSend()} className="p-2 min-h-[44px] min-w-[44px] bg-ink-900 rounded-xl text-paper-50 hover:bg-ink-700 active:scale-90 transition-all">
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

                    {/* Mobile-only Privacy Notice */}
                    <div className="md:hidden mt-1">
                      <div className="pt-1 border-t border-ink-300/25">
                        <p className="text-[12px] text-ink-500 text-center leading-tight">
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

      {/* Mobile Navigation — 기와집 스타일 */}
      <nav
        className="md:hidden px-2 pt-3 pb-2 border-t border-white/10 z-30 safe-bottom-px"
        style={{
          background: '#181a26',
          backgroundImage: [
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 22px)',
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 22px)',
          ].join(', '),
          boxShadow: '0 -1px 0 rgba(168,138,74,0.18)',
        }}
      >
        <div className="max-w-md mx-auto flex items-center justify-around">
          {[
            { id: "welcome", label: "HOME" },
            { id: "dashboard", label: "만세력" },
            { id: "chat", label: "상담" },
            { id: "report", label: "리포트" },
            ...(isAdmin ? [{ id: "premium", label: "프리미엄" }] : []),
            { id: "blog", label: "블로그" },
            { id: "guide", label: "HELP" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex flex-col items-center gap-1 py-1 px-2 transition-all ${
                activeTab === tab.id ? 'text-white' : 'text-white/35'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: '#a88a4a' }}
                />
              )}
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
