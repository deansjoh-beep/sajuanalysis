import { doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../firebase';

/**
 * 회원 프로필 저장소.
 *
 * Firestore `members/{uid}` 문서를 인증된 사용자 본인이 직접 읽고 쓴다.
 * (firestore.rules: request.auth.uid == uid)
 *
 * 사주 프로필(saju)은 운세 분석을 시작할 때 채워지며,
 * Step 2의 "오늘의 운세" 개인화 생성과 Step 3 배치 생성의 입력이 된다.
 */

export type MemberProvider = 'google' | 'kakao' | 'unknown';

export interface MemberSajuProfile {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  calendarType: 'solar' | 'lunar' | 'leap';
  gender: 'M' | 'F';
  unknownTime: boolean;
}

export interface MemberProfile {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  provider: MemberProvider;
  saju?: MemberSajuProfile;
  /** 오늘의 운세 푸시 알림 동의 (Step 5) */
  pushEnabled?: boolean;
  /** FCM 디바이스 토큰 목록 */
  fcmTokens?: string[];
  createdAt?: any;
  updatedAt?: any;
  lastLoginAt?: any;
}

const COLLECTION = 'members';

const inferProvider = (user: FirebaseUser): MemberProvider => {
  const providerId = user.providerData?.[0]?.providerId || '';
  if (providerId.includes('google')) return 'google';
  // 카카오는 커스텀 토큰 로그인이라 providerData가 비어있을 수 있음 → uid 접두사로 식별
  if (user.uid.startsWith('kakao:')) return 'kakao';
  return 'unknown';
};

/**
 * 로그인 직후 회원 프로필을 생성/갱신한다.
 * - 최초 로그인: createdAt 설정
 * - 재로그인: lastLoginAt 갱신, 기본 정보 동기화
 * provider는 명시적으로 넘길 수 있고(카카오), 없으면 user에서 추론한다.
 */
export const upsertMemberProfile = async (
  user: FirebaseUser,
  provider?: MemberProvider,
): Promise<void> => {
  const ref = doc(db, COLLECTION, user.uid);
  const snap = await getDoc(ref);
  const resolvedProvider = provider ?? inferProvider(user);

  const base = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? null,
    provider: resolvedProvider,
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  if (snap.exists()) {
    await setDoc(ref, base, { merge: true });
  } else {
    await setDoc(ref, { ...base, createdAt: serverTimestamp(), pushEnabled: false });
  }
};

export const getMemberProfile = async (uid: string): Promise<MemberProfile | null> => {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as MemberProfile;
};

/**
 * 회원의 사주 프로필을 저장한다. (운세 분석 시작 시 호출)
 */
export const saveMemberSaju = async (uid: string, saju: MemberSajuProfile): Promise<void> => {
  const ref = doc(db, COLLECTION, uid);
  await setDoc(ref, { saju, updatedAt: serverTimestamp() }, { merge: true });
};

export const setMemberPushEnabled = async (uid: string, enabled: boolean): Promise<void> => {
  const ref = doc(db, COLLECTION, uid);
  await setDoc(ref, { pushEnabled: enabled, updatedAt: serverTimestamp() }, { merge: true });
};

/** FCM 토큰 추가 (중복은 arrayUnion 이 자동 제거) */
export const addFcmToken = async (uid: string, token: string): Promise<void> => {
  const ref = doc(db, COLLECTION, uid);
  await updateDoc(ref, { fcmTokens: arrayUnion(token), updatedAt: serverTimestamp() });
};

/** FCM 토큰 제거 (만료/거부 시) */
export const removeFcmToken = async (uid: string, token: string): Promise<void> => {
  const ref = doc(db, COLLECTION, uid);
  await updateDoc(ref, { fcmTokens: arrayRemove(token), updatedAt: serverTimestamp() });
};
