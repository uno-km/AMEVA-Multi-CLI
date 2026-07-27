import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { CanvasAddon } from '@xterm/addon-canvas'
import '@xterm/xterm/css/xterm.css'
import { HistorySearch } from './HistorySearch'
import { useTabStore } from '../stores/tabStore'

interface Props {
  paneId: string
  tabId: string
  settings: AppSettings
  onExit?: (exitCode: number) => void
}

// tabId/paneId만 props로 받고, 포커스/타이틀 변경은 내부에서 직접 store 호출
// → onFocus/onTitleChange prop 제거로 React.memo 무력화 방지
export const TerminalView: React.FC<Props> = React.memo(({ paneId, tabId, settings, onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const [showHistorySearch, setShowHistorySearch] = useState(false)

  const handleFit = useCallback(() => {
    const fitAddon = fitAddonRef.current
    const term = termRef.current
    if (!fitAddon || !term || !containerRef.current) return

    if (containerRef.current.clientWidth < 50 || containerRef.current.clientHeight < 50) {
      return
    }

    try {
      const prevCols = term.cols
      const prevRows = term.rows
      fitAddon.fit()
      if (term.cols > 5 && term.rows > 2) {
        if (term.cols !== prevCols || term.rows !== prevRows) {
          window.api.terminal.resize(paneId, term.cols, term.rows)
        }
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

    try {
      term.loadAddon(new CanvasAddon())
    } catch (err) {
      console.warn('[TerminalView] CanvasAddon init fallback:', err)
    }

    requestAnimationFrame(() => {
      fitAddon.fit()
      window.api.terminal.create(paneId, term.cols, term.rows)
    })

    // Ctrl+C: 선택 영역 있으면 클립보드 복사, 없으면 SIGINT 전달
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (term.hasSelection()) {
          const selection = term.getSelection().replace(/\s+$/, '')
          navigator.clipboard.writeText(selection).catch(console.error)
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
        const buffer = term.buffer.active
        let lastNonEmptyRow = 0
        for (let i = buffer.length - 1; i >= 0; i--) {
          const line = buffer.getLine(i)
          if (line && line.translateToString(true).trim().length > 0) {
            lastNonEmptyRow = i
            break
          }
        }
        term.selectLines(0, lastNonEmptyRow)
        return false
      }
      return true
    })

    // 사용자 입력 → PTY
    const onDataDispose = term.onData((data) => {
      window.api.terminal.write(paneId, data)
    })

    // PTY 출력 → xterm
    const cleanupOnData = window.api.terminal.onData(paneId, (data) => {
      term.write(data)
    })

    // PTY 종료
    const cleanupOnExit = window.api.terminal.onExit(paneId, (exitCode) => {
      term.write(`\r\n\x1b[90m[프로세스가 종료되었습니다 (코드: ${exitCode})]\x1b[0m\r\n`)
      onExit?.(exitCode)
    })

    // window resize 이벤트 → fit
    window.addEventListener('resize', handleFit)

    // 타이틀 변경: store에 직접 업데이트 (prop 콜백 제거)
    const onTitleDispose = term.onTitleChange((title) => {
      if (title && title.trim().length > 0) {
        useTabStore.getState().renamePane(tabId, paneId, title)
      }
    })

    // 포커스: store에 직접 업데이트 (prop 콜백 제거)
    // mousedown을 container에서 capture phase로 처리 → React synthetic event 체인 없음
    const handleFocusRaw = () => {
      const state = useTabStore.getState()
      const tab = state.tabs.find(t => t.id === tabId)
      if (tab && tab.activePaneId !== paneId) {
        state.setActivePane(tabId, paneId)
      }
    }
    container.addEventListener('mousedown', handleFocusRaw, true)
    term.textarea?.addEventListener('focus', handleFocusRaw)

    // ResizeObserver: 컨테이너 div 크기 변화 감지 (패인 분할 등)
    let resizeObserver: ResizeObserver | null = null
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          handleFit()
        }, 50)
      })
      resizeObserver.observe(container)
    }

    cleanupRef.current = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      container.removeEventListener('mousedown', handleFocusRaw, true)
      term.textarea?.removeEventListener('focus', handleFocusRaw)
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
  }, [paneId, tabId, handleFit]) // settings는 초기화 시에만 적용

  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.fontSize = settings.fontSize ?? 14
    termRef.current.options.fontFamily = settings.fontFamily || '"Fira Code", "Cascadia Code", "Consolas", monospace'
    termRef.current.options.cursorBlink = settings.cursorBlink ?? true
    termRef.current.options.scrollback = settings.scrollback ?? 5000
    handleFit()
  }, [settings, handleFit])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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
