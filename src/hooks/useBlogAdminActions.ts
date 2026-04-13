import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { BlogPost } from '../constants/blog';
import { db } from '../firebase';

interface UseBlogAdminActionsParams {
  isAdmin: boolean;
  user: { uid: string } | null;
  newPost: Partial<BlogPost>;
  isEditingPost: BlogPost | null;
  selectedBlogPost: BlogPost | null;
  setNewPost: React.Dispatch<React.SetStateAction<Partial<BlogPost>>>;
  setIsAddingPost: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditingPost: React.Dispatch<React.SetStateAction<BlogPost | null>>;
  setSelectedBlogPost: React.Dispatch<React.SetStateAction<BlogPost | null>>;
  setNewPostDraftSavedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setEditPostDraftSavedAt: React.Dispatch<React.SetStateAction<string | null>>;
  createDefaultNewPost: () => Partial<BlogPost>;
  stripRichText: (content: string) => string;
  handleFirestoreError: (error: unknown, operationType: any, path: string | null) => void;
  newPostDraftKey: string;
  editPostDraftKeyPrefix: string;
  onAddPostSuccess?: () => void | Promise<void>;
  onUpdatePostSuccess?: (postId: string) => void | Promise<void>;
}

export const useBlogAdminActions = ({
  isAdmin,
  user,
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
  newPostDraftKey,
  editPostDraftKeyPrefix,
  onAddPostSuccess,
  onUpdatePostSuccess
}: UseBlogAdminActionsParams) => {
  const handleAddPost = async () => {
    if (!isAdmin || !user) {
      alert('관리자 권한이 없거나 로그인이 필요합니다.');
      return;
    }

    try {
      const postData = {
        ...newPost,
        excerpt: newPost.excerpt || (newPost.content ? `${stripRichText(newPost.content).slice(0, 120)}...` : ''),
        seoTitle: newPost.seoTitle?.trim() || newPost.title || '유아이 사주 블로그',
        seoDescription: newPost.seoDescription?.trim() || (newPost.excerpt?.trim() || stripRichText(newPost.content || '').slice(0, 155)),
        ogImageUrl: newPost.ogImageUrl?.trim() || newPost.imageUrl,
        readTime: newPost.readTime || '3분',
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        authorUid: user.uid,
        views: 0
      };

      await addDoc(collection(db, 'blogPosts'), postData);
      localStorage.removeItem(newPostDraftKey);
      setNewPostDraftSavedAt(null);
      if (onAddPostSuccess) {
        await onAddPostSuccess();
      }
      setIsAddingPost(false);
      setNewPost(createDefaultNewPost());
      alert('블로그 글이 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error('Error saving post:', error);
      handleFirestoreError(error, 'create', 'blogPosts');
      alert('블로그 글 저장 중 오류가 발생했습니다.');
    }
  };

  const handleUpdatePost = async () => {
    if (!isAdmin || !isEditingPost) {
      alert('관리자 권한이 없거나 수정할 글이 선택되지 않았습니다.');
      return;
    }

    try {
      const postRef = doc(db, 'blogPosts', isEditingPost.id);
      const updateData = {
        title: isEditingPost.title,
        content: isEditingPost.content,
        category: isEditingPost.category,
        imageUrl: isEditingPost.imageUrl,
        excerpt: isEditingPost.excerpt || `${stripRichText(isEditingPost.content).slice(0, 120)}...`,
        seoTitle: isEditingPost.seoTitle?.trim() || isEditingPost.title,
        seoDescription: isEditingPost.seoDescription?.trim() || (isEditingPost.excerpt?.trim() || stripRichText(isEditingPost.content).slice(0, 155)),
        ogImageUrl: isEditingPost.ogImageUrl?.trim() || isEditingPost.imageUrl,
        readTime: isEditingPost.readTime || '3분'
      };

      await updateDoc(postRef, updateData);
      localStorage.removeItem(`${editPostDraftKeyPrefix}${isEditingPost.id}`);
      setEditPostDraftSavedAt(null);
      if (onUpdatePostSuccess) {
        await onUpdatePostSuccess(isEditingPost.id);
      }
      setIsEditingPost(null);
      alert('블로그 글이 성공적으로 수정되었습니다.');
    } catch (error) {
      console.error('Error updating post:', error);
      handleFirestoreError(error, 'update', `blogPosts/${isEditingPost.id}`);
      alert('블로그 글 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!isAdmin || !window.confirm('정말 이 글을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'blogPosts', postId));
      if (selectedBlogPost?.id === postId) {
        setSelectedBlogPost(null);
      }
      alert('블로그 글이 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, 'delete', `blogPosts/${postId}`);
      alert('블로그 글 삭제 중 오류가 발생했습니다.');
    }
  };

  return {
    handleAddPost,
    handleUpdatePost,
    handleDeletePost
  };
};
