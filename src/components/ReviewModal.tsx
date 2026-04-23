import React, { useState, useRef, useCallback } from 'react';
import { X, Star, ImagePlus, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourcePage?: string;
}

const MAX_IMAGES = 3;
const MAX_CONTENT = 500;

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, sourcePage = 'general' }) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - previewFiles.length;
    const toAdd = files.slice(0, remaining);
    const newPreviews = toAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPreviewFiles(prev => [...prev, ...newPreviews]);
    e.target.value = '';
  }, [previewFiles.length]);

  const removeImage = useCallback((idx: number) => {
    setPreviewFiles(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) { setError('후기 내용을 입력해 주세요.'); return; }
    if (content.trim().length < 10) { setError('후기를 10자 이상 작성해 주세요.'); return; }
    setError('');
    setIsSubmitting(true);
    try {
      // 이미지 업로드
      const uploadedUrls: string[] = [];
      for (const { file } of previewFiles) {
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `reviews/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push(url);
      }

      await addDoc(collection(db, 'reviews'), {
        authorName: authorName.trim() || '익명',
        content: content.trim(),
        rating,
        imageUrls: uploadedUrls,
        sourcePage,
        status: 'pending',
        adminReply: '',
        adminRepliedAt: null,
        createdAt: serverTimestamp(),
        approvedAt: null,
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error('[ReviewModal] submit error:', err);
      setError('제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setRating(5);
    setHoverRating(0);
    setAuthorName('');
    setContent('');
    previewFiles.forEach(p => URL.revokeObjectURL(p.preview));
    setPreviewFiles([]);
    setError('');
    setSubmitted(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/60 bg-white/95 backdrop-blur-2xl shadow-2xl shadow-indigo-300/30 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shadow-md">
              <Star className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-zinc-900">후기 남기기</h2>
              <p className="text-[11px] text-zinc-500">소중한 경험을 공유해 주세요</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4 text-zinc-600" />
          </button>
        </div>

        {submitted ? (
          /* 제출 완료 화면 */
          <div className="px-6 py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-[16px] font-bold text-zinc-900">후기가 접수되었습니다!</h3>
            <p className="text-[13px] text-zinc-600 leading-relaxed">
              검토 후 게시됩니다. 소중한 후기 감사합니다 🙏
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-[13px] hover:bg-indigo-700 transition-colors"
            >
              닫기
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* 별점 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">만족도</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        star <= (hoverRating || rating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-zinc-300 fill-zinc-100'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-[13px] font-bold text-zinc-600 ml-1">
                  {['', '별로예요', '아쉬워요', '보통이에요', '만족해요', '최고예요!'][hoverRating || rating]}
                </span>
              </div>
            </div>

            {/* 닉네임 */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">닉네임 (선택)</label>
              <input
                type="text"
                placeholder="익명"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                maxLength={20}
                className="w-full px-4 py-2.5 min-h-[44px] rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/70 transition-all placeholder:text-zinc-400"
              />
            </div>

            {/* 후기 내용 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">후기 내용</label>
                <span className={`text-[11px] font-bold ${content.length > MAX_CONTENT * 0.9 ? 'text-rose-500' : 'text-zinc-400'}`}>
                  {content.length} / {MAX_CONTENT}
                </span>
              </div>
              <textarea
                placeholder="서비스를 이용하신 솔직한 후기를 남겨주세요. (최소 10자)"
                value={content}
                onChange={e => setContent(e.target.value.slice(0, MAX_CONTENT))}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/70 transition-all resize-none placeholder:text-zinc-400 leading-relaxed"
              />
            </div>

            {/* 이미지 업로드 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                사진 첨부 (선택, 최대 {MAX_IMAGES}장)
              </label>
              <div className="flex items-start gap-2 flex-wrap">
                {previewFiles.map((p, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                    <img src={p.preview} alt={`첨부 ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {previewFiles.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors shrink-0"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[10px] font-bold">추가</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[13px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* 제출 버튼 */}
            <div className="pt-1 pb-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-[13px] shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 제출 중...</>
                ) : (
                  <><Star className="w-4 h-4 fill-white" /> 후기 제출하기</>
                )}
              </button>
              <p className="text-center text-[11px] text-zinc-400 mt-2">검토 후 게시됩니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
