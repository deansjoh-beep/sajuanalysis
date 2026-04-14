import React, { useRef, useState } from 'react';
import {
  ArrowLeft, Download, Loader2, LogOut,
  FileText, Scroll, Star, Briefcase, DollarSign, Heart, Activity,
  CheckSquare, ChevronRight
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { ReportInputData, ReportSection, DaeunBlock } from '../../lib/premiumOrderStore';
import { elementMap, yinYangMap, hanjaToHangul } from '../../utils/saju';
// ─── 오행 데이터 유틸리티 ──────────────────────────────────────────────────
const ELEM_KO: Record<string, string> = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };
const ELEM_COLORS: Record<string, string> = { wood: '#22c55e', fire: '#ef4444', earth: '#d97706', metal: '#a1a1aa', water: '#3b82f6' };

const calcElements = (saju: any[]) => {
  const counts: Record<string, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  saju.forEach(p => {
    const se = elementMap[p.stem?.hanja ?? ''];
    const be = elementMap[p.branch?.hanja ?? ''];
    if (se && se in counts) counts[se]++;
    if (be && be in counts) counts[be]++;
  });
  return Object.entries(counts).map(([k, v]) => ({ key: k, name: ELEM_KO[k] ?? k, value: v, color: ELEM_COLORS[k] ?? '#888' }));
};

// ─── SVG 파이차트 ───────────────────────────────────────────────────────────────
const SvgPieChart: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = 50, cy = 50, r = 42;
  let angle = -Math.PI / 2;
  const slices = data.filter(d => d.value > 0).map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const ea = angle + sweep;
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
    const la = sweep > Math.PI ? 1 : 0;
    const path = `M${cx} ${cy}L${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${la} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`;
    angle = ea;
    return { ...d, path };
  });
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />)}
    </svg>
  );
};

// ─── 핵심 대시보드 ───────────────────────────────────────────────────────────────
const DashboardCard: React.FC<{ inputData: ReportInputData; daeun: any[]; yongshin: any }> = ({ inputData, daeun, yongshin }) => {
  const currentYear = new Date().getFullYear();
  const currentDaeun = daeun?.find((d: any) => {
    const start: number = d.startYear ?? (currentYear + 9999);
    return currentYear >= start && currentYear < start + 10;
  });
  const yongshinStr: string = yongshin?.yongshin ?? '';
  const EL_KW: Record<string, string> = { '목': '성장·창조', '화': '열정·돌파', '토': '안정·신뢰', '금': '결단·정밀', '수': '지혜·유연' };
  const kwKey = Object.keys(EL_KW).find(k => yongshinStr.includes(k));
  const keyword = kwKey ? EL_KW[kwKey] : '균형';
  const cards = [
    { label: '이름', value: inputData.name, sub: inputData.gender === 'M' ? '남성' : '여성', color: 'bg-amber-800' },
    { label: '생년월일', value: inputData.birthDate, sub: inputData.unknownTime ? '생시 미상' : inputData.birthTime, color: 'bg-amber-900' },
    { label: '현재 대운', value: currentDaeun ? `${hanjaToHangul[currentDaeun.stem] ?? currentDaeun.stem ?? ''}${hanjaToHangul[currentDaeun.branch] ?? currentDaeun.branch ?? ''}운` : '—', sub: currentDaeun ? `${currentDaeun.startAge ?? '?'}~${(currentDaeun.startAge ?? 0) + 9}세` : '', color: 'bg-red-900' },
    { label: '용신 키워드', value: yongshinStr.slice(0, 10) || '—', sub: keyword, color: 'bg-orange-900' },
  ];
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-[#2d1a00]/20 p-5">
      <p className="text-[13px] font-bold text-amber-600/80 uppercase tracking-[0.22em] mb-3 font-serif">핵심 프로파일</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className={`rounded-xl ${c.color} p-3 text-white`}>
            <p className="text-[13px] text-white/65 font-serif uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-[20px] font-bold leading-snug font-serif">{c.value}</p>
            <p className="text-[14px] text-white/80 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── 합충 인포그래픽 섹션 ─────────────────────────────────────────────────────
const CHEONGAN_HAP: Record<string, string> = { '甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊' };
const CHEONGAN_CHUNG: Record<string, string> = { '甲': '庚', '庚': '甲', '乙': '辛', '辛': '乙', '丙': '壬', '壬': '丙', '丁': '癸', '癸': '丁' };
const JIJI_HAP: Record<string, string> = { '子': '丑', '丑': '子', '寅': '亥', '亥': '寅', '卯': '戌', '戌': '卯', '辰': '酉', '酉': '辰', '巳': '申', '申': '巳', '午': '未', '未': '午' };
const JIJI_CHUNG: Record<string, string> = { '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅', '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳' };

const HapchungSection: React.FC<{ section: ReportSection; saju: any[] }> = ({ section, saju }) => {
  if (!saju || saju.length < 4) return <GenericSection section={section} />;
  // 합/충 관계 계산
  type Rel = { type: '합' | '충'; layer: 'stem' | 'branch'; from: number; to: number };
  const rels: Rel[] = [];
  const COLS = [3, 2, 1, 0]; // 년월일시 순
  COLS.forEach((ci, ai) => {
    COLS.forEach((cj, aj) => {
      if (aj <= ai) return;
      const si = saju[ci].stem?.hanja ?? '', sj = saju[cj].stem?.hanja ?? '';
      const bi = saju[ci].branch?.hanja ?? '', bj = saju[cj].branch?.hanja ?? '';
      if (CHEONGAN_HAP[si] === sj) rels.push({ type: '합', layer: 'stem', from: ai, to: aj });
      else if (CHEONGAN_CHUNG[si] === sj) rels.push({ type: '충', layer: 'stem', from: ai, to: aj });
      if (JIJI_HAP[bi] === bj) rels.push({ type: '합', layer: 'branch', from: ai, to: aj });
      else if (JIJI_CHUNG[bi] === bj) rels.push({ type: '충', layer: 'branch', from: ai, to: aj });
    });
  });
  const LABELS_SHORT = ['년주', '월주', '일주', '시주'];
  return (
    <div>
      <SummaryBox text={section.summary} />
      <div className="my-5 p-4 rounded-2xl bg-amber-50/40 border border-amber-200/50">
        <p className="text-[14px] font-bold text-amber-700 uppercase tracking-wide mb-4 font-serif">합충형파해 관계도</p>
        {/* 주석 : 년월일시 4열 */}
        <div className="relative">
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[3, 2, 1, 0].map((idx, col) => (
              <div key={col} className="flex flex-col items-center gap-2">
                <span className="text-[13px] text-amber-700 font-serif">{LABELS_SHORT[col]}</span>
                <HanjaBoxReport hanja={saju[idx].stem?.hanja ?? '?'} size="sm" />
                <div className="w-px h-4 bg-amber-300/60" />
                <HanjaBoxReport hanja={saju[idx].branch?.hanja ?? '?'} size="sm" />
              </div>
            ))}
          </div>
          {/* 관계선 SVG overlay */}
          <svg className="absolute inset-0 pointer-events-none" style={{ top: 0, left: 0, width: '100%', height: '100%' }}>
            {rels.map((r, i) => {
              const y = r.layer === 'stem' ? '30%' : '70%';
              const x1 = `${(r.from + 0.5) * 25}%`, x2 = `${(r.to + 0.5) * 25}%`;
              return (
                <g key={i}>
                  <line x1={x1} y1={y} x2={x2} y2={y} stroke={r.type === '합' ? '#22c55e' : '#ef4444'} strokeWidth="2" strokeDasharray={r.type === '충' ? '4 2' : undefined} />
                  <text x={`${((r.from + r.to + 1) * 12.5)}%`} y={y} dominantBaseline="auto" textAnchor="middle" fontSize="12" fill={r.type === '합' ? '#16a34a' : '#dc2626'} dy="-3">{r.type}</text>
                </g>
              );
            })}
          </svg>
        </div>
        {rels.length === 0 && <p className="text-xs text-zinc-400 text-center py-2">주요 합충 관계 검출되지 않음</p>}
        <div className="flex gap-4 mt-3 justify-end">
          <span className="flex items-center gap-1 text-[13px] text-emerald-700"><span className="inline-block w-7 h-0.5 bg-emerald-500" /> 합(合)</span>
          <span className="flex items-center gap-1 text-[13px] text-red-600"><span className="inline-block w-7 h-0.5 border-dashed border-t-2 border-red-500" /> 충(沖)</span>
        </div>
      </div>
      <ContentText text={section.content} />
    </div>
  );
};

// ─── 분야별 아이콘 카드 섹션 ──────────────────────────────────────────────────────
const FIELD_DEFS = [
  { key: '직업', label: '직업 & 사업운', Icon: Briefcase, color: 'border-indigo-300 bg-transparent', iconColor: 'text-indigo-600', tag: 'FIELD_직업' },
  { key: '재물', label: '재물운', Icon: DollarSign, color: 'border-emerald-300 bg-transparent', iconColor: 'text-emerald-600', tag: 'FIELD_재물' },
  { key: '건강', label: '건강운', Icon: Activity, color: 'border-rose-300 bg-transparent', iconColor: 'text-rose-600', tag: 'FIELD_건강' },
  { key: '연애', label: '연애 & 결혼운', Icon: Heart, color: 'border-pink-300 bg-transparent', iconColor: 'text-pink-600', tag: 'FIELD_연애' },
];

const FieldsSection: React.FC<{ section: ReportSection }> = ({ section }) => {
  const raw = section.content.replace(/\[DAEUN_START\][\s\S]*?\[DAEUN_END\]/g, '');
  // [FIELD_직업]...[/FIELD_직업] 파싱
  const fieldTexts: Record<string, string> = {};
  FIELD_DEFS.forEach(f => {
    const m = raw.match(new RegExp(`\\[${f.tag}\\]([\\s\\S]*?)\\[\/${f.tag}\\]`));
    if (m) fieldTexts[f.tag] = m[1].trim();
  });
  const hasCards = Object.keys(fieldTexts).length > 0;
  return (
    <div>
      <SummaryBox text={section.summary} />
      {hasCards ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {FIELD_DEFS.map(f => {
            const txt = fieldTexts[f.tag];
            if (!txt) return null;
            return (
              <div key={f.tag} className={`rounded-2xl border ${f.color} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <f.Icon className={`w-4 h-4 ${f.iconColor}`} />
                  <p className={`text-xs font-bold ${f.iconColor} font-serif`}>{f.label}</p>
                </div>
                <RenderLines text={txt} />
              </div>
            );
          })}
        </div>
      ) : (
        <ContentText text={section.content} />
      )}
    </div>
  );
};
// ─── HanjaBox (화선지 스타일로 재정의) ───────────────────────────────────────
const ELEMENT_STYLES: Record<string, { yang: string; yin: string }> = {
  wood:  { yang: 'border-2 border-emerald-500 text-emerald-700 bg-transparent',       yin: 'border-2 border-emerald-500 bg-emerald-500 text-white' },
  fire:  { yang: 'border-2 border-red-500 text-red-700 bg-transparent',               yin: 'border-2 border-red-500 bg-red-500 text-white' },
  earth: { yang: 'border-2 border-amber-400 text-amber-700 bg-transparent',           yin: 'border-2 border-amber-400 bg-amber-400 text-zinc-900' },
  water: { yang: 'border-2 border-zinc-700 text-zinc-700 bg-transparent',             yin: 'border-2 border-zinc-700 bg-zinc-800 text-white' },
  metal: { yang: 'border-2 border-zinc-300 bg-white text-zinc-500',                   yin: 'border-2 border-zinc-200 bg-zinc-100 text-zinc-600' },
};

const HanjaBoxReport: React.FC<{ hanja: string; size?: 'sm' | 'md' | 'lg'; deity?: string; deityPosition?: 'top' | 'bottom' }> = ({
  hanja, size = 'md', deity, deityPosition = 'bottom'
}) => {
  const element = elementMap[hanja];
  const isYang = yinYangMap[hanja] === '+';
  const sizeClass = size === 'sm' ? 'w-9 h-9 text-base rounded-md' : size === 'lg' ? 'w-14 h-14 text-3xl rounded-xl' : 'w-11 h-11 text-xl rounded-lg';
  const styles = element ? ELEMENT_STYLES[element] : null;
  const boxClass = styles ? (isYang ? styles.yang : styles.yin) : 'border-2 border-zinc-300 text-zinc-500 bg-transparent';

  const deityEl = deity ? (
    <span className={`absolute text-[11px] font-bold text-amber-700 ${deityPosition === 'top' ? '-top-5' : '-bottom-5'} left-1/2 -translate-x-1/2 whitespace-nowrap font-serif`}>
      {deity}
    </span>
  ) : null;

  return (
    <div className="relative inline-flex flex-col items-center">
      {deityPosition === 'top' && deityEl}
      <div className={`${sizeClass} ${boxClass} flex items-center justify-center font-bold font-serif`}>
        {hanja}
      </div>
      {deityPosition === 'bottom' && deityEl}
    </div>
  );
};

// ─── 섹션 컴포넌트들 ─────────────────────────────────────────────────────────

const SummaryBox: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const cleaned = stripAllMarkers(text);
  if (!cleaned) return null;
  return (
    <div className="my-5 pl-5 pr-6 py-4 bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100/70 border-l-[6px] border-amber-600 rounded-r-2xl shadow-md shadow-amber-200/40">
      <div className="flex items-start gap-2.5">
        <span className="text-[15px] font-extrabold text-amber-800 font-serif flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-md bg-amber-600 text-white">핵심</span>
        <p className="text-[17px] font-bold font-serif text-amber-950 leading-[1.9] tracking-wide">{cleaned}</p>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode; number?: string }> = ({ children, number }) => (
  <div className="flex items-center gap-3 mb-4">
    {number && (
      <div className="w-8 h-8 rounded-full bg-[#2d1a00] flex items-center justify-center flex-shrink-0">
        <span className="text-[#d4a832] text-xs font-bold font-serif">{number}</span>
      </div>
    )}
    <h2 className="text-2xl font-brush font-black text-[#2d1a00] leading-tight tracking-wide">{children}</h2>
    <div className="flex-1 h-px bg-amber-300/60" />
  </div>
);

// 본문에서 제거해야 할 모든 구조 마커 (AI가 잔존시켰을 때 노출되지 않도록)
const MARKER_PATTERNS: RegExp[] = [
  // 최상위 섹션 마커
  /\[\s*\/?\s*(?:SECTION|TITLE|SUMMARY|CONTENT|END)\s*\]/gi,
  // 대운 블록
  /\[\s*\/?\s*DAEUN_(?:START|CONTENT|END)\s*\]/gi,
  // 분야 블록 (한글/영문 태그 모두)
  /\[\s*\/?\s*FIELD_[^\]]*\]/gi,
  // 실행 지침
  /\[\s*\/?\s*ACTION_PLAN\s*\]/gi,
  // 초급 병행 블록
  /\[\s*\/?\s*EASY_(?:START|END)\s*\]/gi,
  // 월별 블록 (일년운세)
  /\[\s*\/?\s*MONTH_(?:START|CONTENT|END)\s*\]/gi,
  // 답변 하위 블록
  /\[\s*\/?\s*SUB(?:\s+[^\]]*)?\s*\]/gi,
];

const stripAllMarkers = (input: string): string => {
  let result = input || '';
  for (const p of MARKER_PATTERNS) result = result.replace(p, '');
  // 마커 제거로 생긴 과도한 공백 정리
  result = result.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return result.trim();
};

// 강조 키워드 자동 감지 (줄 머리말이 다음 패턴일 때 하이라이트)
const EMPHASIS_LEAD = /^(결론|핵심|요약|주의|중요|권고|포인트)\s*[:：]\s*/;

const RenderLines: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {stripAllMarkers(text)
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map((line, i) => {
      const leadMatch = line.match(EMPHASIS_LEAD);
      const isEmphasisLine = !!leadMatch;
      const lineText = isEmphasisLine ? line.replace(EMPHASIS_LEAD, '') : line;
      const parts = lineText.split(/\*\*(.*?)\*\*/g);

      if (isEmphasisLine) {
        return (
          <div
            key={i}
            className="rounded-xl border-l-4 border-amber-600 bg-amber-50/90 px-4 py-3 shadow-sm"
          >
            <p className="text-[15px] font-report text-amber-950 leading-[1.9] tracking-wide">
              <span className="inline-block mr-2 px-2 py-0.5 rounded-md bg-amber-600 text-white text-[12px] font-extrabold font-serif align-middle">
                {leadMatch![1]}
              </span>
              {parts.map((p, pi) =>
                pi % 2 === 1
                  ? <strong key={pi} className="font-black text-amber-900 bg-amber-200/60 px-1 rounded">{p}</strong>
                  : p
              )}
            </p>
          </div>
        );
      }

      return (
        <p key={i} className="text-[15px] font-report text-zinc-800 leading-[2] tracking-wide">
          {parts.map((p, pi) =>
            pi % 2 === 1
              ? <strong key={pi} className="font-black text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded-md shadow-[inset_0_-2px_0_rgba(180,83,9,0.25)]">{p}</strong>
              : p
          )}
        </p>
      );
    })}
  </div>
);

const ContentText: React.FC<{ text: string }> = ({ text }) => {
  // [DAEUN_START]...[DAEUN_END] 블록 제거 (대운 섹션에서 별도 파싱되므로 본문에서는 제거)
  const withoutDaeun = text.replace(/\[DAEUN_START\][\s\S]*?\[DAEUN_END\]/g, '');

  // [MONTH_START]...[MONTH_END] 블록 제거 (월별 섹션에서 별도 파싱)
  const withoutMonthly = withoutDaeun.replace(/\[MONTH_START\][\s\S]*?\[MONTH_END\]/g, '');

  // [ACTION_PLAN]...[/ACTION_PLAN] 분리
  const actionMatch = withoutMonthly.match(/\[ACTION_PLAN\]([\s\S]*?)\[\/ACTION_PLAN\]/);
  const actionText = actionMatch ? stripAllMarkers(actionMatch[1]) : null;
  const withoutAction = withoutMonthly.replace(/\[ACTION_PLAN\][\s\S]*?\[\/ACTION_PLAN\]/g, '').trim();

  // [EASY_START]...[EASY_END] 분리
  const easyMatch = withoutAction.match(/\[\s*EASY_START\s*\]([\s\S]*?)\[\s*\/?\s*EASY_END\s*\]/i);
  const easyText = easyMatch ? stripAllMarkers(easyMatch[1]) : null;
  const mainTextRaw = withoutAction.replace(/\[\s*EASY_START\s*\][\s\S]*?\[\s*\/?\s*EASY_END\s*\]/gi, '').trim();
  const mainText = stripAllMarkers(mainTextRaw);

  if (!mainText && !easyText && !actionText) return null;

  const actionItems = actionText
    ? actionText.split('\n').map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
    : [];

  return (
    <div>
      {mainText && <RenderLines text={mainText} />}
      {actionItems.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50/80 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckSquare className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <p className="text-[13px] font-bold text-amber-800 tracking-wide font-serif">이렇게 행동하세요</p>
          </div>
          <ol className="space-y-3">
            {actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-700 text-white text-[10px] font-bold flex items-center justify-center font-serif">
                  {i + 1}
                </span>
                <p className="text-[14px] font-report text-zinc-800 leading-[1.9] tracking-wide">{item}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
      {easyText && (
        <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
          <p className="text-[12px] font-bold text-sky-700 mb-3 uppercase tracking-wider">💡 쉬운 설명 (초급)</p>
          <RenderLines text={easyText} className="[&_p]:text-sky-900" />
        </div>
      )}
    </div>
  );
};

// 대운 타임라인 섹션
const DaeunSection: React.FC<{
  section: ReportSection;
  saju: any[];
  daeun: any[];
}> = ({ section, daeun }) => {
  const currentYear = new Date().getFullYear();

  return (
    <div>
      {/* 대운 타임라인 스트립 */}
      <SummaryBox text={section.summary} />
      {daeun && daeun.length > 0 && (
        <div className="overflow-x-auto mb-5 -mx-1 px-1">
          <p className="text-[13px] font-bold text-amber-700 uppercase tracking-wide mb-2 font-serif">대운 타임라인</p>
          <div className="flex items-end gap-1.5 min-w-max pb-1 subpixel-antialiased">
            {daeun.filter((d: any) => (d.startAge ?? 0) <= 110).map((d: any, i: number) => {
              const start: number = d.startYear ?? (currentYear + 9999);
              const isCur = currentYear >= start && currentYear < start + 10;
              const isPast = currentYear >= start + 10;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`h-1 w-10 rounded-full ${isCur ? 'bg-amber-500' : isPast ? 'bg-amber-300/70' : 'bg-amber-200/60'}`} />
                  <div className={`px-2 py-1.5 rounded-lg text-center transition-all ${
                    isCur ? 'bg-amber-500 text-white ring-2 ring-amber-400/60 shadow-md' :
                    isPast ? 'bg-amber-100/85 text-amber-800 border border-amber-300/70' :
                    'bg-amber-50/90 text-amber-900 border border-amber-300/60'
                  }`}>
                    <p className="text-[14px] font-extrabold font-serif leading-none tracking-tight">{hanjaToHangul[d.stem] ?? d.stem ?? ''}{hanjaToHangul[d.branch] ?? d.branch ?? ''}</p>
                    <p className="text-[12px] mt-0.5 font-semibold opacity-95">{d.startAge}세</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="space-y-5 mt-5">
        {section.daeunBlocks && section.daeunBlocks.length > 0 ? (
          section.daeunBlocks.map((block, i) => {
            const daeunInfo = daeun?.[i];
            const daeunStartYear: number = daeunInfo?.startYear ?? (currentYear + 9999);
            const daeunEndYear: number = daeunStartYear + 10;
            const isCurrent = currentYear >= daeunStartYear && currentYear < daeunEndYear;
            const isPast = currentYear >= daeunEndYear;

            return (
              <div
                key={i}
                className={`rounded-2xl border p-4 transition-all ${
                  isCurrent
                    ? 'border-amber-500 bg-amber-600/10 ring-2 ring-amber-400/40 shadow-amber-200/60 shadow-lg'
                    : isPast
                    ? 'border-amber-200/40 bg-[#fffdf5]/40 opacity-80'
                    : 'border-amber-200/60 bg-[#fffdf5]/60'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[13px] font-bold font-serif px-2.5 py-0.5 rounded-full border ${
                    isCurrent ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {block.label}
                  </span>
                  {isCurrent && <span className="text-[12px] font-bold text-amber-600">★ 현재 대운</span>}
                  {isPast && <span className="text-[12px] text-zinc-500">과거</span>}
                </div>
                {block.lifeEvents.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {block.lifeEvents.map((ev, ei) => (
                      <span key={ei} className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <Star className="w-2.5 h-2.5" /> {ev.year}년 | {ev.description}
                      </span>
                    ))}
                  </div>
                )}
                <ContentText text={block.content} />
              </div>
            );
          })
        ) : (
          <ContentText text={section.content} />
        )}
      </div>
    </div>
  );
};

// 사주 원국 섹션 (HanjaBox 표)
const FourPillarsSection: React.FC<{ section: ReportSection; saju: any[] }> = ({ section, saju }) => {
  if (!saju || saju.length === 0) {
    return <div><SummaryBox text={section.summary} /><ContentText text={section.content} /></div>;
  }

  const pillars = ['시주', '일주', '월주', '년주'];
  const labels = ['時', '日', '月', '年'];

  return (
    <div>
      <SummaryBox text={section.summary} />
      {/* 4열 사주 표 */}
      <div className="grid grid-cols-4 gap-3 my-5">
        {[0, 1, 2, 3].map(i => {
          const p = saju[i];
          if (!p) return null;
          return (
            <div key={i} className="flex flex-col items-center gap-3 p-3 rounded-2xl border border-amber-200/60 bg-[#fffdf5]/70">
              <span className="text-[14px] font-bold text-amber-700 font-serif">{labels[i]}</span>
              <span className="text-[13px] text-zinc-600 font-serif">{pillars[i]}</span>
              <div className="flex flex-col gap-4 py-1">
                <HanjaBoxReport hanja={p.stem?.hanja ?? '?'} deity={p.stem?.deity} deityPosition="top" size="md" />
                <HanjaBoxReport hanja={p.branch?.hanja ?? '?'} deity={p.branch?.deity} deityPosition="bottom" size="md" />
              </div>
              <div className="text-center">
                <p className="text-[13px] text-zinc-600 font-serif">{p.stem?.hangul}{p.branch?.hangul}</p>
                <p className="text-[12px] text-zinc-500 font-serif">{p.stem?.hanja}{p.branch?.hanja}</p>
              </div>
            </div>
          );
        })}
      </div>
      {/* 오행 분포 파이차트 */}
      {(() => {
        const elData = calcElements(saju).filter(d => d.value > 0);
        const total = elData.reduce((s, d) => s + d.value, 0);
        if (total === 0) return null;
        return (
          <div className="mt-5 flex items-center gap-5 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/50">
            <SvgPieChart data={elData} />
            <div className="flex-1">
              <p className="text-[16px] font-bold text-amber-800 mb-2 font-serif">오행 분포 (8자 개항)</p>
              <div className="space-y-1.5">
                {elData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-[15px] text-zinc-700 w-20 font-serif">{d.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-amber-100/60">
                      <div className="h-full rounded-full" style={{ width: `${(d.value / total) * 100}%`, background: d.color }} />
                    </div>
                    <span className="text-[15px] text-zinc-600 w-5 text-right font-serif">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
      <ContentText text={section.content} />
    </div>
  );
};

// 일반 섹션 (텍스트만)
const GenericSection: React.FC<{ section: ReportSection }> = ({ section }) => (
  <div>
    <SummaryBox text={section.summary} />
    <ContentText text={section.content} />
  </div>
);

// ─── 일년운세 전용: 월별 상세 흐름 섹션 ───────────────────────────────────────
const MonthlySection: React.FC<{ section: ReportSection }> = ({ section }) => {
  const regex = /\[\s*MONTH_START\s*\]\s*([\s\S]*?)\s*\[\s*MONTH_CONTENT\s*\]([\s\S]*?)\[\s*MONTH_END\s*\]/g;
  const blocks: { label: string; content: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(section.content)) !== null) {
    blocks.push({ label: stripAllMarkers(m[1]).trim(), content: m[2].trim() });
  }

  if (blocks.length === 0) {
    return <GenericSection section={section} />;
  }

  const currentMonth = new Date().getMonth() + 1;

  return (
    <div>
      <SummaryBox text={section.summary} />
      <div className="space-y-4 mt-5">
        {blocks.map((b, i) => {
          const monthNumMatch = b.label.match(/(\d{1,2})\s*월/);
          const monthNum = monthNumMatch ? parseInt(monthNumMatch[1], 10) : (i + 1);
          const isCurrent = monthNum === currentMonth;
          return (
            <div
              key={i}
              className={`rounded-2xl border p-5 transition-all ${
                isCurrent
                  ? 'border-amber-500 bg-amber-50/90 ring-2 ring-amber-400/50 shadow-lg shadow-amber-200/40'
                  : 'border-amber-200/60 bg-[#fffdf5]/80'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[14px] font-extrabold font-serif px-3 py-1 rounded-full ${
                  isCurrent ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {b.label}
                </span>
                {isCurrent && <span className="text-[12px] font-bold text-amber-700">★ 이번 달</span>}
              </div>
              <RenderLines text={b.content} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── 섹션 라벨 맵 ─────────────────────────────────────────────────────────────
// 인생가이드북(프리미엄 리포트)용 — glossary는 최후미에 배치
const PREMIUM_SECTION_NAV = [
  { id: 'fourpillars', short: '원국' },
  { id: 'yongshin',   short: '용신' },
  { id: 'profile',    short: '핵심' },
  { id: 'daeun',      short: '대운' },
  { id: 'hapchung',   short: '합충' },
  { id: 'sinsal',     short: '신살' },
  { id: 'fortune',    short: '운세' },
  { id: 'fields',     short: '분야' },
  { id: 'concern',    short: '궁금' },
  { id: 'admin',      short: '제언' },
  { id: 'glossary',   short: '용어' },
];

// 프리미엄 일년운세 2026용 — Part I~IV 순서, glossary 최후미
const YEARLY_SECTION_NAV = [
  { id: 'chart',     short: '원국' },
  { id: 'answer',    short: '질문답변' },
  { id: 'yearly',    short: '연간운세' },
  { id: 'monthly',   short: '월별흐름' },
  { id: 'checklist', short: '체크리스트' },
  { id: 'glossary',  short: '용어' },
];

const PREMIUM_SECTION_NUMBERS: Record<string, string> = {
  fourpillars: '一', yongshin: '二', profile: '三', daeun: '四', hapchung: '五',
  sinsal: '六', fortune: '七', fields: '八', concern: '九', admin: '十', glossary: '十一',
};

const YEARLY_SECTION_NUMBERS: Record<string, string> = {
  chart: '一', answer: '二', yearly: '三', monthly: '四', checklist: '五', glossary: '六',
};

// 하위호환: 기존 참조 유지용
const SECTION_NAV = PREMIUM_SECTION_NAV;
const SECTION_NUMBERS = PREMIUM_SECTION_NUMBERS;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _retainSectionNav = SECTION_NAV;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _retainSectionNums = SECTION_NUMBERS;

const getYongshinCoverPalette = (yongshinText: string) => {
  const y = String(yongshinText || '');
  if (y.includes('목')) return { bg: 'linear-gradient(160deg, #eef6ec 0%, #e4efe2 52%, #d9e8d6 100%)', title: '#2f4a31', body: '#3e5b41', chip: '#4f6e52', chipBg: '#edf4ea', border: '#9fb49f' };
  if (y.includes('화')) return { bg: 'linear-gradient(160deg, #f9f1eb 0%, #f4e7dc 52%, #efdccc 100%)', title: '#6a3c21', body: '#7a4a2c', chip: '#8a5635', chipBg: '#fbf1e9', border: '#c5a58e' };
  if (y.includes('토')) return { bg: 'linear-gradient(160deg, #f6f2e8 0%, #efe8d8 52%, #e8deca 100%)', title: '#5c4b2f', body: '#6f5c3a', chip: '#7d6942', chipBg: '#f8f3e8', border: '#c1b08d' };
  if (y.includes('금')) return { bg: 'linear-gradient(160deg, #f3f4f6 0%, #eceef2 52%, #e5e8ec 100%)', title: '#3d4653', body: '#4f5967', chip: '#5a6473', chipBg: '#f5f7fa', border: '#adb7c3' };
  if (y.includes('수')) return { bg: 'linear-gradient(160deg, #edf3f9 0%, #e4edf6 52%, #dae6f2 100%)', title: '#2d4d67', body: '#3d5f7a', chip: '#4a6f8d', chipBg: '#edf4fb', border: '#9fb7cc' };
  return { bg: 'linear-gradient(160deg, #f7f2e8 0%, #efe8d7 52%, #e7ddc8 100%)', title: '#4c3d28', body: '#5e4d35', chip: '#6f5d41', chipBg: '#f7f1e3', border: '#b9a98a' };
};

// ─── 표지 페이지 ──────────────────────────────────────────────────────────────
const CoverPage: React.FC<{ inputData: ReportInputData; saju: any[]; yongshinData: any }> = ({ inputData, saju, yongshinData }) => {
  const isYearly = inputData.productType === 'yearly2026';
  const levelLabel = isYearly
    ? '프리미엄 2026 운세'
    : inputData.reportLevel === 'advanced' ? '고급 분석'
      : inputData.reportLevel === 'both' ? '초급+고급 병행'
      : '초급 분석';
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const palette = getYongshinCoverPalette(String(yongshinData?.yongshin || ''));

  // 사주 한자 표시 (년월일시)
  const pillarsHanja = saju.length >= 4
    ? saju.map(p => `${p.stem?.hanja ?? ''}${p.branch?.hanja ?? ''}`).join(' ')
    : '';

  const sub = isYearly
    ? `${inputData.name}님을 위한 2026년 한 해 전략 가이드`
    : `운명의 로드맵: ${inputData.name}님을 위한 전략적 통찰`;
  const mainTitle = isYearly
    ? `${inputData.name}님의 2026 연 운세`
    : '당신을 위한 인생가이드북';

  return (
    <div
      className="w-full min-h-[560px] rounded-2xl flex flex-col items-center justify-center gap-8 py-20 px-10"
      style={{ background: palette.bg }}
    >
      <div className="text-center space-y-2">
        <p className="text-sm font-serif" style={{ color: palette.body }}>
          {sub}
        </p>
        {isYearly && (
          <p className="text-xs font-serif tracking-[0.4em] uppercase" style={{ color: palette.chip }}>
            프리미엄 2026 운세
          </p>
        )}
        <h1 className="text-5xl font-serif leading-tight tracking-wide font-semibold" style={{ color: palette.title }}>
          {mainTitle}
        </h1>
      </div>

      {/* 고객명 */}
      <div className="text-center space-y-3">
        <p className="text-7xl font-handwriting tracking-[0.2em]" style={{ color: palette.title }}>
          {inputData.name}
        </p>
        <p className="text-lg font-serif" style={{ color: palette.body }}>
          {inputData.birthDate.replace(/-/g, '年').replace(/(\d{2})$/, '$1日').replace(/(\d{4}년)(\d{2}년)/, '$1$2月')}
          {' '}
          {inputData.unknownTime ? '' : inputData.birthTime + ' 생'}
        </p>
        {pillarsHanja && (
          <p className="text-sm font-serif tracking-[0.35em]" style={{ color: palette.body }}>{pillarsHanja}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-serif border px-4 py-1.5 rounded-full" style={{ color: palette.chip, background: palette.chipBg, borderColor: palette.border }}>
          {levelLabel}
        </span>
        <span className="text-sm font-serif" style={{ color: palette.body }}>{today}</span>
      </div>
    </div>
  );
};

// ─── 메인 프리뷰 컴포넌트 ─────────────────────────────────────────────────────

interface PremiumReportPreviewProps {
  inputData: ReportInputData;
  sections: ReportSection[];
  sajuData: any[];
  daeunData: any[];
  yongshinData: any;
  onBack: () => void;
  user: FirebaseUser;
  onLogout: () => void;
  onSaveReport?: (pdfUrl: string) => Promise<void>;
}

export const PremiumReportPreview: React.FC<PremiumReportPreviewProps> = ({
  inputData,
  sections,
  sajuData,
  daeunData,
  yongshinData,
  onBack,
  user,
  onLogout,
  onSaveReport,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [storageUploading, setStorageUploading] = useState(false);
  const isPremiumE2EMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2e') === 'premium';

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> => {
    return await new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      promise
        .then((value) => {
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  };

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isYearlyProduct = inputData.productType === 'yearly2026';
  const activeSectionNav = isYearlyProduct ? YEARLY_SECTION_NAV : PREMIUM_SECTION_NAV;
  const activeSectionNumbers = isYearlyProduct ? YEARLY_SECTION_NUMBERS : PREMIUM_SECTION_NUMBERS;

  const getSectionComponent = (section: ReportSection) => {
    switch (section.id) {
      case 'fourpillars': return <FourPillarsSection section={section} saju={sajuData} />;
      case 'daeun':       return <DaeunSection section={section} saju={sajuData} daeun={daeunData} />;
      case 'hapchung':    return <HapchungSection section={section} saju={sajuData} />;
      case 'fields':      return <FieldsSection section={section} />;
      case 'monthly':     return <MonthlySection section={section} />;
      default:            return <GenericSection section={section} />;
    }
  };

  const handlePdf = async () => {
    if (!printRef.current) return;
    setPdfLoading(true);
    try {
      // Let the loading state paint before starting heavy work.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await document.fonts.ready;

      // ── HTML 직렬화 (자급자족 문서) ─────────────────────────────────
      // 로컬 CSS(vercel.app/assets/...)는 Puppeteer request interception에서 차단되므로
      // 클라이언트에서 미리 fetch해서 <style>에 인라인으로 포함한다.
      const allLinkEls = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
      // Google Fonts는 Puppeteer에서도 허용되므로 <link>로 유지
      const googleFontLinks = allLinkEls
        .filter(l => l.href.includes('fonts.googleapis.com'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`)
        .join('\n');
      // 한자(甲乙丙丁...) 글리프 누락 방지를 위해 CJK 폰트를 강제 포함
      const hanjaFallbackFontLink = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;700&display=block">';
      // 나머지(Vite 번들 CSS 등)는 fetch해서 인라인화
      const localCssResults = await Promise.allSettled(
        allLinkEls
          .filter(l => !l.href.includes('fonts.googleapis.com'))
          .map(l => fetch(l.href).then(r => r.ok ? r.text() : '').catch(() => ''))
      );
      const fetchedCss = localCssResults.map(r => r.status === 'fulfilled' ? r.value : '').join('\n');
      const inlineStyles = Array.from(document.querySelectorAll('style'))
        .map((s) => s.textContent ?? '')
        .join('\n');
      const printCss = `
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #f5efe0; overflow: visible !important; }
        body, [data-pdf-root] { font-family: "MaruBuri", "Nanum Myeongjo", "Noto Serif SC", "Apple SD Gothic Neo", "Malgun Gothic", serif !important; }
        [data-pdf-root] { overflow: visible !important; height: auto !important; max-height: none !important; }
        [data-pdf-block] { page-break-inside: auto; break-inside: auto; margin-bottom: 5mm; }
        [data-pdf-block="dashboard"], [data-pdf-block="separator"], [data-pdf-block="fourpillars"], [data-pdf-block="daeun"], [data-pdf-block="hapchung"], [data-pdf-block="fields"] { page-break-inside: avoid; break-inside: avoid-page; }
        [data-pdf-block="cover"] { page-break-after: always; break-after: page; }
      `;
      const serializedHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=794">
  ${googleFontLinks}
  ${hanjaFallbackFontLink}
  <style>${fetchedCss}\n${inlineStyles}\n${printCss}</style>
</head>
<body>
${printRef.current.outerHTML}
</body>
</html>`;
      // ────────────────────────────────────────────────────────────────

      const safeName = inputData.name.replace(/[^\w가-힣]/g, '_');
      const fileName = isYearlyProduct
        ? `프리미엄_2026_운세_${safeName}_${inputData.birthDate}`
        : `인생네비게이션_${safeName}_${inputData.birthDate}`;

      const pdfToken = import.meta.env.VITE_PDF_API_TOKEN ?? '';
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(pdfToken ? { 'X-PDF-Token': pdfToken } : {}),
        },
        body: JSON.stringify({ html: serializedHtml, fileName }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`API 오류 ${response.status}: ${detail}`);
      }

      const pdfBlob = await response.blob();
      const uploadedFromPdfApi = String(response.headers.get('X-PDF-Storage-URL') || '');

      // 로컬 다운로드
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${fileName}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);

      if (isPremiumE2EMode) {
        setPdfUrl('https://example.com/e2e-premium-report.pdf');
        return;
      }

      // generate-pdf 서버에서 스토리지 업로드 URL을 반환하면 사용
      if (uploadedFromPdfApi) {
        setPdfUrl(uploadedFromPdfApi);
        return;
      }

      // 서버 업로드 실패 시 오류 사유를 헤더에서 읽어 표시
      const storageErrMsg = String(response.headers.get('X-PDF-Storage-Error') || '서버 업로드 미완료');
      console.warn('서버 스토리지 업로드 실패:', storageErrMsg);
      setPdfUrl(null);
      alert(`PDF 로컬 다운로드는 완료되었습니다.\n서버 저장에 실패해 검수 완료 저장을 진행할 수 없습니다.\n\n오류: ${storageErrMsg}\n\nPDF 버튼을 다시 눌러 재시도해주세요.`);
    } catch (err) {
      console.error('PDF 생성 오류:', err);
      alert('PDF 생성 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!onSaveReport) return;
    if (!pdfUrl) {
      alert('먼저 PDF를 생성해주세요.');
      return;
    }
    setSaveLoading(true);
    try {
      await onSaveReport(pdfUrl);
    } catch (err) {
      console.error('검수 완료 저장 실패:', err);
      alert('검수 완료 저장 중 오류가 발생했습니다.');
    } finally {
      setSaveLoading(false);
    }
  };

  // glossary는 항상 최후미에 고정
  const orderedSectionsNoGlossary = activeSectionNav
    .filter(nav => nav.id !== 'glossary')
    .map(nav => sections.find(s => s.id === nav.id))
    .filter(Boolean) as ReportSection[];

  // activeSectionNav에도 cover에도 glossary에도 매핑되지 않은 섹션 (fallback raw 등)
  const unknownSections = sections.filter(s =>
    s.id !== 'cover' &&
    s.id !== 'glossary' &&
    !activeSectionNav.find(n => n.id === s.id)
  );

  const glossarySection = sections.find(s => s.id === 'glossary') || null;

  const allDisplaySections: ReportSection[] = [
    ...orderedSectionsNoGlossary,
    ...unknownSections,
    ...(glossarySection ? [glossarySection] : []),
  ];

  return (
    <div className="h-screen overflow-y-auto bg-[#e8dcc8]">
      {/* ── 상단 고정 네비바 ── */}
      <nav
        className="sticky top-0 z-40 flex items-center gap-2 px-4 py-2 overflow-x-auto hide-scrollbar"
        style={{ background: 'rgba(45,26,0,0.92)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-200 hover:text-white border border-amber-800/60 hover:border-amber-500 transition-all flex-shrink-0 mr-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 수정
        </button>

        <div className="w-px h-5 bg-amber-800/50 flex-shrink-0" />

        {activeSectionNav.map(nav => {
          const exists = sections.find(s => s.id === nav.id);
          return (
            <button
              key={nav.id}
              onClick={() => scrollToSection(nav.id)}
              disabled={!exists}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex-shrink-0 ${
                exists
                  ? 'text-amber-200 hover:text-white hover:bg-amber-800/50 border border-transparent hover:border-amber-700'
                  : 'text-amber-900/40 cursor-not-allowed'
              }`}
            >
              {nav.short}
            </button>
          );
        })}

        <div className="w-px h-5 bg-amber-800/50 flex-shrink-0 ml-1" />

        <button
          onClick={() => { void handlePdf(); }}
          disabled={pdfLoading || storageUploading || saveLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 transition-all flex-shrink-0 shadow-lg disabled:opacity-60"
        >
          {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {storageUploading ? '업로드 중...' : 'PDF'}
        </button>

        {onSaveReport && (
          <button
            onClick={() => { void handleSaveReport(); }}
            disabled={saveLoading || pdfLoading || storageUploading || !pdfUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all flex-shrink-0 shadow-lg disabled:opacity-50"
          >
            {saveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
            검수 완료 저장
          </button>
        )}

        <div className="flex-1" />

        <button onClick={onLogout} className="text-amber-900/50 hover:text-amber-200 transition-colors flex-shrink-0">
          <LogOut className="w-4 h-4" />
        </button>
      </nav>

      {/* ── 본문 A4 영역 ── */}
      <div className="max-w-[794px] mx-auto py-8 px-4">
        <div
          ref={printRef}
          data-pdf-root="true"
          className="relative rounded-2xl overflow-hidden shadow-2xl shadow-amber-900/20"
          style={{ background: 'linear-gradient(160deg, #f9f3e3 0%, #f0e8d0 50%, #ede0c4 100%)' }}
        >
          {/* SVG 화선지 노이즈 오버레이 */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06] rounded-2xl"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '150px 150px',
            }}
          />

          <div className="relative z-10 p-10 space-y-12">
            {/* 표지 */}
            <div data-pdf-block="cover">
              <CoverPage inputData={inputData} saju={sajuData ?? []} yongshinData={yongshinData} />
            </div>

            {/* 핵심 대시보드 */}
            <div data-pdf-block="dashboard">
              <DashboardCard inputData={inputData} daeun={daeunData ?? []} yongshin={yongshinData} />
            </div>

            {/* 섹션 구분선 */}
            <div data-pdf-block="separator" className="flex items-center gap-3 opacity-40">
              <div className="flex-1 h-px bg-amber-700" />
              <Scroll className="w-4 h-4 text-amber-800" />
              <div className="flex-1 h-px bg-amber-700" />
            </div>

            {/* 각 섹션 렌더링 */}
            {allDisplaySections.map((section) => (
              <div
                key={section.id}
                data-pdf-block={section.id}
                ref={el => { sectionRefs.current[section.id] = el; }}
                className="rounded-2xl border border-amber-200/60 bg-[#fffdf5]/70 p-8 shadow-sm shadow-amber-900/5"
                style={{ scrollMarginTop: '52px' }}
              >
                <SectionTitle number={activeSectionNumbers[section.id]}>
                  {section.title}
                </SectionTitle>
                {getSectionComponent(section)}
              </div>
            ))}

            {/* 하단 저작권 */}
            <div data-pdf-block="footer" className="text-center py-6 border-t border-amber-300/40 space-y-1">
              <p className="text-xs font-serif text-amber-800/50">
                {isYearlyProduct ? '프리미엄 2026 운세' : '인생 네비게이션 사주명리 분석서'}
              </p>
              <p className="text-[10px] text-amber-700/40">본 분석서는 AI 기반 사주명리 시스템으로 제작되었습니다. 참고용으로만 활용하세요.</p>
              <p className="text-[10px] text-amber-700/30">© {new Date().getFullYear()} UI Saju · {user.email}</p>
            </div>
          </div>
        </div>

        {/* PDF URL 표시 */}
        {pdfUrl && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-800">PDF 저장 완료</p>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 underline break-all">{pdfUrl}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
