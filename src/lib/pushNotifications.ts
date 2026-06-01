import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { firebaseApp } from '../firebase';
import { addFcmToken, setMemberPushEnabled } from './memberStore';

/**
 * 웹 푸시(FCM) 알림 헬퍼.
 *
 * VITE_FIREBASE_VAPID_KEY(웹 푸시 인증서 공개키)가 설정되어야 활성화된다.
 * Firebase 콘솔 > 프로젝트 설정 > 클라우드 메시징 > 웹 구성 > 웹 푸시 인증서에서 키 페어 생성.
 */

const VAPID_KEY = String((import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || '').trim();

export const isPushConfigured = (): boolean => VAPID_KEY.length > 0;

export const isPushSupported = async (): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
    return await isSupported();
  } catch {
    return false;
  }
};

export class PushError extends Error {
  code: string;
  constructor(message: string, code = 'unknown') {
    super(message);
    this.code = code;
  }
}

/**
 * 알림 권한을 요청하고 FCM 토큰을 발급받아 회원 문서에 저장한다.
 * 성공 시 members/{uid}.pushEnabled = true, fcmTokens 에 토큰 추가.
 */
export const enablePushNotifications = async (uid: string): Promise<void> => {
  if (!isPushConfigured()) {
    throw new PushError('푸시 알림이 아직 설정되지 않았습니다. (VITE_FIREBASE_VAPID_KEY 필요)', 'not-configured');
  }
  if (!(await isPushSupported())) {
    throw new PushError('이 브라우저에서는 푸시 알림을 지원하지 않습니다.', 'unsupported');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new PushError('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.', 'permission-denied');
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new PushError('알림 토큰 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'no-token');
  }

  await addFcmToken(uid, token);
  await setMemberPushEnabled(uid, true);
};

/** 푸시 알림 끄기 (회원 문서 플래그만 해제; 토큰은 만료까지 유지) */
export const disablePushNotifications = async (uid: string): Promise<void> => {
  await setMemberPushEnabled(uid, false);
};

/** 포그라운드 메시지 수신 핸들러 등록 (앱이 열려 있을 때) */
export const onForegroundMessage = (handler: (title: string, body: string) => void) => {
  isPushSupported().then((ok) => {
    if (!ok) return;
    const messaging = getMessaging(firebaseApp);
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || '오늘의 운세';
      const body = payload.notification?.body || payload.data?.body || '';
      handler(title, body);
    });
  });
};
