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

## Conventions worth knowing

- **Language**: UI + content are Korean; commit messages use Korean Conventional Commits (e.g. `feat(yearly-fortune): ...`). Match this style.
- **i18n**: `src/i18n.ts` + `src/locales/{ko,en}.json` (react-i18next). Korean is primary.
- **Styling**: Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js`). Reusable class strings live in `src/constants/styles.ts` (`GLASS_PANEL_CLASS`, `TAEKIL_FIELD_CLASS`, etc.) — prefer extending those over hand-rolling glass/panel styles.
- **Path alias**: `@/*` → repo root (`tsconfig.json` + `vite.config.ts`). App code mostly uses relative imports; use `@/` for cross-tree imports.
- **Lazy loading**: `FiveElementsPieChart` and `BlogTab` are `React.lazy`'d in `App.tsx`. Keep heavy, tab-gated components lazy.
- **No ESLint**: `npm run lint` is `tsc --noEmit`. There is no formatter config either — match surrounding style.
- **Tests**: Vitest uses `src/**` and excludes `e2e/`. Playwright tests live in `e2e/` and are configured to reuse an existing dev server locally.
