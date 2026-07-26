import { ipcMain } from 'electron'
import { PtyManager } from '../pty/PtyManager'
import { DangerousCommandDetector } from '../security/DangerousCommandDetector'
import { HistoryRepository } from '../db/repositories/HistoryRepository'
import crypto from 'crypto'

export function registerTerminalIpc(ptyManager: PtyManager, historyRepo: HistoryRepository): void {
  ipcMain.on('terminal-create', (event, id, cols, rows, cwd) => {
    ptyManager.createSession(id, cols, rows, cwd)
  })

  ipcMain.on('terminal-write', (event, id, data) => {
    // Basic heuristics: if data ends with \r or \n, we assume it's a command being executed.
    // In a real terminal, we'd have to buffer this correctly.
    if (data.includes('\r')) {
       if (DangerousCommandDetector.isDangerous(data)) {
           ptyManager.write(id, '\r\n\x1b[31m[Security Alert] Dangerous command blocked by MVP Policy!\x1b[0m\r\n')
           return
       }
       historyRepo.add({
         id: crypto.randomUUID(),
         command: data.trim(),
         startedAt: new Date().toISOString(),
         tags: 'manual'
       })
    }
    ptyManager.write(id, data)
  })

  ipcMain.on('terminal-resize', (event, id, cols, rows) => {
    ptyManager.resize(id, cols, rows)
  })

  ipcMain.on('terminal-kill', (event, id) => {
    ptyManager.kill(id)
  })
}
