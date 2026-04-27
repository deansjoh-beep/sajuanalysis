import { 
  collection, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  orderBy,
  serverTimestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { auth, db, signInAnonymously } from '../firebase';

export interface LifeEvent {
  year: number;
  description: string;
}

export type ProductType = 'premium' | 'yearly2026' | 'jobCareer';

export interface ReportInputData {
  name: string;
  gender: 'M' | 'F';
  birthDate: string;
  birthTime: string;
  isLunar: boolean;
  isLeap: boolean;
  unknownTime: boolean;
  concern: string;
  interest: string;
  reportLevel: 'basic' | 'advanced' | 'both';
  lifeEvents: LifeEvent[];
  adminNotes: string;
  productType?: ProductType;
  currentJob?: string;
  workHistory?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  summary: string;
  content: string;
  daeunBlocks?: DaeunBlock[];
}

export interface DaeunBlock {
  label: string;
  startAge: number;
  endAge: number;
  content: string;
  lifeEvents: LifeEvent[];
}

export interface PremiumOrder {
  orderId?: string;
  customerId?: string;
  name: string;
  email: string;
  birthDate: string;
  birthTime: string;
  isLunar: boolean;
  isLeap: boolean;
  gender: 'M' | 'F';
  unknownTime: boolean;
  tier: 'basic' | 'premium';
  price: number;
  concern?: string;
  interest?: string;
  status: 'submitted' | 'generating' | 'reviewing' | 'delivered' | 'rejected' | 'cancelled';
  reportText?: string;
  pdfUrl?: string;
  rejectReason?: string;
  cancelReason?: string;
  lifeEvents?: LifeEvent[];
  adminNotes?: string;
  reportLevel?: 'basic' | 'advanced' | 'both';
  productType?: ProductType;
  currentJob?: string;
  workHistory?: string;
  naverOrderNumber?: string;
  emailMessageId?: string;
  emailStatus?: 'sent' | 'delivered' | 'bounced' | 'complained' | 'unknown';
  emailStatusCheckedAt?: any;
  emailSendCount?: number;
  version: number;
  createdAt?: any;
  generatedAt?: any;
  sentAt?: any;
  updatedByCustomerAt?: any;
}

const COLLECTION_NAME = 'premiumOrders';

const buildOrderPayload = (order: PremiumOrder) => ({
  ...order,
  status: 'submitted',
  version: 1,
  createdAt: serverTimestamp(),
  generatedAt: null,
  sentAt: null,
});

export const createPremiumOrder = async (order: PremiumOrder): Promise<string> => {
  try {
    // Use server API to bypass client-side Firestore permission issues
    // Server acts as a trusted intermediary for Firestore writes
    const response = await fetch('/api/premium-order/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order)
    });

    // Always try to parse response for error details
    let responseData: any;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch (parseErr) {
        console.error('Failed to parse JSON response:', parseErr);
        responseData = { error: 'INVALID_JSON' };
      }
    } else {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      responseData = { error: 'INVALID_RESPONSE', message: text };
    }

    if (!response.ok) {
      const errorMsg = responseData?.message || responseData?.error || 'Failed to create premium order';
      throw new Error(errorMsg);
    }

    const orderId = responseData?.orderId;
    if (!orderId) {
      throw new Error('No order ID returned from server');
    }

    return orderId;

  } catch (error: any) {
    console.error('Failed to create premium order:', error);
    throw error;
  }
};

export const getPremiumOrders = async (
  status?: string,
  productType?: ProductType | 'all'
): Promise<PremiumOrder[]> => {
  try {
    // Use server API to bypass client-side Firestore permission issues
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (productType && productType !== 'all') params.set('productType', productType);
    const qs = params.toString();
    const url = `/api/premium-orders${qs ? `?${qs}` : ''}`;
    const response = await fetch(url);

    let responseData: any;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch (parseErr) {
        console.error('Failed to parse JSON response:', parseErr);
        responseData = { error: 'INVALID_JSON' };
      }
    } else {
      const text = await response.text().catch(() => '');
      console.error('Non-JSON response:', text);
      responseData = { error: 'INVALID_RESPONSE', message: text };
    }

    if (!response.ok) {
      const errorMsg = responseData?.message || responseData?.error || 'Failed to fetch premium orders';
      throw new Error(errorMsg);
    }

    const data = responseData;
    return data.orders || [];
  } catch (error) {
    console.error('Failed to get premium orders:', error);
    throw error;
  }
};

export const getPremiumOrder = async (orderId: string): Promise<PremiumOrder | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, orderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        orderId: docSnap.id,
        ...docSnap.data()
      } as PremiumOrder;
    }
    return null;
  } catch (error) {
    console.error('Failed to get premium order:', error);
    throw error;
  }
};

export const updatePremiumOrder = async (orderId: string, updates: Partial<PremiumOrder>): Promise<void> => {
  try {
    // serverTimestamp()는 JSON 직렬화 불가 — 서버 API가 타임스탬프를 자동 설정함
    const { generatedAt, sentAt, createdAt, updatedByCustomerAt, ...safeUpdates } = updates;

    const response = await fetch('/api/premium-order/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, updates: safeUpdates }),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      try {
        const parsed = JSON.parse(raw);
        throw new Error(parsed?.message || parsed?.error || 'Failed to update premium order');
      } catch {
        throw new Error(raw || 'Failed to update premium order');
      }
    }
  } catch (error) {
    console.error('Failed to update premium order:', error);
    throw error;
  }
};

export const rejectPremiumOrder = async (orderId: string, rejectReason: string): Promise<void> => {
  try {
    const response = await fetch('/api/premium-order/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, rejectReason }),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      try {
        const parsed = JSON.parse(raw);
        throw new Error(parsed?.message || parsed?.error || 'Failed to reject premium order');
      } catch {
        throw new Error(raw || 'Failed to reject premium order');
      }
    }
  } catch (error) {
    console.error('Failed to reject premium order:', error);
    throw error;
  }
};

// 고객이 주문번호+이메일로 자신의 주문을 조회
export const getOrderByIdAndEmail = async (orderId: string, email: string): Promise<PremiumOrder | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, orderId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data() as PremiumOrder;
    if (data.email.toLowerCase().trim() !== email.toLowerCase().trim()) return null;
    return { orderId: docSnap.id, ...data };
  } catch (error) {
    console.error('Failed to get order by id and email:', error);
    throw error;
  }
};

// 고객이 submitted 상태 주문의 내용 필드만 수정
export const updateOrderContent = async (
  orderId: string,
  email: string,
  updates: Pick<PremiumOrder, 'concern' | 'interest' | 'reportLevel' | 'lifeEvents'>
): Promise<void> => {
  try {
    const order = await getOrderByIdAndEmail(orderId, email);
    if (!order) throw new Error('주문을 찾을 수 없거나 이메일이 일치하지 않습니다.');
    if (order.status !== 'submitted') throw new Error('제작이 시작된 주문은 수정할 수 없습니다.');
    const docRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(docRef, {
      ...updates,
      updatedByCustomerAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to update order content:', error);
    throw error;
  }
};

// 고객이 submitted 상태 주문을 취소
export const cancelPremiumOrder = async (
  orderId: string,
  email: string,
  cancelReason?: string
): Promise<void> => {
  try {
    const order = await getOrderByIdAndEmail(orderId, email);
    if (!order) throw new Error('주문을 찾을 수 없거나 이메일이 일치하지 않습니다.');
    if (order.status !== 'submitted') throw new Error('제작이 시작된 주문은 취소할 수 없습니다.');
    const docRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(docRef, {
      status: 'cancelled',
      cancelReason: cancelReason ?? '',
    });
  } catch (error) {
    console.error('Failed to cancel order:', error);
    throw error;
  }
};
