import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  LogOut,
  BookOpen,
  Newspaper,
  Compass,
  LayoutDashboard,
  Save,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Settings,
  Loader2,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { BLOG_POSTS } from '../../constants/blog';
import { DEFAULT_GUIDE_ABOUT, DEFAULT_GUIDE_TERMS, DEFAULT_GUIDE_PRIVACY, DEFAULT_GUIDE_CONTACT } from '../../constants/guideDefaults';
import { BlogTabController } from '../../hooks/useBlogTabState';
import { BlogAdminPanel } from '../blog/BlogAdminPanel';

const PremiumReportMakerPage = React.lazy(() =>
  import('./PremiumReportMakerPage').then((mod) => ({ default: mod.PremiumReportMakerPage }))
);

const LazyPremiumOrdersPanel = React.lazy(() =>
  import('../PremiumOrdersPanel').then((mod) => ({ default: mod.PremiumOrdersPanel }))
);

// Guideline document IDs in Firestore system_config collection
export const GUIDELINE_KEYS = {
  saju: 'guidelines_saju',
  consulting: 'guidelines_consulting',
  basicConsulting: 'guidelines_basic_consulting',
  advancedConsulting: 'guidelines_advanced_consulting',
  report: 'guidelines_report',
  basicReport: 'guidelines_basic_report',
  advancedReport: 'guidelines_advanced_report',
  guideAbout: 'guide_about',
  guideTerms: 'guide_terms',
  guidePrivacy: 'guide_privacy',
  guideContact: 'guide_contact',
} as const;

export type GuidelineKey = keyof typeof GUIDELINE_KEYS;

const GUIDELINE_LABELS: Record<GuidelineKey, string> = {
  saju: '간명 지침 (사주 감명)',
  consulting: '상담 지침 (공통)',
  basicConsulting: '초급 상담 지침',
  advancedConsulting: '고급 상담 지침',
  report: '리포트 작성 지침(공통)',
  basicReport: '초급 리포트 지침',
  advancedReport: '고급 리포트 지침',
  guideAbout: '소개 (About)',
  guideTerms: '이용약관 (Terms)',
  guidePrivacy: '개인정보 처리방침 (Privacy)',
  guideContact: '문의하기 (Contact)',
};

type AdminSection = 'dashboard' | 'guidelines' | 'blog' | 'guide_editor' | 'board' | 'report_maker' | 'premium_orders';

const getInitialAdminSection = (): AdminSection => {
  if (typeof window === 'undefined') return 'dashboard';
  const section = new URLSearchParams(window.location.search).get('section');
  const allowed: AdminSection[] = ['dashboard', 'guidelines', 'blog', 'guide_editor', 'board', 'report_maker', 'premium_orders'];
  return allowed.includes(section as AdminSection) ? (section as AdminSection) : 'dashboard';
};

interface AdminPageProps {
  user: FirebaseUser | null;
  isAdmin: boolean;
  isLoggingIn: boolean;
  allowedAdminEmails: string[];
  blog: BlogTabController;
  defaultGuidelines: Record<string, string>;
  onGuidelinesChange: (key: string, value: string) => void;
  onLogin: () => void;
  onLogout: () => void;
}

// Guideline Editor
const GuidelinesEditor: React.FC<{
  defaultGuidelines: Record<string, string>;
  onGuidelinesChange: (key: string, value: string) => void;
}> = ({ defaultGuidelines, onGuidelinesChange }) => {
  const [activeKey, setActiveKey] = useState<GuidelineKey>('saju');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStatuses, setSaveStatuses] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [saveMessages, setSaveMessages] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  const currentText = drafts[activeKey] ?? defaultGuidelines[activeKey] ?? '';

  const loadFromFirestore = useCallback(async (key: GuidelineKey) => {
    if (loaded[key]) return;
    try {
      const snap = await getDoc(doc(db, 'system_config', GUIDELINE_KEYS[key]));
      if (snap.exists()) {
        const content = snap.data()?.content ?? '';
        setDrafts(prev => ({ ...prev, [key]: content }));
        onGuidelinesChange(key, content);
      } else {
        setDrafts(prev => ({ ...prev, [key]: defaultGuidelines[key] ?? '' }));
      }
    } catch (err) {
      console.error('Failed to load guideline from Firestore:', err);
      setDrafts(prev => ({ ...prev, [key]: defaultGuidelines[key] ?? '' }));
    }
    setLoaded(prev => ({ ...prev, [key]: true }));
  }, [loaded, defaultGuidelines, onGuidelinesChange]);

  useEffect(() => {
    loadFromFirestore(activeKey);
  }, [activeKey]);

  const handleSave = async (key: GuidelineKey) => {
    const text = drafts[key] ?? defaultGuidelines[key] ?? '';
    setSaveStatuses(prev => ({ ...prev, [key]: 'saving' }));
    try {
      await setDoc(doc(db, 'system_config', GUIDELINE_KEYS[key]), {
        content: text,
        updatedAt: serverTimestamp(),
      });
      setSaveStatuses(prev => ({ ...prev, [key]: 'saved' }));
      setSaveMessages(prev => ({ ...prev, [key]: '저장 완료' }));
      onGuidelinesChange(key, text);
      setTimeout(() => setSaveStatuses(prev => ({ ...prev, [key]: 'idle' })), 3000);
    } catch (err: any) {
      setSaveStatuses(prev => ({ ...prev, [key]: 'error' }));
      setSaveMessages(prev => ({ ...prev, [key]: `저장 실패: ${err?.message ?? '알 수 없는 오류'}` }));
    }
  };

  const handleReset = (key: GuidelineKey) => {
    if (window.confirm('기본값(코드 내 원본)으로 되돌리겠습니까? Firestore의 저장값은 덮어씌워집니다.')) {
      setDrafts(prev => ({ ...prev, [key]: defaultGuidelines[key] ?? '' }));
    }
  };

  const saveStatus = saveStatuses[activeKey] ?? 'idle';
  const saveMessage = saveMessages[activeKey] ?? '';

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(GUIDELINE_LABELS) as GuidelineKey[]).filter(k => !k.startsWith('guide')).map(key => (
          <button
            key={key}
            onClick={() => setActiveKey(key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              activeKey === key
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                : 'bg-white/60 border-white/60 text-zinc-600 hover:border-indigo-300'
            }`}
          >
            {GUIDELINE_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-700">{GUIDELINE_LABELS[activeKey]}</h3>
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Loader2 className="w-3 h-3 animate-spin" /> 저장 중...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle className="w-3 h-3" /> {saveMessage}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-xs text-rose-600">
                <AlertCircle className="w-3 h-3" /> {saveMessage}
              </span>
            )}
            <button
              onClick={() => handleReset(activeKey)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200 transition-all"
            >
              <RotateCcw className="w-3 h-3" /> 기본값으로
            </button>
            <button
              onClick={() => handleSave(activeKey)}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-3 h-3" /> 저장
            </button>
          </div>
        </div>

        <textarea
          value={currentText}
          onChange={e => setDrafts(prev => ({ ...prev, [activeKey]: e.target.value }))}
          className="flex-1 min-h-[400px] w-full rounded-2xl border border-white/60 bg-white/70 backdrop-blur px-4 py-3 text-sm font-mono text-zinc-800 resize-y outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200/70 leading-relaxed"
          placeholder="지침 내용을 입력하세요..."
          spellCheck={false}
        />
        <p className="text-xs text-zinc-400">
          저장하면 즉시 AI 상담/리포트에 반영됩니다. 새로고침 없이 실시간 적용됩니다.
        </p>
      </div>
    </div>
  );
};

// Guide Page Editor (4 sub-pages)
type GuidePage = 'guideAbout' | 'guideTerms' | 'guidePrivacy' | 'guideContact';

const GUIDE_PAGE_LABELS: Record<GuidePage, string> = {
  guideAbout: '소개 (About)',
  guideTerms: '이용약관 (Terms)',
  guidePrivacy: '개인정보 처리방침 (Privacy)',
  guideContact: '문의하기 (Contact)',
};

const GuidePageEditor: React.FC<{
  onContentChange: (key: string, content: string) => void;
}> = ({ onContentChange }) => {
  const [activePage, setActivePage] = useState<GuidePage>('guideAbout');
  const [drafts, setDrafts] = useState<Record<GuidePage, string>>({
    guideAbout: DEFAULT_GUIDE_ABOUT,
    guideTerms: DEFAULT_GUIDE_TERMS,
    guidePrivacy: DEFAULT_GUIDE_PRIVACY,
    guideContact: DEFAULT_GUIDE_CONTACT,
  });
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const pages: GuidePage[] = ['guideAbout', 'guideTerms', 'guidePrivacy', 'guideContact'];
      const result: Partial<Record<GuidePage, string>> = {};
      await Promise.all(pages.map(async (page) => {
        try {
          const snap = await getDoc(doc(db, 'system_config', GUIDELINE_KEYS[page]));
          if (snap.exists()) {
            const content = snap.data()?.content ?? '';
            result[page] = content;
            onContentChange(page, content);
          }
        } catch {
          // ignore — keep empty
        }
      }));
      setDrafts(prev => ({ ...prev, ...result }));
      setLoaded(true);
    };
    void load();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await setDoc(doc(db, 'system_config', GUIDELINE_KEYS[activePage]), {
        content: drafts[activePage],
        updatedAt: serverTimestamp(),
      });
      setSaveStatus('saved');
      setSaveMessage('저장 완료');
      onContentChange(activePage, drafts[activePage]);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(`저장 실패: ${err?.message ?? '알 수 없는 오류'}`);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(GUIDE_PAGE_LABELS) as GuidePage[]).map(page => (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activePage === page
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/70 text-zinc-600 border border-zinc-200 hover:bg-indigo-50'
            }`}
          >
            {GUIDE_PAGE_LABELS[page]}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-700">{GUIDE_PAGE_LABELS[activePage]} (Markdown 지원)</h3>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" /> 저장 중...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="w-3 h-3" /> {saveMessage}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-rose-600">
              <AlertCircle className="w-3 h-3" /> {saveMessage}
            </span>
          )}
          <button
            onClick={() => { void handleSave(); }}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-3 h-3" /> 저장
          </button>
        </div>
      </div>
      <textarea
        value={drafts[activePage]}
        onChange={e => setDrafts(prev => ({ ...prev, [activePage]: e.target.value }))}
        className="min-h-[500px] w-full rounded-2xl border border-white/60 bg-white/70 backdrop-blur px-4 py-3 text-sm font-mono text-zinc-800 resize-y outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200/70 leading-relaxed"
        placeholder={`${GUIDE_PAGE_LABELS[activePage]} 내용을 마크다운으로 입력하세요...`}
        spellCheck={false}
      />
      <p className="text-xs text-zinc-400">
        마크다운 형식을 지원합니다. 저장 후 가이드 탭의 해당 페이지에 즉시 반영됩니다.
      </p>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard: React.FC<{ user: FirebaseUser; onNavigate: (s: AdminSection) => void }> = ({ user, onNavigate }) => {
  const cards = [
    {
      section: 'guidelines' as AdminSection,
      icon: BookOpen,
      color: 'from-indigo-500 to-violet-600',
      title: '상담/리포트 지침 관리',
      desc: '간명, 상담, 리포트 지침을 수정합니다.',
    },
    {
      section: 'blog' as AdminSection,
      icon: Newspaper,
      color: 'from-emerald-500 to-teal-600',
      title: '블로그 관리',
      desc: '블로그 글 작성, 수정, 삭제를 관리합니다.',
    },
    {
      section: 'guide_editor' as AdminSection,
      icon: Compass,
      color: 'from-amber-500 to-orange-600',
      title: '가이드 페이지 수정',
      desc: '이용 가이드 탭의 내용을 편집합니다.',
    },
    {
      section: 'board' as AdminSection,
      icon: LayoutDashboard,
      color: 'from-zinc-500 to-zinc-700',
      title: '게시판 관리',
      desc: '(추후 반영 예정)',
    },
    {
      section: 'report_maker' as AdminSection,
      icon: Sparkles,
      color: 'from-amber-500 to-orange-600',
      title: '인생 네비게이션 리포트 제작',
      desc: '고객 사주 데이터를 입력하고 AI 리포트를 생성합니다.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">관리자 대시보드</p>
          <p className="text-sm font-bold text-zinc-800">{user.email}</p>
          <p className="text-xs text-zinc-500">관리자 권한으로 로그인되어 있습니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(card => (
          <button
            key={card.section}
            onClick={() => onNavigate(card.section)}
            disabled={card.section === 'board'}
            className="group text-left rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-5 hover:-translate-y-0.5 transition-all shadow-md hover:shadow-xl disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} text-white flex items-center justify-center shadow-lg mb-4`}>
              <card.icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-zinc-800 flex items-center gap-1">
              {card.title}
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-xs text-zinc-500 mt-1">{card.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

// Blog Management Section
const formatDraftTime = (iso: string | null) => {
  if (!iso) return '임시저장 대기 중';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '임시저장 대기 중';
  return `임시저장: ${date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
};

const BlogManagementSection: React.FC<{
  blog: BlogTabController;
  isAdmin: boolean;
  allowedAdminEmails: string[];
  user: FirebaseUser;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
}> = ({ blog, isAdmin, allowedAdminEmails, user, isLoggingIn, onLogin, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('latest');
  const [draftFilter, setDraftFilter] = useState('all');
  const [bulkCategory, setBulkCategory] = useState('사주기초');
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

  const allPosts = blog.blogPosts.length > 0 ? blog.blogPosts : BLOG_POSTS;

  const draftPostIds = useMemo(() => {
    const ids = new Set<string>(blog.editDraftPostIds);
    allPosts.forEach(post => {
      if (typeof window !== 'undefined' && localStorage.getItem(`${blog.editDraftKeyPrefix}${post.id}`)) {
        ids.add(post.id);
      }
    });
    return ids;
  }, [allPosts, blog.editDraftKeyPrefix, blog.editDraftPostIds, blog.editPostDraftSavedAt]);

  const hasAllVisibleSelected = selectedPostIds.size > 0 && allPosts.every(p => selectedPostIds.has(p.id));

  const handleSelectAllVisible = () => {
    if (hasAllVisibleSelected) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(allPosts.map(p => p.id)));
    }
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedPostIds.size === 0) return;
    if (!window.confirm(`선택된 ${selectedPostIds.size}개 게시글을 삭제하시겠습니까?`)) return;
    await blog.handleBulkDeletePosts(Array.from(selectedPostIds));
    setSelectedPostIds(new Set());
  };

  const handleBulkCategoryApply = async () => {
    if (selectedPostIds.size === 0) return;
    await blog.handleBulkUpdateCategory(Array.from(selectedPostIds), bulkCategory);
    setSelectedPostIds(new Set());
  };

  return (
    <BlogAdminPanel
      isAdmin={isAdmin}
      showAdminGate={false}
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
      newPostDraftSavedLabel={formatDraftTime(blog.newPostDraftSavedAt)}
      editPostDraftSavedLabel={formatDraftTime(blog.editPostDraftSavedAt)}
      hasNewPostStoredDraft={blog.hasNewPostStoredDraft}
      visiblePostCount={allPosts.length}
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
      onRefreshMedia={() => { void blog.loadMediaLibrary(); }}
      onSelectNewPostMedia={asset => blog.handleSelectMediaAsset(asset, false)}
      onClearNewPostDraft={blog.clearNewPostDraft}
      onAddPost={() => { void blog.handleAddPost(); }}
      onCloseEditPost={() => blog.setIsEditingPost(null)}
      onEditPostChange={nextPost => blog.setIsEditingPost(nextPost as any)}
      onSelectEditPostMedia={asset => blog.handleSelectMediaAsset(asset, true)}
      onClearEditPostDraft={blog.clearEditPostDraft}
      onUpdatePost={() => { void blog.handleUpdatePost(); }}
      onLogin={onLogin}
      onLogout={onLogout}
    />
  );
};

// Main AdminPage
export const AdminPage: React.FC<AdminPageProps> = ({
  user,
  isAdmin,
  isLoggingIn,
  allowedAdminEmails,
  blog,
  defaultGuidelines,
  onGuidelinesChange,
  onLogin,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>(getInitialAdminSection);

  const GLASS_BG = 'bg-gradient-to-br from-slate-100 via-cyan-50/60 to-indigo-100/70';

  const navItems: { section: AdminSection; icon: React.FC<any>; label: string }[] = [
    { section: 'dashboard', icon: Settings, label: '대시보드' },
    { section: 'premium_orders', icon: Ticket, label: '프리미엄 주문' },
    { section: 'guidelines', icon: BookOpen, label: '지침 관리' },
    { section: 'blog', icon: Newspaper, label: '블로그 관리' },
    { section: 'guide_editor', icon: Compass, label: '가이드 수정' },
    { section: 'report_maker', icon: Sparkles, label: '리포트 제작' },
    { section: 'board', icon: LayoutDashboard, label: '게시판 (예정)' },
  ];

  if (!user) {
    return (
      <div className={`h-screen ${GLASS_BG} flex items-center justify-center`}>
        <div className="rounded-3xl border border-white/60 bg-white/60 backdrop-blur-2xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center mx-auto shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">관리자 로그인</h1>
            <p className="text-sm text-zinc-500 mt-2">관리자 계정으로 로그인하면 시스템 설정을 관리할 수 있습니다.</p>
          </div>
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-xl shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {isLoggingIn ? '로그인 중...' : 'Google로 관리자 로그인'}
          </button>
          <p className="text-xs text-zinc-400">승인된 관리자 계정만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`h-screen ${GLASS_BG} flex items-center justify-center`}>
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 backdrop-blur-2xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500 flex items-center justify-center mx-auto shadow-lg">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-rose-800">접근 권한이 없습니다</h1>
            <p className="text-sm text-rose-600 mt-2">
              현재 계정 <span className="font-bold">{user.email}</span>은 관리자 권한이 없습니다.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-3 rounded-2xl bg-rose-600 text-white font-bold transition-all hover:bg-rose-700 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (activeSection === 'report_maker') {
    return (
      <React.Suspense
        fallback={
          <div className="h-screen bg-gradient-to-br from-slate-100 via-cyan-50/60 to-indigo-100/70 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <PremiumReportMakerPage
          user={user}
          isAdmin={isAdmin}
          isLoggingIn={isLoggingIn}
          allowedAdminEmails={allowedAdminEmails}
          onLogin={onLogin}
          onLogout={onLogout}
          onBack={() => setActiveSection('dashboard')}
        />
      </React.Suspense>
    );
  }

  if (activeSection === 'premium_orders') {
    return (
      <React.Suspense
        fallback={
          <div className="h-screen bg-gradient-to-br from-slate-100 via-cyan-50/60 to-indigo-100/70 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <div className="w-full h-screen">
          <LazyPremiumOrdersPanel isDarkMode={false} user={user} onLogout={onLogout} />
        </div>
      </React.Suspense>
    );
  }

  return (
    <div className={`h-screen ${GLASS_BG} flex overflow-hidden`}>
      <aside className="w-56 shrink-0 flex flex-col border-r border-white/60 bg-white/55 backdrop-blur-xl shadow-xl overflow-y-auto">
        <div className="p-4 border-b border-white/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-800">관리자 페이지</p>
              <p className="text-[10px] text-zinc-400 truncate" title={user.email ?? ''}>{user.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.section}
              onClick={() => setActiveSection(item.section)}
              disabled={item.section === 'board'}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-all ${
                activeSection === item.section
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : item.section === 'board'
                    ? 'text-zinc-400 cursor-not-allowed opacity-50'
                    : 'text-zinc-600 hover:bg-white/60'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/60">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-all"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
          <a
            href="/"
            className="mt-1 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-zinc-500 hover:bg-white/60 transition-all"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> 메인으로 돌아가기
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {activeSection !== 'dashboard' && (
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setActiveSection('dashboard')}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                대시보드
              </button>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-600">
                {navItems.find(n => n.section === activeSection)?.label}
              </span>
            </div>
          )}

          {activeSection === 'dashboard' && (
            <AdminDashboard user={user} onNavigate={setActiveSection} />
          )}

          {activeSection === 'guidelines' && (
            <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">상담 & 리포트 지침 관리</h2>
                  <p className="text-xs text-zinc-500">저장 즉시 AI 상담 및 리포트에 실시간 반영됩니다.</p>
                </div>
              </div>
              <GuidelinesEditor
                defaultGuidelines={defaultGuidelines}
                onGuidelinesChange={onGuidelinesChange}
              />
            </div>
          )}

          {activeSection === 'blog' && (
            <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl overflow-hidden">
              <div className="flex items-center gap-3 p-5 border-b border-white/60">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Newspaper className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">블로그 관리</h2>
                  <p className="text-xs text-zinc-500">게시글 작성, 수정, 삭제를 관리합니다.</p>
                </div>
              </div>
              <div className="p-4">
                <BlogManagementSection
                  blog={blog}
                  isAdmin={isAdmin}
                  allowedAdminEmails={allowedAdminEmails}
                  user={user}
                  isLoggingIn={isLoggingIn}
                  onLogin={onLogin}
                  onLogout={onLogout}
                />
              </div>
            </div>
          )}

          {activeSection === 'guide_editor' && (
            <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Compass className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">가이드 페이지 수정</h2>
                  <p className="text-xs text-zinc-500">이용 가이드 탭에 표시될 커스텀 안내문을 편집합니다.</p>
                </div>
              </div>
              <GuidePageEditor
                onContentChange={onGuidelinesChange}
              />
            </div>
          )}

          {activeSection === 'board' && (
            <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-12 text-center space-y-4">
              <LayoutDashboard className="w-12 h-12 text-zinc-300 mx-auto" />
              <h2 className="text-lg font-bold text-zinc-600">게시판 관리 (추후 반영)</h2>
              <p className="text-sm text-zinc-400">게시판 기능이 추가되면 이곳에서 관리할 수 있습니다.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
