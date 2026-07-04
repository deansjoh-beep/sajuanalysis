import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import {
  getSajuData, getDaeunData, calculateYongshin, getDeityEnglishExplanation, hanjaToHangul,
} from "../utils/saju";
import { toLegacyYongshin } from './analysis/gyeokyongshin';
import { assemblePremiumReportPrompt, evaluatePremiumReportQuality } from './premiumReportCore';
import { SAJU_GUIDELINE, REPORT_GUIDELINE } from "../constants/guidelines";
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { PremiumOrder, ReportInputData, ReportSection } from "./premiumOrderStore";
import { getCurrentYearPillarKST, getTodayDayPillarKST } from './seoulDateGanji';

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

    const geminiResponse = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
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
// (프롬프트 조립·섹션 파싱·품질 평가는 premiumReportCore.ts — 벤치 하네스와 공유)
// ─────────────────────────────────────────────────────────────────────────────

export const generateLifeNavReport = async (
  inputData: ReportInputData,
  signal?: AbortSignal
): Promise<{ sections: ReportSection[]; saju: any; daeun: any; yongshin: any }> => {
  // 1. 프롬프트 조립 — SajuAnalysis 단일 소스(코어 모듈, 벤치 하네스와 동일 경로).
  const { system, user, analysis } = assemblePremiumReportPrompt(inputData);

  // 미리보기 UI(PremiumReportPreview)는 아직 레거시 saju 배열 형태를 소비하므로 반환용으로만 유지.
  const saju = getSajuData(
    inputData.birthDate,
    inputData.birthTime,
    inputData.isLunar,
    inputData.isLeap,
    inputData.unknownTime,
    'Asia/Seoul'
  );

  const daeun = analysis.daeun;
  const yongshin = analysis.gyeokYongshin
    ? toLegacyYongshin(analysis.gyeokYongshin)
    : calculateYongshin(saju);

  // 2. Gemini AI 호출 (폴백 체인: 2.5-pro → 2.5-flash → 2.0-flash → 1.5-flash)
  const FALLBACK_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  const callGeminiWithFallback = async (
    systemText: string,
    userText: string,
    generationConfig: any,
  ): Promise<string> => {
    let lastError: any = null;
    for (const model of FALLBACK_MODELS) {
      try {
        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
              model,
              systemInstruction: { parts: [{ text: systemText }] },
              contents: [{ role: 'user', parts: [{ text: userText }] }],
              generationConfig,
            }),
          });

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

  // system은 코어 모듈이 SAJU_GUIDELINE 포함 완성본으로 반환한다.
  const rawText = await callGeminiWithFallback(
    system,
    user,
    { maxOutputTokens: 32768, temperature: 0.5, topP: 0.9 }
  );

  let quality = evaluatePremiumReportQuality(inputData.productType, rawText, inputData.lifeEvents, daeun.length);

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
        `${system}\n\n${repairInstruction}`,
        user,
        { maxOutputTokens: 32768, temperature: 0.3, topP: 0.85 }
      );
      const repairedQuality = evaluatePremiumReportQuality(inputData.productType, repairedRawText, inputData.lifeEvents, daeun.length);
      if (repairedQuality.score >= quality.score) {
        quality = repairedQuality;
      }
    } catch (repairErr: any) {
      // 보정 실패는 치명적이지 않으므로 원본 결과로 진행
      console.warn('[generatePremiumReport] quality repair failed, using original:', repairErr?.message || repairErr);
    }
  }

  // 3. 섹션 파싱
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

