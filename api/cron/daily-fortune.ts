import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../lib/admin.js';
import { generateDailyFortuneForSaju, type MemberSajuInput } from '../lib/dailyFortune.js';
import { getSeoulTodayYmd } from '../../src/lib/seoulDateGanji.js';

/**
 * 오늘의 운세 배치 생성 (Vercel Cron — 매일 KST 06:00 = UTC 21:00).
 *
 * - 사주 프로필이 있는 전 회원의 오늘 운세를 미리 생성해 dailyFortunes 에 캐시.
 * - 이미 생성된 회원은 건너뛴다(멱등).
 * - 시간 예산(TIME_BUDGET_MS) 내에서만 처리하고, 남은 회원은 온디맨드 경로가 폴백 처리.
 * - 동시성을 제한해 Gemini 레이트리밋을 회피한다.
 *
 * 보안: CRON_SECRET 이 설정되면 Authorization: Bearer <CRON_SECRET> 일치를 요구한다.
 *       (Vercel Cron 은 CRON_SECRET 을 자동으로 Authorization 헤더에 실어 호출)
 */

const CONCURRENCY = 4;
const TIME_BUDGET_MS = 50_000;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 인증 (CRON_SECRET 설정 시)
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  if (cronSecret) {
    const auth = String(req.headers.authorization || '');
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
  }

  const started = Date.now();
  const db = await getAdminDb();
  if (!db) {
    return res.status(500).json({ error: 'ADMIN_SDK_UNAVAILABLE' });
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_UNAVAILABLE' });
  }

  const dateYmd = getSeoulTodayYmd();

  try {
    const { FieldValue } = await import('firebase-admin/firestore');

    // 사주 프로필이 있는 회원만 대상 (Firestore는 "필드 존재" 쿼리가 제한적이라 전체 조회 후 필터)
    const membersSnap = await db.collection('members').get();
    const targets: { uid: string; saju: MemberSajuInput }[] = [];
    membersSnap.forEach((doc: any) => {
      const saju = doc.data()?.saju;
      if (saju && saju.birthYear) targets.push({ uid: doc.id, saju });
    });

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    let budgetHit = false;

    await runPool(targets, CONCURRENCY, async ({ uid, saju }) => {
      if (Date.now() - started > TIME_BUDGET_MS) {
        budgetHit = true;
        return;
      }
      const cacheRef = db.collection('dailyFortunes').doc(`${uid}_${dateYmd}`);
      try {
        const existing = await cacheRef.get();
        if (existing.exists) {
          skipped++;
          return;
        }
        const result = await generateDailyFortuneForSaju(saju, apiKey);
        await cacheRef.set(
          {
            uid,
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
        generated++;
      } catch (err: any) {
        failed++;
        console.error(`[cron/daily-fortune] ${uid} failed:`, err?.message);
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
      budgetHit,
      elapsedMs: Date.now() - started,
    };
    console.info('[cron/daily-fortune] done:', summary);
    return res.json(summary);
  } catch (error: any) {
    console.error('[cron/daily-fortune] fatal:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: error?.message });
  }
}
