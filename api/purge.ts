import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkVercelRateLimit, purgeLimiter } from './_lib/rate-limit.js';
import { getDb, isDbConfigured } from '../db/client.js';
import { CODE_PATTERN, normalizeCode, purgeByCode, purgeExpiredReports } from '../db/purge.js';

/**
 * 파기 통합 엔드포인트 (Hobby 플랜 서버리스 함수 12개 한도 대응으로 통합 — api/member.ts 패턴).
 *
 * - DELETE /api/purge?code=HW-3F9K2A → 즉시 파기: codes·orders·reports 연쇄 하드 삭제. 복구 불가.
 * - GET    /api/purge                → 만료 크론: expires_at 경과 리포트 물리 삭제.
 *   · Vercel Cron 이 CRON_SECRET 을 Authorization: Bearer 로 실어 호출한다.
 *   · Hobby 크론은 1일 1회 정밀도 → 읽기 경로에서도 expires_at 검사 필수(72h 논리 보장).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured()) {
    return res.status(503).json({
      error: 'DB_NOT_CONFIGURED',
      message: '데이터베이스가 아직 구성되지 않았습니다 (DATABASE_URL 미설정).',
    });
  }

  if (req.method === 'GET') {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    const auth = String(req.headers['authorization'] || '');
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    const db = await getDb();
    const purged = await purgeExpiredReports(db);
    console.log(`[purge-cron] expired reports purged: ${purged}`);
    return res.status(200).json({ ok: true, expiredReportsPurged: purged });
  }

  if (req.method === 'DELETE') {
    if (!checkVercelRateLimit(req, res, purgeLimiter)) return;

    const raw = String(req.query.code || '').trim();
    if (!raw) {
      return res.status(400).json({ error: 'CODE_REQUIRED', message: 'code 쿼리 파라미터가 필요합니다.' });
    }
    const code = normalizeCode(raw);
    if (!CODE_PATTERN.test(code)) {
      return res.status(400).json({ error: 'CODE_INVALID', message: '코드 형식이 올바르지 않습니다. (예: HW-3F9K2A)' });
    }

    const db = await getDb();
    const result = await purgeByCode(db, code);
    if (!result.found) {
      return res.status(404).json({ error: 'CODE_NOT_FOUND', message: '해당 코드를 찾을 수 없습니다.' });
    }
    return res.status(200).json({
      ok: true,
      irrecoverable: true,
      message: '해당 코드의 명식·주문·리포트가 모두 파기되었습니다. 이 작업은 되돌릴 수 없습니다.',
      ordersPurged: result.ordersPurged,
      reportsPurged: result.reportsPurged,
    });
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
