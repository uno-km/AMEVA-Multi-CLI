import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'
import { HistorySearch } from './HistorySearch'

interface Props {
  paneId: string
  settings: AppSettings
  onExit?: (exitCode: number) => void
  onFocus?: () => void
  onTitleChange?: (title: string) => void
}

export const TerminalView: React.FC<Props> = React.memo(({ paneId, settings, onExit, onFocus, onTitleChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const [showHistorySearch, setShowHistorySearch] = useState(false)

  const handleFit = useCallback(() => {
    const fitAddon = fitAddonRef.current
    const term = termRef.current
    if (!fitAddon || !term || !containerRef.current) return

    // DOM이 아직 화면에 제대로 렌더링되지 않았거나 너무 작으면 무시 (Windows conpty 버그 방지)
    if (containerRef.current.clientWidth < 50 || containerRef.current.clientHeight < 50) {
      return
    }

    try {
      fitAddon.fit()
      if (term.cols > 5 && term.rows > 2) {
        window.api.terminal.resize(paneId, term.cols, term.rows)
      }
    } catch {
      // xterm이 아직 DOM에 연결되지 않았을 경우 무시
    }
  }, [paneId])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: settings.cursorBlink ?? true,
      fontFamily: settings.fontFamily || '"Fira Code", "Cascadia Code", "Consolas", monospace',
      fontSize: settings.fontSize ?? 14,
      allowProposedApi: true,
      scrollback: settings.scrollback ?? 5000,
      convertEol: false,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255, 255, 255, 0.3)'
      }
    })
    termRef.current = term

    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon

    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new SearchAddon())

    const unicode11 = new Unicode11Addon()
    term.loadAddon(unicode11)
    term.unicode.activeVersion = '11'

    term.open(container)
    // 렌더링 사이클 후 fit 실행 (DOM이 실제로 렌더된 이후)
    requestAnimationFrame(() => {
      fitAddon.fit()
      window.api.terminal.create(paneId, term.cols, term.rows)
    })

    // Ctrl+C: 선택 영역 있으면 클립보드 복사, 없으면 SIGINT 전달
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection()).catch(console.error)
          term.clearSelection()
          return false
        }
        return true
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        navigator.clipboard
          .readText()
          .then((text) => window.api.terminal.write(paneId, text))
          .catch((err) => console.error('[TerminalView] Clipboard read failed:', err))
        return false
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        return false
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'r') {
        setShowHistorySearch(true)
        return false
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        term.selectAll()
        return false
      }
      return true
    })

    // 사용자 입력 → PTY
    const onDataDispose = term.onData((data) => {
      window.api.terminal.write(paneId, data)
    })

    // PTY 출력 → xterm
    const cleanupOnData = window.api.terminal.onData((id, data) => {
      if (id === paneId) term.write(data)
    })

    // PTY 종료
    const cleanupOnExit = window.api.terminal.onExit((id, exitCode) => {
      if (id === paneId) {
        term.write(`\r\n\x1b[90m[프로세스가 종료되었습니다 (코드: ${exitCode})]\x1b[0m\r\n`)
        onExit?.(exitCode)
      }
    })

    // window resize 이벤트 → fit
    window.addEventListener('resize', handleFit)

    const onTitleDispose = term.onTitleChange((title) => {
      if (title && title.trim().length > 0) {
        onTitleChange?.(title)
      }
    })

    const handleFocus = () => {
      onFocus?.()
    }
    container.addEventListener('mousedown', handleFocus, true)
    term.textarea?.addEventListener('focus', handleFocus)

    // ResizeObserver: 컨테이너 div 크기 변화 감지 (패인 분할 등)
    let resizeObserver: ResizeObserver | null = null
    let resizeTimer: NodeJS.Timeout | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          handleFit()
        }, 50) // DOM 레이아웃 안정화 후 fit
      })
      resizeObserver.observe(container)
    }

    cleanupRef.current = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      container.removeEventListener('mousedown', handleFocus, true)
      term.textarea?.removeEventListener('focus', handleFocus)
      window.removeEventListener('resize', handleFit)
      resizeObserver?.disconnect()
      cleanupOnData()
      cleanupOnExit()
      onDataDispose.dispose()
      onTitleDispose.dispose()
      window.api.terminal.kill(paneId)
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [paneId, handleFit]) // settings는 초기화 시에만 적용 (동적 업데이트는 아래 useEffect 사용)

  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.fontSize = settings.fontSize ?? 14
    termRef.current.options.fontFamily = settings.fontFamily || '"Fira Code", "Cascadia Code", "Consolas", monospace'
    termRef.current.options.cursorBlink = settings.cursorBlink ?? true
    termRef.current.options.scrollback = settings.scrollback ?? 5000
    handleFit()
  }, [settings, handleFit])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onMouseDown={onFocus}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#1e1e1e'
        }}
      />
      {showHistorySearch && (
        <HistorySearch
          onSelect={(cmd) => {
            window.api.terminal.write(paneId, cmd + '\r')
            setShowHistorySearch(false)
            termRef.current?.focus()
          }}
          onClose={() => {
            setShowHistorySearch(false)
            termRef.current?.focus()
          }}
        />
      )}
    </div>
  )
})
