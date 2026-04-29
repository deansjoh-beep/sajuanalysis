# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Korean Saju (사주, Four Pillars of Destiny) analysis web app. React 19 + Vite frontend, a single `server.ts` Express dev server that also owns Firebase Admin + Puppeteer PDF generation, and Vercel serverless functions in `api/` for production. Content is driven by Gemini (`@google/genai`) using large, human-authored prompt "guidelines". Persistence and auth are Firebase (Firestore + Storage + Auth).

## Commands

```bash
npm run dev          # tsx server.ts — Express + Vite middleware on :3000 (dev & "start" both go through server.ts)
npm run build        # vite build → dist/
npm run start        # node server.ts (production-style, same entrypoint)
npm run lint         # tsc --noEmit (type check; there is no ESLint config)
npm run test         # vitest (watch)
npm run test:run     # vitest run (CI)
npm run test:e2e     # playwright test (auto-starts npm run dev via playwright.config.ts)
npm run test:e2e:ui  # playwright UI mode
```

Run a single unit test: `npx vitest run src/utils/saju.test.ts` (or `-t "<name pattern>"`).
Run a single e2e test: `npx playwright test e2e/app.smoke.spec.ts`.

Verification scripts (manse-력 sanity checks): `node scripts/verify-month-pillars-2026.mjs`, `node scripts/verify-year-pillars-range.mjs`.

Node **20.x** is required (`engines` in package.json).

## Environment

- `.env` / `.env.local` are loaded by `server.ts` via dotenv (`.env.local` does not override existing values).
- `GEMINI_API_KEY` — exposed to the browser at build time via `vite.config.ts` `define` as `process.env.GEMINI_API_KEY`, and also served at runtime from `/api/runtime-config`.
- `service-account.json` at repo root enables Firebase Admin (Firestore DB id is hardcoded to `ai-studio-fbfb1881-9f6e-4c3b-9700-cb6640ef2eb9`). Without it, premium-order admin endpoints degrade.
- `FIREBASE_STORAGE_BUCKET`, `PDF_API_TOKEN`, `CHROME_PATH`, `KASI_API_KEY`, `APP_URL` — see server.ts and `.env.example`.
- `DISABLE_HMR=true` disables Vite HMR (used inside AI Studio to stop file-watch flicker during agent edits — see `vite.config.ts`).

## Architecture

### Two runtime shapes for the same API surface

- **Dev/local**: everything runs under `server.ts`. It boots Firebase Admin, mounts Vite in middleware mode, and hosts all `/api/*` routes directly (health, `runtime-config`, `generate-pdf`, premium-order CRUD, premium-report upload/email, taekil engine).
- **Prod (Vercel)**: `vercel.json` points Vite at `dist/` and exposes the functions in `api/` (e.g. `api/generate-pdf.ts`, `api/premium-order/*.ts`, `api/premium-report/*.ts`). `api/lib/firebase-admin-utils.ts` is the shared Admin bootstrap for these.

When adding an endpoint, wire it **both** into `server.ts` (for dev) and as a file under `api/` (for prod). The shapes must match; clients call `/api/...` identically.

### Frontend composition

- Single-page React 19 app. `src/App.tsx` (~3.9k LOC) is the top-level shell: it owns the tab router (`welcome | dashboard | chat | report | guide | blog | premium`), dark mode, Firebase wiring, and admin-route detection (`/admin`, `#admin`, or `?admin=true` — see `isAdminRoute()`).
- Per-tab state + actions are split into **hooks** (`src/hooks/useXxxTabState.ts` + `useXxxTabActions.ts`) and rendered through thin **tab components** (`src/components/tabs/*`). When adding features to a tab, extend the matching state/actions pair rather than stuffing logic into App.tsx.
- `src/lib/` holds non-UI services: `premiumOrderStore.ts`, `generatePremiumReport.ts`, `sendPremiumReportEmail.ts`, `modelTelemetry.ts` / `modelCooldown.ts` / `modelUtils.ts` (Gemini retry + error classification), `promptBuilders.ts`, `seoulDateGanji.ts`.
- Vite chunking is hand-tuned in `vite.config.ts` (`getManualChunk`): firebase, jspdf, recharts+d3, simplemde/codemirror, react-markdown/rehype/remark, i18next, lunar-javascript/luxon/tz-lookup ("saju-vendor"), framer-motion, lucide, react-dom. Preserve these groupings when introducing heavy deps.

### Saju / manse-력 engine

The fortune logic is the conceptual core and must stay internally consistent with the two design docs:
- **`MANSE_DATA_PIPELINE.md`** — user input → Luxon local time → true-solar-time correction → Korean historical time offsets → lunar-javascript → four pillars + 지장간, 십성, 십이운성, 신살, 공망, etc.
- **`MANSE_DAEUN_PIPELINE.md`** — 대운/세운 direction, 대운수 (days-to-solar-term ÷ 3), and how 십이운성 applies to each decade.

Implementation lives in `src/utils/saju.ts` (`getSajuData`, `getDaeunData`, `calculateYongshin`, `calculateDeity`, `calculateGyeok`, `getSipseung`, `getShinsal`, `getGongmang`, etc.) and `src/utils/sajuAlgorithm.ts`. `src/utils/taekilEngine.ts` implements 택일 (date selection), called from both the frontend and `server.ts`.

When editing these modules, keep `src/utils/saju.test.ts` passing and check behavior against the pipeline docs — constants (지장간 tables, 십이운성 조견표, 신살 규칙, 시간대 보정) are load-bearing.

### AI "guidelines" system

`src/constants/guidelines/` contains the prompts that steer Gemini output. Each file is a distinct persona/mode:

| File | Purpose |
|---|---|
| `saju.ts` | 간명 해석 기본 규칙 (SAJU_GUIDELINE) |
| `consulting-common.ts` / `-basic.ts` / `-advanced.ts` | Chat tab prompt tiers |
| `report-common.ts` / `-basic.ts` / `-advanced.ts` | Report tab prompt tiers |
| `yearly-fortune-2026.ts` | 2026 일년운세 premium report |
| `index.ts` | barrel — re-export only; never author content here |

These are treated as product content, not code comments. Edits to tone, section order, section markers, or file-name conventions are feature changes — see recent commits (e.g. `feat(saju-guideline): ...`, `feat(yearly-fortune): ...`) for the style. Accompanying spec tests: `src/constants/guidelines.test.ts`.

### Admin / premium order flow

`isAdminRoute()` swaps the shell for `AdminPage`. Admin can manage premium orders (Firestore `premiumOrders`) and generate the long-form PDF report via `api/generate-pdf.ts` (Puppeteer with `@sparticuz/chromium-min` on Vercel, local Chrome path fallback in dev). Reports are uploaded to Storage (`api/premium-report/upload.ts` / `upload-url.ts`) and emailed (`sendPremiumReportEmail.ts`, Resend). Firestore security is in `firestore.rules`; the Firestore **database id** is non-default — always pass `'ai-studio-fbfb1881-9f6e-4c3b-9700-cb6640ef2eb9'` when building new admin queries.

### Security layer

**HTTP headers** — `vercel.json` applies these globally via `"source": "/(.*)"`:
- `Strict-Transport-Security` (max-age=31536000, includeSubDomains, preload)
- `Content-Security-Policy` — allowlist-based; covers Gemini, Firebase, GA4, AdSense, Google Fonts, Naver/Pretendard fonts, YouTube embeds. Update the CSP when adding new external origins.
- `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'` (double-coverage for click-jacking)
- `X-Content-Type-Options`, `Referrer-Policy`

**Redirects** — `vercel.json` `redirects` (processed before the SPA catch-all rewrite) return 302 for:
- `*.map` files — source map exposure prevention
- `*.zip|bak|tar|gz|sql|dump|env|log|old|orig|backup|swp|db` — backup file scan protection

**Rate limiting** — `api/lib/rate-limit.ts` exports a `createRateLimiter(config)` factory plus pre-configured per-endpoint limiters (`pdfLimiter`, `emailLimiter`, `uploadLimiter`, `orderCreateLimiter`, `taekilLimiter`, `generalLimiter`). Two adapter helpers:
- `expressRateLimit(limiter, skipFn?)` — Express middleware (used in `server.ts`)
- `checkVercelRateLimit(req, res, limiter)` — returns `false` and sends 429 when exceeded (used in Vercel function handlers)

All responses include RFC 9440 `RateLimit-*` headers. The store is a module-level `Map`; if Vercel cold-start isolation becomes a problem at scale, swap the store for `@upstash/ratelimit` + `@upstash/redis`.

When adding a new API endpoint, apply the appropriate limiter in **both** `server.ts` (Express middleware) and the corresponding `api/*.ts` handler (checkVercelRateLimit call).

**Public scripts** — `public/ga-init.js` (GA4 init) and `public/process-polyfill.js` (`window.process` shim) are loaded via `<script src="...">` in `index.html`. They exist because the CSP disallows `unsafe-inline` for scripts. Do not move them back inline.

**Build** — `vite.config.ts` sets `build.sourcemap: false` explicitly. Do not enable source maps for production builds.

## Design principles (못박힌 원칙 — 어기지 말 것)

이 사이트는 **최대한 단순한 디자인**을 원칙으로 한다. 새 컴포넌트를 만들거나 기존 페이지를 고칠 때 반드시 다음을 지킬 것:

- **텍스트 크기는 두 단계만 사용한다.** 본문(설명) `text-[14px]` (모바일 13px 허용) + 보조(라벨·캡션·배지·메타 정보) `text-[12px]`. 이 사이의 13.5px 같은 중간 단계, 11px 같은 더 작은 단계 신설 금지. 제목(`font-serif text-[18px]~text-[40px]`)과 버튼(`text-[13px]`/`text-[14px]`)은 별도 — 위 두 단계 규칙에서 제외.
- **장식적 요소를 더하지 않는다.** 섹션 헤더에 아이콘 박스, "분석 결론" 같은 메타 라벨, 골드 영문 캡션("MANSERYEOK", "Manseryeok")을 새로 추가하지 말 것. 의미가 텍스트로 충분히 전달되면 시각 장식은 제거.
- **일반 이론 vs 사용자 적용은 분리한다.** 한 카드/단락에 "이건 이런 개념입니다 + 당신의 경우 …"를 섞지 말고, 일반 설명 단락과 사용자 분석 단락을 별도 블록으로 둔다. "당신의 경우" 같은 라벨로 강조하지도 말 것 — 두 블록은 단순 단락 분리로 충분.
- **컨트롤은 한 곳에 모은다.** 페이지 단위 토글(예: 초급자/고급자)은 페이지 헤더 우측 상단 한 곳. 가운데 정렬한 큰 토글, 카드 사이 곳곳에 흩어진 미니 토글 금지.
- **단순화를 깨야 할 때는 명시적 사용자 요청이 있을 때만.** "더 풍부하게" 같은 자체 판단으로 장식을 다시 늘리지 말 것.

이 원칙은 만세력(`ManseTab`)·랜딩(`WelcomeTab`)·리포트(`ReportTabContent`)에 적용되었으며, 다른 탭으로 한지 톤을 확장할 때도 동일하게 적용한다.

## Conventions worth knowing

- **Language**: UI + content are Korean; commit messages use Korean Conventional Commits (e.g. `feat(yearly-fortune): ...`). Match this style.
- **i18n**: `src/i18n.ts` + `src/locales/{ko,en}.json` (react-i18next). Korean is primary.
- **Styling**: Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js`). Reusable class strings live in `src/constants/styles.ts` (`GLASS_PANEL_CLASS`, `TAEKIL_FIELD_CLASS`, etc.) — prefer extending those over hand-rolling glass/panel styles.
- **Path alias**: `@/*` → repo root (`tsconfig.json` + `vite.config.ts`). App code mostly uses relative imports; use `@/` for cross-tree imports.
- **Lazy loading**: `FiveElementsPieChart` and `BlogTab` are `React.lazy`'d in `App.tsx`. Keep heavy, tab-gated components lazy.
- **No ESLint**: `npm run lint` is `tsc --noEmit`. There is no formatter config either — match surrounding style.
- **Tests**: Vitest uses `src/**` and excludes `e2e/`. Playwright tests live in `e2e/` and are configured to reuse an existing dev server locally.
