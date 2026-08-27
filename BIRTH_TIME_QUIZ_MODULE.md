# 생시추정 퀴즈 모듈 (Birth-Time Estimation Quiz)

> 출생 시간을 모르는 사용자가 전통 생시추정법 3문항으로 시지(時支)를 짐작해
> 시간 입력란에 반영할 수 있게 하는 UI 모듈.
>
> 원본 구현: `life-natural-life-cycle` 저장소
> (https://github.com/deansjoh-beep/life-natural-life-cycle, 커밋 `07b59b7` / 30분 단위 대응 `d24a139`)
> — `src/App.tsx`의 `TIME_BRANCHES` 상수와 시간 입력란 하단 퀴즈 패널.

---

## 1. 목적과 배경

사주 분석에서 시주(時柱)는 출생 시간을 모르면 세울 수 없다. 민간에 전승되는
생시추정법 중 **본인이 스스로 답할 수 있고 판별축이 서로 겹치지 않는** 세
가지를 골라 퀴즈로 구성하면, 12지지가 수학적으로 유일하게 결정된다.

| 문항 | 전승 판별법 | 판별축 |
|---|---|---|
| Q1 수면 자세 | 반듯이 = 왕지(자오묘유) / 옆으로 = 생지(인신사해) / 엎드림·뒤척임 = 고지(진술축미) | 3그룹 |
| Q2 정수리 가마 위치 | 오른쪽 = 양지(자인진오신술) / 왼쪽 = 음지(축묘사미유해) | 음/양 |
| Q3 가족에게 들은 대략적 시간대 | 한밤/새벽/오전/한낮/오후/저녁 (6택) | 하루 6분면 |

출처: 60갑자닷컴 생시추정법(https://www.60gabja.com/include/pc/asp/timecheck.asp),
춘송샘 사주명리(https://saju.taruze.co.kr/67) 등. **과학적 근거가 없는 민간
전승이므로 면책 문구가 필수다** (7절 참고).

검토 후 제외한 판별법: 부모 선망(先亡) 여부(판별력은 있으나 민감한 질문),
울음소리·얼굴형(본인이 답하기 어려움), 형제 수 구결(현대에 무의미).

## 2. 데이터 테이블

세 판별축(그룹 × 음양 × 시간대)의 조합으로 12지지가 유일하게 결정된다.

```ts
// 대표시각(hour)은 해당 시진의 중앙 정각. 시간 select에 그대로 넣는 값.
const TIME_BRANCHES = [
  { branch: '자', group: '왕', yang: true,  bucket: '한밤', hour: 0,  label: '자시 (23~01시)' },
  { branch: '축', group: '고', yang: false, bucket: '한밤', hour: 2,  label: '축시 (01~03시)' },
  { branch: '인', group: '생', yang: true,  bucket: '새벽', hour: 4,  label: '인시 (03~05시)' },
  { branch: '묘', group: '왕', yang: false, bucket: '새벽', hour: 6,  label: '묘시 (05~07시)' },
  { branch: '진', group: '고', yang: true,  bucket: '오전', hour: 8,  label: '진시 (07~09시)' },
  { branch: '사', group: '생', yang: false, bucket: '오전', hour: 10, label: '사시 (09~11시)' },
  { branch: '오', group: '왕', yang: true,  bucket: '한낮', hour: 12, label: '오시 (11~13시)' },
  { branch: '미', group: '고', yang: false, bucket: '한낮', hour: 14, label: '미시 (13~15시)' },
  { branch: '신', group: '생', yang: true,  bucket: '오후', hour: 16, label: '신시 (15~17시)' },
  { branch: '유', group: '왕', yang: false, bucket: '오후', hour: 18, label: '유시 (17~19시)' },
  { branch: '술', group: '고', yang: true,  bucket: '저녁', hour: 20, label: '술시 (19~21시)' },
  { branch: '해', group: '생', yang: false, bucket: '저녁', hour: 22, label: '해시 (21~23시)' },
];
```

## 3. 수렴 로직

답변은 각각 독립 필터다. 답하지 않은 문항(null)은 필터하지 않는다.

```ts
type Posture = '왕' | '생' | '고' | null;   // Q1
type Gama    = '양' | '음' | null;          // Q2
type Bucket  = '한밤' | '새벽' | '오전' | '한낮' | '오후' | '저녁' | null; // Q3

function estimateTimeBranches(qPosture: Posture, qGama: Gama, qTime: Bucket) {
  return TIME_BRANCHES.filter(t =>
    (!qPosture || t.group === qPosture) &&
    (!qGama || (qGama === '양') === t.yang) &&
    (!qTime || t.bucket === qTime)
  );
}
```

### 수학적 성질 (검증됨)

| 답변 조합 | 후보 수 | 비고 |
|---|---|---|
| Q1+Q2+Q3 | **0 또는 1** | 0이면 답변 모순 → 안내 후 재답변 유도 |
| Q1+Q2 | **정확히 2** | 남는 둘은 항상 충(冲) 쌍 = 정반대 시간대 (예: 자/오) |
| Q1+Q3 | **정확히 1** | 각 그룹의 4지지가 하루 4분면에 하나씩 배치되어 있음 |
| Q1만 | 4 | 서로 다른 시간대 |
| Q3만 | 2 | 서로 다른 그룹 |

즉 Q2(가마)를 몰라도 Q1+Q3만으로 유일 결정되고, Q3(시간대 전언)를 몰라도
Q1+Q2로 두 후보(정반대 시간대)까지 좁혀져 사용자가 하나만 고르면 된다.

## 4. UI/UX 흐름

1. **노출 조건**: 시간 입력란이 "태어난 시간 모름"일 때만 진입 링크 표시.
   시간이 설정되면 퀴즈는 사라지고, 모름으로 되돌리면 다시 나타난다.
2. **접이식 패널**: 링크 클릭으로 펼침/접힘 토글.
3. **문항 UI**: 각 문항은 알약(pill) 버튼 나열. 선택된 버튼 재클릭 시 해제
   (= 모름 처리). 별도의 "모름" 버튼은 두지 않는다.
4. **후보 표시**: 하나라도 답하면 하단에 후보 버튼 실시간 표시.
   - 1개: "추정된 생시 — 눌러서 시간에 반영하세요"
   - 2개 이상: "후보 N개 — 가장 가까운 것을 눌러 반영하세요"
   - 0개: "답변이 서로 어긋나 일치하는 시가 없습니다. 답을 바꾸거나 일부를 해제해 보세요."
5. **반영**: 후보 클릭 → 시간 select 값을 해당 지지의 `hour`(대표 정각)로
   설정하고 패널을 닫는다. 이후 파이프라인(시주 계산 등)은 일반 시간 입력과
   동일하게 동작한다.

### 참조 구현 (React, 원본 발췌 구조)

```tsx
const [quizOpen, setQuizOpen] = useState(false);
const [qPosture, setQPosture] = useState<string | null>(null);
const [qGama, setQGama] = useState<string | null>(null);
const [qTime, setQTime] = useState<string | null>(null);

// 문항 정의
const QUESTIONS = [
  { key: 'posture', title: '1. 평소 잠자는 자세는? (수면 자세)', value: qPosture, set: setQPosture,
    options: [
      { v: '왕', t: '하늘을 보고 반듯이 잔다' },
      { v: '생', t: '옆으로 누워 잔다' },
      { v: '고', t: '엎드리거나 뒤척이며 잔다' },
    ] },
  { key: 'gama', title: '2. 정수리 가마의 위치는?', value: qGama, set: setQGama,
    options: [
      { v: '양', t: '오른쪽에 있다' },
      { v: '음', t: '왼쪽에 있다' },
    ] },
  { key: 'time', title: '3. 가족에게 들은 대략적인 출생 시간대는?', value: qTime, set: setQTime,
    options: [
      { v: '한밤', t: '한밤 (23~03시)' }, { v: '새벽', t: '새벽 (03~07시)' },
      { v: '오전', t: '오전 (07~11시)' }, { v: '한낮', t: '한낮 (11~15시)' },
      { v: '오후', t: '오후 (15~19시)' }, { v: '저녁', t: '저녁 (19~23시)' },
    ] },
];

// 선택 토글: onClick={() => q.set(q.value === o.v ? null : o.v)}
// 후보 클릭: onClick={() => { setHour(c.hour); setQuizOpen(false); }}
```

전체 JSX는 원본 `src/App.tsx`의 `{hour === null && (` 블록 참고
(약 100줄, Tailwind 스타일 포함).

## 5. 통합 체크리스트 (sajuanalysis 도입 시)

- [ ] 시간 입력 UI에 "모름" 상태가 있는지 확인 (없으면 먼저 추가)
- [ ] `TIME_BRANCHES` + `estimateTimeBranches`를 유틸 모듈로 배치
- [ ] 대표시각(`hour`)이 이 프로젝트의 시간 입력 형식과 맞는지 확인
      (원본은 30분 단위 select여서 정각 값이 그대로 유효했음.
      분 단위 입력이면 `hour * 60`분, 시진 단위 입력이면 `branch`를 직접 사용)
- [ ] 자시(23~01시) 처리 주의: 대표시각을 0시로 넣으므로 야자시(23시대)
      일주 변경 유파를 쓰는 파이프라인이라면 자시 후보에 한해 "23시 / 0시"
      선택지를 나눠 주는 것을 고려
- [ ] 면책 문구 필수 표기 (7절)
- [ ] 퀴즈로 설정된 시간임을 사용자가 알 수 있게 (원본은 select 값 변경으로 갈음)

## 6. 테스트 (원본에서 검증한 케이스)

```ts
// 캐스케이드 성질
for (그룹 g, 음양 y): filter(g, y).length === 2 && 두 후보는 충 쌍
for (그룹 g): filter(g)의 4후보는 시간대가 전부 다름
for (시간대 k): filter(k).length === 2 && 두 후보는 그룹이 다름
// UI
Q1+Q2+Q3 모순 조합(예: 왕지+양지+새벽) → 후보 0개 안내
후보 클릭 → 시간 select에 대표시각 반영, 퀴즈 닫힘, 모름으로 되돌리면 재노출
```

## 7. 면책 문구 (필수)

> \* 수면 자세·가마 위치로 생시를 가늠하는 민간 전승 추정법으로, 과학적
> 근거는 없으며 참고용입니다.

정확한 생시 확인 경로를 함께 안내하면 좋다: 아기수첩 → 출생 병원
출생증명서 → 법원 출생신고서 열람.
