import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { TAB_TRANSITION } from '../../constants/styles';
import { PaperBackground } from '../welcome/PaperBackground';
import { parseLifeNavSections } from '../../lib/premiumReportCore';
import type { ReportSection } from '../../lib/premiumOrderStore';
import { buildSajuAnalysis } from '../../lib/analysis/schema';
import { getCurrentWolun, getWolunData, type WolunMonth } from '../../lib/manseryeok/wolun';
import { buildJeolipIcs } from '../../lib/jeolipIcs';

/**
 * 사주 코드 열람 탭 (Phase 2-4).
 * 코드 하나로 명식·주문·리포트를 조회하고(재열람), 선물 코드를 등록하며,
 * 리포트를 섹션 탭 + 월운 캘린더로 열람한다. PDF 저장·절입 달력(.ics) 포함.
 */

const PAPER_CARD = 'rounded-3xl border border-ink-300/30 bg-white shadow-sm';

// ─── API 응답 타입 (api/code.ts lookupCode와 동일 형상) ─────────────────────

interface MyeongsikParams {
  pillars: { year: string; month: string; day: string; hour: string | null };
  gender: 'male' | 'female';
  daeunsu: number;
  daeunDirection: 'forward' | 'backward';
  birthYear: number;
  timeUnknown: boolean;
}

interface LookupOrder {
  orderId: string;
  product: string;
  status: string;
  amount: number;
  followupRemaining: number;
  createdAt: string;
}

interface LookupReport {
  reportId: string;
  product: string;
  content: string;
  createdAt: string;
  expiresAt: string;
}

interface LookupResult {
  found: boolean;
  giftPending: boolean;
  myeongsik: MyeongsikParams | null;
  orders: LookupOrder[];
  reports: LookupReport[];
  regenerable: Array<{ orderId: string; product: string }>;
  newYearDiscountPercent: number | null;
}

const PRODUCT_LABEL: Record<string, string> = {
  premium: '평생 사주 리포트',
  yearly2026: '2026 일년운세 리포트',
  jobCareer: '직업·재물운 리포트',
  loveMarriage: '연애·결혼운 리포트',
};

const STATUS_LABEL: Record<string, string> = {
  paid: '결제 완료',
  generated: '리포트 생성됨',
  refunded: '환불됨',
};

const CODE_INPUT_PATTERN = /^[A-Za-z0-9]{2}-?[A-Za-z0-9]{6}$/;

// ─── 리포트 본문 렌더 헬퍼 (구조 마커 제거) ─────────────────────────────────

const MARKER_PATTERNS: RegExp[] = [
  /\[\s*\/?\s*(?:SECTION|TITLE|SUMMARY|CONTENT|END)\s*\]/gi,
  /\[\s*\/?\s*DAEUN_(?:START|CONTENT|END)\s*\]/gi,
  /\[\s*DAEUN_TRANSITION\s*\]/gi,
  /\[\s*\/?\s*FIELD_[^\]]*\]/gi,
  /\[\s*\/?\s*ACTION_PLAN\s*\]/gi,
  /\[\s*\/?\s*EASY_(?:START|END)\s*\]/gi,
  /\[\s*\/?\s*MONTH_(?:START|CONTENT|END)\s*\]/gi,
  /\[\s*SEUN_BLOCK\s*\]/gi,
  /\[\s*\/?\s*SUB(?:\s+[^\]]*)?\s*\]/gi,
];

function stripMarkers(input: string): string {
  let out = input;
  for (const p of MARKER_PATTERNS) out = out.replace(p, '\n');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** **강조** 만 지원하는 단순 텍스트 렌더 */
function TextBlock({ text }: { text: string }) {
  const paragraphs = stripMarkers(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-[14px] leading-relaxed text-ink-700 whitespace-pre-line">
          {para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
            chunk.startsWith('**') && chunk.endsWith('**') ? (
              <strong key={j} className="font-bold text-ink-900">{chunk.slice(2, -2)}</strong>
            ) : (
              chunk
            ),
          )}
        </p>
      ))}
    </div>
  );
}

// ─── 월운 캘린더 (절입일 기준 월 구분 표기) ─────────────────────────────────

const MONTH_BLOCK_RE = /\[\s*MONTH_START\s*\]\s*([\s\S]*?)\s*\[\s*MONTH_CONTENT\s*\]([\s\S]*?)\[\s*MONTH_END\s*\]/g;

function fmtKstDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function MonthCalendar({ content, sajuYear }: { content: string; sajuYear: number }) {
  const months = useMemo(() => {
    const blocks: Array<{ title: string; body: string }> = [];
    for (const m of content.matchAll(MONTH_BLOCK_RE)) {
      blocks.push({ title: m[1].trim().split('\n')[0], body: m[2].trim() });
    }
    return blocks;
  }, [content]);
  const wolun: WolunMonth[] = useMemo(() => getWolunData(sajuYear), [sajuYear]);
  const [open, setOpen] = useState<number | null>(null);

  if (months.length === 0) return <TextBlock text={content} />;

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-ink-500">
        사주의 달은 매월 1일이 아니라 절입일에 바뀝니다. 각 달의 구간을 절입 기준으로 표기했습니다.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {months.map((block, i) => {
          const w = wolun[i];
          return (
            <div key={i} className={`${PAPER_CARD} p-4`}>
              <button className="w-full text-left" onClick={() => setOpen(open === i ? null : i)}>
                {w && (
                  <p className="text-[12px] text-ink-500">
                    {w.jeolName} {fmtKstDay(w.startKstISO)} ~ {fmtKstDay(w.endKstISO)} · {w.ganzhi}월
                  </p>
                )}
                <p className="text-[14px] font-bold text-ink-900 mt-1">{stripMarkers(block.title)}</p>
              </button>
              {open === i && (
                <div className="mt-3 border-t border-ink-300/20 pt-3">
                  <TextBlock text={block.body} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 선물 코드 등록 폼 ──────────────────────────────────────────────────────

const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];

function buildMyeongsikFromBirth(input: {
  dateStr: string;
  timeStr: string;
  isLunar: boolean;
  gender: 'M' | 'F';
  unknownTime: boolean;
}): MyeongsikParams {
  const analysis = buildSajuAnalysis({
    dateStr: input.dateStr,
    timeStr: input.unknownTime ? '12:00' : input.timeStr,
    isLunar: input.isLunar,
    isLeap: false,
    gender: input.gender,
    unknownTime: input.unknownTime,
  });
  const [year, month, day, hour] = analysis.myeongsik.map((p) => p.ganzhi);
  const yearStem = year.charAt(0);
  const isYang = YANG_STEMS.includes(yearStem);
  const forward = (isYang && input.gender === 'M') || (!isYang && input.gender === 'F');
  return {
    pillars: { year, month, day, hour: input.unknownTime || hour === '??' ? null : hour },
    gender: input.gender === 'M' ? 'male' : 'female',
    daeunsu: analysis.daeun[0]?.startAge ?? 0,
    daeunDirection: forward ? 'forward' : 'backward',
    birthYear: Number(input.dateStr.slice(0, 4)),
    timeUnknown: input.unknownTime,
  };
}

function GiftRedeemForm({ code, onRedeemed }: { code: string; onRedeemed: () => void }) {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('12:00');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [isLunar, setIsLunar] = useState(false);
  const [unknownTime, setUnknownTime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      setError('생년월일을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const myeongsik = buildMyeongsikFromBirth({ dateStr, timeStr, isLunar, gender, unknownTime });
      const res = await fetch('/api/code/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, myeongsik }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || '등록에 실패했습니다.');
      onRedeemed();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-xl border border-ink-300/40 bg-white px-3 py-2 text-[14px] text-ink-900';

  return (
    <section className={`${PAPER_CARD} p-6 space-y-4`}>
      <h3 className="font-serif text-[18px] font-bold text-ink-900">선물 코드 등록</h3>
      <p className="text-[14px] text-ink-500 leading-relaxed">
        이 코드는 아직 사주가 등록되지 않은 선물 코드입니다. 생년월일과 태어난 시간을 입력하면
        코드에 사주가 등록되고 리포트를 받을 수 있습니다. 한 번 등록하면 변경할 수 없습니다.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[12px] text-ink-500">생년월일</span>
          <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-[12px] text-ink-500">태어난 시간</span>
          <input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} disabled={unknownTime} className={`${field} disabled:opacity-40`} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[14px] text-ink-700">
        <label className="flex items-center gap-2">
          <input type="radio" checked={gender === 'M'} onChange={() => setGender('M')} /> 남성
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={gender === 'F'} onChange={() => setGender('F')} /> 여성
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isLunar} onChange={(e) => setIsLunar(e.target.checked)} /> 음력
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={unknownTime} onChange={(e) => setUnknownTime(e.target.checked)} /> 시간 모름
        </label>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="px-5 py-2.5 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold disabled:opacity-40"
      >
        {busy ? '등록 중...' : '사주 등록하기'}
      </button>
    </section>
  );
}

// ─── PDF ────────────────────────────────────────────────────────────────────

function buildPdfHtml(code: string, myeongsik: MyeongsikParams | null, report: LookupReport, sections: ReportSection[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pillars = myeongsik
    ? `${myeongsik.pillars.year}년 ${myeongsik.pillars.month}월 ${myeongsik.pillars.day}일 ${myeongsik.pillars.hour ?? '시간 미상'}`
    : '';
  const body = sections
    .map(
      (s) => `
      <section>
        <h2>${esc(s.title)}</h2>
        ${s.summary ? `<p class="summary">${esc(stripMarkers(s.summary))}</p>` : ''}
        ${stripMarkers(s.content)
          .split(/\n{2,}/)
          .map((p) => `<p>${esc(p).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}</p>`)
          .join('')}
      </section>`,
    )
    .join('');
  // 표지: 명식(간지 8자)·코드만 — 생년월일 원문은 표기하지 않는다 (2-4 원칙)
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
<style>
  @page { size: A4 portrait; margin: 18mm 16mm; }
  body { font-family: 'Batang', 'Noto Serif KR', serif; color: #1f2430; font-size: 11pt; line-height: 1.75; }
  .cover { text-align: center; padding: 120px 0 60px; page-break-after: always; }
  .cover h1 { font-size: 24pt; margin-bottom: 24px; }
  .cover .pillars { font-size: 14pt; letter-spacing: 2px; }
  .cover .code { margin-top: 40px; font-size: 11pt; color: #6b6f7c; }
  section { page-break-inside: avoid; margin-bottom: 28px; }
  h2 { font-size: 14pt; border-bottom: 1px solid #c9c4b4; padding-bottom: 6px; }
  .summary { font-weight: bold; }
</style></head><body>
  <div class="cover">
    <h1>${esc(PRODUCT_LABEL[report.product] ?? '사주 리포트')}</h1>
    <p class="pillars">${esc(pillars)}</p>
    <p class="code">사주 코드 ${esc(code)}</p>
  </div>
  ${body}
</body></html>`;
}

// ─── 메인 탭 ────────────────────────────────────────────────────────────────

export default function CodeLookupTab() {
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReportIdx, setActiveReportIdx] = useState(0);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [pdfBusy, setPdfBusy] = useState(false);

  const normalized = codeInput.trim().toUpperCase().replace(/^([A-Z0-9]{2})([A-Z0-9]{6})$/, '$1-$2');

  const lookup = async (target: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/code?code=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || '조회에 실패했습니다.');
      setCode(target);
      setResult(data as LookupResult);
      setActiveReportIdx(0);
      setActiveSectionIdx(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    if (!CODE_INPUT_PATTERN.test(codeInput.trim())) {
      setError('코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)');
      return;
    }
    lookup(normalized);
  };

  const activeReport = result?.reports[activeReportIdx] ?? null;
  const sections: ReportSection[] = useMemo(
    () => (activeReport ? parseLifeNavSections(activeReport.content, []) : []),
    [activeReport],
  );
  const activeSection = sections[activeSectionIdx] ?? null;

  const downloadIcs = () => {
    const nextYear = getCurrentWolun().sajuYear + 1;
    const blob = new Blob([buildJeolipIcs(nextYear)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `절입달력_${nextYear}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!result || !activeReport) return;
    setPdfBusy(true);
    try {
      const html = buildPdfHtml(code, result.myeongsik, activeReport, sections);
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, fileName: `사주리포트_${code.replace(/[^A-Z0-9-]/g, '')}` }),
      });
      if (!res.ok) throw new Error('PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `사주리포트_${code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF 생성에 실패했습니다.');
    } finally {
      setPdfBusy(false);
    }
  };

  const expiresIn = (iso: string): string => {
    const hours = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 3_600_000));
    return hours >= 24 ? `${Math.floor(hours / 24)}일 ${hours % 24}시간` : `${hours}시간`;
  };

  return (
    <motion.div
      key="lookup"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={TAB_TRANSITION}
      className="absolute inset-0 overflow-y-auto hide-scrollbar bg-paper-50"
      data-theme="light"
    >
      <div className="sticky top-0 left-0 w-full h-screen pointer-events-none -mb-[100vh]">
        <PaperBackground />
      </div>

      <div className="relative px-4 py-10 md:py-14 md:px-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="text-center space-y-3 pt-2 pb-2">
            <h2 className="font-serif text-[28px] md:text-[36px] font-bold text-ink-900 leading-tight">리포트 조회</h2>
            <p className="text-[14px] text-ink-500 leading-relaxed">
              구매 시 받은 사주 코드로 리포트를 다시 열람하세요. 코드가 유일한 열쇠이며, 개인정보는 저장되지 않습니다.
            </p>
          </header>

          {/* 코드 입력 */}
          <section className={`${PAPER_CARD} p-6`}>
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="예: HW-3F9K2A"
                className="flex-1 rounded-xl border border-ink-300/40 bg-white px-4 py-3 text-[14px] tracking-widest uppercase text-ink-900"
              />
              <button
                onClick={submit}
                disabled={loading}
                className="px-5 py-3 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold disabled:opacity-40"
              >
                {loading ? '조회 중...' : '조회'}
              </button>
            </div>
            {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}
          </section>

          {result && result.giftPending && <GiftRedeemForm code={code} onRedeemed={() => lookup(code)} />}

          {result && !result.giftPending && (
            <>
              {/* 명식 + 주문 요약 */}
              <section className={`${PAPER_CARD} p-6 space-y-4`}>
                {result.myeongsik && (
                  <div>
                    <p className="text-[12px] text-ink-500">등록된 명식</p>
                    <p className="font-serif text-[18px] font-bold text-ink-900 tracking-wider mt-1">
                      {result.myeongsik.pillars.year}년 {result.myeongsik.pillars.month}월 {result.myeongsik.pillars.day}일{' '}
                      {result.myeongsik.pillars.hour ?? '시간 미상'}
                    </p>
                    <p className="text-[12px] text-ink-500 mt-1">
                      대운수 {result.myeongsik.daeunsu} · {result.myeongsik.daeunDirection === 'forward' ? '순행' : '역행'}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {result.orders.map((o) => (
                    <div key={o.orderId} className="flex items-center justify-between border-t border-ink-300/20 pt-2">
                      <div>
                        <p className="text-[14px] text-ink-900">{PRODUCT_LABEL[o.product] ?? o.product}</p>
                        <p className="text-[12px] text-ink-500">
                          {STATUS_LABEL[o.status] ?? o.status} · 후속 질문 {o.followupRemaining}회 남음
                        </p>
                      </div>
                      <p className="text-[12px] text-ink-500">{new Date(o.createdAt).toLocaleDateString('ko-KR')}</p>
                    </div>
                  ))}
                  {result.orders.length === 0 && (
                    <p className="text-[14px] text-ink-500">아직 구매 내역이 없습니다.</p>
                  )}
                </div>
                {result.newYearDiscountPercent != null && (
                  <p className="text-[12px] text-ink-500 border-t border-ink-300/20 pt-3">
                    재구매 혜택: 새해 리포트 {result.newYearDiscountPercent}% 할인 대상입니다.
                  </p>
                )}
              </section>

              {/* 만료 → 재생성 안내 */}
              {result.regenerable.length > 0 && (
                <section className={`${PAPER_CARD} p-6`}>
                  <p className="text-[14px] text-ink-700 leading-relaxed">
                    {result.regenerable.map((r) => PRODUCT_LABEL[r.product] ?? r.product).join(', ')}의 열람 기간(72시간)이
                    지나 본문이 파기되었습니다. 동일 상품은 추가 결제 없이 재생성해 드립니다 — 재생성 기능은 준비 중이며,
                    그 전에는 문의를 통해 요청하실 수 있습니다.
                  </p>
                </section>
              )}

              {/* 리포트 열람 */}
              {result.reports.length > 0 && (
                <section className={`${PAPER_CARD} p-6 space-y-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {result.reports.length > 1 ? (
                        <div className="flex gap-2">
                          {result.reports.map((r, i) => (
                            <button
                              key={r.reportId}
                              onClick={() => {
                                setActiveReportIdx(i);
                                setActiveSectionIdx(0);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[13px] font-bold ${
                                i === activeReportIdx ? 'bg-ink-900 text-paper-50' : 'border border-ink-300/40 text-ink-700'
                              }`}
                            >
                              {PRODUCT_LABEL[r.product] ?? r.product}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <h3 className="font-serif text-[18px] font-bold text-ink-900">
                          {PRODUCT_LABEL[activeReport!.product] ?? activeReport!.product}
                        </h3>
                      )}
                      <p className="text-[12px] text-ink-500 mt-1">
                        열람 가능 기간이 {expiresIn(activeReport!.expiresAt)} 남았습니다. 만료 후 본문은 파기됩니다.
                      </p>
                    </div>
                    <button
                      onClick={downloadPdf}
                      disabled={pdfBusy}
                      className="px-4 py-2 rounded-xl border border-ink-300/40 text-ink-700 text-[13px] font-bold disabled:opacity-40"
                    >
                      {pdfBusy ? 'PDF 생성 중...' : 'PDF로 저장'}
                    </button>
                  </div>

                  {/* 섹션 탭 */}
                  {sections.length > 0 && (
                    <>
                      <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
                        {sections.map((s, i) => (
                          <button
                            key={s.id + i}
                            onClick={() => setActiveSectionIdx(i)}
                            className={`shrink-0 px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all ${
                              i === activeSectionIdx
                                ? 'bg-ink-900 text-paper-50'
                                : 'border border-ink-300/40 text-ink-700'
                            }`}
                          >
                            {s.title.length > 14 ? `${s.title.slice(0, 14)}…` : s.title}
                          </button>
                        ))}
                      </div>

                      {activeSection && (
                        <div className="space-y-4">
                          <h4 className="font-serif text-[18px] font-bold text-ink-900">{activeSection.title}</h4>
                          {activeSection.summary && (
                            <p className="text-[14px] font-bold text-ink-900 leading-relaxed">
                              {stripMarkers(activeSection.summary)}
                            </p>
                          )}
                          {activeSection.id === 'monthly' && activeReport!.product === 'yearly2026' ? (
                            <MonthCalendar content={activeSection.content} sajuYear={2026} />
                          ) : (
                            <TextBlock text={activeSection.content} />
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {sections.length === 0 && <TextBlock text={activeReport!.content} />}
                </section>
              )}
            </>
          )}

          {/* 절입 달력 — 코드 없이도 받을 수 있는 공용 달력 */}
          <section className={`${PAPER_CARD} p-6 flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <p className="text-[14px] text-ink-900">절입일 달력 (.ics)</p>
              <p className="text-[12px] text-ink-500 mt-1">
                내년 입춘과 12절입, "신년운세 보는 날"을 캘린더 앱에 추가하세요.
              </p>
            </div>
            <button
              onClick={downloadIcs}
              className="px-4 py-2 rounded-xl border border-ink-300/40 text-ink-700 text-[13px] font-bold"
            >
              달력 내려받기
            </button>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
