import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'
import { nanoid } from 'nanoid'

interface Props {
  onExit?: (exitCode: number) => void
}

export const TerminalView: React.FC<Props> = ({ onExit }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termInstance = useRef<Terminal | null>(null)
  const ptyId = useRef<string>(nanoid())

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
