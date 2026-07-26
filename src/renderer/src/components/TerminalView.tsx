import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'

interface Props {
  paneId: string
  onExit?: (exitCode: number) => void
}

export const TerminalView: React.FC<Props> = ({ paneId, onExit }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termInstance = useRef<Terminal | null>(null)
  const ptyId = useRef<string>(paneId)

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Fira Code", monospace',
      fontSize: 14,
      allowProposedApi: true
    })
    termInstance.current = term

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new SearchAddon())
    
    const unicode11Addon = new Unicode11Addon()
    term.loadAddon(unicode11Addon)
    term.unicode.activeVersion = '11'

    term.open(terminalRef.current)
    fitAddon.fit()

    // @ts-ignore
    window.api.terminal.create(ptyId.current, term.cols, term.rows)

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'c' && e.type === 'keydown') {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection())
          term.clearSelection()
          return false
        }
        return true // 빈 땅이면 xterm이 네이티브로 \x03을 보내도록 위임
      }
      if (e.ctrlKey && e.key === 'v' && e.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          // @ts-ignore
          window.api.terminal.write(ptyId.current, text)
        }).catch(err => console.error('Failed to read clipboard', err))
        return false
      }
      return true
    })

    term.onData((data) => {
      // @ts-ignore
      window.api.terminal.write(ptyId.current, data)
    })

    const handleResize = () => {
      fitAddon.fit()
      // @ts-ignore
      window.api.terminal.resize(ptyId.current, term.cols, term.rows)
    }

    window.addEventListener('resize', handleResize)

    // @ts-ignore
    window.api.terminal.onData((id, data) => {
      if (id === ptyId.current) {
        term.write(data)
      }
    })

    // @ts-ignore
    window.api.terminal.onExit((id, exitCode) => {
      if (id === ptyId.current) {
        onExit?.(exitCode)
      }
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      // @ts-ignore
      window.api.terminal.kill(ptyId.current)
      term.dispose()
    }
  }, [])

  return (
    <div ref={terminalRef} style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 10, boxSizing: 'border-box', backgroundColor: '#000' }} />
  )
}
