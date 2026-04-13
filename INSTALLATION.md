# 프리미엄 Saju 리포트 시스템 설치 가이드

## 📦 폴더 구조

```
sajuanalysis/
├── src/
│   ├── lib/
│   │   ├── premiumOrderStore.ts      (새로 추가)
│   │   ├── generatePremiumReport.ts  (새로 추가)
│   │   └── sendPremiumReportEmail.ts (새로 추가)
│   └── components/
│       └── PremiumOrdersPanel.tsx    (새로 추가)
├── .env.local.example               (새로 추가)
└── src/App.tsx                       (수정 필요)
```

## 🚀 설치 단계

### 1️⃣ zip 파일 압축 해제
```bash
cd sajuanalysis
# premium-saju-feature.zip을 sajuanalysis 폴더에 옮김
unzip premium-saju-feature.zip
```

### 2️⃣ App.tsx 수정 (4가지 변경사항)

#### **변경 1: Import 문 상단에 추가** (약 1-30줄)

```typescript
// 기존 코드 위치 찾기: import { Sparkles, ... } from "lucide-react";
import { 
  Send, 
  User, 
  Sparkles, 
  RefreshCw, 
  Moon, 
  Sun,
  MessageCircle,
  FileText,
  LayoutDashboard,
  Compass,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  Info,
  Database,
  Lock,
  Puzzle,
  Bot,
  BookOpen,
  Zap,
  Cpu,
  Waves,
  Download,
  Mail,
  Check,
  ExternalLink,
  Ticket,
  Gift  // ← 이 줄 추가
} from "lucide-react";
```

그리고 아래 import들 중 (약 42줄쯤) 아래에 추가:
```typescript
import { Newspaper, ArrowLeft, Plus, Trash2, Edit2, X, Save, ArrowRight, Image as ImageIcon, Maximize } from "lucide-react";
import { PremiumOrdersPanel } from "./components/PremiumOrdersPanel";  // ← 이 줄 추가

import { SAJU_GUIDELINE, CONSULTING_GUIDELINE, REPORT_GUIDELINE } from "./constants/guidelines";
```

---

#### **변경 2: activeTab 타입 수정** (약 455줄)

```typescript
// 기존 코드:
const [activeTab, setActiveTab] = useState<"welcome" | "dashboard" | "chat" | "report" | "guide" | "blog">("welcome");

// 변경 후:
const [activeTab, setActiveTab] = useState<"welcome" | "dashboard" | "chat" | "report" | "guide" | "blog" | "premium">("welcome");
```

---

#### **변경 3: 데스크톱 네비게이션 (약 2400줄)**

```typescript
// 기존 코드 찾기: Desktop Navigation 섹션
<nav className="hidden md:flex items-center gap-2 lg:gap-4">
  {[
    { id: "welcome", icon: User, label: t('navHome') },
    { id: "dashboard", icon: LayoutDashboard, label: t('navSaju') },
    { id: "chat", icon: MessageCircle, label: t('navChat') },
    { id: "report", icon: FileText, label: t('navReport') },
    { id: "blog", icon: Newspaper, label: t('navBlog') },  // ← 이 줄 아래에 다음 줄 추가
    { id: "premium", icon: Gift, label: "프리미엄" },      // ← 추가
    { id: "guide", icon: Info, label: t('navGuide') }
  ].map((tab) => (
```

---

#### **변경 4: 모바일 네비게이션 (약 3705줄)**

```typescript
// 기존 코드 찾기: mobile navigation 섹션
<nav className={`md:hidden px-4 pt-1 border-t ...`}>
  <div className="max-w-md mx-auto flex items-center justify-around">
    {[
      { id: "welcome", icon: User, label: t('navHome') },
      { id: "dashboard", icon: LayoutDashboard, label: t('navSaju') },
      { id: "chat", icon: MessageCircle, label: t('navChat') },
      { id: "report", icon: FileText, label: t('navReport') },
      { id: "premium", icon: Gift, label: "프리미엄" },    // ← 추가
      { id: "blog", icon: Newspaper, label: t('navBlog') },
      { id: "guide", icon: Info, label: t('navGuide') }
    ].map((tab) => (
```

---

#### **변경 5: Premium 탭 콘텐츠 렌더링 (약 3680줄)**

`activeTab === "blog" && (...)` 섹션 아래에 다음을 추가:

```typescript
          )}

          {activeTab === "premium" && (
            <motion.div 
              key="premium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col overflow-hidden bg-white dark:bg-black"
            >
              <PremiumOrdersPanel isDarkMode={isDarkMode} />
            </motion.div>
          )}
        </AnimatePresence>
```

---

### 3️⃣ .env.local 설정

```bash
# .env.local.example을 .env.local로 복사
cp .env.local.example .env.local

# 텍스트 에디터로 열어서 다음 값들을 입력:
```

#### `.env.local` 파일 내용:
```
# Google Gemini API Key (https://makersuite.google.com/app/apikey)
VITE_GEMINI_API_KEY=sk-xxxxxxxxxxxxxx

# Resend Email Service API Key (https://resend.com)
VITE_RESEND_API_KEY=re_xxxxxxxxxxxxxx

# 이메일 발신자 주소 (Resend에서 설정한 도메인)
VITE_FROM_EMAIL=noreply@yourdomain.com
```

**중요:** `.env.local`은 `.gitignore`에 추가되어 있으므로 GitHub에 커밋되지 않습니다.

---

### 4️⃣ Firebase 설정 (기존 설정 확인)

sajuanalysis의 `src/firebase.ts`에서 이미 설정된 것 확인:
- ✅ Firestore
- ✅ Firebase Storage
- ✅ Firebase Auth

기존 구성을 그대로 사용합니다. 추가 설정 불필요!

---

### 5️⃣ Firestore 보안 규칙 (선택사항 - 권장)

Firebase Console → Firestore → Rules 탭에서:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 기존 규칙 유지...
    
    // 프리미엄 주문 컬렉션
    match /premiumOrders/{orderId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // PDF 저장소
    match /premiumReports/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

---

## ✅ 설치 확인

개발 서버를 실행하고 다음을 확인하세요:

```bash
npm run dev
```

브라우저에서:
1. ✅ 네비게이션 바에 **"프리미었"** 탭이 보이는가?
2. ✅ 프리미엄 탭을 클릭하면 주문 관리 대시보드가 로드되는가?
3. ✅ 콘솔에 에러가 없는가? (F12 → Console)

---

## 🔧 문제해결

### "PremiumOrdersPanel이 없습니다" 에러
→ `src/components/PremiumOrdersPanel.tsx`가 zip에서 제대로 추출되었는지 확인

### "Gemini API 에러" (리포트 생성 시)
→ `.env.local`에서 `VITE_GEMINI_API_KEY` 값이 올바른지 확인

### "Resend 이메일 발송 실패"
→ `.env.local`에서 `VITE_FROM_EMAIL`, `VITE_RESEND_API_KEY` 확인

---

## 📚 다음 단계

1. **테스트 플로우**: 
   ```
   관리자 로그인 → 프리미엄 탭 → [주문 생성] → [리포트 생성] → [발송]
   ```

2. **프로덕션 배포** (Vercel):
   ```bash
   # Environment Variables 추가
   vercel env add VITE_GEMINI_API_KEY
   vercel env add VITE_RESEND_API_KEY
   vercel env add VITE_FROM_EMAIL
   
   vercel deploy
   ```

---

**설치가 완료되었으면 이 문서를 삭제하셔도 됩니다!** ✨
