---
name: security-audit
description: "Use when: performing security review, vulnerability scan, secret leak check, API auth/cors validation, dependency audit, production hardening checklist"
---

# Security Audit Skill

이 스킬은 프로젝트 보안 점검을 빠르게 시작하고, 결과를 위험도별로 정리하는 워크플로입니다.

## When To Use

- 배포 전 보안 점검
- 외부 API 키/토큰 노출 확인
- 의존성 취약점 검사
- API 인증/인가 누락 점검
- CORS/보안 헤더 점검

## Inputs

- 대상 범위: `api/**`, `src/**`, 전체 저장소
- 실행 환경: 로컬/CI
- 리포트 깊이: quick / standard / deep

## Workflow

1. Secret Exposure Scan
2. Dependency Vulnerability Scan
3. API Authz/Authn Review
4. CORS and Security Header Review
5. Error Message and Logging Review
6. Findings Triage (High/Medium/Low)
7. Fix Plan + Verification Commands

## Command Set (Windows PowerShell)

### 1) Secret Exposure Scan (quick)

```powershell
rg -n --hidden -S "(AIza[0-9A-Za-z\-_]{35}|re_[A-Za-z0-9]{20,}|-----BEGIN PRIVATE KEY-----|FIREBASE_PRIVATE_KEY|service-account|x-api-key|Authorization: Bearer)" . -g "!node_modules" -g "!.git" -g "!dist"
```

`rg`가 없으면 아래 대체 명령 사용:

```powershell
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch "node_modules|\\.git|dist" } | Select-String -Pattern "AIza|re_|BEGIN PRIVATE KEY|FIREBASE_PRIVATE_KEY|service-account|x-api-key|Authorization: Bearer"
```

### 2) Dependency Scan

```powershell
npm audit --audit-level=moderate
```

### 3) API Route Security Review

```powershell
rg -n "export default async function handler|if \(req\.method|Authorization|x-pdf-token|Access-Control-Allow-Origin|res\.status\(" api
```

`rg`가 없으면 아래 대체 명령 사용:

```powershell
Get-ChildItem api -Recurse -File -Filter *.ts | Select-String -Pattern "export default async function handler|if \(req\.method|Authorization|x-pdf-token|Access-Control-Allow-Origin|res\.status\("
```

### 4) Hardcoded Sensitive Config Review

```powershell
rg -n --hidden -S "(API_KEY|SECRET|PRIVATE_KEY|TOKEN|PASSWORD|service-account\.json|FROM_EMAIL|RESEND_API_KEY)" . -g "!node_modules" -g "!.git" -g "!dist"
```

### 5) Type/Build Gate

```powershell
npm run lint
npm run build
```

## Optional Deep Tools

- `gitleaks` for secret scanning
- `semgrep` for SAST
- `npm audit --json` for machine-readable triage

## Findings Format

각 이슈는 아래 형식으로 정리합니다.

- Severity: `High | Medium | Low`
- File: path + line
- Risk: 왜 위험한지
- Evidence: 코드/설정 근거
- Fix: 최소 수정안
- Verification: 재검증 명령

## Guardrails

- 운영 비밀값을 출력하지 않음
- 민감정보는 마스킹해서 보고
- 오탐 가능성은 명시
- 즉시 조치가 필요한 High는 최우선 표시

## Output Template

1. Executive Summary
2. High Findings
3. Medium Findings
4. Low Findings
5. Quick Wins (today)
6. Follow-up Tasks (this week)
