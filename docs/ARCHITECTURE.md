# AMEVA-Multi-CLI Architecture

## 전체 구조 (Overview)
AMEVA-Multi-CLI는 Electron 기반의 데스크톱 멀티 터미널 워크벤치입니다.

- **Main Process (Node.js)**: OS 자원 제어, DB 접근, PTY 생성·제어, 보안 필터링
- **Renderer Process (React + xterm.js)**: UI 렌더링, 사용자 입력 처리, 터미널·사이드바 렌더링
- **Preload Script**: Main↔Renderer 간 IPC 통신을 안전하게 중계 (`contextBridge` 사용)

## 데이터 흐름 (Data Flow)
```
사용자 키 입력
  → Renderer (xterm.js onData)
  → Preload (ipcRenderer.send 'terminal-write')
  → Main (terminalIpc → PtyManager.write)
  → node-pty → OS Shell 프로세스

OS Shell 출력
  → node-pty onData
  → Main (PtyManager.safeSend 'terminal-out')
  → Preload (ipcRenderer.on 'terminal-out')
  → Renderer (xterm.js term.write)
```

## 디렉토리 구조
```
src/
  main/
    index.ts            # Electron main 진입점, IPC 등록
    pty/
      PtyManager.ts     # node-pty 세션 관리, safeSend 크래시 방지
      ShellResolver.ts  # OS별 쉘 경로 자동 탐색
    ipc/
      terminalIpc.ts    # 터미널 IPC 핸들러 (중복 등록 방지)
    db/
      Database.ts       # better-sqlite3 초기화, 스키마 마이그레이션
      repositories/
        BookmarkRepository.ts   # 북마크 CRUD
        HistoryRepository.ts    # 히스토리 저장/검색/삭제
        SessionRepository.ts    # 세션 레이아웃 저장/복원
        WorkspaceRepository.ts  # 워크스페이스 저장/복원
        SettingsRepository.ts   # 앱 설정 키-값 저장
    security/
      DangerousCommandDetector.ts  # 위험 명령 감지 (rm -rf /, fork bomb 등)
      SecretMasker.ts              # 히스토리 저장 전 민감 정보 마스킹
  preload/
    index.ts            # contextBridge API 노출 (terminal.*, db.*)
  renderer/
    src/
      App.tsx           # 메인 UI (탭 바, 사이드바, 패인 레이아웃)
      components/
        TerminalView.tsx  # xterm.js 터미널 컴포넌트 (ResizeObserver 포함)
      stores/
        tabStore.ts       # Zustand 탭/패인 상태 관리
      types/
        api.d.ts          # window.api 전역 타입 선언
```

## DB 설계 (Database)
SQLite (`better-sqlite3`, WAL 모드)를 사용하여 동기적 고속 처리.

| 테이블 | 용도 |
|--------|------|
| `bookmarks` | CLI 북마크 (이름, 명령어, 타입) |
| `history` | 실행된 커맨드 히스토리 (SecretMasker 마스킹 후 저장) |
| `sessions` | 앱 종료 시점의 탭/패인 레이아웃 자동 저장 |
| `workspaces` | 사용자가 명시적으로 저장한 레이아웃 스냅샷 |
| `settings` | 폰트 크기·패밀리, 테마, 스크롤백 등 앱 설정 |

## 보안 모델 (Security Model)
- `nodeIntegration: false`, `contextIsolation: true`
- Renderer에서 직접 Node.js 모듈 접근 금지
- IPC 채널 명시적 등록 (`removeAllListeners` 로 중복 등록 방지)
- 커맨드 히스토리 저장 전 `SecretMasker`로 민감 정보 마스킹
- `DangerousCommandDetector`로 시스템 파괴적 명령 차단
- `PtyManager.safeSend()`로 window 파괴 후 IPC 전송 크래시 방지

## IPC 채널 목록

### Terminal (단방향)
| 채널 | 방향 | 용도 |
|------|------|------|
| `terminal-create` | R→M | PTY 세션 생성 |
| `terminal-write` | R→M | PTY에 데이터 쓰기 |
| `terminal-resize` | R→M | PTY 크기 조정 |
| `terminal-kill` | R→M | PTY 세션 종료 |
| `terminal-out` | M→R | PTY 출력 데이터 |
| `terminal-exit` | M→R | PTY 프로세스 종료 이벤트 |

### Database (양방향)
| 채널 | 방식 | 용도 |
|------|------|------|
| `get-session` / `save-session` | invoke/send | 세션 복원/저장 |
| `get-bookmarks` / `add-bookmark` / `delete-bookmark` | invoke/send | 북마크 관리 |
| `get-history` / `search-history` / `clear-history` | invoke/send | 히스토리 조회/검색/삭제 |
| `get-workspaces` / `get-workspace` / `save-workspace` / `delete-workspace` | invoke/send | 워크스페이스 관리 |
| `get-settings` / `save-settings` | invoke/send | 설정 조회/저장 |
