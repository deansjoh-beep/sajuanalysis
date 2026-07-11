# 상담 탭 챗봇 개편 기획안 (Chat Consult Revamp)

작성일: 2026-07-11 · 상태: 초안(OWNER 검토 대기)

## 0. 한 줄 요약

자유타이핑 LLM 상담을 **"만세력 엔진 데이터가 주도하는 시나리오형 챗봇"**으로 개편한다.
엔진이 계산한 결정론적 데이터(명식·대운·세운·용신·신살)를 대화의 뼈대로 삼고,
LLM은 그 데이터의 **해석·화법**만 담당한다. 계산은 엔진, 말은 LLM.

---

## 1. 현재 상태 진단 (as-is)

| 항목 | 현재 구현 | 문제 |
|---|---|---|
| 대화 구조 | 자유 텍스트 입력 + 추천 질문 버튼 (`useChatSendAction.ts`) | 초보 사용자는 뭘 물어야 할지 모름. 대화가 발산 |
| 데이터 주입 | `sajuContext`/`daeunContext`를 **사전 직렬화한 문자열**로 시스템 프롬프트에 삽입 (`useChatSendAction.ts:183-216`) | LLM이 문자열을 재해석하다 간지·수치를 틀릴 여지. 근거 추적 불가 |
| 응답 형태 | 순수 텍스트 (`ChatMessage = {role, text}`, `useChatTabState.ts:3-6`) | 명식·대운 같은 표 데이터도 산문으로 풀어 씀 → 길고 검증 불가 |
| 모드 | basic/advanced = **화법 토글**일 뿐 (`consulting-basic/advanced.ts`) | 가격·기능 티어와 무관 |
| 게이팅 | 없음 — 로그인·횟수 제한·결제 연동 전무 | 무제한 무료 → Gemini 비용 통제 불가, 유료 전환 동선 없음 |
| followup 3회 | DB(`db/code.ts:consumeFollowup`)·API(`POST /api/code/followup`)·표시(`CodeLookupTab.tsx:591`)까지만 존재 | **챗과 미배선** — 구매자 혜택이 실체 없음 |
| 스트리밍 | 없음 (단발 `generateContent`) | 긴 답변 체감 대기 큼 |

핵심 판단: "챗봇으로 개편"은 UI 스킨 교체가 아니라 **대화의 주도권을 사용자 자유입력 → 엔진 데이터 기반 시나리오로 옮기는 것**이다.

---

## 2. 목표 (to-be)

1. **데이터 그라운딩**: 챗봇이 말하는 모든 간지·십성·대운수·연도는 엔진 출력값 그대로. LLM 자체 계산 0건.
2. **시나리오 주도 대화**: 주제 버튼 → 엔진이 해당 주제 데이터 슬라이스 추출 → 카드(결정론적) + 해석(LLM) + 다음 선택지 제시. 자유입력은 보조 수단으로 유지.
3. **수익 동선 내장**: 무료 사용자에게 턴 제한 + 유료 리포트 CTA, 코드 보유자에게 followup 3회 실배선.
4. **디자인 원칙 준수**: CLAUDE.md 못박힌 원칙(텍스트 2단계, 장식 금지, 이론/적용 분리) 그대로 적용.

비목표(이번 개편에서 안 함): 실시간 상담사 매칭, 멀티모달(이미지), 챗 이력 서버 저장(개인정보 파기 원칙 유지).

---

## 3. 대화 구조 설계

### 3.1 상태 기계 (Conversation Flow)

```
[진입]
  └─ 사주 없음 → welcome 유도 (현행 유지)
  └─ 사주 있음 → ① 오프닝

① 오프닝 (봇 선발화)
   - 명식 카드 1장 (4주 간지 + 일간 + 용신) ← 엔진 데이터 그대로, LLM 미개입
   - 일간별 첫마디 (consulting-common.ts의 기존 10종 재사용)
   - 주제 선택지 버튼 제시

② 주제 선택 (버튼 or 자유입력 → 인텐트 분류)
   재물/사업 · 직업/이직 · 연애/결혼 · 건강 · 대인관계 ·
   올해 운세 · 이달 운세 · 오늘 운세 · 대운 흐름 · 자유 질문

③ 주제별 시나리오 (핵심)
   a. 데이터 셀렉터: 주제에 해당하는 엔진 출력만 슬라이스
   b. 카드 렌더: 근거 데이터를 카드 메시지로 먼저 표시 (결정론적)
   c. LLM 해석: 슬라이스된 구조화 데이터 + 주제 전용 지침 → 4~6문장 해석
   d. 후속 선택지: 같은 주제 심화 2개 + 다른 주제 1개 + "직접 질문하기"

④ 심화/반복: ③으로 재진입 or 자유 질문 (advanced 화법)

⑤ 턴 소진 (무료) → 게이트 메시지: 유료 리포트 CTA / 코드 입력 유도
```

### 3.2 주제 → 엔진 데이터 매핑 (데이터 셀렉터 명세)

| 주제 | 엔진 소스 (기존 함수) | 카드에 싣는 결정론적 데이터 |
|---|---|---|
| 재물/사업 | `getSajuData` 십성(정재·편재·식신·상관), `calculateYongshin` | 재성 위치·강약, 용신과 재성 관계 |
| 직업/이직 | 십성(관성·인성), `calculateGyeok`, stem/branch `careers` | 격국, 관성 배치, 직업 키워드 |
| 연애/결혼 | 십성(관성/재성 — 성별 분기), `getShinsal`(도화·홍염 등), 배우자궁(일지) | 일지 간지+지장간, 관련 신살 |
| 건강 | 오행 분포, 조후용신(`johooYongshin`) | 오행 과부족 표, 조후 |
| 올해/이달/오늘 | `nearbyYearPillars`/월운/`nearbyDayPillars` + `seoulDateGanji` | 해당 기간 간지·십성·십이운성 |
| 대운 흐름 | `getDaeunData` + `getSipseung` | 현재 대운 카드 + 전후 대운 타임라인 |
| 자유 질문 | 전체 컨텍스트 (현행 방식) | 카드 없음, 텍스트만 |

이 매핑 테이블 자체를 `src/constants/chatScenarios.ts`(신규)로 코드화한다 — 주제 추가가 데이터 셀렉터+지침+선택지 한 세트 추가로 끝나도록.

### 3.3 메시지 타입 확장

```ts
// useChatTabState.ts 확장
type ChatMessage =
  | { role: 'user' | 'model'; type: 'text'; text: string }
  | { role: 'model'; type: 'card'; card: SajuCardPayload }      // 명식/대운/오행 카드
  | { role: 'model'; type: 'options'; options: ChatOption[] }   // 선택지 버튼 묶음
  | { role: 'model'; type: 'gate'; gate: GatePayload }          // 턴 소진/결제 유도
```

- 카드는 **React 컴포넌트가 엔진 값을 직접 렌더** — LLM 출력을 파싱해 만들지 않는다(환각 원천 차단).
- LLM 히스토리(`contents`)에는 카드를 요약 문자열로 변환해 넣는다(모델이 자기가 보여준 데이터를 알도록).
- 기존 `preservedChatContextRef` 맥락 유지 로직은 text 타입만 보존 대상으로 유지.

### 3.4 데이터 그라운딩 강화

현행 문자열 직렬화 대신:

1. `buildConsultingSystemInstruction`의 `[사용자 사주 정보]` 블록을 **구조화 JSON**으로 교체 (필드명 고정 → 모델이 참조 실수할 여지 축소).
2. 주제 시나리오에서는 전체 컨텍스트가 아니라 **슬라이스만** 주입 → 토큰 절감 + 집중도 상승.
3. 지침에 검증 규칙 명문화: "간지·연도·수치는 [데이터] 블록에 있는 값만 인용. 블록에 없는 값 요구 시 '자료에 없다'고 답하라." (기존 세운·일진 고정 규칙의 일반화)
4. 해석문 내 간지 언급은 후처리 검증(선택): 응답에서 간지 패턴 추출 → 엔진 값 대조 → 불일치 시 재생성 1회. Phase 3-1 규칙 엔진(명리 기준서 v1.5)의 검증 자산 재사용 검토.

---

## 4. 무료/유료 설계

| 구간 | 정책 |
|---|---|
| 무료 (코드 없음) | 시나리오 턴 **5회/일** (localStorage 카운트, 서버 강제는 후속). 소진 시 gate 메시지: "정밀 리포트 9,900/4,900원" CTA + "이미 코드가 있다면 입력" |
| 코드 보유자 | 코드 입력 → `lookupCode`로 검증 → 주문별 `followupRemaining` 표시 → **자유 질문 1건 = followup 1회 차감** (`POST /api/code/followup` 실배선). 시나리오 버튼 턴은 차감 없이 무료 한도와 별개로 넉넉히(예: 20회/일) |
| 재구매 유도 | followup 소진 시 재구매 30% 문구(랜딩 정책과 동일) 노출 |

- 무료 한도 수치·차감 단위(시나리오 턴은 무료로 둘지)는 **OWNER 확정 필요** → `docs/decisions.md`에 항목 추가.
- 챗은 여전히 비로그인 — 코드가 곧 자격(기존 설계 철학 유지). 개인정보 파기 안내 문구 유지.

---

## 5. 기술 설계 (구현 스케치)

### 5.1 신규/변경 파일

| 파일 | 역할 |
|---|---|
| `src/constants/chatScenarios.ts` (신규) | 주제 정의: `{id, label, dataSelector, guideline, followups}` 배열 |
| `src/constants/guidelines/consulting-scenario.ts` (신규) | 시나리오 응답 전용 지침(4~6문장, 카드 데이터 재나열 금지, 이론/적용 분리). 배럴 `index.ts`에 재수출 |
| `src/lib/chatDataSelectors.ts` (신규) | 주제별 엔진 데이터 슬라이스 + 카드 payload 생성 (순수 함수 — vitest 대상) |
| `src/hooks/useChatTabState.ts` | `ChatMessage` 판별 유니언 확장, `scenarioTurnCount`, `activeCode` 상태 추가 |
| `src/hooks/useChatSendAction.ts` | `handleScenarioSelect(topicId)` 추가, 기존 `handleSend`는 자유 질문 경로로 유지 |
| `src/components/chat/SajuCard.tsx` 등 (신규) | 카드 3종(명식/대운 타임라인/오행 분포) + 선택지 버튼 + gate. `GLASS_PANEL_CLASS` 재사용, 본문 14px/보조 12px |
| `src/App.tsx` L1286-1581 | 챗 UI 렌더를 메시지 type 분기로 교체. **이번 기회에 `ChatTabContent` 컴포넌트로 추출** (App.tsx 3.9k LOC 감량 — Phase 0 감사 지적사항 일부 해소) |

### 5.2 서버/API

- 신규 함수 파일 **불가** (Vercel Hobby 12개 캡). followup 차감은 기존 `api/code.ts` `POST /api/code/followup` 그대로 사용 — 프론트 배선만 추가.
- 무료 턴 서버 강제가 필요해지면 기존 `generalLimiter` 계열(`api/_lib/rate-limit.ts`)로 흡수.

### 5.3 유지되는 것

- Gemini 모델 폴백 체인 + Claude 텍스트 폴백, 텔레메트리/쿨다운 — 그대로.
- 제3자 사주 tool use(`calculateSajuForPerson`) — 자유 질문 경로에서 유지.
- 음성 입력, 관계 호칭 후처리(`enforceRelationshipLabel`) — 유지.
- basic/advanced 화법 토글 — 유지하되, 시나리오 해석문에도 동일 적용.

### 5.4 스트리밍 (선택, Phase D)

시나리오 응답이 4~6문장으로 짧아지므로 스트리밍 우선순위는 하락. 자유 질문(장문) 경로에만 `generateContentStream` 도입 검토.

---

## 6. 단계별 로드맵

| Phase | 내용 | 완료 기준(DoD) |
|---|---|---|
| **A. 메시지 타입 + 시나리오 골격** | ChatMessage 유니언 확장, chatScenarios 3종(올해운·재물·대운)만 우선, 선택지 버튼 흐름, ChatTabContent 추출 | 버튼 3회 왕복 대화가 엔진 값 그대로 카드에 표시. vitest: dataSelector 스냅샷 |
| **B. 전 주제 + 그라운딩 강화** | 10개 주제 전부, JSON 컨텍스트 교체, 시나리오 지침 파일, 카드 3종 완성 | 주제별 카드 값 = 엔진 값 일치 테스트. guidelines.test.ts 스펙 추가 |
| **C. 게이팅 + followup 배선** | 무료 5회/일, gate 메시지, 코드 입력 → followup 차감, 재구매 CTA | E2E: 무료 소진→gate, 코드 입력→차감→`remaining` 감소 확인 |
| **D. 다듬기** | 자유질문 스트리밍, 간지 후처리 검증, AI 추천 질문을 시나리오 selector 기반으로 교체 | 성능·오답률 지표 측정 |

A→B→C 순차, 각 Phase 별도 브랜치+PR. C는 OWNER 가격/한도 확정에 의존하므로 A·B와 병렬로 결정 대기 가능.

---

## 7. 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| 시나리오화로 대화가 딱딱해짐 | 모든 턴에 "직접 질문하기" 상시 노출 — 자유입력을 막지 않음 |
| 무료 턴 localStorage 우회 | 초기엔 감수(비용 상한은 rate-limit이 방어), 남용 감지 시 서버 카운트 승격 |
| followup 차감 UX 반발 | 차감 전 확인 문구 + 남은 횟수 상시 표시 (429 시 기존 `FOLLOWUP_EXHAUSTED` 문구 재사용) |
| 카드/선택지 도입이 디자인 원칙 위반으로 흐를 위험 | 카드=데이터 표만, 아이콘 박스·영문 캡션 금지. 선택지 버튼은 13px 버튼 규격 |
| Gemini 비용 | 슬라이스 컨텍스트로 턴당 토큰 대폭 절감(전체 컨텍스트 대비) — B에서 계측 |

## 8. 측정 지표

- 시나리오 버튼 사용률 vs 자유입력 비율 (GA4 이벤트)
- 챗 → order 탭 전환율 (gate 노출 대비 클릭)
- followup 소진율, 소진 후 재구매율
- 턴당 평균 토큰/비용 (기존 `modelTelemetry` 확장)

## 9. OWNER 결정 필요 항목

1. 무료 시나리오 턴 한도 (제안: 5회/일) 및 자유 질문의 무료 허용 여부
2. followup 차감 단위 — 자유 질문만 차감(제안) vs 모든 턴 차감
3. gate 문구·재구매 30% 노출 여부
4. 주제 10종 라인업 확정 (3.2 표 기준)
