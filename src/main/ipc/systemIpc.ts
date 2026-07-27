import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface PortInfo {
  port: number
  pid: number
  processName: string
  isSystem: boolean
  protocol: string
}

const SYSTEM_PROCESSES = new Set([
  'system', 'system idle process', 'svchost.exe', 'wininit.exe', 
  'services.exe', 'lsass.exe', 'smss.exe', 'csrss.exe', 
  'explorer.exe', 'spoolsv.exe', 'winlogon.exe', 'fontdrvhost.exe',
  'taskhostw.exe', 'conhost.exe'
])

export async function getOpenPorts(): Promise<PortInfo[]> {
  try {
    // 1. Get tasklist
    const { stdout: tasklistOut } = await execAsync('tasklist /FO CSV /NH')
    const pidMap = new Map<number, string>()
    
    // Parse CSV: "System","4","Services","0","148 K"
    const lines = tasklistOut.trim().split('\n')
    for (const line of lines) {
      const match = line.match(/"([^"]+)","([^"]+)"/)
      if (match) {
        const processName = match[1]
        const pid = parseInt(match[2], 10)
        pidMap.set(pid, processName)
      }
    }

    // 2. Get netstat
    const { stdout: netstatOut } = await execAsync('netstat -ano')
    const ports = new Map<number, PortInfo>()

    // Parse:  TCP    0.0.0.0:135    0.0.0.0:0    LISTENING    1216
    const netstatLines = netstatOut.trim().split('\n')
    for (const line of netstatLines) {
      if (!line.includes('LISTENING') && !line.includes('수신 대기')) continue;
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 5) {
        const protocol = parts[0]
        const localAddress = parts[1]
        const pidStr = parts[parts.length - 1]
        
        const portMatch = localAddress.match(/:(\d+)$/)
        if (portMatch) {
          const port = parseInt(portMatch[1], 10)
          const pid = parseInt(pidStr, 10)
          const processName = pidMap.get(pid) || 'Unknown'
          
          const isSystem = pid === 0 || pid === 4 || SYSTEM_PROCESSES.has(processName.toLowerCase()) || port < 1024
          
          // If port is already added, skip (netstat might return multiple listeners for same port if IPv4 and IPv6)
          if (!ports.has(port)) {
            ports.set(port, { port, pid, processName, isSystem, protocol })
          }
        }
      }
    }

    // Sort by port number
    return Array.from(ports.values()).sort((a, b) => a.port - b.port)
  } catch (error) {
    console.error('[systemIpc] getOpenPorts error:', error)
    return []
  }
}

export async function killPort(pid: number): Promise<boolean> {
  try {
    // Safety check again before killing
    if (pid === 0 || pid === 4) {
      throw new Error('Cannot kill system PID 0 or 4')
    }
    
    const { stdout: tasklistOut } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`)
    const match = tasklistOut.match(/"([^"]+)","([^"]+)"/)
    if (match) {
      const processName = match[1]
      if (SYSTEM_PROCESSES.has(processName.toLowerCase())) {
        throw new Error(`Cannot kill system process: ${processName}`)
      }
    }

    await execAsync(`taskkill /F /PID ${pid}`)
    return true
  } catch (error) {
    console.error(`[systemIpc] killPort error for PID ${pid}:`, error)
    return false
  }
}

export function registerSystemIpc(): void {
  ipcMain.handle('get-open-ports', async () => await getOpenPorts())
  ipcMain.handle('kill-port', async (_e, pid: number) => await killPort(pid))
}
