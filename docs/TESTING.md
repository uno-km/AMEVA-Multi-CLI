# AMEVA-Multi-CLI Testing Guide

## 테스트 전략
이 프로젝트는 TDD (Test-Driven Development)를 기반으로 작성되었습니다.

## 테스트 종류
1. **Unit Tests (단위 테스트)**
   - `npm run test:unit`
   - 순수 함수, 로직(쉘 탐색기, 위험 명령 필터 등) 검증.
2. **Integration Tests (통합 테스트)**
   - `npm run test:integration`
   - 실제 `node-pty` 프로세스 스폰, SQLite DB 접근 등 모듈간 연동 검증.
3. **E2E Tests (단대단 테스트)**
   - `npm run test:e2e`
   - Playwright 기반 UI 테스트. 앱 실행, 터미널 입력, 화면 출력, 탭 조작 등 확인.

## OS 및 호환성 검증
- Windows (cmd, pwsh), macOS (zsh, bash), Linux (bash) 등 다양한 쉘에서 호환성을 검증해야 합니다.
- 한글 및 다국어 입력(IME) 조합 테스트가 필수적입니다.
