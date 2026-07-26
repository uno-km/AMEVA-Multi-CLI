import { contextBridge, ipcRenderer } from 'electron'

const api = {
  terminal: {
    create: (id: string, cols: number, rows: number, cwd?: string) => ipcRenderer.send('terminal-create', id, cols, rows, cwd),
    write: (id: string, data: string) => ipcRenderer.send('terminal-write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.send('terminal-resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.send('terminal-kill', id),
    onData: (callback: (id: string, data: string) => void) => {
      ipcRenderer.on('terminal-out', (_event, id, data) => callback(id, data))
    },
    onExit: (callback: (id: string, exitCode: number) => void) => {
      ipcRenderer.on('terminal-exit', (_event, id, exitCode) => callback(id, exitCode))
    }
  },
  db: {
    getSession: (id: string) => ipcRenderer.invoke('get-session', id),
    saveSession: (id: string, data: unknown) => ipcRenderer.send('save-session', id, data),
    getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
    addBookmark: (b: Record<string, unknown>) => ipcRenderer.send('add-bookmark', b)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('ContextBridge API expose failed:', error)
  }
} else {
  // @ts-ignore
  window.api = api
}
