/**
 * 사주 코드 안내 메일 (Resend) — 결제/무료 발급 직후 고객이 선택 입력한 주소로 코드를 보낸다.
 *
 * 개인정보 원칙(IMPLEMENTATION_PLAN §2, privacy-flow §4):
 * - 이메일은 DB·로그 어디에도 남기지 않는다. 이 함수 호출이 끝나면 메모리에서 사라진다.
 * - 로그에는 성공/실패 여부만 남기고 주소는 절대 찍지 않는다.
 * - 발송 실패가 주문·코드 발급을 실패시키지 않는다(코드는 화면에도 표시되므로).
 *
 * server.ts(Express)와 api/payment.ts(Vercel)가 공유한다.
 */

const PRODUCT_LABELS: Record<string, string> = {
  yearly2027: '2027 신년운세 리포트',
  yearly2026: '2026 일년운세 리포트',
  premium: '평생 사주 리포트',
  jobCareer: '직업·재물운 리포트',
  loveMarriage: '연애·결혼운 리포트',
};

// 실무형 검증 — RFC 전체가 아니라 오타·주입을 막는 수준. 254자 제한은 SMTP 상한.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

/** 선택 입력 이메일 정규화. 비었거나 형식이 틀리면 null(발송 생략). */
export function normalizeOptionalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return null;
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

export function isCodeEmailConfigured(): boolean {
  return Boolean((process.env.RESEND_API_KEY || '').trim() && (process.env.FROM_EMAIL || '').trim());
}

/** 메일에 넣을 사이트 주소 — APP_URL 우선, 없으면 요청 origin, 최후엔 null(링크 생략). */
export function resolveSiteUrl(headers: Record<string, string | string[] | undefined>): string | null {
  const fromEnv = (process.env.APP_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const origin = headers.origin;
  if (typeof origin === 'string' && /^https?:\/\//.test(origin)) return origin.replace(/\/+$/, '');
  return null;
}

/** 상품별 일진 캘린더 안내 — 조회 화면에서 같은 코드로 내려받는 무료 부가 서비스(CodeLookupTab). */
function iljinCalendarNote(product: string): string {
  const yearMatch = /^yearly(\d{4})$/.exec(product);
  return yearMatch
    ? `같은 화면에서 ${yearMatch[1]}년 열두 달 일진 캘린더 PDF(12p)와 이번 달·다음 달 일진 캘린더도 무료로 내려받을 수 있습니다.`
    : '같은 화면에서 이번 달·다음 달 일진 캘린더 PDF도 무료로 내려받을 수 있습니다.';
}

export function buildCodeEmail(params: { code: string; product: string; siteUrl: string | null }) {
  const label = PRODUCT_LABELS[params.product] ?? '사주 리포트';
  const lookupUrl = params.siteUrl ? `${params.siteUrl}/?tab=lookup` : null;
  const calendarNote = iljinCalendarNote(params.product);
  const subject = `[유아이 사주] ${label} 사주 코드 안내`;
  const text = [
    `${label}가 발급되었습니다.`,
    '',
    `사주 코드: ${params.code}`,
    '',
    lookupUrl
      ? `리포트 조회 화면(${lookupUrl})에서 위 코드를 입력하면 언제든 리포트를 다시 볼 수 있습니다.`
      : '사이트의 ‘리포트 조회’ 화면에서 위 코드를 입력하면 언제든 리포트를 다시 볼 수 있습니다.',
    '이 코드는 다음 리포트를 받으실 때도 그대로 쓰이니 이 메일을 보관해 주세요.',
    calendarNote,
    '',
    '입력하신 이메일 주소는 이 메일 발송에만 사용되었으며 저장되지 않습니다.',
  ].join('\n');
  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f1f1f">
  <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${label}가 발급되었습니다.</p>
  <div style="border:1px solid #ddd;border-radius:12px;padding:16px;text-align:center;margin:0 0 16px">
    <p style="font-size:12px;color:#777;margin:0 0 4px">사주 코드</p>
    <p style="font-size:26px;font-weight:bold;letter-spacing:4px;margin:0">${params.code}</p>
  </div>
  <p style="font-size:14px;line-height:1.6;margin:0 0 16px">‘리포트 조회’ 화면에서 위 코드를 입력하면 언제든 리포트를 다시 볼 수 있습니다. 이 코드는 다음 리포트를 받으실 때도 그대로 쓰이니 이 메일을 보관해 주세요.</p>
  <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${calendarNote}</p>
  ${lookupUrl ? `<p style="margin:0 0 24px"><a href="${lookupUrl}" style="display:inline-block;background:#1f1f1f;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 20px;border-radius:10px">리포트 조회하러 가기</a></p>` : ''}
  <p style="font-size:12px;color:#777;line-height:1.6;margin:0">입력하신 이메일 주소는 이 메일 발송에만 사용되었으며 저장되지 않습니다.</p>
</div>`;
  return { subject, text, html };
}

/**
 * 코드 안내 메일 발송. 절대 throw하지 않는다 — 결과만 boolean으로 돌려준다.
 * 주소가 없거나 형식이 틀리면 발송하지 않고 false.
 */
export async function sendCodeEmail(params: {
  to: unknown;
  code: string;
  product: string;
  siteUrl: string | null;
}): Promise<boolean> {
  const to = normalizeOptionalEmail(params.to);
  if (!to) return false;
  if (!isCodeEmailConfigured()) {
    console.warn('[code-email] RESEND_API_KEY/FROM_EMAIL 미설정 — 코드 메일 생략');
    return false;
  }
  const { subject, text, html } = buildCodeEmail(params);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.FROM_EMAIL!.trim(), to: [to], subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // 응답 본문에 수신 주소가 섞일 수 있으므로 상태 코드만 기록한다.
      console.error(`[code-email] Resend 실패 status=${res.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[code-email] Resend 호출 오류:', error instanceof Error ? error.name : 'unknown');
    return false;
  }
}
