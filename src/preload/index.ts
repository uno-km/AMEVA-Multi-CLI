import { contextBridge, ipcRenderer } from 'electron'

// preload 전용 타입 정의 (renderer global types와 분리)
interface BookmarkData {
  id: string
  name: string
  type: string
  command: string
  createdAt: string
}

interface HistoryItemData {
  id: string
  command: string
  startedAt: string
  tags: string
}

interface WorkspaceData {
  id: string
  name: string
  layout: unknown
  createdAt: string
  updatedAt: string
}

interface AppSettingsData {
  fontSize?: number
  fontFamily?: string
  theme?: 'dark' | 'light'
  cursorBlink?: boolean
  scrollback?: number
  shellOverride?: string
}

const api = {
  terminal: {
    create: (id: string, cols: number, rows: number, cwd?: string): void =>
      ipcRenderer.send('terminal-create', id, cols, rows, cwd),
    write: (id: string, data: string): void =>
      ipcRenderer.send('terminal-write', id, data),
    resize: (id: string, cols: number, rows: number): void =>
      ipcRenderer.send('terminal-resize', id, cols, rows),
    kill: (id: string): void =>
      ipcRenderer.send('terminal-kill', id),
    onData: (callback: (id: string, data: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, id: string, data: string): void =>
        callback(id, data)
      ipcRenderer.on('terminal-out', listener)
      return () => ipcRenderer.removeListener('terminal-out', listener)
    },
    onExit: (callback: (id: string, exitCode: number) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        id: string,
        exitCode: number
      ): void => callback(id, exitCode)
      ipcRenderer.on('terminal-exit', listener)
      return () => ipcRenderer.removeListener('terminal-exit', listener)
    }
  },
  db: {
    // Session
    getSession: (id: string): Promise<unknown> =>
      ipcRenderer.invoke('get-session', id),
    saveSession: (id: string, data: unknown): void =>
      ipcRenderer.send('save-session', id, data),

    // Bookmarks
    getBookmarks: (): Promise<BookmarkData[]> =>
      ipcRenderer.invoke('get-bookmarks'),
    addBookmark: (b: BookmarkData): void =>
      ipcRenderer.send('add-bookmark', b),
    deleteBookmark: (id: string): void =>
      ipcRenderer.send('delete-bookmark', id),

    // History
    getHistory: (): Promise<HistoryItemData[]> =>
      ipcRenderer.invoke('get-history'),
    searchHistory: (query: string): Promise<HistoryItemData[]> =>
      ipcRenderer.invoke('search-history', query),
    clearHistory: (): void =>
      ipcRenderer.send('clear-history'),

    // Workspaces
    getWorkspaces: (): Promise<WorkspaceData[]> =>
      ipcRenderer.invoke('get-workspaces'),
    getWorkspace: (id: string): Promise<WorkspaceData | null> =>
      ipcRenderer.invoke('get-workspace', id),
    saveWorkspace: (workspace: WorkspaceData): void =>
      ipcRenderer.send('save-workspace', workspace),
    deleteWorkspace: (id: string): void =>
      ipcRenderer.send('delete-workspace', id),

    // Settings
    getSettings: (): Promise<AppSettingsData> =>
      ipcRenderer.invoke('get-settings'),
    saveSettings: (settings: AppSettingsData): void =>
      ipcRenderer.send('save-settings', settings)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[Preload] contextBridge expose failed:', error)
  }
} else {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).api = api
}
