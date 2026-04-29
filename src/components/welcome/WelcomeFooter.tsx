import { ExternalLink } from 'lucide-react';

interface BlogPostLite {
  id: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  content?: string;
}

interface WelcomeFooterProps {
  recommendedPosts: BlogPostLite[];
  onPostClick: (post: BlogPostLite) => void;
  onOpenBlog: () => void;
  onOpenChat: () => void;
  onOpenReport: () => void;
}

/**
 * 랜딩 푸터 — 블로그 추천 / 다른 방식 진입(1:1·리포트) / 외부 도구 링크.
 * 본문은 메시지에 집중시키고, 부수 진입은 모두 여기로 모음.
 */
export function WelcomeFooter({
  recommendedPosts,
  onPostClick,
  onOpenBlog,
  onOpenChat,
  onOpenReport,
}: WelcomeFooterProps) {
  return (
    <footer className="relative px-4 py-16 md:py-20 border-t border-ink-300/30 bg-paper-100/30">
      <div className="max-w-6xl mx-auto space-y-14 md:space-y-16">
        {/* 다른 방식으로 살펴보기 */}
        <div className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h3 className="font-serif font-bold text-[16px] md:text-[18px] text-ink-900">
              다른 방식으로 살펴보기
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={onOpenChat}
              className="group text-left rounded-2xl border border-ink-300/25 bg-paper-50/60 p-5 md:p-6 hover:bg-paper-50/80 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-[10px] tracking-widest uppercase text-brush-gold font-bold mb-1">
                Conversation
              </p>
              <p className="font-serif font-bold text-[15px] md:text-[16px] text-ink-900 mb-1">
                1:1 상담으로 물어보기
              </p>
              <p className="text-[12px] text-ink-500 leading-relaxed">
                구체적인 고민을 글로 풀어 답을 받습니다.
              </p>
            </button>
            <button
              onClick={onOpenReport}
              className="group text-left rounded-2xl border border-ink-300/25 bg-paper-50/60 p-5 md:p-6 hover:bg-paper-50/80 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-[10px] tracking-widest uppercase text-brush-gold font-bold mb-1">
                Report
              </p>
              <p className="font-serif font-bold text-[15px] md:text-[16px] text-ink-900 mb-1">
                무료 리포트 분석 받기
              </p>
              <p className="text-[12px] text-ink-500 leading-relaxed">
                관심 주제를 입력하면 핵심 흐름을 정리해 드립니다.
              </p>
            </button>
          </div>
        </div>

        {/* 함께 읽기 (블로그) */}
        {recommendedPosts.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif font-bold text-[16px] md:text-[18px] text-ink-900">
                함께 읽기
              </h3>
              <button
                onClick={onOpenBlog}
                className="text-[12px] text-ink-500 hover:text-ink-900 underline underline-offset-4 decoration-ink-300/40"
              >
                전체 글 보기
              </button>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {recommendedPosts.slice(0, 4).map((post, idx) => (
                <li key={`${post.id}-${idx}`}>
                  <button
                    onClick={() => onPostClick(post)}
                    className="w-full text-left flex items-baseline gap-3 py-2 group hover:text-ink-900 transition-colors"
                  >
                    <span className="text-[10px] tabular-nums text-ink-500 shrink-0 mt-1">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[13px] md:text-[14px] text-ink-700 group-hover:text-ink-900 line-clamp-1 group-hover:underline underline-offset-4 decoration-ink-300/50">
                      {post.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 외부 도구 */}
        <div className="space-y-6">
          <h3 className="font-serif font-bold text-[16px] md:text-[18px] text-ink-900">
            특별 도구
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="https://k-manseryeok.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-2xl border border-ink-300/25 bg-paper-50/40 px-5 py-4 hover:bg-paper-50/70 transition-all"
            >
              <div>
                <p className="font-serif font-bold text-[14px] md:text-[15px] text-ink-900">
                  만세력 달력
                </p>
                <p className="text-[12px] text-ink-500 mt-0.5">
                  일진과 절기를 일정처럼
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-ink-500 group-hover:text-ink-900 group-hover:translate-x-0.5 transition-all" />
            </a>
            <a
              href="https://lucky-number-generator-deansjoh.replit.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-2xl border border-ink-300/25 bg-paper-50/40 px-5 py-4 hover:bg-paper-50/70 transition-all"
            >
              <div>
                <p className="font-serif font-bold text-[14px] md:text-[15px] text-ink-900">
                  사주별 행운 번호
                </p>
                <p className="text-[12px] text-ink-500 mt-0.5">
                  오늘 운세와 오행 조합
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-ink-500 group-hover:text-ink-900 group-hover:translate-x-0.5 transition-all" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
