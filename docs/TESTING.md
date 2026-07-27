# AMEVA-Multi-CLI Testing Guide

## 테스트 전략

TDD(Test-Driven Development) 기반으로 단위·통합·E2E 3계층 테스트를 운영합니다.

## 테스트 종류 및 실행

### 1. 단위 테스트 (Unit)
```bash
npm run test:unit
```
순수 로직만 격리하여 검증 (Node.js 환경, 외부 의존 없음)

| 파일 | 검증 내용 |
|------|----------|
| `DangerousCommandDetector.test.ts` | 위험 명령 감지 패턴 (8개 케이스) |
| `SecretMasker.test.ts` | 민감 정보 마스킹 패턴 (7개 케이스) |
| `ShellResolver.test.ts` | OS별 쉘 경로 탐색 |

### 2. 통합 테스트 (Integration)
```bash
npm run test:integration
```
실제 의존성(node-pty, SQLite)과 함께 모듈 간 연동 검증

| 파일 | 검증 내용 |
|------|----------|
| `PtyIntegration.test.ts` | 실제 쉘 스폰, 한글 출력, resize, kill |
| `DbIntegration.test.ts` | SQLite 5개 테이블 CRUD, SecretMasker 연동 |

### 3. E2E 테스트 (End-to-End)
```bash
# 먼저 빌드 필요
npm run build
npm run test:e2e
```
Playwright + Electron 런처로 실제 앱 UI 검증

| 테스트 | 검증 내용 |
|--------|----------|
| 앱 시작 | 탭 바, + 버튼 표시 확인 |
| 탭 생성 | 새 탭 클릭 시 탭 개수 증가 |
| 탭 닫기 | 닫기 버튼 클릭 시 탭 제거 |

### 4. 전체 실행
```bash
npm run test:all
# lint + typecheck + unit + integration + e2e + build
```

## OS 호환성 검증 목표
- **Windows**: PowerShell 7 (`pwsh.exe`) / PowerShell 5 / cmd.exe
- **macOS**: zsh / bash
- **Linux**: bash / sh

## 한글 및 IME 입력 테스트
- PTY 통합 테스트에서 `echo "안녕하세요"` 한글 출력 검증 포함
- xterm.js의 `Unicode11Addon`으로 한글 등 다국어 문자폭 처리
- 실제 기기에서 IME 조합 입력 수동 검증 권장

## 커버리지
```bash
# 단위 + 통합 커버리지 리포트
npx vitest run --coverage
```
