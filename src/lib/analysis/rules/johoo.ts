/**
 * 4장 조후 판정 (docs/myeongri-standard/04-johoo.md)
 *
 * §4.2.1 온도 점수 t: 월지 亥子丑 −2 / 巳午未 +2, 시지 −1 / +1 (그 외 0)
 * §4.2.2 시간 미상은 시지 항목 생략
 * §4.3   t ≤ −3 극한랭(화 주 용신) / t = −2 한랭(화 희신) / 평온 /
 *        t = +2 조열(수 희신) / t ≥ +3 극조열(수 주 용신)
 * §4.1.1 조습(燥濕)은 v1.5 범위 제외 — 한열만 판정한다.
 */
import { COLD_BRANCHES, HOT_BRANCHES, type Ohaeng, type RulesInput } from './tables';

export type JohooStatus = '극한랭' | '한랭' | '평온' | '조열' | '극조열';

export type JohooResult = {
  t: number;
  status: JohooStatus;
  /** |t| ≥ 3 — 조후가 주 용신이 되는 유일한 경우 (§4.3.1, §6.2.1) */
  extreme: boolean;
  /** 조후 개입 오행(한랭측 화 / 조열측 수), 평온이면 null */
  element: Ohaeng | null;
};

export const assessJohoo = (input: RulesInput): JohooResult => {
  let t = 0;
  if (COLD_BRANCHES.includes(input.month.branch)) t -= 2;
  else if (HOT_BRANCHES.includes(input.month.branch)) t += 2;
  if (input.hour) { // §4.2.2
    if (COLD_BRANCHES.includes(input.hour.branch)) t -= 1;
    else if (HOT_BRANCHES.includes(input.hour.branch)) t += 1;
  }

  let status: JohooStatus = '평온';
  if (t <= -3) status = '극한랭';
  else if (t === -2) status = '한랭';
  else if (t >= 3) status = '극조열';
  else if (t === 2) status = '조열';

  const element: Ohaeng | null = t <= -2 ? 'fire' : t >= 2 ? 'water' : null;
  return { t, status, extreme: Math.abs(t) >= 3, element };
};
