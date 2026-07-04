# 코드 인벤토리 — 2026-07-03 (Phase 0)

> **작성 목적**: Phase 1 이후의 모든 판단 근거가 되는 저장소 실체 스냅샷.
> 이 문서는 IMPLEMENTATION_PLAN.md가 전제한 스택("Next.js + Vercel Postgres + Anthropic")과 실제 저장소 사이의 격차를 명시적으로 기록한다.

---

## 1. 스택 실측 vs 지시서 전제

| 영역 | IMPLEMENTATION_PLAN.md 전제 | **실제 저장소** | 격차 대응 |
|---|---|---|---|
| 프레임워크 | Next.js 14 (App Router) | **Vite 6 + React 19 (SPA)** + Express `server.ts` (dev/prod 공용) | Phase 1 착수 전 OWNER 결정 필요 — SPA 유지 vs Next.js 이관 |
| 배포 | Vercel Functions | Vercel `api/*.ts`(4개) + `server.ts`(dev/self-host) 이중 구조 | Phase 2 결제 API 신설 시 배포 대상 명확화 필요 |
| DB | Vercel Postgres (Neon) | **Firestore** (`ai-studio-fbfb1881-9f6e-4c3b-9700-cb6640ef2eb9`) | Phase 2 스키마 설계 시 Postgres 이관 또는 Firestore 유지 결정 필요 |
| 파일저장 | (미정) | Firebase Storage (`lifeNavReports/*.pdf`) — Signed URL 만료 `2100-01-01` | Phase 2 자동 파기 요건과 정면 충돌 (아래 3장 참조) |
| LLM | Anthropic Claude API | **Google Gemini** (`@google/genai`) — 모델 폴백 체인 사용 | Phase 1 재작성 시 Anthropic 이관 또는 Gemini 유지 결정 필요 |
| 결제 | 토스페이먼츠/포트원 | **미구현**. 관리자가 수동으로 주문 → 리포트 발송 | Phase 2 신규 개발 |
| 인증 | 회원가입/로그인 없음 | Firebase Auth (`signInAnonymously`) + 관리자 이메일 화이트리스트 | 익명 인증만 있으므로 무회원 원칙과 정합. 관리자만 이메일 기반 |
| 만세력 라이브러리 | 자체 결정론 코드 | `lunar-javascript` 1.7.7 + 자체 TS 확장(saju.ts 954줄) | **재사용 가능**. Phase 1은 확장·검증 중심 |

---

## 2. 디렉토리·파일 지도

### 프론트엔드 (`src/`)
- `App.tsx` — **3,895줄 단일 컴포넌트**. Gemini 호출·라우팅·상담·리포트 UI가 한 파일에 집중. **Phase 1 착수 시 분해 필요**.
- `main.tsx` (10줄) / `i18n.ts` / `index.css` — 부트스트랩.
- `firebase.ts` — Firebase 초기화 (Auth, Firestore, Storage).
- `utils/`
  - `saju.ts` (954줄) — **만세력·해석 결정론 코드의 핵심**. 상세는 아래 4장.
  - `sajuAlgorithm.ts` (120줄) — 보조 계산.
  - `taekilEngine.ts` (825줄) — 택일 엔진(결혼·이사·개업 등 카테고리별 결정론 추천).
  - `saju.test.ts` — Vitest 5건. 대표 케이스만 검증. 커버리지 매우 낮음.
- `lib/`
  - `generatePremiumReport.ts` (625줄) — Gemini 프리미엄 리포트 생성. `LIFE_NAV_REQUIRED_SECTION_IDS` 12섹션.
  - `promptBuilders.ts` (353줄) — 상담·리포트 시스템 프롬프트 빌더.
  - `premiumOrderStore.ts` (299줄) — 주문 CRUD(Firestore). **PII 저장 컬럼 존재** (3장 참조).
  - `modelCooldown.ts` / `modelTelemetry.ts` / `modelUtils.ts` — 모델 폴백·쿨다운·계측.
  - `sendPremiumReportEmail.ts` (251줄) — Resend API 이메일 발송.
  - `seoulDateGanji.ts` (126줄) — 서울 기준 오늘/올해 간지.
- `constants/`
  - `guidelines.ts` / `guidelines.test.ts` — 통변 가이드라인 상수.
  - `deityInterpretation.ts` — 십성 해설(한/영).
  - `questions.ts` / `taekil.ts` / `taekilGuide.ts` / `blog.ts` / `guideDefaults.ts` / `styles.ts`.
- `hooks/` (11개) — 탭·액션 상태. `useChatSendAction.ts`(461줄), `useBlogTabState.ts`(788줄)가 가장 큼.
- `components/`
  - 루트: `PremiumOrderForm.tsx`, `PremiumOrdersPanel.tsx`, `FiveElementsPieChart.tsx`, 블로그 에디터(TipTap 기반) 3종, 가이드 탭.
  - `admin/` — `AdminPage.tsx`, `PremiumReportMakerPage.tsx`, `PremiumReportInputPanel.tsx`, `PremiumReportPreview.tsx`.
  - `blog/` — 블로그 4종.
  - `tabs/` — ChatTab, ReportTab(2종), TaekilTab, BlogTab, GuideTabContent.
- `locales/` — i18n 자원.

### API 계층
- `api/generate-pdf.ts` (369줄) — Puppeteer 기반 PDF 렌더 (Vercel 배포용, `@sparticuz/chromium-min`).
- `api/premium-orders.ts` (93줄) — 주문 목록 API (Admin SDK).
- `api/premium-order/{create,update,reject}.ts` — 주문 CRUD.
- `api/premium-report/{upload,upload-url,send-email}.ts` — PDF 업로드·서명 URL·이메일 발송.
- `server.ts` (689줄) — dev 서버 겸 self-host 프로덕션 서버. `/api/*` 라우트가 Vercel 함수와 **중복 구현**됨(이중 진실 원천). Phase 2 착수 시 하나로 통합 필요.

### 인프라 설정
- `vercel.json` — `api/generate-pdf.ts` 메모리 1024MB / 120s, SPA 리라이트.
- `firebase-applet-config.json` — 클라이언트 Firebase 설정.
- `firebase.json` / `firestore.rules` (10KB) — Firestore 보안 규칙.
- `firebase-blueprint.json` — Firebase Studio 청사진.
- `playwright.config.ts` + `e2e/` — E2E 골격 (실제 스펙 수 미확인).

### 문서
- `MANSE_DATA_PIPELINE.md` (30KB) — 만세력 데이터 파이프라인 상세.
- `MANSE_DAEUN_PIPELINE.md` (8KB) — 대운 파이프라인.
- `INSTALLATION.md` (7KB) / `CHANGELOG.md` (8KB) / `ACCESSIBILITY_AUDIT_2026-03-29.md` / `DEPLOY_CHECKLIST_2026-03-28.md`.

---

## 3. 개인정보 흐름 (개요)
현행 시스템은 **PII를 실제로 저장한다**. 상세는 [privacy-flow.md](privacy-flow.md) 참조.
- Firestore `premiumOrders` 컬렉션에 `name`, `email`, `birthDate`, `birthTime`, `concern`, `interest`, `lifeEvents(자유 텍스트)` 저장.
- 리포트 PDF는 Firebase Storage에 **만료 `2100-01-01` Signed URL**로 업로드 — 사실상 영속.
- 자동 파기 크론·`expires_at` 컬럼·즉시 삭제 API 모두 부재.
- 이는 IMPLEMENTATION_PLAN.md §16 "절대 원칙 2 — 개인정보 최소화"를 **정면으로 위반**. Phase 2 데이터 계층 재설계의 최우선 항목.

---

## 4. 만세력 산출 로직 판정 — **결정론 코드**

**결론**: 만세력 8자·대운·지장간·합충·신살은 100% 결정론적 TypeScript로 산출된다. LLM 위임분 없음.

### 4-1. 산출 경로
1. 입력: 생년월일시 + `isLunar`/`isLeap`/`unknownTime` + timezone(+ 경도/위도).
2. `getAdjustedTime()` — 표준시 변경(30분 시프트)·서머타임 보정 오프셋 계산. `src/utils/saju.ts:245`.
3. `applyTrueSolarTime()` — 진태양시 보정(경도 + 균시차). `src/utils/saju.ts:26`.
4. `getSolarFromBirthInput()` — 음/양 변환. lunar-javascript `Solar.fromYmdHms` / `Lunar.fromYmdHms`. `src/utils/saju.ts:56`.
5. `Solar.getLunar().getEightChar()` — 라이브러리가 절기 기준 사주 8자 반환. `setDayZero(2)` 옵션으로 야자시 처리 (00:00~00:59을 다음 날 자시로).
6. `getSajuData()`가 십성·지장간·오행 조합해 반환. `src/utils/saju.ts:267`.
7. `getDaeunData()` — 대운수(다음/이전 절기까지 일수 ÷ 3), 대운 10개 산출. `src/utils/saju.ts:529`.

### 4-2. 핵심 산출 함수 (모두 결정론)
| 함수 | 위치 | 산출물 |
|---|---|---|
| `getSajuData` | saju.ts:267 | 4주 8자 + 십성 + 지장간 |
| `getDaeunData` | saju.ts:529 | 대운수·순역·10대운 |
| `calculateDeity` | saju.ts:82 | 십성 계산 (본기 기준) |
| `calculateYongshin` | saju.ts:145 | 억부/조후 용신 (가중치 점수제) |
| `calculateGyeok` | saju.ts:608 | 격국 판정 |
| `getSipseung` | saju.ts:663 | 12운성 조견표 |
| `getGongmang` / `getGongmangSummary` | saju.ts:682 | 순중공망 |
| `getHapChungSummary` | saju.ts:727 | 천간합/충, 지지 육합/삼합/충 |
| `getShinsal` / `getShinsalSummary` | saju.ts:815 | 12신살 |
| `getYangin` / `getCheoneulGuiin` / `isWonjin` / `isGoegang` / `isHyeong` / `isPa` / `isHae` / `isChung` / `getYukhap` / `getMunchang` / `getHakdang` | saju.ts:859~954 | 기타 신살 |
| `getCurrentYearPillarKST` / `getTodayDayPillarKST` | seoulDateGanji.ts | 서울 기준 오늘·올해 간지 |

### 4-3. 정책 실측 (⛔ OWNER 결정 필요 항목의 현행값)
| 항목 | 현행 코드 정책 | 위치 |
|---|---|---|
| 야자시/조자시 | **야자시 = 다음 날 자시로 처리** (lunar-javascript `setDayZero(2)`) | saju.ts:293, seoulDateGanji.ts:61 |
| 진태양시(경도 보정) | **선택 적용**. `longitude` 인자 전달 시만 적용 (`applyTrueSolarTime`) | saju.ts:26 |
| 서머타임 보정 | **자동 적용**. 1948~51, 1955~60, 1987~88 여름철 -60분 오프셋 | saju.ts:253 |
| 표준시 변경 | **자동 적용**. 1912-01-01~1954-03-20, 1961-08-10 이후 -30분 오프셋 | saju.ts:248 |

Phase 1의 `lib/manseryeok/policy.ts` 신설 시 위 값을 그대로 명문화하거나 OWNER 결정으로 변경한다.

### 4-4. 리포트에 필요하지만 아직 없는 산출
- **절입 경계 감지**(±24시간 이내 출생) 플래그 — 미구현.
- **월운 12개**(절입 기준) 산출 — 미구현. Phase 1-2에서 신규 개발 필요.

---

## 5. 실시간 상담(간명 챗) 구조

### 5-1. LLM 호출
- 사용 SDK: `@google/genai` `GoogleGenAI`.
- 호출 지점: `src/hooks/useChatSendAction.ts:258, 348`. 모델 폴백 체인 (`modelUtils.ts`).
- 시스템 프롬프트: `promptBuilders.ts::buildConsultingSystemInstruction` (basic/advanced 톤 분기).
- 컨텍스트: `sajuContext`(원국 요약 문자열) + `daeunContext`(대운 요약) + 최근 4일 일진 + 올해 세운.
- 쿨다운: `modelCooldown.ts` — 2분 창에서 4회 실패 시 25초 쿨다운, localStorage 저장.

### 5-2. 이력 저장 여부
- **저장 없음**. 채팅 이력은 `useChatTabState.ts`의 React state에만 존재. 새로고침 시 소실.
- 익명 Firebase Auth 세션 유지되지만 채팅과 결합되어 있지 않음.

### 5-3. 비용/한도 노출
- 사용자에게 노출되는 원가 제어 UI 없음.
- 서버 측 요청 한도·타임아웃 없음 (IMPLEMENTATION_PLAN.md §16 원칙 5 미준수).
- Gemini API 키는 서버(`/api/runtime-config`)에서 응답으로 반환 — **키 유출 경로**. Phase 2 결제·후속 질문 도입 시 서버 프록시로 전면 이관 필요.

### 5-4. Phase 2 "리포트 구매자 한정 후속 질문 3회" 전환 시 필요
- 이력 저장(코드+회차) 컬럼 신설.
- 서버 측 요청 카운터·타임아웃·모델 한정.
- API 키 서버 프록시화 (클라이언트로 절대 반환하지 않도록).

---

## 6. 외부 의존성 요약

### 주요 런타임 의존성 (Phase 1~2 판단 영향분만)
- `@google/genai` 1.45 — LLM. Anthropic 이관 여부 결정 필요.
- `lunar-javascript` 1.7.7 — 만세력 8자 산출 핵심. **유지 권장**.
- `firebase` 12.11 / `firebase-admin` 13.7 — DB/Auth/Storage.
- `luxon` 3.7 / `tz-lookup` 6.1 — 시간대·경도 처리.
- `puppeteer-core` 24.40 / `@sparticuz/chromium-min` 143 — PDF 렌더.
- `jspdf` 4.2 — 대체 PDF 경로.
- `resend` (API 직접 호출) — 이메일.
- `react` 19 / `vite` 6 / `tailwindcss` 4.
- `@tiptap/*` — 블로그 에디터.
- `express` 4.22 — dev/self-host 서버.

### 개발 의존성
- `vitest` 4 / `@playwright/test` 1.58 / `@testing-library/react` 16 — 테스트 인프라 존재. **커버리지 미측정**.

### 사업 판단에 영향을 주는 사항
- **결제 SDK 없음** — 토스페이먼츠/포트원 미도입.
- **관측(APM/에러 트래킹) 없음** — `modelTelemetry.ts`는 자체 로컬 계측.

---

## 7. Phase 1 진입 전 결정이 필요한 아키텍처 이슈

1. **프레임워크 유지 vs 이관** — Vite SPA + Express 이중 API를 유지할지, Next.js 통합으로 갈지. IMPLEMENTATION_PLAN.md는 후자를 전제.
2. **DB 유지 vs 이관** — Firestore ↔ Postgres. 무회원·PII 최소화 원칙과 결합.
3. **LLM 공급자** — Gemini ↔ Anthropic. IMPLEMENTATION_PLAN.md는 Anthropic 전제.
4. **`src/App.tsx` 3,895줄 분해** — Phase 1의 어떤 리팩터링에도 선행 필요.
5. **`server.ts` ↔ `api/*` 이중 구현 통합** — 단일 진실 원천 확립.

위 5건은 `docs/decisions.md`에 기록해 OWNER 결정 후 Phase 1 착수.
