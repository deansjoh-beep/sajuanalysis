import React, { useState } from 'react';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import {
  PremiumOrder,
  LifeEvent,
  createPremiumOrder,
  getOrderByIdAndEmail,
  updateOrderContent,
  cancelPremiumOrder,
} from '../lib/premiumOrderStore';

// ─────────────────────────────── 상태 배지 ───────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted:  { label: '접수 완료',  color: 'bg-blue-100 text-blue-700' },
  generating: { label: '제작 중',    color: 'bg-yellow-100 text-yellow-700' },
  reviewing:  { label: '검토 중',    color: 'bg-purple-100 text-purple-700' },
  delivered:  { label: '발송 완료',  color: 'bg-green-100 text-green-700' },
  rejected:   { label: '반려됨',     color: 'bg-red-100 text-red-700' },
  cancelled:  { label: '취소됨',     color: 'bg-zinc-100 text-zinc-500' },
};

// ─────────────────────────────── 섹션 타이틀 ───────────────────────────────
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[13px] font-bold text-zinc-700 mb-3">{children}</h3>
);

// ─────────────────────────────── 입력 라벨 ───────────────────────────────
const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-[11px] font-bold text-zinc-600 mb-1">
    {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
  </label>
);

// ─────────────────────────────── 인풋 클래스 ───────────────────────────────
const inputCls = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition';
const errorCls = 'text-[11px] text-rose-500 mt-1';

const BIRTH_YEAR_MIN = 1900;
const BIRTH_TIME_MINUTES = ['00', '10', '20', '30', '40', '50'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─────────────────────────────── 외부에서 프리필용 UserData ───────────────────────────────
export interface PrefillUserData {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  calendarType: 'solar' | 'lunar' | 'leap';
  gender: 'M' | 'F';
  unknownTime: boolean;
}

export type OrderProductType = 'premium' | 'yearly2026' | 'jobCareer';

// ─────────────────────────────── 폼 초기값 ───────────────────────────────
interface OrderFormState {
  name: string;
  email: string;
  gender: 'M' | 'F' | '';
  birthDate: string;
  birthTime: string;
  unknownTime: boolean;
  isLunar: boolean;
  isLeap: boolean;
  concern: string;
  interest: string;
  reportLevel: 'basic' | 'advanced' | 'both' | '';
  lifeEvents: LifeEvent[];
  currentJob: string;
  workHistory: string;
}

const emptyForm: OrderFormState = {
  name: '',
  email: '',
  gender: '',
  birthDate: '',
  birthTime: '',
  unknownTime: false,
  isLunar: false,
  isLeap: false,
  concern: '',
  interest: '',
  reportLevel: '',
  lifeEvents: [],
  currentJob: '',
  workHistory: '',
};

const buildInitialForm = (userData?: PrefillUserData): OrderFormState => {
  if (!userData) return emptyForm;
  const y = userData.birthYear?.padStart(4, '0') || '';
  const m = userData.birthMonth?.padStart(2, '0') || '';
  const d = userData.birthDay?.padStart(2, '0') || '';
  const birthDate = y && m && d ? `${y}-${m}-${d}` : '';
  const hh = userData.birthHour?.padStart(2, '0') || '';
  const mm = userData.birthMinute?.padStart(2, '0') || '';
  const birthTime = hh && mm ? `${hh}:${mm}` : '';
  return {
    ...emptyForm,
    name: userData.name || '',
    gender: userData.gender || '',
    birthDate,
    birthTime,
    unknownTime: userData.unknownTime,
    isLunar: userData.calendarType !== 'solar',
    isLeap: userData.calendarType === 'leap',
  };
};

// ─────────────────────────────── 유효성 검사 ───────────────────────────────
function validate(form: OrderFormState, productType: OrderProductType): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.name.trim()) errs.name = '이름을 입력해주세요.';
  if (!form.email.trim()) errs.email = '이메일을 입력해주세요.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = '올바른 이메일 형식이 아닙니다.';
  if (!form.gender) errs.gender = '성별을 선택해주세요.';
  if (!form.birthDate) errs.birthDate = '생년월일을 입력해주세요.';
  if (productType === 'premium' && !form.reportLevel) {
    errs.reportLevel = '리포트 구성을 선택해주세요.';
  }
  if ((productType === 'yearly2026' || productType === 'jobCareer') && !form.currentJob.trim()) {
    errs.currentJob = '현재 하고 계신 일을 입력해주세요.';
  }
  if (productType === 'jobCareer' && !form.concern.trim()) {
    errs.concern = '커리어 고민을 입력해주세요.';
  }
  if (productType === 'jobCareer' && !form.interest.trim()) {
    errs.interest = '원하는 방향을 입력해주세요.';
  }
  return errs;
}

// ─────────────────────────────── 메인 컴포넌트 ───────────────────────────────
type Screen = 'form' | 'success' | 'lookup' | 'detail' | 'edit' | 'cancel';

export interface PremiumOrderFormProps {
  productType?: OrderProductType;
  initialUserData?: PrefillUserData;
}

const PRODUCT_META: Record<OrderProductType, { title: string; price: number; priceLabel: string; description: string }> = {
  premium: {
    title: '인생가이드북 신청',
    price: 5000,
    priceLabel: '5,000원',
    description: '인생가이드북 주문 안내',
  },
  yearly2026: {
    title: '프리미엄 일년운세 2026 신청',
    price: 5000,
    priceLabel: '5,000원',
    description: '프리미엄 일년운세 2026 주문 안내',
  },
  jobCareer: {
    title: '직업운 리포트 신청',
    price: 5000,
    priceLabel: '5,000원',
    description: '직업운 리포트 주문 안내',
  },
};

export const PremiumOrderForm: React.FC<PremiumOrderFormProps> = ({
  productType = 'premium',
  initialUserData,
}) => {
  const [screen, setScreen] = useState<Screen>('form');
  const meta = PRODUCT_META[productType];
  const isYearly = productType === 'yearly2026';
  const isJobCareer = productType === 'jobCareer';
  const today = new Date();
  const currentYear = today.getFullYear();
  const birthYearOptions = Array.from({ length: currentYear - BIRTH_YEAR_MIN + 1 }, (_, i) => String(currentYear - i));
  const birthMonthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const birthHourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  // 프리필 데이터 계산 (무료 분석에서 넘어온 경우)
  const prefilledForm = React.useMemo(() => buildInitialForm(initialUserData), [initialUserData]);

  const [birthYearSelect, setBirthYearSelect] = useState(initialUserData?.birthYear || '');
  const [birthMonthSelect, setBirthMonthSelect] = useState(
    initialUserData?.birthMonth ? initialUserData.birthMonth.padStart(2, '0') : ''
  );
  const [birthDaySelect, setBirthDaySelect] = useState(
    initialUserData?.birthDay ? initialUserData.birthDay.padStart(2, '0') : ''
  );
  const [birthHourSelect, setBirthHourSelect] = useState(
    initialUserData && !initialUserData.unknownTime && initialUserData.birthHour
      ? initialUserData.birthHour.padStart(2, '0')
      : ''
  );
  const [birthMinuteSelect, setBirthMinuteSelect] = useState(
    initialUserData && !initialUserData.unknownTime && initialUserData.birthMinute
      ? initialUserData.birthMinute.padStart(2, '0')
      : ''
  );

  // 주문 폼 상태
  const [form, setForm] = useState<OrderFormState>(prefilledForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [orderIdCopied, setOrderIdCopied] = useState(false);

  // 주문 조회 상태
  const [lookupOrderId, setLookupOrderId] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [foundOrder, setFoundOrder] = useState<PremiumOrder | null>(null);

  // 수정 상태
  const [editForm, setEditForm] = useState<Pick<OrderFormState, 'concern' | 'interest' | 'reportLevel' | 'lifeEvents'>>({
    concern: '', interest: '', reportLevel: '', lifeEvents: [],
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // 취소 상태
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // ── 폼 필드 헬퍼 ──
  const setField = <K extends keyof OrderFormState>(key: K, value: OrderFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const isCurrentYearSelected = birthYearSelect === String(currentYear);
  const maxMonth = isCurrentYearSelected ? today.getMonth() + 1 : 12;
  const birthMonthSelectOptions = birthMonthOptions.filter(m => Number(m) <= maxMonth);
  const isCurrentMonthSelected = isCurrentYearSelected && birthMonthSelect === String(today.getMonth() + 1).padStart(2, '0');
  const maxDayForSelectedMonth = birthYearSelect && birthMonthSelect
    ? Math.min(getDaysInMonth(Number(birthYearSelect), Number(birthMonthSelect)), isCurrentMonthSelected ? today.getDate() : 31)
    : 0;
  const birthDayOptions = birthYearSelect && birthMonthSelect
    ? Array.from({ length: maxDayForSelectedMonth }, (_, i) => String(i + 1).padStart(2, '0'))
    : [];

  const setBirthDatePart = (part: 'year' | 'month' | 'day', value: string) => {
    const nextYear = part === 'year' ? value : birthYearSelect;
    const nextMonth = part === 'month' ? value : birthMonthSelect;
    let nextDay = part === 'day' ? value : birthDaySelect;

    if (part === 'year') setBirthYearSelect(value);
    if (part === 'month') setBirthMonthSelect(value);
    if (part === 'day') setBirthDaySelect(value);

    if (!nextYear || !nextMonth) {
      if (part === 'year') {
        setBirthMonthSelect('');
        setBirthDaySelect('');
      }
      if (part === 'month') {
        setBirthDaySelect('');
      }
      setField('birthDate', '');
      return;
    }

    const monthLimit = nextYear === String(currentYear) ? today.getMonth() + 1 : 12;
    if (Number(nextMonth) > monthLimit) {
      setField('birthDate', '');
      return;
    }

    const isTodayMonth = nextYear === String(currentYear) && nextMonth === String(today.getMonth() + 1).padStart(2, '0');
    const maxDay = Math.min(getDaysInMonth(Number(nextYear), Number(nextMonth)), isTodayMonth ? today.getDate() : 31);
    if (nextDay && Number(nextDay) > maxDay) {
      nextDay = String(maxDay).padStart(2, '0');
      setBirthDaySelect(nextDay);
    }

    if (!nextDay) {
      setField('birthDate', '');
      return;
    }

    setField('birthDate', `${nextYear}-${nextMonth}-${nextDay}`);
  };

  const setBirthTimePart = (part: 'hour' | 'minute', value: string) => {
    const nextHour = part === 'hour' ? value : birthHourSelect;
    const nextMinute = part === 'minute' ? value : birthMinuteSelect;
    if (part === 'hour') setBirthHourSelect(value);
    if (part === 'minute') setBirthMinuteSelect(value);
    if (!nextHour || !nextMinute) {
      setField('birthTime', '');
      return;
    }
    setField('birthTime', `${nextHour}:${nextMinute}`);
  };

  const addLifeEvent = () => setField('lifeEvents', [...form.lifeEvents, { year: new Date().getFullYear(), description: '' }]);
  const removeLifeEvent = (i: number) => setField('lifeEvents', form.lifeEvents.filter((_, idx) => idx !== i));
  const setLifeEvent = (i: number, key: keyof LifeEvent, value: string | number) =>
    setField('lifeEvents', form.lifeEvents.map((e, idx) => idx === i ? { ...e, [key]: value } : e));

  // ── 주문 제출 ──
  const handleSubmit = async () => {
    const errs = validate(form, productType);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const order: PremiumOrder = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        gender: form.gender as 'M' | 'F',
        birthDate: form.birthDate,
        birthTime: form.unknownTime ? '12:00' : form.birthTime || '12:00',
        isLunar: form.isLunar,
        isLeap: form.isLeap,
        unknownTime: form.unknownTime,
        tier: 'premium',
        price: meta.price,
        productType,
        currentJob: (isYearly || isJobCareer) ? form.currentJob.trim() : undefined,
        concern: form.concern.trim(),
        interest: form.interest.trim(),
        workHistory: isJobCareer ? form.workHistory.trim() : undefined,
        reportLevel: (isYearly || isJobCareer) ? 'advanced' : ((form.reportLevel || 'both') as 'basic' | 'advanced' | 'both'),
        lifeEvents: (isYearly || isJobCareer) ? [] : form.lifeEvents.filter(e => e.description.trim()),
        status: 'submitted',
        version: 1,
      };
      const id = await createPremiumOrder(order);
      setCreatedOrderId(id);
      setScreen('success');
    } catch {
      setSubmitError('주문 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 주문 조회 ──
  const handleLookup = async () => {
    if (!lookupOrderId.trim() || !lookupEmail.trim()) {
      setLookupError('주문번호와 이메일을 모두 입력해주세요.');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const order = await getOrderByIdAndEmail(lookupOrderId.trim(), lookupEmail.trim());
      if (!order) { setLookupError('주문번호 또는 이메일이 일치하지 않습니다.'); return; }
      setFoundOrder(order);
      setScreen('detail');
    } catch {
      setLookupError('조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLookupLoading(false);
    }
  };

  // ── 수정 제출 ──
  const handleEditSubmit = async () => {
    if (!foundOrder?.orderId) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      await updateOrderContent(foundOrder.orderId, lookupEmail, {
        concern: editForm.concern,
        interest: editForm.interest,
        reportLevel: (editForm.reportLevel || 'both') as 'basic' | 'advanced' | 'both',
        lifeEvents: editForm.lifeEvents.filter(e => e.description.trim()),
      });
      setFoundOrder(prev => prev ? { ...prev, ...editForm, reportLevel: (editForm.reportLevel || 'both') as 'basic' | 'advanced' | 'both', updatedByCustomerAt: new Date() } : prev);
      setScreen('detail');
    } catch (e: any) {
      setEditError(e?.message ?? '수정 중 오류가 발생했습니다.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── 취소 제출 ──
  const handleCancelSubmit = async () => {
    if (!foundOrder?.orderId) return;
    setCancelSubmitting(true);
    setCancelError('');
    try {
      await cancelPremiumOrder(foundOrder.orderId, lookupEmail, cancelReason);
      setFoundOrder(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      setScreen('detail');
    } catch (e: any) {
      setCancelError(e?.message ?? '취소 중 오류가 발생했습니다.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // ── 날짜 포맷 ──
  const formatDate = (ts: any) => {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // ════════════════════════ 화면 렌더 ════════════════════════

  // ── 접수 완료 화면 ──
  if (screen === 'success') {
    const SMARTSTORE_URL = isYearly
      ? 'https://smartstore.naver.com/ui-life-solution/products/13397045090'
      : isJobCareer
        ? 'https://smartstore.naver.com/ui-life-solution/products/13458866283'
        : 'https://smartstore.naver.com/ui-life-solution/products/13388740581';
    const handleCopyOrderId = async () => {
      try {
        await navigator.clipboard.writeText(createdOrderId);
        setOrderIdCopied(true);
        setTimeout(() => setOrderIdCopied(false), 2000);
      } catch { /* clipboard not available */ }
    };
    return (
      <div className="max-w-lg mx-auto p-4 space-y-5">
        {/* 접수 완료 */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <h2 className="text-[16px] font-bold text-emerald-800">주문이 접수되었습니다</h2>
          <p className="text-[13px] text-emerald-700">결제 완료 후 리포트 제작이 시작됩니다.<br />완성되면 입력하신 이메일로 전달됩니다.</p>
        </div>

        {/* 주문번호 + 복사 */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">주문번호</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-zinc-800">{createdOrderId}</span>
              <button
                onClick={handleCopyOrderId}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                  orderIdCopied
                    ? 'border-emerald-300 text-emerald-600 bg-emerald-50'
                    : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50'
                }`}
              >{orderIdCopied ? '복사됨' : '복사'}</button>
            </div>
          </div>
          <div className="flex justify-between"><span className="text-zinc-500">접수 상태</span><span className="font-bold text-blue-600">접수 완료 (결제 대기)</span></div>
        </div>

        {/* 결제 안내 */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <p className="font-bold text-blue-800 text-[13px]">결제 안내</p>
          <ol className="text-[11px] text-blue-900 space-y-2 list-none pl-0">
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[11px] font-bold">1</span><span>아래 버튼을 눌러 <b>네이버 스마트스토어</b>로 이동합니다.</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[11px] font-bold">2</span><span>상품 주문 시 <b>주문자 정보 혹은 배송메모(요청사항)</b>에 위 <b>주문번호</b>를 입력해 주세요.</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[11px] font-bold">3</span><span>결제 확인 후 <b>24시간 이내</b> 리포트 제작이 시작됩니다.</span></li>
          </ol>
          <button
            onClick={() => window.open(SMARTSTORE_URL, '_blank', 'noopener')}
            className="w-full py-3 rounded-xl font-bold text-[13px] text-white transition"
            style={{ background: '#03C75A' }}
          >
            네이버 스마트스토어에서 결제하기
          </button>
          <p className="text-[11px] text-blue-600 text-center">결제 페이지가 새 창으로 열립니다</p>
        </div>

        {/* 제작 안내 */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-[11px] text-amber-800 space-y-1">
          <p className="font-bold">결제 완료 후 24시간 이내 제작이 시작됩니다</p>
          <p>제작이 시작되면 수정 및 취소가 불가합니다. 변경이 필요하시면 빠르게 수정 또는 취소해주세요.</p>
        </div>

        {/* 하단 버튼 */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { setFoundOrder(null); setLookupOrderId(createdOrderId); setScreen('lookup'); }}
            className="w-full py-2.5 rounded-xl border border-indigo-300 text-indigo-700 font-bold text-[13px] hover:bg-indigo-50 transition"
          >주문 수정 / 취소하기</button>
          <button
            onClick={() => {
              setForm(prefilledForm);
              setBirthYearSelect('');
              setBirthMonthSelect('');
              setBirthDaySelect('');
              setBirthHourSelect('');
              setBirthMinuteSelect('');
              setErrors({});
              setCreatedOrderId('');
              setOrderIdCopied(false);
              setScreen('form');
            }}
            className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-[13px] hover:bg-zinc-50 transition"
          >새 주문 작성</button>
        </div>
      </div>
    );
  }

  // ── 주문 조회 화면 ──
  if (screen === 'lookup') {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setScreen('form')} className="text-zinc-400 hover:text-zinc-700 transition"><X className="w-5 h-5" /></button>
          <h2 className="text-[16px] font-bold text-zinc-800">주문 조회 / 수정 / 취소</h2>
        </div>
        <p className="text-[13px] text-zinc-500">주문번호와 이메일이 일치하면 주문 내용을 확인하고 수정하거나 취소할 수 있습니다.</p>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
          접수 완료 상태인 경우에만 수정/취소가 가능합니다. 제작이 시작된 주문은 변경이 어렵습니다.
        </div>
        <div className="space-y-3">
          <div>
            <Label>주문번호</Label>
            <input className={inputCls} value={lookupOrderId} onChange={e => setLookupOrderId(e.target.value)} placeholder="접수 완료 화면에서 확인한 주문번호" />
          </div>
          <div>
            <Label>이메일 주소</Label>
            <input className={inputCls} type="email" value={lookupEmail} onChange={e => setLookupEmail(e.target.value)} placeholder="주문 시 입력한 이메일" />
          </div>
          {lookupError && <p className={errorCls}>{lookupError}</p>}
          <button
            onClick={handleLookup}
            disabled={lookupLoading}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-[13px] hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {lookupLoading ? '조회 중...' : '주문 확인하기'}
          </button>
        </div>
      </div>
    );
  }

  // ── 주문 상세 화면 ──
  if (screen === 'detail' && foundOrder) {
    const st = STATUS_LABELS[foundOrder.status] ?? STATUS_LABELS.submitted;
    const canModify = foundOrder.status === 'submitted';
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setScreen('lookup')} className="text-zinc-400 hover:text-zinc-700 transition"><X className="w-5 h-5" /></button>
          <h2 className="text-[16px] font-bold text-zinc-800">주문 상세</h2>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-800">{foundOrder.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.color}`}>{st.label}</span>
          </div>
          {foundOrder.updatedByCustomerAt && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">고객 수정됨</span>
          )}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><span className="text-zinc-400">생년월일</span><p className="font-bold text-zinc-700">{foundOrder.birthDate}</p></div>
            <div><span className="text-zinc-400">성별</span><p className="font-bold text-zinc-700">{foundOrder.gender === 'M' ? '남성' : '여성'}</p></div>
            <div><span className="text-zinc-400">주문번호</span><p className="font-mono font-bold text-zinc-700 truncate">{foundOrder.orderId}</p></div>
            <div><span className="text-zinc-400">접수일시</span><p className="font-bold text-zinc-700">{formatDate(foundOrder.createdAt)}</p></div>
          </div>
          {foundOrder.concern && <div><p className="text-[11px] text-zinc-400">고민</p><p className="text-zinc-700">{foundOrder.concern}</p></div>}
          {foundOrder.interest && <div><p className="text-[11px] text-zinc-400">관심분야</p><p className="text-zinc-700">{foundOrder.interest}</p></div>}
        </div>

        {!canModify && foundOrder.status !== 'cancelled' && (
          <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-[11px] text-zinc-600">
            이미 제작이 시작된 주문입니다. 수정 및 취소가 어렵습니다. 불가피한 변경은 이메일로 문의해주세요.
          </div>
        )}

        {canModify && (
          <>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
              ⏰ 접수 후 24시간 이내 제작이 시작됩니다. 제작 시작 후에는 변경이 불가합니다.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditForm({ concern: foundOrder.concern ?? '', interest: foundOrder.interest ?? '', reportLevel: foundOrder.reportLevel ?? 'both', lifeEvents: foundOrder.lifeEvents ?? [] });
                  setEditError('');
                  setScreen('edit');
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-[13px] hover:bg-indigo-700 transition"
              >주문 수정하기</button>
              <button
                onClick={() => { setCancelReason(''); setCancelError(''); setScreen('cancel'); }}
                className="flex-1 py-2.5 rounded-xl border border-rose-300 text-rose-600 font-bold text-[13px] hover:bg-rose-50 transition"
              >주문 취소하기</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── 수정 화면 ──
  if (screen === 'edit' && foundOrder) {
    const addEditEvent = () => setEditForm(p => ({ ...p, lifeEvents: [...p.lifeEvents, { year: new Date().getFullYear(), description: '' }] }));
    const removeEditEvent = (i: number) => setEditForm(p => ({ ...p, lifeEvents: p.lifeEvents.filter((_, idx) => idx !== i) }));
    const setEditEvent = (i: number, k: keyof LifeEvent, v: string | number) =>
      setEditForm(p => ({ ...p, lifeEvents: p.lifeEvents.map((e, idx) => idx === i ? { ...e, [k]: v } : e) }));
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setScreen('detail')} className="text-zinc-400 hover:text-zinc-700 transition"><X className="w-5 h-5" /></button>
          <h2 className="text-[16px] font-bold text-zinc-800">주문 내용 수정</h2>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
          아직 제작 전이라 수정이 가능합니다. 단, 제작이 시작되면 더 이상 수정할 수 없습니다.
        </div>
        <p className="text-[11px] text-zinc-400">이름, 생년월일, 이메일은 변경이 어렵습니다. 수정이 필요하면 이메일로 문의해주세요.</p>

        <div className="space-y-4">
          <div>
            <Label>고민 또는 궁금한 점</Label>
            <div className="relative">
              <textarea
                className={`${inputCls} min-h-[100px] resize-none`}
                value={editForm.concern}
                onChange={e => setEditForm(p => ({ ...p, concern: e.target.value }))}
              />
              {!editForm.concern && (
                <p className="pointer-events-none absolute top-2.5 left-3 text-[13px] text-zinc-400 leading-relaxed">
                  책자에서 꼭 다뤄주었으면 하는, 가장 고민이 되는 것을 자유롭게 적어 주세요.<br />
                  진로, 관계, 재물, 시기 등 어떤 주제든 괜찮습니다.
                </p>
              )}
            </div>
          </div>
          <div>
            <Label>특히 더 알고 싶은 분야</Label>
            <div className="relative">
              <textarea
                className={`${inputCls} min-h-[80px] resize-none`}
                value={editForm.interest}
                onChange={e => setEditForm(p => ({ ...p, interest: e.target.value }))}
              />
              {!editForm.interest && (
                <p className="pointer-events-none absolute top-2.5 left-3 text-[13px] text-zinc-400 leading-relaxed">
                  리포트에서 집중적으로 다뤄주었으면 하는 분야를 알려주세요.<br />
                  예) 올해 직장운, 결혼 시기, 재물 흐름, 건강 등
                </p>
              )}
            </div>
          </div>
          <div>
            <Label>리포트 구성 선택</Label>
            <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 mb-2 text-[11px] text-zinc-600 space-y-1">
              <p><span className="font-bold text-zinc-700">기본형</span> — 사주용어를 잘 몰라요. 쉽게 써주세요.</p>
              <p><span className="font-bold text-zinc-700">고급형</span> — 사주용어를 좀 알아요. 심오하게 봐주세요.</p>
              <p><span className="font-bold text-zinc-700">둘다</span> — 사주에 관심이 있어요. 심오하게 봐주시되 설명도 부탁해요. <span className="text-indigo-600 font-bold">(가장 많이 선택)</span></p>
            </div>
            <div className="flex gap-2">
              {[{ v: 'basic', l: '기본형' }, { v: 'advanced', l: '고급형' }, { v: 'both', l: '둘다' }].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setEditForm(p => ({ ...p, reportLevel: opt.v as any }))}
                  className={`flex-1 py-2 rounded-xl text-[13px] font-bold border transition ${editForm.reportLevel === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}
                >{opt.l}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>인생 주요 이벤트 (선택)</Label>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 mb-2 text-[11px] text-blue-800 space-y-1">
              <p className="font-bold">연도와 사건을 한 쌍으로 입력해주세요.</p>
              <p>전환점 중심으로 작성: 입학·취업·이직·결혼·이사·건강 이슈 등</p>
              <p>3~7개 권장. 없으면 비워도 괜찮습니다.</p>
            </div>
            <div className="space-y-2">
              {editForm.lifeEvents.map((e, i) => (
                <div key={i} className="grid grid-cols-[88px_minmax(0,1fr)_28px] gap-2 items-center">
                  <input
                    type="number"
                    className={inputCls}
                    value={e.year}
                    onChange={ev => setEditEvent(i, 'year', Number(ev.target.value))}
                    min={1900}
                    max={2100}
                    placeholder="연도"
                  />
                  <input
                    className={`${inputCls} min-w-0`}
                    value={e.description}
                    onChange={ev => setEditEvent(i, 'description', ev.target.value)}
                    placeholder="사건 내용"
                  />
                  <button onClick={() => removeEditEvent(i)} className="text-zinc-400 hover:text-rose-500 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={addEditEvent} className="flex items-center gap-1 text-[11px] text-indigo-600 font-bold hover:text-indigo-800 transition">
                <Plus className="w-3.5 h-3.5" />이벤트 추가
              </button>
            </div>
          </div>
        </div>

        {editError && <p className={errorCls}>{editError}</p>}
        <button
          onClick={handleEditSubmit}
          disabled={editSubmitting}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-[13px] hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {editSubmitting ? '저장 중...' : '수정 완료'}
        </button>
      </div>
    );
  }

  // ── 취소 화면 ──
  if (screen === 'cancel' && foundOrder) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setScreen('detail')} className="text-zinc-400 hover:text-zinc-700 transition"><X className="w-5 h-5" /></button>
          <h2 className="text-[16px] font-bold text-zinc-800">주문 취소</h2>
        </div>
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 space-y-1 text-[13px] text-rose-800">
          <p className="font-bold">주문을 취소하시겠습니까?</p>
          <p>취소 후에는 되돌릴 수 없습니다. 이미 제작이 시작된 경우 취소가 불가합니다.</p>
        </div>
        <div>
          <Label>취소 사유 (선택)</Label>
          <div className="flex flex-col gap-1.5 mb-2">
            {['단순 변심', '내용 변경이 필요함', '기타'].map(r => (
              <button
                key={r}
                onClick={() => setCancelReason(r)}
                className={`text-left px-3 py-2 rounded-xl text-[13px] border transition ${cancelReason === r ? 'bg-rose-100 border-rose-400 text-rose-700 font-bold' : 'bg-white border-zinc-200 text-zinc-600 hover:border-rose-300'}`}
              >{r}</button>
            ))}
          </div>
          <textarea
            className={`${inputCls} min-h-[60px] resize-none`}
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="직접 입력하셔도 됩니다."
          />
        </div>
        {cancelError && <p className={errorCls}>{cancelError}</p>}
        <button
          onClick={handleCancelSubmit}
          disabled={cancelSubmitting}
          className="w-full py-3 rounded-xl bg-rose-600 text-white font-bold text-[13px] hover:bg-rose-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {cancelSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {cancelSubmitting ? '취소 처리 중...' : '주문 취소 확인'}
        </button>
      </div>
    );
  }

  // ═══════════════════════════ 주문 폼 화면 ═══════════════════════════
  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      {/* 상단 헤더 */}
      <div className="text-center space-y-1">
        <h2 className="text-[16px] font-bold text-zinc-900">{meta.title}</h2>
        {isYearly && (
          <p className="text-[11px] text-indigo-600">
            사주 원국 · 대운 · 2026 세운 · 월별 운세를 종합한 10페이지 맞춤 리포트
          </p>
        )}
        {isJobCareer && (
          <p className="text-[11px] text-indigo-600">
            격국 · 용신 · 십성 삼각 · 오행 직군 · 2026~2028 세운 타이밍을 종합한 직업운 분석 리포트
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 p-5 text-[13px] text-zinc-800 space-y-4">
        <div className="space-y-1">
          <p className="font-bold text-indigo-900 text-base">{meta.description}</p>
          <p className="text-[11px] text-indigo-700">가격: <b>{meta.priceLabel}</b></p>
        </div>

        <div className="space-y-2.5">
          <p className="font-bold text-[13px] text-zinc-700">주문 방법</p>
          <ol className="space-y-2 text-[11px] text-zinc-700 list-none pl-0">
            <li className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-[11px] font-bold mt-0.5">1</span>
              <span>아래 양식에 <b>주문정보</b>를 입력하고 <b>"주문 접수"</b> 버튼을 눌러주세요.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-[11px] font-bold mt-0.5">2</span>
              <span>접수 완료 후 <b>주문번호</b>가 발급됩니다. 주문번호를 복사해 주세요.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-[11px] font-bold mt-0.5">3</span>
              <span><b>네이버 스마트스토어</b> 결제 버튼을 눌러 상품을 주문하세요.<br />주문 시 <b>주문자 정보 혹은 배송메모(요청사항)</b>에 주문번호를 꼭 입력해 주세요.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-[11px] font-bold mt-0.5">4</span>
              <span>결제 확인 후 <b>24시간 이내</b> 리포트를 제작하여 이메일로 발송해 드립니다.</span>
            </li>
          </ol>
        </div>

        <div className="rounded-xl bg-white/70 border border-zinc-200 p-3.5 space-y-1.5">
          <p className="font-bold text-[11px] text-zinc-700">현금 계좌이체도 가능합니다</p>
          <p className="text-[11px] text-zinc-600">우리은행 1005-104-887610 (예금주: 유아이트레이딩)</p>
          <p className="text-[11px] text-zinc-500">계좌이체 시 입금자명에 주문번호를 기재해 주세요.</p>
        </div>

        <p className="text-[11px] text-zinc-500">제작이 시작되면 취소가 어렵습니다. 문의: dean.uitrading@gmail.com</p>
      </div>

      {/* 조회 링크 */}
      <button
        onClick={() => { setLookupOrderId(''); setLookupEmail(''); setLookupError(''); setScreen('lookup'); }}
        className="w-full text-center text-[11px] text-indigo-600 hover:underline font-medium"
      >이미 주문하셨나요? 주문 조회 / 수정 / 취소 →</button>

      {/* 주문폼 카드 */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">

        {/* 개인정보 보호 안내 */}
        <div className="bg-indigo-50 border-b border-indigo-100 p-4 flex gap-3 items-start">
          <Shield className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
          <div className="text-[11px] text-indigo-800 space-y-0.5">
            <p className="font-bold">고객정보 보호 안내</p>
            <p>입력하신 정보와 리포트 내용은 고객님께만 전달됩니다.</p>
            <p>작성된 리포트는 발송 후 고객님이 직접 보관하시며, 제3자에게 공유되지 않습니다.</p>
            <p>정보는 리포트 제작 목적으로만 사용됩니다.</p>
          </div>
        </div>

        <div className="p-5 space-y-6">

          {/* 기본 정보 섹션 */}
          <div className="space-y-4">
            <SectionTitle>기본 정보</SectionTitle>
            <div>
              <Label required>이름</Label>
              <input className={inputCls} value={form.name} onChange={e => setField('name', e.target.value)} placeholder="이름을 입력해주세요" />
              {errors.name && <p className={errorCls}>{errors.name}</p>}
            </div>
            <div>
              <Label required>이메일 주소</Label>
              <input className={inputCls} type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="리포트를 받으실 이메일을 입력해주세요" />
              {errors.email && <p className={errorCls}>{errors.email}</p>}
            </div>
            <div>
              <Label required>성별</Label>
              <div className="flex gap-2">
                {[{ v: 'M', l: '남성' }, { v: 'F', l: '여성' }].map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setField('gender', opt.v as 'M' | 'F')}
                    className={`flex-1 py-2 rounded-xl text-[13px] font-bold border transition ${form.gender === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}
                  >{opt.l}</button>
                ))}
              </div>
              {errors.gender && <p className={errorCls}>{errors.gender}</p>}
            </div>
            <div>
              <Label required>생년월일</Label>
              <div className="grid grid-cols-3 gap-2">
                <select className={inputCls} value={birthYearSelect} onChange={e => setBirthDatePart('year', e.target.value)}>
                  <option value="">연도</option>
                  {birthYearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select className={inputCls} value={birthMonthSelect} onChange={e => setBirthDatePart('month', e.target.value)}>
                  <option value="">월</option>
                  {birthMonthSelectOptions.map(m => <option key={m} value={m}>{Number(m)}월</option>)}
                </select>
                <select
                  className={`${inputCls} ${(!birthYearSelect || !birthMonthSelect) ? 'opacity-60' : ''}`}
                  value={birthDaySelect}
                  onChange={e => setBirthDatePart('day', e.target.value)}
                  disabled={!birthYearSelect || !birthMonthSelect}
                >
                  <option value="">일</option>
                  {birthDayOptions.map(d => <option key={d} value={d}>{Number(d)}일</option>)}
                </select>
              </div>
              {errors.birthDate && <p className={errorCls}>{errors.birthDate}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>출생시간</Label>
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer select-none">
                  <input type="checkbox" checked={form.unknownTime} onChange={e => setField('unknownTime', e.target.checked)} className="rounded" />
                  출생시간을 모릅니다
                </label>
              </div>
              <div className={`grid grid-cols-2 gap-2 ${form.unknownTime ? 'opacity-40 pointer-events-none' : ''}`}>
                <select
                  className={inputCls}
                  value={birthHourSelect}
                  onChange={e => setBirthTimePart('hour', e.target.value)}
                  disabled={form.unknownTime}
                >
                  <option value="">시</option>
                  {birthHourOptions.map(h => <option key={h} value={h}>{h}시</option>)}
                </select>
                <select
                  className={inputCls}
                  value={birthMinuteSelect}
                  onChange={e => setBirthTimePart('minute', e.target.value)}
                  disabled={form.unknownTime}
                >
                  <option value="">분</option>
                  {BIRTH_TIME_MINUTES.map(m => <option key={m} value={m}>{m}분</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>달력 유형</Label>
              <div className="flex gap-2">
                {[{ v: false, l: '양력' }, { v: true, l: '음력' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    onClick={() => { setField('isLunar', opt.v); if (!opt.v) setField('isLeap', false); }}
                    className={`flex-1 py-2 rounded-xl text-[13px] font-bold border transition ${form.isLunar === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}
                  >{opt.l}</button>
                ))}
              </div>
              {form.isLunar && (
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.isLeap} onChange={e => setField('isLeap', e.target.checked)} className="rounded" />
                  윤달입니다
                </label>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-100" />

          {/* 리포트 요청 정보 섹션 */}
          <div className="space-y-4">
            <SectionTitle>리포트 요청 내용</SectionTitle>
            {(isYearly || isJobCareer) && (
              <div>
                <Label required>현재 하고 계신 일</Label>
                <div className="relative">
                  <input
                    className={inputCls}
                    value={form.currentJob}
                    onChange={e => setField('currentJob', e.target.value)}
                    placeholder={isJobCareer ? '예) 대기업 IT 개발자 / 자영업(카페) / 취업준비생 등' : '예) 사주 분석 사이트 운영 / 직장인(IT) / 자영업(카페) 등'}
                  />
                </div>
                {errors.currentJob && <p className={errorCls}>{errors.currentJob}</p>}
              </div>
            )}
            <div>
              <Label required={isJobCareer}>{isYearly ? '가장 큰 고민' : isJobCareer ? '커리어 고민' : '고민 또는 궁금한 점'}</Label>
              <div className="relative">
                <textarea
                  className={`${inputCls} min-h-[110px] resize-none`}
                  value={form.concern}
                  onChange={e => setField('concern', e.target.value)}
                />
                {!form.concern && (
                  <p className="pointer-events-none absolute top-2.5 left-3 right-3 text-[13px] text-zinc-400 leading-relaxed">
                    {isYearly ? (
                      <>
                        지금 가장 크게 마음에 걸리는 문제를 적어 주세요.<br />
                        예) 현재 사업을 확장할지 정리할지 결정이 필요함
                      </>
                    ) : isJobCareer ? (
                      <>
                        가장 고민되는 커리어 문제를 적어 주세요.<br />
                        예) 이직을 해야 할지, 언제 창업이 좋을지, 지금 직장을 계속 다닐지
                      </>
                    ) : (
                      <>
                        책자에서 꼭 다뤄주었으면 하는, 가장 고민이 되는 것을 자유롭게 적어 주세요.<br />
                        진로, 관계, 재물, 시기 등 어떤 주제든 괜찮습니다.
                      </>
                    )}
                  </p>
                )}
              </div>
              {errors.concern && <p className={errorCls}>{errors.concern}</p>}
            </div>
            <div>
              <Label required={isJobCareer}>{isYearly ? '가장 알고 싶은 것' : isJobCareer ? '원하는 방향' : '특히 더 알고 싶은 분야'}</Label>
              <div className="relative">
                <textarea
                  className={`${inputCls} min-h-[90px] resize-none`}
                  value={form.interest}
                  onChange={e => setField('interest', e.target.value)}
                />
                {!form.interest && (
                  <p className="pointer-events-none absolute top-2.5 left-3 right-3 text-[13px] text-zinc-400 leading-relaxed">
                    {isYearly ? (
                      <>
                        올해 가장 궁금한 한 가지 질문을 구체적으로 적어 주세요.<br />
                        예) 신사업이 성공할지, 무엇에 집중해야 할지
                      </>
                    ) : isJobCareer ? (
                      <>
                        5년 후 어떤 모습을 원하시나요?<br />
                        예) 현 직장에서 임원 / 5년 내 독립 창업 / 전직(업종 변경) / 안정적인 직장 유지
                      </>
                    ) : (
                      <>
                        리포트에서 집중적으로 다뤄주었으면 하는 분야를 알려주세요.<br />
                        예) 올해 직장운, 결혼 시기, 재물 흐름, 건강 등
                      </>
                    )}
                  </p>
                )}
              </div>
              {errors.interest && <p className={errorCls}>{errors.interest}</p>}
            </div>
            {isJobCareer && (
              <div>
                <Label>주요 경력 흐름 <span className="font-normal text-zinc-400 text-[11px]">(선택)</span></Label>
                <div className="relative">
                  <textarea
                    className={`${inputCls} min-h-[80px] resize-none`}
                    value={form.workHistory}
                    onChange={e => setField('workHistory', e.target.value)}
                    maxLength={300}
                  />
                  {!form.workHistory && (
                    <p className="pointer-events-none absolute top-2.5 left-3 right-3 text-[13px] text-zinc-400 leading-relaxed">
                      주요 직장 경력이나 전직 이력을 간략히 적어 주세요. (300자 이내)<br />
                      예) 2018~2022 대기업 마케팅 → 2022~ 스타트업 PM
                    </p>
                  )}
                </div>
              </div>
            )}
            {!isYearly && !isJobCareer && (
              <div>
                <Label required>리포트 구성 선택</Label>
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 mb-2 text-[11px] text-zinc-600 space-y-1">
                  <p><span className="font-bold text-zinc-700">기본형</span> — 사주용어를 잘 몰라요. 쉽게 써주세요.</p>
                  <p><span className="font-bold text-zinc-700">고급형</span> — 사주용어를 좀 알아요. 심오하게 봐주세요.</p>
                  <p><span className="font-bold text-zinc-700">둘다</span> — 사주에 관심이 있어요. 심오하게 봐주시되 설명도 부탁해요. <span className="text-indigo-600 font-bold">(가장 많이 선택)</span></p>
                </div>
                <div className="flex gap-2">
                  {[{ v: 'basic', l: '기본형' }, { v: 'advanced', l: '고급형' }, { v: 'both', l: '둘다' }].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setField('reportLevel', opt.v as any)}
                      className={`flex-1 py-2 rounded-xl text-[13px] font-bold border transition ${form.reportLevel === opt.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}
                    >{opt.l}</button>
                  ))}
                </div>
                {errors.reportLevel && <p className={errorCls}>{errors.reportLevel}</p>}
              </div>
            )}
          </div>

          {!isYearly && !isJobCareer && <div className="border-t border-zinc-100" />}

          {/* 추가 정보 섹션 (premium 전용) */}
          {!isYearly && !isJobCareer && (
          <div className="space-y-3">
            <SectionTitle>인생 주요 이벤트 <span className="font-normal text-zinc-400 text-[11px]">(선택)</span></SectionTitle>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-800 space-y-1">
              <p className="font-bold">살아오면서 기억에 남는 전환점을 연도와 함께 적어 주세요.</p>
              <p>예시: 2015년 — 첫 직장 입사 / 2019년 — 이직 후 번아웃 / 2022년 — 결혼</p>
              <p className="text-blue-700">입학·취업·이직·결혼·이사·사업 시작·건강 이슈·가족 사건 등을 참고해 보세요.</p>
              <p className="text-blue-600 font-medium">3~7개 정도 입력하시면 더 풍부한 해석이 가능합니다. 없으면 비워도 괜찮습니다.</p>
            </div>
            <div className="space-y-2">
              {form.lifeEvents.map((e, i) => (
                <div key={i} className="grid grid-cols-[88px_minmax(0,1fr)_28px] gap-2 items-center">
                  <input
                    type="number"
                    className={inputCls}
                    value={e.year}
                    onChange={ev => setLifeEvent(i, 'year', Number(ev.target.value))}
                    min={1900}
                    max={2100}
                    placeholder="연도"
                  />
                  <input
                    className={`${inputCls} min-w-0`}
                    value={e.description}
                    onChange={ev => setLifeEvent(i, 'description', ev.target.value)}
                    placeholder="사건 내용"
                  />
                  <button onClick={() => removeLifeEvent(i)} className="text-zinc-400 hover:text-rose-500 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button
                onClick={addLifeEvent}
                className="flex items-center gap-1 text-[11px] text-indigo-600 font-bold hover:text-indigo-800 transition mt-1"
              >
                <Plus className="w-3.5 h-3.5" />이벤트 추가
              </button>
            </div>
          </div>
          )}

        </div>

        {/* 제출 영역 */}
        <div className="border-t border-zinc-100 p-5 space-y-3">
          {submitError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />{submitError}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-[13px] hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? '접수 중입니다...' : (isYearly ? '일년운세 주문하기' : isJobCareer ? '직업운 리포트 주문하기' : '리포트 주문하기')}
          </button>
        </div>
      </div>
    </div>
  );
};
