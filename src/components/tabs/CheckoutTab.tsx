import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { TAB_TRANSITION } from '../../constants/styles';
import { PaperBackground } from '../welcome/PaperBackground';
import type { ProductType, ReportSection } from '../../lib/premiumOrderStore';
import type { BirthFormInput, ReportAskInput } from '../../lib/runReportGeneration';
import { buildMyeongsikFromBirth } from '../../lib/buildMyeongsik';
import { BirthInputFields, userDataToBirthStrings } from '../BirthInputFields';
import type { UserData } from '../../types/app';
import { PRODUCT_ACCESS } from '@/db/productAccess';

const LazyReportGenerationProgress = lazy(() => import('../report/ReportGenerationProgress'));

const PAPER_CARD = 'rounded-3xl border border-ink-300/30 bg-white shadow-sm';

// 토스페이먼츠 정식 승인 전까지 무료 개방(결제 없이 코드 발급 → 즉시 생성). 상품별 개방 여부는
// db/productAccess.ts PRODUCT_ACCESS가 단일 소스다. 승인 후 이 값을 false로 바꾸면 아래 토스 결제
// 경로가 그대로 활성화된다(결제 코드는 보존).
const FREE_OPEN = true;

// ⚠️ 가격은 서버 db/payment.ts PRODUCT_PRICES와 반드시 동기화(OWNER 확정 2026-07-09). 개방 상태는
//    db/productAccess.ts PRODUCT_ACCESS와 동기화. 무료 개방 중에는 가격 대신 '무료'로 표기한다.
const PRODUCT_CATALOG: Array<{ id: ProductType; label: string; price: number; desc: string }> = [
  { id: 'yearly2026', label: '2026 일년운세 리포트', price: 4900, desc: '2026년 열두 달의 흐름과 시기별 조언' },
  { id: 'premium', label: '평생 사주 리포트', price: 9900, desc: '대운 전체를 관통하는 평생 인생 네비게이션' },
  { id: 'jobCareer', label: '직업·재물운 리포트', price: 4900, desc: '적성·전직·재물의 때를 짚는 진로 가이드' },
  { id: 'loveMarriage', label: '연애·결혼운 리포트', price: 4900, desc: '인연의 결과 시기, 3년 흐름을 담은 가이드' },
];

const SESSION_KEY = 'sj_checkout_pending';

interface PendingCheckout {
  birth: BirthFormInput;
  product: ProductType;
  ask?: ReportAskInput;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const isOpen = (p: ProductType) => PRODUCT_ACCESS[p] === 'open';

/** 전역 userData(랜딩·상담과 공유) → 생성/명식 파이프 입력. */
function birthFromUserData(u: UserData): BirthFormInput {
  const { dateStr, timeStr } = userDataToBirthStrings(u);
  return {
    dateStr,
    timeStr,
    isLunar: u.calendarType !== 'solar',
    isLeap: u.calendarType === 'leap',
    gender: u.gender,
    unknownTime: u.unknownTime,
  };
}

// ─── 코드 표시 + 클립보드 복사 ────────────────────────────────────────────────

function CodeWithCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 API 불가 환경(비보안 컨텍스트 등) — 선택 가능한 텍스트로 폴백
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-ink-300/40 bg-paper-50 px-5 py-4">
      <p className="text-[12px] text-ink-500 text-center">사주 코드</p>
      <div className="mt-1 flex items-center justify-center gap-3">
        <p className="font-serif text-[28px] font-bold tracking-widest text-ink-900">{code}</p>
        <button
          onClick={() => void copy()}
          className={`shrink-0 px-3 py-1.5 rounded-xl border text-[13px] font-bold transition-colors ${
            copied
              ? 'border-ink-900 bg-ink-900 text-paper-50'
              : 'border-ink-300/40 text-ink-700 hover:border-ink-900/40'
          }`}
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
    </div>
  );
}

// ─── 결제 완료 화면 (코드 안내 + 자동 생성 → 조회 탭 자동 이동) ───────────────

function CheckoutDone({
  code,
  orderId,
  product,
  birth,
  ask,
  onReportReady,
}: {
  code: string;
  orderId: string;
  product: ProductType;
  birth: BirthFormInput;
  ask?: ReportAskInput;
  onReportReady?: (code: string) => void;
}) {
  const [sections, setSections] = useState<ReportSection[] | null>(null);

  const handleComplete = (s: ReportSection[]) => {
    setSections(s);
    // 생성 완료 → 리포트 조회 탭으로 자동 이동해 클릭 없이 표시(구매 화면에서 사전 안내됨).
    onReportReady?.(code);
  };

  return (
    <div className="space-y-6">
      <section className={`${PAPER_CARD} p-6 space-y-3`}>
        <h3 className="font-serif text-[18px] font-bold text-ink-900">리포트가 발급되었습니다</h3>
        <p className="text-[14px] text-ink-700 leading-relaxed">
          아래 <strong className="font-bold text-ink-900">사주 코드</strong>가 리포트의 유일한 열쇠입니다.{' '}
          <strong className="font-bold text-ink-900">복사 버튼으로 지금 저장해 두세요.</strong> 열람 기간이
          지나거나 기기를 바꿔도, ‘리포트 조회’에 이 코드를 붙여넣으면 언제든 다시 찾을 수 있습니다.
        </p>
        <CodeWithCopy code={code} />
        <p className="text-[12px] text-ink-500 leading-relaxed">
          개인정보는 저장되지 않으므로 코드를 분실하면 복구할 수 없습니다. 생성이 끝나면 리포트 조회
          화면으로 자동 이동해 바로 표시됩니다. 생성 도중 창이 닫혀도 괜찮습니다 — ‘리포트 조회’에서
          코드를 입력하면 추가 절차 없이 생성을 다시 시작할 수 있습니다.
        </p>
        <p className="text-[12px] text-ink-500 leading-relaxed border-t border-ink-300/20 pt-3">
          이 코드는 앞으로 다른 리포트를 받으실 때도 그대로 쓰입니다. 메모나 화면 캡처로 꼭 보관해
          두셨다가, 다음에 구매하실 때 ‘리포트 조회’에서 이 코드를 먼저 조회해 주세요. 사주를 다시
          입력할 필요가 없고, 구매 이력이 있는 코드는 재구매 할인 대상으로 안내됩니다.
        </p>
      </section>

      {sections ? (
        <section className={`${PAPER_CARD} p-6`}>
          <p className="text-[14px] text-ink-700 leading-relaxed">
            리포트가 생성되었습니다. 잠시 후 <strong className="font-bold text-ink-900">‘리포트 조회’</strong>로
            자동 이동합니다. 이동하지 않으면 조회 탭에서 위 코드를 입력해 주세요.
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
            ask={ask}
            autoStart
            onComplete={handleComplete}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── 메인 탭 ────────────────────────────────────────────────────────────────

type Step = 'select' | 'birth' | 'pay' | 'confirming' | 'done' | 'error';

interface CheckoutTabProps {
  initialProduct?: ProductType;
  /** 전역 생년월일시(App userData) — 랜딩·상담·만세력과 단일 소스 공유. */
  userData: UserData;
  setUserData: (u: UserData) => void;
  currentSeoulYear: number;
  /** 생년월일 확정 시(다음 단계 진입) — App이 상담·만세력용 사주 분석을 미리 계산한다. */
  onBirthConfirmed?: (u: UserData) => void;
  /** 리포트 생성 완료 시 — App이 조회 탭으로 자동 이동해 코드를 자동 조회한다. */
  onReportReady?: (code: string) => void;
}

export default function CheckoutTab({
  initialProduct,
  userData,
  setUserData,
  currentSeoulYear,
  onBirthConfirmed,
  onReportReady,
}: CheckoutTabProps) {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;

  const [step, setStep] = useState<Step>('select');
  const [product, setProduct] = useState<ProductType | null>(null);
  // 가장 알고 싶은 것·가장 큰 고민 — 선택 입력, 리포트 프롬프트에만 사용.
  const [interest, setInterest] = useState('');
  const [concern, setConcern] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    code: string;
    orderId: string;
    product: ProductType;
    birth: BirthFormInput;
    ask?: ReportAskInput;
  } | null>(null);

  const catalogItem = PRODUCT_CATALOG.find((p) => p.id === product) ?? null;
  const ask: ReportAskInput = { interest, concern };

  const selectProduct = (id: ProductType) => {
    if (!isOpen(id)) return; // 준비중 상품은 진행 불가
    setError(null);
    setProduct(id);
    setStep('birth');
  };

  // 결제 후 successUrl로 돌아왔을 때 confirm 처리 (마운트 1회). 무료 개방 중에는 return 파라미터가
  // 없으므로 이 경로는 건너뛰고, 대신 랜딩에서 넘어온 initialProduct(개방 상품)를 미리 선택한다.
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
      return;
    }
    if (initialProduct && isOpen(initialProduct)) {
      setProduct(initialProduct);
      setStep('birth');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanUrl = () => {
    window.history.replaceState({}, '', window.location.pathname);
  };

  // ── 무료 개방 발급 (토스 없이 코드+주문 → 즉시 자동 생성) ──
  const requestFree = async () => {
    if (!product || !catalogItem || busy) return;
    setError(null);
    setBusy(true);
    const birth = birthFromUserData(userData);
    try {
      const res = await fetch('/api/payment/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, myeongsik: buildMyeongsikFromBirth(birth) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || '발급에 실패했습니다.');
      setDone({ code: data.code, orderId: data.orderId, product, birth, ask });
      setStep('done');
    } catch (e) {
      setStep('error');
      setError(e instanceof Error ? e.message : '발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ── 토스 결제 승인 (정식 오픈 후 FREE_OPEN=false 시 활성화) ──
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
      setDone({ code: data.code, orderId: data.orderId, product: pending.product, birth: pending.birth, ask: pending.ask });
      setStep('done');
    } catch (e) {
      setStep('error');
      setError(e instanceof Error ? e.message : '결제 승인에 실패했습니다.');
      cleanUrl();
    }
  };

  const requestPay = async () => {
    if (!clientKey || !product || !catalogItem || busy) return;
    setError(null);
    setBusy(true);
    const orderNo = `sj-${crypto.randomUUID()}`;
    const pending: PendingCheckout = { birth: birthFromUserData(userData), product, ask };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(pending));
    try {
      const toss = await loadTossPayments(clientKey);
      const payment = toss.payment({ customerKey: ANONYMOUS });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: catalogItem.price },
        orderId: orderNo,
        orderName: catalogItem.label,
        successUrl: `${window.location.origin}${window.location.pathname}?checkout=return`,
        failUrl: `${window.location.origin}${window.location.pathname}?checkout=fail`,
        card: { useEscrow: false, flowMode: 'DEFAULT', useCardPoint: false, useAppCardOnly: false },
      });
    } catch (e) {
      sessionStorage.removeItem(SESSION_KEY);
      setError(e instanceof Error ? e.message : '결제 요청이 중단되었습니다.');
      setBusy(false);
    }
  };

  const goPay = () => {
    setError(null);
    // 입력한 생년월일시를 상담·만세력에도 즉시 재사용할 수 있도록 App에 알린다.
    onBirthConfirmed?.(userData);
    setStep('pay');
  };

  const askField =
    'w-full rounded-xl border border-ink-300/40 bg-white px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-300';

  // 무료 개방 중에는 토스 clientKey가 없어도 진행 가능. 정식 결제(FREE_OPEN=false) 시에만 키가 필요하다.
  const paymentBlocked = !FREE_OPEN && !clientKey;

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
            <h2 className="font-serif text-[28px] md:text-[36px] font-bold text-ink-900 leading-tight">리포트 받기</h2>
            <p className="text-[14px] text-ink-500 leading-relaxed">
              {FREE_OPEN
                ? '지금은 무료로 개방 중입니다. 발급되는 사주 코드로 리포트를 열람하며, 개인정보는 저장되지 않습니다.'
                : '결제 후 발급되는 사주 코드로 리포트를 열람합니다. 개인정보는 저장되지 않으며, 코드가 유일한 열쇠입니다.'}
            </p>
          </header>

          {paymentBlocked && step !== 'done' && (
            <section className={`${PAPER_CARD} p-6`}>
              <p className="text-[14px] text-ink-700">결제 준비 중입니다. 잠시 후 다시 이용해 주세요.</p>
            </section>
          )}

          {error && step !== 'error' && <p className="text-[12px] text-red-600 text-center">{error}</p>}

          {/* 1) 상품 선택 — 개방(무료) 상품은 선택 가능, 준비중 상품은 배지 표시 */}
          {!paymentBlocked && step === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRODUCT_CATALOG.map((p) => {
                const open = isOpen(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p.id)}
                    disabled={!open}
                    aria-disabled={!open}
                    className={`${PAPER_CARD} p-5 text-left transition-colors ${
                      open ? 'hover:border-ink-900/40' : 'opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif text-[18px] font-bold text-ink-900">{p.label}</p>
                      {open ? (
                        FREE_OPEN && (
                          <span className="shrink-0 rounded-full bg-seal/10 text-seal text-[12px] font-bold px-2.5 py-1">
                            무료 오픈
                          </span>
                        )
                      ) : (
                        <span className="shrink-0 rounded-full bg-ink-300/20 text-ink-500 text-[12px] font-bold px-2.5 py-1">
                          준비중
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">{p.desc}</p>
                    <p className="text-[14px] font-bold text-ink-900 mt-3">
                      {open && FREE_OPEN ? (
                        <>
                          무료 <span className="text-[12px] font-normal text-ink-500 line-through ml-1">{won(p.price)}</span>
                        </>
                      ) : !open ? (
                        <span className="text-[12px] font-normal text-ink-500">곧 순차적으로 열립니다</span>
                      ) : (
                        won(p.price)
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2) 생년월일시 + 질문·고민 입력 — 랜딩 무료운세와 동일 UI, 전역 공유(1회 입력 재사용) */}
          {!paymentBlocked && step === 'birth' && catalogItem && (
            <section className={`${PAPER_CARD} p-6 space-y-5`}>
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-[18px] font-bold text-ink-900">{catalogItem.label}</h3>
                <button onClick={() => setStep('select')} className="text-[12px] text-ink-500 underline">
                  상품 변경
                </button>
              </div>
              <p className="text-[14px] text-ink-500 leading-relaxed">
                생년월일과 태어난 시간을 확인해 주세요. 사이트에서 이미 입력하셨다면 그대로 채워져
                있습니다. 여기서 입력한 정보는 상담·만세력에서도 다시 입력할 필요 없이 그대로 사용되며,
                사주 계산에만 쓰이고 저장되지 않습니다.
              </p>

              <BirthInputFields value={userData} onChange={setUserData} currentSeoulYear={currentSeoulYear} />

              <div className="space-y-3 border-t border-ink-300/20 pt-4">
                <label className="block space-y-1">
                  <span className="text-[12px] text-ink-500">가장 알고 싶은 것 (선택)</span>
                  <input
                    type="text"
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    placeholder="예: 올해 이직 시기, 건강운, 재물 흐름"
                    maxLength={200}
                    className={askField}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[12px] text-ink-500">가장 큰 고민 (선택)</span>
                  <textarea
                    value={concern}
                    onChange={(e) => setConcern(e.target.value)}
                    placeholder="지금 가장 마음에 걸리는 일을 적어 주시면 리포트 첫 장에서 먼저 답해 드립니다."
                    maxLength={500}
                    rows={3}
                    className={`${askField} resize-none`}
                  />
                </label>
                <p className="text-[12px] text-ink-500 leading-relaxed">
                  적어 주신 내용은 리포트 생성에만 사용됩니다. 이름·연락처 등 개인정보는 적지 말아 주세요.
                </p>
              </div>

              <button onClick={goPay} className="px-5 py-2.5 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold">
                {FREE_OPEN ? '다음' : `결제 단계로 (${won(catalogItem.price)})`}
              </button>
            </section>
          )}

          {/* 3) 발급/결제 확인 */}
          {!paymentBlocked && step === 'pay' && catalogItem && (
            <section className={`${PAPER_CARD} p-6 space-y-4`}>
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-[18px] font-bold text-ink-900">{catalogItem.label}</h3>
                <span className="text-[14px] font-bold text-ink-900">{FREE_OPEN ? '무료' : won(catalogItem.price)}</span>
              </div>
              {FREE_OPEN ? (
                <>
                  <p className="text-[14px] text-ink-500 leading-relaxed">
                    아래 버튼을 누르면 사주 코드가 발급되고 리포트 생성이 바로 시작됩니다. 생성은 약 2분
                    걸리며, 끝나면 <strong className="font-bold text-ink-700">리포트 조회 화면으로 자동 이동해 바로 표시됩니다.</strong>
                  </p>
                  <p className="text-[12px] text-ink-500 leading-relaxed border-t border-ink-300/20 pt-3">
                    발급되는 사주 코드는 재열람의 유일한 열쇠입니다. 코드 옆 복사 버튼으로 저장해 두시면,
                    나중에 ‘리포트 조회’에 붙여넣어 언제든 다시 볼 수 있습니다. 리포트는 입력하신 사주
                    정보로 개별 생성되는 맞춤형 콘텐츠이며, 오류로 정상 열람이 불가능한 경우 재생성됩니다.
                  </p>
                  <button
                    onClick={() => void requestFree()}
                    disabled={busy}
                    className="w-full px-5 py-3 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold disabled:opacity-40"
                  >
                    {busy ? '발급 중...' : '무료로 리포트 받기'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[14px] text-ink-500 leading-relaxed">
                    아래 버튼을 누르면 토스페이먼츠 결제창이 열립니다. 결제가 끝나면 리포트 코드가 발급되고
                    생성이 시작되며, 생성이 끝나면 리포트 조회 화면으로 자동 이동해 바로 표시됩니다. 코드는
                    복사 버튼으로 꼭 저장해 두세요.
                  </p>
                  {/* 청약철회 제한 사전 고지 — 전자상거래법 17조 2항. 취소·환불 정책과 문구 정합 유지. */}
                  <p className="text-[12px] text-ink-500 leading-relaxed border-t border-ink-300/20 pt-3">
                    리포트는 사주 정보를 바탕으로 개별 생성되는 맞춤형 디지털 콘텐츠로, 생성이 완료된 후에는
                    청약철회(환불)가 불가합니다. 생성 전에는 전액 환불되며, 오류로 정상 열람이 불가능한 경우에는
                    생성 후에도 재생성 또는 전액 환불해 드립니다. 결제 진행 시 위 내용에 동의한 것으로 봅니다.
                    자세한 내용은 하단 '취소·환불 정책'을 확인해 주세요.
                  </p>
                  <button
                    onClick={() => void requestPay()}
                    disabled={busy}
                    className="w-full px-5 py-3 rounded-xl bg-ink-900 text-paper-50 text-[14px] font-bold disabled:opacity-40"
                  >
                    {busy ? '결제창 여는 중...' : `${won(catalogItem.price)} 결제하기`}
                  </button>
                </>
              )}
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
            <CheckoutDone
              code={done.code}
              orderId={done.orderId}
              product={done.product}
              birth={done.birth}
              ask={done.ask}
              onReportReady={onReportReady}
            />
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
