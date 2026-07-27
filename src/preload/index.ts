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

const terminalDataCallbacks = new Map<string, (data: string) => void>()
const terminalExitCallbacks = new Map<string, (exitCode: number) => void>()

ipcRenderer.on('terminal-out', (_event, id: string, data: string) => {
  terminalDataCallbacks.get(id)?.(data)
})

ipcRenderer.on('terminal-exit', (_event, id: string, exitCode: number) => {
  terminalExitCallbacks.get(id)?.(exitCode)
})

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
    onData: (paneId: string, callback: (data: string) => void): (() => void) => {
      terminalDataCallbacks.set(paneId, callback)
      return () => {
        terminalDataCallbacks.delete(paneId)
      }
    },
    onExit: (paneId: string, callback: (exitCode: number) => void): (() => void) => {
      terminalExitCallbacks.set(paneId, callback)
      return () => {
        terminalExitCallbacks.delete(paneId)
      }
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
    updateBookmark: (id: string, name: string, command: string): void =>
      ipcRenderer.send('update-bookmark', id, name, command),
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
  },
  system: {
    getOpenPorts: (): Promise<any[]> => ipcRenderer.invoke('get-open-ports'),
    killPort: (pid: number): Promise<boolean> => ipcRenderer.invoke('kill-port', pid),
    updateTray: (tabs: { id: string; title: string; isActive: boolean }[]): void => ipcRenderer.send('update-tray', tabs)
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
