import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, CheckCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';

/**
 * 매출·검수 패널 (Phase 2-5).
 * - 대시보드: 일별 매출·환불 + 생성 성공률·평균 원가·검증 실패율·검수 현황 (GET /api/payment/stats)
 * - 일일 샘플 검수: 오늘 생성분 무작위 10건 승인/반려 + 반려 사유 태깅
 *   (GET /api/code?adminSample=1, POST /api/code/review)
 * 인증: ADMIN_ACCESS_TOKEN(x-admin-token) — 세션 저장.
 */

interface DailyStatRow { date: string; orderCount: number; revenue: number; refunds: number }
interface AdminStats {
  daily: DailyStatRow[];
  totals: {
    revenue: number;
    orderCount: number;
    refundCount: number;
    generationSuccessRate: number | null;
    avgCostKrw: number | null;
    validationFailRate: number | null;
    reviewedCount: number;
    approvedCount: number;
  };
}
interface ReviewSample {
  reportId: string;
  code: string;
  product: string;
  content: string;
  qualityScore: number | null;
  createdAt: string;
}

const PRODUCT_LABEL: Record<string, string> = {
  premium: '평생 사주',
  yearly2026: '2026 일년운세',
  jobCareer: '직업·재물운',
  loveMarriage: '연애·결혼운',
};

const REJECT_TAGS = ['형식 오류', '근거 부족', '톤 부적절', '금칙어 위반', '기타'];

const CARD = 'rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-5';

const fmtKrw = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const fmtPct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);

export const SalesReviewPanel: React.FC = () => {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('adminApiToken') || '');
  const [tokenInput, setTokenInput] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [samples, setSamples] = useState<ReviewSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectTags, setRejectTags] = useState<string[]>([]);
  const [rejectNote, setRejectNote] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = { 'x-admin-token': authToken };
      const [statsRes, sampleRes] = await Promise.all([
        fetch('/api/payment/stats', { headers }),
        fetch('/api/code?adminSample=1', { headers }),
      ]);
      if (statsRes.status === 401 || sampleRes.status === 401) {
        sessionStorage.removeItem('adminApiToken');
        setToken('');
        throw new Error('토큰이 올바르지 않습니다. (서버 ADMIN_ACCESS_TOKEN과 일치해야 합니다)');
      }
      const statsData = await statsRes.json();
      const sampleData = await sampleRes.json();
      if (!statsRes.ok) throw new Error(statsData?.message || '통계를 불러오지 못했습니다.');
      if (!sampleRes.ok) throw new Error(sampleData?.message || '검수 샘플을 불러오지 못했습니다.');
      setStats(statsData.stats as AdminStats);
      setSamples(sampleData.samples as ReviewSample[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  const submitVerdict = async (reportId: string, verdict: 'approved' | 'rejected') => {
    setSubmitting(reportId);
    setError(null);
    try {
      const res = await fetch('/api/code/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({
          reportId,
          verdict,
          tags: verdict === 'rejected' ? rejectTags : [],
          note: verdict === 'rejected' ? rejectNote : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || '판정 저장에 실패했습니다.');
      setSamples((prev) => prev.filter((s) => s.reportId !== reportId));
      setRejecting(null);
      setRejectTags([]);
      setRejectNote('');
      if (stats) load(token); // 검수 현황 갱신
    } catch (e) {
      setError(e instanceof Error ? e.message : '판정 저장에 실패했습니다.');
    } finally {
      setSubmitting(null);
    }
  };

  if (!token) {
    return (
      <div className={`${CARD} max-w-md space-y-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-zinc-900">매출·검수</h2>
            <p className="text-[11px] text-zinc-500">관리자 API 토큰(ADMIN_ACCESS_TOKEN)을 입력하세요.</p>
          </div>
        </div>
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tokenInput.trim()) {
              sessionStorage.setItem('adminApiToken', tokenInput.trim());
              setToken(tokenInput.trim());
            }
          }}
          placeholder="관리자 토큰"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px]"
        />
        <button
          onClick={() => {
            if (!tokenInput.trim()) return;
            sessionStorage.setItem('adminApiToken', tokenInput.trim());
            setToken(tokenInput.trim());
          }}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-bold"
        >
          연결
        </button>
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>
    );
  }

  const t = stats?.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-zinc-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600" /> 매출·검수
        </h2>
        <button
          onClick={() => load(token)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-zinc-600 hover:bg-white/60 disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          새로고침
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-600">{error}</p>}

      {/* 요약 카드 */}
      {t && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '총 매출(환불 제외)', value: fmtKrw(t.revenue) },
            { label: '주문 · 환불', value: `${t.orderCount}건 · ${t.refundCount}건` },
            { label: '생성 성공률', value: fmtPct(t.generationSuccessRate) },
            { label: '평균 원가', value: t.avgCostKrw == null ? '—' : fmtKrw(t.avgCostKrw) },
            { label: '검증 실패율(80점 미만)', value: fmtPct(t.validationFailRate) },
            { label: '검수 누계', value: `${t.reviewedCount}건` },
            { label: '검수 승인율', value: t.reviewedCount > 0 ? fmtPct(t.approvedCount / t.reviewedCount) : '—' },
          ].map((c) => (
            <div key={c.label} className={CARD}>
              <p className="text-[11px] text-zinc-500">{c.label}</p>
              <p className="text-[16px] font-bold text-zinc-900 mt-1">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 일별 매출 */}
      {stats && (
        <div className={CARD}>
          <p className="text-[13px] font-bold text-zinc-800 mb-3">일별 매출 (최근 14일)</p>
          {stats.daily.length === 0 ? (
            <p className="text-[13px] text-zinc-500">아직 주문 데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-zinc-500 border-b border-zinc-200">
                    <th className="py-2 pr-4">날짜</th>
                    <th className="py-2 pr-4">주문</th>
                    <th className="py-2 pr-4">매출</th>
                    <th className="py-2">환불</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.daily.map((d) => (
                    <tr key={d.date} className="border-b border-zinc-100 text-zinc-700">
                      <td className="py-2 pr-4">{d.date}</td>
                      <td className="py-2 pr-4">{d.orderCount}건</td>
                      <td className="py-2 pr-4 font-bold">{fmtKrw(d.revenue)}</td>
                      <td className="py-2">{d.refunds}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 일일 샘플 검수 */}
      <div className={CARD}>
        <p className="text-[13px] font-bold text-zinc-800 mb-1">오늘의 샘플 검수</p>
        <p className="text-[11px] text-zinc-500 mb-4">
          오늘 생성된 리포트 중 미검수분 무작위 10건입니다. 승인 또는 반려(사유 태깅)로 판정하세요.
        </p>
        {samples.length === 0 ? (
          <p className="text-[13px] text-zinc-500">검수할 샘플이 없습니다. (오늘 생성분이 없거나 모두 검수 완료)</p>
        ) : (
          <div className="space-y-3">
            {samples.map((s) => (
              <div key={s.reportId} className="rounded-xl border border-zinc-200 bg-white/70 p-4">
                <button className="w-full text-left" onClick={() => setOpenId(openId === s.reportId ? null : s.reportId)}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-bold text-zinc-800">
                      {PRODUCT_LABEL[s.product] ?? s.product} · {s.code}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {s.qualityScore != null ? `품질 ${s.qualityScore}점 · ` : ''}
                      {new Date(s.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </button>

                {openId === s.reportId && (
                  <div className="mt-3 max-h-72 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-[13px] text-zinc-700 whitespace-pre-wrap">
                    {s.content}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => submitVerdict(s.reportId, 'approved')}
                    disabled={submitting === s.reportId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-40"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> 승인
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(rejecting === s.reportId ? null : s.reportId);
                      setRejectTags([]);
                      setRejectNote('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 text-rose-600 text-[11px] font-bold"
                  >
                    <XCircle className="w-3.5 h-3.5" /> 반려
                  </button>
                </div>

                {rejecting === s.reportId && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {REJECT_TAGS.map((tag) => (
                        <label key={tag} className="flex items-center gap-1.5 text-[11px] text-zinc-700">
                          <input
                            type="checkbox"
                            checked={rejectTags.includes(tag)}
                            onChange={(e) =>
                              setRejectTags((prev) => (e.target.checked ? [...prev, tag] : prev.filter((x) => x !== tag)))
                            }
                          />
                          {tag}
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="반려 사유 (선택)"
                      rows={2}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px]"
                    />
                    <button
                      onClick={() => submitVerdict(s.reportId, 'rejected')}
                      disabled={submitting === s.reportId || rejectTags.length === 0}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold disabled:opacity-40"
                    >
                      반려 확정 {rejectTags.length === 0 && '(태그 1개 이상 선택)'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
