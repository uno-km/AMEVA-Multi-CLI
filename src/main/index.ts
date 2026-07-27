import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerTerminalIpc } from './ipc/terminalIpc'
import { registerSystemIpc } from './ipc/systemIpc'
import { PtyManager } from './pty/PtyManager'
import { AppDatabase } from './db/Database'
import { HistoryRepository } from './db/repositories/HistoryRepository'
import { BookmarkRepository } from './db/repositories/BookmarkRepository'
import { SessionRepository } from './db/repositories/SessionRepository'
import { WorkspaceRepository } from './db/repositories/WorkspaceRepository'
import { SettingsRepository } from './db/repositories/SettingsRepository'

// DB는 앱 전체에서 싱글턴으로 유지
const db = new AppDatabase()
const historyRepo = new HistoryRepository(db)
const bookmarkRepo = new BookmarkRepository(db)
const sessionRepo = new SessionRepository(db)
const workspaceRepo = new WorkspaceRepository(db)
const settingsRepo = new SettingsRepository(db)

/**
 * DB 관련 IPC 채널 전체 등록.
 * handle: invoke 방식 (Promise 반환)
 * on: 단방향 이벤트 (fire-and-forget)
 */
function registerDbIpc(): void {
  // ── Session ──
  ipcMain.handle('get-session', (_e, id: string) => sessionRepo.getSession(id))
  ipcMain.on('save-session', (_e, id: string, data: unknown) =>
    sessionRepo.saveSession(id, data)
  )

  // ── Bookmarks ──
  ipcMain.handle('get-bookmarks', () => bookmarkRepo.getAll())
  ipcMain.on('add-bookmark', (_e, b: Parameters<typeof bookmarkRepo.add>[0]) =>
    bookmarkRepo.add(b)
  )
  ipcMain.on('update-bookmark', (_e, id: string, name: string, command: string) =>
    bookmarkRepo.update(id, name, command)
  )
  ipcMain.on('delete-bookmark', (_e, id: string) => bookmarkRepo.delete(id))

  // ── History ──
  ipcMain.handle('get-history', () => historyRepo.getAll())
  ipcMain.handle('search-history', (_e, query: string) => historyRepo.search(query))
  ipcMain.on('clear-history', () => historyRepo.clear())

  // ── Workspaces ──
  ipcMain.handle('get-workspaces', () => workspaceRepo.getAll())
  ipcMain.handle('get-workspace', (_e, id: string) => workspaceRepo.getById(id))
  ipcMain.on('save-workspace', (_e, workspace: Parameters<typeof workspaceRepo.save>[0]) =>
    workspaceRepo.save(workspace)
  )
  ipcMain.on('delete-workspace', (_e, id: string) => workspaceRepo.delete(id))

  // ── Settings ──
  ipcMain.handle('get-settings', () => settingsRepo.getAll())
  ipcMain.on('save-settings', (_e, settings: Parameters<typeof settingsRepo.setAll>[0]) =>
    settingsRepo.setAll(settings)
  )
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 강력한 새로고침 차단 (F5, Ctrl+R, Ctrl+Shift+R)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'F5' ||
      (input.control && input.key.toLowerCase() === 'r')
    ) {
      event.preventDefault()
    }
  })

  return mainWindow
}

app.whenReady().then(() => {
  registerDbIpc()
  registerSystemIpc()

  const mainWindow = createWindow()
  const ptyManager = new PtyManager(mainWindow)
  registerTerminalIpc(ptyManager, historyRepo)

  // macOS: Dock 아이콘 클릭 시 창 재생성
  // registerTerminalIpc 내부에서 removeAllListeners를 호출하므로 중복 등록 방지
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow()
      const newManager = new PtyManager(newWindow)
      registerTerminalIpc(newManager, historyRepo)
    }
  })
})

// 앱 종료 시 DB 정리
app.on('will-quit', () => {
  try {
    db.close()
  } catch (err) {
    console.error('[main] Failed to close DB:', err)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
