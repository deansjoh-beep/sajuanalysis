import { useEffect, useMemo, useRef, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage';
import { BlogPost, BLOG_POSTS } from '../constants/blog';
import { db, storage } from '../firebase';
import { BlogMediaAsset } from '../components/BlogMediaLibrary';
import { useBlogAdminActions } from './useBlogAdminActions';

const BLOG_NEW_POST_DRAFT_KEY = 'blogDraft:newPost';
const BLOG_EDIT_POST_DRAFT_KEY_PREFIX = 'blogDraft:edit:';
const BLOG_DRAFTS_COLLECTION = 'blogDrafts';
const BLOG_DRAFT_DEVICE_ID_KEY = 'blogDraft:deviceId';

interface UseBlogTabStateParams {
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
  user: FirebaseUser | null;
  isAdmin: boolean;
  handleFirestoreError: (error: unknown, operationType: any, path: string | null) => void;
  stripRichText: (content: string) => string;
  createDefaultNewPost: () => Partial<BlogPost>;
}

const hasDraftContent = (post: Partial<BlogPost> | null | undefined) => {
  if (!post) return false;
  return Boolean(post.title?.trim() || post.content?.trim() || post.excerpt?.trim());
};

export interface BlogTabController {
  selectedBlogPost: BlogPost | null;
  blogPosts: BlogPost[];
  recommendedPosts: BlogPost[];
  blogCategory: string;
  showAdminGate: boolean;
  isAddingPost: boolean;
  isEditingPost: BlogPost | null;
  isUploading: boolean;
  mediaLibrary: BlogMediaAsset[];
  isMediaLibraryLoading: boolean;
  mediaLibraryError: string | null;
  newPost: Partial<BlogPost>;
  newPostDraftSavedAt: string | null;
  editPostDraftSavedAt: string | null;
  hasNewPostStoredDraft: boolean;
  editDraftPostIds: Set<string>;
  editDraftKeyPrefix: string;
  setSelectedBlogPost: React.Dispatch<React.SetStateAction<BlogPost | null>>;
  setBlogCategory: React.Dispatch<React.SetStateAction<string>>;
  setIsAddingPost: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditingPost: React.Dispatch<React.SetStateAction<BlogPost | null>>;
  setNewPost: React.Dispatch<React.SetStateAction<Partial<BlogPost>>>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => Promise<void>;
  handleSelectMediaAsset: (asset: BlogMediaAsset, isEdit: boolean) => void;
  handlePostClick: (post: BlogPost) => Promise<void>;
  clearNewPostDraft: () => void;
  clearEditPostDraft: () => void;
  handleAddPost: () => Promise<void>;
  handleUpdatePost: () => Promise<void>;
  handleDeletePost: (postId: string) => Promise<void>;
  handleBulkDeletePosts: (postIds: string[]) => Promise<void>;
  handleBulkUpdateCategory: (postIds: string[], nextCategory: string) => Promise<void>;
  loadMediaLibrary: () => Promise<void>;
}

export const useBlogTabState = ({
  activeTab,
  setActiveTab,
  user,
  isAdmin,
  handleFirestoreError,
  stripRichText,
  createDefaultNewPost
}: UseBlogTabStateParams): BlogTabController => {
  const [selectedBlogPost, setSelectedBlogPost] = useState<BlogPost | null>(null);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogCategory, setBlogCategory] = useState<string>('전체');
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState<BlogPost | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState<BlogMediaAsset[]>([]);
  const [isMediaLibraryLoading, setIsMediaLibraryLoading] = useState(false);
  const [mediaLibraryError, setMediaLibraryError] = useState<string | null>(null);
  const [newPost, setNewPost] = useState<Partial<BlogPost>>(() => createDefaultNewPost());
  const [newPostDraftSavedAt, setNewPostDraftSavedAt] = useState<string | null>(null);
  const [editPostDraftSavedAt, setEditPostDraftSavedAt] = useState<string | null>(null);
  const [hasNewPostStoredDraft, setHasNewPostStoredDraft] = useState(false);
  const [editDraftPostIds, setEditDraftPostIds] = useState<Set<string>>(new Set());
  const [cloudDraftEnabled, setCloudDraftEnabled] = useState(true);
  const addDraftRecoveredRef = useRef(false);
  const editDraftRecoveredIdRef = useRef<string | null>(null);
  const defaultTitleRef = useRef('');
  const defaultDescriptionRef = useRef('');
  const deviceIdRef = useRef('browser-unknown');
  const lastHandledRemoteNewSavedAtRef = useRef<string | null>(null);
  const lastHandledRemoteEditSavedAtRef = useRef<string | null>(null);
  const cloudDraftPermissionWarnedRef = useRef(false);

  const isPermissionDeniedError = (error: unknown) => {
    const code = String((error as any)?.code || '');
    return code.includes('permission-denied');
  };

  const disableCloudDraftForSession = () => {
    setCloudDraftEnabled(false);
    if (!cloudDraftPermissionWarnedRef.current) {
      cloudDraftPermissionWarnedRef.current = true;
      console.warn('Cloud draft sync skipped due Firestore permissions. Local drafts remain available.');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let deviceId = localStorage.getItem(BLOG_DRAFT_DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      localStorage.setItem(BLOG_DRAFT_DEVICE_ID_KEY, deviceId);
    }
    deviceIdRef.current = deviceId;
  }, []);

  const recommendedPosts = useMemo(() => {
    const allPosts = blogPosts.length > 0 ? blogPosts : BLOG_POSTS;
    if (allPosts.length === 0) return [];

    const sortedByDate = [...allPosts].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.()?.getTime() || new Date(a.date).getTime();
      const dateB = b.createdAt?.toDate?.()?.getTime() || new Date(b.date).getTime();
      return dateB - dateA;
    });
    const latest = sortedByDate[0];

    const sortedByViews = [...allPosts]
      .filter((post) => post.id !== latest.id)
      .sort((a, b) => (b.views || 0) - (a.views || 0));
    const popular = sortedByViews[0] || latest;

    const now = new Date();
    const monthSeed = now.getFullYear() * 100 + now.getMonth();
    const seededRandom = (seed: number) => {
      const value = Math.sin(seed) * 10000;
      return value - Math.floor(value);
    };

    const eligibleForPicks = allPosts.filter((post) => post.id !== latest.id && post.id !== popular.id);
    const shuffledPicks = [...eligibleForPicks].sort((a, b) => {
      const hashA = seededRandom(monthSeed + a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      const hashB = seededRandom(monthSeed + b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      return hashA - hashB;
    });

    const pick1 = shuffledPicks[0] || (allPosts.find((post) => post.id !== latest.id && post.id !== popular.id) || latest);
    const pick2 = shuffledPicks[1] || (allPosts.find((post) => post.id !== latest.id && post.id !== popular.id && post.id !== pick1.id) || latest);

    const result: BlogPost[] = [];
    const seenIds = new Set<string>();
    [latest, popular, pick1, pick2].forEach((post) => {
      if (!seenIds.has(post.id)) {
        result.push(post);
        seenIds.add(post.id);
      }
    });
    return result;
  }, [blogPosts]);

  useEffect(() => {
    setCloudDraftEnabled(true);
    cloudDraftPermissionWarnedRef.current = false;
  }, [user?.uid, isAdmin]);

  const canUseCloudDraft = Boolean(user && isAdmin && cloudDraftEnabled);
  const getNewDraftRef = () => doc(db, BLOG_DRAFTS_COLLECTION, `${user?.uid || 'anonymous'}_new`);
  const getEditDraftRef = (postId: string) => doc(db, BLOG_DRAFTS_COLLECTION, `${user?.uid || 'anonymous'}_edit_${postId}`);

  const saveCloudDraft = async (draftType: 'new' | 'edit', data: Partial<BlogPost>, savedAtIso: string, postId?: string) => {
    if (!canUseCloudDraft || !user) return;
    try {
      const draftRef = draftType === 'new' ? getNewDraftRef() : getEditDraftRef(postId || 'unknown');
      await setDoc(
        draftRef,
        {
          uid: user.uid,
          draftType,
          postId: draftType === 'edit' ? postId || null : null,
          deviceId: deviceIdRef.current,
          savedAt: serverTimestamp(),
          savedAtClient: savedAtIso,
          data
        },
        { merge: true }
      );
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        disableCloudDraftForSession();
        return;
      }
      throw error;
    }
  };

  const deleteCloudDraft = async (draftType: 'new' | 'edit', postId?: string) => {
    if (!canUseCloudDraft || !user) return;
    try {
      const draftRef = draftType === 'new' ? getNewDraftRef() : getEditDraftRef(postId || 'unknown');
      await deleteDoc(draftRef);
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        disableCloudDraftForSession();
        return;
      }
      throw error;
    }
  };

  useEffect(() => {
    defaultTitleRef.current = document.title;
    const currentDesc = document.head.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    defaultDescriptionRef.current = currentDesc?.content || '';
  }, []);

  useEffect(() => {
    if (activeTab !== 'blog' || !selectedBlogPost) {
      document.title = defaultTitleRef.current;
      const defaultDesc = defaultDescriptionRef.current;

      const syncMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
        let tag = document.head.querySelector(selector) as HTMLMetaElement | null;
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute(attr, key);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      };

      syncMeta('meta[name="description"]', 'name', 'description', defaultDesc);
      syncMeta('meta[property="og:title"]', 'property', 'og:title', defaultTitleRef.current);
      syncMeta('meta[property="og:description"]', 'property', 'og:description', defaultDesc);
      syncMeta('meta[property="og:image"]', 'property', 'og:image', '');
      syncMeta('meta[property="twitter:title"]', 'property', 'twitter:title', defaultTitleRef.current);
      syncMeta('meta[property="twitter:description"]', 'property', 'twitter:description', defaultDesc);
      syncMeta('meta[property="twitter:image"]', 'property', 'twitter:image', '');
      return;
    }

    const seoTitle = selectedBlogPost.seoTitle?.trim() || selectedBlogPost.title;
    const fallbackDesc = selectedBlogPost.excerpt || stripRichText(selectedBlogPost.content).slice(0, 155);
    const seoDescription = selectedBlogPost.seoDescription?.trim() || fallbackDesc;
    const ogImageUrl = selectedBlogPost.ogImageUrl?.trim() || selectedBlogPost.imageUrl;

    const syncMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let tag = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    document.title = `${seoTitle} | 유아이 사주 블로그`;
    syncMeta('meta[name="description"]', 'name', 'description', seoDescription);
    syncMeta('meta[property="og:title"]', 'property', 'og:title', seoTitle);
    syncMeta('meta[property="og:description"]', 'property', 'og:description', seoDescription);
    syncMeta('meta[property="og:image"]', 'property', 'og:image', ogImageUrl);
    syncMeta('meta[property="twitter:title"]', 'property', 'twitter:title', seoTitle);
    syncMeta('meta[property="twitter:description"]', 'property', 'twitter:description', seoDescription);
    syncMeta('meta[property="twitter:image"]', 'property', 'twitter:image', ogImageUrl);
  }, [activeTab, selectedBlogPost, stripRichText]);

  useEffect(() => {
    if (!isAddingPost) {
      addDraftRecoveredRef.current = false;
      return;
    }

    if (addDraftRecoveredRef.current) return;
    addDraftRecoveredRef.current = true;

    const restoreNewDraft = async () => {
      try {
        let parsed: { savedAt?: string; data?: Partial<BlogPost> } | null = null;

        if (canUseCloudDraft && user) {
          const cloudSnap = await getDoc(getNewDraftRef());
          if (cloudSnap.exists()) {
            const cloudData = cloudSnap.data() as any;
            if (cloudData.savedAtClient) {
              lastHandledRemoteNewSavedAtRef.current = cloudData.savedAtClient;
            }
            parsed = {
              savedAt: cloudData.savedAtClient,
              data: cloudData.data
            };
          }
        }

        if (!parsed) {
          const raw = localStorage.getItem(BLOG_NEW_POST_DRAFT_KEY);
          if (raw) {
            parsed = JSON.parse(raw) as { savedAt?: string; data?: Partial<BlogPost> };
          }
        }

        if (!parsed?.data || !hasDraftContent(parsed.data)) return;
        if (!window.confirm('이전에 임시저장된 새 글이 있습니다. 복구할까요?')) return;

        setNewPost({ ...createDefaultNewPost(), ...parsed.data });
        if (parsed.savedAt) {
          setNewPostDraftSavedAt(parsed.savedAt);
        }
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          disableCloudDraftForSession();
          return;
        }
        console.error('Failed to restore new post draft:', error);
      }
    };

    void restoreNewDraft();
  }, [canUseCloudDraft, createDefaultNewPost, isAddingPost, user]);

  useEffect(() => {
    if (!isAddingPost || !canUseCloudDraft || !user) return;

    const unsubscribe = onSnapshot(
      getNewDraftRef(),
      (snapshot) => {
        if (!snapshot.exists()) return;

        const cloudData = snapshot.data() as any;
        const remoteSavedAt = cloudData.savedAtClient as string | undefined;
        const remoteDeviceId = cloudData.deviceId as string | undefined;
        if (!remoteSavedAt || !cloudData.data || !hasDraftContent(cloudData.data)) return;
        if (remoteDeviceId && remoteDeviceId === deviceIdRef.current) return;
        if (lastHandledRemoteNewSavedAtRef.current === remoteSavedAt) return;

        lastHandledRemoteNewSavedAtRef.current = remoteSavedAt;
        const shouldApply = window.confirm('다른 기기에서 새 글 임시저장본이 업데이트되었습니다. 지금 내용으로 불러올까요?');
        if (!shouldApply) return;

        setNewPost({ ...createDefaultNewPost(), ...cloudData.data });
        setNewPostDraftSavedAt(remoteSavedAt);
        localStorage.setItem(
          BLOG_NEW_POST_DRAFT_KEY,
          JSON.stringify({ savedAt: remoteSavedAt, data: cloudData.data })
        );
      },
      (error) => {
        if (isPermissionDeniedError(error)) {
          disableCloudDraftForSession();
          return;
        }
        console.error('Failed to subscribe new post cloud draft:', error);
      }
    );

    return () => unsubscribe();
  }, [canUseCloudDraft, createDefaultNewPost, isAddingPost, user]);

  useEffect(() => {
    if (!isAddingPost || !hasDraftContent(newPost)) return;

    const timer = setTimeout(() => {
      try {
        const payload = {
          savedAt: new Date().toISOString(),
          data: newPost
        };
        localStorage.setItem(BLOG_NEW_POST_DRAFT_KEY, JSON.stringify(payload));
        setNewPostDraftSavedAt(payload.savedAt);
        void saveCloudDraft('new', newPost, payload.savedAt);
      } catch (error) {
        console.error('Failed to save new post draft:', error);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [isAddingPost, newPost, canUseCloudDraft, user]);

  useEffect(() => {
    if (!isEditingPost?.id) {
      editDraftRecoveredIdRef.current = null;
      setEditPostDraftSavedAt(null);
      return;
    }

    const postId = isEditingPost.id;
    if (editDraftRecoveredIdRef.current === postId) return;
    editDraftRecoveredIdRef.current = postId;

    const restoreEditDraft = async () => {
      try {
        let parsed: { savedAt?: string; data?: Partial<BlogPost> } | null = null;

        if (canUseCloudDraft && user) {
          const cloudSnap = await getDoc(getEditDraftRef(postId));
          if (cloudSnap.exists()) {
            const cloudData = cloudSnap.data() as any;
            if (cloudData.savedAtClient) {
              lastHandledRemoteEditSavedAtRef.current = cloudData.savedAtClient;
            }
            parsed = {
              savedAt: cloudData.savedAtClient,
              data: cloudData.data
            };
          }
        }

        if (!parsed) {
          const raw = localStorage.getItem(`${BLOG_EDIT_POST_DRAFT_KEY_PREFIX}${postId}`);
          if (raw) {
            parsed = JSON.parse(raw) as { savedAt?: string; data?: Partial<BlogPost> };
          }
        }

        if (!parsed?.data || !hasDraftContent(parsed.data)) return;
        if (!window.confirm('이 글의 임시저장본이 있습니다. 복구할까요?')) return;

        setIsEditingPost((prev) => {
          if (!prev || prev.id !== postId) return prev;
          return { ...prev, ...parsed.data } as BlogPost;
        });
        if (parsed.savedAt) {
          setEditPostDraftSavedAt(parsed.savedAt);
        }
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          disableCloudDraftForSession();
          return;
        }
        console.error('Failed to restore edit draft:', error);
      }
    };

    void restoreEditDraft();
  }, [canUseCloudDraft, isEditingPost?.id, user]);

  useEffect(() => {
    if (!isEditingPost?.id || !canUseCloudDraft || !user) return;

    const editingPostId = isEditingPost.id;
    const unsubscribe = onSnapshot(
      getEditDraftRef(editingPostId),
      (snapshot) => {
        if (!snapshot.exists()) return;

        const cloudData = snapshot.data() as any;
        const remoteSavedAt = cloudData.savedAtClient as string | undefined;
        const remoteDeviceId = cloudData.deviceId as string | undefined;
        if (!remoteSavedAt || !cloudData.data || !hasDraftContent(cloudData.data)) return;
        if (remoteDeviceId && remoteDeviceId === deviceIdRef.current) return;
        if (lastHandledRemoteEditSavedAtRef.current === remoteSavedAt) return;

        lastHandledRemoteEditSavedAtRef.current = remoteSavedAt;
        const shouldApply = window.confirm('다른 기기에서 이 글의 임시저장본이 업데이트되었습니다. 최신본으로 바꿀까요?');
        if (!shouldApply) return;

        setIsEditingPost((prev) => {
          if (!prev || prev.id !== editingPostId) return prev;
          return { ...prev, ...cloudData.data } as BlogPost;
        });
        setEditPostDraftSavedAt(remoteSavedAt);
        localStorage.setItem(
          `${BLOG_EDIT_POST_DRAFT_KEY_PREFIX}${editingPostId}`,
          JSON.stringify({ savedAt: remoteSavedAt, data: cloudData.data })
        );
      },
      (error) => {
        if (isPermissionDeniedError(error)) {
          disableCloudDraftForSession();
          return;
        }
        console.error('Failed to subscribe edit post cloud draft:', error);
      }
    );

    return () => unsubscribe();
  }, [canUseCloudDraft, isEditingPost?.id, user]);

  useEffect(() => {
    if (!isEditingPost?.id || !hasDraftContent(isEditingPost)) return;

    const timer = setTimeout(() => {
      try {
        const payload = {
          savedAt: new Date().toISOString(),
          data: isEditingPost
        };
        localStorage.setItem(`${BLOG_EDIT_POST_DRAFT_KEY_PREFIX}${isEditingPost.id}`, JSON.stringify(payload));
        setEditPostDraftSavedAt(payload.savedAt);
        void saveCloudDraft('edit', isEditingPost, payload.savedAt, isEditingPost.id);
      } catch (error) {
        console.error('Failed to save edit draft:', error);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [isEditingPost, canUseCloudDraft, user]);

  useEffect(() => {
    const syncDraftMetadata = async () => {
      const localNewDraft = Boolean(localStorage.getItem(BLOG_NEW_POST_DRAFT_KEY));
      if (!canUseCloudDraft || !user) {
        setHasNewPostStoredDraft(localNewDraft);
        setEditDraftPostIds(new Set());
        return;
      }

      try {
        const draftQuery = query(
          collection(db, BLOG_DRAFTS_COLLECTION),
          where('uid', '==', user.uid)
        );
        const snapshot = await getDocs(draftQuery);

        let hasCloudNewDraft = false;
        const cloudEditIds = new Set<string>();

        snapshot.forEach((documentSnapshot) => {
          const draftData = documentSnapshot.data() as any;
          if (draftData.draftType === 'new') {
            hasCloudNewDraft = true;
          }
          if (draftData.draftType === 'edit' && draftData.postId) {
            cloudEditIds.add(draftData.postId);
          }
        });

        setHasNewPostStoredDraft(localNewDraft || hasCloudNewDraft);
        setEditDraftPostIds(cloudEditIds);
      } catch (error: any) {
        if (isPermissionDeniedError(error)) {
          disableCloudDraftForSession();
        } else {
          console.error('Failed to sync cloud draft metadata:', error);
        }
        setHasNewPostStoredDraft(localNewDraft);
        setEditDraftPostIds(new Set());
      }
    };

    void syncDraftMetadata();
  }, [canUseCloudDraft, user, isAddingPost, newPostDraftSavedAt, editPostDraftSavedAt]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ui_gate') === 'premium_777') {
      setShowAdminGate(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const postQuery = query(collection(db, 'blogPosts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(postQuery, (snapshot) => {
      const posts = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      })) as BlogPost[];
      setBlogPosts(posts);
    }, (error) => {
      handleFirestoreError(error, 'list', 'blogPosts');
    });

    return () => unsubscribe();
  }, [handleFirestoreError]);

  const loadMediaLibrary = async () => {
    if (!user) return;

    setIsMediaLibraryLoading(true);
    setMediaLibraryError(null);
    try {
      const result = await listAll(ref(storage, 'blog'));
      const assets = await Promise.all(
        result.items.map(async (itemRef) => ({
          name: itemRef.name,
          path: itemRef.fullPath,
          url: await getDownloadURL(itemRef)
        }))
      );
      assets.sort((a, b) => b.name.localeCompare(a.name));
      setMediaLibrary(assets);
    } catch (error) {
      console.error('Failed to load media library:', error);
      setMediaLibraryError('미디어 목록을 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsMediaLibraryLoading(false);
    }
  };

  useEffect(() => {
    if ((isAddingPost || isEditingPost) && isAdmin && user) {
      loadMediaLibrary();
    }
  }, [isAddingPost, isEditingPost?.id, isAdmin, user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `blog/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setMediaLibrary((prev) => {
        const nextItem: BlogMediaAsset = {
          name: storageRef.name,
          path: storageRef.fullPath,
          url
        };
        return [nextItem, ...prev.filter((item) => item.path !== nextItem.path)];
      });

      if (isEdit && isEditingPost) {
        setIsEditingPost({ ...isEditingPost, imageUrl: url });
      } else {
        setNewPost({ ...newPost, imageUrl: url });
      }
      alert('이미지가 성공적으로 업로드되었습니다.');
    } catch (error) {
      console.error('Image upload error:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectMediaAsset = (asset: BlogMediaAsset, isEdit: boolean) => {
    if (isEdit && isEditingPost) {
      setIsEditingPost((prev) => (prev ? { ...prev, imageUrl: asset.url } : prev));
      return;
    }
    setNewPost((prev) => ({ ...prev, imageUrl: asset.url }));
  };

  const handlePostClick = async (post: BlogPost) => {
    setSelectedBlogPost(post);
    setActiveTab('blog');

    try {
      await updateDoc(doc(db, 'blogPosts', post.id), {
        views: increment(1)
      });
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  const clearNewPostDraft = () => {
    localStorage.removeItem(BLOG_NEW_POST_DRAFT_KEY);
    setNewPostDraftSavedAt(null);
    void deleteCloudDraft('new');
    setHasNewPostStoredDraft(false);
  };

  const clearEditPostDraft = () => {
    if (!isEditingPost?.id) return;
    localStorage.removeItem(`${BLOG_EDIT_POST_DRAFT_KEY_PREFIX}${isEditingPost.id}`);
    setEditPostDraftSavedAt(null);
    void deleteCloudDraft('edit', isEditingPost.id);
    setEditDraftPostIds((prev) => {
      const next = new Set(prev);
      next.delete(isEditingPost.id);
      return next;
    });
  };

  const { handleAddPost, handleUpdatePost, handleDeletePost } = useBlogAdminActions({
    isAdmin,
    user: user ? { uid: user.uid } : null,
    newPost,
    isEditingPost,
    selectedBlogPost,
    setNewPost,
    setIsAddingPost,
    setIsEditingPost,
    setSelectedBlogPost,
    setNewPostDraftSavedAt,
    setEditPostDraftSavedAt,
    createDefaultNewPost,
    stripRichText,
    handleFirestoreError,
    newPostDraftKey: BLOG_NEW_POST_DRAFT_KEY,
    editPostDraftKeyPrefix: BLOG_EDIT_POST_DRAFT_KEY_PREFIX,
    onAddPostSuccess: async () => {
      await deleteCloudDraft('new');
      setHasNewPostStoredDraft(false);
    },
    onUpdatePostSuccess: async (postId) => {
      await deleteCloudDraft('edit', postId);
      setEditDraftPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  });

  const handleBulkDeletePosts = async (postIds: string[]) => {
    if (!isAdmin || postIds.length === 0) return;
    if (!window.confirm(`선택한 글 ${postIds.length}개를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      await Promise.all(postIds.map((postId) => deleteDoc(doc(db, 'blogPosts', postId))));

      setSelectedBlogPost((prev) => {
        if (!prev) return prev;
        return postIds.includes(prev.id) ? null : prev;
      });

      postIds.forEach((postId) => {
        localStorage.removeItem(`${BLOG_EDIT_POST_DRAFT_KEY_PREFIX}${postId}`);
      });

      alert(`선택한 글 ${postIds.length}개를 삭제했습니다.`);
    } catch (error) {
      console.error('Bulk delete posts error:', error);
      handleFirestoreError(error, 'delete', 'blogPosts/bulk');
      alert('선택 글 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleBulkUpdateCategory = async (postIds: string[], nextCategory: string) => {
    if (!isAdmin || postIds.length === 0) return;

    try {
      await Promise.all(postIds.map((postId) => updateDoc(doc(db, 'blogPosts', postId), { category: nextCategory })));
      alert(`선택한 글 ${postIds.length}개의 카테고리를 ${nextCategory}(으)로 변경했습니다.`);
    } catch (error) {
      console.error('Bulk update category error:', error);
      handleFirestoreError(error, 'update', 'blogPosts/bulkCategory');
      alert('카테고리 일괄 변경 중 오류가 발생했습니다.');
    }
  };

  return {
    selectedBlogPost,
    blogPosts,
    recommendedPosts,
    blogCategory,
    showAdminGate,
    isAddingPost,
    isEditingPost,
    isUploading,
    mediaLibrary,
    isMediaLibraryLoading,
    mediaLibraryError,
    newPost,
    newPostDraftSavedAt,
    editPostDraftSavedAt,
    hasNewPostStoredDraft,
    editDraftPostIds,
    editDraftKeyPrefix: BLOG_EDIT_POST_DRAFT_KEY_PREFIX,
    setSelectedBlogPost,
    setBlogCategory,
    setIsAddingPost,
    setIsEditingPost,
    setNewPost,
    handleImageUpload,
    handleSelectMediaAsset,
    handlePostClick,
    clearNewPostDraft,
    clearEditPostDraft,
    handleAddPost,
    handleUpdatePost,
    handleDeletePost,
    handleBulkDeletePosts,
    handleBulkUpdateCategory,
    loadMediaLibrary
  };
};