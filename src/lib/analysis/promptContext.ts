/**
 * 프리미엄 리포트 프롬프트 컨텍스트 어댑터 (Phase 1-3)
 *
 * `buildSajuAnalysis`(구조화 결정론 JSON)를 기존 프롬프트 빌더가 기대하는
 * 평문 문자열 계약({ sajuContext, daeunContext, yongshinContext, hapchungContext,
 * shinsalContext, sipseungContext })으로 변환한다. promptBuilders·guidelines·PDF는
 * 문자열 계약만 맞으면 무변경이다(docs/phase-1-3-plan.md §3).
 *
 * 옵션 B(SajuAnalysis 단독 파생) 채택:
 *   - 입력은 SajuAnalysis 하나. saju 배열·saju.ts 요약 헬퍼를 다시 호출하지 않는다.
 *   - 합충 요약은 hapChungEvents(세운·월운 포함, 명명 상이) 대신 myeongsik에서
 *     레거시 문자열 규칙 그대로 재현한다 — 원국 한정 + 기존 표기(토합화 등) 유지.
 *   - 레거시 대비 의도적 차이 2건(diff 하네스로 문서화):
 *     1) yongshinContext — gyeokYongshin(provisional) 매핑. 논리 문구가 구조화 모듈
 *        표현으로 바뀌고, 유파 의존 잠정 경고를 병기한다.
 *     2) sipseungContext — 레거시 generateLifeNavReport는 saju[2](월간)를 일간으로
 *        잘못 넘겼다(getSajuData 반환 순서 [시,일,월,년]). 어댑터는 일간 기준으로
 *        바로잡는다(SajuAnalysis.myeongsik[].branch.sibiUnseong은 일간 기준).
 *
 * `buildLegacyPromptContext`는 종전 generateLifeNavReport 내부 조립을 무변경 추출한
 * 것으로, diff 하네스(promptContext.test.ts)의 기준선으로만 사용한다.
 */

import {
  getDeityEnglishExplanation,
  getHapChungSummary,
  getShinsalSummary,
  getOriginalSipseungSummary,
  hanjaToHangul,
} from '../../utils/saju.js';
import { toLegacyYongshin } from './gyeokyongshin.js';
import type { SajuAnalysis, PillarInfo } from './schema.js';

export type PremiumPromptContext = {
  sajuContext: string;
  daeunContext: string;
  yongshinContext: string;
  hapchungContext: string;
  shinsalContext: string;
  sipseungContext: string;
};

// ── 레거시 문자열 재현용 관계표(saju.ts 비공개 테이블과 동일 값) ──
const STEM_HAP: ReadonlyArray<readonly [string, string, string]> = [
  ['甲', '己', '토합화'], ['乙', '庚', '금합화'], ['丙', '辛', '수합화'],
  ['丁', '壬', '목합화'], ['戊', '癸', '화합화'],
];
const BRANCH_YUKHAP: ReadonlyArray<readonly [string, string, string]> = [
  ['子', '丑', '토합'], ['寅', '亥', '목합'], ['卯', '戌', '화합'],
  ['辰', '酉', '금합'], ['巳', '申', '수합'], ['午', '未', '화합'],
];
const BRANCH_SAMHAP: ReadonlyArray<readonly [readonly string[], string]> = [
  [['申', '子', '辰'], '수삼합'], [['巳', '酉', '丑'], '금삼합'],
  [['寅', '午', '戌'], '화삼합'], [['亥', '卯', '未'], '목삼합'],
];
const BRANCH_CHUNG: ReadonlyArray<readonly [string, string]> = [
  ['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
];
const STEM_CHUNG: ReadonlyArray<readonly [string, string]> = [
  ['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸'],
];

/** 연지 기준 12신살명(귀인·양인·괴강 등 일간 기준 신살은 레거시 요약에 미포함). */
const SHINSAL_12_NAMES = new Set([
  '겁살', '재살', '천살', '지살', '도화', '월살',
  '망신살', '장성살', '반안살', '역마살', '육해살', '화개살',
]);

/** 레거시 컨텍스트의 주(柱) 나열 순서 — getSajuData 반환 순서 [시,일,월,년]. */
const LEGACY_POSITION_ORDER: Record<string, number> = {
  '시주': 0, '일주': 1, '월주': 2, '년주': 3,
};

/** myeongsik([년,월,일,시])을 레거시 나열 순서 [시,일,월,년]로 뒤집는다. */
const toLegacyOrder = (myeongsik: PillarInfo[]): PillarInfo[] => [...myeongsik].reverse();

const buildSajuContext = (analysis: SajuAnalysis): string =>
  toLegacyOrder(analysis.myeongsik)
    .map((p) => {
      if (!p.stem || !p.branch) {
        // 시간 미상 시주 — 레거시 출력(?(?) ?(?) — 십성: /)과 동일.
        return `${p.position}: ?(?) ?(?) — 십성: /`;
      }
      return (
        `${p.position}: ${p.stem.hangul}(${p.stem.hanja}) ${p.branch.hangul}(${p.branch.hanja}) — 십성: ${p.stem.sipsin}/${p.branch.sipsin}` +
        (p.stem.sipsinEn ? ` (${p.stem.sipsinEn})` : '') +
        (p.branch.sipsinEn ? ` (${p.branch.sipsinEn})` : '')
      );
    })
    .join('\n');

const buildDaeunContext = (analysis: SajuAnalysis): string =>
  analysis.daeun
    .map((d) => {
      const stemHangul = hanjaToHangul[d.stem] || d.stem;
      const branchHangul = hanjaToHangul[d.branch] || d.branch;
      return `${d.startAge}세(${d.startYear}~${d.startYear + 9}년) 대운: ${stemHangul}(${d.stem})${branchHangul}(${d.branch})`;
    })
    .join(', ');

const buildYongshinContext = (analysis: SajuAnalysis): string => {
  const g = analysis.gyeokYongshin;
  if (!g) return '격국·용신 판정 불가(입력 불충분)';
  const legacy = toLegacyYongshin(g);
  // eokbuYongshin은 억부 방식으로 도출한 '용신 후보'이지 기신이 아니다. 과거 '기신:'으로 오표기해
  // 신약 사주(조후=억부 오행 일치)에서 "용신 X | 기신 X" 자기모순을 유발했다(A/B 벤치 63%). 라벨 정정.
  return (
    `강약: ${legacy.strength} | 조후: ${legacy.johooStatus} | 용신: ${legacy.yongshin} | 억부용신: ${legacy.eokbuYongshin} | 논리: ${legacy.logicBasis}` +
    ' | ※ 격국·용신은 유파 의존 잠정 해석이므로 참고 경향으로만 서술할 것(단정 금지)'
  );
};

/**
 * v1.5 — 자평 표준 규칙 엔진(SajuAnalysis.rules) 기반 용신 컨텍스트.
 * 판정마다 「명리 판단 기준서」 근거 조항(§)을 병기해 LLM이 조항 밖 판정을 지어내지
 * 못하게 한다(플랜 3-1 "프롬프트에 근거 조항으로 주입").
 * ⛔ v1 vs v1.5 A/B 벤치의 OWNER 병합 판정 전까지 기본 경로는 v1을 유지한다.
 */
export const buildRulesYongshinContext = (analysis: SajuAnalysis): string => {
  const r = analysis.rules;
  if (!r) return buildYongshinContext(analysis); // 규칙 엔진 입력 불충분 시 v1 폴백
  const s = r.strength;
  const flags = [s.deukryeong ? '득령' : '실령', s.deukji ? '득지' : '실지', s.deukse ? '득세' : '실세'].join('·');
  const gyeokPurity = [
    r.gyeok.transparent ? '투간' : '무투간 본기 취격(§5.1.3)',
    ...(r.gyeok.damaged ? ['월지 충 순도 하락(§5.1.4)'] : []),
  ].join(', ');
  const yong = r.yongshin;
  const extras = [
    ...(yong.johooHuisin ? [`조후 희신 병기: ${yong.johooHuisin}(§6.4.2)`] : []),
    ...(yong.presentInNatal ? [] : ['용신 오행이 원국 표면에 없음 — 운에서 보충하는 흐름으로 서술(§6.4.1)']),
    ...(yong.sangsinAbsent ? ['상신이 원국 천간에 없음(§6.2.4)'] : []),
  ];
  return [
    `[자평 표준 판정 — 명리 판단 기준서(docs/myeongri-standard) 조항 근거]`,
    `강약: ${s.class} (아군 세력 ${s.ratio.toFixed(1)}%, ${flags} — §2.7·§3.2.1)`,
    `조후: ${r.johoo.status} (온도 점수 ${r.johoo.t} — §4.2~§4.3)`,
    `격국: ${r.gyeok.name} (취격 ${r.gyeok.basisStem}, ${gyeokPurity} — §5.1~§5.2) | 성패: ${r.gyeok.seongpae}(§5.4.1)`,
    `용신: ${yong.primary} (${yong.method} — §6.2) | 희신 ${yong.huisin} · 기신 ${yong.gisin} · 구신 ${yong.gusin} · 한신 ${yong.hansin}(§6.3.1)` +
      (extras.length ? ` | ${extras.join(' | ')}` : ''),
    `※ 본 판정은 자평명리 기준의 결정론 산출입니다(§1.1). 위 판정과 조항 근거 안에서만 서술하고, 다른 유파 판정을 병기하지 말 것.`,
  ].join('\n');
};

/** getHapChungSummary와 동일 규칙·표기(원국 한정, 합/충만). */
const buildHapchungContext = (analysis: SajuAnalysis): string => {
  const valid = toLegacyOrder(analysis.myeongsik)
    .filter((p) => p.stem && p.branch)
    .map((p) => ({ title: p.position as string, stem: p.stem!.hanja, branch: p.branch!.hanja }));
  if (valid.length < 2) return '';

  const hapList: string[] = [];
  const chungList: string[] = [];

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (const [s1, s2, result] of STEM_HAP) {
        if ((valid[i].stem === s1 && valid[j].stem === s2) || (valid[i].stem === s2 && valid[j].stem === s1)) {
          hapList.push(`${valid[i].title}간·${valid[j].title}간 ${result}`);
        }
      }
    }
  }
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (const [b1, b2, result] of BRANCH_YUKHAP) {
        if ((valid[i].branch === b1 && valid[j].branch === b2) || (valid[i].branch === b2 && valid[j].branch === b1)) {
          hapList.push(`${valid[i].title}지·${valid[j].title}지 ${result}`);
        }
      }
    }
  }
  const allBranches = valid.map((p) => p.branch);
  for (const [combo, result] of BRANCH_SAMHAP) {
    const matched = combo.filter((b) => allBranches.includes(b));
    if (matched.length >= 2) {
      const matchTitles = matched.map((b) => valid[allBranches.indexOf(b)].title);
      hapList.push(`${matchTitles.join('·')} ${result}`);
    }
  }
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (const [s1, s2] of STEM_CHUNG) {
        if ((valid[i].stem === s1 && valid[j].stem === s2) || (valid[i].stem === s2 && valid[j].stem === s1)) {
          chungList.push(`${valid[i].title}간·${valid[j].title}간 천간충`);
        }
      }
    }
  }
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (const [b1, b2] of BRANCH_CHUNG) {
        if ((valid[i].branch === b1 && valid[j].branch === b2) || (valid[i].branch === b2 && valid[j].branch === b1)) {
          chungList.push(`${valid[i].title}지·${valid[j].title}지 지지충`);
        }
      }
    }
  }

  const parts: string[] = [];
  if (hapList.length) parts.push(`합: ${hapList.join(', ')}`);
  if (chungList.length) parts.push(`충: ${chungList.join(', ')}`);
  return parts.join(' | ');
};

/** getShinsalSummary와 동일 표기 — 원국 12신살만, [시,일,월,년] 순. */
const buildShinsalContext = (analysis: SajuAnalysis): string =>
  analysis.shinsal
    .filter((s) => s.scope === '원국' && SHINSAL_12_NAMES.has(s.name) && s.label in LEGACY_POSITION_ORDER)
    .sort((a, b) => LEGACY_POSITION_ORDER[a.label] - LEGACY_POSITION_ORDER[b.label])
    .map((s) => `${s.label}(${s.name})`)
    .join(', ');

/** 일간 기준 십이운성 요약 — [시,일,월,년] 순(레거시 월간 오적용을 일간 기준으로 교정). */
const buildSipseungContext = (analysis: SajuAnalysis): string =>
  toLegacyOrder(analysis.myeongsik)
    .filter((p): p is PillarInfo & { branch: NonNullable<PillarInfo['branch']> } => Boolean(p.branch))
    .map((p) => (p.branch.sibiUnseong ? `${p.position}(${p.branch.sibiUnseong})` : ''))
    .filter(Boolean)
    .join(', ');

export type YongshinEngine = 'v1' | 'v1.5';

/**
 * SajuAnalysis → 프리미엄 리포트 프롬프트 문자열 계약(옵션 B, 단일 소스).
 * yongshinEngine: 'v1.5'(기본 — 자평 표준 규칙 엔진 + §조항 주입) | 'v1'(레거시 provisional).
 *
 * 2026-07-07 ⛔ OWNER 병합 승인(플랜 3-1 A/B 벤치 30건, bench-output/ab-30/ab-compare.md):
 * v1은 30건 중 19건(63%)에서 "용신 X / 기신 X"처럼 동일 오행을 용신·기신으로 동시 표기하는
 * 자기모순을 냈다(eokbuYongshin 표기 오류). v1.5는 §6.3.1 생극 기계 도출 구조상 이 결함이
 * 원천적으로 발생하지 않는다(실측 0/30). score·비용·소요 전부 v1과 동급 또는 우위.
 * v1 옵션은 회귀 비교·디버깅용으로만 존치한다.
 */
export const sajuAnalysisToPromptContext = (
  analysis: SajuAnalysis,
  opts?: { yongshinEngine?: YongshinEngine },
): PremiumPromptContext => ({
  sajuContext: buildSajuContext(analysis),
  daeunContext: buildDaeunContext(analysis),
  yongshinContext: (opts?.yongshinEngine ?? 'v1.5') === 'v1'
    ? buildYongshinContext(analysis)
    : buildRulesYongshinContext(analysis),
  hapchungContext: buildHapchungContext(analysis),
  shinsalContext: buildShinsalContext(analysis),
  sipseungContext: buildSipseungContext(analysis),
});

/**
 * 종전 generateLifeNavReport 내부 컨텍스트 조립의 무변경 추출(기준선).
 * diff 하네스 전용 — 신규 코드는 sajuAnalysisToPromptContext를 사용하라.
 * (sipseung의 saju[2]=월간 전달도 종전 그대로 보존한다 — 기준선이므로 수정 금지.)
 */
export const buildLegacyPromptContext = (
  saju: any[],
  daeun: any[],
  yongshin: any,
): PremiumPromptContext => {
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

  // eokbuYongshin = 억부용신(용신 후보). 과거 '기신:' 오표기 정정 — buildYongshinContext와 동일 라벨 유지.
  const yongshinContext = `강약: ${yongshin.strength} | 조후: ${yongshin.johooStatus} | 용신: ${yongshin.yongshin} | 억부용신: ${yongshin.eokbuYongshin ?? ''} | 논리: ${yongshin.logicBasis ?? ''}`;

  return {
    sajuContext,
    daeunContext,
    yongshinContext,
    hapchungContext: getHapChungSummary(saju),
    shinsalContext: getShinsalSummary(saju),
    sipseungContext: getOriginalSipseungSummary(saju[2]?.stem?.hanja ?? '', saju),
  };
};
