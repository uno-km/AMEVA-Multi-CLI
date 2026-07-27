import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as pty from 'node-pty'
import { ShellResolver } from '../../src/main/pty/ShellResolver'

describe('PTY 통합 테스트', () => {
  it('실제 쉘을 스폰하고 한글 echo가 동작한다', async () => {
    const shell = ShellResolver.resolve()
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30
    })

    let output = ''
    ptyProcess.onData((data) => { output += data })

    ptyProcess.write('echo "안녕하세요"\r')

    for (let i = 0; i < 50; i++) {
      if (output.includes('안녕하세요')) break
      await new Promise((r) => setTimeout(r, 100))
    }

    ptyProcess.kill()
    expect(output).toContain('안녕하세요')
  }, 10000)

  it('resize가 크래시 없이 동작한다', async () => {
    const shell = ShellResolver.resolve()
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24
    })

    await new Promise((r) => setTimeout(r, 500))
    expect(() => ptyProcess.resize(120, 40)).not.toThrow()
    expect(() => ptyProcess.resize(80, 24)).not.toThrow()

    ptyProcess.kill()
  }, 5000)

  it('write 후 kill이 정상 동작한다', async () => {
    const shell = ShellResolver.resolve()
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24
    })

    let exited = false
    ptyProcess.onExit(() => { exited = true })

    await new Promise((r) => setTimeout(r, 300))
    ptyProcess.write('echo test\r')
    await new Promise((r) => setTimeout(r, 200))
    ptyProcess.kill()

    await new Promise((r) => setTimeout(r, 500))
    expect(exited).toBe(true)
  }, 5000)
})
