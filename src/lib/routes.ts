// 현재 URL이 관리자 페이지인지 감지
export const isAdminRoute = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/admin' ||
    window.location.hash === '#admin' ||
    new URLSearchParams(window.location.search).get('admin') === 'true';
};

// 현재 URL이 리포트 제작 페이지인지 감지
export const isReportMakerRoute = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/report-maker' ||
    window.location.hash === '#report-maker';
};

export const isPremiumE2EMode = () => {
  if (typeof window === 'undefined') return false;
  const enabled = new URLSearchParams(window.location.search).get('e2e') === 'premium';
  return enabled && (import.meta.env.DEV || import.meta.env.MODE === 'test');
};
