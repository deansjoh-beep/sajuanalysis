/**
 * 지침 통합 barrel
 * ─────────────────────────────────────────────────────────────
 * 각 지침 파일을 단일 진입점으로 re-export합니다.
 * 지침 내용을 수정할 때는 이 파일이 아닌 각 개별 파일을 직접 수정하세요.
 *
 *   간명해석지침     → saju.ts
 *   상담지침(공통)   → consulting-common.ts
 *   상담지침(기본)   → consulting-basic.ts
 *   상담지침(고급)   → consulting-advanced.ts
 *   리포트지침(공통) → report-common.ts
 *   리포트지침(기본) → report-basic.ts
 *   리포트지침(고급) → report-advanced.ts
 */
export { SAJU_GUIDELINE } from './saju';
export { CONSULTING_GUIDELINE } from './consulting-common';
export { BASIC_CONSULTING_GUIDELINE } from './consulting-basic';
export { ADVANCED_CONSULTING_GUIDELINE } from './consulting-advanced';
export { REPORT_GUIDELINE } from './report-common';
export { BASIC_REPORT_GUIDELINE } from './report-basic';
export { ADVANCED_REPORT_GUIDELINE } from './report-advanced';
export { YEARLY_FORTUNE_2026_GUIDELINE } from './yearly-fortune-2026';
