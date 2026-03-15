import React, { useState, useEffect, useRef, useMemo } from "react";
import { GoogleGenAI } from "@google/genai";
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
  Mic,
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
  Mail
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { getSajuData, getDaeunData, calculateYongshin, hanjaToHangul, elementMap, yinYangMap } from "./utils/saju";

// Types
interface Message {
  role: "user" | "model";
  text: string;
}

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

const HanjaBox: React.FC<{ hanja: string, size?: 'sm' | 'md' | 'lg', isDarkMode?: boolean }> = ({ hanja, size = 'md', isDarkMode = true }) => {
  const element = elementMap[hanja];
  const isYang = yinYangMap[hanja] === '+';
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px] rounded',
    md: 'w-10 h-10 text-xl rounded-lg',
    lg: 'w-12 h-12 text-2xl rounded-xl'
  };

  if (hanja === '?' || !element) {
    return (
      <div className={`${sizeClasses[size]} border-2 border-zinc-500/30 flex items-center justify-center opacity-30`}>
        {hanja}
      </div>
    );
  }

  // Metal Special Rules (庚, 申, 辛, 酉)
  if (element === 'metal') {
    const silverColor = isDarkMode ? 'bg-zinc-400 border-zinc-400' : 'bg-zinc-500 border-zinc-500';
    const whiteColor = isDarkMode ? 'bg-zinc-200 border-zinc-200' : 'bg-white border-zinc-300';
    
    if (isYang) {
      // Yang Metal: White background, Silver text
      return (
        <div className={`${sizeClasses[size]} ${whiteColor} ${isDarkMode ? 'text-zinc-600' : 'text-zinc-500'} border-2 flex items-center justify-center font-bold`}>
          {hanja}
        </div>
      );
    } else {
      // Yin Metal: Silver background, White text
      return (
        <div className={`${sizeClasses[size]} ${silverColor} text-white border-2 flex items-center justify-center font-bold`}>
          {hanja}
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
      <div className={`${sizeClasses[size]} bg-transparent border-2 ${style.border} ${style.text} flex items-center justify-center font-bold`}>
        {hanja}
      </div>
    );
  } else {
    return (
      <div className={`${sizeClasses[size]} ${style.bg} border-2 ${style.border} ${style.yinText} flex items-center justify-center font-bold`}>
        {hanja}
      </div>
    );
  }
};

const INITIAL_QUESTIONS = [
  "나의 전반적인 타고난 성격과 기질은 어떤가요?",
  "올해의 전반적인 운세 흐름이 궁금합니다.",
  "나에게 가장 잘 맞는 직업이나 진로는 무엇인가요?",
  "재물운을 높이기 위해 주의해야 할 점이 있을까요?",
  "건강상 특별히 조심해야 할 부분이나 보완할 기운은 무엇인가요?"
];

const ReportAccordion: React.FC<{ content: string; isDarkMode: boolean }> = ({ content, isDarkMode }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Parse the content into sections
  // Format: N. Title [키워드] Keyword [🔽 내용 보기]\n(상세 확장 내용) Content
  const sections = useMemo(() => {
    const regex = /(\d\.\s.*?\s\[키워드\]\s.*?\s\[🔽\s내용\s보기\])\n\((?:상세\s)?확장\s내용\)\s([\s\S]*?)(?=\n\d\.\s|$)/g;
    const matches = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.push({
        header: match[1].replace(/\[🔽\s내용\s보기\]/, '').trim(),
        body: match[2].trim()
      });
    }
    return matches;
  }, [content]);

  if (sections.length === 0) {
    return (
      <div className="markdown-body prose dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div 
          key={index} 
          className={`rounded-2xl border transition-all overflow-hidden ${
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
          }`}
        >
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full px-6 py-5 flex items-center justify-between text-left group"
          >
            <div className="flex-1 pr-4">
              <span className="text-sm font-bold text-indigo-500 block mb-1">CATEGORY {index + 1}</span>
              <h3 className="text-base font-bold leading-tight group-hover:text-indigo-400 transition-colors">
                {section.header}
              </h3>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              openIndex === index ? 'bg-indigo-500 text-white rotate-180' : 'bg-zinc-100 dark:bg-white/10 text-zinc-500'
            }`}>
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>
          
          <AnimatePresence>
            {openIndex === index && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className={`px-6 pb-6 pt-2 text-sm leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  <div className="w-full h-px bg-black/5 dark:bg-white/5 mb-4" />
                  <ReactMarkdown>{section.body}</ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

const App: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<"welcome" | "dashboard" | "chat" | "report" | "guide">("welcome");
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hasSeenOnboarding') === 'true';
    }
    return false;
  });
  
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
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [countdown, setCountdown] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const autoStopRef = useRef<any>(null);
  const [sajuResult, setSajuResult] = useState<any[]>([]);
  const [daeunResult, setDaeunResult] = useState<any[]>([]);
  const [yongshinResult, setYongshinResult] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_QUESTIONS);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [guidelines, setGuidelines] = useState<Guidelines | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch guidelines
  useEffect(() => {
    const fetchGuidelines = async () => {
      try {
        const res = await fetch("/api/guidelines");
        const data = await res.json();
        setGuidelines(data);
      } catch (err) {
        console.error("Failed to fetch guidelines:", err);
      }
    };
    fetchGuidelines();
  }, []);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Saju Calculation Trigger
  const handleStart = async () => {
    setIsAnalyzing(true);
    setAnalysisStep(0);

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
    setIsAnalyzing(false);
    setActiveTab("dashboard");
    
    // Reset chat with context
    setMessages([
      { 
        role: "model", 
        text: `반갑습니다, ${userData.name || '사용자'}님. 당신의 사주 분석이 완료되었습니다. 대시보드에서 당신의 타고난 기운을 확인하실 수 있으며, 궁금한 점은 일대일 상담 탭에서 물어봐 주세요.` 
      }
    ]);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceText("");
      setCountdown(15);
      
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // 15초 후 자동 종료
      autoStopRef.current = setTimeout(() => {
        recognition.stop();
      }, 15000);
    };

    recognition.onend = () => {
      setIsListening(false);
      clearInterval(timerRef.current);
      clearTimeout(autoStopRef.current);
      if (finalTranscript) {
        parseVoiceInput(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setVoiceText(finalTranscript + interimTranscript);
    };

    recognition.start();
  };

  const parseVoiceInput = async (text: string) => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
사용자의 음성 입력에서 이름, 생년월일시 정보를 추출하여 JSON 형식으로 반환해줘.
입력: "${text}"

JSON 형식 예시:
{
  "name": "홍길동",
  "year": "1990",
  "month": "5",
  "day": "15",
  "hour": "14",
  "minute": "30",
  "calendarType": "solar" | "lunar" | "leap",
  "gender": "M" | "F",
  "unknownTime": true | false
}

규칙:
1. 정보를 알 수 없는 경우 기존 값을 유지하거나 합리적으로 추측해.
2. 이름이 언급되면 name 필드에 넣어줘. 언급되지 않으면 기존 이름을 유지해.
3. 시간이 언급되지 않으면 unknownTime을 true로 설정해.
4. calendarType은 '양력', '음력', '윤달' 키워드를 보고 판단해.
5. 성별이 언급되지 않으면 'M'으로 기본 설정해.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(result.text || "{}");
      setUserData(prev => ({
        ...prev,
        name: parsed.name || prev.name,
        birthYear: parsed.year || prev.birthYear,
        birthMonth: parsed.month || prev.birthMonth,
        birthDay: parsed.day || prev.birthDay,
        birthHour: parsed.hour || prev.birthHour,
        birthMinute: parsed.minute || prev.birthMinute,
        calendarType: parsed.calendarType || prev.calendarType,
        gender: parsed.gender || prev.gender,
        unknownTime: parsed.unknownTime !== undefined ? parsed.unknownTime : prev.unknownTime
      }));
    } catch (err) {
      console.error("Voice parsing error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const userMessage = (overrideInput || input).trim();
    if (!userMessage || loading || !guidelines || sajuResult.length === 0) return;

    setInput("");
    setSuggestions([]);
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const sajuContext = sajuResult.map(p => `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja}) - 십성: ${p.stem.deity}/${p.branch.deity}`).join('\n');

      const systemInstruction = `
[Role: UI Premium 1:1 Spiritual Counselor]
당신은 '유아이(UI) 사주상담'의 전문 상담가입니다.

현재 날짜: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
현재 연도: ${new Date().getFullYear()}년

1. 상담 원칙 (consulting_guideline.txt 준수):
- 반드시 업로드된 consulting_guideline.txt와 saju_guideline.txt를 결합하여 분석하십시오.
- 분석 시 반드시 '지침'에 따른 분석 단계(음양 -> 조후 -> 구조 -> 십성)를 순서대로 고려하여 명리학적 근거를 제시하십시오.
- 전문 용어 사용 시 현대적인 비유를 곁들여 친절하게 설명하십시오.
- 사용자의 이전 대화 맥락을 기억하고 초개인화된 상담을 제공하십시오.
- 상담 마무리는 항상 사용자를 응원하는 따뜻한 메시지와 함께 다음 질문을 유도하며 끝맺음하십시오.

2. 법적/윤리적 가이드라인 (필수 준수):
- 의료 진단, 범죄 공모, 도박 조장, 생사(生死) 판별, 구체적인 주식/코인 종목 추천 등 법적/윤리적 위험이 있는 질문에는 답변을 거부하십시오.
- 이러한 질문 감지 시: "죄송합니다. 해당 내용은 전문 영역(의사, 법률가, 금융 전문가 등)의 상담이 필요하며, 사주 분석으로 확답을 드릴 수 없습니다."라고 정중히 안내하십시오.

3. 사용자 정보:
이름: ${userData.name || '사용자'}
성별: ${userData.gender === 'M' ? '남성' : '여성'}
사주 원국:
${sajuContext}

3. 출력 형식 (필수):
답변의 맨 마지막에 사용자가 이어서 질문할 만한 '연속 질문' 3개를 반드시 포함하십시오.
형식:
[연속 질문]
1. 질문 내용 1
2. 질문 내용 2
3. 질문 내용 3

4. 참조 데이터:
<saju_guideline.txt>
${guidelines.saju}

<consulting_guideline.txt>
${guidelines.consulting}
      `;

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: { systemInstruction },
        history: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }))
      });

      const result = await chat.sendMessage({ message: userMessage });
      let fullText = result.text || "죄송합니다. 다시 시도해 주세요.";
      
      // Parse suggestions
      const suggestionRegex = /\[연속 질문\]\s*[\n\r]+1\.\s*(.*)[\n\r]+2\.\s*(.*)[\n\r]+3\.\s*(.*)/i;
      const suggestionMatch = fullText.match(suggestionRegex);
      if (suggestionMatch) {
        const newSuggestions = [suggestionMatch[1].trim(), suggestionMatch[2].trim(), suggestionMatch[3].trim()];
        setSuggestions(newSuggestions);
        fullText = fullText.replace(suggestionRegex, "").trim();
      } else {
        // Fallback for different formats
        const altRegex = /1\.\s*(.*)[\n\r]+2\.\s*(.*)[\n\r]+3\.\s*(.*)/;
        const altMatch = fullText.match(altRegex);
        if (altMatch && fullText.includes('질문')) {
          const newSuggestions = [altMatch[1].trim(), altMatch[2].trim(), altMatch[3].trim()];
          setSuggestions(newSuggestions);
          fullText = fullText.replace(altRegex, "").trim();
        } else {
          setSuggestions(INITIAL_QUESTIONS);
        }
      }

      setMessages(prev => [...prev, { role: "model", text: fullText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "model", text: "상담 중 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    handleSend(text);
  };

  const handleGenerateReport = async () => {
    if (loading || !guidelines || sajuResult.length === 0) return;

    setLoading(true);
    setActiveTab("report");
    setMessages(prev => [...prev, { role: "user", text: "나의 운세 종합 리포트를 작성해줘." }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const sajuContext = sajuResult.map(p => `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja})`).join('\n');
      
      const currentAge = 2026 - parseInt(userData.birthYear) + 1;
      const daeunContext = daeunResult.map((dy, i) => {
        const isCurrent = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
        return `${dy.startAge}세~${daeunResult[i+1]?.startAge || dy.startAge + 9}세: ${hanjaToHangul[dy.stem]}${hanjaToHangul[dy.branch]}(${dy.stem}${dy.branch})${isCurrent ? ' [현재 대운]' : ''}`;
      }).join('\n');

      const systemInstruction = `
[System Role & Instruction]
당신은 명리학적 데이터를 분석하여 사용자에게 깊이 있고 전문적인 조언을 제공하는 **'수석 사주 분석가'**입니다. 제공된 사용자의 사주 데이터를 바탕으로 아래의 **[8대 카테고리]**에 맞춰 종합운세리포트를 작성하십시오.

작성 시 반드시 시스템에 사전 입력된 report_guideline.txt의 지침(단정적/극단적 표현 금지, 생사 및 질병 확정 금지, 객관적이고 따뜻한 조언 유지 등)을 엄격하게 준수해야 합니다.

[Output Structure: 확장형 UI 포맷]
리포트는 앱 화면에서 사용자가 키워드를 누르면 상세 내용이 펼쳐지는 '아코디언 UI'에 적용될 예정입니다. 따라서 각 카테고리는 시선을 사로잡는 **[핵심 키워드]**와 클릭 시 나타나는 **[상세 확장 내용]**으로 명확히 구분하여 작성하십시오. 키워드 우측에는 [🔽 내용 보기]라는 버튼 표시를 달아주십시오.

[분석 대상 정보]
이름: ${userData.name || '사용자'}
사주 원국:
${sajuContext}

대운 흐름:
${daeunContext}

현재 나이: ${currentAge}세

[8대 카테고리 작성 가이드]

1. 본질적 기질과 성격, 사회성
키워드: 사용자의 가장 강력한 특성이나 십성을 한 문장으로 요약
상세 확장 내용: 내면의 본질적 성향, 타인과 맺는 사회적 관계의 특징, 사회생활에서의 장단점 분석.

2. 용신 분석 및 결핍 보완 (개운법)
키워드: 사주에서 부족한 기운과 이를 채울 수 있는 핵심 처방 요약.
상세 확장 내용: 오행의 과다/결핍을 분석하고, 이를 보완할 수 있는 실질적인 행동 양식, 마인드셋, 유리한 색상이나 방향 등 제시.

3. 전체 인생 흐름 (대운 분석)
키워드: 인생 전체를 관통하는 주요 테마나 현재 지나고 있는 계절의 비유.
상세 확장 내용: 초년-중년-말년의 굵직한 변화 흐름과 현재 대운(10년 운)이 위치한 지점 및 향후 방향성.

4. 재물운
키워드: 돈을 벌고 모으는 스타일 한 줄 요약.
상세 확장 내용: 타고난 재물 그릇의 크기, 유리한 자산 증식 형태(부동산, 금융, 사업, 월급 등), 재물 관리 시 주의점.

5. 사회 및 직장운
키워드: 가장 빛을 발할 수 있는 직업적 환경 요약.
상세 확장 내용: 직장 조직 내에서의 역할, 독립(사업)과 소속(직장) 중 유리한 방향, 윗사람/아랫사람과의 관계성.

6. 건강운
키워드: 오행 밸런스에 따른 핵심 건강 키워드.
상세 확장 내용: 원국 상 에너지가 과하게 몰리거나 부족하여 취약해질 수 있는 신체 부위 및 추천하는 건강 관리 루틴. (주의: 질병 진단 절대 금지)

7. 연애 및 결혼운
키워드: 사용자의 연애 스타일과 인연이 닿는 배우자상 요약.
상세 확장 내용: 이성을 대하는 태도, 관계에서 조심해야 할 부분, 서로 시너지가 나는 파트너의 특징.

8. 운명을 이끄는 가장 중요한 조언
키워드: 현재 시점에서 가장 명심해야 할 단 하나의 메시지.
상세 확장 내용: 전체 사주를 관통하여 삶을 더 나은 방향으로 이끌기 위한 진정성 있는 통찰과 마인드 컨트롤 조언.

[출력 예시 (포맷을 정확히 지킬 것)]

1. 본질적 기질과 성격, 사회성 [키워드] 부드러운 외면 속, 누구보다 단단한 원칙주의자 [🔽 내용 보기]
(상세 확장 내용) 당신은 겉보기에 유연하고 사람들과 잘 어울리지만, 내면에는 자신만의 확고한 기준(정관)이 자리 잡고 있습니다. 사회생활에서는 다툼을 피하는 평화주의자 역할을 자처하지만...

2. 용신 분석 및 결핍 보완 [키워드] 삶의 엔진을 식혀줄 '물(水)'의 지혜와 쉼표 [🔽 내용 보기]
(상세 확장 내용) 현재 사주에 화(火) 기운이 강해 목표를 향해 달려가는 추진력은 좋으나, 번아웃이 오기 쉽습니다. 당신에게 필요한 것은 유연함과 휴식을 상징하는 수(水) 기운입니다...

(... 3~8번 항목도 동일한 포맷으로 작성)
      `;

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: { systemInstruction }
      });

      const result = await chat.sendMessage({ message: "나의 사주 정보와 대운 흐름을 바탕으로 MZ세대 감성의 '유아이(UI) 리포트'를 작성해줘." });
      const text = result.text || "리포트 생성 실패";
      setMessages(prev => [...prev, { role: "model", text }]);
      setReportContent(text);
    } catch (err) {
      console.error("Report generation error:", err);
      setReportContent("리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  // Chart Data
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

  const handleOnboardingComplete = () => {
    setHasSeenOnboarding(true);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  // Render Onboarding
  if (!hasSeenOnboarding) {
    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 ${isDarkMode ? 'bg-[#0a0a0a] text-zinc-100' : 'bg-[#fdfbf7] text-zinc-900'}`}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-w-lg w-full p-8 md:p-12 rounded-[3rem] shadow-2xl border ${isDarkMode ? 'bg-zinc-900/50 border-white/10' : 'bg-white border-black/5'} relative overflow-hidden`}
        >
          {/* Background Pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="100" cy="0" r="80" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="100" cy="0" r="60" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="100" cy="0" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>

          <div className="space-y-8 text-center">
            <div className="space-y-4">
              <h1 className="text-2xl md:text-3xl font-serif font-bold leading-tight break-keep">
                당신의 삶을 비추는 고요한 등불,<br/>
                <span className="text-indigo-500">"유아이사주상담"</span>에 오신 것을<br/>
                진심으로 환영합니다
              </h1>
              <div className="w-12 h-0.5 bg-indigo-500/30 mx-auto rounded-full" />
            </div>

            <div className={`text-sm md:text-base leading-relaxed text-left space-y-4 font-serif opacity-80 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar`}>
              <p>
                안녕하세요. 삶의 소중한 길목에서 유아이를 찾아주신 귀하께 깊은 감사의 인사를 전합니다. 
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

            <button 
              onClick={handleOnboardingComplete}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
            >
              내 운명 확인하러 가기
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

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

      <div className={`w-full h-full md:max-w-[375px] md:h-[812px] ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8f9fa] text-[#1a1a1a]'} md:rounded-[3rem] md:border-8 md:border-zinc-950 overflow-hidden shadow-2xl relative flex flex-col transition-all duration-300 font-sans`}>
        {/* Header */}
        <header className={`px-4 py-3 flex items-center justify-between border-b ${isDarkMode ? 'border-white/10' : 'border-black/5'} safe-top backdrop-blur-xl bg-opacity-80 z-30`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="text-white w-4 h-4" />
            </div>
            <h1 className="text-base font-bold tracking-tight">유아이 사주상담</h1>
          </div>
          
          <div className="flex items-center gap-1">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              {isDarkMode ? <Sun className="w-5 h-5 opacity-70" /> : <Moon className="w-5 h-5 opacity-70" />}
            </button>
          </div>
        </header>

      {/* Main Content */}
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
              <div className="flex-1 overflow-y-auto p-5 space-y-6 hide-scrollbar">
                <div className="text-center space-y-2 py-2">
                  <h2 className="text-2xl font-handwriting leading-tight text-cobalt">안녕하세요.<br/>유아이 사주상담입니다.</h2>
                  <p className="text-[10px] opacity-60 leading-relaxed px-4">
                    음성으로 말하거나 정보를 입력하여<br/>당신의 삶을 분석해 보세요.
                  </p>
                </div>

                {/* Voice Input Block */}
                <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200 shadow-md'} flex flex-row items-center gap-4`}>
                  <button 
                    onClick={handleVoiceInput}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600 shadow-lg shadow-indigo-500/30'}`}
                  >
                    <Mic className={`w-6 h-6 text-white ${isListening ? 'scale-110' : ''}`} />
                  </button>
                  <div className="text-left flex-1">
                    <p className="text-xs font-bold mb-0.5">{isListening ? `말씀해 주세요... (${countdown}초)` : "음성으로 입력하기"}</p>
                    {isListening && voiceText ? (
                      <p className="text-[10px] text-indigo-400 font-medium animate-pulse line-clamp-2">{voiceText}</p>
                    ) : (
                      <p className="text-[9px] opacity-50">예: "내 이름은 김유아이, 90년 5월 15일 오후 2시 양력 남자야"</p>
                    )}
                  </div>
                </div>

                <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-lg'} space-y-4`}>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">사용자 이름</label>
                    <input 
                      type="text" 
                      placeholder="이름을 입력하세요"
                      value={userData.name}
                      onChange={(e) => setUserData({...userData, name: e.target.value})}
                      className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-black/10'}`}
                    />
                  </div>

                  {/* Dropdown Inputs */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold opacity-40 ml-1">년도</label>
                        <select 
                          value={userData.birthYear}
                          onChange={(e) => setUserData({...userData, birthYear: e.target.value})}
                          className={`w-full px-2 py-2 rounded-xl border text-xs outline-none ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-black/10'}`}
                        >
                          {Array.from({length: 100}, (_, i) => 2026 - i).map(y => (
                            <option key={y} value={y}>{y}년</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold opacity-40 ml-1">월</label>
                        <select 
                          value={userData.birthMonth}
                          onChange={(e) => setUserData({...userData, birthMonth: e.target.value})}
                          className={`w-full px-2 py-2 rounded-xl border text-xs outline-none ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-black/10'}`}
                        >
                          {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{m}월</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold opacity-40 ml-1">일</label>
                        <select 
                          value={userData.birthDay}
                          onChange={(e) => setUserData({...userData, birthDay: e.target.value})}
                          className={`w-full px-2 py-2 rounded-xl border text-xs outline-none ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-black/10'}`}
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
                          <label className="text-[9px] font-bold opacity-40 ml-1">시</label>
                          <select 
                            value={userData.birthHour}
                            onChange={(e) => setUserData({...userData, birthHour: e.target.value})}
                            className={`w-full px-2 py-2 rounded-xl border text-xs outline-none ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-black/10'}`}
                          >
                            {Array.from({length: 24}, (_, i) => i).map(h => (
                              <option key={h} value={h}>{h}시</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold opacity-40 ml-1">분</label>
                          <select 
                            value={userData.birthMinute}
                            onChange={(e) => setUserData({...userData, birthMinute: e.target.value})}
                            className={`w-full px-2 py-2 rounded-xl border text-xs outline-none ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-black/10'}`}
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
                        checked={userData.unknownTime}
                        onChange={(e) => setUserData({...userData, unknownTime: e.target.checked})}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="unknownTime" className="text-[11px] font-medium opacity-70">생시를 몰라요</label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                      <div className="flex items-center gap-1.5 bg-black/10 p-1 rounded-xl w-full">
                        <button 
                          onClick={() => setUserData({...userData, calendarType: 'solar'})}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${userData.calendarType === 'solar' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-40'}`}
                        >
                          양력
                        </button>
                        <button 
                          onClick={() => setUserData({...userData, calendarType: 'lunar'})}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${userData.calendarType === 'lunar' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-40'}`}
                        >
                          음력(평)
                        </button>
                        <button 
                          onClick={() => setUserData({...userData, calendarType: 'leap'})}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${userData.calendarType === 'leap' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-40'}`}
                        >
                          음력(윤)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                      <div className="flex items-center gap-1.5 bg-black/10 p-1 rounded-xl w-full">
                        <button onClick={() => setUserData({...userData, gender: 'M'})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${userData.gender === 'M' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-40'}`}>남자</button>
                        <button onClick={() => setUserData({...userData, gender: 'F'})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${userData.gender === 'F' ? 'bg-rose-600 text-white shadow-md' : 'opacity-40'}`}>여자</button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-center text-[10px] opacity-30 tracking-tight pb-4">정확한 분석을 위해 태어난 시간을 꼭 확인해 주세요.</p>
              </div>

              {/* Sticky Bottom Button */}
              <div className={`p-5 border-t ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-white/80 border-black/5'} backdrop-blur-lg`}>
                <button 
                  onClick={handleStart}
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  운세 분석 시작
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 overflow-y-auto p-4 space-y-6 hide-scrollbar"
            >
              <div className="space-y-6">
                {/* Saju Grid - 2x4 Layout */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold opacity-60">사주팔자</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {sajuResult.map((p, i) => {
                      if (userData.unknownTime && p.title === '시주') return null;
                      return (
                        <div key={i} className={`p-2 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'} flex flex-col items-center gap-1`}>
                          <span className="text-[10px] font-bold opacity-50">{p.title}</span>
                          <div className="flex flex-col gap-1">
                            {[p.stem, p.branch].map((item, j) => (
                              <HanjaBox key={j} hanja={item.hanja} isDarkMode={isDarkMode} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-black/5 dark:border-white/5">
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed text-center">
                    본 분석 결과는 인공지능의 해석이며, 과학적 사실이 아닌 참고 용도로만 사용해 주세요. 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
                  </p>
                </div>

                {/* Five Elements Distribution */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold opacity-60">오행분포</h3>
                  <div className="flex gap-4">
                    <div className={`flex-1 p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'}`}>
                      <p className="text-xs opacity-70 leading-relaxed">
                        사용자의 오행 분포는 {getChartData().map(d => `${d.name}${d.value}개`).join(', ')}으로 구성되어 있습니다.
                      </p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'}`}>
                      <ResponsiveContainer width={100} height={100}>
                        <PieChart>
                          <Pie data={getChartData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40}>
                            {getChartData().map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getChartData().map((d, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                        {d.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Jiji and Jijangan */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold opacity-60">지지와 지장간</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {sajuResult.map((p, i) => {
                      if (userData.unknownTime && p.title === '시주') return null;
                      const isYang = yinYangMap[p.branch.hanja] === '+';
                      const elementColor = 
                        p.branch.element === 'wood' ? 'text-emerald-500' :
                        p.branch.element === 'fire' ? 'text-red-500' :
                        p.branch.element === 'earth' ? 'text-amber-700' :
                        p.branch.element === 'metal' ? 'text-zinc-400' :
                        'text-black';
                      const bgColor = 
                        p.branch.element === 'wood' ? 'bg-emerald-500' :
                        p.branch.element === 'fire' ? 'bg-red-500' :
                        p.branch.element === 'earth' ? 'bg-amber-700' :
                        p.branch.element === 'metal' ? 'bg-zinc-400' :
                        'bg-black';

                      return (
                        <div key={i} className={`p-2 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'} flex flex-col items-center gap-1`}>
                          <HanjaBox hanja={p.branch.hanja} isDarkMode={isDarkMode} />
                          <span className="text-[10px] font-bold opacity-70">{p.branch.hangul}({p.branch.hanja})</span>
                          <div className="flex gap-0.5 mt-1">
                            {p.branch.hidden.split(', ').map((h, k) => {
                              const hanja = Object.keys(hanjaToHangul).find(key => hanjaToHangul[key] === h) || '';
                              return <HanjaBox key={k} hanja={hanja} size="sm" isDarkMode={isDarkMode} />;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs opacity-70 leading-relaxed mt-2">
                    지지와 지장간은 사주의 뿌리이자 에너지가 저장된 곳입니다. 지장간은 지지 속에 숨겨진 천간의 기운으로, 당신의 내면적인 성향과 잠재력을 나타냅니다.
                  </p>
                </div>

                {/* Daeun Analysis */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold opacity-60">대운분석</h3>
                    {daeunResult.length > 0 && (
                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                        {daeunResult[0].startAge}대운
                      </span>
                    )}
                  </div>
                  
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'} overflow-x-auto`}>
                    <div className="flex gap-3 min-w-max pb-2">
                      {daeunResult.length > 0 ? daeunResult.map((dy, i) => {
                        const currentAge = 2026 - parseInt(userData.birthYear) + 1;
                        const isCurrentDaeun = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
                        
                        // Gyoun-gi check: within 1-2 years of transition
                        const isTransitioning = Math.abs(currentAge - dy.startAge) <= 1 || 
                                              (daeunResult[i+1] && Math.abs(currentAge - daeunResult[i+1].startAge) <= 1);

                        return (
                          <div key={i} className={`w-20 p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                            isCurrentDaeun 
                              ? 'border-indigo-500 bg-indigo-600/20 shadow-[0_0_15px_rgba(79,70,229,0.3)] ring-1 ring-indigo-500' 
                              : 'border-transparent bg-black/5 opacity-60'
                          }`}>
                            <div className="text-[10px] font-bold">{dy.startAge}세</div>
                            <div className="flex flex-col gap-1">
                              {[dy.stem, dy.branch].map((hanja, j) => (
                                <HanjaBox key={j} hanja={hanja} isDarkMode={isDarkMode} />
                              ))}
                            </div>
                            <div className="text-[9px] font-bold opacity-70">{hanjaToHangul[dy.stem]}{hanjaToHangul[dy.branch]}</div>
                            {isCurrentDaeun && isTransitioning && (
                              <div className="mt-1 px-1.5 py-0.5 bg-rose-500/20 text-rose-500 text-[8px] font-bold rounded-md animate-pulse">
                                교운기
                              </div>
                            )}
                          </div>
                        );
                      }) : (
                        <div className="text-xs opacity-40 py-4 w-full text-center">분석을 시작하면 대운이 표시됩니다.</div>
                      )}
                    </div>
                  </div>

                  {/* Current Daeun Description */}
                  {daeunResult.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'}`}
                    >
                      {daeunResult.map((dy, i) => {
                        const currentAge = 2026 - parseInt(userData.birthYear) + 1;
                        const isCurrentDaeun = currentAge >= dy.startAge && (i === daeunResult.length - 1 || currentAge < daeunResult[i+1].startAge);
                        if (!isCurrentDaeun) return null;
                        
                        return (
                          <div key={i} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                              <h4 className="text-xs font-bold">현재 대운: {dy.startAge}세 {hanjaToHangul[dy.stem]}{hanjaToHangul[dy.branch]}대운</h4>
                            </div>
                            <p className="text-xs opacity-80 leading-relaxed italic">
                              "{dy.description}"
                            </p>
                            {Math.abs(currentAge - dy.startAge) <= 1 && (
                              <div className="flex items-start gap-2 p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                <Info className="w-3 h-3 text-rose-500 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-rose-500 leading-tight">
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
                <div className="space-y-2">
                  <h3 className="text-sm font-bold opacity-60">용신(用神) 정밀 분석</h3>
                  {yongshinResult && (
                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-lg'} space-y-5`}>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">핵심 에너지</p>
                          <h4 className="text-xl font-bold text-indigo-500">{userData.name}님의 용신: {yongshinResult.yongshin}</h4>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                          yongshinResult.yongshin.includes('목') ? 'bg-emerald-500' :
                          yongshinResult.yongshin.includes('화') ? 'bg-red-500' :
                          yongshinResult.yongshin.includes('토') ? 'bg-amber-700' :
                          yongshinResult.yongshin.includes('금') ? 'bg-zinc-400' :
                          'bg-indigo-600'
                        }`}>
                          {yongshinResult.yongshin.charAt(0)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} border ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                          <p className="text-[9px] font-bold opacity-40 mb-1">일간 강약 (억부)</p>
                          <p className="text-xs font-bold">{yongshinResult.strength} ({yongshinResult.score}점)</p>
                          <p className="text-[10px] text-indigo-500 mt-1 font-bold">억부용신: {yongshinResult.eokbuYongshin}</p>
                        </div>
                        <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} border ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                          <p className="text-[9px] font-bold opacity-40 mb-1">계절 기운 (조후)</p>
                          <p className="text-xs font-bold">{yongshinResult.johooStatus}</p>
                          <p className="text-[10px] text-indigo-500 mt-1 font-bold">조후용신: {yongshinResult.johooYongshin}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">분석 근거</p>
                        <p className="text-xs opacity-70 leading-relaxed">
                          {yongshinResult.logicBasis}
                        </p>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-white/5">
                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">실생활 가이드</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="text-[10px] opacity-50">행운의 색:</span>
                            <span className="text-[10px] font-bold">{yongshinResult.advice.color}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="text-[10px] opacity-50">행운의 숫자:</span>
                            <span className="text-[10px] font-bold">{yongshinResult.advice.numbers}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="text-[10px] opacity-50">행운의 방향:</span>
                            <span className="text-[10px] font-bold">{yongshinResult.advice.direction}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="text-[10px] opacity-50">추천 행위:</span>
                            <span className="text-[10px] font-bold">{yongshinResult.advice.action}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 hide-scrollbar">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : isDarkMode 
                          ? 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                    }`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full w-fit border ${
                    isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'
                  }`}>
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                    <span className={`text-[10px] ${isDarkMode ? 'opacity-50' : 'text-gray-500'}`}>분석 중...</span>
                  </div>
                )}
              </div>
              <div className={`p-4 border-t safe-bottom ${
                isDarkMode ? 'border-white/10 bg-black/40' : 'border-gray-200 bg-gray-50/80'
              }`}>
                {suggestions.length > 0 && (
                  <div className="flex flex-col gap-2 mb-4">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(s)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl border text-[12px] transition-all ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 text-gray-300 opacity-70 hover:opacity-100 hover:bg-white/10'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 shadow-sm'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="max-w-4xl mx-auto relative">
                  <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="상담사에게 물어보세요..."
                    className={`w-full border rounded-2xl py-3.5 pl-5 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                  <button onClick={() => handleSend()} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg active:scale-90 transition-transform">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "report" && (
            <motion.div 
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 overflow-y-auto p-5 hide-scrollbar bg-zinc-50 dark:bg-black"
            >
              <div className="max-w-4xl mx-auto space-y-8 pb-10">
                {/* Header Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 sticky top-0 bg-zinc-50/80 dark:bg-black/80 backdrop-blur-md py-4 z-10">
                  <button 
                    onClick={handleGenerateReport}
                    disabled={loading || sajuResult.length === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    <Compass className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    나의 운명 살펴보기
                  </button>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => alert("PDF 저장 기능은 준비 중입니다.")}
                      className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 transition-colors shadow-sm"
                      title="PDF 저장"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => alert("이메일 전송 기능은 준비 중입니다.")}
                      className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 transition-colors shadow-sm"
                      title="이메일 보내기"
                    >
                      <Mail className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Report Content */}
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-32 space-y-6"
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
                    >
                      <ReportAccordion content={reportContent} isDarkMode={isDarkMode} />
                      
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
                      className="text-center py-20 space-y-6"
                    >
                      <div className="w-24 h-24 rounded-full bg-indigo-500/5 flex items-center justify-center mx-auto border border-indigo-500/10">
                        <FileText className="w-10 h-10 text-indigo-500/30" />
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold">운세 리포트가 아직 없습니다.</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                          상단의 <strong>'나의 운명 살펴보기'</strong> 버튼을 눌러보세요.<br/>
                          AI 디렉터가 당신의 사주 데이터를 기반으로 힙한 MZ 감성 리포트를 생성해 드립니다.
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
              className="flex-1 overflow-y-auto p-4 space-y-6 hide-scrollbar bg-zinc-50 dark:bg-black"
            >
              <div className="max-w-md mx-auto space-y-8 pb-10">
                {/* CEO Greeting Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-xl border border-black/5 dark:border-white/5 flex flex-col">
                  <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 opacity-10 pointer-events-none">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <circle cx="100" cy="0" r="80" fill="none" stroke="white" strokeWidth="0.5" />
                        <circle cx="100" cy="0" r="60" fill="none" stroke="white" strokeWidth="0.5" />
                      </svg>
                    </div>
                    <h2 className="text-white text-2xl font-serif font-bold leading-tight">
                      CEO 인사말
                    </h2>
                    <p className="text-indigo-100 text-[10px] mt-2 font-serif opacity-70">당신의 삶을 비추는 고요한 등불</p>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="space-y-4 text-sm leading-relaxed font-serif text-zinc-700 dark:text-zinc-300">
                      <p className="font-bold text-zinc-900 dark:text-white">안녕하세요. 삶의 소중한 길목에서 유아이를 찾아주신 귀하께 깊은 감사의 인사를 전합니다.</p>
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
                    <div className="pt-6 border-t border-black/5 dark:border-white/5 text-right">
                      <p className="text-xs font-serif opacity-60">유아이사주상담 디렉터 배상</p>
                    </div>
                  </div>
                </div>

                {/* Card 1: Why UI App is better */}
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-xl border border-black/5 dark:border-white/5 flex flex-col min-h-[500px]">
                  <div className="bg-[#0047AB] p-8 text-center">
                    <h2 className="text-white text-3xl font-handwriting leading-tight">
                      유아이 앱이 다른 앱보다<br/>좋은 세가지 이유
                    </h2>
                  </div>
                  <div className="flex-1 p-8 flex flex-col justify-around space-y-8">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                        <div className="relative">
                          <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400 opacity-40" />
                          <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 absolute -bottom-1 -right-1" />
                          <div className="absolute top-0 left-0 w-full h-0.5 bg-rose-500 rotate-45 origin-center translate-y-4"></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">개인정보 로컬 처리 방침</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                          로그인 없이 사용자 정보를 서버에 저장하지 않습니다. 모든 데이터는 기기에만 임시 저장됩니다.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                        <Puzzle className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">완벽한 데이터 파기</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                          앱을 삭제하거나 브라우저 캐시를 삭제하면 모든 상담 내역과 정보가 즉시 영구적으로 사라집니다.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                        <div className="relative">
                          <Bot className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 absolute -top-1 -right-1" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">안전한 AI 가이드라인</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                          의료, 법률 등 전문 영역은 AI가 답변을 거부하며, 전문가 상담을 권장하는 안전 장치가 마련되어 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: How to input info */}
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-xl border border-black/5 dark:border-white/5 flex flex-col min-h-[500px]">
                  <div className="bg-[#0047AB] p-8 text-center">
                    <h2 className="text-white text-3xl font-handwriting leading-tight">
                      사용자 정보 입력 방법
                    </h2>
                  </div>
                  <div className="flex-1 p-8 space-y-8">
                    <div className="space-y-6">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center shrink-0">
                          <Mic className="w-6 h-6 text-rose-500 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold">WELCOME 화면 마이크 클릭</h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">마이크를 눌러 음성으로 정보를 입력하세요.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center shrink-0">
                          <Clock className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold">생시 미입력 가능</h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">모르면 비워두세요. 6개의 글자로도 충분합니다.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center shrink-0">
                          <Calendar className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold">양력/음력 자동 인식</h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">별도 선택이 없으면 기본 양력으로 분석합니다.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                          <Zap className="w-6 h-6 text-white fill-white" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">분석 시작</h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">버튼을 누르면 당신의 운세 분석이 시작됩니다.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Philosophy */}
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-xl border border-black/5 dark:border-white/5 flex flex-col min-h-[600px]">
                  <div className="bg-[#0047AB] p-8 text-center">
                    <h2 className="text-white text-3xl font-handwriting leading-tight">
                      유아이의 운세분석 과정과<br/>운세에 대한 철학
                    </h2>
                  </div>
                  <div className="flex-1 p-8 flex flex-col">
                    {/* Process Flow */}
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-black/5 dark:border-white/5">
                          <User className="w-6 h-6 text-zinc-400" />
                        </div>
                        <div className="w-8 h-px bg-zinc-200 dark:bg-zinc-700 border-t border-dashed"></div>
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <Cpu className="w-8 h-8 text-white animate-pulse" />
                        </div>
                        <div className="w-8 h-px bg-zinc-200 dark:bg-zinc-700 border-t border-dashed"></div>
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-black/5 dark:border-white/5">
                          <FileText className="w-6 h-6 text-indigo-500" />
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">Process Flow</p>
                    </div>

                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-8"></div>

                    {/* Philosophy */}
                    <div className="flex-1 flex flex-col items-center text-center space-y-6">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        <Waves className="w-full h-full text-indigo-500/20 absolute animate-pulse" />
                        <div className="relative z-10 p-4 bg-white dark:bg-zinc-900 rounded-full border-2 border-indigo-500 shadow-xl">
                          <Compass className="w-10 h-10 text-indigo-600" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                          "운명은 정해진 결말이 아니라,<br/>우리가 조종하는 돛의 방향입니다."
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          만세력 기반의 정밀 분석과 AI의 전략적 해석으로,<br/>
                          당신의 삶을 능동적으로 이끌 최고의 대응 전략을 제시합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-center">
                  <p className="text-[10px] font-bold text-indigo-400/70 leading-relaxed">
                    유아이(UI)와 함께 당신의 운명을 디자인하세요.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tab Navigation - Mobile App Style */}
      <nav className={`px-4 pt-3 pb-8 border-t ${isDarkMode ? 'border-white/10 bg-black/60' : 'border-black/5 bg-white'} backdrop-blur-xl safe-bottom z-30`}>
        <div className="max-w-md mx-auto flex items-center justify-around">
          {[
            { id: "welcome", icon: User, label: "내정보" },
            { id: "dashboard", icon: LayoutDashboard, label: "대시보드" },
            { id: "chat", icon: MessageCircle, label: "상담" },
            { id: "report", icon: FileText, label: "리포트" },
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
              <span className="text-[9px] font-bold tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
      </div>
    </div>
  );
};

export default App;
