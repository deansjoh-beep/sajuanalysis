import { generateLifeNavReport } from './generatePremiumReport';
import type { ProductType, ReportInputData, ReportSection } from './premiumOrderStore';

// ─────────────────────────────────────────────────────────────────────────────
// 자동 생성 파이프 (Phase 3-3) — 브라우저에서 구동.
//
// 생성은 반드시 "생년월일 입력 직후" 실행돼야 한다. 저장된 myeongsik(pillars)에는
// 생년월일·이름이 없어 assemblePremiumReportPrompt가 사주를 재계산할 수 없기 때문.
// 리딤(선물/베타) 직후와 결제 확정 직후, 두 진입점이 이 모듈을 공유한다.
//
// 개인정보 불변식: reports.content는 DB에 저장되므로 프롬프트에 실명을 주입하지 않는다
// (중립 호칭). 생년월일 원문도 리포트 본문에 남기지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

/** 생년월일 입력 폼값 — CodeLookupTab의 GiftRedeemForm과 동일 형상. */
export interface BirthFormInput {
  dateStr: string; // 'YYYY-MM-DD'
  timeStr: string; // 'HH:mm'
  isLunar: boolean;
  gender: 'M' | 'F';
  unknownTime: boolean;
}

/** 생년월일 폼값 + 상품 → generateLifeNavReport가 소비하는 ReportInputData. */
export function buildReportInputFromBirth(
  birth: BirthFormInput,
  product: ProductType,
): ReportInputData {
  return {
    // 개인정보 불변식: 실명 미주입 → 저장될 본문에 이름이 남지 않는다.
    name: '',
    gender: birth.gender,
    birthDate: birth.dateStr,
    birthTime: birth.unknownTime ? '12:00' : birth.timeStr,
    isLunar: birth.isLunar,
    isLeap: false,
    unknownTime: birth.unknownTime,
    concern: '',
    interest: '',
    // premium 이외 상품은 reportLevel 무관. 기본값 advanced.
    reportLevel: 'advanced',
    lifeEvents: [],
    adminNotes: '',
    productType: product,
  };
}

// strictNullChecks가 꺼져 있어 boolean 판별자는 좁혀지지 않는다 → 문자열 판별자 사용.
export type RunReportGenerationResult =
  | { status: 'ok'; reportId: string | null; sections: ReportSection[] }
  | { status: 'aborted' }
  | { status: 'error'; reason: string };

interface RunReportGenerationParams {
  code: string;
  orderId: string;
  product: ProductType;
  birth: BirthFormInput;
  signal?: AbortSignal;
}

/**
 * 리포트 생성 → save-report 저장까지의 단일 흐름.
 * 저장은 generateLifeNavReport가 반환하는 원문(content, 마커 보존)을 그대로 사용하므로
 * 조회 시 parseLifeNavSections로 동일 섹션이 복원된다(라운드트립).
 */
export async function runReportGeneration(
  params: RunReportGenerationParams,
): Promise<RunReportGenerationResult> {
  const { code, orderId, product, birth, signal } = params;

  const input = buildReportInputFromBirth(birth, product);

  let generated: Awaited<ReturnType<typeof generateLifeNavReport>>;
  try {
    generated = await generateLifeNavReport(input, signal);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { status: 'aborted' };
    }
    return { status: 'error', reason: e instanceof Error ? e.message : '리포트 생성에 실패했습니다.' };
  }

  const content = generated.content;
  // save-report는 content 100–300,000자를 요구한다.
  if (!content || content.length < 100) {
    return { status: 'error', reason: '생성된 리포트가 비정상적으로 짧습니다. 다시 시도해 주세요.' };
  }

  try {
    const res = await fetch('/api/code/save-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        code,
        orderId,
        content,
        qualityScore: generated.qualityScore,
        // 관리자 원가 통계(reports.generation_cost_krw)용 — 토큰 사용량 기반 추정치.
        generationCostKrw: generated.generationCostKrw,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: 'error', reason: data?.message || '리포트 저장에 실패했습니다.' };
    }
    return { status: 'ok', reportId: data?.reportId ?? null, sections: generated.sections };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { status: 'aborted' };
    }
    return { status: 'error', reason: e instanceof Error ? e.message : '리포트 저장에 실패했습니다.' };
  }
}
