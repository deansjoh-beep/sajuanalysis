# Phase 1-3 계획 — SajuAnalysis를 기존 리포트 파이프라인에 연결

> 재정의: IMPLEMENTATION_PLAN.md 1-3의 전제("lib/report를 새로 만든다")는 origin/main과 맞지 않음.
> origin/main엔 리포트 시스템이 이미 존재하고, 우리 `buildSajuAnalysis`(Phase 1-2 산출)는 **소비처가 0**이다.
> → 1-3의 실제 작업 = **"새 SajuAnalysis를 기존 리포트 파이프라인에 연결"**.
> 조사일: 2026-07-04. 정본 브랜치 `phase-1-rebased`(PR #1 머지 대기).

---

## 1. 조사 결과 — 기존 파이프라인 지도

리포트/컨텍스트 생성 지점은 3곳(+채팅 1곳)이며, **전부 LLM에 평문 문자열을 수동 조립해 먹인다.**

| # | 진입점 | 호출처 | LLM | 컨텍스트 조립 |
|---|--------|--------|-----|--------------|
| 1 | `generateLifeNavReport` (`src/lib/generatePremiumReport.ts:584`) | 관리자 패널 `PremiumReportInputPanel.tsx:206` | **Gemini 전용** (2.5-pro→flash→2.0→1.5 폴백) | `getSajuData`+`getDaeunData`+`calculateYongshin`+요약헬퍼로 `sajuContext`/`daeunContext`/`yongshinContext`/`hapchung`/`shinsal`/`sipseung` 문자열. 4개 상품(인생네비/일년운세2026/직업/연애)별 promptBuilder. 품질평가+1회 보정 루프 있음 |
| 2 | `useReportGenerationAction` (`src/hooks/useReportGenerationAction.ts`) | 사용자 대면 Report 탭 | Gemini 우선 + **Claude 폴백** | App 상태의 **이미 계산된** `sajuResult`/`daeunResult`/`yongshinResult`/`gyeokResult`에서 자체 인라인 조립(1번과 포맷 상이한 중복). `buildReportSystemInstruction`(6대 카테고리) |
| 3 | `generatePremiumReport` (`src/lib/generatePremiumReport.ts:69`) | **호출처 없음 (dead export)** | Gemini 2.5-flash | 레거시 단순 버전. 정리 대상(별건) |
| 참고 | `buildConsultingSystemInstruction` | 채팅 `useChatSendAction` | Gemini+Claude | 동일 `sajuContext`/`daeunContext` 문자열 관례 (1-3 범위 밖) |

**핵심 격차**
- 모든 소비처가 LLM에 평문 텍스트를 먹인다. 포맷 제각각 + saju/daeun 컨텍스트 조립 로직이 최소 3곳 중복.
- `buildSajuAnalysis`(타입화된 결정론 JSON)는 프로덕션 소비처 0 (테스트만).
- `gyeokYongshin`은 SajuAnalysis 안에서 provisional. 기존 파이프라인은 `calculateYongshin` 레거시 어댑터 사용.

---

## 2. 이번 범위 (OWNER 확정 2026-07-04)

- **범위: 관리자 프리미엄(`generateLifeNavReport`)만 먼저 연결.** 자체 입력에서 recompute하는 자기완결형이라 가장 안전. 검증 후 Report 탭·채팅으로 확장.
- **이번 세션: 계획 확정까지.** 코드 구현은 PR #1 머지 + OWNER 입력(골든셋/금칙어) 이후.

---

## 3. 설계 — 직렬화 어댑터 삽입

`buildSajuAnalysis` → 프롬프트 빌더가 이미 기대하는 문자열 형태(`{ sajuContext, daeunContext, yongshinContext, hapchungContext, shinsalContext, sipseungContext }`)로 변환하는 **`sajuAnalysisToPromptContext(analysis)`** 를 한 곳에 만든다. 그러면 promptBuilders·guidelines·PDF·이메일은 **전부 무변경**(문자열 계약만 맞추면 됨).

### ⚠️ 설계 관건 — 어댑터가 재현해야 할 레거시 문자열에 SajuAnalysis에 없는 요소가 섞여 있다

`generateLifeNavReport`가 조립하는 `sajuContext`(줄 611–617 + 672 등)에는 SajuAnalysis가 **직접 담지 않는** 두 부류가 있음:
1. **영문 십성 설명** — `getDeityEnglishExplanation(deity)` 결과를 각 간지 뒤 괄호로 첨부. (SajuAnalysis는 한글 `sipsin`만 보유)
2. **요약 헬퍼 특정 문구** — 호출부에서 `[합충형파해]\n${getHapChungSummary}` · `[십이신살]\n${getShinsalSummary}` · `[십이운성]\n${getOriginalSipseungSummary}`를 이어붙임. SajuAnalysis는 구조화된 `hapChungEvents`/`shinsal`/`myeongsik[].branch.sibiUnseong`(=원자료)을 갖지만, 이 요약 헬퍼들의 **정확한 문구**(예: `${title}간·${title}간 ${result}`, `${title}(${name})`)와는 다름.

또한 `yongshinContext`는 `calculateYongshin`의 레거시 필드(`strength`/`johooStatus`/`yongshin`/`eokbuYongshin`/`logicBasis`)로 조립되는데, SajuAnalysis의 `gyeokYongshin`은 동일 분석기(`analyzeGyeokYongshin`)에서 나오지만 **Ko 포맷 어댑터 필드**(gyeokyongshin.ts:295–303)를 갖는다.

### 두 가지 어댑터 옵션

- **옵션 A — 바이트 동일(하이브리드):** 어댑터가 `SajuAnalysis` + 원본 `saju` 배열을 함께 받아, 구조화 필드는 SajuAnalysis에서 뽑되 영문 십성·요약 헬퍼 문구는 **기존 saju.ts 헬퍼를 계속 호출**해 재현. LLM 입력 텍스트 변화 0(최저 위험). 단 SajuAnalysis가 *단일* 소스는 아님(saju 배열·헬퍼에 여전히 의존).
- **옵션 B — SajuAnalysis 단독(등가):** 어댑터가 SajuAnalysis만으로 전부 파생(요약 문구를 `hapChungEvents`/`shinsal`/`sibiUnseong`에서 재구성, 영문 십성은 스키마에 추가하거나 폐기). SajuAnalysis가 **진짜 단일 소스**가 됨(=1-3의 본래 목표). 단 LLM 입력 텍스트가 미세하게 바뀌어 **출력 회귀 검토 필요**.

**권장: 옵션 B(단일 소스)를 목표로 하되, 컨텍스트 diff 하네스를 안전망으로 병행.**
- N개 픽스처에 대해 (기존 조립 문자열) vs (어댑터 출력) 스냅샷을 떠서 diff를 사람이 검토 → 변화가 *의도적·경계 내*임을 증명. 이 diff 하네스는 **배관 정확성**을 담보하며, OWNER 골든셋(=**출력 품질** 검증)과 역할이 다름.
- 영문 십성 설명은 스키마에 `sipsinEn`을 추가하거나(권장), 프리미엄 프롬프트에서 실효가 낮으면 폐기 결정을 별도 기록.

---

## 4. 실행 순서 (구현 착수 시)

1. **PR #1 머지 대기** → 머지 후 `git checkout main && git pull`. 아직이면 `phase-1-rebased`에서 진행.
2. **컨텍스트 diff 하네스** 먼저 작성 — 현재 `generateLifeNavReport`의 내부 컨텍스트 조립부를 순수 함수로 추출(리팩터 무변경) → 픽스처별 스냅샷 확보(기준선).
3. **`sajuAnalysisToPromptContext(analysis)` 어댑터** 작성 (`src/lib/analysis/` 하위). 옵션 B로 문자열 파생. 단위 테스트 = 기준선 스냅샷과의 diff 검토.
4. **`generateLifeNavReport` 교체** — 내부 `getSajuData`/`getDaeunData`/`calculateYongshin`+헬퍼 조립을 `buildSajuAnalysis` + 어댑터 호출로 치환. promptBuilders 시그니처 무변경.
5. **회귀 검증** — vitest 그린 유지, diff 하네스 검토 승인, (가능하면) 관리자 패널 E2E 스모크.
6. 검증 후 별건으로 Report 탭(#2)·채팅 확장. dead export(#3) 정리.

## 5. 블로커 / 의존

- **비블로킹(배관):** 위 1–5는 골든셋/금칙어 없이 진행 가능. diff 하네스가 배관 회귀를 잡음.
- **블로커(품질 파트, OWNER):**
  - **골든셋 간명**(대표 모범 리포트) → few-shot 주입 (D-2-4). 없으면 임시예시로 프레임까지만.
  - **금칙어 목록**(사망·이혼·파산 등 단정 표현) → validate 검증기용.
- **D-1-6**(격국·용신 정식 유파, Phase 3) — provisional 유지, 1-3 비블로킹.

## 6. 결정 필요 항목 (구현 착수 전 확인)

- [ ] 어댑터 옵션 A vs B (권장 B).
- [ ] 영문 십성 설명: 스키마 `sipsinEn` 추가 vs 프리미엄 프롬프트에서 폐기.
- [ ] `gyeokYongshin` provisional을 프리미엄 `yongshinContext`에 어떻게 노출할지(레거시 `calculateYongshin` 유지 vs SajuAnalysis.gyeokYongshin 매핑 — 후자는 provisional 경고 병기).
