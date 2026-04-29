export const DEFAULT_ADMIN_EMAILS = ['dean.uitrading@gmail.com', 'dean.sj.oh@gmail.com'];

export const normalizeEmail = (email: string | null | undefined) => {
  return String(email || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();
};

export const normalizeEmailForCompare = (email: string | null | undefined) => {
  const normalized = normalizeEmail(email);
  const [localPartRaw, domainRaw] = normalized.split('@');
  const localPart = localPartRaw || '';
  const domain = domainRaw || '';

  if (!localPart || !domain) {
    return normalized;
  }

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const withoutPlus = localPart.split('+')[0] || '';
    const withoutDots = withoutPlus.replace(/\./g, '');
    return `${withoutDots}@gmail.com`;
  }

  return `${localPart}@${domain}`;
};

export const getAllowedAdminEmails = (): string[] => {
  const fromWindow = String((window as any).ADMIN_EMAILS || '').trim();
  const fromVite = String((import.meta as any).env.VITE_ADMIN_EMAILS || '').trim();
  const fromProcess = String(
    (typeof process !== 'undefined' && process.env && process.env.ADMIN_EMAILS) || '',
  ).trim();

  const raw = fromWindow || fromVite || fromProcess;
  if (!raw) {
    return DEFAULT_ADMIN_EMAILS;
  }

  const parsed = raw
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  const deduped = Array.from(new Set(parsed));
  return deduped.length > 0 ? deduped : DEFAULT_ADMIN_EMAILS;
};
