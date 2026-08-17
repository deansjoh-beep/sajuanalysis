import { FREE_OPEN } from '@/db/productAccess';

/**
 * 토스 가맹 승인 전 테스트 결제 구간 고지.
 *
 * 결제창은 정상 노출되고 코드·리포트도 정상 발급되지만 테스트 키(test_ck_)라 실제 승인은
 * 일어나지 않는다. 가격이 그대로 표시되는 상태에서 이를 알리지 않으면 소비자 오인이므로
 * 랜딩(PremiumProductsSection)과 구매 화면(CheckoutTab) 양쪽에 같은 문구를 노출한다.
 *
 * 조건은 실제 사용 중인 키를 보고 판단한다 — 라이브 키로 교체해 재배포하면 고지가 스스로
 * 사라지고, 실결제 중인데 "무료 발급" 안내가 남는 사고도 구조적으로 막힌다.
 * ⚠️ 문구를 고칠 때는 이 파일만 고치면 두 화면에 함께 반영된다.
 */
const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;

export const isTossTestMode = (): boolean => !FREE_OPEN && Boolean(clientKey?.startsWith('test_'));

export function TossTestModeNotice({ className = '' }: { className?: string }) {
  if (!isTossTestMode()) return null;
  return (
    <p className={`text-[14px] text-ink-700 leading-relaxed ${className}`}>
      지금은 토스페이먼츠 가맹 승인 절차 중이라 고객님께 테스트 결제창이 열립니다. 실제 결제는
      이루어지지 않습니다.{' '}
      <strong className="font-bold text-ink-900">
        테스트 결제를 실제로 진행하셔도 유료 리포트는 무료로 발급됩니다.
      </strong>
    </p>
  );
}
