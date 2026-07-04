import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth, getAdminMessaging } from './_lib/admin.js';
import { generateDailyFortuneForSaju, type MemberSajuInput, type DailyFortune } from './_lib/dailyFortune.js';
import { serializeTimestamps } from './_lib/serialize.js';
import { getSeoulTodayYmd } from '../src/lib/seoulDateGanji.js';
import { checkVercelRateLimit, generalLimiter } from './_lib/rate-limit.js';

/**
 * 회원 관련 통합 엔드포인트 (Hobby 플랜 서버리스 함수 12개 한도 대응으로 통합).
 *
 * - POST /api/member            → 카카오 로그인(access_token → Firebase 커스텀 토큰)
 * - GET  /api/member            → 오늘의 운세 온디맨드 (Firebase ID 토큰)
 * - GET  /api/member            → 오늘의 운세 배치 (Authorization 이 CRON_SECRET 와 일치 시)
 *   · Vercel Cron 은 CRON_SECRET 을 자동으로 Authorization: Bearer 로 실어 호출한다.
 */

const CONCURRENCY = 4;
const TIME_BUDGET_MS = 50_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    if (!checkVercelRateLimit(req, res, generalLimiter)) return;
    return handleKakao(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET or POST only' });
  }

  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cronSecret = String(process.env.CRON_SECRET || '').trim();

  // 크론 배치: Authorization 이 CRON_SECRET 와 정확히 일치
  if (cronSecret && bearer === cronSecret) {
    return handleCron(req, res);
  }

  // 온디맨드: Firebase ID 토큰
  if (!checkVercelRateLimit(req, res, generalLimiter)) return;
  return handleOnDemand(req, res, bearer);
}

// ─────────────────────────────────────────────────────────────
// 카카오 로그인 → Firebase 커스텀 토큰
// ─────────────────────────────────────────────────────────────
async function handleKakao(req: VercelRequest, res: VercelResponse) {
  const code = String(req.body?.code || '').trim();
  const redirectUri = String(req.body?.redirectUri || '').trim();
  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'MISSING_PARAMS', message: 'code 와 redirectUri 가 필요합니다.' });
  }
  const restKey = String(process.env.KAKAO_REST_API_KEY || '').trim();
  if (!restKey) {
    return res.status(500).json({ error: 'KAKAO_NOT_CONFIGURED', message: 'KAKAO_REST_API_KEY 미설정' });
  }
  try {
    // 1. 인가 코드 → 액세스 토큰 교환
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: restKey,
        redirect_uri: redirectUri,
        code,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      console.error('[api/member kakao] token exchange failed:', errText.slice(0, 200));
      return res.status(401).json({ error: 'KAKAO_TOKEN_FAILED', message: '카카오 토큰 교환에 실패했습니다.' });
    }
    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(401).json({ error: 'KAKAO_NO_ACCESS_TOKEN', message: '카카오 액세스 토큰을 받지 못했습니다.' });
    }

    // 2. 액세스 토큰 → 사용자 정보
    const kakaoRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!kakaoRes.ok) {
      return res.status(401).json({ error: 'KAKAO_VERIFY_FAILED', message: '카카오 토큰 검증에 실패했습니다.' });
    }
    const kakaoUser: any = await kakaoRes.json();
    if (!kakaoUser?.id) {
      return res.status(401).json({ error: 'KAKAO_NO_ID', message: '카카오 사용자 정보를 가져오지 못했습니다.' });
    }

    const adminAuth = await getAdminAuth();
    if (!adminAuth) {
      return res.status(500).json({ error: 'ADMIN_SDK_UNAVAILABLE', message: 'Firebase Admin 미설정' });
    }

    const uid = `kakao:${kakaoUser.id}`;
    const email = kakaoUser.kakao_account?.email || undefined;
    const displayName =
      kakaoUser.kakao_account?.profile?.nickname || kakaoUser.properties?.nickname || '카카오 사용자';
    const photoURL =
      kakaoUser.kakao_account?.profile?.profile_image_url || kakaoUser.properties?.profile_image || undefined;

    try {
      await adminAuth.updateUser(uid, { email, displayName, photoURL });
    } catch {
      await adminAuth.createUser({ uid, email, displayName, photoURL }).catch(() => undefined);
    }
    const token = await adminAuth.createCustomToken(uid, { provider: 'kakao' });
    return res.json({ token, profile: { uid, email: email ?? null, displayName, photoURL: photoURL ?? null } });
  } catch (error: any) {
    console.error('[api/member kakao] error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || 'Kakao auth failed' });
  }
}

// ─────────────────────────────────────────────────────────────
// 오늘의 운세 온디맨드
// ─────────────────────────────────────────────────────────────
async function handleOnDemand(req: VercelRequest, res: VercelResponse, idToken: string) {
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

    const memberSnap = await db.collection('members').doc(uid).get();
    const saju = memberSnap.exists ? (memberSnap.data()?.saju as MemberSajuInput | undefined) : undefined;
    if (!saju || !saju.birthYear) {
      return res.status(409).json({
        error: 'NO_SAJU_PROFILE',
        message: '사주 정보가 없습니다. 먼저 만세력 분석을 진행해 사주를 등록해 주세요.',
      });
    }

    const dateYmd = getSeoulTodayYmd();
    const cacheRef = db.collection('dailyFortunes').doc(`${uid}_${dateYmd}`);
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
    console.error('[api/member daily] error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message || '운세 생성 실패' });
  }
}

// ─────────────────────────────────────────────────────────────
// 오늘의 운세 배치 (Cron)
// ─────────────────────────────────────────────────────────────
const runPool = async <T>(items: T[], limit: number, worker: (item: T) => Promise<void>) => {
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = items[idx++];
      await worker(cur);
    }
  });
  await Promise.all(runners);
};

async function handleCron(_req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  const db = await getAdminDb();
  if (!db) return res.status(500).json({ error: 'ADMIN_SDK_UNAVAILABLE' });

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_UNAVAILABLE' });

  const dateYmd = getSeoulTodayYmd();
  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    const membersSnap = await db.collection('members').get();
    type Target = { uid: string; saju: MemberSajuInput; pushEnabled: boolean; fcmTokens: string[] };
    const targets: Target[] = [];
    membersSnap.forEach((doc: any) => {
      const d = doc.data() || {};
      const saju = d.saju;
      if (saju && saju.birthYear) {
        targets.push({
          uid: doc.id,
          saju,
          pushEnabled: !!d.pushEnabled,
          fcmTokens: Array.isArray(d.fcmTokens) ? d.fcmTokens : [],
        });
      }
    });

    const messaging = await getAdminMessaging();
    let generated = 0, skipped = 0, failed = 0, pushed = 0;
    let budgetHit = false;

    const sendPush = async (t: Target, fortune: DailyFortune) => {
      if (!messaging || !t.pushEnabled || t.fcmTokens.length === 0) return;
      try {
        const resp = await messaging.sendEachForMulticast({
          tokens: t.fcmTokens,
          notification: {
            title: '오늘의 운세가 도착했어요',
            body: fortune.summary || '오늘 하루의 기운을 확인해 보세요.',
          },
          data: { url: '/?tab=daily' },
          webpush: { fcmOptions: { link: '/?tab=daily' } },
        });
        pushed += resp.successCount;
        const invalid: string[] = [];
        resp.responses.forEach((r: any, i: number) => {
          const code = r.error?.code || '';
          if (!r.success && (code.includes('registration-token-not-registered') || code.includes('invalid-argument'))) {
            invalid.push(t.fcmTokens[i]);
          }
        });
        if (invalid.length > 0) {
          await db.collection('members').doc(t.uid).update({ fcmTokens: FieldValue.arrayRemove(...invalid) });
        }
      } catch (err: any) {
        console.error(`[api/member cron] push ${t.uid} failed:`, err?.message);
      }
    };

    await runPool(targets, CONCURRENCY, async (t) => {
      if (Date.now() - started > TIME_BUDGET_MS) {
        budgetHit = true;
        return;
      }
      const cacheRef = db.collection('dailyFortunes').doc(`${t.uid}_${dateYmd}`);
      try {
        const existing = await cacheRef.get();
        let fortune: DailyFortune;
        if (existing.exists) {
          skipped++;
          fortune = existing.data()?.fortune;
        } else {
          const result = await generateDailyFortuneForSaju(t.saju, apiKey);
          await cacheRef.set(
            {
              uid: t.uid,
              date: result.dateYmd,
              dayPillarHanja: result.dayPillarHanja,
              dayPillarHangul: result.dayPillarHangul,
              fortune: result.fortune,
              model: result.model,
              source: 'cron',
              createdAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          fortune = result.fortune;
          generated++;
        }
        if (fortune) await sendPush(t, fortune);
      } catch (err: any) {
        failed++;
        console.error(`[api/member cron] ${t.uid} failed:`, err?.message);
      }
    });

    const summary = {
      success: true,
      date: dateYmd,
      totalMembers: membersSnap.size,
      targets: targets.length,
      generated,
      skipped,
      failed,
      pushed,
      budgetHit,
      elapsedMs: Date.now() - started,
    };
    console.info('[api/member cron] done:', summary);
    return res.json(summary);
  } catch (error: any) {
    console.error('[api/member cron] fatal:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message });
  }
}
