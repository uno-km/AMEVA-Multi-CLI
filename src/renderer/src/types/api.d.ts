/**
 * window.api 전역 타입 선언
 * preload/index.ts에서 contextBridge로 노출한 API의 타입 정의.
 * 이 파일이 있으면 renderer 코드에서 window.api를 @ts-ignore 없이 사용 가능.
 */

export {}

declare global {
  interface Window {
    api: {
      terminal: {
        create: (id: string, cols: number, rows: number, cwd?: string) => void
        write: (id: string, data: string) => void
        resize: (id: string, cols: number, rows: number) => void
        kill: (id: string) => void
        onData: (callback: (id: string, data: string) => void) => () => void
        onExit: (callback: (id: string, exitCode: number) => void) => () => void
      }
      db: {
        getSession: (id: string) => Promise<unknown>
        saveSession: (id: string, data: unknown) => void

        getBookmarks: () => Promise<Bookmark[]>
        addBookmark: (b: Bookmark) => void
        updateBookmark: (id: string, name: string, command: string) => void
        deleteBookmark: (id: string) => void

        getHistory: () => Promise<HistoryItem[]>
        searchHistory: (query: string) => Promise<HistoryItem[]>
        clearHistory: () => void

        getWorkspaces: () => Promise<Workspace[]>
        getWorkspace: (id: string) => Promise<Workspace | null>
        saveWorkspace: (workspace: Workspace) => void
        deleteWorkspace: (id: string) => void

        getSettings: () => Promise<AppSettings>
        saveSettings: (settings: Partial<AppSettings>) => void
      }
      system: {
        getOpenPorts: () => Promise<any[]>
        killPort: (pid: number) => Promise<boolean>
      }
    }
  }

  interface Bookmark {
    id: string
    name: string
    type: string
    command: string
    createdAt: string
  }

  interface HistoryItem {
    id: string
    command: string
    startedAt: string
    tags: string
  }

  interface Workspace {
    id: string
    name: string
    layout: WorkspaceLayout
    createdAt: string
    updatedAt: string
  }

  interface WorkspaceLayout {
    tabs: WorkspaceTab[]
  }

  interface WorkspaceTab {
    id: string
    title: string
    rootNode: any
  }

  interface WorkspacePane {
    id: string
    title: string
    cwd?: string
    bookmarkId?: string
  }

  interface AppSettings {
    fontSize: number
    fontFamily: string
    theme: 'dark' | 'light'
    cursorBlink: boolean
    scrollback: number
    shellOverride?: string
  }
}
