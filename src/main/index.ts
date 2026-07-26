import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerTerminalIpc } from './ipc/terminalIpc'
import { PtyManager } from './pty/PtyManager'
import { AppDatabase } from './db/Database'
import { HistoryRepository } from './db/repositories/HistoryRepository'
import { BookmarkRepository } from './db/repositories/BookmarkRepository'
import { SessionRepository } from './db/repositories/SessionRepository'

const db = new AppDatabase()
const historyRepo = new HistoryRepository(db)
const bookmarkRepo = new BookmarkRepository(db)
const sessionRepo = new SessionRepository(db)

// Register DB IPC
ipcMain.handle('get-session', (e, id) => sessionRepo.getSession(id))
ipcMain.on('save-session', (e, id, data) => sessionRepo.saveSession(id, data))
ipcMain.handle('get-bookmarks', () => bookmarkRepo.getAll())
ipcMain.on('add-bookmark', (e, b) => bookmarkRepo.add(b))

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

app.whenReady().then(() => {
  const mainWindow = createWindow()
  const ptyManager = new PtyManager(mainWindow)
  registerTerminalIpc(ptyManager, historyRepo)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow()
      const newManager = new PtyManager(newWindow)
      registerTerminalIpc(newManager, historyRepo)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
