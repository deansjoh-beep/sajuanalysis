import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, Settings2, Sun, Moon, X, LayoutDashboard, MessageCircle, FileText, Send, Download, Mail, BookOpen, Compass, Sparkles, Database, Mic, ShieldCheck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'motion/react';
import { Solar, Lunar } from 'lunar-javascript';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import Markdown from 'react-markdown';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';
import { getGanZhiInfo, calculateSimpleSaju } from './utils/sajuAlgorithm';

const EVENT_TYPES = [
  { id: 'marriage', label: '결혼/이별 (가장 중요한 인연을 만났거나 헤어진 해)' },
  { id: 'move', label: '이동/독립 (내 집 마련, 해외 이주 등)' },
  { id: 'career', label: '커리어 정점 (큰 승진, 사업 성공 등)' },
  { id: 'health', label: '사고/건강 (크게 몸이 아팠거나 수술한 해)' },
  { id: 'other', label: '기타 주요 사건' }
];

type PastEvent = { year: string; type: string; description: string };

type ChatMessage = {
  role: 'user' | 'ai' | 'system' | 'estimator_result';
  text: string;
  data?: any;
};

const getElementColors = (isDark: boolean) => ({
  wood: isDark ? 'bg-neutral-900 text-emerald-400 border-emerald-800/60' : 'bg-white text-emerald-700 border-emerald-200',
  fire: isDark ? 'bg-neutral-900 text-rose-400 border-rose-800/60' : 'bg-white text-rose-700 border-rose-200',
  earth: isDark ? 'bg-neutral-900 text-amber-400 border-amber-800/60' : 'bg-white text-amber-700 border-amber-200',
  metal: isDark ? 'bg-neutral-900 text-slate-300 border-slate-600/60' : 'bg-white text-slate-700 border-slate-200',
  water: isDark ? 'bg-neutral-900 text-indigo-400 border-indigo-800/60' : 'bg-white text-indigo-700 border-indigo-200',
  unknown: isDark ? 'bg-neutral-900 text-neutral-500 border-neutral-700/60' : 'bg-neutral-100 text-neutral-400 border-neutral-200',
});

const getTextColors = (isDark: boolean) => ({
  wood: isDark ? 'text-emerald-400' : 'text-emerald-600',
  fire: isDark ? 'text-rose-400' : 'text-rose-600',
  earth: isDark ? 'text-amber-400' : 'text-amber-600',
  metal: isDark ? 'text-slate-300' : 'text-slate-600',
  water: isDark ? 'text-indigo-400' : 'text-indigo-600',
  unknown: isDark ? 'text-neutral-500' : 'text-neutral-400',
});

const deityExplanations: Record<string, string> = {
  '비견': '나와 같은 오행으로, 주체성, 독립심, 형제/동료를 의미합니다. 자수성가와 고집을 상징하기도 합니다.',
  '겁재': '나와 같은 오행이나 음양이 다른 것으로, 경쟁심, 투쟁, 재물의 분탈을 의미합니다. 강한 추진력을 가지기도 합니다.',
  '식신': '내가 생(生)하는 오행으로 음양이 같은 것. 창의성, 표현력, 의식주, 풍요로움, 낙천적인 성향을 의미합니다.',
  '상관': '내가 생(生)하는 오행으로 음양이 다른 것. 뛰어난 언변, 반항심, 혁신, 예술적 재능을 의미합니다.',
  '편재': '내가 극(剋)하는 오행으로 음양이 같은 것. 큰 재물, 투기성, 공간 지각력, 활동적인 역마성을 의미합니다.',
  '정재': '내가 극(剋)하는 오행으로 음양이 다른 것. 안정적인 재물, 월급, 꼼꼼함, 성실함, 남성에게는 정식 배우자를 의미합니다.',
  '편관': '나를 극(剋)하는 오행으로 음양이 같은 것. 권력, 명예, 카리스마, 스트레스, 극복해야 할 난관을 의미합니다.',
  '정관': '나를 극(剋)하는 오행으로 음양이 다른 것. 합리적인 규칙, 직장, 명예, 책임감, 여성에게는 정식 배우자를 의미합니다.',
  '편인': '나를 생(生)하는 오행으로 음양이 같은 것. 직관력, 신비주의, 학문, 예술, 외골수 기질을 의미합니다.',
  '정인': '나를 생(生)하는 오행으로 음양이 다른 것. 정통 학문, 도덕성, 어머니의 사랑, 문서운, 수용성을 의미합니다.',
  '일간': '사주의 주체인 \'나\' 자신을 나타냅니다. 전체 사주의 중심이 되는 글자입니다.'
};

const hanjaToHangul: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'
};

const hiddenStems: Record<string, string[]> = {
  '子': ['임', '계'], '丑': ['계', '신', '기'], '寅': ['무', '병', '갑'], '卯': ['갑', '을'],
  '辰': ['을', '계', '무'], '巳': ['무', '경', '병'], '午': ['병', '기', '정'], '未': ['정', '을', '기'],
  '申': ['무', '임', '경'], '酉': ['경', '신'], '戌': ['신', '정', '무'], '亥': ['무', '갑', '임']
};

const getElementAndYinYang = (char: string) => {
  const data: Record<string, { e: string, y: string }> = {
    '甲': { e: 'wood', y: '+' }, '乙': { e: 'wood', y: '-' },
    '丙': { e: 'fire', y: '+' }, '丁': { e: 'fire', y: '-' },
    '戊': { e: 'earth', y: '+' }, '己': { e: 'earth', y: '-' },
    '庚': { e: 'metal', y: '+' }, '辛': { e: 'metal', y: '-' },
    '壬': { e: 'water', y: '+' }, '癸': { e: 'water', y: '-' },
    '子': { e: 'water', y: '-' }, '丑': { e: 'earth', y: '-' },
    '寅': { e: 'wood', y: '+' }, '卯': { e: 'wood', y: '-' },
    '辰': { e: 'earth', y: '+' }, '巳': { e: 'fire', y: '+' },
    '午': { e: 'fire', y: '-' }, '未': { e: 'earth', y: '-' },
    '申': { e: 'metal', y: '+' }, '酉': { e: 'metal', y: '-' },
    '戌': { e: 'earth', y: '+' }, '亥': { e: 'water', y: '+' }
  };
  return data[char];
};

const checkElementColor = (kanji: string) => {
  const data = getElementAndYinYang(kanji);
  return data ? data.e : 'earth';
};

const calculateDeity = (dayStem: string, targetChar: string) => {
  if (dayStem === targetChar) return '비견';
  const me = getElementAndYinYang(dayStem);
  const target = getElementAndYinYang(targetChar);
  if (!me || !target) return '';

  const sameYinYang = me.y === target.y;

  if (me.e === target.e) return sameYinYang ? '비견' : '겁재';
  if (me.e === 'wood' && target.e === 'fire') return sameYinYang ? '식신' : '상관';
  if (me.e === 'fire' && target.e === 'earth') return sameYinYang ? '식신' : '상관';
  if (me.e === 'earth' && target.e === 'metal') return sameYinYang ? '식신' : '상관';
  if (me.e === 'metal' && target.e === 'water') return sameYinYang ? '식신' : '상관';
  if (me.e === 'water' && target.e === 'wood') return sameYinYang ? '식신' : '상관';

  if (me.e === 'wood' && target.e === 'earth') return sameYinYang ? '편재' : '정재';
  if (me.e === 'fire' && target.e === 'metal') return sameYinYang ? '편재' : '정재';
  if (me.e === 'earth' && target.e === 'water') return sameYinYang ? '편재' : '정재';
  if (me.e === 'metal' && target.e === 'wood') return sameYinYang ? '편재' : '정재';
  if (me.e === 'water' && target.e === 'fire') return sameYinYang ? '편재' : '정재';

  if (me.e === 'wood' && target.e === 'metal') return sameYinYang ? '편관' : '정관';
  if (me.e === 'fire' && target.e === 'water') return sameYinYang ? '편관' : '정관';
  if (me.e === 'earth' && target.e === 'wood') return sameYinYang ? '편관' : '정관';
  if (me.e === 'metal' && target.e === 'fire') return sameYinYang ? '편관' : '정관';
  if (me.e === 'water' && target.e === 'earth') return sameYinYang ? '편관' : '정관';

  if (me.e === 'wood' && target.e === 'water') return sameYinYang ? '편인' : '정인';
  if (me.e === 'fire' && target.e === 'wood') return sameYinYang ? '편인' : '정인';
  if (me.e === 'earth' && target.e === 'fire') return sameYinYang ? '편인' : '정인';
  if (me.e === 'metal' && target.e === 'earth') return sameYinYang ? '편인' : '정인';
  if (me.e === 'water' && target.e === 'metal') return sameYinYang ? '편인' : '정인';

  return '';
};

const calculateRealSajuAndDaewun = (dateStr: string, timeStr: string, calendarType: string, gender: string, isTimeUnknown: boolean = false) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  let lunar;
  if (calendarType === 'solar') {
    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    lunar = solar.getLunar();
  } else {
    const m = calendarType === 'lunar-leap' ? -month : month;
    lunar = Lunar.fromYmdHms(year, m, day, hour, minute, 0);
  }

  const eightChar = lunar.getEightChar();
  
  const yearPillar = eightChar.getYear();
  const monthPillar = eightChar.getMonth();
  const dayPillar = eightChar.getDay();
  const timePillar = eightChar.getTime();

  const dayStem = dayPillar.charAt(0);

  const formatPillar = (title: string, pillarStr: string, isDay = false) => {
    const stemHanja = pillarStr.charAt(0);
    const branchHanja = pillarStr.charAt(1);
    return {
      title,
      isUnknown: false,
      stem: {
        hanja: stemHanja,
        hangul: hanjaToHangul[stemHanja],
        element: checkElementColor(stemHanja),
        deity: isDay ? '일간' : calculateDeity(dayStem, stemHanja)
      },
      branch: {
        hanja: branchHanja,
        hangul: hanjaToHangul[branchHanja],
        element: checkElementColor(branchHanja),
        deity: calculateDeity(dayStem, branchHanja),
        hidden: hiddenStems[branchHanja] || []
      }
    };
  };

  const sajuResult = [
    isTimeUnknown ? {
      title: '시주',
      isUnknown: true,
      stem: { hanja: '?', hangul: '모름', element: 'unknown', deity: '미정' },
      branch: { hanja: '?', hangul: '모름', element: 'unknown', deity: '미정', hidden: [] }
    } : formatPillar('시주', timePillar),
    formatPillar('일주', dayPillar, true),
    formatPillar('월주', monthPillar),
    formatPillar('년주', yearPillar)
  ];

  const genderNum = gender === 'M' ? 1 : 0;
  const yun = eightChar.getYun(genderNum);
  const daYunArr = yun.getDaYun(11);
  
  // 한국식 대운수 계산 (lunar-javascript의 getStartYear()가 대운수와 일치함)
  let daewunNum = yun.getStartYear();
  if (daewunNum === 0) daewunNum = 1; // 대운수가 0인 경우 1로 보정

  const daewunResult = daYunArr.slice(1, 11).map((dy, index) => {
    const ganZhi = dy.getGanZhi();
    const age = daewunNum + (index * 10);
    const daewunYear = year + age - 1; // 한국 나이 기준 연도 계산
    return {
      age: age,
      year: daewunYear,
      stem: {
        hanja: ganZhi.charAt(0),
        element: checkElementColor(ganZhi.charAt(0))
      },
      branch: {
        hanja: ganZhi.charAt(1),
        element: checkElementColor(ganZhi.charAt(1))
      }
    };
  });

  return { sajuResult, daewunResult };
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'report' | 'guide' | 'article'>('dashboard');
  
  // Input State
  const [userName, setUserName] = useState('사용자');
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar' | 'lunar-leap'>('solar');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthDate, setBirthDate] = useState('2024-05-10');
  const [birthTime, setBirthTime] = useState('10:00');
  const [isTimeUnknown, setIsTimeUnknown] = useState(false);
  
  // Legal Consent State
  const [isPrivacyAgreed, setIsPrivacyAgreed] = useState(false);
  const [isDisclaimerAgreed, setIsDisclaimerAgreed] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiReport, setAiReport] = useState<any>(null);
  
  // Saju State
  const [sajuData, setSajuData] = useState(() => calculateRealSajuAndDaewun('2024-05-10', '10:00', 'solar', 'M', false));
  const [selectedDeity, setSelectedDeity] = useState<string | null>(null);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const initialData = calculateRealSajuAndDaewun('2024-05-10', '10:00', 'solar', 'M', false);
    const gyeok = initialData.sajuResult[2].branch.deity + '격';
    return [
      { role: 'ai', text: `안녕하세요! AI 운세 상담사입니다. 입력하신 내용을 보니 **${gyeok}**인 사주이시네요. 이제 상담을 시작해 볼까요? 무엇이든 알려주세요. 음성탭을 눌러 말로 해주셔도 됩니다.` },
      { role: 'system', text: '본 상담은 사용자가 입력한 생년월일시를 가지고 만세력에서 사주정보를 추출하여 AI(Gemini 3.0)가 분석합니다. 상담 내용은 본 사이트에 저장되지 않습니다.' }
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Time Estimator State
  const [showTimeEstimator, setShowTimeEstimator] = useState(false);
  const [pastEvents, setPastEvents] = useState<PastEvent[]>([
    { year: '', type: 'marriage', description: '' },
    { year: '', type: 'move', description: '' },
    { year: '', type: 'career', description: '' }
  ]);
  const [isEstimatingTime, setIsEstimatingTime] = useState(false);

  const daewunContainerRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const birthYear = parseInt(birthDate.split('-')[0]) || currentYear;
  const currentAge = currentYear - birthYear + 1;

  let currentDaewunIndex = -1;
  for (let i = sajuData.daewunResult.length - 1; i >= 0; i--) {
    if (currentAge >= sajuData.daewunResult[i].age) {
      currentDaewunIndex = i;
      break;
    }
  }

  useEffect(() => {
    if (activeTab === 'dashboard' && currentDaewunIndex !== -1 && daewunContainerRef.current) {
      const container = daewunContainerRef.current;
      const currentElement = container.children[currentDaewunIndex] as HTMLElement;
      if (currentElement) {
        setTimeout(() => {
          const scrollLeft = currentElement.offsetLeft - (container.clientWidth / 2) + (currentElement.clientWidth / 2);
          container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [activeTab, sajuData, currentDaewunIndex]);

  const colors = getElementColors(isDarkMode);
  const textColors = getTextColors(isDarkMode);

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('이 브라우저에서는 음성 인식을 지원하지 않습니다. 크롬 브라우저를 이용해주세요.');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleEmailReport = () => {
    const subject = encodeURIComponent(`[유아이(주)] ${userName}님의 운세 리포트`);
    const body = encodeURIComponent(`
안녕하세요 ${userName}님,
요청하신 운세 리포트입니다.

1. 본연의 기질과 성격
${aiReport?.nature || '분석 중...'}

2. 사회적 환경 및 역량 발휘 방식
${aiReport?.social || '분석 중...'}
핵심 역량 키워드: ${aiReport?.careerKeywords || ''}

3. 인생 흐름
${aiReport?.lifeFlow || '분석 중...'}

4. 오행 밸런스 및 실생활 보완책
${aiReport?.balance || '분석 중...'}
- 행운의 색상: ${aiReport?.luckyColor || ''}
- 추천 습관: ${aiReport?.habits || ''}
- 길한 방향: ${aiReport?.direction || ''}

5. 영역별 운세
- 재물운: ${aiReport?.wealth || ''}
- 연애/결혼운: ${aiReport?.love || ''}
- 직업/적성: ${aiReport?.career || ''}
- 건강운: ${aiReport?.health || ''}

6. 용신 분석
- 조후용신: ${aiReport?.johuYongsin || ''}
- 억부용신: ${aiReport?.eokbuYongsin || ''}
- 활용법: ${aiReport?.yongsinTips || ''}

Powered by 유아이(주) - 정밀 만세력 데이터 기반
    `.trim());
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('fortune-report-content');
    if (!element) return;

    try {
      setIsLoading(true);
      
      // html-to-image handles modern CSS like oklch much better than html2canvas
      const dataUrl = await htmlToImage.toPng(element, {
        backgroundColor: isDarkMode ? '#171717' : '#ffffff',
        quality: 1,
        pixelRatio: 2,
        style: {
          padding: '40px',
          borderRadius: '0',
          margin: '0',
          width: '800px' // Fixed width for consistent PDF layout
        }
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${userName}_운세리포트.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF 생성 중 오류가 발생했습니다. 브라우저의 인쇄 기능을 이용해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const handleEstimateTime = async () => {
    const validEvents = pastEvents.filter(e => e.year && e.type);
    if (validEvents.length === 0) {
      alert("최소 1개 이상의 과거 사건을 입력해주세요.");
      return;
    }

    setIsEstimatingTime(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const eventsText = validEvents.map((e, i) => `${i+1}. ${e.year}년: ${EVENT_TYPES.find(t => t.id === e.type)?.label} - ${e.description}`).join('\n');
      
      const currentSaju = calculateRealSajuAndDaewun(birthDate, '12:00', calendarType, gender, true);
      const sajuContext = `
      [사용자 기본 정보]
      - 성별: ${gender === 'M' ? '남성' : '여성'}
      - 생년월일: ${birthDate} (양력/음력: ${calendarType})
      
      [사주 원국 (3기둥 6글자)]
      - 년주: ${currentSaju.sajuResult[3].stem.hanja}${currentSaju.sajuResult[3].branch.hanja}
      - 월주: ${currentSaju.sajuResult[2].stem.hanja}${currentSaju.sajuResult[2].branch.hanja}
      - 일주: ${currentSaju.sajuResult[1].stem.hanja}${currentSaju.sajuResult[1].branch.hanja}
      `;

      const prompt = `
      [Role: 시주 추정 전문가]
      사용자가 제공한 삼주(년, 월, 일)와 과거 주요 사건(연도, 사건 종류)을 분석하여 가장 가능성 높은 생시를 추론하라.
      
      비용 최적화를 위해 AI 응답의 길이를 최대 1,000토큰 내외로 유지하고, 불필요한 미사여구는 생략하며 핵심적인 인사이트 중심으로 답변해줘.

      분석 프로세스:
      1. 사용자가 입력한 사건 연도의 간지(Gap-Ja)를 파악한다.
      2. 해당 연도의 운이 시주(時柱)의 천간/지지와 합(合)이나 충(沖)을 일으키는지 대조한다.
      3. 후보 시간대 2개를 제시하고, 각 시간대의 특징을 설명하여 사용자가 선택하게 한다.
      
      ${sajuContext}
      
      [과거 주요 사건]
      ${eventsText}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING, description: "예: 오시(11:30~13:30)" },
                    probability: { type: Type.NUMBER, description: "확률 (0~100)" },
                    reason: { type: Type.STRING, description: "추정 이유" }
                  },
                  required: ["time", "probability", "reason"]
                }
              },
              explanation: { type: Type.STRING, description: "전반적인 분석 내용" }
            },
            required: ["recommendations", "explanation"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      setChatMessages(prev => [
        ...prev,
        { role: 'user', text: '과거 사건으로 생시를 역추적해 주세요.' },
        { role: 'estimator_result', text: result.explanation || '분석이 완료되었습니다.', data: result.recommendations }
      ]);
      
      setShowTimeEstimator(false);
      setActiveTab('chat');
      
    } catch (e) {
      const errorMessage = parseGeminiError(e);
      alert(errorMessage);
    } finally {
      setIsEstimatingTime(false);
    }
  };

  const confirmTime = (timeStr: string) => {
    const timeMap: Record<string, string> = {
      '자시': '00:00',
      '축시': '02:00',
      '인시': '04:00',
      '묘시': '06:00',
      '진시': '08:00',
      '사시': '10:00',
      '오시': '12:00',
      '미시': '14:00',
      '신시': '16:00',
      '유시': '18:00',
      '술시': '20:00',
      '해시': '22:00'
    };

    let selectedHour = '12:00';
    for (const key in timeMap) {
      if (timeStr.includes(key)) {
        selectedHour = timeMap[key];
        break;
      }
    }

    setBirthTime(selectedHour);
    setIsTimeUnknown(false);
    
    const newData = calculateRealSajuAndDaewun(birthDate, selectedHour, calendarType, gender, false);
    setSajuData(newData);
    
    setChatMessages(prev => [
      ...prev,
      { role: 'system', text: `생시가 **${timeStr}**로 확정되어 사주 원국이 업데이트되었습니다. 이제 더 정밀한 분석이 가능합니다.` }
    ]);
  };

  const parseGeminiError = (error: any) => {
    console.error("Gemini API Error Detail:", error);
    
    // Check for 429 Resource Exhausted
    const errorString = JSON.stringify(error);
    if (errorString.includes("429") || errorString.includes("RESOURCE_EXHAUSTED") || (error?.message && error.message.includes("quota"))) {
      return "현재 AI 상담 이용량이 많아 일시적으로 서비스가 지연되고 있습니다. 잠시 후(약 1분 뒤) 다시 시도해 주시거나, 내일 다시 방문해 주세요. (API 할당량 초과)";
    }
    
    return "죄송합니다. 응답을 생성하는 중에 오류가 발생했습니다. 다시 시도해 주세요.";
  };

  const handleAnalyze = async () => {
    if (!isPrivacyAgreed || !isDisclaimerAgreed) {
      alert("모든 필수 동의 항목에 체크해주셔야 분석이 가능합니다.");
      return;
    }

    setIsLoading(true);
    setAiReport(null); // Clear previous report
    console.log("유아이(주) 비저장 원칙에 따라 브라우저 메모리 내에서만 처리를 시작합니다.");

    try {
      const newData = calculateRealSajuAndDaewun(birthDate, birthTime, calendarType, gender, isTimeUnknown);
      setSajuData(newData);
      const gyeok = newData.sajuResult[2].branch.deity + '격';
      
      const currentYear = new Date().getFullYear();
      const birthYear = parseInt(birthDate.split('-')[0]);
      const currentAge = currentYear - birthYear + 1;

      let currentDaewunStr = "대운 진입 전";
      for (let i = newData.daewunResult.length - 1; i >= 0; i--) {
        if (currentAge >= newData.daewunResult[i].age) {
          const dw = newData.daewunResult[i];
          currentDaewunStr = `${dw.age}세 시작 대운 [${dw.stem.hanja}${dw.branch.hanja}(${hanjaToHangul[dw.stem.hanja] || ''}${hanjaToHangul[dw.branch.hanja] || ''})]`;
          break;
        }
      }

      const currentLunar = Lunar.fromDate(new Date());
      const currentSewunHanja = currentLunar.getYearInGanZhi();
      const currentSewunHangul = (hanjaToHangul[currentSewunHanja.charAt(0)] || '') + (hanjaToHangul[currentSewunHanja.charAt(1)] || '');

      setIsAnalyzed(true);
      setChatMessages([
        { role: 'ai', text: '사주 정보를 분석하여 요약 리포트를 생성 중입니다...' },
        { role: 'system', text: '본 상담은 사용자가 입력한 생년월일시를 가지고 만세력에서 사주정보를 추출하여 AI가 분석합니다. 상담 내용은 본 사이트에 저장되지 않습니다.' }
      ]);

      // Generate AI Summary and Report using Flash model
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const summaryPrompt = `
        다음 사용자의 사주 정보를 바탕으로 전문적인 [AI 운세 리포트]를 생성해줘.
        
        [사주 정보]
        - 격국: ${gyeok}
        - 사주 원국: ${newData.sajuResult.map(p => p.stem.hangul + p.branch.hangul).join(' ')}
        - 일간: ${newData.sajuResult[1].stem.hangul}
        - 월지: ${newData.sajuResult[2].branch.hangul}
        - 현재 대운: ${currentDaewunStr}
        - 올해 세운: ${currentYear}년 [${currentSewunHanja}(${currentSewunHangul})]
        
        [작성 지침]
        1. 본연의 기질과 성격: "일간이 ${newData.sajuResult[1].stem.hangul}인 당신은 [비유적 표현] 같은 사람입니다."로 시작하고 비유적 표현을 사용하여 사용자의 이해를 도와 상세하게 설명해줘.
        2. 사회적 환경 및 역량 발휘 방식: "월지가 ${newData.sajuResult[2].branch.hangul}인 당신은 "로 시작하고 정확하고 쉬운 언어를 사용하여 매우 상세하게 설명해줘. 핵심 키워드로 이 사주에서 가장 강한 성분(예: 식신제살, 관인상생 등)을 현대적 직업 역량으로 깊이 있게 풀이해줘.
        3. 인생 흐름: 대운의 흐름을 참고하여 초년/중장년/노년의 인생 흐름을 구체적으로 짚어주고 현재 어디에 있는지를 알려줘. 현재 대운의 의미를 상세히 알려주고 적절한 조언을 해줘.
        4. 오행 밸런스 및 실생활 보완책: 사주의 오행 밸런스를 심층 해설하고 구체적인 보완책(행운의 색상, 추천습관, 길한 방향 등)을 알려줘.
        5. 영역별 운세: 재물운, 연애/결혼운, 직업/적성, 건강운을 각각 아주 상세히 짚어줘.
        6. 용신: 조후용신과 억부용신을 분석해 말해주고 구체적인 활용법을 세 가지 이상 제시해줘.
        7. 요약(summary): 채팅창에 보여줄 4~5문장 정도의 풍성하고 통찰력 있는 요약문.
        
        반드시 JSON 형식으로 답변해줘.
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: summaryPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                nature: { type: Type.STRING },
                social: { type: Type.STRING },
                careerKeywords: { type: Type.STRING },
                lifeFlow: { type: Type.STRING },
                balance: { type: Type.STRING },
                luckyColor: { type: Type.STRING },
                habits: { type: Type.STRING },
                direction: { type: Type.STRING },
                wealth: { type: Type.STRING },
                love: { type: Type.STRING },
                career: { type: Type.STRING },
                health: { type: Type.STRING },
                johuYongsin: { type: Type.STRING },
                eokbuYongsin: { type: Type.STRING },
                yongsinTips: { type: Type.STRING }
              },
              required: ["summary", "nature", "social", "careerKeywords", "lifeFlow", "balance", "luckyColor", "habits", "direction", "wealth", "love", "career", "health", "johuYongsin", "eokbuYongsin", "yongsinTips"]
            },
            systemInstruction: "당신은 유아이(주)의 전문 사주 분석가입니다. 사용자의 사주를 분석하여 통찰력 있는 리포트를 작성합니다. 친절하고 전문적인 톤을 유지하세요."
          }
        });

        const reportData = JSON.parse(response.text || '{}');
        setAiReport(reportData);
        setAiSummary(reportData.summary || '분석이 완료되었습니다.');
        
        setChatMessages(prev => [
          { role: 'ai', text: `안녕하세요! AI 운세 상담사입니다. 분석 결과, 귀하는 **${gyeok}**의 기질을 타고나셨습니다.\n\n${reportData.summary}\n\n이제 궁금하신 점을 물어봐 주세요!` },
          prev[1]
        ]);
      } catch (err) {
        const errorMessage = parseGeminiError(err);
        setAiSummary(errorMessage);
        // Set an empty report with error message to stop infinite loading
        setAiReport({
          summary: errorMessage,
          nature: "분석 중 오류가 발생했습니다.",
          social: "분석 중 오류가 발생했습니다.",
          careerKeywords: "-",
          lifeFlow: "분석 중 오류가 발생했습니다.",
          balance: "분석 중 오류가 발생했습니다.",
          luckyColor: "-",
          habits: "-",
          direction: "-",
          wealth: "-",
          love: "-",
          career: "-",
          health: "-",
          johuYongsin: "-",
          eokbuYongsin: "-",
          yongsinTips: "-"
        });
        const introMessage = isTimeUnknown 
          ? `생시를 제외한 삼주(년, 월, 일)를 바탕으로 분석한 결과입니다. 안녕하세요! AI 운세 상담사입니다. 입력하신 내용을 보니 **${gyeok}**인 사주이시네요. 이제 상담을 시작해 볼까요?`
          : `안녕하세요! AI 운세 상담사입니다. 입력하신 내용을 보니 **${gyeok}**인 사주이시네요. 이제 상담을 시작해 볼까요?`;
        setChatMessages(prev => [{ role: 'ai', text: introMessage }, prev[1]]);
      }
    } catch (e) {
      console.error("Failed to calculate Saju:", e);
      alert("날짜 형식이 올바르지 않거나 계산할 수 없는 날짜입니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate Element Distribution for Chart
  const elementCounts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  sajuData.sajuResult.forEach(pillar => {
    if (pillar.stem.element !== 'unknown') {
      elementCounts[pillar.stem.element as keyof typeof elementCounts]++;
    }
    if (pillar.branch.element !== 'unknown') {
      elementCounts[pillar.branch.element as keyof typeof elementCounts]++;
    }
  });

  const chartData = [
    { name: '목(木)', value: elementCounts.wood, color: '#10b981' },
    { name: '화(火)', value: elementCounts.fire, color: '#f43f5e' },
    { name: '토(土)', value: elementCounts.earth, color: '#f59e0b' },
    { name: '금(金)', value: elementCounts.metal, color: '#94a3b8' },
    { name: '수(水)', value: elementCounts.water, color: '#6366f1' },
  ].filter(d => d.value > 0);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isLoading) return;
    
    const userText = chatInput;
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: userText }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsLoading(true);
    
    // Add temporary loading message
    setChatMessages(prev => [...prev, { role: 'ai' as const, text: '사주를 분석 중입니다...' }]);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const currentYear = new Date().getFullYear();
      const birthYear = parseInt(birthDate.split('-')[0]);
      const currentAge = currentYear - birthYear + 1; // 한국 나이

      let currentDaewunStr = "대운 진입 전";
      for (let i = sajuData.daewunResult.length - 1; i >= 0; i--) {
        if (currentAge >= sajuData.daewunResult[i].age) {
          const dw = sajuData.daewunResult[i];
          currentDaewunStr = `${dw.age}세 시작 대운 [${dw.stem.hanja}${dw.branch.hanja}(${hanjaToHangul[dw.stem.hanja] || ''}${hanjaToHangul[dw.branch.hanja] || ''})]`;
          break;
        }
      }

      const currentLunar = Lunar.fromDate(new Date());
      const currentSewunHanja = currentLunar.getYearInGanZhi();
      const currentSewunHangul = (hanjaToHangul[currentSewunHanja.charAt(0)] || '') + (hanjaToHangul[currentSewunHanja.charAt(1)] || '');

      const sajuContext = `
      [사용자 기본 정보]
      - 성별: ${gender === 'M' ? '남성' : '여성'}
      - 생년월일시: ${birthDate} ${isTimeUnknown ? '모름' : birthTime}
      - 현재 나이: ${currentAge}세 (한국 나이 기준)

      [사주 원국 (${isTimeUnknown ? '3기둥 6글자' : '4기둥 8글자'})]
      - 년주(조상/초년): ${sajuData.sajuResult[3].stem.hanja}${sajuData.sajuResult[3].branch.hanja} (${sajuData.sajuResult[3].stem.hangul}${sajuData.sajuResult[3].branch.hangul})
      - 월주(부모/청년): ${sajuData.sajuResult[2].stem.hanja}${sajuData.sajuResult[2].branch.hanja} (${sajuData.sajuResult[2].stem.hangul}${sajuData.sajuResult[2].branch.hangul})
      - 일주(나/배우자): ${sajuData.sajuResult[1].stem.hanja}${sajuData.sajuResult[1].branch.hanja} (${sajuData.sajuResult[1].stem.hangul}${sajuData.sajuResult[1].branch.hangul}) -> 일간(나 자신): ${sajuData.sajuResult[1].stem.hangul}
      ${isTimeUnknown ? '- 시주(자식/말년): 미입력 (분석에서 제외)' : `- 시주(자식/말년): ${sajuData.sajuResult[0].stem.hanja}${sajuData.sajuResult[0].branch.hanja} (${sajuData.sajuResult[0].stem.hangul}${sajuData.sajuResult[0].branch.hangul})`}

      [현재 운의 흐름 (대운/세운)]
      - 현재 대운(10년 운): ${currentDaewunStr}
      - 올해 세운(1년 운): ${currentYear}년 [${currentSewunHanja}(${currentSewunHangul})]
      `;

      const systemInstruction = isTimeUnknown
        ? `당신은 '유아이(주)'의 전문적이고 친절한 AI 사주 상담사입니다. 사용자의 사주 정보를 바탕으로 따뜻하고 공감하는 톤으로 상세하고 풍성한 상담을 진행해주세요. 반드시 한국어로만 답변하세요.
        
[사용자 사주 정보]
${sajuContext}

[상담 지침]
1. 사용자와 대화하듯 자연스럽고 친절한 한국어 말투를 사용하세요. (예: ~입니다, ~하네요, ~보이네요 등)
2. 사용자의 질문에 대해 사주 원국과 현재 운의 흐름을 결합하여 깊이 있고 상세하게 분석해주세요. 단순히 짧은 답변보다는 풍부한 설명과 조언을 제공하세요.
3. 사주 용어(충, 합, 신살 등)를 사용할 때는 반드시 그 의미를 현대적으로 풀어서 설명해주세요.
4. 답변은 마크다운을 사용하여 가독성 좋게 작성하세요.
5. "Tone: ..." 이나 "분석 결과: ..." 와 같은 내부적인 지침이나 머리말을 답변에 포함하지 마세요.
6. 사용자가 생시를 입력하지 않았으므로, 시주 없이도 변하지 않는 '일간(나 자신)'과 '월지(사회적 환경)' 중심의 해석을 강화하여 분석해주세요.`
        : `당신은 '유아이(주)'의 전문적이고 친절한 AI 사주 상담사입니다. 사용자의 사주 정보를 바탕으로 따뜻하고 공감하는 톤으로 상세하고 풍성한 상담을 진행해주세요. 반드시 한국어로만 답변하세요.

[사용자 사주 정보]
${sajuContext}

[상담 지침]
1. 사용자와 대화하듯 자연스럽고 친절한 한국어 말투를 사용하세요. (예: ~입니다, ~하네요, ~보이네요 등)
2. 사용자의 질문에 대해 사주 원국과 현재 운의 흐름을 결합하여 깊이 있고 상세하게 분석해주세요. 단순히 짧은 답변보다는 풍부한 설명과 조언을 제공하세요.
3. 사주 용어(충, 합, 신살 등)를 사용할 때는 반드시 그 의미를 현대적으로 풀어서 설명해주세요.
4. 답변은 마크다운을 사용하여 가독성 좋게 작성하세요.
5. "Tone: ..." 이나 "분석 결과: ..." 와 같은 내부적인 지침이나 머리말을 답변에 포함하지 마세요.`;

      const contents = newMessages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.text }]
        }));

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.1-pro-preview",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          maxOutputTokens: 2000,
          temperature: 0.8,
          topP: 0.95,
          topK: 40,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          setChatMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1].text = fullText;
            return updated;
          });
        }
      }
    } catch (error) {
      const errorMessage = parseGeminiError(error);
      setChatMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].text = errorMessage;
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderHanjaBox = (hanja: string) => {
    if (hanja === '?') {
      return (
        <div 
          className="w-10 h-10 flex items-center justify-center border-2 mb-1 border-dashed"
          style={{
            borderColor: 'currentColor',
            backgroundColor: 'transparent',
          }}
        >
          <span 
            className="text-2xl font-serif font-bold opacity-50" 
            style={{ color: 'currentColor' }}
          >
            ?
          </span>
        </div>
      );
    }

    const data = getElementAndYinYang(hanja);
    if (!data) return <span>{hanja}</span>;
    
    const isYang = data.y === '+';
    
    return (
      <div 
        className="w-10 h-10 flex items-center justify-center border-2 mb-1"
        style={{
          borderColor: 'currentColor',
          backgroundColor: isYang ? 'currentColor' : 'transparent',
        }}
      >
        <span 
          className="text-2xl font-serif font-bold" 
          style={{ color: isYang ? (isDarkMode ? '#000' : '#fff') : 'currentColor' }}
        >
          {hanja}
        </span>
      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans flex justify-center transition-colors duration-300 ${isDarkMode ? 'bg-neutral-950 text-neutral-200' : 'bg-neutral-100 text-neutral-800'}`}>
      <div className={`w-full max-w-[375px] min-h-screen shadow-2xl relative flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}`}>
        
        {/* Header - Only show on Dashboard and Report tabs */}
        {activeTab !== 'chat' && activeTab !== 'article' && (
          <header className={`print:hidden p-5 border-b flex justify-between items-center sticky top-0 backdrop-blur-md z-10 transition-colors duration-300 ${isDarkMode ? 'border-neutral-800 bg-neutral-900/90' : 'border-neutral-200 bg-white/90'}`}>
            <h1 className={`font-handwriting text-3xl tracking-wide ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>AI 운세 상담소</h1>
            <div className="flex gap-2">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}>
                <Settings2 size={20} />
              </button>
            </div>
          </header>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-24">
          
          {/* DASHBOARD TAB */}
          <div className={`transition-opacity duration-300 ${activeTab === 'dashboard' ? 'block opacity-100' : 'hidden opacity-0 h-0 overflow-hidden'}`}>
            <div className="p-5 space-y-8">
              {/* Input Section */}
              <section className={`rounded-2xl p-6 border border-solid space-y-6 transition-colors duration-300 ${isDarkMode ? 'bg-neutral-800/50 border-neutral-600' : 'bg-neutral-50 border-neutral-300'}`}>
                <h2 className={`text-center font-handwriting text-3xl mb-2 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  {userName ? `${userName}님의 사주 정보` : '사주 정보를 입력해주세요'}
                </h2>
                
                <div className={`flex items-center rounded-xl border overflow-hidden focus-within:border-indigo-500 transition-colors ${isDarkMode ? 'bg-neutral-900 border-neutral-700/50' : 'bg-white border-neutral-200'}`}>
                  <div className="pl-4 pr-2 text-neutral-500"><Settings2 size={18} /></div>
                  <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="이름"
                    className={`w-full bg-transparent py-3 pr-4 outline-none text-sm ${isDarkMode ? 'text-neutral-200 placeholder-neutral-600' : 'text-neutral-800 placeholder-neutral-400'}`} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className={`text-[11px] font-medium px-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>달력 기준</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setCalendarType('solar')}
                        className={`flex-1 py-2 rounded-lg font-medium text-[11px] transition-colors ${calendarType === 'solar' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'}`}>
                        양력
                      </button>
                      <button 
                        onClick={() => setCalendarType('lunar')}
                        className={`flex-1 py-2 rounded-lg font-medium text-[11px] transition-colors ${calendarType === 'lunar' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'}`}>
                        음력(평)
                      </button>
                      <button 
                        onClick={() => setCalendarType('lunar-leap')}
                        className={`flex-1 py-2 rounded-lg font-medium text-[11px] transition-colors ${calendarType === 'lunar-leap' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'}`}>
                        음력(윤)
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <span className={`text-[11px] font-medium px-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>성별</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setGender('M')}
                        className={`flex-1 py-2 rounded-lg font-medium text-xs transition-colors ${gender === 'M' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'}`}>
                        남성
                      </button>
                      <button 
                        onClick={() => setGender('F')}
                        className={`flex-1 py-2 rounded-lg font-medium text-xs transition-colors ${gender === 'F' ? 'bg-rose-500 text-white' : isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'}`}>
                        여성
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <span className={`text-[11px] font-medium px-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>생년월일시</span>
                  <div className={`flex items-center rounded-xl border overflow-hidden focus-within:border-indigo-500 transition-colors ${isDarkMode ? 'bg-neutral-900 border-neutral-700/50' : 'bg-white border-neutral-200'}`}>
                    <div className="pl-4 pr-2 text-neutral-500"><Calendar size={18} /></div>
                    <div className="flex flex-1">
                      <select 
                        value={birthDate.split('-')[0]} 
                        onChange={(e) => setBirthDate(`${e.target.value}-${birthDate.split('-')[1]}-${birthDate.split('-')[2]}`)}
                        className={`flex-1 bg-transparent py-3 px-1 outline-none text-sm cursor-pointer ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}
                      >
                        {Array.from({length: 120}, (_, i) => {
                          const y = new Date().getFullYear() + 5 - i;
                          return <option key={y} value={y} className={isDarkMode ? 'bg-neutral-800' : 'bg-white'}>{y}년</option>
                        })}
                      </select>
                      <select 
                        value={birthDate.split('-')[1]} 
                        onChange={(e) => setBirthDate(`${birthDate.split('-')[0]}-${e.target.value}-${birthDate.split('-')[2]}`)}
                        className={`flex-1 bg-transparent py-3 px-1 outline-none text-sm cursor-pointer border-l ${isDarkMode ? 'text-neutral-200 border-neutral-700/50' : 'text-neutral-800 border-neutral-200'}`}
                      >
                        {Array.from({length: 12}, (_, i) => {
                          const m = (i + 1).toString().padStart(2, '0');
                          return <option key={m} value={m} className={isDarkMode ? 'bg-neutral-800' : 'bg-white'}>{m}월</option>
                        })}
                      </select>
                      <select 
                        value={birthDate.split('-')[2]} 
                        onChange={(e) => setBirthDate(`${birthDate.split('-')[0]}-${birthDate.split('-')[1]}-${e.target.value}`)}
                        className={`flex-1 bg-transparent py-3 px-1 outline-none text-sm cursor-pointer border-l ${isDarkMode ? 'text-neutral-200 border-neutral-700/50' : 'text-neutral-800 border-neutral-200'}`}
                      >
                        {Array.from({length: 31}, (_, i) => {
                          const d = (i + 1).toString().padStart(2, '0');
                          return <option key={d} value={d} className={isDarkMode ? 'bg-neutral-800' : 'bg-white'}>{d}일</option>
                        })}
                      </select>
                    </div>
                  </div>
                  <div className={`flex items-center rounded-xl border overflow-hidden focus-within:border-indigo-500 transition-colors ${isDarkMode ? 'bg-neutral-900 border-neutral-700/50' : 'bg-white border-neutral-200'}`}>
                    <div className="pl-4 pr-2 text-neutral-500"><Clock size={18} /></div>
                    <div className="flex flex-1 relative">
                      {isTimeUnknown && (
                        <div className={`absolute inset-0 flex items-center px-3 z-10 ${isDarkMode ? 'bg-neutral-900/80' : 'bg-white/80'}`}>
                          <span className="text-sm font-medium text-neutral-500">시간을 모릅니다</span>
                        </div>
                      )}
                      <select 
                        value={birthTime.split(':')[0]} 
                        onChange={(e) => setBirthTime(`${e.target.value}:${birthTime.split(':')[1]}`)}
                        disabled={isTimeUnknown}
                        className={`flex-1 bg-transparent py-3 px-2 outline-none text-sm cursor-pointer ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}
                      >
                        {Array.from({length: 24}, (_, i) => {
                          const h = i.toString().padStart(2, '0');
                          return <option key={h} value={h} className={isDarkMode ? 'bg-neutral-800' : 'bg-white'}>{h}시</option>
                        })}
                      </select>
                      <select 
                        value={birthTime.split(':')[1]} 
                        onChange={(e) => setBirthTime(`${birthTime.split(':')[0]}:${e.target.value}`)}
                        disabled={isTimeUnknown}
                        className={`flex-1 bg-transparent py-3 px-2 outline-none text-sm cursor-pointer border-l ${isDarkMode ? 'text-neutral-200 border-neutral-700/50' : 'text-neutral-800 border-neutral-200'}`}
                      >
                        {Array.from({length: 60}, (_, i) => {
                          const m = i.toString().padStart(2, '0');
                          return <option key={m} value={m} className={isDarkMode ? 'bg-neutral-800' : 'bg-white'}>{m}분</option>
                        })}
                      </select>
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-2 px-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isTimeUnknown}
                      onChange={(e) => setIsTimeUnknown(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      태어난 시간을 몰라요
                    </span>
                  </label>
                  
                  {isTimeUnknown && (
                    <div className="mt-2">
                      <p className={`text-[11px] mb-1.5 text-center ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        * 정확한 역추적을 위해 먼저 <strong>[사주 분석하기]</strong>를 완료해주세요.
                      </p>
                      <button 
                        onClick={() => setShowTimeEstimator(true)}
                        className={`w-full py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400 border-indigo-800/50 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
                      >
                        🔍 과거 사건으로 생시 찾기
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 mb-2">
                  <p className={`text-xs font-medium text-center ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    아래에 동의하시면 사주분석이 시작됩니다
                  </p>
                </div>

                <div className={`p-4 rounded-xl space-y-3 ${isDarkMode ? 'bg-neutral-900/50 border border-neutral-700/50' : 'bg-white border border-neutral-200/80 shadow-sm'}`}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isPrivacyAgreed}
                      onChange={(e) => setIsPrivacyAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={`text-xs leading-tight ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      [필수] 개인정보 수집 및 즉시 파기 원칙 동의
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isDisclaimerAgreed}
                      onChange={(e) => setIsDisclaimerAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={`text-xs leading-tight ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      [필수] 서비스 면책 고지 확인 (상담 결과는 참고용이며 법적 책임이 없음)
                    </span>
                  </label>
                </div>

                <button 
                  onClick={handleAnalyze}
                  disabled={!isPrivacyAgreed || !isDisclaimerAgreed || isLoading}
                  className={`w-full py-4 mt-2 rounded-xl font-bold text-base transition-all ${(!isPrivacyAgreed || !isDisclaimerAgreed || isLoading) ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed' : isDarkMode ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'}`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>분석 중...</span>
                    </div>
                  ) : "사주 분석하기"}
                </button>

                {!isAnalyzed && (
                  <div className="text-center pt-2">
                    <button 
                      onClick={() => {
                        setActiveTab('guide');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`text-xs underline underline-offset-4 transition-colors ${isDarkMode ? 'text-neutral-400 hover:text-neutral-300' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                      유아이(주) 서비스 가이드 보기
                    </button>
                  </div>
                )}
              </section>

              {/* Result Section */}
              {isAnalyzed && (
                <>
                  <section className={`rounded-2xl p-6 border border-solid space-y-5 transition-colors duration-300 ${isDarkMode ? 'bg-neutral-800/50 border-neutral-600' : 'bg-white border-neutral-200 shadow-sm'}`}>
                <h2 className={`text-center font-handwriting text-3xl ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  {userName}님의 {isTimeUnknown ? '핵심 기질 리포트' : '사주팔자'}
                </h2>

                <div className="grid grid-cols-4 gap-2">
                  {/* Headers */}
                  {sajuData.sajuResult.map((col, i) => (
                    <div key={`header-${i}`} className="text-center text-xs font-medium text-neutral-500 mb-1">
                      {col.title}
                    </div>
                  ))}

                  {/* Stems (천간) */}
                  {sajuData.sajuResult.map((col, i) => (
                    <div 
                      key={`stem-${i}`} 
                      onClick={() => !col.isUnknown && setSelectedDeity(col.stem.deity)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border ${colors[col.stem.element as keyof typeof colors]} relative overflow-hidden transition-all duration-300 ${col.isUnknown ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer hover:scale-105 hover:shadow-lg'}`}
                    >
                      {col.isUnknown && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px] z-10">
                          <span className="text-xs font-bold text-neutral-500 bg-white/80 px-2 py-1 rounded-md">미입력</span>
                        </div>
                      )}
                      <span className="text-[10px] font-medium opacity-80 mb-1">{col.stem.deity}</span>
                      {renderHanjaBox(col.stem.hanja)}
                      <div className="flex flex-col items-center mt-1 text-center w-full">
                        <span className="text-xs font-bold">{col.isUnknown ? col.stem.hangul : getGanZhiInfo(col.stem.hanja).kor}</span>
                        <span className="text-[9px] opacity-70 tracking-tighter leading-tight mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis w-full px-0.5">{col.isUnknown ? 'Unknown' : getGanZhiInfo(col.stem.hanja).eng}</span>
                      </div>
                    </div>
                  ))}

                  {/* Branches (지지) */}
                  {sajuData.sajuResult.map((col, i) => (
                    <div 
                      key={`branch-${i}`} 
                      onClick={() => !col.isUnknown && setSelectedDeity(col.branch.deity)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border ${colors[col.branch.element as keyof typeof colors]} relative overflow-hidden mt-1 transition-all duration-300 ${col.isUnknown ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer hover:scale-105 hover:shadow-lg'}`}
                    >
                      {col.isUnknown && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px] z-10">
                          <span className="text-xs font-bold text-neutral-500 bg-white/80 px-2 py-1 rounded-md">미입력</span>
                        </div>
                      )}
                      <span className="text-[10px] font-medium opacity-80 mb-1">{col.branch.deity}</span>
                      {renderHanjaBox(col.branch.hanja)}
                      <div className="flex flex-col items-center mt-1 mb-2 text-center w-full">
                        <span className="text-xs font-bold">{col.isUnknown ? col.branch.hangul : getGanZhiInfo(col.branch.hanja).kor}</span>
                        <span className="text-[9px] opacity-70 tracking-tighter leading-tight mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis w-full px-0.5">{col.isUnknown ? 'Unknown' : getGanZhiInfo(col.branch.hanja).eng}</span>
                      </div>
                      
                      {/* Hidden Stems (지장간) */}
                      <div className="flex gap-1 mt-auto pt-2 border-t border-current/20 w-full justify-center">
                        {col.branch.hidden.map((h, j) => (
                          <span key={j} className="text-[10px] opacity-70">{h}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Element Distribution Chart */}
              <section className={`rounded-2xl p-5 border border-solid space-y-4 transition-colors duration-300 ${isDarkMode ? 'bg-neutral-800/50 border-neutral-600' : 'bg-neutral-50 border-neutral-300'}`}>
                <h2 className={`text-center font-handwriting text-3xl ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  {userName}님의 오행분포도
                </h2>
                <div className="flex items-center justify-between">
                  <div className="w-1/2">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                          animationDuration={800}
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 flex flex-col justify-center gap-2 pl-4">
                    {chartData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                          {entry.name}: {entry.value}개
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Daewun (10-year cycle) Section */}
              <section className={`pt-6 border-t ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
                <h2 className={`font-handwriting text-3xl mb-4 px-1 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>대운 (10년 운세)</h2>
                {/* REMOVED [&::-webkit-scrollbar]:hidden to make scrollbar visible */}
                <div ref={daewunContainerRef} className="flex overflow-x-auto gap-3 pb-4 snap-x relative">
                  {sajuData.daewunResult.map((dw, i) => {
                    const isCurrentDaewun = i === currentDaewunIndex;
                    return (
                      <div key={i} className={`relative flex-shrink-0 w-[72px] flex flex-col items-center p-3 rounded-xl border snap-center transition-colors duration-300 ${isCurrentDaewun ? (isDarkMode ? 'bg-indigo-900/40 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-indigo-50 border-indigo-300 shadow-md') : (isDarkMode ? 'bg-neutral-800/50 border-neutral-700/50' : 'bg-white border-neutral-200 shadow-sm')}`}>
                        {isCurrentDaewun && (
                          <div className="absolute -top-2.5 bg-indigo-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm z-10">
                            현재
                          </div>
                        )}
                        <span className={`text-[10px] font-bold mb-2 ${isCurrentDaewun ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'}`}>{dw.age}세</span>
                        <div className={`text-xl font-serif font-bold leading-tight ${textColors[dw.stem.element as keyof typeof textColors]}`}>{dw.stem.hanja}</div>
                        <div className={`text-xl font-serif font-bold leading-tight ${textColors[dw.branch.element as keyof typeof textColors]}`}>{dw.branch.hanja}</div>
                        <span className={`text-[9px] mt-2 ${isCurrentDaewun ? (isDarkMode ? 'text-neutral-300' : 'text-neutral-600 font-medium') : 'text-neutral-500'}`}>{getGanZhiInfo(dw.stem.hanja).kor}{getGanZhiInfo(dw.branch.hanja).kor}</span>
                        <span className={`text-[9px] mt-1 ${isCurrentDaewun ? (isDarkMode ? 'text-neutral-300' : 'text-neutral-600 font-medium') : 'text-neutral-500'}`}>{dw.year}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3 mt-8 pb-10">
                <button 
                  onClick={() => {
                    setActiveTab('report');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`py-5 rounded-2xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-2 ${isDarkMode ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/60' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 shadow-sm'}`}
                >
                  <FileText size={20} />
                  운세보러가기
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('chat');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`py-5 rounded-2xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-2 ${isDarkMode ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-sm'}`}
                >
                  <MessageCircle size={20} />
                  운세상담하러가기
                </button>
              </div>
              </>
              )}
            </div>
          </div>

          {/* CHAT TAB */}
          {isAnalyzed && (
            <div className={`transition-opacity duration-300 h-full flex flex-col ${activeTab === 'chat' ? 'block opacity-100' : 'hidden opacity-0 h-0 overflow-hidden'}`}>
            
            {/* Chat Header */}
            <header className={`p-4 border-b flex items-center justify-between sticky top-0 z-10 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">UI</div>
                <h1 className={`font-handwriting text-2xl ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>AI 운세 상담소</h1>
              </div>
              <span className="text-xs text-emerald-500 flex items-center gap-1">● 실시간 분석중</span>
            </header>

            <div className={`flex-1 p-4 space-y-4 overflow-y-auto ${isDarkMode ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
              <style>{`
                .markdown-body p { margin-bottom: 0.5rem; }
                .markdown-body p:last-child { margin-bottom: 0; }
                .markdown-body strong { font-weight: 600; color: inherit; }
                .markdown-body ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 0.5rem; }
                .markdown-body ol { list-style-type: decimal; padding-left: 1.25rem; margin-bottom: 0.5rem; }
                .markdown-body li { margin-bottom: 0.25rem; }
              `}</style>
              {chatMessages.map((msg, idx) => {
                if (msg.role === 'system') {
                  return (
                    <div key={idx} className={`text-[11px] text-center p-3 rounded-xl leading-relaxed ${isDarkMode ? 'bg-neutral-900 text-neutral-400' : 'bg-neutral-200/50 text-neutral-500'}`}>
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  );
                }
                
                if (msg.role === 'estimator_result') {
                  return (
                    <div key={idx} className="flex justify-start">
                      <div className={`p-4 rounded-2xl rounded-tl-sm border-l-4 border-yellow-400 max-w-[90%] shadow-sm ${isDarkMode ? 'bg-yellow-900/20 text-yellow-100' : 'bg-yellow-50 text-yellow-900'}`}>
                        <p className="text-xs font-bold text-yellow-600 mb-2">유아이 역추적 결과</p>
                        <div className="text-sm mb-4 leading-relaxed markdown-body">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                        
                        {msg.data && msg.data.length > 0 && (
                          <div className="space-y-3 mt-4 border-t border-yellow-200/50 pt-4">
                            <div className={`p-2.5 rounded-lg text-xs mb-3 ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                              💡 <strong>Tip:</strong> 12개의 생시 후보(기본 확률 8.3%) 중 <strong>80% 이상</strong>의 확률이 도출되었다면, 과거 사건과 해당 생시의 명리학적 연관성이 압도적으로 높다는 의미입니다.
                            </div>
                            <p className="text-sm font-medium">추천 시간대:</p>
                            {msg.data.map((rec: any, recIdx: number) => (
                              <div key={recIdx} className={`p-3 rounded-xl border ${isDarkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-white border-yellow-200'}`}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-indigo-600">{rec.time}</span>
                                  <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{rec.probability}%</span>
                                </div>
                                <p className="text-xs opacity-80 mb-3">{rec.reason}</p>
                                <button 
                                  onClick={() => confirmTime(rec.time)}
                                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  이 시간으로 확정
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed max-w-[80%] shadow-sm ${
                      msg.role === 'user' 
                        ? `rounded-tr-none ${isDarkMode ? 'bg-neutral-800 text-neutral-200 border border-neutral-700' : 'bg-white border border-neutral-200 text-neutral-800'}` 
                        : `rounded-tl-none ${isDarkMode ? 'bg-indigo-900/50 text-indigo-200' : 'bg-indigo-100 text-indigo-900'}`
                    }`}>
                      {msg.role === 'ai' ? (
                        <div className="markdown-body">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Footer */}
            <footer className={`p-4 border-t sticky bottom-0 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  className={`p-2 rounded-full transition flex-shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse' : isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                  title="음성 입력"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="무엇이든 물어보세요" 
                  className={`flex-1 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-neutral-800 text-neutral-200 placeholder-neutral-500' : 'bg-neutral-100 text-neutral-800 placeholder-neutral-400'}`}
                />
                <button 
                  type="submit"
                  disabled={isLoading}
                  className={`p-2 rounded-full transition flex-shrink-0 ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
              <p className={`text-[9px] text-center mt-2 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Powered by 유아이(주) - 정밀 만세력 데이터 기반</p>
            </footer>
          </div>
          )}

          {/* REPORT TAB */}
          {isAnalyzed && (
            <div className={`transition-opacity duration-300 ${activeTab === 'report' ? 'block opacity-100' : 'hidden opacity-0 h-0 overflow-hidden'}`}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-6 px-1">
                <h2 className={`font-handwriting text-4xl ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>운세 리포트</h2>
                <div className="flex gap-2 print:hidden">
                  <button 
                    onClick={handleDownloadPDF} 
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 shadow-sm'}`}
                  >
                    <Download size={14} />
                    <span>{isLoading ? '생성 중...' : 'PDF 저장'}</span>
                  </button>
                  <button onClick={handleEmailReport} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDarkMode ? 'bg-indigo-900/50 text-indigo-300 hover:bg-indigo-900/80 border border-indigo-800/50' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100'}`}>
                    <Mail size={14} />
                    <span>이메일 전송</span>
                  </button>
                </div>
              </div>
              <div id="fortune-report-content" className={`p-8 rounded-2xl space-y-10 border ${isDarkMode ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'}`}>
                
                {aiReport ? (
                  <>
                    {/* 1. 본연의 기질과 성격 */}
                    <div className="space-y-4">
                      <h3 className={`font-handwriting text-3xl text-[#0047AB] flex items-center gap-2`}>
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        본연의 기질과 성격
                      </h3>
                      <div className={`font-gothic text-[13px] leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        <Markdown>{aiReport.nature}</Markdown>
                      </div>
                    </div>

                    {/* 2. 사회적 환경 및 역량 */}
                    <div className="space-y-4">
                      <h3 className={`font-handwriting text-3xl text-[#0047AB] flex items-center gap-2`}>
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        사회적 환경 및 역량 발휘 방식
                      </h3>
                      <div className={`font-gothic text-[13px] leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        <Markdown>{aiReport.social}</Markdown>
                        <div className={`mt-4 p-4 rounded-xl border ${isDarkMode ? 'bg-indigo-900/20 border-indigo-800/50 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                          <p className="font-bold mb-1 text-sm">핵심 역량 키워드</p>
                          <p className="text-xs opacity-90">{aiReport.careerKeywords}</p>
                        </div>
                      </div>
                    </div>

                    {/* 3. 인생 흐름 */}
                    <div className="space-y-4">
                      <h3 className={`font-handwriting text-3xl text-[#0047AB] flex items-center gap-2`}>
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        인생 흐름
                      </h3>
                      <div className={`font-gothic text-[13px] leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        <Markdown>{aiReport.lifeFlow}</Markdown>
                      </div>
                    </div>

                    {/* 4. 오행 밸런스 및 보완책 */}
                    <div className="space-y-4">
                      <h3 className={`font-handwriting text-3xl text-[#0047AB] flex items-center gap-2`}>
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        오행 밸런스 및 실생활 보완책
                      </h3>
                      <div className={`font-gothic text-[13px] leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        <Markdown>{aiReport.balance}</Markdown>
                        <div className={`mt-4 grid grid-cols-3 gap-3`}>
                          <div className={`p-3 rounded-xl text-center ${isDarkMode ? 'bg-neutral-800/80' : 'bg-neutral-50'}`}>
                            <p className="text-[10px] font-bold mb-1 opacity-60 uppercase tracking-tighter">행운의 색상</p>
                            <p className="text-xs font-bold">{aiReport.luckyColor}</p>
                          </div>
                          <div className={`p-3 rounded-xl text-center ${isDarkMode ? 'bg-neutral-800/80' : 'bg-neutral-50'}`}>
                            <p className="text-[10px] font-bold mb-1 opacity-60 uppercase tracking-tighter">추천 습관</p>
                            <p className="text-xs font-bold">{aiReport.habits}</p>
                          </div>
                          <div className={`p-3 rounded-xl text-center ${isDarkMode ? 'bg-neutral-800/80' : 'bg-neutral-50'}`}>
                            <p className="text-[10px] font-bold mb-1 opacity-60 uppercase tracking-tighter">길한 방향</p>
                            <p className="text-xs font-bold">{aiReport.direction}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 5. 영역별 운세 */}
                    <div className="space-y-4">
                      <h3 className={`font-handwriting text-3xl text-[#0047AB] flex items-center gap-2`}>
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        영역별 운세
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-neutral-200 bg-white'}`}>
                          <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>재물운</h4>
                          <p className={`font-gothic text-xs leading-relaxed ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{aiReport.wealth}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-neutral-200 bg-white'}`}>
                          <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>연애/결혼운</h4>
                          <p className={`font-gothic text-xs leading-relaxed ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{aiReport.love}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-neutral-200 bg-white'}`}>
                          <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>직업/적성</h4>
                          <p className={`font-gothic text-xs leading-relaxed ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{aiReport.career}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'border-neutral-700 bg-neutral-800/30' : 'border-neutral-200 bg-white'}`}>
                          <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>건강운</h4>
                          <p className={`font-gothic text-xs leading-relaxed ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{aiReport.health}</p>
                        </div>
                      </div>
                    </div>

                    {/* 6. 용신 */}
                    <div className="space-y-4">
                      <h3 className={`font-handwriting text-3xl text-[#0047AB] flex items-center gap-2`}>
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        용신(用神) 분석
                      </h3>
                      <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-amber-900/10 border-amber-800/30' : 'bg-amber-50/50 border-amber-100'}`}>
                        <div className="grid grid-cols-2 gap-6 mb-4">
                          <div>
                            <p className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`}>조후용신</p>
                            <p className={`font-gothic text-sm font-bold ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>{aiReport.johuYongsin}</p>
                          </div>
                          <div>
                            <p className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`}>억부용신</p>
                            <p className={`font-gothic text-sm font-bold ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>{aiReport.eokbuYongsin}</p>
                          </div>
                        </div>
                        <div className={`pt-4 border-t ${isDarkMode ? 'border-amber-800/30' : 'border-amber-100'}`}>
                          <p className={`text-[10px] font-bold mb-2 uppercase tracking-wider ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`}>구체적 활용법</p>
                          <p className={`font-gothic text-xs leading-relaxed ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>{aiReport.yongsinTips}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-20 text-center space-y-4">
                    <div className="inline-flex p-4 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                      <Sparkles size={32} className="animate-pulse" />
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {isAnalyzed 
                        ? "AI가 정밀 분석 리포트를 생성 중입니다.\n잠시만 기다려 주세요..." 
                        : "사주 정보를 입력하시면\nAI 정밀 분석 리포트가 생성됩니다."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

          {/* GUIDE TAB (About UI) */}
          <div className={`transition-opacity duration-300 ${activeTab === 'guide' ? 'block opacity-100' : 'hidden opacity-0 h-0 overflow-hidden'}`}>
            <div className="p-6 pb-24">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: activeTab === 'guide' ? 1 : 0, y: activeTab === 'guide' ? 0 : 20 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-10 mt-4"
              >
                <h2 className={`font-handwriting text-4xl mb-3 ${isDarkMode ? 'text-amber-400' : 'text-indigo-900'}`}>
                  유아이(주) 서비스 가이드
                </h2>
                <button 
                  onClick={() => {
                    setActiveTab('article');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`text-lg font-medium leading-relaxed hover:underline underline-offset-8 transition-all ${isDarkMode ? 'text-neutral-300 hover:text-amber-400' : 'text-neutral-700 hover:text-indigo-600'}`}
                >
                  "사주는 미신이 아닌<br/>인류의 지혜이자 통계입니다"
                </button>
              </motion.div>
              
              <div className="space-y-8">
                {/* History & Stats */}
                <motion.section 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className={`rounded-2xl p-6 border-t-4 shadow-sm ${isDarkMode ? 'bg-neutral-800/60 border-indigo-500/50' : 'bg-white border-indigo-600'}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                      <Database size={22} />
                    </div>
                    <h3 className={`font-bold text-lg ${isDarkMode ? 'text-neutral-100' : 'text-indigo-900'}`}>History & Stats</h3>
                  </div>
                  <h4 className={`font-handwriting text-2xl mb-3 ${isDarkMode ? 'text-amber-400/90' : 'text-amber-600'}`}>수천 년간 축적된 동양 인류학의 빅데이터</h4>
                  <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    명리학은 단순한 점술이 아닙니다. 수천 년 동안 수많은 사람들의 생애와 자연의 변화를 관찰하고 기록하여 축적된 거대한 통계학이자 동양 인류학의 정수입니다. 유아이(주)는 이 방대한 빅데이터를 현대적인 알고리즘으로 재해석하여 가장 객관적이고 신뢰할 수 있는 분석을 제공합니다.
                  </p>
                </motion.section>

                {/* Natural Science */}
                <motion.section 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={`rounded-2xl p-6 border-t-4 shadow-sm ${isDarkMode ? 'bg-neutral-800/60 border-amber-500/50' : 'bg-white border-amber-500'}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                      <Sparkles size={22} />
                    </div>
                    <h3 className={`font-bold text-lg ${isDarkMode ? 'text-neutral-100' : 'text-indigo-900'}`}>Natural Science</h3>
                  </div>
                  <h4 className={`font-handwriting text-2xl mb-3 ${isDarkMode ? 'text-amber-400/90' : 'text-amber-600'}`}>오행의 순환과 에너지 유전자</h4>
                  <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    우주와 자연은 목(木), 화(火), 토(土), 금(金), 수(水)라는 다섯 가지 에너지(오행)의 순환으로 이루어집니다. 사람이 태어난 연월일시의 기운은 곧 그 사람 고유의 '에너지 유전자'가 됩니다. 우리는 이 유전자의 강약과 균형을 분석하여 당신만의 고유한 기질과 잠재력을 과학적인 시각으로 풀어냅니다.
                  </p>
                </motion.section>

                {/* Life Navigation */}
                <motion.section 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className={`rounded-2xl p-6 border-t-4 shadow-sm ${isDarkMode ? 'bg-neutral-800/60 border-indigo-500/50' : 'bg-white border-indigo-600'}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                      <Compass size={22} />
                    </div>
                    <h3 className={`font-bold text-lg ${isDarkMode ? 'text-neutral-100' : 'text-indigo-900'}`}>Life Navigation</h3>
                  </div>
                  <h4 className={`font-handwriting text-2xl mb-3 ${isDarkMode ? 'text-amber-400/90' : 'text-amber-600'}`}>운명을 개척하기 위한 전략적 도구</h4>
                  <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    사주는 정해진 숙명을 맹신하기 위한 것이 아닙니다. 다가올 비바람을 미리 알고 우산을 준비하듯, 내 삶의 흐름을 이해하고 더 나은 선택을 하기 위한 '인생의 내비게이션'입니다. 유아이(주)와 함께 당신의 강점을 극대화하고 약점을 보완하는 전략을 세워보세요.
                  </p>
                </motion.section>

                {/* App Usage Guide (Card News) */}
                <motion.section
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="mt-12 mb-8"
                >
                  <div className="flex items-center gap-2 mb-6 px-1">
                    <h3 className={`font-handwriting text-3xl ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>앱사용 이렇게 하세요 💡</h3>
                  </div>
                  
                  <div className="flex flex-col gap-4 pb-8 pt-2">
                    {/* Card 1 */}
                    <div className={`w-full rounded-2xl p-6 border shadow-sm flex flex-col h-auto ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-neutral-200'}`}>
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                        <Clock size={20} />
                      </div>
                      <h4 className={`font-bold text-lg mb-3 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>1. 사주 정보 입력하기</h4>
                      <p className={`text-sm leading-relaxed whitespace-normal break-keep flex-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        태어난 시간을 모른다면 <strong>'과거 사건으로 생시 찾기'</strong> 기능을 활용해보세요! AI가 과거의 중요한 사건들을 분석해 가장 확률이 높은 생시를 찾아드립니다.
                      </p>
                    </div>

                    {/* Card 2 */}
                    <div className={`w-full rounded-2xl p-6 border shadow-sm flex flex-col h-auto ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-neutral-200'}`}>
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                        <LayoutDashboard size={20} />
                      </div>
                      <h4 className={`font-bold text-lg mb-3 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>2. 대시보드 활용법</h4>
                      <p className={`text-sm leading-relaxed whitespace-normal break-keep flex-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        <strong>💡 꿀팁:</strong> 대시보드에서 사주팔자 글자를 클릭해보세요! 해당 글자(육친/십성)가 내 삶에서 어떤 의미를 가지는지 상세하고 친절한 설명이 팝업으로 나타납니다.
                      </p>
                    </div>

                    {/* Card 3 */}
                    <div className={`w-full rounded-2xl p-6 border shadow-sm flex flex-col h-auto ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-neutral-200'}`}>
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                        <Mic size={20} />
                      </div>
                      <h4 className={`font-bold text-lg mb-3 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>3. 1:1 AI 상담</h4>
                      <p className={`text-sm leading-relaxed whitespace-normal break-keep flex-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        타이핑이 귀찮으신가요? <strong>음성(마이크) 입력 기능</strong>을 켜고 편하게 말씀하세요. 연애, 진로, 재물 등 어떤 고민이든 자유롭게 질문하고 답변을 받을 수 있습니다.
                      </p>
                    </div>

                    {/* Card 4 */}
                    <div className={`w-full rounded-2xl p-6 border shadow-sm flex flex-col h-auto ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-neutral-200'}`}>
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                        <Download size={20} />
                      </div>
                      <h4 className={`font-bold text-lg mb-3 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>4. 운세 리포트</h4>
                      <p className={`text-sm leading-relaxed whitespace-normal break-keep flex-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        나만의 종합 분석 결과를 확인하고, 우측 상단의 <strong>다운로드 버튼</strong>을 눌러보세요. 리포트를 PDF로 저장하거나 인쇄해서 원할 때마다 꺼내볼 수 있습니다.
                      </p>
                    </div>

                    {/* Card 5 */}
                    <div className={`w-full rounded-2xl p-6 border shadow-sm flex flex-col h-auto ${isDarkMode ? 'bg-emerald-900/30 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200'}`}>
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-emerald-800/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                        <ShieldCheck size={20} />
                      </div>
                      <h4 className={`font-bold text-lg mb-3 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>5. 안심하고 사용하세요</h4>
                      <p className={`text-sm leading-relaxed whitespace-normal break-keep flex-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        저희 서비스는 <strong>회원가입이 없고, 서버에 데이터를 절대 저장하지 않는 무보관 원칙</strong>을 지킵니다. 개인정보 유출 걱정 없이 안심하고 고민을 털어놓으세요!
                      </p>
                    </div>
                  </div>
                </motion.section>
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="pt-6 pb-4"
                >
                  <button 
                    onClick={() => {
                      setActiveTab('dashboard');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-full py-4 rounded-xl font-bold text-base transition-all shadow-lg ${isDarkMode ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-900/50' : 'bg-gradient-to-r from-indigo-900 to-indigo-700 text-white hover:from-indigo-800 hover:to-indigo-600 shadow-indigo-900/20'}`}
                  >
                    분석하러 가기
                  </button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                  className="text-center pb-8"
                >
                  <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    [법적 면책 고지]<br/>
                    본 서비스가 제공하는 사주 분석 및 운세 정보는 통계적 데이터를 기반으로 한 참고용 자료입니다. 어떠한 의학적, 법률적, 재무적 조언을 대신할 수 없으며, 서비스 이용으로 인해 발생하는 결과에 대해 유아이(주)는 법적 책임을 지지 않습니다. 모든 최종 결정과 책임은 사용자 본인에게 있습니다.
                  </p>
                </motion.div>
              </div>
            </div>
          </div>

          {/* ARTICLE TAB (Detailed Saju Article) */}
          <div className={`transition-opacity duration-300 ${activeTab === 'article' ? 'block opacity-100' : 'hidden opacity-0 h-0 overflow-hidden'}`}>
            <div className={`p-6 pb-24 font-serif ${isDarkMode ? 'text-neutral-300' : 'text-neutral-800'}`}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: activeTab === 'article' ? 1 : 0, y: activeTab === 'article' ? 0 : 20 }}
                transition={{ duration: 0.6 }}
              >
                <button 
                  onClick={() => {
                    setActiveTab('guide');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`mb-8 flex items-center gap-2 text-sm font-sans transition-colors ${isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800'}`}
                >
                  <X size={16} /> 닫기
                </button>

                <h2 className={`text-3xl md:text-4xl font-bold leading-tight mb-12 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  운명을 읽는 기술: 사주, 미신을 넘어선 인생의 내비게이션
                </h2>

                <div className="space-y-10 text-base md:text-lg leading-loose">
                  <section>
                    <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-amber-400' : 'text-indigo-800'}`}>사주는 통계의 역사이자 기록의 학문입니다</h3>
                    <p className="mb-4">
                      우리는 흔히 사주라고 하면 어두운 방 안의 방울 소리나 신비주의적인 예언을 떠올리곤 합니다. 하지만 사주의 본질인 <strong>명리학(命理學)</strong>은 수천 년 동안 인류가 자연의 흐름과 인간의 삶을 관찰하여 기록한 방대한 <strong>'빅데이터의 집합체'</strong>입니다.
                    </p>
                    <p>
                      고대 동양의 철학자들은 계절의 변화, 달의 주기, 태양의 고도에 따라 만물의 에너지가 어떻게 변하는지 관찰했습니다. 그리고 그 에너지가 인간이 태어난 순간의 우주적 기운과 어떤 상관관계를 맺는지 수십억 건의 사례를 통해 증명해 왔습니다. 즉, 사주는 어느 날 갑자기 하늘에서 떨어진 계시가 아니라, 인류가 생존을 위해 축적해 온 <strong>'환경 적응에 대한 통계적 기록'</strong>입니다.
                    </p>
                  </section>

                  <section>
                    <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-amber-400' : 'text-indigo-800'}`}>자연의 질서를 따르는 과학적 논리</h3>
                    <p className="mb-4">
                      사주가 과학적이라는 이유는 그것이 <strong>'순환의 원리'</strong>에 기반하고 있기 때문입니다. 물이 증발하여 구름이 되고 다시 비가 되어 내리듯, 우리 인생에도 목(木), 화(火), 토(土), 금(金), 수(水)라는 다섯 가지 에너지의 순환이 존재합니다.
                    </p>
                    <p>
                      현대 과학이 유전자를 통해 신체적 특징을 예측하듯, 명리학은 생년월일시라는 <strong>'시간의 유전자'</strong>를 통해 한 사람의 심리적 경향성, 에너지의 강약, 그리고 삶의 주기를 분석합니다. 이는 결코 근거 없는 미신이 아닙니다. 달의 인력이 조수간만의 차를 만들 듯, 우리가 태어난 시점의 천체 정렬이 개인의 기질에 미세한 영향을 미친다는 것은 매우 논리적인 가설입니다. 사주는 이 보이지 않는 에너지의 흐름을 기호화하여 풀이하는 <strong>'동양의 기상학'</strong>이자 <strong>'인간 분석학'</strong>입니다.
                    </p>
                  </section>

                  <section>
                    <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-amber-400' : 'text-indigo-800'}`}>운명은 정해진 감옥이 아닌, 활용해야 할 지도입니다</h3>
                    <p className="mb-4">
                      사주를 믿는 것이 수동적인 삶을 의미하지는 않습니다. 오히려 그 반대입니다. 지도를 가진 항해사가 거친 파도를 미리 대비하듯, 자신의 사주를 아는 사람은 인생의 풍랑 속에서 언제 돛을 올려야 할지, 언제 닻을 내리고 기다려야 할지를 결정할 수 있습니다.
                    </p>
                    <p>
                      사주는 "당신은 반드시 이렇게 된다"는 결정론적 예언이 아닙니다. 당신이 가진 <strong>'초기 조건(Initial Conditions)'</strong>을 알려주는 것입니다. 똑같은 씨앗이라도 사막에 심느냐, 옥토에 심느냐에 따라 결과가 다르듯, 자신의 사주(씨앗)를 정확히 아는 사람은 자신에게 가장 적합한 환경(선택)을 스스로 만들어낼 수 있습니다. 결국 사주 상담은 정해진 운명에 순응하기 위함이 아니라, 자신의 잠재력을 극대화하기 위한 전략적 가이드입니다.
                    </p>
                  </section>

                  <section>
                    <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-amber-400' : 'text-indigo-800'}`}>유아이가 제안하는 현대적 명리학의 가치</h3>
                    <p className="mb-4">
                      유아이는 고대의 지혜를 현대적인 기술과 결합하여 여러분에게 전달하고자 합니다. 우리는 당신의 삶을 단정 짓지 않습니다. 다만, 당신이 태어난 날의 차가운 금(金)의 기운이 냉철한 판단력을 주었음을, 혹은 뜨거운 화(火)의 기운이 세상을 밝히는 열정을 주었음을 데이터로 설명해 드립니다.
                    </p>
                    <p className="mb-4">
                      인생이라는 긴 여정에서 우리는 수많은 선택의 기로에 섭니다. 그때마다 사주는 당신이 누구인지, 지금 어떤 계절을 지나고 있는지 알려주는 든든한 등대가 되어줄 것입니다. 미신이라는 편견을 걷어내면, 그곳에는 나를 더 깊이 사랑하게 만드는 <strong>'자아 성찰의 과학'</strong>이 기다리고 있습니다.
                    </p>
                    <p className={`font-bold mt-8 ${isDarkMode ? 'text-neutral-200' : 'text-neutral-900'}`}>
                      유아이와 함께 당신만의 특별한 인생 지도를 펼쳐보세요. 당신의 내일은 오늘 당신이 자신을 얼마나 깊이 이해하느냐에 달려 있습니다.
                    </p>
                  </section>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Footer / Brand - Only show on Dashboard and Report tabs */}
          {isAnalyzed && activeTab !== 'chat' && activeTab !== 'article' && (
            <footer className={`mt-4 pt-8 pb-8 flex flex-col items-center justify-center transition-opacity duration-300 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              <p className="text-[10px] font-medium">Powered by 유아이(주) - 정밀 만세력 데이터 기반</p>
            </footer>
          )}

        </main>

        {/* Bottom Navigation */}
        {isAnalyzed && (
          <nav className={`print:hidden absolute bottom-0 w-full border-t flex justify-around items-center pb-safe pt-2 px-2 z-20 transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white/90 border-neutral-200'} backdrop-blur-md`}>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center p-2 w-16 transition-colors ${activeTab === 'dashboard' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : (isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600')}`}
            >
              <LayoutDashboard size={24} className="mb-1" />
              <span className="text-[10px] font-medium">대시보드</span>
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex flex-col items-center p-2 w-16 transition-colors ${activeTab === 'chat' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : (isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600')}`}
            >
              <MessageCircle size={24} className="mb-1" />
              <span className="text-[10px] font-medium">1:1 상담</span>
            </button>
            <button 
              onClick={() => setActiveTab('report')}
              className={`flex flex-col items-center p-2 w-16 transition-colors ${activeTab === 'report' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : (isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600')}`}
            >
              <FileText size={24} className="mb-1" />
              <span className="text-[10px] font-medium">운세 리포트</span>
            </button>
            <button 
              onClick={() => setActiveTab('guide')}
              className={`flex flex-col items-center p-2 w-16 transition-colors ${activeTab === 'guide' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : (isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600')}`}
            >
              <BookOpen size={24} className="mb-1" />
              <span className="text-[10px] font-medium">앱 가이드</span>
            </button>
          </nav>
        )}

        {/* Disclaimer Section */}
        {!isAnalyzed && (
          <div className={`absolute bottom-0 w-full p-4 text-center text-[10px] transition-colors duration-300 ${isDarkMode ? 'text-neutral-500 bg-neutral-900/80' : 'text-neutral-400 bg-white/80'} backdrop-blur-sm`}>
            유아이(주)는 사용자의 개인정보를 서버에 전송하거나 보관하지 않습니다.<br/>모든 데이터는 브라우저 종료 시 삭제됩니다.
          </div>
        )}

        {/* Deity Explanation Modal */}
        {/* Selected Deity Modal */}
        {selectedDeity && (
          <div 
            className="absolute inset-0 z-50 flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedDeity(null)}
          >
            <div 
              className={`w-full max-w-[300px] p-6 rounded-2xl shadow-2xl transform transition-all scale-100 ${isDarkMode ? 'bg-neutral-800 text-neutral-200 border border-neutral-700' : 'bg-white text-neutral-800'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                  <h3 className="font-handwriting text-3xl">{selectedDeity}</h3>
                </div>
                <button 
                  onClick={() => setSelectedDeity(null)} 
                  className={`p-1.5 rounded-full transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
                >
                  <X size={18} />
                </button>
              </div>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {deityExplanations[selectedDeity] || '해당 육친에 대한 설명이 준비되지 않았습니다.'}
              </p>
            </div>
          </div>
        )}

        {/* Time Estimator Modal */}
        {showTimeEstimator && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDarkMode ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`font-handwriting text-3xl ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>과거 사건으로 생시 찾기</h3>
                <button onClick={() => setShowTimeEstimator(false)} className="p-1 rounded-full hover:bg-neutral-200/50 text-neutral-500">
                  <X size={20} />
                </button>
              </div>
              
              <p className={`text-sm mb-6 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                과거에 있었던 중요한 사건 3가지를 입력해주세요. AI가 사주 원국과 대조하여 가장 확률이 높은 태어난 시간을 역추적합니다.
              </p>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {pastEvents.map((event, index) => (
                  <div key={index} className={`p-4 rounded-xl border ${isDarkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className="flex gap-2 mb-3">
                      <select
                        value={event.year}
                        onChange={(e) => {
                          const newEvents = [...pastEvents];
                          newEvents[index].year = e.target.value;
                          setPastEvents(newEvents);
                        }}
                        className={`w-1/3 p-2 rounded-lg border text-sm outline-none focus:border-indigo-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'}`}
                      >
                        <option value="">연도 선택</option>
                        {Array.from({length: 50}, (_, i) => {
                          const y = new Date().getFullYear() - i;
                          return <option key={y} value={y}>{y}년</option>
                        })}
                      </select>
                      
                      <select
                        value={event.type}
                        onChange={(e) => {
                          const newEvents = [...pastEvents];
                          newEvents[index].type = e.target.value;
                          setPastEvents(newEvents);
                        }}
                        className={`w-2/3 p-2 rounded-lg border text-sm outline-none focus:border-indigo-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'}`}
                      >
                        {EVENT_TYPES.map(type => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <input
                      type="text"
                      placeholder="사건에 대한 간단한 설명 (선택사항)"
                      value={event.description}
                      onChange={(e) => {
                        const newEvents = [...pastEvents];
                        newEvents[index].description = e.target.value;
                        setPastEvents(newEvents);
                      }}
                      className={`w-full p-2 rounded-lg border text-sm outline-none focus:border-indigo-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white placeholder-neutral-600' : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400'}`}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleEstimateTime}
                disabled={isEstimatingTime}
                className={`w-full mt-6 py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${isEstimatingTime ? 'bg-indigo-400 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              >
                {isEstimatingTime ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    분석 중...
                  </>
                ) : '생시 역추적 시작하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
