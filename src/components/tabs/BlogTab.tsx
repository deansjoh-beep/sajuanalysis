import React, { useEffect, useMemo, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { BLOG_POSTS, BlogPost } from '../../constants/blog';
import { BlogTabController } from '../../hooks/useBlogTabState';
import { BlogAdminPanel } from '../blog/BlogAdminPanel';
import { BlogDetailView } from '../blog/BlogDetailView';
import { BlogPostsGrid } from '../blog/BlogPostsGrid';
import { BlogSidebar } from '../blog/BlogSidebar';

const formatDraftSavedTime = (iso: string | null) => {
  if (!iso) return '임시저장 대기 중';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '임시저장 대기 중';
  return `임시저장: ${date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
};

interface BlogTabProps {
  tabTransition: any;
  glassTabBgClass: string;
  glassPanelStrongClass: string;
  blog: BlogTabController;
  isAdmin: boolean;
  allowedAdminEmails: string[];
  user: FirebaseUser | null;
  isLoggingIn: boolean;
  stripRichText: (content: string) => string;
  onLogin: () => void;
  onLogout: () => void;
}

export const BlogTab: React.FC<BlogTabProps> = ({
  tabTransition,
  glassTabBgClass,
  glassPanelStrongClass,
  blog,
  isAdmin,
  allowedAdminEmails,
  user,
  isLoggingIn,
  stripRichText,
  onLogin,
  onLogout
}) => {
  const PAGE_SIZE = 9;
  const LOAD_MORE_SIZE = 6;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('latest');
  const [draftFilter, setDraftFilter] = useState('all');
  const [bulkCategory, setBulkCategory] = useState('사주기초');
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const allPosts = blog.blogPosts.length > 0 ? blog.blogPosts : BLOG_POSTS;
  const popularPosts = allPosts.slice(0, 3);

  const draftPostIds = useMemo(() => {
    if (typeof window === 'undefined') return new Set<string>();
    const ids = new Set<string>(blog.editDraftPostIds);
    allPosts.forEach((post) => {
      if (localStorage.getItem(`${blog.editDraftKeyPrefix}${post.id}`)) {
        ids.add(post.id);
      }
    });
    return ids;
  }, [allPosts, blog.editDraftKeyPrefix, blog.editDraftPostIds, blog.editPostDraftSavedAt]);

  const filteredPosts = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    const categoryFiltered = allPosts.filter((post) => blog.blogCategory === '전체' || post.category === blog.blogCategory);
    const searched = categoryFiltered.filter((post) => {
      if (!search) return true;
      const target = [post.title, post.excerpt, post.category, stripRichText(post.content)].join(' ').toLowerCase();
      return target.includes(search);
    });

    const draftFiltered = searched.filter((post) => {
      const hasDraft = draftPostIds.has(post.id);
      if (draftFilter === 'draft-only') return hasDraft;
      if (draftFilter === 'without-draft') return !hasDraft;
      return true;
    });

    return [...draftFiltered].sort((a, b) => {
      if (sortOption === 'popular') return (b.views || 0) - (a.views || 0);
      if (sortOption === 'title') return a.title.localeCompare(b.title, 'ko');
      const timeA = a.createdAt?.toDate?.()?.getTime() || new Date(a.date).getTime();
      const timeB = b.createdAt?.toDate?.()?.getTime() || new Date(b.date).getTime();
      if (sortOption === 'oldest') return timeA - timeB;
      return timeB - timeA;
    });
  }, [allPosts, blog.blogCategory, draftFilter, draftPostIds, searchQuery, sortOption, stripRichText]);

  const paginatedPosts = useMemo(() => filteredPosts.slice(0, visibleCount), [filteredPosts, visibleCount]);
  const hasMorePosts = paginatedPosts.length < filteredPosts.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [blog.blogCategory, searchQuery, sortOption, draftFilter]);

  useEffect(() => {
    const availableIds = new Set(allPosts.map((post) => post.id));
    setSelectedPostIds((prev) => {
      const next = new Set([...prev].filter((id) => availableIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allPosts]);

  const visiblePostIds = useMemo(() => paginatedPosts.map((post) => post.id), [paginatedPosts]);
  const hasAllVisibleSelected = visiblePostIds.length > 0 && visiblePostIds.every((id) => selectedPostIds.has(id));

  const handleToggleSelect = (postId: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (hasAllVisibleSelected) {
        visiblePostIds.forEach((id) => next.delete(id));
      } else {
        visiblePostIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDeleteSelected = async () => {
    const targets = [...selectedPostIds];
    if (targets.length === 0) return;
    await blog.handleBulkDeletePosts(targets);
    setSelectedPostIds(new Set());
  };

  const handleBulkCategoryApply = async () => {
    const targets = [...selectedPostIds];
    if (targets.length === 0) return;
    await blog.handleBulkUpdateCategory(targets, bulkCategory);
    setSelectedPostIds(new Set());
  };

  return (
    <motion.div
      key="blog"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={tabTransition}
      className={`flex-1 overflow-y-auto p-4 md:p-8 hide-scrollbar ${glassTabBgClass}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
        <div className="absolute -left-10 top-8 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-indigo-300/25 blur-3xl" />
      </div>
      <div className={`relative z-10 mx-auto pb-20 ${blog.selectedBlogPost ? 'max-w-4xl' : 'max-w-7xl'}`}>
        <AnimatePresence mode="wait">
          {blog.selectedBlogPost ? (
            <BlogDetailView
              post={blog.selectedBlogPost}
              glassPanelStrongClass={glassPanelStrongClass}
              onBackToList={() => blog.setSelectedBlogPost(null)}
            />
          ) : (
            <motion.div
              key="blog-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              <div className="text-center py-16 space-y-4 relative overflow-hidden rounded-[3rem] border border-white/60 bg-gradient-to-br from-cyan-500/75 to-indigo-600/75 backdrop-blur-2xl p-10 shadow-2xl shadow-indigo-300/30">
                <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none">
                  <Sparkles className="w-full h-full text-white" />
                </div>
                <h2 className="text-4xl md:text-7xl font-handwriting text-white">유아이 사주 블로그</h2>
                <p className="text-[13px] md:text-[16px] text-indigo-100/70 max-w-2xl mx-auto">깊이 있는 사주 명리학 이야기와 당신의 삶을 위한 지혜를 만나보세요.</p>
              </div>

              <div className="flex flex-col lg:flex-row gap-12">
                <BlogSidebar
                  blogCategory={blog.blogCategory}
                  popularPosts={popularPosts}
                  isAdmin={isAdmin}
                  onBlogCategoryChange={blog.setBlogCategory}
                  onOpenAddPost={() => blog.setIsAddingPost(true)}
                  onPostClick={(post) => { void blog.handlePostClick(post); }}
                />

                <div className="flex-1 space-y-10">
                  <BlogAdminPanel
                    isAdmin={isAdmin}
                    showAdminGate={blog.showAdminGate}
                    allowedAdminEmails={allowedAdminEmails}
                    user={user}
                    isLoggingIn={isLoggingIn}
                    isAddingPost={blog.isAddingPost}
                    isEditingPost={blog.isEditingPost}
                    newPost={blog.newPost}
                    isUploading={blog.isUploading}
                    mediaLibrary={blog.mediaLibrary}
                    isMediaLibraryLoading={blog.isMediaLibraryLoading}
                    mediaLibraryError={blog.mediaLibraryError}
                    newPostDraftSavedLabel={formatDraftSavedTime(blog.newPostDraftSavedAt)}
                    editPostDraftSavedLabel={formatDraftSavedTime(blog.editPostDraftSavedAt)}
                    hasNewPostStoredDraft={blog.hasNewPostStoredDraft}
                    visiblePostCount={paginatedPosts.length}
                    totalPostCount={allPosts.length}
                    draftPostCount={draftPostIds.size}
                    searchQuery={searchQuery}
                    sortOption={sortOption}
                    draftFilter={draftFilter}
                    selectedCount={selectedPostIds.size}
                    hasAllVisibleSelected={hasAllVisibleSelected}
                    bulkCategory={bulkCategory}
                    onSearchChange={setSearchQuery}
                    onSortChange={setSortOption}
                    onDraftFilterChange={setDraftFilter}
                    onBulkCategoryChange={setBulkCategory}
                    onSelectAllVisible={handleSelectAllVisible}
                    onClearSelection={() => setSelectedPostIds(new Set())}
                    onBulkCategoryApply={() => { void handleBulkCategoryApply(); }}
                    onBulkDeleteSelected={() => { void handleBulkDeleteSelected(); }}
                    onOpenAddPost={() => blog.setIsAddingPost(true)}
                    onCloseAddPost={() => blog.setIsAddingPost(false)}
                    onNewPostChange={blog.setNewPost}
                    onImageUpload={blog.handleImageUpload}
                    onRefreshMedia={blog.loadMediaLibrary}
                    onSelectNewPostMedia={(asset) => blog.handleSelectMediaAsset(asset, false)}
                    onClearNewPostDraft={blog.clearNewPostDraft}
                    onAddPost={() => { void blog.handleAddPost(); }}
                    onCloseEditPost={() => blog.setIsEditingPost(null)}
                    onEditPostChange={(nextPost) => blog.setIsEditingPost(nextPost as BlogPost)}
                    onSelectEditPostMedia={(asset) => blog.handleSelectMediaAsset(asset, true)}
                    onClearEditPostDraft={blog.clearEditPostDraft}
                    onUpdatePost={() => { void blog.handleUpdatePost(); }}
                    onLogin={onLogin}
                    onLogout={onLogout}
                  />

                  <BlogPostsGrid
                    posts={paginatedPosts}
                    isAdmin={isAdmin}
                    selectedPostIds={selectedPostIds}
                    stripRichText={stripRichText}
                    onPostClick={(post) => { void blog.handlePostClick(post); }}
                    onStartEditPost={blog.setIsEditingPost}
                    onDeletePost={(postId) => { void blog.handleDeletePost(postId); }}
                    onToggleSelect={handleToggleSelect}
                  />

                  {hasMorePosts && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_SIZE)}
                        className="px-6 py-3 min-h-[44px] rounded-2xl bg-white/90 border border-white shadow-lg text-[13px] font-bold text-indigo-700 hover:bg-white"
                      >
                        더 보기 ({paginatedPosts.length}/{filteredPosts.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};