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
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd || process.env.HOME || process.env.USERPROFILE || process.cwd(),
      env: process.env as Record<string, string>
    })

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
      session.process.write(data)
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (session) {
      try {
        session.process.resize(cols, rows)
      } catch (err) {
        console.error('Failed to resize', err)
      }
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.process.kill()
      this.sessions.delete(id)
    }
  }
}
