import { app, BrowserWindow, ipcMain, Tray, Menu, dialog } from 'electron'
import { join } from 'path'
import icon from '../../build/icon.png?asset'
import { registerTerminalIpc } from './ipc/terminalIpc'
import { registerSystemIpc } from './ipc/systemIpc'
import { PtyManager } from './pty/PtyManager'
import { AppDatabase } from './db/Database'
import { HistoryRepository } from './db/repositories/HistoryRepository'
import { BookmarkRepository } from './db/repositories/BookmarkRepository'
import { SessionRepository } from './db/repositories/SessionRepository'
import { WorkspaceRepository } from './db/repositories/WorkspaceRepository'
import { SettingsRepository } from './db/repositories/SettingsRepository'
import { SplashScreen } from './splash/SplashScreen'

let tray: Tray | null = null
let isQuitting = false

let db: AppDatabase
let historyRepo: HistoryRepository
let bookmarkRepo: BookmarkRepository
let sessionRepo: SessionRepository
let workspaceRepo: WorkspaceRepository
let settingsRepo: SettingsRepository

function registerDbIpc(): void {
  ipcMain.handle('get-session', (_e, id: string) => sessionRepo.getSession(id))
  ipcMain.on('save-session', (_e, id: string, data: unknown) =>
    sessionRepo.saveSession(id, data)
  )

  ipcMain.handle('get-bookmarks', () => bookmarkRepo.getAll())
  ipcMain.on('add-bookmark', (_e, b: Parameters<typeof bookmarkRepo.add>[0]) =>
    bookmarkRepo.add(b)
  )
  ipcMain.on('update-bookmark', (_e, id: string, name: string, command: string) =>
    bookmarkRepo.update(id, name, command)
  )
  ipcMain.on('delete-bookmark', (_e, id: string) => bookmarkRepo.delete(id))

  ipcMain.handle('get-history', () => historyRepo.getAll())
  ipcMain.handle('search-history', (_e, query: string) => historyRepo.search(query))
  ipcMain.on('clear-history', () => historyRepo.clear())

  ipcMain.handle('get-workspaces', () => workspaceRepo.getAll())
  ipcMain.handle('get-workspace', (_e, id: string) => workspaceRepo.getById(id))
  ipcMain.on('save-workspace', (_e, workspace: Parameters<typeof workspaceRepo.save>[0]) =>
    workspaceRepo.save(workspace)
  )
  ipcMain.on('delete-workspace', (_e, id: string) => workspaceRepo.delete(id))

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
    show: false, // 스플래시 로딩 완료 시 표시
    icon: icon,
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

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'F5' ||
      (input.control && input.key.toLowerCase() === 'r')
    ) {
      event.preventDefault()
    }
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['최소화 (트레이)', '종료', '취소'],
        defaultId: 0,
        cancelId: 2,
        title: '종료 확인',
        message: '프로그램을 종료하시겠습니까?',
        detail: '최소화를 선택하면 백그라운드(트레이)에서 계속 실행됩니다.'
      })

      if (choice === 0) {
        mainWindow.hide()
      } else if (choice === 1) {
        isQuitting = true
        app.quit()
      }
    }
  })

  return mainWindow
}

app.whenReady().then(async () => {
  // 1. 즉시 스플래시 로딩 창 생성 및 표시
  const splash = new SplashScreen()
  splash.create()

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  splash.updateProgress(15, '[A-01] Engine startup & system environment check...')
  await delay(120)

  // 2. DB 및 레포지토리 로드
  splash.updateProgress(35, '[B-02] Mounting SQLite Database & Repositories...')
  db = new AppDatabase()
  historyRepo = new HistoryRepository(db)
  bookmarkRepo = new BookmarkRepository(db)
  sessionRepo = new SessionRepository(db)
  workspaceRepo = new WorkspaceRepository(db)
  settingsRepo = new SettingsRepository(db)
  await delay(120)

  // 3. IPC 모듈 등록
  splash.updateProgress(55, '[C-03] Registering System IPC & Security Bridges...')
  registerDbIpc()
  registerSystemIpc()
  await delay(120)

  // 4. 메인 윈도우 & PTY 세션 생성
  splash.updateProgress(75, '[D-04] Initializing Node-PTY Process Manager...')
  const mainWindow = createWindow()
  const ptyManager = new PtyManager(mainWindow)
  registerTerminalIpc(ptyManager, historyRepo)
  await delay(120)

  // 5. 렌더러 렌더링 완료 대기 및 스플래시 전환
  splash.updateProgress(90, '[E-05] Loading React Workbench & Renderer UI...')

  mainWindow.once('ready-to-show', async () => {
    splash.updateProgress(100, '[Z-99] Launch Complete! Opening Workbench...')
    await delay(200)
    splash.close()
    mainWindow.show()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow()
      const newManager = new PtyManager(newWindow)
      registerTerminalIpc(newManager, historyRepo)
      newWindow.show()
    } else {
      BrowserWindow.getAllWindows()[0].show()
    }
  })

  tray = new Tray(icon)
  
  const updateTrayMenu = (openTabs: { id: string; title: string; isActive: boolean }[] = []) => {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '열기 (Open)',
        click: () => {
          const wins = BrowserWindow.getAllWindows()
          if (wins.length > 0) {
            wins[0].show()
          } else {
            const newWindow = createWindow()
            const newManager = new PtyManager(newWindow)
            registerTerminalIpc(newManager, historyRepo)
            newWindow.show()
          }
        }
      },
      { type: 'separator' }
    ]

    if (openTabs.length > 0) {
      template.push({ label: '--- 열린 화면 목록 ---', enabled: false })
      openTabs.forEach(tab => {
        template.push({
          label: (tab.isActive ? '✓ ' : '  ') + tab.title,
          click: () => {
            const wins = BrowserWindow.getAllWindows()
            if (wins.length > 0) {
              wins[0].show()
              wins[0].webContents.send('focus-tab', tab.id)
            }
          }
        })
      })
      template.push({ type: 'separator' })
    }

    template.push({
      label: '종료',
      click: () => {
        isQuitting = true
        app.quit()
      }
    })

    tray?.setContextMenu(Menu.buildFromTemplate(template))
  }

  updateTrayMenu([])

  ipcMain.on('update-tray', (_e, tabs) => {
    updateTrayMenu(tabs)
  })

  tray.setToolTip('AMEVA-Multi-CLI')

  tray.on('click', () => {
    const wins = BrowserWindow.getAllWindows()
    if (wins.length > 0) {
      wins[0].show()
    }
  })
})

app.on('will-quit', () => {
  try {
    db?.close()
  } catch (err) {
    console.error('[main] Failed to close DB:', err)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
