import React, { Suspense } from 'react';
import { motion } from 'motion/react';
import { Image as ImageIcon, Save, X } from 'lucide-react';
import { BlogPost } from '../constants/blog';
import BlogMediaLibrary, { BlogMediaAsset } from './BlogMediaLibrary';

const LazyBlogRichEditor = React.lazy(() => import('./BlogRichEditor'));

interface BlogPostEditorPanelProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  post: Partial<BlogPost>;
  isUploading: boolean;
  isEditMode: boolean;
  mediaAssets: BlogMediaAsset[];
  isMediaLibraryLoading: boolean;
  mediaLibraryError: string | null;
  draftSavedLabel: string;
  editorPlaceholder: string;
  onClose: () => void;
  onPostChange: (nextPost: Partial<BlogPost>) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => void;
  onRefreshMedia: () => void;
  onSelectMedia: (asset: BlogMediaAsset) => void;
  onClearDraft: () => void;
  onSubmit: () => void;
}

const BlogPostEditorPanel: React.FC<BlogPostEditorPanelProps> = ({
  title,
  subtitle,
  submitLabel,
  post,
  isUploading,
  isEditMode,
  mediaAssets,
  isMediaLibraryLoading,
  mediaLibraryError,
  draftSavedLabel,
  editorPlaceholder,
  onClose,
  onPostChange,
  onImageUpload,
  onRefreshMedia,
  onSelectMedia,
  onClearDraft,
  onSubmit
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 md:p-12 rounded-[3rem] bg-white/60 backdrop-blur-2xl border border-white/60 space-y-8 shadow-2xl shadow-indigo-200/20"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-[16px] font-bold">{title}</h3>
          <p className="text-[11px] text-zinc-500">{subtitle}</p>
        </div>
        <button onClick={onClose} className="p-3 min-h-[44px] min-w-[44px] hover:bg-white/70 rounded-2xl transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-widest opacity-40 ml-2">제목</label>
          <input
            type="text"
            placeholder="글의 제목을 입력하세요"
            className="w-full p-5 min-h-[44px] rounded-2xl bg-white/70 backdrop-blur border border-white/65 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-[16px] transition-all"
            value={post.title || ''}
            onChange={(e) => onPostChange({ ...post, title: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest opacity-40 ml-2">카테고리</label>
            <select
              className="w-full p-5 min-h-[44px] rounded-2xl bg-white/70 backdrop-blur border border-white/65 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all"
              value={post.category || '사주기초'}
              onChange={(e) => onPostChange({ ...post, category: e.target.value })}
            >
              <option value="사주기초">사주기초</option>
              <option value="사주이야기">사주이야기</option>
              <option value="사주책리뷰">사주책리뷰</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest opacity-40 ml-2">이미지 (URL 또는 업로드)</label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="https://..."
                className="flex-1 p-5 min-h-[44px] rounded-2xl bg-white/70 backdrop-blur border border-white/65 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={post.imageUrl || ''}
                onChange={(e) => onPostChange({ ...post, imageUrl: e.target.value })}
              />
              <label className="cursor-pointer px-6 py-5 min-h-[44px] rounded-2xl bg-indigo-500/10 text-indigo-600 font-bold text-[11px] hover:bg-indigo-500/20 transition-all flex items-center gap-2 border border-indigo-500/20 backdrop-blur">
                <ImageIcon className="w-4 h-4" />
                {isUploading ? '업로드 중...' : '파일 선택'}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => onImageUpload(e, isEditMode)}
                  disabled={isUploading}
                />
              </label>
            </div>
            {post.imageUrl && (
              <div className="mt-4 relative h-40 rounded-2xl overflow-hidden border border-black/5">
                <img
                  src={post.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-[11px] font-bold uppercase tracking-widest">이미지 미리보기</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest opacity-40 ml-2">요약 (Excerpt)</label>
            <input
              type="text"
              placeholder="글의 짧은 요약을 입력하세요"
              className="w-full p-5 min-h-[44px] rounded-2xl bg-white/70 backdrop-blur border border-white/65 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={post.excerpt || ''}
              onChange={(e) => onPostChange({ ...post, excerpt: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest opacity-40 ml-2">읽기 시간 (예: 3분)</label>
            <input
              type="text"
              placeholder="3분"
              className="w-full p-5 min-h-[44px] rounded-2xl bg-white/70 backdrop-blur border border-white/65 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={post.readTime || ''}
              onChange={(e) => onPostChange({ ...post, readTime: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest opacity-40 ml-2">SEO 제목 (Meta Title)</label>
            <input
              type="text"
              placeholder="검색 결과에 표시될 제목"
              className="w-full p-4 min-h-[44px] rounded-2xl bg-white/70 backdrop-blur border border-white/65 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={post.seoTitle || ''}
              onChange={(e) => onPostChange({ ...post, seoTitle: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest opacity-40 ml-2">SEO 설명 (Meta Description)</label>
            <textarea
              placeholder="검색/공유 미리보기에 표시될 설명"
              className="w-full p-4 min-h-[88px] rounded-2xl bg-white/70 backdrop-blur border border-white/65 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-y"
              value={post.seoDescription || ''}
              onChange={(e) => onPostChange({ ...post, seoDescription: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest opacity-40 ml-2">OG 이미지 URL</label>
            <input
              type="text"
              placeholder="공유 썸네일 이미지 URL (비우면 대표 이미지 사용)"
              className="w-full p-4 min-h-[44px] rounded-2xl bg-white/70 backdrop-blur border border-white/65 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={post.ogImageUrl || ''}
              onChange={(e) => onPostChange({ ...post, ogImageUrl: e.target.value })}
            />
          </div>
        </div>
        <BlogMediaLibrary
          assets={mediaAssets}
          loading={isMediaLibraryLoading}
          error={mediaLibraryError}
          selectedUrl={post.imageUrl}
          onRefresh={onRefreshMedia}
          onSelect={onSelectMedia}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between ml-2">
            <label className="text-[11px] font-bold uppercase tracking-widest opacity-40">내용 (Rich Text / Markdown)</label>
          </div>
          <div className="prose-editor">
            <Suspense fallback={<div className="text-[11px] text-zinc-500 px-3 py-2">에디터 불러오는 중...</div>}>
              <LazyBlogRichEditor
                value={post.content || ''}
                onChange={(value) => onPostChange({ ...post, content: value })}
                placeholder={editorPlaceholder}
                minHeight="360px"
              />
            </Suspense>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
          <span>{draftSavedLabel}</span>
          <button
            type="button"
            onClick={onClearDraft}
            className="px-2 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50"
          >
            임시저장 삭제
          </button>
        </div>
        <button
          onClick={onSubmit}
          className="w-full py-5 min-h-[44px] rounded-[1.5rem] bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 text-[16px] active:scale-[0.98]"
        >
          <Save className="w-6 h-6" />
          {submitLabel}
        </button>
      </div>
    </motion.div>
  );
};

export default BlogPostEditorPanel;
