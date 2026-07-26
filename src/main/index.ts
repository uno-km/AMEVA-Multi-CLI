import { app, BrowserWindow } from 'electron'
import { join } from 'path'

import { registerTerminalIpc } from './ipc/terminalIpc'
import { PtyManager } from './pty/PtyManager'

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
  registerTerminalIpc(ptyManager)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow()
      const newManager = new PtyManager(newWindow)
      registerTerminalIpc(newManager)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
