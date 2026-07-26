import { ipcMain } from 'electron'
import { PtyManager } from '../pty/PtyManager'

export function registerTerminalIpc(ptyManager: PtyManager): void {
  ipcMain.on('terminal-create', (event, id, cols, rows, cwd) => {
    ptyManager.createSession(id, cols, rows, cwd)
  })

  ipcMain.on('terminal-write', (event, id, data) => {
    ptyManager.write(id, data)
  })

  ipcMain.on('terminal-resize', (event, id, cols, rows) => {
    ptyManager.resize(id, cols, rows)
  })

  ipcMain.on('terminal-kill', (event, id) => {
    ptyManager.kill(id)
  })
}
