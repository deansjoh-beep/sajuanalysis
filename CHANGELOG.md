# Changelog

All notable changes to this project will be documented in this file.

## 2026-03-31

### Changed / Fixed
- **Puppeteer 서버사이드 PDF 마이그레이션** — html2canvas + jsPDF 방식을 Vercel Serverless Function 방식으로 전면 교체 (oklab 크래시 근본 해결)
  - `api/generate-pdf.ts` 신규 생성: Puppeteer(headless Chrome) 기반 A4 PDF 생성 엔드포인트
    - CORS 화이트리스트, `X-PDF-Token` 인증, 4MB 입력 제한, 폰트 CDN 이외 외부 요청 차단(SSRF 방지)
    - Vercel 환경: `@sparticuz/chromium-min`, 로컬: 시스템 Chrome 자동 탐지
  - `PremiumReportPreview.tsx`: jsPDF/html2canvas import 제거, handlePdf → API 호출 방식으로 교체
    - adoptedStyleSheets CSS + 폰트 링크 직렬화 → 자급자족 HTML POST → PDF Blob 수신 → 다운로드 + Firebase 업로드
    - oklab 패치 코드(sanitizeOklabDecls, patchStyleSheets, applyColorPatch 등) 완전 삭제
  - `tsconfig.json`: types에 `vite/client` 추가 → `import.meta.env` 타입 오류 해소
  - 필요 환경변수: Vercel `PDF_API_TOKEN`, 로컬 `VITE_PDF_API_TOKEN`, 옵션 `CHROMIUM_BINARY_URL` / `CHROME_PATH`

## 2026-04-07

### Fixed
- **프리미엄 리포트 PDF 섹션 구조 통일** — 대운 섹션 카드 프레임 누락 및 섹션 구분선 누락 수정
  - `PremiumReportPreview.tsx`: `allDisplaySections.map`에서 `daeun` 예외 처리 제거 → 모든 섹션 동일하게 `data-pdf-block={section.id}` 적용
  - `DaeunSection` 내부 `data-pdf-block="daeun-header"`, `data-pdf-block="daeun-block-{i}"` 속성 제거 → 대운 섹션 전체를 하나의 캡처 단위로 통일
  - `sectionNumber` props 제거 → 부모 `allDisplaySections.map`에서 `SectionTitle` 렌더링 (`daeun` 포함)
  - 섹션 구분선(`separator`) div에 `data-pdf-block="separator"` 추가 → PDF에 구분선 포함
  - 결과: PDF 대운 섹션에 카드 프레임(`rounded-2xl border bg-[#fffdf5]/70`)·제목·번호 정상 출력, 섹션 간 구분선 출력, htmlToImage 호출 횟수 12~15회 감소

## 2026-04-06 (2)

### Fixed
- **프리미엄 리포트 대운 연도 시스템 만세력 기준으로 고정** — AI가 대운 연도를 자체 계산하던 문제 해결
  - `generatePremiumReport.ts`: `daeunContext`/`daeunText`에 `startYear~endYear` 캘린더 연도 직접 포함
  - `d.stem.hangul` 잘못된 프로퍼티 접근 버그 수정 → `hanjaToHangul` 변환으로 대체
  - `hanjaToHangul` import 추가
  - `promptBuilders.ts`: `buildLifeNavReportPrompt` 시스템 지시에 "대운 캘린더 연도 고정 규칙" 추가 (AI 자체 계산 금지)
  - `[DAEUN_START]` 출력 포맷에 `{시작연도}~{종료연도}년` 명시

## 2026-04-06

### Added
- **프리미엄 리포트 생성 시스템 전면 개편** — 관리자 전용 사주 인생네비게이션 리포트 제작 도구
  - `PremiumReportInputPanel.tsx` (신규): 고객정보 입력 폼 4개 섹션 상시 표시 (아코디언 제거)
    - 고객 기본정보 / 고객 궁금사항·관심사 / 인생이벤트 / 관리자 설정
  - `PremiumReportMakerPage.tsx` (신규): 인증 가드 + step machine (`input` → `preview`)
  - `PremiumReportPreview.tsx` (신규): 화선지 A4 미리보기, 섹션 렌더링, PDF 생성
- **분석 레벨 3단계**: 초급 / 고급 / 초급+고급 병행
  - 병행 모드: 고급 분석 아래 `[EASY_START]...[EASY_END]` 블록 → 스카이블루 💡 쉬운 설명 박스로 렌더링
- **생성 버튼 sticky 하단 바 고정**: 웹 보고서 생성하기 버튼 항상 노출
- **AI 분석 실시간 타이머**: 예상 남은 시간 카운트다운 + 프로그레스 바
- **생성 중 제어**: 일시정지 / 재개 / 취소 (AbortController) 기능
- `generateLifeNavReport`에 `AbortSignal` 파라미터 지원 추가

### Fixed
- **스크롤 불가 수정**: 전역 `overflow:hidden`에 막힌 리포트 화면 스크롤 복원
  - 모든 페이지 컨테이너 `h-full overflow-y-auto` 패턴으로 통일
  - 섹션 `scroll-margin-top: 52px` (sticky 네비바 가림 방지)
- **PDF 무한루프 제거**: `Math.ceil(imgHeight/pageHeight)` 기반 `totalPages` for 루프로 교체
- **PDF 파일 크기 절감**: PNG → JPEG 95% 압축
- **한글 폰트 깨짐 방지**: `document.fonts.ready` 대기 후 캡처
- **Firebase Storage 파일명**: 한글 안전 처리 (인코딩)
- **printRef div** `position: relative` 추가 (SVG 오버레이 기준점)
- **현재 대운 표시 버그**: `birthYear` (없는 프로퍼티) → `startYear` 기반 연도 비교로 수정
- **CoverPage 레이블**: `'both'` 케이스 `'초급+고급 병행'` 추가
- **불필요한 import 제거**: `calculateGyeok`, `getCareerFocus`
- **VITE_ 접두사 누락 수정**: `.env.local`의 `GEMINI_API_KEY` → `VITE_GEMINI_API_KEY`
- `App.tsx` Suspense fallback `h-screen` → `h-full`

## 2026-04-05 (4)

### Added
- **guidelines 분할**: `src/constants/guidelines.ts` 단일 파일을 `src/constants/guidelines/` 디렉터리 아래 7개 파일로 분할 — `saju.ts`, `consulting-common.ts`, `consulting-basic.ts`, `consulting-advanced.ts`, `report-common.ts`, `report-basic.ts`, `report-advanced.ts`
- **barrel export**: `guidelines/index.ts` + `guidelines.ts` re-export barrel로 기존 import 경로 완전 호환
- **중복 제거**: `BASIC/ADVANCED_REPORT_GUIDELINE`에서 SECTION 1-6 구조·클로징·Role 정의 제거 (공통 지침에만 존재). AI에게 섹션 구조가 한 번만 전달됨
- **월운 절기 기준 규칙**: 상담 공통 지침에 "양력 달 인식 우선" 원칙 추가 — 사용자가 "4월 운세"를 물으면 해당 달을 대표하는 월주(임진) 기준으로 답변
- **상담 입력창 토픽 버튼**: "재물운", "건강운", "인간관계", "연애운" 토글 버튼 추가. 기존 단축 버튼과 멀티 선택 조합 질문 지원 (데스크탑 우측정렬, 모바일 자동 개행)
- **지침 통합 테스트**: `src/constants/guidelines.test.ts` 신규 생성 — barrel export, 핵심 규칙 내용, 중복 제거, 프롬프트 조립, 모드 분기 총 46개 테스트 전원 통과

### Fixed
- `consulting-common.ts` 템플릿 리터럴 바깥에 작성된 줄 구문 오류 수정

## 2026-04-05 (3)

### Refactor
- Extract `parseModelErrorPayload`, `isRetryableModelError`, `isModelSelectionError`, `runWithModelRetry`, `waitMs` into `src/lib/modelUtils.ts` as single source of truth.
- Remove duplicate inline definitions from `App.tsx` (~65 lines removed) and `src/hooks/useChatSendAction.ts` (~45 lines removed).
- `useReportGenerationAction` now imports model utilities directly instead of receiving them as props, simplifying its interface by 3 parameters.

## 2026-04-05 (2)

### Fixed
- Detect `finishReason: MAX_TOKENS` in report generation response and surface a visible warning to the user instead of silently displaying truncated content (`useReportGenerationAction.ts`).

## 2026-04-05

### Fixed
- Increased `maxOutputTokens` from 4096 to 16384 in `useReportGenerationAction.ts` and `generatePremiumReport.ts` to prevent report sections from being cut off mid-way after the `gemini-2.5-flash` model upgrade.
- Normalized heading font sizes inside report sections in `index.css` so h1–h4 no longer render at oversized sizes compared to body text.
- Added explicit output rules in `promptBuilders.ts` forbidding markdown headings (`#`, `##`, etc.) inside `[CONTENT]` blocks to enforce consistent text size across all report sections.

## 2026-03-30

### Added
- Integrated Liquid Glass kit static assets: `public/liquid-glass-kit.css`, `public/liquid-glass-kit.js`.
- Added `playwright` as a development dependency for UI verification.
- Added release note record at `releases/2026-03-30.md`.

### Changed
- Unified major app tabs to the Liquid Glass visual style in `src/App.tsx`.
- Improved mobile spacing and touch-target readability updates across views.
- Updated report/chat typography treatment and added MaruBuri usage in report headings.
- Updated `public/guide.html` to match the integrated kit and revised structure.

### Fixed
- Revised PDF export layout logic in `src/App.tsx` to apply inner capture padding and outer page margins with corrected multi-page placement.
