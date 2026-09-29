import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCodeEmail, normalizeOptionalEmail, resolveSiteUrl, sendCodeEmail } from './code-email';

describe('normalizeOptionalEmail', () => {
  it('정상 주소는 앞뒤 공백만 제거해 돌려준다', () => {
    expect(normalizeOptionalEmail('  user@example.com ')).toBe('user@example.com');
  });
  it('비었거나 형식이 틀리거나 문자열이 아니면 null', () => {
    for (const v of ['', '   ', 'user', 'user@', '@example.com', 'a@b', 'a b@c.com', 'a@b.com,c@d.com', 'x<y>@z.com', null, 123]) {
      expect(normalizeOptionalEmail(v)).toBeNull();
    }
  });
  it('254자를 넘으면 null', () => {
    expect(normalizeOptionalEmail(`${'a'.repeat(250)}@b.com`)).toBeNull();
  });
});

describe('buildCodeEmail', () => {
  it('코드·상품명·조회 링크를 담고 주소를 링크에 넣지 않는다', () => {
    const mail = buildCodeEmail({ code: 'ABC234', product: 'yearly2026', siteUrl: 'https://site.test' });
    expect(mail.subject).toContain('2026 일년운세 리포트');
    expect(mail.text).toContain('ABC234');
    expect(mail.html).toContain('ABC234');
    expect(mail.html).toContain('https://site.test/?tab=lookup');
    // 코드를 URL에 싣지 않는다(접속 로그·분석 도구 노출 방지)
    expect(mail.html).not.toContain('code=ABC234');
  });
  it('사이트 주소가 없으면 링크 버튼을 생략한다', () => {
    const mail = buildCodeEmail({ code: 'ABC234', product: 'premium', siteUrl: null });
    expect(mail.html).not.toContain('<a ');
  });
});

describe('resolveSiteUrl', () => {
  const saved = process.env.APP_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = saved;
  });
  it('APP_URL 우선, 없으면 origin 헤더', () => {
    process.env.APP_URL = 'https://app.test/';
    expect(resolveSiteUrl({ origin: 'https://other.test' })).toBe('https://app.test');
    delete process.env.APP_URL;
    expect(resolveSiteUrl({ origin: 'https://other.test' })).toBe('https://other.test');
    expect(resolveSiteUrl({})).toBeNull();
  });
});

describe('sendCodeEmail', () => {
  const env = { ...process.env };
  const fetchMock = vi.fn();
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.FROM_EMAIL = 'noreply@site.test';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('주소가 없으면 발송하지 않는다', async () => {
    expect(await sendCodeEmail({ to: '', code: 'ABC234', product: 'premium', siteUrl: null })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Resend 키가 없으면 발송하지 않는다', async () => {
    delete process.env.RESEND_API_KEY;
    expect(await sendCodeEmail({ to: 'u@example.com', code: 'ABC234', product: 'premium', siteUrl: null })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('성공하면 true, 수신자·코드를 Resend에 넘긴다', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await sendCodeEmail({ to: 'u@example.com', code: 'ABC234', product: 'premium', siteUrl: null })).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['u@example.com']);
    expect(body.from).toBe('noreply@site.test');
    expect(body.text).toContain('ABC234');
  });

  it('Resend 실패·네트워크 오류는 throw 없이 false, 로그에 주소를 남기지 않는다', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response('bad u@example.com', { status: 422 }));
    expect(await sendCodeEmail({ to: 'u@example.com', code: 'ABC234', product: 'premium', siteUrl: null })).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('network down u@example.com'));
    expect(await sendCodeEmail({ to: 'u@example.com', code: 'ABC234', product: 'premium', siteUrl: null })).toBe(false);
    const logged = errSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).not.toContain('u@example.com');
    errSpy.mockRestore();
  });
});
