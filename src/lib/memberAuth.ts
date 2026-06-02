import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
} from '../firebase';
import { upsertMemberProfile } from './memberStore';

/**
 * 회원 로그인/로그아웃 액션.
 *
 * - Google: Firebase 기본 제공자(signInWithPopup). 즉시 동작.
 * - 카카오: Firebase 기본 제공자가 아니므로 커스텀 토큰 플로우 사용.
 *   1) Kakao JS SDK로 액세스 토큰 획득
 *   2) /api/auth/kakao 로 전송 → 서버가 Kakao 사용자 검증 후 Firebase 커스텀 토큰 발급
 *   3) signInWithCustomToken 으로 Firebase 로그인
 *   VITE_KAKAO_JS_KEY 가 설정되어야 활성화된다.
 */

const KAKAO_JS_KEY = String((import.meta as any).env?.VITE_KAKAO_JS_KEY || '').trim();
const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
// SRI(integrity)는 Kakao 공식 가이드의 해당 버전 해시를 확인 후 추가할 것.
// 현재는 CSP script-src 가 t1.kakaocdn.net 으로 origin 을 제한해 1차 보호.

export const isKakaoConfigured = (): boolean => KAKAO_JS_KEY.length > 0;

export class MemberAuthError extends Error {
  code: string;
  constructor(message: string, code = 'unknown') {
    super(message);
    this.code = code;
  }
}

export const loginWithGoogle = async (): Promise<void> => {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await upsertMemberProfile(cred.user, 'google');
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new MemberAuthError('로그인 창이 닫혔습니다. 다시 시도해 주세요.', error.code);
    }
    if (error?.code === 'auth/popup-blocked') {
      throw new MemberAuthError('브라우저 팝업이 차단되었습니다. 차단을 해제하고 다시 시도해 주세요.', error.code);
    }
    if (error?.code === 'auth/unauthorized-domain') {
      throw new MemberAuthError(
        `현재 도메인이 Firebase 승인 도메인에 없습니다. Firebase 콘솔에 추가해 주세요: ${window.location.hostname}`,
        error.code,
      );
    }
    throw new MemberAuthError(error?.message || '로그인 중 오류가 발생했습니다.', error?.code || 'unknown');
  }
};

declare global {
  interface Window {
    Kakao?: any;
  }
}

const loadKakaoSdk = (): Promise<any> =>
  new Promise((resolve, reject) => {
    if (window.Kakao) return resolve(window.Kakao);
    const script = document.createElement('script');
    script.src = KAKAO_SDK_URL;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => resolve(window.Kakao);
    script.onerror = () => reject(new MemberAuthError('카카오 SDK를 불러오지 못했습니다.', 'kakao/sdk-load-failed'));
    document.head.appendChild(script);
  });

/** 카카오 OAuth redirect_uri — authorize 와 토큰 교환에서 동일하게 사용해야 한다. */
const kakaoRedirectUri = (): string => `${window.location.origin}/`;

/**
 * 카카오 로그인 시작 — JS SDK v2 의 authorize(리다이렉트+code) 방식.
 * Kakao.Auth.login(팝업·콜백)은 SDK 2.x 에서 제거되어 사용할 수 없다.
 * authorize 는 페이지를 카카오 인증 페이지로 이동시키고, 동의 후
 * redirectUri 로 ?code=... 를 붙여 되돌아온다. (App.tsx 에서 완료 처리)
 */
export const loginWithKakao = async (): Promise<void> => {
  if (!isKakaoConfigured()) {
    throw new MemberAuthError(
      '카카오 로그인이 아직 설정되지 않았습니다. (VITE_KAKAO_JS_KEY 필요)',
      'kakao/not-configured',
    );
  }

  const Kakao = await loadKakaoSdk();
  if (!Kakao.isInitialized()) {
    Kakao.init(KAKAO_JS_KEY);
  }

  // account_email 은 카카오 콘솔 동의항목 설정(+사업자 인증)이 필요해 KOE205 를 유발하므로 제외.
  // 서버(handleKakao)는 이메일을 선택값으로 처리하므로 닉네임/프로필만으로 로그인이 완성된다.
  // 이메일 수집이 필요하면 카카오 콘솔 [카카오 로그인]>[동의항목]에서 account_email 을 켜고
  // 아래 scope 에 'account_email' 을 다시 추가하면 된다.
  Kakao.Auth.authorize({
    redirectUri: kakaoRedirectUri(),
    scope: 'profile_nickname,profile_image',
    state: 'kakao',
  });

  // authorize 는 즉시 페이지를 리다이렉트하므로 이 함수는 사실상 반환되지 않는다.
  await new Promise<void>(() => undefined);
};

/**
 * 카카오 인증 후 돌아온 code 를 서버에서 토큰으로 교환하고 Firebase 로그인까지 완료한다.
 * App.tsx 마운트 시 URL 의 ?code= 를 감지해 호출한다.
 */
export const completeKakaoLogin = async (code: string): Promise<void> => {
  const res = await fetch('/api/member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri: kakaoRedirectUri() }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new MemberAuthError(data?.message || '카카오 인증에 실패했습니다.', data?.error || 'kakao/server-error');
  }

  const { token } = await res.json();
  if (!token) {
    throw new MemberAuthError('카카오 인증 토큰을 받지 못했습니다.', 'kakao/no-token');
  }

  const cred = await signInWithCustomToken(auth, token);
  await upsertMemberProfile(cred.user, 'kakao');
};

export const logoutMember = async (): Promise<void> => {
  try {
    // 카카오 SDK가 로드된 경우 카카오 세션도 정리
    if (window.Kakao?.Auth?.getAccessToken?.()) {
      window.Kakao.Auth.logout(() => undefined);
    }
  } catch {
    // 무시
  }
  await signOut(auth);
};
