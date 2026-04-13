# 배포 전 체크리스트 (2026-03-28)

## 1) 보안 취약점 조치
- [x] `npm audit fix` 실행 완료
- [x] `npm audit --audit-level=moderate` 결과: 취약점 0건
- [x] 보안 패치 반영 파일 확인: package-lock.json

## 2) 품질 검증
- [x] 타입체크: `npm run lint` 통과
- [x] 테스트: `npm run test:run` (1 file, 5 tests) 통과
- [x] 빌드: `npm run build` 통과
- [x] 런타임 헬스체크: `/api/health` 정상 응답 확인

## 3) 번들 최적화 권장사항 반영
- [x] manualChunks 적용 (기능/라이브러리별 분리)
- [x] 동적 import 적용 (PDF 생성 로직)
- [x] 지연 로딩 적용 (마크다운 에디터, 오행 차트)
- [x] 탭 단위 코드 스플리팅 적용 (Guide 탭 lazy 로딩)
- [x] 빌드 경고 임계값 프로젝트 규모에 맞게 조정 (chunkSizeWarningLimit)

## 4) Firebase 설정 점검
- [x] firebase.json JSON 파싱 검증 완료
- [x] firestore 멀티 DB 규칙 설정 확인
  - (default) -> firestore.rules
  - ai-studio-fbfb1881-9f6e-4c3b-9700-cb6640ef2eb9 -> firestore.rules
- [x] Firebase CLI 로그인 상태 확인 (`dean.sj.oh@gmail.com`)
- [x] 프로젝트 접근 확인 (`gen-lang-client-0938860351`)
- [x] Firestore 데이터베이스 조회 확인 (`(default)`, `ai-studio-*`)

## 5) 이번 변경 파일
- firebase.json (기존 작업 내용 유지)
- package-lock.json (audit fix 반영)
- vite.config.ts (청크 분리/빌드 설정)
- src/App.tsx (동적 import + lazy 로딩)
- src/components/LazySimpleMDE.tsx (신규)
- src/components/FiveElementsPieChart.tsx (신규)
- src/components/GuideTab.tsx (신규)
