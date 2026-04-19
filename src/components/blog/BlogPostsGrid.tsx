import React from 'react';
import { ArrowRight, Calendar, Edit2, Newspaper, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { BlogPost } from '../../constants/blog';

interface BlogPostsGridProps {
  posts: BlogPost[];
  isAdmin: boolean;
  selectedPostIds: Set<string>;
  stripRichText: (content: string) => string;
  onPostClick: (post: BlogPost) => void;
  onStartEditPost: (post: BlogPost) => void;
  onDeletePost: (postId: string) => void;
  onToggleSelect: (postId: string) => void;
}

export const BlogPostsGrid: React.FC<BlogPostsGridProps> = ({ posts, isAdmin, selectedPostIds, stripRichText, onPostClick, onStartEditPost, onDeletePost, onToggleSelect }) => {
  if (posts.length === 0) {
    return (
      <div className="text-center py-40 opacity-20">
        <Newspaper className="w-20 h-20 mx-auto mb-6 text-indigo-500" />
        <p className="text-[16px] font-bold">조건에 맞는 글이 없습니다.</p>
        <p className="text-[13px] mt-2">검색어, 정렬, 필터를 다시 확인해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
      {posts.map((post) => (
        <motion.div
          key={post.id}
          whileHover={{ y: -10 }}
          className="relative w-full text-left rounded-[2.5rem] overflow-hidden bg-white border border-black/5 shadow-xl flex flex-col group transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10"
        >
          <div className="relative h-52 overflow-hidden cursor-pointer" onClick={() => onPostClick(post)}>
            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 rounded-full bg-indigo-600/90 text-white text-[11px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg">{post.category}</span>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(post.id);
                }}
                className={`absolute bottom-4 left-4 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-black transition-all ${
                  selectedPostIds.has(post.id)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white/95 border-white text-zinc-500 hover:border-indigo-300'
                }`}
                aria-label={`게시물 선택 ${post.title}`}
              >
                {selectedPostIds.has(post.id) ? '✓' : ''}
              </button>
            )}

            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEditPost(post);
                  }}
                  className="p-2.5 rounded-xl bg-white/90 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all backdrop-blur-md shadow-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePost(post.id);
                  }}
                  className="p-2.5 rounded-xl bg-white/90 text-red-500 hover:bg-red-500 hover:text-white transition-all backdrop-blur-md shadow-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="p-8 space-y-4 flex-1 flex flex-col">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
              <Calendar className="w-3 h-3" />
              <span>{post.date}</span>
            </div>
            <h3 className="font-bold text-[16px] leading-tight line-clamp-2 text-zinc-900 group-hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => onPostClick(post)}>
              {post.title}
            </h3>
            <p className="text-[13px] text-zinc-600 line-clamp-3 leading-relaxed flex-1">{stripRichText(post.content).slice(0, 120)}...</p>
            <button onClick={() => onPostClick(post)} className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-2 pt-4 group/btn">
              자세히 읽기
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
};