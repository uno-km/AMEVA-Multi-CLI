import { describe, it, expect } from 'vitest'
import { ShellResolver } from '../../src/main/pty/ShellResolver'

describe('ShellResolver', () => {
  it('should resolve a shell string', () => {
    const shell = ShellResolver.resolve()
    expect(typeof shell).toBe('string')
    expect(shell.length).toBeGreaterThan(0)
  })
})
