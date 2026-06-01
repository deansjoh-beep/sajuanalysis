import React, { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { loginWithGoogle, loginWithKakao, isKakaoConfigured, MemberAuthError } from '../../lib/memberAuth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 로그인 성공 직후 호출 */
  onSuccess?: () => void;
}

type Pending = 'google' | 'kakao' | null;

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (pending) return;
    setError('');
    onClose();
  };

  const run = async (provider: 'google' | 'kakao', fn: () => Promise<void>) => {
    setError('');
    setPending(provider);
    try {
      await fn();
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof MemberAuthError ? err.message : '로그인 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setPending(null);
    }
  };

  if (!isOpen) return null;

  const kakaoReady = isKakaoConfigured();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      data-theme="light"
    >
      <div className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] border border-ink-300/30 bg-paper-50 shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-300/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl border border-seal/40 bg-seal/10 flex items-center justify-center">
              <span className="font-serif font-bold text-[15px] text-seal">命</span>
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-ink-900">로그인</h2>
              <p className="text-[12px] text-ink-500">로그인하면 매일 오늘의 운세를 무료로 받아요</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={!!pending}
            className="w-8 h-8 rounded-xl bg-paper-100 hover:bg-paper-200 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4 text-ink-700" />
          </button>
        </div>

        <div className="px-6 py-7 space-y-3">
          {/* 카카오 로그인 */}
          <button
            onClick={() => run('kakao', loginWithKakao)}
            disabled={!!pending}
            className="w-full py-3.5 min-h-[52px] rounded-2xl bg-[#FEE500] text-[#191600] font-bold text-[15px] flex items-center justify-center gap-2.5 hover:brightness-95 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {pending === 'kakao' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <KakaoIcon className="w-5 h-5" />
            )}
            카카오로 시작하기
          </button>
          {!kakaoReady && (
            <p className="text-[12px] text-ink-500 text-center -mt-1">
              카카오 로그인은 준비 중입니다. 현재는 구글 로그인을 이용해 주세요.
            </p>
          )}

          {/* 구글 로그인 */}
          <button
            onClick={() => run('google', loginWithGoogle)}
            disabled={!!pending}
            className="w-full py-3.5 min-h-[52px] rounded-2xl border border-ink-300/40 bg-white text-ink-900 font-bold text-[15px] flex items-center justify-center gap-2.5 hover:bg-paper-100 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {pending === 'google' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleIcon className="w-5 h-5" />
            )}
            Google로 시작하기
          </button>

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-seal/5 border border-seal/30 text-seal text-[13px] leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-center text-[12px] text-ink-500/80 pt-2 leading-relaxed">
            로그인 시 개인정보 처리방침 및 이용약관에 동의하는 것으로 간주됩니다.
            <br />
            유아이는 운세 제공 목적 외에 정보를 사용하지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.79 1.86 5.23 4.65 6.6-.2.73-.74 2.66-.85 3.07-.13.51.19.5.4.36.16-.1 2.6-1.77 3.66-2.49.7.1 1.42.16 2.14.16 5.523 0 10-3.477 10-7.8C22 6.477 17.523 3 12 3z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
