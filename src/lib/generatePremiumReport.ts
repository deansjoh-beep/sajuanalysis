import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import {
  getSajuData, getDaeunData, calculateYongshin, getDeityEnglishExplanation,
  getHapChungSummary, getShinsalSummary, getOriginalSipseungSummary, hanjaToHangul,
} from "../utils/saju";
import { SAJU_GUIDELINE, REPORT_GUIDELINE, BASIC_REPORT_GUIDELINE, ADVANCED_REPORT_GUIDELINE, YEARLY_FORTUNE_2026_GUIDELINE } from "../constants/guidelines";
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { PremiumOrder, ReportInputData, ReportSection, DaeunBlock } from "./premiumOrderStore";
import { getCurrentYearPillarKST, getTodayDayPillarKST, getMonthPillarsForYear } from './seoulDateGanji';
import { buildLifeNavReportPrompt, buildYearlyFortune2026Prompt } from './promptBuilders';

let runtimeGeminiApiKeyCache: string | undefined;

const LIFE_NAV_REQUIRED_SECTION_IDS = [
  'cover',
  'fourpillars',
  'yongshin',
  'profile',
  'daeun',
  'hapchung',
  'sinsal',
  'fortune',
  'fields',
  'concern',
  'admin',
  'glossary',
] as const;

const YEARLY_FORTUNE_REQUIRED_SECTION_IDS = [
  'cover',
  'chart',
  'answer',
  'yearly',
  'monthly',
  'checklist',
  'glossary',
] as const;

const stripCodeFence = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
};

const resolveGeminiApiKey = async (): Promise<string> => {
  const viteKey = String((import.meta as any).env?.VITE_GEMINI_API_KEY || '').trim();
  if (viteKey) return viteKey;

  const windowKey = String((window as any)?.GEMINI_API_KEY || '').trim();
  if (windowKey) return windowKey;

  if (runtimeGeminiApiKeyCache !== undefined) {
    return runtimeGeminiApiKeyCache;
  }

  try {
    const res = await fetch('/api/runtime-config');
    if (!res.ok) {
      runtimeGeminiApiKeyCache = '';
      return '';
    }
    const data = await res.json();
    runtimeGeminiApiKeyCache = String(data?.geminiApiKey || '').trim();
    return runtimeGeminiApiKeyCache;
  } catch {
    runtimeGeminiApiKeyCache = '';
    return '';
  }
};

export const generatePremiumReport = async (order: PremiumOrder): Promise<{ reportText: string; pdfUrl: string }> => {
  try {
    // 1. 사주 계산
    const saju = getSajuData(
      order.birthDate,
      order.birthTime,
      order.isLunar,
      order.isLeap,
      order.unknownTime,
      'Asia/Seoul'
    );

    const daeun = getDaeunData(
      order.birthDate,
      order.birthTime,
      order.isLunar,
      order.isLeap,
      order.gender,
      order.unknownTime
    );

    const yongshin = calculateYongshin(saju);
    const currentYearPillar = getCurrentYearPillarKST();
    const todayDayPillar = getTodayDayPillarKST();

    // 2. AI용 텍스트 생성
    const sajuText = saju.map((p) => {
      const stemDeityEng = getDeityEnglishExplanation(p.stem.deity);
      const branchDeityEng = getDeityEnglishExplanation(p.branch.deity);
      return `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja}) - 십성: ${p.stem.deity}/${p.branch.deity}` +
        (stemDeityEng ? ` (stem: ${stemDeityEng})` : '') +
        (branchDeityEng ? ` (branch: ${branchDeityEng})` : '');
    }).join('\n');

    const daeunText = daeun.map((d) => {
      const stemH = hanjaToHangul[d.stem] || d.stem;
      const branchH = hanjaToHangul[d.branch] || d.branch;
      return `${d.startAge}세(${d.startYear}~${d.startYear + 9}년) 대운: ${stemH}${branchH}`;
    }).join(', ');

    // 3. Gemini AI 호출 (REST API)
    const apiKey = await resolveGeminiApiKey();
    if (!apiKey) throw new Error('Gemini API key is not configured (.env에 GEMINI_API_KEY 설정 필요)');
    
    const prompt = `[서울 기준 기준값]
  현재 날짜: ${todayDayPillar.dateText}
  올해 세운(연도 간지): ${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}(${currentYearPillar.yearPillarHanja})
  오늘 일진: ${todayDayPillar.dayPillarHangul}(${todayDayPillar.dayPillarHanja})

  [연도/일진 고정 규칙]
  - 연도 간지(세운)를 언급할 때는 반드시 위의 "올해 세운(연도 간지)" 값을 그대로 사용하세요. 임의 추정/변경/혼용을 금지합니다.
  - 오늘 운세 또는 일진을 언급할 때는 반드시 위의 "오늘 일진" 값을 그대로 사용하세요. 임의 추정/변경/혼용을 금지합니다.

  [사용자 정보]
이름: ${order.name}
생년월일: ${order.birthDate}
성별: ${order.gender === 'M' ? '남성' : '여성'}

[사주 데이터]
${sajuText}

[대운]
${daeunText}

[용신 분석]
강약: ${yongshin.strength}
조후: ${yongshin.johooStatus}
용신: ${yongshin.yongshin}

[고객 추가 정보]
특별한 고민: ${order.concern || '없음'}
관심사: ${order.interest || '없음'}

위 정보를 바탕으로 ${order.name}님을 위한 프리미엄 사주 리포트를 작성해주세요.`;

    const fixedGanjiInstruction = `
[연도/일진 고정 규칙 - 최우선]
- 연도 간지(세운) 표기는 반드시 제공된 "올해 세운(연도 간지)" 값만 사용한다.
- 오늘 일진 표기는 반드시 제공된 "오늘 일진" 값만 사용한다.
- 다른 간지로 추정하거나 바꿔 쓰는 행위를 금지한다.
`;

    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SAJU_GUIDELINE}\n\n${REPORT_GUIDELINE}\n\n${fixedGanjiInstruction}` }]
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 16384 }
      })
    });

    if (!geminiResponse.ok) {
      const error = await geminiResponse.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const geminiData = await geminiResponse.json();
    const reportText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Report generation failed';

    // 4. PDF 생성
    const pdfUrl = await generateReportPDF(order, reportText);

    return { reportText, pdfUrl };
  } catch (error) {
    console.error('Failed to generate premium report:', error);
    throw error;
  }
};

const generateReportPDF = async (order: PremiumOrder, reportText: string): Promise<string> => {
  try {
    // HTML 템플릿 생성
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #333;
            line-height: 1.8;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 50px;
            border-bottom: 3px solid #0047AB;
            padding-bottom: 30px;
          }
          .header h1 {
            color: #0047AB;
            font-size: 36px;
            margin: 0 0 10px 0;
            font-weight: bold;
            letter-spacing: -0.5px;
          }
          .header p {
            color: #666;
            margin: 5px 0;
            font-size: 14px;
          }
          .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .section h2 {
            color: #0047AB;
            font-size: 22px;
            border-left: 5px solid #0047AB;
            padding-left: 15px;
            margin: 30px 0 15px 0;
            font-weight: bold;
            letter-spacing: -0.3px;
          }
          .section p {
            margin: 12px 0;
            text-align: justify;
            font-size: 15px;
            line-height: 1.9;
            letter-spacing: 0.3px;
          }
          .profile-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
            padding: 20px;
            background: #f5f7ff;
            border-radius: 8px;
          }
          .profile-item {
            padding: 15px;
            background: white;
            border-left: 4px solid #0047AB;
            border-radius: 4px;
          }
          .profile-item strong {
            font-size: 16px;
            color: #0047AB;
            display: block;
            margin-bottom: 8px;
          }
          .profile-item p {
            font-size: 15px;
            margin: 5px 0;
            line-height: 1.7;
          }
          .glossary-item {
            margin-bottom: 18px;
            padding: 15px;
            background: #f9fafb;
            border-left: 3px solid #0047AB;
            border-radius: 4px;
            page-break-inside: avoid;
          }
          .glossary-term {
            font-size: 16px;
            font-weight: bold;
            color: #0047AB;
            margin-bottom: 8px;
          }
          .glossary-definition {
            font-size: 15px;
            line-height: 1.7;
            color: #333;
          }
          .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #999;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${order.name}님의 프리미엄 사주 리포트</h1>
          <p>생년월일: ${order.birthDate}</p>
          <p>상품: ${order.tier === 'premium' ? '프리미엄 리포트' : '기본 리포트'}</p>
        </div>
        
        <div class="content">
          ${reportText.split('\n\n').map(paragraph => {
            if (paragraph.trim().startsWith('#')) {
              const lines = paragraph.split('\n');
              const heading = lines[0].replace(/^#+\s/, '').trim();
              const content = lines.slice(1).join('\n');
              return `<div class="section">
                <h2>${heading}</h2>
                ${content.split('\n').map(line => line.trim() ? `<p>${line.trim()}</p>` : '').join('')}
              </div>`;
            }
            return `<div class="section">${paragraph.trim().split('\n').filter(l => l.trim()).map(line => `<p>${line.trim()}</p>`).join('')}</div>`;
          }).join('')}
        </div>
        
        <div class="footer">
          <p>© 2024 UI Saju. 이 리포트는 AI 기반 사주 분석 시스템으로 생성되었습니다.</p>
          <p>본 분석은 참고용이며, 더 구체적인 상담은 전문가와 상담하시기 바랍니다.</p>
        </div>
      </body>
      </html>
    `;

    // HTML을 DOM으로 변환하기 위해 div에 추가
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    const htmlElement = container.querySelector('body') || container;

    // Canvas로 변환 (html2canvas: oklab 크래시 없음)
    const canvas = await html2canvas(htmlElement as HTMLElement, {
      backgroundColor: '#fff',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    // PDF 생성
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let yPosition = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, imgHeight);
    
    // 여러 페이지 처리
    while (yPosition + pageHeight < imgHeight) {
      yPosition -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, imgHeight);
    }

    // Firebase Storage에 업로드
    const pdfBlob = pdf.output('blob') as Blob;
    const storageRef = ref(storage, `premiumReports/${order.orderId}_v${order.version}.pdf`);
    
    await uploadBytes(storageRef, pdfBlob);
    const downloadUrl = await getDownloadURL(storageRef);

    return downloadUrl;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 인생 네비게이션 리포트 생성
// ─────────────────────────────────────────────────────────────────────────────

/** [DAEUN_START]...[DAEUN_END] 블록 파싱 */
const parseDaeunBlocks = (content: string, lifeEvents: { year: number; description: string }[]): DaeunBlock[] => {
  const blocks: DaeunBlock[] = [];
  const regex = /\[DAEUN_START\]\s*(.*?)\s*\[DAEUN_CONTENT\]([\s\S]*?)\[DAEUN_END\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    const label = m[1].trim();
    const blockContent = m[2].trim();
    // e.g. "甲子운 (5~14세)"
    const ageMatch = label.match(/\((\d+)~(\d+)세\)/);
    const startAge = ageMatch ? parseInt(ageMatch[1]) : 0;
    const endAge = ageMatch ? parseInt(ageMatch[2]) : startAge + 9;

    // 이 대운 기간 내의 인생 이벤트 매핑
    const birthYear = 0; // 실제 생년 없이 나이로만 비교하기 어려우므로 별도 처리 없이 이미 AI 본문에 포함
    const relatedEvents = lifeEvents.filter(e => {
      // 이 블록의 label 안에 해당 연도 언급이 있으면 연결
      return blockContent.includes(String(e.year));
    });

    blocks.push({ label, startAge, endAge, content: blockContent, lifeEvents: relatedEvents });
  }
  return blocks;
};

/** 섹션 마커 파싱: [SECTION] id [TITLE] ... [SUMMARY] ... [CONTENT] ... [END] */
const parseLifeNavSections = (
  raw: string,
  lifeEvents: { year: number; description: string }[]
): ReportSection[] => {
  const sections: ReportSection[] = [];
  const regex = /\[SECTION\]\s*(\S+)\s*\[TITLE\]\s*([\s\S]*?)\s*\[SUMMARY\]\s*([\s\S]*?)\s*\[CONTENT\]\s*([\s\S]*?)\s*\[END\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    const id = m[1].trim();
    const title = m[2].trim();
    const summary = m[3].trim();
    const content = m[4].trim();
    const daeunBlocks = id === 'daeun' ? parseDaeunBlocks(content, lifeEvents) : undefined;
    sections.push({ id, title, summary, content, daeunBlocks });
  }
  return sections;
};

const evaluateLifeNavReportQuality = (
  rawText: string,
  lifeEvents: { year: number; description: string }[],
  expectedDaeunCount: number
): {
  score: number;
  issues: string[];
  normalizedText: string;
  sections: ReportSection[];
} => {
  const normalizedText = stripCodeFence(rawText);
  const sections = parseLifeNavSections(normalizedText, lifeEvents);
  const issues: string[] = [];

  if (sections.length === 0) {
    issues.push('섹션 마커 파싱 실패');
  }

  const ids = new Set(sections.map((s) => s.id));
  LIFE_NAV_REQUIRED_SECTION_IDS.forEach((id) => {
    if (!ids.has(id)) {
      issues.push(`필수 섹션 누락: ${id}`);
    }
  });

  sections.forEach((section) => {
    if (section.id === 'cover') return;
    const contentLen = section.content.replace(/\s+/g, '').length;
    if (contentLen < 120) {
      issues.push(`본문이 너무 짧음: ${section.id}`);
    }
  });

  const daeunSection = sections.find((s) => s.id === 'daeun');
  const actualDaeunBlocks = daeunSection?.daeunBlocks?.length ?? 0;
  const expectedMinDaeunBlocks = Math.max(8, Math.min(12, expectedDaeunCount));
  if (actualDaeunBlocks < expectedMinDaeunBlocks) {
    issues.push(`대운 블록 부족: ${actualDaeunBlocks}/${expectedMinDaeunBlocks}`);
  }

  const score = Math.max(0, 100 - (issues.length * 12));
  return { score, issues, normalizedText, sections };
};

const evaluateYearlyFortuneQuality = (
  rawText: string
): {
  score: number;
  issues: string[];
  normalizedText: string;
  sections: ReportSection[];
} => {
  const normalizedText = stripCodeFence(rawText);
  const sections = parseLifeNavSections(normalizedText, []);
  const issues: string[] = [];

  if (sections.length === 0) issues.push('섹션 마커 파싱 실패');

  const ids = new Set(sections.map((s) => s.id));
  YEARLY_FORTUNE_REQUIRED_SECTION_IDS.forEach((id) => {
    if (!ids.has(id)) issues.push(`필수 섹션 누락: ${id}`);
  });

  sections.forEach((section) => {
    if (section.id === 'cover') return;
    const contentLen = section.content.replace(/\s+/g, '').length;
    if (section.id === 'answer' && contentLen < 1200) {
      issues.push(`Part I(answer) 분량 부족: ${contentLen}자 (2,000자 권장)`);
    } else if (section.id === 'monthly' && contentLen < 2000) {
      issues.push(`Part III(monthly) 분량 부족: ${contentLen}자`);
    } else if (contentLen < 120) {
      issues.push(`본문이 너무 짧음: ${section.id}`);
    }
  });

  // 월별 블록 개수 확인 (최소 10개)
  const monthlySection = sections.find((s) => s.id === 'monthly');
  if (monthlySection) {
    const monthBlockCount = (monthlySection.content.match(/\[MONTH_START\]/g) || []).length;
    if (monthBlockCount < 10) {
      issues.push(`월별 블록 부족: ${monthBlockCount}/12`);
    }
  }

  const score = Math.max(0, 100 - issues.length * 12);
  return { score, issues, normalizedText, sections };
};

export const generateLifeNavReport = async (
  inputData: ReportInputData,
  signal?: AbortSignal
): Promise<{ sections: ReportSection[]; saju: any; daeun: any; yongshin: any }> => {
  // 1. 사주 계산
  const saju = getSajuData(
    inputData.birthDate,
    inputData.birthTime,
    inputData.isLunar,
    inputData.isLeap,
    inputData.unknownTime,
    'Asia/Seoul'
  );

  const daeun = getDaeunData(
    inputData.birthDate,
    inputData.birthTime,
    inputData.isLunar,
    inputData.isLeap,
    inputData.gender,
    inputData.unknownTime
  );

  const yongshin = calculateYongshin(saju);
  const currentYearPillar = getCurrentYearPillarKST();

  // 2. 컨텍스트 문자열 생성
  const sajuContext = saju.map((p: any) => {
    const stemDeityEng = getDeityEnglishExplanation(p.stem.deity);
    const branchDeityEng = getDeityEnglishExplanation(p.branch.deity);
    return `${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja}) — 십성: ${p.stem.deity}/${p.branch.deity}` +
      (stemDeityEng ? ` (${stemDeityEng})` : '') +
      (branchDeityEng ? ` (${branchDeityEng})` : '');
  }).join('\n');

  const daeunContext = daeun.map((d: any) => {
    const stemHangul = hanjaToHangul[d.stem] || d.stem;
    const branchHangul = hanjaToHangul[d.branch] || d.branch;
    return `${d.startAge}세(${d.startYear}~${d.startYear + 9}년) 대운: ${stemHangul}(${d.stem})${branchHangul}(${d.branch})`;
  }).join(', ');

  const yongshinContext = `강약: ${yongshin.strength} | 조후: ${yongshin.johooStatus} | 용신: ${yongshin.yongshin} | 기신: ${yongshin.eokbuYongshin ?? ''} | 논리: ${yongshin.logicBasis ?? ''}`;

  const hapchungContext = getHapChungSummary(saju);
  const shinsalContext = getShinsalSummary(saju);
  const sipseungContext = getOriginalSipseungSummary(saju[2]?.stem?.hanja ?? '', saju);

  const lifeEventsText = inputData.lifeEvents.length > 0
    ? inputData.lifeEvents.map(e => `${e.year}년: ${e.description}`).join('\n')
    : '없음';

  // 현재 나이 계산
  const birthYear = parseInt(inputData.birthDate.split('-')[0]);
  const currentAge = currentYearPillar.year - birthYear;

  const isYearlyFortune = inputData.productType === 'yearly2026';

  let system: string;
  let user: string;

  if (isYearlyFortune) {
    // 2026 월별 간지 텍스트
    const monthPillars = getMonthPillarsForYear(currentYearPillar.year);
    const monthPillarsText = monthPillars
      .map((p) => `${p.month}월: ${p.monthPillarHanja}(${p.monthPillarHangul})`)
      .join('\n');

    const built = buildYearlyFortune2026Prompt({
      userName: inputData.name,
      gender: inputData.gender,
      birthDate: inputData.birthDate,
      birthTime: inputData.birthTime,
      isLunar: inputData.isLunar,
      isLeap: inputData.isLeap,
      unknownTime: inputData.unknownTime,
      sajuContext: `${sajuContext}\n\n[합충형파해]\n${hapchungContext}\n\n[십이신살]\n${shinsalContext}\n\n[십이운성]\n${sipseungContext}`,
      daeunContext,
      yongshinContext,
      currentAge,
      currentYearText: `${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}(${currentYearPillar.yearPillarHanja})`,
      monthPillarsText,
      currentJob: inputData.currentJob || '',
      concern: inputData.concern,
      interest: inputData.interest,
      yearlyFortuneGuideline: YEARLY_FORTUNE_2026_GUIDELINE,
    });
    system = built.system;
    user = built.user;
  } else {
    const levelGuideline = inputData.reportLevel === 'advanced'
      ? ADVANCED_REPORT_GUIDELINE
      : inputData.reportLevel === 'both'
        ? `${ADVANCED_REPORT_GUIDELINE}\n\n${BASIC_REPORT_GUIDELINE}`
        : BASIC_REPORT_GUIDELINE;

    const built = buildLifeNavReportPrompt({
      userName: inputData.name,
      gender: inputData.gender,
      birthDate: inputData.birthDate,
      birthTime: inputData.birthTime,
      isLunar: inputData.isLunar,
      isLeap: inputData.isLeap,
      unknownTime: inputData.unknownTime,
      reportLevel: inputData.reportLevel,
      sajuContext: `${sajuContext}\n\n[합충형파해]\n${hapchungContext}\n\n[십이신살]\n${shinsalContext}\n\n[십이운성]\n${sipseungContext}`,
      daeunContext,
      yongshinContext,
      currentAge,
      currentYearText: `${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}(${currentYearPillar.yearPillarHanja})`,
      lifeEventsText,
      concern: inputData.concern,
      interest: inputData.interest,
      adminNotes: inputData.adminNotes,
      levelGuideline,
    });
    system = built.system;
    user = built.user;
  }

  // 3. Gemini AI 호출 (폴백 체인: 2.5-flash → 2.0-flash → 2.0-flash-lite → 1.5-flash)
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is not configured (.env에 GEMINI_API_KEY 설정 필요)');

  // 유료 리포트 전용 모델 체인 — 최고급(2.5-pro) 우선, 503 등 장애 시 flash 계열로 폴백
  const FALLBACK_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  const callGeminiWithFallback = async (
    systemText: string,
    userText: string,
    generationConfig: any,
  ): Promise<string> => {
    let lastError: any = null;
    for (const model of FALLBACK_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemText }] },
              contents: [{ role: 'user', parts: [{ text: userText }] }],
              generationConfig,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          const errMessage = error?.error?.message || 'Unknown error';
          const errCode = error?.error?.code;
          const errStatus = String(error?.error?.status || '').toUpperCase();
          const isTransient =
            response.status === 503 ||
            response.status === 429 ||
            errCode === 503 ||
            errCode === 429 ||
            errStatus === 'UNAVAILABLE' ||
            errStatus === 'RESOURCE_EXHAUSTED';
          const isModelUnavailable = response.status === 404 || errCode === 404 || errStatus === 'NOT_FOUND';
          if (isTransient || isModelUnavailable) {
            console.warn(`[MODEL_FALLBACK] generatePremiumReport: ${model} failed (${response.status} ${errStatus}) — trying next model.`);
            lastError = new Error(`Gemini API error (${model}): ${errMessage}`);
            continue;
          }
          throw new Error(`Gemini API error: ${errMessage}`);
        }

        const data = await response.json();
        const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!text) {
          console.warn(`[MODEL_FALLBACK] generatePremiumReport: ${model} returned empty — trying next model.`);
          lastError = new Error(`Gemini API returned empty text on ${model}`);
          continue;
        }
        if (model !== FALLBACK_MODELS[0]) {
          console.info(`[MODEL_FALLBACK] generatePremiumReport: succeeded on fallback ${model}`);
        }
        return text;
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        lastError = err;
        console.warn(`[MODEL_FALLBACK] generatePremiumReport: ${model} threw — trying next model.`, err?.message || err);
      }
    }
    throw lastError || new Error('모든 Gemini 모델이 응답하지 않았습니다. 잠시 후 다시 시도해주세요.');
  };

  const rawText = await callGeminiWithFallback(
    `${SAJU_GUIDELINE}\n\n${system}`,
    user,
    { maxOutputTokens: 32768, temperature: 0.5, topP: 0.9 }
  );

  let quality = isYearlyFortune
    ? evaluateYearlyFortuneQuality(rawText)
    : evaluateLifeNavReportQuality(rawText, inputData.lifeEvents, daeun.length);

  // 품질 점수가 낮으면 1회 보정 생성 시도
  if (quality.score < 80) {
    const repairInstruction = [
      '[품질 보정 모드 - 최우선]',
      '- 아래 누락/불충분 항목을 반드시 모두 보완하세요.',
      '- 기존 텍스트를 요약하지 말고, 동일 Output Format을 유지한 완전한 본문을 다시 작성하세요.',
      '- 특히 [SECTION] 마커, [DAEUN_START]/[DAEUN_END], [FIELD_직업]~[/FIELD_연애], [ACTION_PLAN] 형식을 정확히 지키세요.',
      '',
      '[보완 필요 항목]',
      ...quality.issues.map((issue) => `- ${issue}`),
    ].join('\n');

    try {
      const repairedRawText = await callGeminiWithFallback(
        `${SAJU_GUIDELINE}\n\n${system}\n\n${repairInstruction}`,
        user,
        { maxOutputTokens: 32768, temperature: 0.3, topP: 0.85 }
      );
      const repairedQuality = isYearlyFortune
        ? evaluateYearlyFortuneQuality(repairedRawText)
        : evaluateLifeNavReportQuality(repairedRawText, inputData.lifeEvents, daeun.length);
      if (repairedQuality.score >= quality.score) {
        quality = repairedQuality;
      }
    } catch (repairErr: any) {
      // 보정 실패는 치명적이지 않으므로 원본 결과로 진행
      console.warn('[generatePremiumReport] quality repair failed, using original:', repairErr?.message || repairErr);
    }
  }

  // 4. 섹션 파싱
  const sections = quality.sections;

  // 파싱 실패 시 단일 섹션으로 fallback
  if (sections.length === 0) {
    sections.push({
      id: 'raw',
      title: '인생 네비게이션 분석',
      summary: '',
      content: quality.normalizedText,
    });
  }

  return { sections, saju, daeun, yongshin };
};

