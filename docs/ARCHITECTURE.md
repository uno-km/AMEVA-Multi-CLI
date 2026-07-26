# AMEVA-Multi-CLI Architecture

## 전체 구조 (Overview)
AMEVA-Multi-CLI는 Electron 기반의 데스크톱 앱입니다.
- **Main Process (Node.js)**: OS 자원 제어, DB 접근, Pty 생성 및 제어.
- **Renderer Process (React + xterm.js)**: UI 렌더링, 사용자 입력 처리, 터미널 뷰 렌더링.
- **Preload Script**: Main과 Renderer 사이의 IPC 통신을 안전하게 중계 (contextBridge 사용).

## 데이터 흐름 (Data Flow)
- **사용자 입력**: Renderer (xterm.js) -> Preload (IPC) -> Main (node-pty) -> OS Shell
- **쉘 출력**: OS Shell -> Main (node-pty) -> Preload (IPC) -> Renderer (xterm.js)

## DB 설계 (Database)
SQLite (better-sqlite3)를 사용하여 빠르고 동기적인 처리를 지향합니다.
테이블:
- `bookmarks`: CLI 북마크 객체.
- `workspaces`: 멀티 패널 레이아웃과 북마크 그룹.
- `history`: 실행된 커맨드 히스토리.
- `sessions`: 앱 종료 시점의 레이아웃, CWD 상태 저장.
- `settings`: 사용자 설정.

## 보안 모델 (Security Model)
- `nodeIntegration: false`, `contextIsolation: true`
- Renderer에서 직접 Node.js 모듈(fs, process, child_process) 접근 금지.
- IPC 채널 화이트리스트 기반 통신.
- Command History 저장 전 민감 정보 필터링 (SecretMasker).
