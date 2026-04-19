import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { motion } from 'motion/react';
import { BlogPost } from '../../constants/blog';

interface BlogDetailViewProps {
  post: BlogPost;
  glassPanelStrongClass: string;
  onBackToList: () => void;
}

export const BlogDetailView: React.FC<BlogDetailViewProps> = ({ post, glassPanelStrongClass, onBackToList }) => {
  return (
    <motion.div
      key="blog-detail"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <button onClick={onBackToList} className="flex items-center gap-2 text-indigo-600 font-bold text-[13px] mb-4 hover:underline transition-all group">
        <div className="p-2 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </div>
        목록으로 돌아가기
      </button>

      <div className={`${glassPanelStrongClass} rounded-[3rem] overflow-hidden`}>
        <div className="relative h-64 md:h-[30rem]">
          <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 right-8 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-indigo-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg">{post.category}</span>
              <span className="text-[11px] text-white/70 font-medium">{post.date}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight text-white drop-shadow-lg">{post.title}</h1>
          </div>
        </div>
        <div className="p-8 md:p-16 space-y-10">
          <div className="markdown-body prose max-w-none text-base md:text-[16px] leading-relaxed text-zinc-700">
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
              {post.content.startsWith('# ') ? post.content.split('\n').slice(1).join('\n').trim() : post.content}
            </ReactMarkdown>
          </div>

          <div className="pt-10 border-t border-white/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-[11px]">UI</div>
              <div>
                <p className="text-[13px] font-bold">유아이 디렉터</p>
                <p className="text-[11px] opacity-40">전문 사주 분석가</p>
              </div>
            </div>
            <button onClick={onBackToList} className="px-6 py-2 min-h-[44px] rounded-xl bg-white/70 backdrop-blur border border-white/60 text-[11px] font-bold hover:bg-white/85 transition-colors">
              목록보기
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};