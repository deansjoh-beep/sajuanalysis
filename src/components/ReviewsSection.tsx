import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Star, Quote, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';

export interface ReviewDoc {
  id: string;
  authorName: string;
  content: string;
  rating: number;
  imageUrls: string[];
  sourcePage: string;
  adminReply: string;
  adminRepliedAt: Timestamp | null;
  createdAt: Timestamp;
}

interface ReviewsSectionProps {
  onWriteReview: () => void;
}

const StarRow: React.FC<{ rating: number; size?: string }> = ({ rating, size = 'w-4 h-4' }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(s => (
      <Star
        key={s}
        className={`${size} transition-colors ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-300 fill-zinc-100'}`}
      />
    ))}
  </div>
);

const PAGE_SIZE = 8;

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ onWriteReview }) => {
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // composite index 없이 단일 where 필터로 조회 후 클라이언트 정렬
        const q = query(
          collection(db, 'reviews'),
          where('status', '==', 'approved'),
          limit(PAGE_SIZE * 3), // 여유 있게 fetch 후 client-side 정렬
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          const docs = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as ReviewDoc & { approvedAt?: Timestamp }))
            .sort((a, b) => {
              const aTs = (a as any).approvedAt?.toMillis?.() ?? 0;
              const bTs = (b as any).approvedAt?.toMillis?.() ?? 0;
              return bTs - aTs;
            })
            .slice(0, PAGE_SIZE);
          setReviews(docs);
        }
      } catch (err) {
        console.warn('[ReviewsSection] failed to load reviews:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'right' ? 320 : -320, behavior: 'smooth' });
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <section className="space-y-5 md:space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] md:text-[18px] font-bold text-zinc-900">고객 후기</h2>
            {reviews.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                {reviews.length}건
              </span>
            )}
          </div>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <StarRow rating={Math.round(Number(avgRating))} />
              <span className="text-[13px] font-bold text-amber-500">{avgRating}</span>
              <span className="text-[11px] text-zinc-500">/ 5.0</span>
            </div>
          )}
        </div>
        <button
          onClick={onWriteReview}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[13px] font-bold shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700 transition-all"
        >
          <Star className="w-4 h-4 fill-white" />
          후기 남기기
        </button>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 후기 없음 */}
      {!loading && reviews.length === 0 && (
        <div className="rounded-[2rem] border border-white/50 bg-white/45 backdrop-blur-xl p-8 md:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <Star className="w-7 h-7 text-amber-400 fill-amber-400" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-zinc-900">첫 번째 후기를 남겨보세요!</h3>
            <p className="text-[13px] text-zinc-500 mt-1">소중한 경험을 공유해 주시면 큰 힘이 됩니다.</p>
          </div>
          <button
            onClick={onWriteReview}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-[13px] hover:bg-indigo-700 transition-colors"
          >
            후기 남기기
          </button>
        </div>
      )}

      {/* 후기 목록 — 가로 스크롤 */}
      {!loading && reviews.length > 0 && (
        <div className="relative">
          {/* 스크롤 버튼 */}
          <button
            onClick={() => scroll('left')}
            className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 border border-white/60 shadow-lg flex items-center justify-center hover:bg-white transition-colors md:flex hidden"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-700" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 border border-white/60 shadow-lg flex items-center justify-center hover:bg-white transition-colors md:flex hidden"
          >
            <ChevronRight className="w-5 h-5 text-zinc-700" />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-3 hide-scrollbar snap-x snap-mandatory"
          >
            {reviews.map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                onImageClick={setSelectedImage}
              />
            ))}
          </div>
        </div>
      )}

      {/* 이미지 라이트박스 */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="후기 이미지"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <span className="text-white text-xl font-bold">✕</span>
          </button>
        </div>
      )}
    </section>
  );
};

const ReviewCard: React.FC<{
  review: ReviewDoc;
  onImageClick: (url: string) => void;
}> = ({ review, onImageClick }) => {
  const dateStr = review.createdAt?.toDate
    ? review.createdAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="shrink-0 w-72 snap-start rounded-[1.8rem] border border-white/50 bg-white/60 backdrop-blur-xl shadow-xl shadow-zinc-300/20 p-5 space-y-3 flex flex-col">
      {/* 별점 + 날짜 */}
      <div className="flex items-center justify-between">
        <StarRow rating={review.rating} size="w-4 h-4" />
        <span className="text-[11px] text-zinc-400">{dateStr}</span>
      </div>

      {/* 인용 아이콘 + 내용 */}
      <div className="flex-1 space-y-2">
        <Quote className="w-5 h-5 text-indigo-300" />
        <p className="text-[13px] text-zinc-700 leading-relaxed line-clamp-4">{review.content}</p>
      </div>

      {/* 이미지 */}
      {review.imageUrls?.length > 0 && (
        <div className="flex gap-2">
          {review.imageUrls.map((url, idx) => (
            <button
              key={idx}
              onClick={() => onImageClick(url)}
              className="w-14 h-14 rounded-xl overflow-hidden border border-white/60 shrink-0 hover:scale-105 transition-transform"
            >
              <img src={url} alt={`후기 사진 ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* 관리자 답글 */}
      {review.adminReply && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold text-indigo-700">유아이 답글</span>
          </div>
          <p className="text-[12px] text-indigo-800 leading-relaxed">{review.adminReply}</p>
        </div>
      )}

      {/* 작성자 */}
      <div className="pt-1 border-t border-zinc-100">
        <span className="text-[11px] font-bold text-zinc-500">{review.authorName}</span>
      </div>
    </div>
  );
};
