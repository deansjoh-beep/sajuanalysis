import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth } from './lib/admin.js';
import { generateDailyFortuneForSaju, type MemberSajuInput } from './lib/dailyFortune.js';
import { serializeTimestamps } from './lib/serialize.js';
import { checkVercelRateLimit, generalLimiter } from './lib/rate-limit.js';

/**
 * 오늘의 운세 온디맨드 조회/생성 (회원 전용).
 *
 * 1. Authorization: Bearer <Firebase ID 토큰> 검증 → uid
 * 2. dailyFortunes/{uid}_{YYYY-MM-DD} 캐시 확인 → 있으면 반환
 * 3. 없으면 members/{uid}.saju 로 운세 생성 → 캐시 저장 → 반환
 *
 * 배치 cron(Step 3)이 미리 생성해 두면 대부분 캐시 히트가 된다.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!checkVercelRateLimit(req, res, generalLimiter)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET or POST only' });
  }

  const authHeader = String(req.headers.authorization || '');
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' });
  }

  try {
    const [db, auth] = await Promise.all([getAdminDb(), getAdminAuth()]);
    if (!db || !auth) {
      return res.status(500).json({ error: 'ADMIN_SDK_UNAVAILABLE', message: 'Firebase Admin 미설정' });
    }

    let uid: string;
    try {
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: '유효하지 않은 인증입니다.' });
    }

    // 회원 사주 프로필
    const memberSnap = await db.collection('members').doc(uid).get();
    const saju = memberSnap.exists ? (memberSnap.data()?.saju as MemberSajuInput | undefined) : undefined;
    if (!saju || !saju.birthYear) {
      return res.status(409).json({
        error: 'NO_SAJU_PROFILE',
        message: '사주 정보가 없습니다. 먼저 만세력 분석을 진행해 사주를 등록해 주세요.',
      });
    }

    // 오늘 날짜 키 (KST)
    const { getSeoulTodayYmd } = await import('../src/lib/seoulDateGanji.js');
    const dateYmd = getSeoulTodayYmd();
    const cacheId = `${uid}_${dateYmd}`;
    const cacheRef = db.collection('dailyFortunes').doc(cacheId);

    // 강제 재생성 플래그 (관리자/디버그용)
    const forceRegen = req.query.refresh === '1';

    if (!forceRegen) {
      const cached = await cacheRef.get();
      if (cached.exists) {
        return res.json({ success: true, cached: true, ...serializeTimestamps(cached.data()) });
      }
    }

    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_UNAVAILABLE', message: 'Gemini API 키 미설정' });
    }

    const result = await generateDailyFortuneForSaju(saju, apiKey);

    const { FieldValue } = await import('firebase-admin/firestore');
    const payload = {
      uid,
      date: result.dateYmd,
      dayPillarHanja: result.dayPillarHanja,
      dayPillarHangul: result.dayPillarHangul,
      fortune: result.fortune,
      model: result.model,
      source: 'on-demand',
      createdAt: FieldValue.serverTimestamp(),
    };
    await cacheRef.set(payload, { merge: true });

    return res.json({ success: true, cached: false, ...serializeTimestamps({ ...payload, createdAt: new Date() }) });
  } catch (error: any) {
    console.error('[api/daily-fortune] error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || '운세 생성 실패' });
  }
}
