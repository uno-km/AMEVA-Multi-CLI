import { ipcMain } from 'electron'
import { PtyManager } from '../pty/PtyManager'
import { DangerousCommandDetector } from '../security/DangerousCommandDetector'
import { HistoryRepository } from '../db/repositories/HistoryRepository'
import crypto from 'crypto'

/**
 * IPC 핸들러 등록.
 * 주의: 이 함수는 앱 생명주기에서 한 번만 호출해야 함.
 * ipcMain.on은 같은 채널에 여러 번 호출하면 리스너가 누적되므로,
 * 호출 전 removeAllListeners로 이전 등록을 정리한다.
 */
export function registerTerminalIpc(
  ptyManager: PtyManager,
  historyRepo: HistoryRepository
): void {
  // 중복 등록 방지: 이전 리스너를 모두 제거하고 재등록
  const channels = [
    'terminal-create',
    'terminal-write',
    'terminal-resize',
    'terminal-kill'
  ]
  for (const ch of channels) {
    ipcMain.removeAllListeners(ch)
  }

  ipcMain.on('terminal-create', (_event, id: string, cols: number, rows: number, cwd?: string) => {
    ptyManager.createSession(id, cols, rows, cwd)
  })

  ipcMain.on('terminal-write', (_event, id: string, data: string) => {
    // 개행 문자(\r 또는 \n)가 포함된 경우만 "커맨드 실행"으로 간주하여 히스토리 저장.
    // 단순 키 입력(화살표, 백스페이스 등)은 저장하지 않음.
    // 단, 제어 문자(ESC 시퀀스 등) 로 시작하는 경우는 건너뜀.
    const hasNewline = data.includes('\r') || data.includes('\n')
    const isControlSequence = data.startsWith('\x1b') || data.startsWith('\x03') || data.startsWith('\x04')

    if (hasNewline && !isControlSequence) {
      const trimmed = data.trim()
      if (trimmed.length > 0) {
        if (DangerousCommandDetector.isDangerous(trimmed)) {
          ptyManager.write(
            id,
            '\r\n\x1b[31m[Security Alert] 위험한 명령이 차단되었습니다.\x1b[0m\r\n'
          )
          return
        }
        try {
          historyRepo.add({
            id: crypto.randomUUID(),
            command: trimmed,
            startedAt: new Date().toISOString(),
            tags: 'manual'
          })
        } catch (err) {
          console.error('[terminalIpc] Failed to save history:', err)
        }
      }
    }

    ptyManager.write(id, data)
  })

  ipcMain.on('terminal-resize', (_event, id: string, cols: number, rows: number) => {
    ptyManager.resize(id, cols, rows)
  })

  ipcMain.on('terminal-kill', (_event, id: string) => {
    ptyManager.kill(id)
  })
}
