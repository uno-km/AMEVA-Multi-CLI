import * as pty from 'node-pty'
import { ShellResolver } from './ShellResolver'
import { BrowserWindow } from 'electron'

interface PtySession {
  id: string
  process: pty.IPty
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()
  private pendingBuffers = new Map<string, string>()
  private isFlushScheduled = false

  constructor(private mainWindow: BrowserWindow) {}

  /**
   * PTY 출력 데이터를 12ms 단위로 배치 전송 (Flush).
   * 데이터가 들어왔을 때만 타이머를 시작하여 터미널 대기 시 CPU 0% 유지.
   */
  private scheduleFlush(): void {
    if (this.isFlushScheduled) return
    this.isFlushScheduled = true

    setTimeout(() => {
      this.isFlushScheduled = false
      if (this.pendingBuffers.size === 0) return

      this.pendingBuffers.forEach((buffer, id) => {
        if (buffer.length > 0) {
          this.safeSend('terminal-out', id, buffer)
        }
      })
      this.pendingBuffers.clear()
    }, 12) // ~80fps batching
  }

  /**
   * mainWindow가 이미 파괴됐는지 안전하게 확인 후 IPC 전송.
   * window-all-closed 이후 비동기 pty 이벤트가 오면 크래시가 발생하므로 반드시 체크.
   */
  private safeSend(channel: string, ...args: unknown[]): void {
    if (this.mainWindow.isDestroyed()) return
    try {
      this.mainWindow.webContents.send(channel, ...args)
    } catch (err) {
      console.error('[PtyManager] safeSend failed:', err)
    }
  }

  createSession(id: string, cols: number, rows: number, cwd?: string): void {
    if (this.sessions.has(id)) {
      console.warn(`[PtyManager] Session ${id} already exists, skipping create.`)
      return
    }

    const shell = ShellResolver.resolve()
    const safeCols = cols && cols > 0 ? cols : 80
    const safeRows = rows && rows > 0 ? rows : 24
    let ptyProcess: pty.IPty

    try {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: safeCols,
        rows: safeRows,
        cwd: cwd || process.env.HOME || process.env.USERPROFILE || process.cwd(),
        env: process.env as Record<string, string>
      })
    } catch (err: unknown) {
      console.error('[PtyManager] Failed to spawn shell:', err)
      this.safeSend(
        'terminal-out',
        id,
        `\r\n\x1b[31m[Error] Failed to spawn shell: ${(err as Error)?.message}\x1b[0m\r\n`
      )
      this.safeSend('terminal-exit', id, 1)
      return
    }

    ptyProcess.onData((data) => {
      const current = this.pendingBuffers.get(id) || ''
      this.pendingBuffers.set(id, current + data)
      this.scheduleFlush()
    })

    ptyProcess.onExit((e) => {
      this.safeSend('terminal-exit', id, e.exitCode)
      this.sessions.delete(id)
      this.pendingBuffers.delete(id)
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
        const safeCols = cols && cols > 0 ? cols : 80
        const safeRows = rows && rows > 0 ? rows : 24
        session.process.resize(safeCols, safeRows)
      } catch (err) {
        console.error(`[PtyManager] Failed to resize session ${id}:`, err)
      }
    }
  }

  kill(id: string): void {
    this.pendingBuffers.delete(id)
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

  killAll(): void {
    this.pendingBuffers.clear()
    this.sessions.forEach((_session, id) => {
      this.kill(id)
    })
  }
}
