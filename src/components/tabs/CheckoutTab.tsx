import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { TAB_TRANSITION } from '../../constants/styles';
import { PaperBackground } from '../welcome/PaperBackground';
import type { ProductType, ReportSection } from '../../lib/premiumOrderStore';
import type { BirthFormInput } from '../../lib/runReportGeneration';
import { buildMyeongsikFromBirth } from '../../lib/buildMyeongsik';

const LazyReportGenerationProgress = lazy(() => import('../report/ReportGenerationProgress'));

const PAPER_CARD = 'rounded-3xl border border-ink-300/30 bg-white shadow-sm';

// ⛔ 가격은 서버 db/payment.ts PRODUCT_PRICES와 반드시 동기화(임시가). 서버가 amount를 재검증하므로
//    불일치 시 결제는 거부되지만, 표시 금액이 어긋나면 UX가 깨지므로 값 변경 시 양쪽을 같이 고칠 것.
const PRODUCT_CATALOG: Array<{ id: ProductType; label: string; price: number; desc: string }> = [
  { id: 'yearly2026', label: '2026 일년운세 리포트', price: 49000, desc: '2026년 열두 달의 흐름과 시기별 조언' },
  { id: 'premium', label: '평생 사주 리포트', price: 99000, desc: '대운 전체를 관통하는 평생 인생 네비게이션' },
  { id: 'jobCareer', label: '직업·재물운 리포트', price: 39000, desc: '적성·전직·재물의 때를 짚는 진로 가이드' },
  { id: 'loveMarriage', label: '연애·결혼운 리포트', price: 39000, desc: '인연의 결과 시기, 3년 흐름을 담은 가이드' },
];

const SESSION_KEY = 'sj_checkout_pending';

interface PendingCheckout {
  birth: BirthFormInput;
  product: ProductType;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

// ─── 결제 완료 화면 (코드 안내 + 자동 생성) ──────────────────────────────────

function CheckoutDone({
  code,
  orderId,
  product,
  birth,
}: {
  code: string;
  orderId: string;
  product: ProductType;
  birth: BirthFormInput;
}) {
  const [sections, setSections] = useState<ReportSection[] | null>(null);

  return (
    <div className="space-y-6">
      <section className={`${PAPER_CARD} p-6 space-y-3`}>
        <h3 className="font-serif text-[18px] font-bold text-ink-900">결제가 완료되었습니다</h3>
        <p className="text-[14px] text-ink-700 leading-relaxed">
          아래 <strong className="font-bold text-ink-900">사주 코드</strong>가 리포트의 유일한 열쇠입니다. 반드시
          저장해 두세요. 열람 기간이 지나거나 기기를 바꿔도 이 코드로 다시 찾을 수 있습니다.
        </p>
        <div className="rounded-2xl border border-ink-300/40 bg-paper-50 px-5 py-4 text-center">
          <p className="text-[12px] text-ink-500">사주 코드</p>
          <p className="font-serif text-[28px] font-bold tracking-widest text-ink-900 mt-1">{code}</p>
        </div>
      </section>

      {sections ? (
        <section className={`${PAPER_CARD} p-6`}>
          <p className="text-[14px] text-ink-700 leading-relaxed">
            리포트가 생성되었습니다. <strong className="font-bold text-ink-900">‘리포트 조회’ 탭</strong>에서 위
            코드를 입력하면 전체 내용을 열람하고 PDF로 저장할 수 있습니다.
          </p>
        </section>
      ) : (
        <Suspense
          fallback={
            <section className={`${PAPER_CARD} p-6`}>
              <p className="text-[14px] text-ink-500">생성 도구를 불러오는 중...</p>
            </section>
          }
        >
          <LazyReportGenerationProgress
            code={code}
            orderId={orderId}
            product={product}
            birth={birth}
            autoStart
            onComplete={setSections}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── 메인 탭 ────────────────────────────────────────────────────────────────

type Step = 'select' | 'birth' | 'pay' | 'confirming' | 'done' | 'error';

export default function CheckoutTab() {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;

  const [step, setStep] = useState<Step>('select');
  const [product, setProduct] = useState<ProductType | null>(null);
  const [birth, setBirth] = useState<BirthFormInput>({
    dateStr: '',
    timeStr: '12:00',
    isLunar: false,
    gender: 'M',
    unknownTime: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; orderId: string; product: ProductType; birth: BirthFormInput } | null>(null);

  const widgetsRef = useRef<any>(null);
  const rendered = useRef(false);

  const catalogItem = PRODUCT_CATALOG.find((p) => p.id === product) ?? null;

  // 결제 후 successUrl로 돌아왔을 때 confirm 처리 (마운트 1회).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('checkout');
    if (flag === 'fail') {
      setStep('error');
      setError(params.get('message') || '결제가 취소되었거나 실패했습니다.');
      cleanUrl();
      return;
    }
    const paymentKey = params.get('paymentKey');
    const orderId = params.get('orderId');
    const amount = params.get('amount');
    if (paymentKey && orderId && amount) {
      void confirmReturn(paymentKey, orderId, Number(amount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanUrl = () => {
    window.history.replaceState({}, '', window.location.pathname);
  };

  const confirmReturn = async (paymentKey: string, orderId: string, amount: number) => {
    setStep('confirming');
    let pending: PendingCheckout | null = null;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) pending = JSON.parse(raw) as PendingCheckout;
    } catch {
      pending = null;
    }
    if (!pending) {
      setStep('error');
      setError('결제 정보를 찾을 수 없습니다. 결제가 정상 처리되었다면 잠시 후 ‘리포트 조회’ 탭에서 문의해 주세요.');
      cleanUrl();
      return;
    }
    try {
      const res = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
          product: pending.product,
          gift: false,
          myeongsik: buildMyeongsikFromBirth(pending.birth),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || '결제 승인에 실패했습니다.');
      sessionStorage.removeItem(SESSION_KEY);
      cleanUrl();
      setDone({ code: data.code, orderId: data.orderId, product: pending.product, birth: pending.birth });
      setStep('done');
    } catch (e) {
      setStep('error');
      setError(e instanceof Error ? e.message : '결제 승인에 실패했습니다.');
      cleanUrl();
    }
  };

  // 결제 단계 진입 시 위젯 렌더.
  useEffect(() => {
    if (step !== 'pay' || !clientKey || !catalogItem || rendered.current) return;
    rendered.current = true;
    (async () => {
      try {
        const toss = await loadTossPayments(clientKey);
        const widgets = toss.widgets({ customerKey: ANONYMOUS });
        widgetsRef.current = widgets;
        await widgets.setAmount({ currency: 'KRW', value: catalogItem.price });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#toss-payment-methods', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#toss-agreement', variantKey: 'AGREEMENT' }),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : '결제창을 불러오지 못했습니다.');
        setStep('error');
      }
    })();
  }, [step, clientKey, catalogItem]);

  const requestPay = async () => {
    if (!widgetsRef.current || !product) return;
    // orderNo: Toss orderId 규칙(영숫자+-,_ 6~64자) 충족. DB orders.orderNo로 저장됨.
    const orderNo = `sj-${crypto.randomUUID()}`;
    const pending: PendingCheckout = { birth, product };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(pending));
    try {
      await widgetsRef.current.requestPayment({
        orderId: orderNo,
        orderName: catalogItem?.label ?? '사주 리포트',
        successUrl: `${window.location.origin}${window.location.pathname}?checkout=return`,
        failUrl: `${window.location.origin}${window.location.pathname}?checkout=fail`,
      });
    } catch (e) {
      // 사용자가 결제창을 닫은 경우 등 — 세션 정리 후 결제 단계 유지.
      sessionStorage.removeItem(SESSION_KEY);
      setError(e instanceof Error ? e.message : '결제 요청이 중단되었습니다.');
    }
  };

  const goPay = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth.dateStr)) {
      setError('생년월일을 입력해 주세요.');
      return;
    }
    setError(null);
    rendered.current = false;
    setStep('pay');
  };

  const field = 'w-full rounded-xl border border-ink-300/40 bg-white px-3 py-2 text-[14px] text-ink-900';

  return (
    <motion.div
      key="checkout"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={TAB_TRANSITION}
      className="absolute inset-0 overflow-y-auto hide-scrollbar bg-paper-50"
      data-theme="light"
    >
      <div className="sticky top-0 left-0 w-full h-screen pointer-events-none -mb-[100vh]">
        <PaperBackground />
      </div>

      <div className="relative px-4 py-10 md:py-14 md:px-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="text-center space-y-3 pt-2 pb-2">
            <h2 className="font-serif text-[28px] md:text-[36px] font-bold text-ink-900 leading-tight">리포트 구매</h2>
            <p className="text-[14px] text-ink-500 leading-relaxed">
              결제 후 발급되는 사주 코드로 리포트를 열람합니다. 개인정보는 저장되지 않으며, 코드가 유일한 열쇠입니다.
            </p>
          </header>

          {!clientKey && step !== 'done' && (
            <section className={`${PAPER_CARD} p-6`}>
              <p className="text-[14px] text-ink-700">결제 준비 중입니다. 잠시 후 다시 이용해 주세요.</p>
            </section>
          )}

          {error && step !== 'error' && <p className="text-[12px] text-red-600 text-center">{error}</p>}

          {/* 1) 상품 선택 */}
          {clientKey && step === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRODUCT_CATALOG.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProduct(p.id);
                    setStep('birth');
                  }}
                  className={`${PAPER_CARD} p-5 text-left hover:border-ink-900/40 transition-colors`}
                >
                  <p className="font-serif text-[18px] font-bold text-ink-900">{p.label}</p>
                  <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">{p.desc}</p>
                  <p className="text-[14px] font-bold text-ink-900 mt-3">{won(p.price)}</p>
                </button>
              ))}
            </div>
          )}

          {/* 2) 생년월일 입력 */}
          {clientKey && step === 'birth' && catalogItem && (
            <section className={`${PAPER_CARD} p-6 space-y-4`}>
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-[18px] font-bold text-ink-900">{catalogItem.label}</h3>
                <button onClick={() => setStep('select')} className="text-[12px] text-ink-500 underline">
                  상품 변경
                </button>
              </div>
              <p className="text-[14px] text-ink-500 leading-relaxed">
                생년월일과 태어난 시간을 입력해 주세요. 이 정보는 사주 계산에만 쓰이고 저장되지 않습니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[12px] text-ink-500">생년월일</span>
                  <input
                    type="date"
                    value={birth.dateStr}
                    onChange={(e) => setBirth((b) => ({ ...b, dateStr: e.target.value }))}
                    className={field}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[12px] text-ink-500">태어난 시간</span>
                  <input
                    type="time"
                    value={birth.timeStr}
                    disabled={birth.unknownTime}
                    onChange={(e) => setBirth((b) => ({ ...b, timeStr: e.target.value }))}
                    className={`${field} disabled:opacity-40`}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[14px] text-ink-700">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={birth.gender === 'M'} onChange={() => setBirth((b) => ({ ...b, gender: 'M' }))} /> 남성
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={birth.gender === 'F'} onChange={() => setBirth((b) => ({ ...b, gender: 'F' }))} /> 여성
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={birth.isLunar} onChange={(e) => setBirth((b) => ({ ...b, isLunar: e.target.checked }))} /> 음력
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={birth.unknownTime} onChange={(e) => setBirth((b) => ({ ...b, unknownTime: e.target.checked }))} /> 시간 모름
                </label>
              </div>
              <button
                onClick={goPay}
                className="px-5 py-2.5 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold"
              >
                결제 단계로 ({won(catalogItem.price)})
              </button>
            </section>
          )}

          {/* 3) 결제 위젯 */}
          {clientKey && step === 'pay' && catalogItem && (
            <section className={`${PAPER_CARD} p-6 space-y-4`}>
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-[18px] font-bold text-ink-900">{catalogItem.label}</h3>
                <span className="text-[14px] font-bold text-ink-900">{won(catalogItem.price)}</span>
              </div>
              <div id="toss-payment-methods" />
              <div id="toss-agreement" />
              <button
                onClick={() => void requestPay()}
                className="w-full px-5 py-3 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold"
              >
                {won(catalogItem.price)} 결제하기
              </button>
              <button onClick={() => setStep('birth')} className="text-[12px] text-ink-500 underline">
                이전으로
              </button>
            </section>
          )}

          {/* 4) 승인 처리 중 */}
          {step === 'confirming' && (
            <section className={`${PAPER_CARD} p-6`}>
              <p className="text-[14px] text-ink-700">결제를 승인하고 있습니다. 잠시만 기다려 주세요...</p>
            </section>
          )}

          {/* 5) 완료 */}
          {step === 'done' && done && (
            <CheckoutDone code={done.code} orderId={done.orderId} product={done.product} birth={done.birth} />
          )}

          {/* 오류 */}
          {step === 'error' && (
            <section className={`${PAPER_CARD} p-6 space-y-3`}>
              <p className="text-[14px] text-red-600">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setStep('select');
                }}
                className="px-4 py-2 rounded-xl border border-ink-300/40 text-ink-700 text-[13px] font-bold"
              >
                처음으로
              </button>
            </section>
          )}
        </div>
      </div>
    </motion.div>
  );
}
