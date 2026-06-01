import React, { useState, useRef, useEffect } from 'react';
import { LogIn, LogOut, User as UserIcon, Loader2 } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

interface MemberButtonProps {
  user: FirebaseUser | null;
  /** 관리자 여부 — 관리자는 별도 식별 표시 */
  isAdmin?: boolean;
  onLoginClick: () => void;
  onLogout: () => Promise<void> | void;
}

/**
 * 헤더 우측의 회원 로그인/프로필 버튼.
 * - 비로그인: "로그인" 버튼 → 로그인 모달 오픈
 * - 로그인: 이름/아바타 → 드롭다운(로그아웃)
 */
export const MemberButton: React.FC<MemberButtonProps> = ({ user, isAdmin, onLoginClick, onLogout }) => {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!user) {
    return (
      <button
        onClick={onLoginClick}
        className="p-2 md:px-3 md:py-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-2"
        title="로그인"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden md:block text-[13px] font-bold">로그인</span>
      </button>
    );
  }

  const displayName = user.displayName || user.email?.split('@')[0] || '회원';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
      setOpen(false);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 md:px-2.5 md:py-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-all flex items-center gap-2"
        title={displayName}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full object-cover border border-white/20" />
        ) : (
          <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
            <UserIcon className="w-3.5 h-3.5" />
          </span>
        )}
        <span className="hidden md:block text-[13px] font-bold max-w-[100px] truncate">{displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-ink-300/30 bg-paper-50 shadow-xl overflow-hidden z-50" data-theme="light">
          <div className="px-4 py-3 border-b border-ink-300/20">
            <p className="text-[13px] font-bold text-ink-900 truncate">{displayName}</p>
            {user.email && <p className="text-[12px] text-ink-500 truncate">{user.email}</p>}
            {isAdmin && (
              <span className="inline-block mt-1.5 text-[11px] font-bold text-seal bg-seal/10 border border-seal/30 px-2 py-0.5 rounded-full">
                관리자
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full px-4 py-3 text-left text-[13px] font-bold text-ink-700 hover:bg-paper-100 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
};
