/**
 * v1(provisional) vs v1.5(자평 규칙 엔진) 판정 차이 비교 — 플랜 3-1 A/B 감수 보조자료
 *
 * LLM 호출 없이(무비용) 결정론 판정만 대조한다. report-bench.ts와 동일 시드(20260705)
 * 픽스처를 쓰므로 케이스 번호가 LLM A/B 벤치와 1:1로 맞는다.
 *
 * 실행: npx tsx scripts/rules-ab-diff.ts            # 30건 (기본)
 *       npx tsx scripts/rules-ab-diff.ts --count 50
 * 출력: bench-output/rules-ab-diff-<stamp>.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildSajuAnalysis } from '../src/lib/analysis/schema';
import { toLegacyYongshin, toLegacyGyeok } from '../src/lib/analysis/gyeokyongshin';

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const COUNT = Math.max(1, parseInt(argValue('count') ?? '30', 10));

// report-bench.ts와 동일한 시드 고정 LCG 픽스처 — 케이스 번호 정합
const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

type Fixture = {
  name: string; gender: 'M' | 'F'; birthDate: string; birthTime: string;
  isLunar: boolean; unknownTime: boolean;
};

const buildFixtures = (count: number): Fixture[] => {
  const rng = makeRng(20260705);
  const fixtures: Fixture[] = [];
  for (let i = 0; i < count; i++) {
    const year = 1950 + Math.floor(rng() * 56);
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28);
    const hour = Math.floor(rng() * 24);
    const minute = Math.floor(rng() * 60);
    const unknownTime = i % 10 === 9;
    const isLunar = !unknownTime && i % 7 === 3;
    // report-bench와 rng 소비 순서를 맞추기 위해 concern/interest 추첨도 수행(값은 미사용)
    rng(); rng();
    fixtures.push({
      name: `벤치${String(i + 1).padStart(3, '0')}`,
      gender: i % 2 === 0 ? 'M' : 'F',
      birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      birthTime: unknownTime ? '' : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      isLunar,
      unknownTime,
    });
  }
  return fixtures;
};

const main = () => {
  const fixtures = buildFixtures(COUNT);
  const rows: string[] = [];
  let diffStrength = 0;
  let diffGyeok = 0;
  let diffYongshin = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    const a = buildSajuAnalysis({
      dateStr: f.birthDate,
      timeStr: f.birthTime,
      isLunar: f.isLunar,
      isLeap: false,
      gender: f.gender,
      unknownTime: f.unknownTime,
    });
    const v1g = a.gyeokYongshin;
    const v1 = v1g
      ? { strength: toLegacyYongshin(v1g).strength, gyeok: toLegacyGyeok(v1g).gyeok, yongshin: toLegacyYongshin(v1g).yongshin }
      : { strength: '-', gyeok: '-', yongshin: '-' };
    const r = a.rules;
    const v15 = r
      ? { strength: r.strength.class, gyeok: r.gyeok.name, yongshin: `${r.yongshin.primary}(${r.yongshin.method})` }
      : { strength: '-', gyeok: '-', yongshin: '-' };

    // v1 용신 표기('수(水)' 형태) ↔ v1.5('수') 비교는 첫 글자 기준
    const sameStrength = v1.strength === v15.strength || (v1.strength === '중립' && v15.strength === '중화');
    const sameGyeok = v1.gyeok === v15.gyeok;
    const sameYong = v1.yongshin.charAt(0) === v15.yongshin.charAt(0);
    if (!sameStrength) diffStrength++;
    if (!sameGyeok) diffGyeok++;
    if (!sameYong) diffYongshin++;

    const mark = (same: boolean) => (same ? '' : ' ⚠️');
    const inputStr = `${f.birthDate} ${f.unknownTime ? '시간미상' : f.birthTime} ${f.isLunar ? '음' : '양'} ${f.gender}`;
    rows.push(
      `| ${String(i + 1).padStart(3, '0')} | ${inputStr} | ${v1.strength} → ${v15.strength}${mark(sameStrength)} | ${v1.gyeok} → ${v15.gyeok}${mark(sameGyeok)} | ${v1.yongshin} → ${v15.yongshin}${mark(sameYong)} |`,
    );
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const outDir = 'bench-output';
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `rules-ab-diff-${stamp}.md`);

  const lines = [
    `# v1 ↔ v1.5 판정 차이 — ${COUNT}건 (결정론 대조, LLM 미호출)`,
    '',
    `- 강약 판정 변경: ${diffStrength}/${COUNT}건 · 격국 변경: ${diffGyeok}/${COUNT}건 · 용신 변경: ${diffYongshin}/${COUNT}건`,
    '- v1 = provisional 휴리스틱(gyeokYongshin) / v1.5 = 자평 표준 규칙 엔진(rules, 기준서 근거)',
    '- ⚠️ = 판정이 달라진 항목. LLM A/B 벤치(report-bench --ab)의 감수 우선순위로 활용.',
    '',
    '| # | 입력 | 강약 v1→v1.5 | 격국 v1→v1.5 | 용신 v1→v1.5 |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ];
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`판정 차이: 강약 ${diffStrength} · 격국 ${diffGyeok} · 용신 ${diffYongshin} (총 ${COUNT}건)`);
  console.log(`출력: ${path.resolve(outFile)}`);
};

main();
