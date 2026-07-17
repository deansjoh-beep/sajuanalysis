/**
 * 핵심 훅 희소성 통계 — 자동 생성 파일. 직접 수정 금지.
 *
 * 재생성: npx tsx scripts/compute-hook-stats.ts
 * 표본: 1944-01-01 ~ 2005-12-31, 7일 간격 × 12시진 (실제 만세력 엔진 산출, n=39,432)
 */
export const HOOK_STATS = {
  "generatedBy": "scripts/compute-hook-stats.ts",
  "sample": "1944-01-01 ~ 2005-12-31, 7일 간격 × 12시진",
  "withHour": {
    "sampleSize": 39432,
    "strengthPct": {
      "극신강": 5.84,
      "신강": 17.1,
      "중립": 25.67,
      "신약": 36.89,
      "극신약": 14.51
    },
    "maxElement4Pct": 29.98,
    "maxElement5Pct": 5.86,
    "missing1Pct": 69.16,
    "missing2Pct": 16.62,
    "jaeDaShinYakPct": 11.39,
    "gwanDaShinYakPct": 11.55,
    "siksangDaShinYakPct": 11.59,
    "inDaShinGangPct": 8.38,
    "gunGeopJaengJaePct": 4.84,
    "chung2Pct": 9.14,
    "yanginPresentPct": 30.56,
    "cheoneul2Pct": 10.9,
    "goegangDayPct": 6.55,
    "goegangYanginPct": 1.41,
    "gwimunAdjacentPct": 23,
    "wonjinAdjacentPct": 23.09
  },
  "withoutHour": {
    "sampleSize": 3286,
    "strengthPct": {
      "극신강": 1.1,
      "신강": 13.3,
      "중립": 22.09,
      "신약": 34.51,
      "극신약": 29
    },
    "maxElement4Pct": 9.46,
    "maxElement5Pct": 0.85,
    "missing1Pct": 88.95,
    "missing2Pct": 39.87,
    "jaeDaShinYakPct": 5.45,
    "gwanDaShinYakPct": 5.51,
    "siksangDaShinYakPct": 5.57,
    "inDaShinGangPct": 3.29,
    "gunGeopJaengJaePct": 1.25,
    "chung2Pct": 2.25,
    "yanginPresentPct": 24.41,
    "cheoneul2Pct": 5.72,
    "goegangDayPct": 6.66,
    "goegangYanginPct": 1.19,
    "gwimunAdjacentPct": 15.7,
    "wonjinAdjacentPct": 15.79
  }
} as const;
