/**
 * 리포트 벤치 하네스 (IMPLEMENTATION_PLAN 1-4)
 *
 * 테스트 명식 N건(기본 50)을 일괄 생성해 검증 통과율·평균 원가·평균 소요시간을 집계하고,
 * OWNER 감수용 md 파일로 내보낸다. 프롬프트 조립·품질 평가는 프로덕션과 동일 경로
 * (src/lib/premiumReportCore.ts — SajuAnalysis 단일 소스 + 상품별 평가기)를 공유한다.
 *
 * 계획 대비 재정의(Phase 1-3과 동일한 기존-파이프라인 정합):
 *   - "검증 통과율"의 검증기 = 현행 품질 평가기(섹션 마커·필수 섹션·분량, 통과 = score ≥ 80,
 *     프로덕션 보정 트리거와 동일 기준). 금칙어·근거 검증 규칙은 OWNER 입력(골든셋·금칙어
 *     목록) 수신 후 validate 단계로 추가한다(플랜 1-3 품질 파트).
 *   - LLM은 현행 스택(Gemini 폴백 체인) 그대로. Anthropic 이관은 별도 결정 사항.
 *
 * 실행:
 *   npx tsx scripts/report-bench.ts                          # 50건, lifeNav
 *   npx tsx scripts/report-bench.ts --count 5                # 5건만
 *   npx tsx scripts/report-bench.ts --product yearly2026     # 상품 선택
 *   npx tsx scripts/report-bench.ts --no-repair              # 보정 1회 재시도 없이 단발
 *   npx tsx scripts/report-bench.ts --out bench-output/my-run
 *   npx tsx scripts/report-bench.ts --engine v1.5            # 자평 규칙 엔진 컨텍스트(v1.5)로 생성
 *   npx tsx scripts/report-bench.ts --ab --count 30          # 플랜 3-1 A/B: 케이스당 v1·v1.5 쌍 생성
 *                                                            #  → ab-compare.md 감수 후 ⛔ OWNER 병합 판정
 *
 * 필요 환경변수 (.env/.env.local 자동 로드):
 *   - ANTHROPIC_API_KEY — Claude Sonnet 5 우선 경로(프로덕션 파리티). 없으면 Gemini만 측정(경고).
 *   - GEMINI_API_KEY (또는 VITE_GEMINI_API_KEY) — Gemini 폴백 체인.
 * ⚠️ 실 API 호출 = 실 비용. 50건 전체 실행 전 --count 1~2로 스모크 권장.
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { assemblePremiumReportPrompt, evaluatePremiumReportQuality } from '../src/lib/premiumReportCore';
import { PRICING_USD_PER_M } from '../src/lib/modelPricing';
import { claudeStreamAggregate } from '../api/_lib/claude-stream';
import type { ReportInputData, ProductType } from '../src/lib/premiumOrderStore';

dotenv.config();
dotenv.config({ path: '.env.local' });

// ── 설정 ─────────────────────────────────────────────────────────────────────

// 프로덕션(generateLifeNavReport)과 동일 체인: Claude Sonnet 5 우선 → Gemini 폴백
// (OWNER 결정 2026-07-05). ANTHROPIC_API_KEY 미설정 시 Claude 구간을 건너뛰고 경고한다.
const PREMIUM_CLAUDE_MODEL = 'claude-sonnet-5';
const FALLBACK_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const PASS_SCORE = 80; // 프로덕션 보정 트리거와 동일 기준

// 단가표(PRICING_USD_PER_M)는 프로덕션 원가 집계와 단일 소스 공유 — src/lib/modelPricing.ts에서만 수정할 것.
const USD_KRW = Number(process.env.BENCH_USD_KRW || 1400);

// ── CLI 인자 ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const hasFlag = (name: string) => argv.includes(`--${name}`);

const COUNT = Math.max(1, parseInt(argValue('count') ?? '50', 10));
const PRODUCT = (argValue('product') ?? 'lifeNav') as 'lifeNav' | ProductType;
const NO_REPAIR = hasFlag('no-repair');
const DELAY_MS = Math.max(0, parseInt(argValue('delay') ?? '1000', 10));
type YongshinEngine = 'v1' | 'v1.5';
const ENGINE = (argValue('engine') ?? 'v1') as YongshinEngine; // 플랜 3-1 — v1.5 = 자평 규칙 엔진 컨텍스트
const AB = hasFlag('ab'); // 케이스당 v1·v1.5 쌍 생성(A/B 벤치, ⛔ OWNER 병합 판정용)
const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
const OUT_DIR = argValue('out') ?? path.join('bench-output', `bench-${PRODUCT}-${AB ? 'ab' : ENGINE}-${stamp}`);

const API_KEY = String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
if (!API_KEY) {
  console.error('GEMINI_API_KEY (또는 VITE_GEMINI_API_KEY) 가 필요합니다. .env/.env.local 확인.');
  process.exit(1);
}
const ANTHROPIC_KEY = String(process.env.ANTHROPIC_API_KEY || '').trim();
if (!ANTHROPIC_KEY) {
  console.warn('⚠️ ANTHROPIC_API_KEY 미설정 — Claude 우선 구간을 건너뛰고 Gemini 폴백 경로만 측정합니다(프로덕션 파리티 아님).');
}

// ── 테스트 명식 픽스처(결정론 — 시드 고정 LCG) ───────────────────────────────

const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

const CONCERNS = ['직장 이직 고민', '사업 확장 시기', '건강 관리', '재테크 방향', '없음'];
const INTERESTS = ['재물운', '직업운', '건강운', '가정운', '없음'];

const buildFixtures = (count: number): ReportInputData[] => {
  const rng = makeRng(20260705);
  const fixtures: ReportInputData[] = [];
  for (let i = 0; i < count; i++) {
    const year = 1950 + Math.floor(rng() * 56); // 1950~2005
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28);
    const hour = Math.floor(rng() * 24);
    const minute = Math.floor(rng() * 60);
    const unknownTime = i % 10 === 9; // 10%
    const isLunar = !unknownTime && i % 7 === 3; // ~14%
    fixtures.push({
      name: `벤치${String(i + 1).padStart(3, '0')}`,
      gender: i % 2 === 0 ? 'M' : 'F',
      birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      birthTime: unknownTime ? '' : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      isLunar,
      isLeap: false,
      unknownTime,
      concern: CONCERNS[Math.floor(rng() * CONCERNS.length)],
      interest: INTERESTS[Math.floor(rng() * INTERESTS.length)],
      reportLevel: 'basic',
      lifeEvents: [], // 골든셋 수신 전 단계 — 인생 이벤트 없는 기본형으로 측정
      adminNotes: '',
      productType: PRODUCT === 'lifeNav' ? undefined : PRODUCT,
    });
  }
  return fixtures;
};

// ── Gemini 호출(프로덕션 폴백 체인과 동일 판정 규칙) ─────────────────────────

type CallUsage = { model: string; inputTokens: number; outputTokens: number };
type CallResult = { text: string; usages: CallUsage[]; modelUsed: string };

const callGeminiWithFallback = async (
  systemText: string,
  userText: string,
  generationConfig: Record<string, unknown>,
): Promise<CallResult> => {
  let lastError: unknown = null;
  const usages: CallUsage[] = [];
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig,
          }),
        },
      );

      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMessage = data?.error?.message || 'Unknown error';
        const errCode = data?.error?.code;
        const errStatus = String(data?.error?.status || '').toUpperCase();
        const isTransient =
          response.status === 503 || response.status === 429 ||
          errCode === 503 || errCode === 429 ||
          errStatus === 'UNAVAILABLE' || errStatus === 'RESOURCE_EXHAUSTED';
        const isModelUnavailable = response.status === 404 || errCode === 404 || errStatus === 'NOT_FOUND';
        if (isTransient || isModelUnavailable) {
          console.warn(`  [fallback] ${model} 실패(${response.status} ${errStatus}) — 다음 모델 시도`);
          lastError = new Error(`Gemini API error (${model}): ${errMessage}`);
          continue;
        }
        throw new Error(`Gemini API error: ${errMessage}`);
      }

      const um = data?.usageMetadata ?? {};
      const inputTokens = Number(um.promptTokenCount ?? 0);
      const totalTokens = Number(um.totalTokenCount ?? 0);
      const candidateTokens = Number(um.candidatesTokenCount ?? 0);
      // 2.5 계열은 thinking 토큰도 출력 과금 — total-prompt 로 포함 산정
      const outputTokens = totalTokens > 0 ? Math.max(0, totalTokens - inputTokens) : candidateTokens;
      usages.push({ model, inputTokens, outputTokens });

      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        console.warn(`  [fallback] ${model} 빈 응답 — 다음 모델 시도`);
        lastError = new Error(`Gemini API returned empty text on ${model}`);
        continue;
      }
      return { text, usages, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      console.warn(`  [fallback] ${model} 예외 — 다음 모델 시도: ${err?.message || err}`);
    }
  }
  throw lastError || new Error('모든 Gemini 모델이 응답하지 않았습니다.');
};

/**
 * Claude Sonnet 5 직접 호출 — 프로덕션 프록시와 동일 구성:
 * SSE 수신 → 조립(헤더 타임아웃 회피) + thinking 비활성(생성 시간 단축).
 */
const callClaude = async (systemText: string, userText: string): Promise<CallResult> => {
  const { status, data } = await claudeStreamAggregate(ANTHROPIC_KEY, {
    model: PREMIUM_CLAUDE_MODEL,
    max_tokens: 32000,
    system: systemText,
    messages: [{ role: 'user', content: userText }],
    thinking: { type: 'disabled' },
  });
  const usage: CallUsage = {
    model: PREMIUM_CLAUDE_MODEL,
    inputTokens: Number(data?.usage?.input_tokens ?? 0),
    outputTokens: Number(data?.usage?.output_tokens ?? 0),
  };
  if (status !== 200) {
    throw Object.assign(new Error(`Claude API error (${status}): ${data?.error?.message || 'Unknown'}`), { usage });
  }
  const textBlock = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === 'text') : null;
  const text = textBlock ? String(textBlock.text) : '';
  if (!text) {
    throw Object.assign(new Error(`Claude returned empty text (stop_reason: ${data?.stop_reason ?? 'unknown'})`), { usage });
  }
  return { text, usages: [usage], modelUsed: PREMIUM_CLAUDE_MODEL };
};

/** 프로덕션 동일 체인: Claude Sonnet 5 우선 → Gemini 폴백. 실패한 Claude 시도의 과금 토큰도 원가에 반영. */
const callWithModelChain = async (
  systemText: string,
  userText: string,
  generationConfig: Record<string, unknown>,
): Promise<CallResult> => {
  if (!ANTHROPIC_KEY) return callGeminiWithFallback(systemText, userText, generationConfig);
  try {
    return await callClaude(systemText, userText);
  } catch (err: any) {
    console.warn(`  [fallback] ${PREMIUM_CLAUDE_MODEL} 실패 — Gemini 폴백: ${err?.message || err}`);
    const gem = await callGeminiWithFallback(systemText, userText, generationConfig);
    if (err?.usage && (err.usage.inputTokens > 0 || err.usage.outputTokens > 0)) {
      gem.usages.unshift(err.usage as CallUsage);
    }
    return gem;
  }
};

const costKrw = (usages: CallUsage[]): number =>
  usages.reduce((sum, u) => {
    const p = PRICING_USD_PER_M[u.model] ?? PRICING_USD_PER_M['gemini-2.5-pro'];
    return sum + ((u.inputTokens * p.input + u.outputTokens * p.output) / 1_000_000) * USD_KRW;
  }, 0);

// ── 벤치 본체 ────────────────────────────────────────────────────────────────

type CaseResult = {
  index: number;
  name: string;
  engine: YongshinEngine;
  input: ReportInputData;
  pass: boolean;
  score: number;
  issues: string[];
  repaired: boolean;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  costKrw: number;
  durationSec: number;
  error?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const runCase = async (
  input: ReportInputData,
  index: number,
  engine: YongshinEngine,
): Promise<{ result: CaseResult; reportText: string }> => {
  const started = Date.now();
  const allUsages: CallUsage[] = [];
  try {
    const { system, user, analysis } = assemblePremiumReportPrompt(input, { yongshinEngine: engine });

    const first = await callWithModelChain(system, user, { maxOutputTokens: 32768, temperature: 0.5, topP: 0.9 });
    allUsages.push(...first.usages);
    let modelUsed = first.modelUsed;
    let quality = evaluatePremiumReportQuality(input.productType, first.text, input.lifeEvents, analysis.daeun.length);
    let repaired = false;

    // 프로덕션과 동일한 1회 보정 루프
    if (!NO_REPAIR && quality.score < PASS_SCORE) {
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
        const second = await callWithModelChain(`${system}\n\n${repairInstruction}`, user, { maxOutputTokens: 32768, temperature: 0.3, topP: 0.85 });
        allUsages.push(...second.usages);
        const repairedQuality = evaluatePremiumReportQuality(input.productType, second.text, input.lifeEvents, analysis.daeun.length);
        if (repairedQuality.score >= quality.score) {
          quality = repairedQuality;
          modelUsed = second.modelUsed;
          repaired = true;
        }
      } catch (repairErr: any) {
        console.warn(`  [repair] 보정 실패, 원본 유지: ${repairErr?.message || repairErr}`);
      }
    }

    return {
      result: {
        index,
        name: input.name,
        engine,
        input,
        pass: quality.score >= PASS_SCORE,
        score: quality.score,
        issues: quality.issues,
        repaired,
        modelUsed,
        inputTokens: allUsages.reduce((s, u) => s + u.inputTokens, 0),
        outputTokens: allUsages.reduce((s, u) => s + u.outputTokens, 0),
        costKrw: costKrw(allUsages),
        durationSec: (Date.now() - started) / 1000,
      },
      reportText: quality.normalizedText,
    };
  } catch (err: any) {
    return {
      result: {
        index,
        name: input.name,
        engine,
        input,
        pass: false,
        score: 0,
        issues: [`생성 실패: ${err?.message || err}`],
        repaired: false,
        modelUsed: '-',
        inputTokens: allUsages.reduce((s, u) => s + u.inputTokens, 0),
        outputTokens: allUsages.reduce((s, u) => s + u.outputTokens, 0),
        costKrw: costKrw(allUsages),
        durationSec: (Date.now() - started) / 1000,
        error: String(err?.message || err),
      },
      reportText: '',
    };
  }
};

const fmtInput = (d: ReportInputData) =>
  `${d.birthDate} ${d.unknownTime ? '시간미상' : d.birthTime} ${d.isLunar ? '음력' : '양력'} ${d.gender === 'M' ? '남' : '여'}`;

const writeCaseMd = (dir: string, r: CaseResult, reportText: string) => {
  const engineSuffix = AB ? `-${r.engine.replace('.', '')}` : '';
  const lines = [
    `# 벤치 #${String(r.index + 1).padStart(3, '0')} — ${r.name} (${PRODUCT}, 엔진 ${r.engine})`,
    '',
    `- 입력: ${fmtInput(r.input)}`,
    `- 고민/관심사: ${r.input.concern} / ${r.input.interest}`,
    `- 판정: ${r.pass ? '✅ 통과' : '❌ 실패'} (score ${r.score}, 기준 ${PASS_SCORE})`,
    `- 모델: ${r.modelUsed}${r.repaired ? ' (보정 1회 실행)' : ''}`,
    `- 토큰: in ${r.inputTokens.toLocaleString()} / out ${r.outputTokens.toLocaleString()} → 추정 원가 ₩${Math.round(r.costKrw).toLocaleString()}`,
    `- 소요: ${r.durationSec.toFixed(1)}s`,
    '',
    '## 이슈',
    ...(r.issues.length ? r.issues.map((i) => `- ${i}`) : ['- 없음']),
    '',
    '## 본문 (원문)',
    '',
    reportText || '(생성 실패)',
    '',
  ];
  fs.writeFileSync(path.join(dir, `${String(r.index + 1).padStart(3, '0')}-${r.name}${engineSuffix}.md`), lines.join('\n'), 'utf8');
};

const writeSummary = (dir: string, results: CaseResult[], totalSec: number, fileBase = 'summary') => {
  const done = results.filter((r) => !r.error);
  const passed = results.filter((r) => r.pass);
  const passRate = results.length ? (passed.length / results.length) * 100 : 0;
  const avgCost = done.length ? done.reduce((s, r) => s + r.costKrw, 0) / done.length : 0;
  const avgSec = done.length ? done.reduce((s, r) => s + r.durationSec, 0) / done.length : 0;
  const totalCost = results.reduce((s, r) => s + r.costKrw, 0);

  const modelDist: Record<string, number> = {};
  for (const r of results) modelDist[r.modelUsed] = (modelDist[r.modelUsed] ?? 0) + 1;

  const dodPass = passRate >= 90;
  const dodCost = avgCost <= 500;

  const lines = [
    `# 리포트 벤치 결과 — ${PRODUCT} ${results.length}건 (${stamp})`,
    '',
    `| 지표 | 값 | DoD | 판정 |`,
    `|---|---|---|---|`,
    `| 검증 통과율 | ${passRate.toFixed(1)}% (${passed.length}/${results.length}) | ≥ 90% | ${dodPass ? '✅' : '❌'} |`,
    `| 평균 원가(추정) | ₩${Math.round(avgCost).toLocaleString()}/건 | ≤ ₩500 | ${dodCost ? '✅' : '❌'} |`,
    `| 평균 소요 | ${avgSec.toFixed(1)}s/건 | — | — |`,
    `| 총 비용(추정) | ₩${Math.round(totalCost).toLocaleString()} | — | — |`,
    `| 총 소요 | ${(totalSec / 60).toFixed(1)}분 | — | — |`,
    '',
    `- 통과 기준: 품질 평가기 score ≥ ${PASS_SCORE} (프로덕션 보정 트리거와 동일). 금칙어·근거 검증은 OWNER 입력 수신 후 추가 예정.`,
    `- 원가는 usageMetadata 토큰 × 공표 단가(USD→₩${USD_KRW}) 추정치. 보정 재시도 비용 포함.`,
    `- 모델 분포: ${Object.entries(modelDist).map(([m, c]) => `${m}×${c}`).join(', ')}`,
    `- 보정 실행: ${results.filter((r) => r.repaired).length}건 / 생성 실패: ${results.filter((r) => r.error).length}건`,
    '',
    '## 케이스별 결과',
    '',
    '| # | 입력 | 판정 | score | 모델 | 원가 | 소요 | 이슈 |',
    '|---|---|---|---|---|---|---|---|',
    ...results.map((r) =>
      `| ${String(r.index + 1).padStart(3, '0')} | ${fmtInput(r.input)} | ${r.pass ? '✅' : '❌'} | ${r.score} | ${r.modelUsed}${r.repaired ? '+보정' : ''} | ₩${Math.round(r.costKrw).toLocaleString()} | ${r.durationSec.toFixed(0)}s | ${r.issues.length ? r.issues.join('; ') : '-'} |`,
    ),
    '',
  ];
  fs.writeFileSync(path.join(dir, `${fileBase}.md`), lines.join('\n'), 'utf8');
  fs.writeFileSync(
    path.join(dir, `${fileBase}.json`),
    JSON.stringify({ product: PRODUCT, count: results.length, passRate, avgCostKrw: avgCost, avgDurationSec: avgSec, totalCostKrw: totalCost, dod: { passRate: dodPass, cost: dodCost }, results }, null, 2),
    'utf8',
  );
};

/** A/B 비교표(플랜 3-1) — 케이스별 v1↔v1.5 쌍을 나란히 놓고 OWNER 감수 판정란을 붙인다. */
const writeAbCompare = (dir: string, v1: CaseResult[], v15: CaseResult[]) => {
  const avg = (rs: CaseResult[], f: (r: CaseResult) => number) =>
    rs.length ? rs.reduce((s, r) => s + f(r), 0) / rs.length : 0;
  const passRate = (rs: CaseResult[]) => (rs.length ? (rs.filter((r) => r.pass).length / rs.length) * 100 : 0);
  const lines = [
    `# A/B 벤치 비교 — v1(프롬프트만) vs v1.5(자평 규칙 엔진 결합) · ${PRODUCT} ${v1.length}건 (${stamp})`,
    '',
    '플랜 3-1: 이 표와 케이스 쌍(md 파일 `-v1` / `-v15` 접미사)을 감수해 병합 여부를 판정한다(⛔ OWNER).',
    'v1.5는 yongshinContext를 자평 표준 판정 + 기준서 §조항 근거로 대체한 것 외에 동일 조건이다.',
    '',
    '| 지표 | v1 | v1.5 |',
    '|---|---|---|',
    `| 검증 통과율 | ${passRate(v1).toFixed(1)}% | ${passRate(v15).toFixed(1)}% |`,
    `| 평균 score | ${avg(v1, (r) => r.score).toFixed(1)} | ${avg(v15, (r) => r.score).toFixed(1)} |`,
    `| 평균 원가 | ₩${Math.round(avg(v1, (r) => r.costKrw)).toLocaleString()} | ₩${Math.round(avg(v15, (r) => r.costKrw)).toLocaleString()} |`,
    `| 평균 소요 | ${avg(v1, (r) => r.durationSec).toFixed(1)}s | ${avg(v15, (r) => r.durationSec).toFixed(1)}s |`,
    '',
    '## 케이스별 쌍 (감수 판정: v1 우세 / v1.5 우세 / 동급 중 기입)',
    '',
    '| # | 입력 | v1 score | v1.5 score | 감수 판정 | 메모 |',
    '|---|---|---|---|---|---|',
    ...v1.map((a, i) => {
      const b = v15[i];
      return `| ${String(a.index + 1).padStart(3, '0')} | ${fmtInput(a.input)} | ${a.pass ? '✅' : '❌'} ${a.score} | ${b ? `${b.pass ? '✅' : '❌'} ${b.score}` : '-'} |  |  |`;
    }),
    '',
    '## 병합 판정 (⛔ OWNER)',
    '',
    '- [ ] v1.5 병합 승인 — 기본 엔진을 v1.5로 전환(§1.1.3 provisional 문구 대체 포함)',
    '- [ ] 보류 — 사유:',
    '',
  ];
  fs.writeFileSync(path.join(dir, 'ab-compare.md'), lines.join('\n'), 'utf8');
};

const main = async () => {
  const fixtures = buildFixtures(COUNT);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const modeLabel = AB ? 'A/B(v1↔v1.5)' : `엔진 ${ENGINE}`;
  console.log(`리포트 벤치 시작 — ${PRODUCT} ${COUNT}건 · ${modeLabel} → ${OUT_DIR}`);
  console.log(`(보정: ${NO_REPAIR ? '끔' : '켬'}, 통과 기준 score ≥ ${PASS_SCORE})`);

  const started = Date.now();

  if (AB) {
    // 플랜 3-1 A/B — 케이스마다 v1·v1.5 쌍 생성(동일 픽스처·동일 체인)
    const v1Results: CaseResult[] = [];
    const v15Results: CaseResult[] = [];
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      console.log(`\n[${i + 1}/${COUNT}] ${f.name} — ${fmtInput(f)}`);
      for (const engine of ['v1', 'v1.5'] as const) {
        const { result, reportText } = await runCase(f, i, engine);
        (engine === 'v1' ? v1Results : v15Results).push(result);
        writeCaseMd(OUT_DIR, result, reportText);
        console.log(`  [${engine}] → ${result.pass ? '통과' : '실패'} (score ${result.score}) | ${result.modelUsed} | ₩${Math.round(result.costKrw)} | ${result.durationSec.toFixed(0)}s`);
        if (DELAY_MS > 0) await sleep(DELAY_MS);
      }
    }
    const totalSec = (Date.now() - started) / 1000;
    writeSummary(OUT_DIR, v1Results, totalSec, 'summary-v1');
    writeSummary(OUT_DIR, v15Results, totalSec, 'summary-v15');
    writeAbCompare(OUT_DIR, v1Results, v15Results);
    console.log(`\nA/B 완료 — 감수용 출력: ${path.resolve(OUT_DIR)}\\ab-compare.md (⛔ OWNER 병합 판정)`);
    return;
  }

  const results: CaseResult[] = [];
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    console.log(`\n[${i + 1}/${COUNT}] ${f.name} — ${fmtInput(f)}`);
    const { result, reportText } = await runCase(f, i, ENGINE);
    results.push(result);
    writeCaseMd(OUT_DIR, result, reportText);
    console.log(`  → ${result.pass ? '통과' : '실패'} (score ${result.score}) | ${result.modelUsed} | ₩${Math.round(result.costKrw)} | ${result.durationSec.toFixed(0)}s${result.issues.length ? ` | 이슈 ${result.issues.length}건` : ''}`);
    if (i < fixtures.length - 1 && DELAY_MS > 0) await sleep(DELAY_MS);
  }

  const totalSec = (Date.now() - started) / 1000;
  writeSummary(OUT_DIR, results, totalSec);

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n완료: 통과 ${passed}/${results.length} (${((passed / results.length) * 100).toFixed(1)}%) | 총 추정비용 ₩${Math.round(results.reduce((s, r) => s + r.costKrw, 0)).toLocaleString()} | ${(totalSec / 60).toFixed(1)}분`);
  console.log(`감수용 출력: ${path.resolve(OUT_DIR)}\\summary.md`);
};

main().catch((err) => {
  console.error('벤치 실행 실패:', err);
  process.exit(1);
});
