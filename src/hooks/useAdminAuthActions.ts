import { auth, googleProvider, signInWithPopup, signOut } from '../firebase';

interface UseAdminAuthActionsParams {
  setIsLoggingIn: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useAdminAuthActions = ({ setIsLoggingIn }: UseAdminAuthActionsParams) => {
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = '로그인 중 오류가 발생했습니다.';

      if (error.code === 'auth/unauthorized-domain') {
        errorMessage = `현재 도메인이 Firebase 승인 도메인에 등록되어 있지 않습니다. Firebase 콘솔에서 다음 도메인을 '승인된 도메인'에 추가해 주세요:\n\n${window.location.hostname}`;
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = '브라우저에서 팝업이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해 주세요.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = '로그인 창이 닫혔습니다. 다시 시도해 주세요.';
      } else {
        errorMessage = `로그인 실패 (${error.code || 'unknown'}): ${error.message || '알 수 없는 오류가 발생했습니다.'}`;
      }

      alert(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return {
    handleLogin,
    handleLogout
  };
};
