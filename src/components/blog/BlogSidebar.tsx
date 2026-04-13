import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import { BlogPost } from '../../constants/blog';

const BLOG_CATEGORIES = ['전체', '사주기초', '사주이야기', '사주책리뷰'];

interface BlogSidebarProps {
  blogCategory: string;
  popularPosts: BlogPost[];
  isAdmin: boolean;
  onBlogCategoryChange: (category: string) => void;
  onOpenAddPost: () => void;
  onPostClick: (post: BlogPost) => void;
}

export const BlogSidebar: React.FC<BlogSidebarProps> = ({
  blogCategory,
  popularPosts,
  isAdmin,
  onBlogCategoryChange,
  onOpenAddPost,
  onPostClick
}) => {
  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">글카테고리</h4>
          {isAdmin && (
            <button onClick={onOpenAddPost} className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95" title="새 글 작성">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 no-scrollbar px-1">
          {BLOG_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => onBlogCategoryChange(category)}
              className={`whitespace-nowrap text-left px-6 py-4 rounded-[1.25rem] text-sm font-bold transition-all duration-300 ${
                blogCategory === category
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 scale-[1.02]'
                  : 'bg-white/65 backdrop-blur hover:bg-white/85 text-zinc-600 hover:text-indigo-600 border border-white/65'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden lg:block space-y-8">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 px-2">최근 인기 글</h4>
        <div className="flex flex-col gap-6">
          {popularPosts.map((post) => (
            <button key={post.id} onClick={() => onPostClick(post)} className="group text-left space-y-2.5">
              <p className="text-sm font-bold leading-snug text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-2">{post.title}</p>
              <div className="flex items-center gap-2 opacity-40">
                <Calendar className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wider">{post.date}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};