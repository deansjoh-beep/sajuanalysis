import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, getDocs, updateDoc, doc, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Star, CheckCircle, XCircle, MessageCircle, Loader2, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, ImageIcon,
} from 'lucide-react';

interface ReviewDoc {
  id: string;
  authorName: string;
  content: string;
  rating: number;
  imageUrls: string[];
  sourcePage: string;
  status: 'pending' | 'approved' | 'rejected';
  adminReply: string;
  adminRepliedAt: Timestamp | null;
  createdAt: Timestamp;
  approvedAt: Timestamp | null;
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

const FILTER_LABELS: Record<FilterTab, string> = {
  all: '전체',
  pending: '대기중',
  approved: '승인됨',
  rejected: '거절됨',
};

const StarRow: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(s => (
      <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-300'}`} />
    ))}
  </div>
);

const STATUS_BADGE: Record<ReviewDoc['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};
const STATUS_LABEL: Record<ReviewDoc['status'], string> = {
  pending: '대기중',
  approved: '승인됨',
  rejected: '거절됨',
};

export const ReviewsPanel: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReviewDoc)));
    } catch (err: any) {
      setError('후기를 불러오지 못했습니다: ' + (err?.message ?? '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  const updateStatus = async (id: string, status: ReviewDoc['status']) => {
    setActionId(id);
    try {
      await updateDoc(doc(db, 'reviews', id), {
        status,
        ...(status === 'approved' ? { approvedAt: Timestamp.now() } : {}),
      });
      setReviews(prev => prev.map(r => r.id === id
        ? { ...r, status, ...(status === 'approved' ? { approvedAt: Timestamp.now() } : {}) }
        : r
      ));
    } catch (err: any) {
      alert('상태 변경 실패: ' + (err?.message ?? '오류'));
    } finally {
      setActionId(null);
    }
  };

  const saveReply = async (id: string) => {
    const reply = (replyDrafts[id] ?? '').trim();
    setSavingId(id);
    try {
      await updateDoc(doc(db, 'reviews', id), {
        adminReply: reply,
        adminRepliedAt: reply ? Timestamp.now() : null,
      });
      setReviews(prev => prev.map(r => r.id === id
        ? { ...r, adminReply: reply, adminRepliedAt: reply ? Timestamp.now() : null }
        : r
      ));
    } catch (err: any) {
      alert('답글 저장 실패: ' + (err?.message ?? '오류'));
    } finally {
      setSavingId(null);
    }
  };

  const filtered = filterTab === 'all' ? reviews : reviews.filter(r => r.status === filterTab);

  const counts: Record<FilterTab, number> = {
    all: reviews.length,
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shadow-lg">
            <Star className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-zinc-900">고객 후기 관리</h2>
            <p className="text-[11px] text-zinc-500">승인, 거절, 답글을 관리합니다.</p>
          </div>
        </div>
        <button
          onClick={() => { void loadReviews(); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/70 border border-zinc-200 text-[13px] font-bold text-zinc-600 hover:bg-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(FILTER_LABELS) as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all ${
              filterTab === tab
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/70 border border-zinc-200 text-zinc-600 hover:bg-white'
            }`}
          >
            {FILTER_LABELS[tab]}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              filterTab === tab ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'
            }`}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[13px]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* 비어 있음 */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-10 text-center space-y-2">
          <Star className="w-8 h-8 text-zinc-300 mx-auto" />
          <p className="text-[13px] text-zinc-500">해당 상태의 후기가 없습니다.</p>
        </div>
      )}

      {/* 후기 목록 */}
      {!loading && filtered.map(review => {
        const isExpanded = expandedId === review.id;
        const dateStr = review.createdAt?.toDate
          ? review.createdAt.toDate().toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '';

        return (
          <div
            key={review.id}
            className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl overflow-hidden"
          >
            {/* 요약 헤더 (항상 표시) */}
            <button
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/30 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : review.id)}
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <StarRow rating={review.rating} />
                  <span className="text-[13px] font-bold text-zinc-800">{review.authorName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_BADGE[review.status]}`}>
                    {STATUS_LABEL[review.status]}
                  </span>
                  {review.adminReply && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                      <MessageCircle className="w-3 h-3" /> 답글
                    </span>
                  )}
                  {review.imageUrls?.length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-bold">
                      <ImageIcon className="w-3 h-3" /> {review.imageUrls.length}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-zinc-700 line-clamp-2">{review.content}</p>
                <p className="text-[11px] text-zinc-400">{dateStr}</p>
              </div>
              <div className="shrink-0 pt-0.5">
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 text-zinc-400" />
                  : <ChevronDown className="w-4 h-4 text-zinc-400" />
                }
              </div>
            </button>

            {/* 상세 패널 (펼침 시) */}
            {isExpanded && (
              <div className="border-t border-zinc-100 p-4 space-y-4 bg-white/40">
                {/* 전문 */}
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">후기 전문</p>
                  <p className="text-[13px] text-zinc-800 leading-relaxed whitespace-pre-wrap">{review.content}</p>
                </div>

                {/* 이미지 */}
                {review.imageUrls?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">첨부 이미지</p>
                    <div className="flex gap-2 flex-wrap">
                      {review.imageUrls.map((url, i) => (
                        <button key={i} onClick={() => setLightboxUrl(url)}>
                          <img src={url} alt={`후기 이미지 ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-zinc-200 hover:scale-105 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2 flex-wrap">
                  {review.status !== 'approved' && (
                    <button
                      onClick={() => { void updateStatus(review.id, 'approved'); }}
                      disabled={actionId === review.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {actionId === review.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle className="w-4 h-4" />}
                      승인
                    </button>
                  )}
                  {review.status !== 'rejected' && (
                    <button
                      onClick={() => { void updateStatus(review.id, 'rejected'); }}
                      disabled={actionId === review.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-[13px] font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
                    >
                      {actionId === review.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <XCircle className="w-4 h-4" />}
                      거절
                    </button>
                  )}
                  {review.status === 'rejected' && (
                    <button
                      onClick={() => { void updateStatus(review.id, 'pending'); }}
                      disabled={actionId === review.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-[13px] font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      대기중으로 변경
                    </button>
                  )}
                </div>

                {/* 답글 작성 */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">관리자 답글</p>
                  <textarea
                    rows={3}
                    placeholder="고객에게 표시될 답글을 입력하세요... (비워두면 답글이 표시되지 않습니다)"
                    value={replyDrafts[review.id] ?? review.adminReply ?? ''}
                    onChange={e => setReplyDrafts(prev => ({ ...prev, [review.id]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white/80 text-[13px] text-zinc-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/70 transition-all resize-none leading-relaxed"
                  />
                  <button
                    onClick={() => { void saveReply(review.id); }}
                    disabled={savingId === review.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {savingId === review.id
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
                      : <><MessageCircle className="w-4 h-4" /> 답글 저장</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* 이미지 라이트박스 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="후기 이미지"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
            onClick={() => setLightboxUrl(null)}
          >
            <span className="text-white text-xl font-bold">✕</span>
          </button>
        </div>
      )}
    </div>
  );
};
