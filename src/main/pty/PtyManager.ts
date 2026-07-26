import * as pty from 'node-pty'
import { ShellResolver } from './ShellResolver'
import { BrowserWindow } from 'electron'

interface PtySession {
  id: string
  process: pty.IPty
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()

  constructor(private mainWindow: BrowserWindow) {}

  createSession(id: string, cols: number, rows: number, cwd?: string): void {
    const shell = ShellResolver.resolve()
    const safeCols = cols && cols > 0 ? cols : 80;
    const safeRows = rows && rows > 0 ? rows : 24;
    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: safeCols,
        rows: safeRows,
        cwd: cwd || process.env.HOME || process.env.USERPROFILE || process.cwd(),
        env: process.env as Record<string, string>,
        useConpty: false
      })
    } catch (err: unknown) {
      console.error('[PtyManager] Failed to spawn shell:', err)
      this.mainWindow.webContents.send('terminal-out', id, `\r\n\x1b[31m[Error] Failed to spawn shell: ${(err as Error)?.message}\x1b[0m\r\n`)
      this.mainWindow.webContents.send('terminal-exit', id, 1)
      return
    }

    ptyProcess.onData((data) => {
      this.mainWindow.webContents.send('terminal-out', id, data)
    })

    ptyProcess.onExit((e) => {
      this.mainWindow.webContents.send('terminal-exit', id, e.exitCode)
      this.sessions.delete(id)
    })

    this.sessions.set(id, { id, process: ptyProcess })
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (session) {
      try {
        session.process.write(data)
      } catch (err) {
        console.error(`[PtyManager] Failed to write to session ${id}:`, err)
      }
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (session) {
      try {
        const safeCols = cols && cols > 0 ? cols : 80;
        const safeRows = rows && rows > 0 ? rows : 24;
        session.process.resize(safeCols, safeRows)
      } catch (err) {
        console.error(`[PtyManager] Failed to resize session ${id}:`, err)
      }
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      try {
        session.process.kill()
      } catch (err) {
        console.error(`[PtyManager] Failed to kill session ${id}:`, err)
      }
      this.sessions.delete(id)
    }
  }
}
