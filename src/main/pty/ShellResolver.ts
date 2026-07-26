import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

export class ShellResolver {
  static resolve(): string {
    const platform = os.platform()

    if (platform === 'win32') {
      const system32 = process.env.SystemRoot
        ? path.join(process.env.SystemRoot, 'System32')
        : 'C:\\Windows\\System32'
      const pwshPath = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe')
      const powershellPath = path.join(system32, 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      const cmdPath = path.join(system32, 'cmd.exe')

      if (fs.existsSync(pwshPath)) return pwshPath
      if (fs.existsSync(powershellPath)) return powershellPath
      return cmdPath
    } else {
      // Unix/macOS
      const envShell = process.env.SHELL
      if (envShell && fs.existsSync(envShell)) return envShell

      const fallbacks = ['/bin/zsh', '/bin/bash', '/bin/sh']
      for (const sh of fallbacks) {
        if (fs.existsSync(sh)) return sh
      }
      return '/bin/sh'
    }
  }
}
