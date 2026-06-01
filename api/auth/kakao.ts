import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseServiceAccount } from '../lib/firebase-admin-utils.js';
import { checkVercelRateLimit, generalLimiter } from '../lib/rate-limit.js';

/**
 * 카카오 로그인 → Firebase 커스텀 토큰 발급.
 *
 * 흐름:
 * 1. 클라이언트가 Kakao JS SDK로 받은 access_token 전송
 * 2. Kakao API(/v2/user/me)로 사용자 검증 및 프로필 조회
 * 3. Firebase Admin SDK로 커스텀 토큰 발급 (uid = "kakao:{id}")
 * 4. 클라이언트가 signInWithCustomToken 으로 Firebase 로그인
 */

let cachedAuth: any | null | undefined;

const getAdminAuth = async (): Promise<any | null> => {
  if (cachedAuth !== undefined) return cachedAuth;
  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');

    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) {
      cachedAuth = null;
      return null;
    }

    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({ credential: cert(serviceAccount as any) });

    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (error) {
    console.error('[api/auth/kakao] Admin init failed:', error);
    cachedAuth = null;
    return null;
  }
};

interface KakaoUser {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: { nickname?: string; profile_image_url?: string };
  };
  properties?: { nickname?: string; profile_image?: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!checkVercelRateLimit(req, res, generalLimiter)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }

  const accessToken = String(req.body?.accessToken || '').trim();
  if (!accessToken) {
    return res.status(400).json({ error: 'MISSING_TOKEN', message: 'accessToken is required' });
  }

  try {
    // 1. 카카오 사용자 검증
    const kakaoRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!kakaoRes.ok) {
      return res.status(401).json({ error: 'KAKAO_VERIFY_FAILED', message: '카카오 토큰 검증에 실패했습니다.' });
    }

    const kakaoUser = (await kakaoRes.json()) as KakaoUser;
    if (!kakaoUser?.id) {
      return res.status(401).json({ error: 'KAKAO_NO_ID', message: '카카오 사용자 정보를 가져오지 못했습니다.' });
    }

    // 2. Firebase Admin 준비
    const adminAuth = await getAdminAuth();
    if (!adminAuth) {
      return res.status(500).json({
        error: 'ADMIN_SDK_UNAVAILABLE',
        message: 'Firebase Admin 자격 증명이 설정되지 않았습니다.',
      });
    }

    const uid = `kakao:${kakaoUser.id}`;
    const email = kakaoUser.kakao_account?.email || undefined;
    const displayName =
      kakaoUser.kakao_account?.profile?.nickname || kakaoUser.properties?.nickname || '카카오 사용자';
    const photoURL =
      kakaoUser.kakao_account?.profile?.profile_image_url || kakaoUser.properties?.profile_image || undefined;

    // 3. Firebase Auth 사용자 동기화 (없으면 생성, 있으면 갱신)
    try {
      await adminAuth.updateUser(uid, { email, displayName, photoURL });
    } catch {
      await adminAuth.createUser({ uid, email, displayName, photoURL }).catch(() => undefined);
    }

    // 4. 커스텀 토큰 발급
    const token = await adminAuth.createCustomToken(uid, { provider: 'kakao' });

    return res.json({ token, profile: { uid, email: email ?? null, displayName, photoURL: photoURL ?? null } });
  } catch (error: any) {
    console.error('[api/auth/kakao] error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Kakao auth failed' });
  }
}
