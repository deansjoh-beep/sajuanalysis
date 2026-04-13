import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Resend GET /emails/{id} 를 호출하여 이메일 배달 상태를 확인합니다.
 *
 * Resend last_event 값:
 *   - "email.sent"        → 전송 완료 (Resend → 수신 서버)
 *   - "email.delivered"   → 수신 서버가 수락 (받은편지함 도착)
 *   - "email.bounced"     → 수신 서버가 거부 (주소 오류 등)
 *   - "email.complained"  → 수신자가 스팸으로 신고
 *   - "email.opened"      → 수신자가 이메일을 열람
 *   - "email.clicked"     → 수신자가 링크를 클릭
 *   - "email.delivery_delayed" → 배달 지연
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }

  try {
    const apiKey = String(process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({
        error: 'RESEND_API_KEY_MISSING',
        message: 'Resend API key is not configured on server',
      });
    }

    const messageId = String(req.body?.messageId || '').trim();
    if (!messageId) {
      return res.status(400).json({
        error: 'MESSAGE_ID_REQUIRED',
        message: 'messageId is required',
      });
    }

    // Resend GET /emails/{id}
    const resendResponse = await fetch(`https://api.resend.com/emails/${messageId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const raw = await resendResponse.text().catch(() => '');

    if (!resendResponse.ok) {
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.message || parsed?.name || raw;
      } catch {
        // keep raw
      }
      return res.status(resendResponse.status).json({
        error: 'RESEND_CHECK_FAILED',
        message: detail || 'Failed to check email status',
      });
    }

    let emailData: any = {};
    try {
      emailData = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: 'PARSE_ERROR',
        message: 'Failed to parse Resend response',
      });
    }

    // last_event 를 간단한 상태로 매핑
    const lastEvent = String(emailData?.last_event || '').trim();
    let status: string = 'unknown';
    if (lastEvent.includes('delivered') || lastEvent.includes('opened') || lastEvent.includes('clicked')) {
      status = 'delivered';
    } else if (lastEvent.includes('bounced')) {
      status = 'bounced';
    } else if (lastEvent.includes('complained')) {
      status = 'complained';
    } else if (lastEvent.includes('sent') || lastEvent.includes('delayed')) {
      status = 'sent';
    }

    return res.json({
      success: true,
      messageId,
      status,
      lastEvent,
      to: emailData?.to,
      subject: emailData?.subject,
      createdAt: emailData?.created_at,
    });
  } catch (error: any) {
    console.error('[api/premium-report/check-email-status] error:', error);
    return res.status(500).json({
      error: 'CHECK_FAILED',
      message: error?.message || 'Failed to check email status',
    });
  }
}
