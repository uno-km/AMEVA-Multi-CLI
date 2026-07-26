import { describe, it, expect } from 'vitest'
import * as pty from 'node-pty'
import { ShellResolver } from '../../src/main/pty/ShellResolver'

describe('Pty Integration', () => {
  it('should spawn a real shell and echo korean', async () => {
    const shell = ShellResolver.resolve()
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
    })

    let output = ''
    ptyProcess.onData((data) => {
      output += data
    })

    ptyProcess.write('echo "안녕하세요"\r')
    
    // wait for output
    await new Promise((r) => setTimeout(r, 1000))
    ptyProcess.kill()

    expect(output).toContain('안녕하세요')
  })
})
