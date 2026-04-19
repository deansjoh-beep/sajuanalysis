import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { BlogPost } from '../../constants/blog';
import { BlogMediaAsset } from '../BlogMediaLibrary';
import BlogPostEditorPanel from '../BlogPostEditorPanel';

interface BlogAdminPanelProps {
  isAdmin: boolean;
  showAdminGate: boolean;
  allowedAdminEmails: string[];
  user: FirebaseUser | null;
  isLoggingIn: boolean;
  isAddingPost: boolean;
  isEditingPost: BlogPost | null;
  newPost: Partial<BlogPost>;
  isUploading: boolean;
  mediaLibrary: BlogMediaAsset[];
  isMediaLibraryLoading: boolean;
  mediaLibraryError: string | null;
  newPostDraftSavedLabel: string;
  editPostDraftSavedLabel: string;
  hasNewPostStoredDraft: boolean;
  visiblePostCount: number;
  totalPostCount: number;
  draftPostCount: number;
  searchQuery: string;
  sortOption: string;
  draftFilter: string;
  selectedCount: number;
  hasAllVisibleSelected: boolean;
  bulkCategory: string;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onDraftFilterChange: (value: string) => void;
  onBulkCategoryChange: (value: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onBulkCategoryApply: () => void;
  onBulkDeleteSelected: () => void;
  onOpenAddPost: () => void;
  onCloseAddPost: () => void;
  onNewPostChange: (nextPost: Partial<BlogPost>) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => void;
  onRefreshMedia: () => void;
  onSelectNewPostMedia: (asset: BlogMediaAsset) => void;
  onClearNewPostDraft: () => void;
  onAddPost: () => void;
  onCloseEditPost: () => void;
  onEditPostChange: (nextPost: Partial<BlogPost>) => void;
  onSelectEditPostMedia: (asset: BlogMediaAsset) => void;
  onClearEditPostDraft: () => void;
  onUpdatePost: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export const BlogAdminPanel: React.FC<BlogAdminPanelProps> = ({
  isAdmin,
  showAdminGate,
  allowedAdminEmails,
  user,
  isLoggingIn,
  isAddingPost,
  isEditingPost,
  newPost,
  isUploading,
  mediaLibrary,
  isMediaLibraryLoading,
  mediaLibraryError,
  newPostDraftSavedLabel,
  editPostDraftSavedLabel,
  hasNewPostStoredDraft,
  visiblePostCount,
  totalPostCount,
  draftPostCount,
  searchQuery,
  sortOption,
  draftFilter,
  selectedCount,
  hasAllVisibleSelected,
  bulkCategory,
  onSearchChange,
  onSortChange,
  onDraftFilterChange,
  onBulkCategoryChange,
  onSelectAllVisible,
  onClearSelection,
  onBulkCategoryApply,
  onBulkDeleteSelected,
  onOpenAddPost,
  onCloseAddPost,
  onNewPostChange,
  onImageUpload,
  onRefreshMedia,
  onSelectNewPostMedia,
  onClearNewPostDraft,
  onAddPost,
  onCloseEditPost,
  onEditPostChange,
  onSelectEditPostMedia,
  onClearEditPostDraft,
  onUpdatePost,
  onLogin,
  onLogout
}) => {
  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-xl p-6 md:p-8 shadow-xl shadow-indigo-200/15 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">관리자 운영 패널</p>
              <h3 className="text-[16px] font-bold">블로그 운영 도구</h3>
              <p className="text-[13px] text-zinc-500">검색, 정렬, 임시저장 필터로 글을 빠르게 관리할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-700">표시 {visiblePostCount}개</span>
              <span className="px-3 py-2 rounded-xl bg-zinc-100 text-zinc-700">전체 {totalPostCount}개</span>
              <span className="px-3 py-2 rounded-xl bg-amber-100 text-amber-700">수정 임시저장 {draftPostCount}개</span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.9fr_0.9fr] gap-4">
            <label className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="제목, 요약, 카테고리로 검색"
                className="w-full bg-transparent outline-none text-[13px]"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
              <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
              <select value={sortOption} onChange={(e) => onSortChange(e.target.value)} className="w-full bg-transparent outline-none text-[13px]">
                <option value="latest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="popular">조회수순</option>
                <option value="title">제목순</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
              <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
              <select value={draftFilter} onChange={(e) => onDraftFilterChange(e.target.value)} className="w-full bg-transparent outline-none text-[13px]">
                <option value="all">전체 글</option>
                <option value="draft-only">임시저장 있는 글만</option>
                <option value="without-draft">임시저장 없는 글만</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="px-3 py-1.5 rounded-xl bg-white text-indigo-700 border border-indigo-100">선택 {selectedCount}개</span>
              <button
                type="button"
                onClick={onSelectAllVisible}
                className="px-3 py-1.5 rounded-xl bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"
              >
                {hasAllVisibleSelected ? '전체 선택 해제' : '현재 목록 전체 선택'}
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                disabled={selectedCount === 0}
                className="px-3 py-1.5 rounded-xl bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                선택 해제
              </button>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={bulkCategory}
                  onChange={(e) => onBulkCategoryChange(e.target.value)}
                  className="min-w-[180px] px-3 py-2 rounded-xl bg-white border border-zinc-200 text-[13px]"
                >
                  <option value="사주기초">사주기초</option>
                  <option value="사주이야기">사주이야기</option>
                  <option value="사주책리뷰">사주책리뷰</option>
                </select>
                <button
                  type="button"
                  onClick={onBulkCategoryApply}
                  disabled={selectedCount === 0}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  카테고리 일괄 변경
                </button>
              </div>
              <button
                type="button"
                onClick={onBulkDeleteSelected}
                disabled={selectedCount === 0}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                선택 글 삭제
              </button>
            </div>
          </div>

          {hasNewPostStoredDraft && !isAddingPost && (
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-4">
              <div>
                <p className="text-[13px] font-bold text-amber-900">임시저장된 새 글이 있습니다.</p>
                <p className="text-[11px] text-amber-700">버튼을 누르면 작성 화면을 다시 열고 이어서 쓸 수 있습니다.</p>
              </div>
              <button onClick={onOpenAddPost} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-[13px] font-bold hover:bg-amber-600 transition-colors">
                이어서 작성
              </button>
            </div>
          )}
        </div>
      )}

      {isAddingPost && (
        <BlogPostEditorPanel
          title="새 블로그 글 작성"
          subtitle="당신의 지혜를 세상과 공유하세요."
          submitLabel="게시물 저장하기"
          post={newPost}
          isUploading={isUploading}
          isEditMode={false}
          mediaAssets={mediaLibrary}
          isMediaLibraryLoading={isMediaLibraryLoading}
          mediaLibraryError={mediaLibraryError}
          draftSavedLabel={newPostDraftSavedLabel}
          editorPlaceholder="본문을 작성하세요. 표, 체크리스트, 링크, 이미지, 코드블록을 사용할 수 있습니다."
          onClose={onCloseAddPost}
          onPostChange={onNewPostChange}
          onImageUpload={onImageUpload}
          onRefreshMedia={onRefreshMedia}
          onSelectMedia={onSelectNewPostMedia}
          onClearDraft={onClearNewPostDraft}
          onSubmit={onAddPost}
        />
      )}

      {isEditingPost && (
        <BlogPostEditorPanel
          title="블로그 글 수정"
          subtitle="기존의 지혜를 다듬어 보세요."
          submitLabel="수정 완료하기"
          post={isEditingPost}
          isUploading={isUploading}
          isEditMode
          mediaAssets={mediaLibrary}
          isMediaLibraryLoading={isMediaLibraryLoading}
          mediaLibraryError={mediaLibraryError}
          draftSavedLabel={editPostDraftSavedLabel}
          editorPlaceholder="내용을 입력하세요."
          onClose={onCloseEditPost}
          onPostChange={onEditPostChange}
          onImageUpload={onImageUpload}
          onRefreshMedia={onRefreshMedia}
          onSelectMedia={onSelectEditPostMedia}
          onClearDraft={onClearEditPostDraft}
          onSubmit={onUpdatePost}
        />
      )}

      {showAdminGate && (
        <div className="max-w-sm lg:max-w-none">
          {user ? (
            <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/20 space-y-4">
              <div className="flex items-center gap-2 text-indigo-600">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-widest">{isAdmin ? '관리자 모드' : '일반 사용자'}</span>
              </div>
              <div className="space-y-2 text-[11px] text-zinc-700 bg-white/80 border border-white rounded-xl p-3">
                <p><span className="font-bold">현재 로그인:</span> {user.email || '이메일 없음'}</p>
                {!isAdmin && (
                  <>
                    <p className="text-amber-700 font-semibold">관리자 계정으로 인식되지 않았습니다.</p>
                    <p className="text-zinc-600">아래 목록의 이메일 계정으로 로그인해야 관리자 권한이 활성화됩니다.</p>
                    <p className="break-all">{allowedAdminEmails.join(', ')}</p>
                  </>
                )}
              </div>
              <button onClick={onLogout} className="w-full py-3 rounded-xl bg-white text-[11px] font-bold hover:bg-zinc-50 transition-colors border border-black/5 shadow-sm">
                로그아웃
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-[2rem] bg-white border border-black/5 space-y-4 shadow-xl">
              <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">관리자 전용 게이트웨이입니다. 로그인하여 시스템을 관리하세요.</p>
              <button
                onClick={onLogin}
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? '로그인 중...' : '관리자 로그인'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};