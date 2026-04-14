import React, { useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { PremiumOrder, ReportInputData, ReportSection, getPremiumOrders, updatePremiumOrder, rejectPremiumOrder } from '../lib/premiumOrderStore';
import { ChevronRight, ChevronLeft, Zap, CheckCircle, AlertCircle, Clock, Send, Trash2, Eye, X, PenLine, Search } from 'lucide-react';
import { PremiumReportInputPanel } from './admin/PremiumReportInputPanel';
import { PremiumReportPreview } from './admin/PremiumReportPreview';

interface PremiumOrdersPanelProps {
  isDarkMode: boolean;
  user?: FirebaseUser | null;
  onLogout?: () => void;
}

type ReportStep = 'list' | 'input' | 'preview';

export const PremiumOrdersPanel: React.FC<PremiumOrdersPanelProps> = ({ isDarkMode, user, onLogout }) => {
  const [orders, setOrders] = useState<PremiumOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PremiumOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'premium' | 'yearly2026'>('all');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [generatingOrderId, setGeneratingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [naverOrderNumber, setNaverOrderNumber] = useState('');
  const [savingNaverNum, setSavingNaverNum] = useState(false);

  // Report generation workflow
  const [reportStep, setReportStep] = useState<ReportStep>('list');
  const [reportInputData, setReportInputData] = useState<ReportInputData | null>(null);
  const [reportSections, setReportSections] = useState<ReportSection[]>([]);
  const [reportRawData, setReportRawData] = useState<any>(null);

  useEffect(() => {
    loadOrders();
  }, [statusFilter, productTypeFilter]);

  useEffect(() => {
    setNaverOrderNumber(selectedOrder?.naverOrderNumber || '');
    setEmailStatusResult(null);
  }, [selectedOrder?.orderId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const filter = statusFilter === 'all' ? undefined : statusFilter;
      const data = await getPremiumOrders(filter, productTypeFilter);
      setOrders(data);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      setLoadError(error?.message || '주문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = (orderId: string) => {
    const order = orders.find(o => o.orderId === orderId);
    if (!order) throw new Error('Order not found');
    
    // 주문 정보로 리포트 입력 초기화
    setReportInputData({
      name: order.name,
      gender: order.gender as 'M' | 'F',
      birthDate: order.birthDate,
      birthTime: order.birthTime,
      isLunar: order.isLunar,
      isLeap: order.isLeap ?? false,
      unknownTime: order.unknownTime ?? false,
      concern: order.concern || '',
      interest: order.interest || '',
      reportLevel: (order.reportLevel || 'both') as 'basic' | 'advanced' | 'both',
      lifeEvents: Array.isArray(order.lifeEvents) ? order.lifeEvents : [],
      adminNotes: '',
      productType: order.productType || 'premium',
      currentJob: order.currentJob || '',
    });
    
    setSelectedOrder(order);
    setReportStep('input');  // 입력 단계로 이동
  };

  const handleReportGenerated = async (
    data: ReportInputData,
    sections: ReportSection[],
    saju: any,
    daeun: any,
    yongshin: any
  ) => {
    try {
      if (!selectedOrder?.orderId) throw new Error('No order selected');
      
      // 보고서 데이터 저장
      setReportInputData(data);
      setReportSections(sections);
      setReportRawData({ saju, daeun, yongshin });
      
      // Preview 단계로 이동
      setReportStep('preview');
    } catch (error) {
      console.error('Failed to process report:', error);
      alert('리포트 생성 중 오류가 발생했습니다.');
      setReportStep('input');
    }
  };

  const handleSaveReport = async (pdfUrl: string) => {
    try {
      if (!selectedOrder?.orderId) throw new Error('No order selected');
      
      setGeneratingOrderId(selectedOrder.orderId);
      
      // 상태를 reviewing으로 변경하고 리포트, PDF URL 저장
      await updatePremiumOrder(selectedOrder.orderId, {
        status: 'reviewing',
        reportText: reportSections.map(s => s.title).join(' / '),
        pdfUrl: pdfUrl,
        generatedAt: new Date(),
      });

      // 목록 새로고침
      await loadOrders();
      alert('리포트가 저장되었습니다. 미리보기 화면에서 계속 확인하실 수 있습니다.');
    } catch (error) {
      console.error('Failed to save report:', error);
      alert('리포트 저장 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setGeneratingOrderId(null);
    }
  };
  const handleSendReport = async (orderId: string, isResend = false) => {
    try {
      setLoading(true);
      const order = orders.find(o => o.orderId === orderId);
      if (!order || !order.pdfUrl) throw new Error('Order or PDF URL not found');

      // 이메일 발송
      const { sendPremiumReportEmail } = await import('../lib/sendPremiumReportEmail');
      const result = await sendPremiumReportEmail(order, order.pdfUrl);
      if (!result.success) throw new Error(result.error || 'Failed to send email');

      // 상태를 delivered로 변경 + messageId 저장
      const prevCount = order.emailSendCount || 0;
      await updatePremiumOrder(orderId, {
        status: 'delivered',
        sentAt: new Date(),
        emailMessageId: result.messageId || '',
        emailStatus: 'sent',
        emailSendCount: prevCount + 1,
      } as any);

      // 목록 새로고침
      await loadOrders();
      if (!isResend) setSelectedOrder(null);
      alert(isResend ? '리포트가 재발송되었습니다.' : '리포트가 고객에게 발송되었습니다.');
    } catch (error) {
      console.error('Failed to send report:', error);
      alert('리포트 발송 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // 이메일 배달 상태 확인
  const [emailStatusLoading, setEmailStatusLoading] = useState(false);
  const [emailStatusResult, setEmailStatusResult] = useState<{ status: string; lastEvent: string; checkedAt: string } | null>(null);

  const handleCheckEmailStatus = async (order: PremiumOrder) => {
    if (!order.emailMessageId) {
      alert('이메일 메시지 ID가 없습니다. 발송 기록이 없거나 이전 버전에서 발송된 주문입니다.');
      return;
    }
    try {
      setEmailStatusLoading(true);
      const response = await fetch('/api/premium-report/check-email-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: order.emailMessageId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Failed to check status');

      const checkedAt = new Date().toLocaleString('ko-KR');
      setEmailStatusResult({
        status: data.status,
        lastEvent: data.lastEvent,
        checkedAt,
      });

      // Firestore 업데이트
      if (order.orderId) {
        await updatePremiumOrder(order.orderId, {
          emailStatus: data.status,
          emailStatusCheckedAt: new Date(),
        } as any);
        await loadOrders();
      }
    } catch (error) {
      console.error('Failed to check email status:', error);
      alert('이메일 상태 확인 실패: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setEmailStatusLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setLoading(true);
      if (!selectedOrder?.orderId || !rejectReason.trim()) {
        alert('반려 사유를 입력하세요.');
        return;
      }

      await rejectPremiumOrder(selectedOrder.orderId, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      await loadOrders();
      setSelectedOrder(null);
      alert('주문이 반려되었습니다. 재생성할 수 있습니다.');
    } catch (error) {
      console.error('Failed to reject order:', error);
      alert('반려 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      submitted:  { bg: 'bg-blue-500',   text: 'text-white', icon: <Clock className="w-4 h-4" />,       label: '접수됨' },
      generating: { bg: 'bg-yellow-500', text: 'text-white', icon: <Zap className="w-4 h-4" />,         label: '생성 중' },
      reviewing:  { bg: 'bg-purple-500', text: 'text-white', icon: <Eye className="w-4 h-4" />,          label: '검수 중' },
      delivered:  { bg: 'bg-green-500',  text: 'text-white', icon: <CheckCircle className="w-4 h-4" />, label: '발송됨' },
      rejected:   { bg: 'bg-red-500',    text: 'text-white', icon: <AlertCircle className="w-4 h-4" />, label: '반려됨' },
      cancelled:  { bg: 'bg-zinc-400',   text: 'text-white', icon: <X className="w-4 h-4" />,            label: '취소됨' },
    };

    const s = statusMap[status] || statusMap.submitted;
    return (
      <div className={`${s.bg} ${s.text} rounded-full px-3 py-1 text-xs font-bold flex items-center gap-2 w-fit`}>
        {s.icon}
        {s.label}
      </div>
    );
  };

  // 리포트 입력 단계
  if (reportStep === 'input' && reportInputData && user) {
    return (
      <div className="w-full h-screen overflow-hidden">
        <PremiumReportInputPanel
          user={user}
          initialData={reportInputData}
          onLogout={onLogout || (() => {})}
          onBack={() => {
            setReportStep('list');
            setReportInputData(null);
            setSelectedOrder(null);
          }}
          onGenerated={handleReportGenerated}
        />
      </div>
    );
  }

  // 리포트 미리보기 단계
  if (reportStep === 'preview' && reportInputData && reportSections.length > 0 && user) {
    if (!reportRawData?.saju || !reportRawData?.daeun || !reportRawData?.yongshin) {
      alert('미리보기 데이터가 누락되었습니다. 다시 생성을 시도해주세요.');
      setReportStep('input');
      return null;
    }

    return (
      <PremiumReportPreview
        inputData={reportInputData}
        sections={reportSections}
        sajuData={reportRawData.saju}
        daeunData={reportRawData.daeun}
        yongshinData={reportRawData.yongshin}
        onSaveReport={handleSaveReport}
        onBack={() => {
          setReportStep('input');
        }}
        user={user}
        onLogout={onLogout || (() => {})}
      />
    );
  }

  return (
    <div className={`h-full flex gap-4 ${isDarkMode ? 'bg-zinc-950' : 'bg-white'}`}>
      {/* 좌측: 주문 목록 */}
      <div className={`w-2/5 border-r ${isDarkMode ? 'border-zinc-800' : 'border-gray-200'} overflow-y-auto`}>
        <div className={`sticky top-0 ${isDarkMode ? 'bg-zinc-900' : 'bg-gray-50'} p-4 border-b ${isDarkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>프리미엄 리포트 주문</h3>
            <button
              onClick={loadOrders}
              disabled={loading}
              className={`px-2.5 py-1 rounded text-xs font-bold border transition ${
                isDarkMode
                  ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50'
                  : 'border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50'
              }`}
            >
              {loading ? '갱신 중...' : '새로고침'}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'submitted', 'generating', 'reviewing', 'delivered', 'rejected', 'cancelled'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  statusFilter === status
                    ? `${isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'}`
                    : `${isDarkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-200 text-gray-700'}`
                }`}
              >
                {status === 'all' ? '전체' : ['submitted', 'generating', 'reviewing', 'delivered', 'rejected'].includes(status) ? status : status}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {([
              { v: 'all', l: '전체 상품' },
              { v: 'premium', l: '프리미엄 리포트' },
              { v: 'yearly2026', l: '일년운세 2026' },
            ] as const).map(opt => (
              <button
                key={opt.v}
                onClick={() => setProductTypeFilter(opt.v)}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  productTypeFilter === opt.v
                    ? `${isDarkMode ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`
                    : `${isDarkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-200 text-gray-700'}`
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {/* 검색창 */}
        <div className={`px-4 pb-3 ${isDarkMode ? 'bg-zinc-900' : 'bg-gray-50'} border-b ${isDarkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300'}`}>
            <Search className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-zinc-400' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="주문번호, 이름, 이메일 검색..."
              className={`flex-1 text-xs bg-transparent outline-none ${isDarkMode ? 'text-white placeholder-zinc-500' : 'text-black placeholder-gray-400'}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-400'}`}>✕</button>
            )}
          </div>
        </div>

        <div className="space-y-2 p-4">
          {loadError && (
            <div className={`rounded-lg border p-3 text-xs ${isDarkMode ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
              <p className="font-bold mb-1">주문 목록 조회 실패</p>
              <p>{loadError}</p>
            </div>
          )}
          {loading && <div className={`text-center py-8 ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>로딩 중...</div>}
          {!loading && orders.length === 0 && <div className={`text-center py-8 ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>주문이 없습니다.</div>}
          {orders.filter(order => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            return (
              (order.orderId || '').toLowerCase().includes(q) ||
              (order.name || '').toLowerCase().includes(q) ||
              (order.email || '').toLowerCase().includes(q) ||
              (order.naverOrderNumber ?? '').toLowerCase().includes(q)
            );
          }).map(order => (
            <button
              key={order.orderId}
              onClick={() => setSelectedOrder(order)}
              className={`w-full text-left p-4 rounded-lg transition cursor-pointer ${
                selectedOrder?.orderId === order.orderId
                  ? isDarkMode ? 'bg-indigo-900/50' : 'bg-indigo-100'
                  : isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{order.name}</div>
                  {(order.productType || 'premium') === 'yearly2026' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">일년운세</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">가이드북</span>
                  )}
                </div>
                {getStatusBadge(order.status)}
              </div>
              <div className={`text-xs font-mono mb-0.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                #{order.orderId}
              </div>
              {order.naverOrderNumber && (
                <div className={`text-xs font-mono mb-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  N: {order.naverOrderNumber}
                </div>
              )}
              <div className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                {order.birthDate} | {order.tier === 'premium' ? '프리미엄' : '기본'}
              </div>
              <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
                <span>v{order.version}</span>
                {order.createdAt && (
                  <span>·&nbsp;{(() => { try { const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt); return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}</span>
                )}
                {order.updatedByCustomerAt && (
                  <span className="flex items-center gap-0.5 text-orange-500 font-bold">
                    <PenLine className="w-3 h-3" />고객 수정됨
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 우측: 상세 정보 */}
      {selectedOrder ? (
        <div className={`w-3/5 p-6 overflow-y-auto`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedOrder.name}</h2>
              <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>{selectedOrder.email}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedOrder.orderId || '');
                }}
                title="클릭하여 복사"
                className={`mt-1 flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border transition ${
                  isDarkMode
                    ? 'border-indigo-700 text-indigo-400 hover:bg-indigo-900/30'
                    : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                주문번호: #{selectedOrder.orderId}
              </button>
              {/* 네이버 주문번호 연결 */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={naverOrderNumber}
                  onChange={(e) => setNaverOrderNumber(e.target.value)}
                  placeholder="네이버 주문번호 입력 후 저장"
                  className={`text-xs font-mono px-2 py-1 rounded border flex-1 outline-none ${
                    isDarkMode
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-500'
                      : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                  }`}
                />
                <button
                  onClick={async () => {
                    if (!selectedOrder.orderId || !naverOrderNumber.trim()) return;
                    setSavingNaverNum(true);
                    try {
                      await updatePremiumOrder(selectedOrder.orderId, { naverOrderNumber: naverOrderNumber.trim() });
                      await loadOrders();
                    } finally {
                      setSavingNaverNum(false);
                    }
                  }}
                  disabled={savingNaverNum || !naverOrderNumber.trim()}
                  className={`text-xs px-2 py-1 rounded font-bold transition ${
                    savingNaverNum || !naverOrderNumber.trim()
                      ? isDarkMode ? 'bg-zinc-700 text-zinc-500' : 'bg-gray-200 text-gray-400'
                      : isDarkMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  }`}
                >
                  {savingNaverNum ? '저장 중' : '저장'}
                </button>
              </div>
              {selectedOrder.naverOrderNumber && (
                <div className={`mt-1 text-xs font-mono ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  네이버: {selectedOrder.naverOrderNumber}
                </div>
              )}
              {selectedOrder.updatedByCustomerAt && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                  <PenLine className="w-3 h-3" />고객 수정됨
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedOrder(null)}
              className={`p-2 rounded hover:${isDarkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={`grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>생년월일</p>
              <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedOrder.birthDate}</p>
            </div>
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>출생시간</p>
              <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedOrder.birthTime}</p>
            </div>
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>성별</p>
              <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedOrder.gender === 'M' ? '남성' : '여성'}</p>
            </div>
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>상품</p>
              <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedOrder.tier === 'premium' ? '프리미엄' : '기본'} (₩{selectedOrder.price})</p>
            </div>
            {selectedOrder.concern && (
              <div className="col-span-2">
                <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>특별한 고민</p>
                <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedOrder.concern}</p>
              </div>
            )}
            {selectedOrder.interest && (
              <div className="col-span-2">
                <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>관심사</p>
                <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedOrder.interest}</p>
              </div>
            )}
          </div>

          {/* 상태별 액션 버튼 */}
          {selectedOrder.status === 'submitted' && (
            <button
              onClick={() => handleGenerateReport(selectedOrder.orderId!)}
              disabled={generatingOrderId === selectedOrder.orderId}
              className={`w-full py-3 rounded-lg font-bold mb-4 flex items-center justify-center gap-2 transition ${
                generatingOrderId === selectedOrder.orderId
                  ? isDarkMode ? 'bg-zinc-600 text-zinc-400' : 'bg-gray-300 text-gray-500'
                  : isDarkMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
              }`}
            >
              <Zap className="w-5 h-5" />
              {generatingOrderId === selectedOrder.orderId ? '생성 중...' : '리포트 생성'}
            </button>
          )}

          {selectedOrder.status === 'generating' && (
            <div className={`w-full py-3 rounded-lg font-bold mb-4 text-center ${isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
              🕐 리포트 생성 중입니다... (평균 5~15분 소요)
            </div>
          )}

          {selectedOrder.status === 'reviewing' && (
            <div className="space-y-4 mb-4">
              {selectedOrder.pdfUrl && (
                <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'border-zinc-700' : 'border-gray-300'}`}>
                  <iframe
                    src={selectedOrder.pdfUrl}
                    className="w-full h-96"
                    title="Report Preview"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => handleSendReport(selectedOrder.orderId!)}
                  disabled={loading}
                  className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                    loading
                      ? isDarkMode ? 'bg-zinc-600 text-zinc-400' : 'bg-gray-300 text-gray-500'
                      : isDarkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <Send className="w-5 h-5" />
                  발송하기
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={loading}
                  className={`px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                    loading
                      ? isDarkMode ? 'bg-zinc-600 text-zinc-400' : 'bg-gray-300 text-gray-500'
                      : isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  <Trash2 className="w-5 h-5" />
                  반려
                </button>
              </div>
            </div>
          )}

          {selectedOrder.status === 'delivered' && (
            <div className="space-y-4 mb-4">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <p className={`font-bold mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>✅ 고객에게 발송되었습니다.</p>
                {selectedOrder.sentAt && (
                  <p className={`text-xs ${isDarkMode ? 'text-green-300/70' : 'text-green-600'}`}>
                    발송일시: {(() => { try { const d = selectedOrder.sentAt?.toDate ? selectedOrder.sentAt.toDate() : new Date(selectedOrder.sentAt); return d.toLocaleString('ko-KR'); } catch { return '-'; } })()}
                  </p>
                )}
                {selectedOrder.emailSendCount && selectedOrder.emailSendCount > 1 && (
                  <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                    📧 총 {selectedOrder.emailSendCount}회 발송됨
                  </p>
                )}
              </div>

              {/* 이메일 배달 상태 */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>📬 이메일 배달 상태</p>
                  <button
                    onClick={() => handleCheckEmailStatus(selectedOrder)}
                    disabled={emailStatusLoading}
                    className={`px-3 py-1 rounded text-xs font-bold transition ${
                      emailStatusLoading
                        ? isDarkMode ? 'bg-zinc-700 text-zinc-500' : 'bg-gray-200 text-gray-400'
                        : isDarkMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                    }`}
                  >
                    {emailStatusLoading ? '확인 중...' : '상태 확인'}
                  </button>
                </div>

                {/* 저장된 상태 표시 */}
                {(selectedOrder.emailStatus || emailStatusResult) && (() => {
                  const status = emailStatusResult?.status || selectedOrder.emailStatus || 'unknown';
                  const statusMap: Record<string, { label: string; desc: string; color: string; bg: string }> = {
                    delivered:  { label: '✅ 정상 수신', desc: '고객의 메일 서버에 정상적으로 전달되었습니다.', color: isDarkMode ? 'text-green-400' : 'text-green-700', bg: isDarkMode ? 'bg-green-500/10' : 'bg-green-50' },
                    sent:       { label: '📤 발송 완료', desc: '이메일이 발송되었으나 아직 수신 확인이 되지 않았습니다. 잠시 후 다시 확인해보세요.', color: isDarkMode ? 'text-blue-400' : 'text-blue-700', bg: isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50' },
                    bounced:    { label: '❌ 수신 실패 (바운스)', desc: '이메일 주소가 잘못되었거나 수신 서버가 거부했습니다. 고객 이메일 주소를 확인하고 재발송하세요.', color: isDarkMode ? 'text-red-400' : 'text-red-700', bg: isDarkMode ? 'bg-red-500/10' : 'bg-red-50' },
                    complained: { label: '⚠️ 스팸 처리됨', desc: '고객이 이메일을 스팸으로 신고했거나 스팸 필터에 걸렸습니다. 고객에게 직접 연락하여 스팸함 확인을 안내하세요.', color: isDarkMode ? 'text-amber-400' : 'text-amber-700', bg: isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50' },
                    unknown:    { label: '❓ 상태 미확인', desc: '아직 배달 상태를 확인하지 않았습니다. "상태 확인" 버튼을 눌러주세요.', color: isDarkMode ? 'text-zinc-400' : 'text-zinc-600', bg: isDarkMode ? 'bg-zinc-700' : 'bg-zinc-100' },
                  };
                  const info = statusMap[status] || statusMap.unknown;
                  return (
                    <div className={`p-3 rounded-lg ${info.bg}`}>
                      <p className={`text-sm font-bold ${info.color}`}>{info.label}</p>
                      <p className={`text-xs mt-1 opacity-80 ${info.color}`}>{info.desc}</p>
                      {emailStatusResult?.lastEvent && (
                        <p className={`text-[10px] mt-2 opacity-50 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Resend 이벤트: {emailStatusResult.lastEvent} · 확인시각: {emailStatusResult.checkedAt}
                        </p>
                      )}
                      {!emailStatusResult && selectedOrder.emailStatusCheckedAt && (
                        <p className={`text-[10px] mt-2 opacity-50 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          마지막 확인: {(() => { try { const d = selectedOrder.emailStatusCheckedAt?.toDate ? selectedOrder.emailStatusCheckedAt.toDate() : new Date(selectedOrder.emailStatusCheckedAt); return d.toLocaleString('ko-KR'); } catch { return '-'; } })()}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {!selectedOrder.emailMessageId && (
                  <p className={`text-xs italic ${isDarkMode ? 'text-zinc-500' : 'text-gray-400'}`}>
                    이전 버전에서 발송된 주문이라 메시지 ID가 없습니다. 재발송하면 추적이 가능합니다.
                  </p>
                )}
              </div>

              {/* 재발송 버튼 */}
              {selectedOrder.pdfUrl && (
                <button
                  onClick={() => {
                    if (confirm('고객에게 리포트를 다시 발송하시겠습니까?')) {
                      handleSendReport(selectedOrder.orderId!, true);
                    }
                  }}
                  disabled={loading}
                  className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                    loading
                      ? isDarkMode ? 'bg-zinc-600 text-zinc-400' : 'bg-gray-300 text-gray-500'
                      : isDarkMode ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-violet-500 hover:bg-violet-600 text-white'
                  }`}
                >
                  <Send className="w-5 h-5" />
                  재발송하기
                </button>
              )}
            </div>
          )}

          {selectedOrder.status === 'rejected' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>반려 사유</p>
                <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>{selectedOrder.rejectReason}</p>
              </div>
              <button
                onClick={() => handleGenerateReport(selectedOrder.orderId!)}
                disabled={generatingOrderId === selectedOrder.orderId}
                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                  generatingOrderId === selectedOrder.orderId
                    ? isDarkMode ? 'bg-zinc-600 text-zinc-400' : 'bg-gray-300 text-gray-500'
                    : isDarkMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                }`}
              >
                <Zap className="w-5 h-5" />
                {generatingOrderId === selectedOrder.orderId ? '재생성 중...' : '재생성하기'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`w-3/5 flex items-center justify-center ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
          📋 좌측에서 주문을 선택하세요
        </div>
      )}

      {/* 반려 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-zinc-900' : 'bg-white'} rounded-lg p-6 max-w-sm`}>
            <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>반려 사유 입력</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요"
              className={`w-full p-3 rounded border mb-4 ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-black'}`}
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className={`flex-1 py-2 rounded font-bold ${isDarkMode ? 'bg-zinc-700 text-white' : 'bg-gray-300 text-black'}`}
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
                className={`flex-1 py-2 rounded font-bold ${
                  loading || !rejectReason.trim()
                    ? isDarkMode ? 'bg-zinc-600 text-zinc-400' : 'bg-gray-300 text-gray-500'
                    : isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                반려하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
