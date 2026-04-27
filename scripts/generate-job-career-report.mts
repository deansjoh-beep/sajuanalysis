/**
 * 직업운 리포트 생성 스크립트
 * 사용법: GEMINI_API_KEY=xxx npx tsx scripts/generate-job-career-report.mts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: false });

import { getSajuData, getDaeunData, calculateYongshin, getDeityEnglishExplanation, getHapChungSummary, getShinsalSummary, getOriginalSipseungSummary, hanjaToHangul } from '../src/utils/saju.js';
import { getCurrentYearPillarKST } from '../src/lib/seoulDateGanji.js';
import { JOB_CAREER_GUIDELINE } from '../src/constants/guidelines/job-career.js';
import { buildJobCareerPrompt } from '../src/lib/promptBuilders.js';
import fs from 'fs';
import path from 'path';

// ── 대상자 정보 ──────────────────────────────────────────────
const BIRTH_DATE  = '1969-12-02';
const BIRTH_TIME  = '10:00';
const IS_LUNAR    = false;
const IS_LEAP     = false;
const UNKNOWN_TIME = false;
const GENDER      = 'M' as const;

// 직업운 리포트 입력값 (테스트용)
const CURRENT_JOB    = '직장인';
const CAREER_CONCERN = '현재 직장에서 계속 일할지, 아니면 독립 창업을 해야 할지 결정이 필요합니다.';
const CAREER_GOAL    = '5년 내 독립 창업 또는 임원 승진';
const WORK_HISTORY   = '1995년 대기업 입사, 2005년 이직, 현재까지 동일 업종 근무';

// ────────────────────────────────────────────────────────────

const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
  console.error('   실행 방법: GEMINI_API_KEY=your_key npx tsx scripts/generate-job-career-report.mts');
  process.exit(1);
}

console.log('📐 사주 계산 중...');

const saju = getSajuData(BIRTH_DATE, BIRTH_TIME, IS_LUNAR, IS_LEAP, UNKNOWN_TIME, 'Asia/Seoul');
const daeun = getDaeunData(BIRTH_DATE, BIRTH_TIME, IS_LUNAR, IS_LEAP, GENDER, UNKNOWN_TIME);
const yongshin = calculateYongshin(saju);
const currentYearPillar = getCurrentYearPillarKST();

// 사주 텍스트
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

const birthYear = parseInt(BIRTH_DATE.split('-')[0]);
const currentAge = currentYearPillar.year - birthYear;

const seun3YText = [
  '2026년: 병오(丙午) — 천간 丙(양화), 지지 午(화)',
  '2027년: 정미(丁未) — 천간 丁(음화), 지지 未(토)',
  '2028년: 무신(戊申) — 천간 戊(양토), 지지 申(금)',
].join('\n');

console.log('─'.repeat(60));
console.log('📊 사주 원국');
saju.forEach((p: any) => console.log(`  ${p.title}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja})`));
console.log(`\n📈 용신: ${yongshin.yongshin} | 강약: ${yongshin.strength}`);
console.log(`👤 현재 나이: ${currentAge}세 | 올해: ${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}`);
console.log('─'.repeat(60));

const { system, user } = buildJobCareerPrompt({
  userName: '의뢰인',
  gender: GENDER,
  birthDate: BIRTH_DATE,
  birthTime: BIRTH_TIME,
  isLunar: IS_LUNAR,
  isLeap: IS_LEAP,
  unknownTime: UNKNOWN_TIME,
  sajuContext: `${sajuContext}\n\n[합충형파해]\n${hapchungContext}\n\n[십이신살]\n${shinsalContext}\n\n[십이운성]\n${sipseungContext}`,
  daeunContext,
  yongshinContext,
  currentAge,
  currentYearText: `${currentYearPillar.year}년 ${currentYearPillar.yearPillarHangul}(${currentYearPillar.yearPillarHanja})`,
  todayDateText: (() => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const y = p.find(x => x.type === 'year')?.value ?? '';
    const m = parseInt(p.find(x => x.type === 'month')?.value ?? '0');
    const d = parseInt(p.find(x => x.type === 'day')?.value ?? '0');
    return `${y}년 ${m}월 ${d}일`;
  })(),
  seun3YText,
  currentJob: CURRENT_JOB,
  careerConcern: CAREER_CONCERN,
  careerGoal: CAREER_GOAL,
  workHistory: WORK_HISTORY,
  jobCareerGuideline: JOB_CAREER_GUIDELINE,
});

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-pro-latest'];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

console.log('\n🤖 Gemini AI 리포트 생성 중...\n');

async function callGemini(model: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 32768, temperature: 0.5, topP: 0.9 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errStatus = String(err?.error?.status || '').toUpperCase();
    const isTransient = response.status === 503 || response.status === 429 || errStatus === 'UNAVAILABLE';
    const isNotFound = response.status === 404 || errStatus === 'NOT_FOUND';
    if (isNotFound) throw Object.assign(new Error(err?.error?.message || 'not found'), { isNotFound: true });
    if (isTransient) throw Object.assign(new Error(err?.error?.message || 'transient error'), { isTransient: true });
    throw new Error(`Gemini API 오류: ${err?.error?.message || response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw Object.assign(new Error('empty response'), { isEmpty: true });
  return text;
}

let reportText = '';
let lastError: any = null;

outer: for (const model of FALLBACK_MODELS) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      console.log(`  ↩ ${model} 재시도 중 (${attempt}/${MAX_RETRIES})...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
    try {
      reportText = await callGemini(model);
      console.log(`✅ 모델: ${model} (시도 ${attempt}회)`);
      break outer;
    } catch (e: any) {
      lastError = e;
      if (e.isNotFound || e.isEmpty) {
        console.warn(`  ⚠ ${model} 폴백 (${e.message})`);
        break; // 다음 모델로
      }
      // 503/429 → 재시도
      console.warn(`  ⚠ ${model} 오류 (${e.message}) — ${attempt < MAX_RETRIES ? '재시도' : '다음 모델로 폴백'}`);
    }
  }
}

if (!reportText) {
  console.error('❌ 모든 모델 실패:', lastError?.message);
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'scripts', 'output');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `job-career-${BIRTH_DATE}.md`);
fs.writeFileSync(outPath, reportText, 'utf-8');

console.log(`\n📄 리포트 저장 완료: ${outPath}`);
console.log(`\n${'═'.repeat(60)}`);
console.log(reportText);
