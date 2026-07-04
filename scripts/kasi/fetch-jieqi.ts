/**
 * KASI 24절기 시각 수집기 (Phase 1-1, D-1-4)
 *
 * 한국천문연구원(KASI) 특일 정보 Open API의 `get24DivisionsInfo`를 연도별로 호출해
 * 24절기의 날짜·시각(KST)·태양황경을 수집, `src/lib/manseryeok/data/kasi-jieqi.json`에 캐시한다.
 * 이 테이블은 만세력 교차검증 하네스(scripts/audit/manseryeok-verify.ts)의 expected 절입 시각
 * 기준값(reference)으로 사용된다.
 *
 * ⚠️ 커버리지: KASI API는 실측상 2000~2028년만 제공한다(1999↓·2029↑는 totalCount 0).
 *   1900~1999, 2029~2030 구간은 별도 폴백(천문계산 or 월력요항)이 필요하다 — docs/decisions.md D-1-4 참조.
 *
 * 실행:
 *   npx tsx scripts/kasi/fetch-jieqi.ts            # 기본 2000~2028
 *   npx tsx scripts/kasi/fetch-jieqi.ts 2010 2020  # 구간 지정
 *
 * 인증키: .env.local 의 KASI_API_KEY (data.go.kr 일반 인증키).
 */

import dotenv from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
dotenv.config({ path: '.env.local', override: false });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const OUTPUT_PATH = resolve(REPO_ROOT, 'src/lib/manseryeok/data/kasi-jieqi.json');

const ENDPOINT =
  'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/get24DivisionsInfo';

/** KASI API가 실제로 데이터를 제공하는 연도 범위(실측). 이 밖은 폴백 대상. */
const KASI_MIN_YEAR = 2000;
const KASI_MAX_YEAR = 2028;

const DEFAULT_START = 2000;
const DEFAULT_END = 2028;

/** 24절기 각 연도 기대 개수 */
const EXPECTED_PER_YEAR = 24;

type RawItem = {
  dateKind: string; // "03" = 24절기
  dateName: string; // 절기명 (예: 입춘)
  isHoliday: string; // Y/N
  kst: string; // "HHMM" (뒤 공백 패딩됨, 예: "1727      ")
  locdate: number; // YYYYMMDD 정수
  seq: number;
  sunLongitude: number; // 태양황경(도)
};

type JieqiRecord = {
  name: string; // 절기명
  date: string; // 'YYYY-MM-DD' (KST)
  time: string; // 'HH:mm' (KST)
  datetimeKST: string; // ISO 'YYYY-MM-DDTHH:mm:00+09:00'
  sunLongitude: number | null; // 태양황경(도). KASI가 일부 연도엔 미제공 → null.
  /** 절(節, 월의 시작 경계) 여부. true면 월주가 바뀌는 절입점. false면 중기(中氣). */
  isMonthBoundary: boolean;
};

/**
 * 12 절(節, 월주 경계=절입점). 나머지 12개는 중기(中氣).
 * ⚠️ KASI가 sunLongitude를 일부 연도에 누락하므로 절/중기 판정은 절기명으로 한다.
 * (절기명은 전 연도에서 항상 제공됨.)
 */
const JEOL_NAMES = new Set([
  '입춘', '경칩', '청명', '입하', '망종', '소서',
  '입추', '백로', '한로', '입동', '대설', '소한',
]);

/** 절기명 → 표준 태양황경(도). sunLongitude 누락 연도 보정 및 정합성 검증용. */
const CANONICAL_SUN_LONGITUDE: Record<string, number> = {
  소한: 285, 대한: 300, 입춘: 315, 우수: 330, 경칩: 345, 춘분: 0,
  청명: 15, 곡우: 30, 입하: 45, 소만: 60, 망종: 75, 하지: 90,
  소서: 105, 대서: 120, 입추: 135, 처서: 150, 백로: 165, 추분: 180,
  한로: 195, 상강: 210, 입동: 225, 소설: 240, 대설: 255, 동지: 270,
};

/**
 * 양력 1년(1/1~12/31)에 등장하는 24절기의 고정 순서(소한 ~ 동지).
 * 매 양력 연도는 이 24개를 정확히 이 순서로 담는다(소한 ≈ 1/5~6, 동지 ≈ 12/21~22).
 * ⚠️ KASI가 일부 연도에 절기명을 오라벨(예: 2000-02-19 우수를 "입춘"으로) 하므로,
 * 시각(kst)·날짜(locdate)는 신뢰하되 절기명은 날짜순 위치로 이 정본 순서에 맞춰 재배정한다.
 */
const CANONICAL_ORDER = [
  '소한', '대한', '입춘', '우수', '경칩', '춘분',
  '청명', '곡우', '입하', '소만', '망종', '하지',
  '소서', '대서', '입추', '처서', '백로', '추분',
  '한로', '상강', '입동', '소설', '대설', '동지',
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * locdate(YYYYMMDD 정수) + kst("HHMM") → 구조화 필드.
 * @param canonicalName 날짜순 위치로 결정한 정본 절기명(KASI dateName 오라벨 보정).
 */
const toRecord = (item: RawItem, canonicalName: string): JieqiRecord => {
  const ymd = String(item.locdate);
  const y = ymd.slice(0, 4);
  const m = ymd.slice(4, 6);
  const d = ymd.slice(6, 8);
  const kst = String(item.kst).trim().padStart(4, '0');
  const hh = kst.slice(0, 2);
  const mm = kst.slice(2, 4);
  const date = `${y}-${m}-${d}`;
  const time = `${hh}:${mm}`;
  // KASI가 sunLongitude를 주고 그 값이 정본과 일치하면 그대로, 아니면 정본 절기명 기준값 사용.
  const canonSun = CANONICAL_SUN_LONGITUDE[canonicalName] ?? null;
  const apiSun =
    item.sunLongitude != null && Number.isFinite(Number(item.sunLongitude))
      ? Number(item.sunLongitude)
      : null;
  return {
    name: canonicalName,
    date,
    time,
    datetimeKST: `${date}T${time}:00+09:00`,
    sunLongitude: apiSun === canonSun ? apiSun : canonSun,
    isMonthBoundary: JEOL_NAMES.has(canonicalName),
  };
};

/** KASI가 오라벨한 절기명을 정본으로 교정한 이력 (감사 로그용). */
type Relabel = { year: number; date: string; kasiName: string; canonical: string };
const relabels: Relabel[] = [];

/** 한 해 24절기 조회 (재시도 포함). 실패 시 예외. */
const fetchYear = async (year: number, apiKey: string): Promise<JieqiRecord[]> => {
  const url =
    `${ENDPOINT}?serviceKey=${encodeURIComponent(apiKey)}` +
    `&solYear=${year}&numOfRows=${EXPECTED_PER_YEAR + 6}&pageNo=1&_type=json`;

  const MAX_RETRY = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      // data.go.kr 게이트웨이는 인증 실패 시 평문 "Unauthorized", 과부하 시 502 HTML을 반환한다.
      if (text.startsWith('Unauthorized')) {
        throw new Error(
          `KASI 인증 실패(Unauthorized): KASI_API_KEY가 유효한 data.go.kr 인증키인지 확인하세요.`,
        );
      }
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`JSON 파싱 실패(HTTP ${res.status}): ${text.slice(0, 120)}`);
      }
      const header = json?.response?.header;
      if (header?.resultCode !== '00') {
        throw new Error(`KASI resultCode=${header?.resultCode} (${header?.resultMsg})`);
      }
      const rawItems = json?.response?.body?.items?.item;
      if (rawItems == null) return [];
      const items: RawItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];
      // 시각·날짜 기준으로 정렬한 뒤 정본 순서(소한~동지)로 절기명을 재배정.
      const sorted = [...items].sort((a, b) => {
        if (a.locdate !== b.locdate) return a.locdate - b.locdate;
        return String(a.kst).trim().localeCompare(String(b.kst).trim());
      });
      // 완전한 한 해(24개)만 위치 기반 정본 배정. 부분/범위밖은 KASI 이름 그대로.
      const usePositional = sorted.length === CANONICAL_ORDER.length;
      const records = sorted.map((item, i) => {
        const kasiName = item.dateName.trim();
        const canonical = usePositional ? CANONICAL_ORDER[i] : kasiName;
        if (usePositional && kasiName !== canonical) {
          relabels.push({
            year,
            date: `${String(item.locdate).slice(0, 4)}-${String(item.locdate).slice(4, 6)}-${String(item.locdate).slice(6, 8)}`,
            kasiName,
            canonical,
          });
        }
        return toRecord(item, canonical);
      });
      return records;
    } catch (e) {
      lastErr = e;
      // 인증 실패는 재시도해도 소용없으므로 즉시 중단.
      if (e instanceof Error && e.message.includes('Unauthorized')) throw e;
      if (attempt < MAX_RETRY) {
        const backoff = 400 * attempt;
        console.warn(`  ⚠️ ${year} 시도 ${attempt} 실패 (${(e as Error).message}). ${backoff}ms 후 재시도`);
        await sleep(backoff);
      }
    }
  }
  throw new Error(`${year} 수집 실패 (재시도 ${MAX_RETRY}회 초과): ${(lastErr as Error)?.message}`);
};

const main = async () => {
  const apiKey = String(process.env.KASI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('❌ KASI_API_KEY가 .env.local에 없습니다.');
    process.exit(1);
  }

  const argStart = Number(process.argv[2]);
  const argEnd = Number(process.argv[3]);
  const startYear = Number.isFinite(argStart) ? argStart : DEFAULT_START;
  const endYear = Number.isFinite(argEnd) ? argEnd : DEFAULT_END;

  if (startYear < KASI_MIN_YEAR || endYear > KASI_MAX_YEAR) {
    console.warn(
      `⚠️ 요청 구간 ${startYear}~${endYear} 중 일부는 KASI 제공범위(${KASI_MIN_YEAR}~${KASI_MAX_YEAR}) 밖입니다. ` +
        `범위 밖 연도는 0건으로 수집되며 폴백이 필요합니다.`,
    );
  }

  console.log(`\n===== KASI 24절기 수집 ${startYear}~${endYear} =====`);
  const byYear: Record<string, JieqiRecord[]> = {};
  const allRecords: JieqiRecord[] = [];
  const gaps: number[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const records = await fetchYear(year, apiKey);
    byYear[year] = records;
    allRecords.push(...records);
    const flag =
      records.length === EXPECTED_PER_YEAR ? '✅' : records.length === 0 ? '∅ (범위밖)' : `⚠️ ${records.length}건`;
    console.log(`  ${year}: ${records.length}건 ${flag}`);
    if (records.length !== EXPECTED_PER_YEAR) gaps.push(year);
    await sleep(150); // 레이트리밋 배려
  }

  allRecords.sort((a, b) => a.datetimeKST.localeCompare(b.datetimeKST));

  const output = {
    source: 'KASI get24DivisionsInfo (data.go.kr B090041/SpcdeInfoService)',
    endpoint: ENDPOINT,
    fetchedAt: new Date().toISOString(),
    coverage: { requested: [startYear, endYear], kasiRange: [KASI_MIN_YEAR, KASI_MAX_YEAR] },
    expectedPerYear: EXPECTED_PER_YEAR,
    totalCount: allRecords.length,
    yearsWithGaps: gaps,
    /** KASI가 절기명을 오라벨해 정본으로 교정한 이력. 시각·날짜는 KASI 값 유지. */
    kasiRelabels: relabels,
    note:
      'isMonthBoundary=true는 절(節, 월주 경계=절입). false는 중기(中氣). ' +
      '절기명은 날짜순 위치로 정본(소한~동지)에 맞춰 재배정됨(KASI dateName 오라벨 보정). ' +
      'KASI 미제공 연도(2000 미만/2028 초과)는 별도 폴백 필요.',
    terms: allRecords,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');

  console.log(`\n총 ${allRecords.length}건 수집 → ${OUTPUT_PATH}`);
  if (gaps.length > 0) {
    console.log(`⚠️ 24건 미만 연도: ${gaps.join(', ')} (범위밖이면 폴백 대상)`);
  }
  const monthBoundaries = allRecords.filter((r) => r.isMonthBoundary).length;
  console.log(`   그중 절(節, 월경계) ${monthBoundaries}건 / 중기(中氣) ${allRecords.length - monthBoundaries}건`);
  if (relabels.length > 0) {
    console.log(`⚠️ KASI 절기명 오라벨 ${relabels.length}건 교정:`);
    for (const r of relabels) console.log(`   ${r.date}: "${r.kasiName}" → "${r.canonical}"`);
  }
};

main().catch((e) => {
  console.error(`\n❌ 수집 중단: ${e?.message || e}`);
  process.exit(1);
});
