/**
 * 오행 차트 공용 팔레트 (한지 톤).
 * ManseTab 오행 분포 차트와 랜딩 티저 요약 카드가 공유한다 — 색을 바꾸면 양쪽에 함께 적용된다.
 */
export const OHAENG_CHART_COLORS: Record<string, string> = {
  wood: '#10b981',
  fire: '#b8392e',
  earth: '#a88a4a',
  metal: '#9c8e7e',
  water: '#1a1a1a',
};

export const OHAENG_CHART_LABELS: Record<string, string> = {
  wood: '목(木)',
  fire: '화(火)',
  earth: '토(土)',
  metal: '금(金)',
  water: '수(水)',
};

/** 오행 counts → FiveElementsPieChart data ({name,value,color}[], 0 제외) */
export function toOhaengChartData(counts: Record<string, number>) {
  return (['wood', 'fire', 'earth', 'metal', 'water'] as const)
    .map((key) => ({ name: OHAENG_CHART_LABELS[key], value: counts[key] ?? 0, color: OHAENG_CHART_COLORS[key] }))
    .filter((d) => d.value > 0);
}
