/**
 * 직업운 리포트 마크다운 → PDF 변환 스크립트
 * 사용법: npx tsx scripts/generate-pdf-from-report.mts [input.md] [output.pdf]
 * 기본값: scripts/output/job-career-1969-12-02.md → scripts/output/job-career-1969-12-02.pdf
 */
import fs from 'fs';
import path from 'path';

const inputPath  = process.argv[2] ?? path.join(process.cwd(), 'scripts', 'output', 'job-career-1969-12-02.md');
const outputPath = process.argv[3] ?? inputPath.replace(/\.md$/, '.pdf');

if (!fs.existsSync(inputPath)) {
  console.error(`❌ 파일 없음: ${inputPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf-8');

// ── 섹션 파싱 ─────────────────────────────────────────────────────────────────
const SECTION_RE = /\[SECTION\]\s*(\S+)\s*\[TITLE\]\s*([\s\S]*?)\s*\[SUMMARY\]\s*([\s\S]*?)\s*\[CONTENT\]\s*([\s\S]*?)\s*\[END\]/g;

interface Section { id: string; title: string; summary: string; content: string; }
const sections: Section[] = [];
let m: RegExpExecArray | null;
while ((m = SECTION_RE.exec(raw)) !== null) {
  sections.push({ id: m[1], title: m[2].trim(), summary: m[3].trim(), content: m[4].trim() });
}

if (sections.length === 0) {
  console.error('❌ 섹션을 파싱할 수 없습니다. 마크다운 포맷을 확인하세요.');
  process.exit(1);
}
console.log(`✅ 섹션 ${sections.length}개 파싱 완료: ${sections.map(s => s.id).join(', ')}`);

// ── 콘텐츠 → HTML 변환 ────────────────────────────────────────────────────────
function escapeHtml(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inActionPlan = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // [ACTION_PLAN] 블록
    if (line.includes('[ACTION_PLAN]')) {
      inActionPlan = true;
      out.push('<div class="action-plan">');
      line = line.replace('[ACTION_PLAN]', '').trim();
    }
    if (line.includes('[/ACTION_PLAN]')) {
      inActionPlan = false;
      line = line.replace('[/ACTION_PLAN]', '').trim();
      if (!line) { out.push('</div>'); continue; }
    }

    // [SEUN_BLOCK] — 세운 블록
    if (line.startsWith('[SEUN_BLOCK]')) {
      const content = line.replace('[SEUN_BLOCK]', '').trim();
      out.push(`<div class="seun-block">${renderInline(content)}</div>`);
      continue;
    }

    // [DAEUN_TRANSITION] — 대운 전환 하이라이트
    if (line.startsWith('[DAEUN_TRANSITION]')) {
      const content = line.replace('[DAEUN_TRANSITION]', '').trim();
      out.push(`<div class="daeun-transition">${renderInline(content)}</div>`);
      continue;
    }

    // 헤딩 (** ... **) — 단독 줄
    if (/^\*\*\[.*\]\*\*$/.test(line.trim()) || /^\*\*[^*]+\*\*$/.test(line.trim())) {
      const h = line.trim().replace(/^\*\*/, '').replace(/\*\*$/, '');
      out.push(`<p class="sub-heading">${renderInline(escapeHtml(h))}</p>`);
      continue;
    }

    // 번호 매기기 리스트 (1. ...)
    if (/^\d+\.\s/.test(line.trim())) {
      out.push(`<p class="list-num">${renderInline(escapeHtml(line.trim()))}</p>`);
      continue;
    }

    // 불릿 리스트 (• 또는 -)
    if (/^[•\-]\s/.test(line.trim())) {
      out.push(`<p class="list-bullet">${renderInline(escapeHtml(line.trim().replace(/^[•\-]\s/, '')))}</p>`);
      continue;
    }

    // 빈 줄
    if (!line.trim()) {
      out.push('<br>');
      continue;
    }

    out.push(`<p>${renderInline(escapeHtml(line))}</p>`);

    if (inActionPlan && i === lines.length - 1) out.push('</div>');
  }

  // action-plan 미닫힘 방어
  if (inActionPlan) out.push('</div>');
  return out.join('\n');
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// ── 섹션 번호 ──────────────────────────────────────────────────────────────────
const SECTION_NUMBERS: Record<string, string> = {
  chart: '一', answer: '二', foundation: '三', sipseng: '四',
  ohaeng: '五', timing: '六', action: '七', glossary: '八',
};

// ── HTML 생성 ──────────────────────────────────────────────────────────────────
const coverSection = sections.find(s => s.id === 'cover');
const bodyInOrder = ['chart','answer','foundation','sipseng','ohaeng','timing','action','glossary'];
const orderedSections = bodyInOrder
  .map(id => sections.find(s => s.id === id))
  .filter(Boolean) as Section[];

const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const issueDate = new Date().toISOString().slice(0, 10);

const sectionsHtml = orderedSections.map(sec => {
  const num = SECTION_NUMBERS[sec.id] ?? '';
  return `
  <div class="section-card" id="sec-${sec.id}">
    <div class="section-header">
      ${num ? `<span class="section-num">${num}</span>` : ''}
      <h2 class="section-title">${escapeHtml(sec.title)}</h2>
    </div>
    ${sec.summary ? `<p class="section-summary">${escapeHtml(sec.summary)}</p>` : ''}
    <div class="section-content">${renderMarkdown(sec.content)}</div>
  </div>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=794">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;700&display=block">
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0; padding: 0;
      background: #e8dcc8;
      font-family: "Noto Serif SC", "Nanum Myeongjo", serif;
      color: #3d2e1a;
      font-size: 14px;
      line-height: 1.8;
    }

    /* ── 전체 래퍼 ── */
    .report-root {
      max-width: 714px;
      margin: 0 auto;
      padding: 32px 0 48px;
      background: linear-gradient(160deg, #f9f3e3 0%, #f0e8d0 50%, #ede0c4 100%);
      min-height: 100vh;
    }

    /* ── 표지 ── */
    .cover-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 40px;
      padding: 96px 48px;
      min-height: 680px;
      page-break-after: always;
      break-after: page;
      background: linear-gradient(160deg, #f9f1eb 0%, #f4e7dc 52%, #efdccc 100%);
      border-radius: 16px;
      margin-bottom: 40px;
    }
    .cover-sub {
      text-align: center;
    }
    .cover-product {
      font-size: 11px;
      letter-spacing: 0.5em;
      text-transform: uppercase;
      color: #8a5635;
      font-family: "Noto Serif SC", serif;
    }
    .cover-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #c5a58e;
      margin-top: 6px;
    }
    .cover-divider-line { display: block; height: 1px; width: 40px; background: currentColor; }
    .cover-divider-text { font-size: 13px; letter-spacing: 0.25em; font-family: "Noto Serif SC", serif; }
    .cover-main-title {
      font-size: 60px;
      font-family: "Noto Serif SC", serif;
      font-weight: 600;
      color: #6a3c21;
      text-align: center;
      line-height: 1;
      letter-spacing: 0.06em;
    }
    .cover-name-block {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .cover-for-label {
      display: flex;
      align-items: center;
      gap: 16px;
      color: #c5a58e;
      font-size: 11px;
      letter-spacing: 0.4em;
      text-transform: uppercase;
    }
    .cover-name {
      font-size: 78px;
      font-family: "Noto Serif SC", serif;
      font-weight: 700;
      color: #6a3c21;
      letter-spacing: 0.18em;
      line-height: 1;
    }
    .cover-birthdate {
      font-size: 13px;
      color: #7a4a2c;
      letter-spacing: 0.1em;
      font-family: "Noto Serif SC", serif;
    }
    .cover-chips {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
    }
    .cover-chip {
      font-size: 11px;
      font-family: "Noto Serif SC", serif;
      letter-spacing: 0.2em;
      border: 1px solid #c5a58e;
      padding: 6px 16px;
      border-radius: 9999px;
      color: #8a5635;
      background: #fbf1e9;
    }
    .cover-date {
      font-size: 11px;
      color: #7a4a2c;
      letter-spacing: 0.15em;
      font-family: "Noto Serif SC", serif;
    }

    /* ── 구분선 ── */
    .separator {
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0.4;
      margin: 32px 0;
    }
    .separator-line { flex: 1; height: 1px; background: #92400e; }
    .separator-icon { font-size: 16px; color: #78350f; }

    /* ── 섹션 카드 ── */
    .section-card {
      border: 1px solid rgba(217,119,6,0.25);
      background: rgba(255,253,245,0.75);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 40px;
      box-shadow: 0 1px 6px rgba(120,53,15,0.04);
      page-break-inside: auto;
    }
    .section-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(217,119,6,0.2);
    }
    .section-num {
      font-size: 22px;
      font-family: "Noto Serif SC", serif;
      color: #b45309;
      font-weight: 600;
      flex-shrink: 0;
    }
    .section-title {
      font-size: 19px;
      font-family: "Noto Serif SC", serif;
      font-weight: 600;
      color: #78350f;
      margin: 0;
      line-height: 1.4;
    }
    .section-summary {
      font-size: 13px;
      color: #92400e;
      background: rgba(251,191,36,0.12);
      border-left: 3px solid #d97706;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-family: "Noto Serif SC", serif;
    }
    .section-content p {
      margin: 0 0 8px;
      line-height: 1.9;
      color: #3d2e1a;
    }
    .section-content br {
      display: block;
      content: "";
      margin-bottom: 6px;
    }
    .section-content strong { color: #7c2d12; font-weight: 700; }

    /* 소제목 */
    .sub-heading {
      font-size: 15px;
      font-weight: 700;
      color: #78350f;
      font-family: "Noto Serif SC", serif;
      margin: 20px 0 8px !important;
      border-bottom: 1px solid rgba(217,119,6,0.2);
      padding-bottom: 4px;
    }

    /* 리스트 */
    .list-bullet, .list-num {
      padding-left: 1.2em;
      position: relative;
      color: #4a3728;
      margin: 4px 0 !important;
    }
    .list-bullet::before { content: "•"; position: absolute; left: 0; color: #b45309; }
    .list-num::before { content: ""; }

    /* 세운 블록 */
    .seun-block {
      background: rgba(254,243,199,0.6);
      border: 1px solid rgba(217,119,6,0.3);
      border-radius: 10px;
      padding: 14px 18px;
      margin: 12px 0;
      font-size: 13.5px;
      color: #78350f;
    }

    /* 대운 전환 */
    .daeun-transition {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 10px;
      padding: 14px 18px;
      margin: 12px 0;
      font-size: 13px;
      color: #7f1d1d;
      font-weight: 600;
    }

    /* 액션플랜 */
    .action-plan {
      background: linear-gradient(135deg, rgba(254,243,199,0.7), rgba(255,237,213,0.7));
      border: 1px solid rgba(217,119,6,0.4);
      border-radius: 12px;
      padding: 20px 24px;
      margin: 16px 0;
    }
    .action-plan .list-bullet { color: #7c2d12; }

    /* 푸터 */
    .report-footer {
      text-align: center;
      padding: 24px 0;
      border-top: 1px solid rgba(217,119,6,0.3);
      margin-top: 32px;
    }
    .report-footer p {
      font-size: 11px;
      font-family: "Noto Serif SC", serif;
      color: rgba(120,53,15,0.5);
      margin: 3px 0;
    }
  </style>
</head>
<body>
<div class="report-root">

  <!-- 표지 -->
  <div class="cover-page">
    <div class="cover-sub">
      <p class="cover-product">직업운 리포트</p>
      <div class="cover-divider">
        <span class="cover-divider-line"></span>
        <span class="cover-divider-text">職業運 分析書</span>
        <span class="cover-divider-line"></span>
      </div>
    </div>
    <h1 class="cover-main-title">${escapeHtml(coverSection?.title ?? '직업운 리포트')}</h1>
    ${coverSection?.summary ? `<p style="font-size:14px;color:#7a4a2c;text-align:center;max-width:500px;line-height:1.8;font-family:'Noto Serif SC',serif;">${escapeHtml(coverSection.summary)}</p>` : ''}
    <div class="cover-chips">
      <span class="cover-chip">직업운 리포트</span>
      <span class="cover-date">${today}</span>
    </div>
  </div>

  <!-- 구분선 -->
  <div class="separator">
    <span class="separator-line"></span>
    <span class="separator-icon">✦</span>
    <span class="separator-line"></span>
  </div>

  <!-- 본문 섹션들 -->
  ${sectionsHtml}

  <!-- 푸터 -->
  <div class="report-footer">
    <p>직업운 리포트</p>
    <p>본 분석서는 AI 기반 사주명리 시스템으로 제작되었습니다. 참고용으로만 활용하세요.</p>
    <p>© ${new Date().getFullYear()} UI Saju Premium Report · ${issueDate}</p>
  </div>

</div>
</body>
</html>`;

// ── Puppeteer로 PDF 생성 ───────────────────────────────────────────────────────
const CHROME_PATHS = [
  process.env.CHROME_PATH ?? '',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const executablePath = CHROME_PATHS.find(p => fs.existsSync(p)) ?? '';
if (!executablePath) {
  console.error('❌ Chrome을 찾을 수 없습니다. CHROME_PATH 환경변수를 설정하세요.');
  process.exit(1);
}
console.log(`🌐 Chrome: ${executablePath}`);

console.log('📄 PDF 생성 중...');
const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 794, height: 1123 },
});

const page = await browser.newPage();

await page.setRequestInterception(true);
page.on('request', req => {
  const url = req.url();
  if (url.startsWith('data:') || req.resourceType() === 'document') return req.continue();
  if (['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net'].some(h => url.includes(h))) return req.continue();
  req.abort();
});

await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60_000 });
try {
  await page.evaluate(async () => {
    await (document as any).fonts.ready;
    const cjk = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
    await Promise.allSettled(
      ['Noto Serif SC','Noto Sans SC'].flatMap(f =>
        ['400','600','700'].map(w => (document as any).fonts.load(`${w} 1em "${f}"`, cjk))
      )
    );
  });
} catch {}
await new Promise(r => setTimeout(r, 1500));

const pdfBuffer = await page.pdf({
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `
    <div style="width:100%;padding:0 12mm;font-size:9px;color:#8b6b3e;font-family:'Noto Serif SC',serif;display:flex;justify-content:space-between;align-items:center;">
      <span>직업운 리포트</span>
      <span>${issueDate}</span>
    </div>`,
  footerTemplate: `
    <div style="width:100%;padding:0 12mm;font-size:9px;color:#9a7a4a;font-family:'Noto Serif SC',serif;display:flex;justify-content:space-between;align-items:center;">
      <span>UI Saju Premium Report</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '18mm', bottom: '18mm', left: '12mm', right: '12mm' },
});

await browser.close();

const outDir = path.dirname(outputPath);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outputPath, pdfBuffer);

console.log(`\n✅ PDF 저장 완료: ${outputPath}`);
console.log(`   크기: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
