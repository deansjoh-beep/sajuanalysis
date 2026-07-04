/**
 * 오늘의 운세 생성 공용 로직.
 * - 온디맨드 엔드포인트(api/daily-fortune.ts)와 배치 cron(api/cron/daily-fortune.ts)이 공유한다.
 * - 사주 원국 + 현재 대운 + 올해 세운 + 오늘 일진을 계산해 프롬프트 컨텍스트를 만들고
 *   Gemini로 JSON 운세를 생성한다.
 */
import {
  getSajuData,
  getDaeunData,
  calculateYongshin,
  calculateDeity,
  hanjaToHangul,
} from '../../src/utils/saju.js';
import {
  getTodayDayPillarKST,
  getCurrentYearPillarKST,
  getSeoulTodayParts,
  getSeoulTodayYmd,
} from '../../src/lib/seoulDateGanji.js';
import { DAILY_FORTUNE_GUIDELINE } from '../../src/constants/guidelines/daily-fortune.js';

export interface MemberSajuInput {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  calendarType: 'solar' | 'lunar' | 'leap';
  gender: 'M' | 'F';
  unknownTime: boolean;
}

export interface DailyFortune {
  summary: string;
  score: number;
  sections: {
    overall: string;
    wealth: string;
    love: string;
    work: string;
    health: string;
  };
  advice: string;
  lucky: { color: string; number: string; direction: string };
  tags: string[];
}

export interface DailyFortuneResult {
  fortune: DailyFortune;
  model: string;
  dateYmd: string;
  dayPillarHanja: string;
  dayPillarHangul: string;
}

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

const pad2 = (v: string | number) => String(v).padStart(2, '0');

/**
 * 회원 사주 입력 → getSajuData/getDaeunData 파라미터로 정규화
 */
const toSajuParams = (saju: MemberSajuInput) => {
  const dateStr = `${saju.birthYear}-${pad2(saju.birthMonth)}-${pad2(saju.birthDay)}`;
  const timeStr = saju.unknownTime ? '12:00' : `${pad2(saju.birthHour)}:${pad2(saju.birthMinute)}`;
  const isLunar = saju.calendarType !== 'solar';
  const isLeap = saju.calendarType === 'leap';
  return { dateStr, timeStr, isLunar, isLeap, unknownTime: saju.unknownTime };
};

/**
 * 프롬프트에 주입할 사주 컨텍스트 텍스트를 만든다 (오늘 KST 기준).
 */
export const buildFortuneContext = (saju: MemberSajuInput) => {
  const { dateStr, timeStr, isLunar, isLeap, unknownTime } = toSajuParams(saju);

  const pillars = getSajuData(dateStr, timeStr, isLunar, isLeap, unknownTime);
  const daeun = getDaeunData(dateStr, timeStr, isLunar, isLeap, saju.gender, unknownTime);
  const yongshin = calculateYongshin(pillars);

  const dayStemHanja = pillars.find((p: any) => p.title === '일주')?.stem.hanja || '';

  const pillarText = pillars
    .filter((p: any) => !(unknownTime && p.title === '시주'))
    .map(
      (p: any) =>
        `${p.title}: ${p.stem.hangul}(${p.stem.hanja})/${p.branch.hangul}(${p.branch.hanja}) - 십성 ${p.stem.deity}·${p.branch.deity}`,
    )
    .join('\n');

  // 현재 대운: 만 나이(연도 차) 기준 — 대운 startAge와 동일 기준
  const { year: curYear } = getSeoulTodayParts();
  const age = curYear - parseInt(saju.birthYear, 10);
  const curDaeunIdx = daeun.findIndex(
    (d: any, i: number) =>
      age >= d.startAge && (i === daeun.length - 1 || age < daeun[i + 1].startAge),
  );
  const curDaeun = curDaeunIdx >= 0 ? daeun[curDaeunIdx] : null;
  const daeunText = curDaeun
    ? `${curDaeun.startAge}세 대운 ${hanjaToHangul[curDaeun.stem]}${hanjaToHangul[curDaeun.branch]}(${curDaeun.stem}${curDaeun.branch}) - 십성 ${calculateDeity(dayStemHanja, curDaeun.stem)}·${calculateDeity(dayStemHanja, curDaeun.branch, true)}`
    : '대운 정보 없음';

  // 올해 세운
  const yearPillar = getCurrentYearPillarKST();
  const seunText = `${yearPillar.year}년 ${yearPillar.yearPillarHangul}(${yearPillar.yearPillarHanja}) - 십성 ${calculateDeity(dayStemHanja, yearPillar.yearPillarHanja.charAt(0))}·${calculateDeity(dayStemHanja, yearPillar.yearPillarHanja.charAt(1), true)}`;

  // 오늘 일진
  const today = getTodayDayPillarKST();
  const todayStem = today.dayPillarHanja.charAt(0);
  const todayBranch = today.dayPillarHanja.charAt(1);
  const todayText = `${today.dateText} 일진 ${today.dayPillarHangul}(${today.dayPillarHanja}) - 십성 ${calculateDeity(dayStemHanja, todayStem)}·${calculateDeity(dayStemHanja, todayBranch, true)}`;

  const genderText = saju.gender === 'M' ? '남성' : '여성';

  const contextText = `[상담 대상자]
이름: ${saju.name || '회원'}님 / ${genderText}

[사주 원국]
${pillarText}
일간(나): ${hanjaToHangul[dayStemHanja]}(${dayStemHanja})
용신: ${yongshin.yongshin} (신강약: ${yongshin.strength})

[현재 대운]
${daeunText}

[올해 세운]
${seunText}

[오늘의 일진]
${todayText}`;

  return {
    contextText,
    dateYmd: getSeoulTodayYmd(),
    dayPillarHanja: today.dayPillarHanja,
    dayPillarHangul: today.dayPillarHangul,
  };
};

const stripJsonFences = (text: string): string => {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  // 첫 { 부터 마지막 } 까지만 취함 (앞뒤 잡텍스트 방어)
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
};

const ALLOWED_TAGS = ['재물', '직업', '연애', '건강', '인간관계', '변화'];

const normalizeFortune = (raw: any): DailyFortune => {
  const s = raw?.sections || {};
  const lucky = raw?.lucky || {};
  let score = Number(raw?.score);
  if (!Number.isFinite(score)) score = 70;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.filter((t: any) => ALLOWED_TAGS.includes(String(t))).slice(0, 2)
    : [];
  return {
    summary: String(raw?.summary || '').slice(0, 60),
    score,
    sections: {
      overall: String(s.overall || ''),
      wealth: String(s.wealth || ''),
      love: String(s.love || ''),
      work: String(s.work || ''),
      health: String(s.health || ''),
    },
    advice: String(raw?.advice || ''),
    lucky: {
      color: String(lucky.color || ''),
      number: String(lucky.number || ''),
      direction: String(lucky.direction || ''),
    },
    tags,
  };
};

/**
 * 단일 모델로 Gemini JSON 생성 시도
 */
const callGemini = async (
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1400,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${model} ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.find((p: any) => typeof p.text === 'string')?.text ?? '';
  if (!text) throw new Error(`Gemini ${model}: empty response`);
  return text;
};

/**
 * 회원 사주로 오늘의 운세를 생성한다.
 * 모델 우선순위를 순회하며 첫 성공 결과를 반환한다.
 */
export const generateDailyFortuneForSaju = async (
  saju: MemberSajuInput,
  apiKey: string,
  modelPriority: string[] = DEFAULT_MODELS,
): Promise<DailyFortuneResult> => {
  const { contextText, dateYmd, dayPillarHanja, dayPillarHangul } = buildFortuneContext(saju);

  let lastErr: any = null;
  for (const model of modelPriority) {
    try {
      const text = await callGemini(apiKey, model, DAILY_FORTUNE_GUIDELINE, contextText);
      const parsed = JSON.parse(stripJsonFences(text));
      return {
        fortune: normalizeFortune(parsed),
        model,
        dateYmd,
        dayPillarHanja,
        dayPillarHangul,
      };
    } catch (err) {
      lastErr = err;
      console.warn('[dailyFortune] model failed:', model, (err as any)?.message);
    }
  }
  throw new Error(`모든 모델에서 운세 생성 실패: ${lastErr?.message || 'unknown'}`);
};
