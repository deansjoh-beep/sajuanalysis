/**
 * Firebase Admin (App/Firestore/Auth) 공용 부트스트랩.
 * 여러 Vercel 함수에서 재사용한다.
 */
import { parseServiceAccount, resolveFirestoreDbId } from './firebase-admin-utils.js';

let cachedApp: any | null | undefined;
let cachedDb: any | null | undefined;
let cachedAuth: any | null | undefined;

const getApp = async (): Promise<any | null> => {
  if (cachedApp !== undefined) return cachedApp;
  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) {
      cachedApp = null;
      return null;
    }
    cachedApp =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential: cert(serviceAccount as any),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          });
    return cachedApp;
  } catch (error) {
    console.error('[api/lib/admin] init failed:', error);
    cachedApp = null;
    return null;
  }
};

export const getAdminDb = async (): Promise<any | null> => {
  if (cachedDb !== undefined) return cachedDb;
  const app = await getApp();
  if (!app) {
    cachedDb = null;
    return null;
  }
  const { getFirestore } = await import('firebase-admin/firestore');
  cachedDb = getFirestore(app, resolveFirestoreDbId());
  return cachedDb;
};

export const getAdminAuth = async (): Promise<any | null> => {
  if (cachedAuth !== undefined) return cachedAuth;
  const app = await getApp();
  if (!app) {
    cachedAuth = null;
    return null;
  }
  const { getAuth } = await import('firebase-admin/auth');
  cachedAuth = getAuth(app);
  return cachedAuth;
};

let cachedMessaging: any | null | undefined;

export const getAdminMessaging = async (): Promise<any | null> => {
  if (cachedMessaging !== undefined) return cachedMessaging;
  const app = await getApp();
  if (!app) {
    cachedMessaging = null;
    return null;
  }
  const { getMessaging } = await import('firebase-admin/messaging');
  cachedMessaging = getMessaging(app);
  return cachedMessaging;
};
