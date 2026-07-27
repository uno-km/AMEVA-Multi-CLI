import React, { useEffect, useState, useCallback, useRef } from 'react'
import { TerminalView } from './components/TerminalView'
import { SettingsModal } from './components/SettingsModal'
import { useDialog } from './components/DialogProvider'
import { useTabStore, type Tab } from './stores/tabStore'
import { nanoid } from 'nanoid'

// ─────────────────────────────────────────────────────────────────────────────
// 타입 가드
// ─────────────────────────────────────────────────────────────────────────────
function isValidTabArray(data: unknown): data is Tab[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (t) =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as Tab).id === 'string' &&
        typeof (t as Tab).title === 'string' &&
        Array.isArray((t as Tab).panes) &&
        (t as Tab).panes.length > 0 &&
        (t as Tab).panes.every(
          (p) => typeof p === 'object' && p !== null && typeof p.id === 'string'
        )
    )
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
type SidebarTab = 'bookmarks' | 'history' | 'workspaces'

function App(): JSX.Element {
  const { tabs, activeTabId, addTab, setActiveTab, closeTab, addPane, closePane } = useTabStore()
  const { confirm, prompt } = useDialog()

  // 북마크
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  // 히스토리
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  // 워크스페이스
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  // 사이드바
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('bookmarks')
  // 설정
  const [settings, setSettings] = useState<AppSettings>({ fontSize: 14, fontFamily: '', theme: 'dark', cursorBlink: true, scrollback: 5000 })
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 세션 저장 debounce 타이머
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 패인 리사이징 상태
  const paneAreaRef = useRef<HTMLDivElement>(null)
  const [resizing, setResizing] = useState<{ tabId: string; prevId: string; nextId: string; startX: number; prevW: number; nextW: number } | null>(null)

  // ── 초기 로드 ──
  useEffect(() => {
    // 세션 복원
    window.api.db
      .getSession('default')
      .then((savedTabs) => {
        if (isValidTabArray(savedTabs)) {
          const freshTabs = savedTabs.map((tab) => {
            const freshPanes = tab.panes.map((p) => ({ ...p, id: nanoid() }))
            const freshActivePaneId = freshPanes[0]?.id ?? nanoid()
            return { ...tab, id: nanoid(), panes: freshPanes, activePaneId: freshActivePaneId }
          })
          useTabStore.setState({ tabs: freshTabs, activeTabId: freshTabs[0].id })
        }
      })
      .catch((err) => console.error('[App] Failed to load session:', err))

    // 북마크 로드
    window.api.db
      .getBookmarks()
      .then(setBookmarks)
      .catch((err) => console.error('[App] Failed to load bookmarks:', err))

    // 워크스페이스 로드
    window.api.db
      .getWorkspaces()
      .then(setWorkspaces)
      .catch((err) => console.error('[App] Failed to load workspaces:', err))

    // 설정 로드
    window.api.db
      .getSettings()
      .then((s) => {
        if (s) setSettings(s)
      })
      .catch((err) => console.error('[App] Failed to load settings:', err))
  }, [])

  // ── 패인 리사이징 핸들러 ──
  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      if (!paneAreaRef.current) return
      const deltaX = e.clientX - resizing.startX
      const totalWidth = paneAreaRef.current.clientWidth
      
      // 전체 가중치 대비 픽셀 변화량 계산
      // (기본 weight 1은 1 비율을 의미하므로, 전체 너비에 대한 변화율을 가중치로 환산)
      const weightDelta = (deltaX / totalWidth) * (tabs.find(t => t.id === resizing.tabId)?.panes.reduce((sum, p) => sum + (p.weight ?? 1), 0) || 1)
      
      useTabStore.getState().setPaneWeight(resizing.tabId, resizing.prevId, Math.max(0.1, resizing.prevW + weightDelta))
      useTabStore.getState().setPaneWeight(resizing.tabId, resizing.nextId, Math.max(0.1, resizing.nextW - weightDelta))
    }
    const handleMouseUp = () => setResizing(null)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, tabs])

  // ── 탭 변경 시 세션 자동 저장 (debounce 500ms) ──
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (tabs.length > 0) {
        window.api.db.saveSession('default', tabs)
      }
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [tabs])

  // ── 히스토리 사이드바 열릴 때 로드 ──
  useEffect(() => {
    if (sidebarTab === 'history') {
      const q = historyQuery.trim()
      const loader = q
        ? window.api.db.searchHistory(q)
        : window.api.db.getHistory()
      loader
        .then(setHistory)
        .catch((err) => console.error('[App] Failed to load history:', err))
    }
  }, [sidebarTab, historyQuery])

  // ─────────────────────────────────────────────────────────────────────────
  // 북마크 핸들러
  // ─────────────────────────────────────────────────────────────────────────
  const handleAddBookmark = useCallback(async () => {
    const name = await prompt('북마크 추가', '북마크 이름 (예: 프로덕션 서버):', 'New Bookmark')
    if (!name?.trim()) return
    const command = await prompt('명령어 입력', '실행할 명령어 (예: ssh user@host):', 'echo hello')
    if (!command?.trim()) return

    const b: Bookmark = {
      id: nanoid(),
      name: name.trim(),
      type: 'local',
      command: command.trim(),
      createdAt: new Date().toISOString()
    }
    window.api.db.addBookmark(b)
    setBookmarks((prev) => [b, ...prev])
  }, [prompt])

  const handleDeleteBookmark = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!(await confirm('북마크 삭제', '이 북마크를 삭제하시겠습니까?'))) return
    window.api.db.deleteBookmark(id)
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }, [confirm])

  const handleRunBookmark = useCallback(
    (b: Bookmark) => {
      const targetPaneId = nanoid()
      if (tabs.length === 0) {
        const newTabId = nanoid()
        useTabStore.setState({
          tabs: [{ id: newTabId, title: b.name, panes: [{ id: targetPaneId, title: b.name }], activePaneId: targetPaneId }],
          activeTabId: newTabId
        })
      } else {
        useTabStore.setState({
          tabs: tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, panes: [...t.panes, { id: targetPaneId, title: b.name }], activePaneId: targetPaneId }
              : t
          )
        })
      }
      // TerminalView가 마운트되어 PTY가 준비된 후 명령어 전송
      setTimeout(() => {
        window.api.terminal.write(targetPaneId, b.command + '\r')
      }, 600)
    },
    [tabs, activeTabId]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // 히스토리 핸들러
  // ─────────────────────────────────────────────────────────────────────────
  const handleRunHistory = useCallback(
    (item: HistoryItem) => {
      const activeTab = tabs.find((t) => t.id === activeTabId)
      if (!activeTab || activeTab.panes.length === 0) return
      const activePaneId = activeTab.activePaneId || activeTab.panes[0].id
      window.api.terminal.write(activePaneId, item.command + '\r')
    },
    [tabs, activeTabId]
  )

  const handleClearHistory = useCallback(async () => {
    if (!(await confirm('히스토리 전체 삭제', '히스토리를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'))) return
    window.api.db.clearHistory()
    setHistory([])
  }, [confirm])

  // ─────────────────────────────────────────────────────────────────────────
  // 워크스페이스 핸들러
  // ─────────────────────────────────────────────────────────────────────────
  const handleSaveWorkspace = useCallback(async () => {
    const name = await prompt('워크스페이스 저장', '현재 탭 레이아웃을 저장할 이름을 입력하세요:', '내 워크스페이스')
    if (!name?.trim()) return
    const ws: Workspace = {
      id: nanoid(),
      name: name.trim(),
      layout: {
        tabs: tabs.map((tab) => ({
          id: tab.id,
          title: tab.title,
          panes: tab.panes.map((p) => ({ id: p.id, title: p.title, cwd: p.cwd }))
        }))
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    window.api.db.saveWorkspace(ws)
    setWorkspaces((prev) => [ws, ...prev])
  }, [tabs, prompt])

  const handleRestoreWorkspace = useCallback(async (ws: Workspace) => {
    if (!(await confirm('워크스페이스 복원', `"${ws.name}" 워크스페이스를 복원하시겠습니까?\n현재 열려있는 모든 탭이 닫히고 덮어씌워집니다.`))) return
    const freshTabs: Tab[] = ws.layout.tabs.map((wt) => {
      const freshPanes = wt.panes.map((p) => ({ ...p, id: nanoid() }))
      const freshActivePaneId = freshPanes[0]?.id ?? nanoid()
      return { id: nanoid(), title: wt.title, panes: freshPanes, activePaneId: freshActivePaneId }
    })
    if (freshTabs.length === 0) return
    useTabStore.setState({ tabs: freshTabs, activeTabId: freshTabs[0].id })
  }, [confirm])

  const handleDeleteWorkspace = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!(await confirm('워크스페이스 삭제', '이 워크스페이스를 삭제하시겠습니까?'))) return
    window.api.db.deleteWorkspace(id)
    setWorkspaces((prev) => prev.filter((w) => w.id !== id))
  }, [confirm])

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────────────────────────────────
  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div style={styles.root}>
      {/* ── 탭 바 ── */}
      <div style={styles.tabBar}>
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          style={styles.iconBtn}
          title="사이드바 토글 (☰)"
        >
          ☰
        </button>

        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tabItem,
              background: tab.id === activeTabId ? 'var(--glass-bg)' : 'transparent',
              color: tab.id === activeTabId ? 'var(--text-main)' : 'var(--text-muted)',
              borderBottom: tab.id === activeTabId ? '2px solid var(--accent)' : '2px solid transparent'
            }}
          >
            <span style={{ fontSize: '11px' }}>⬛</span>
            <span>{tab.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              style={styles.closeBtn}
              title="탭 닫기"
            >
              ×
            </button>
          </div>
        ))}

        <button onClick={addTab} style={styles.newTabBtn} title="새 탭 (Ctrl+T)">
          +
        </button>

        <div style={{ flex: 1 }} />
        <button
          onClick={() => setSettingsOpen(true)}
          style={styles.iconBtn}
          title="설정 (⚙)"
        >
          ⚙
        </button>
      </div>

      {/* ── 본문 ── */}
      <div style={styles.body}>
        {/* ── 사이드바 ── */}
        {sidebarOpen && (
          <div style={styles.sidebar}>
            {/* 사이드바 탭 헤더 */}
            <div style={styles.sidebarTabs}>
              {(['bookmarks', 'history', 'workspaces'] as SidebarTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSidebarTab(t)}
                  style={{
                    ...styles.sidebarTabBtn,
                    background: sidebarTab === t ? '#1e1e1e' : 'transparent',
                    color: sidebarTab === t ? '#fff' : '#777',
                    borderBottom: sidebarTab === t ? '2px solid #007acc' : '2px solid transparent'
                  }}
                >
                  {t === 'bookmarks' ? '★ 북마크' : t === 'history' ? '⟳ 히스토리' : '⊞ 워크스페이스'}
                </button>
              ))}
            </div>

            {/* ── 북마크 패널 ── */}
            {sidebarTab === 'bookmarks' && (
              <div style={styles.sidebarPanel}>
                <div style={styles.sidebarPanelHeader}>
                  <span style={styles.sidebarPanelTitle}>북마크</span>
                  <button onClick={handleAddBookmark} style={styles.addBtn} title="북마크 추가">+</button>
                </div>
                <div style={styles.listScroll}>
                  {bookmarks.length === 0 ? (
                    <div style={styles.emptyMsg}>
                      북마크 없음<br />
                      <span style={{ fontSize: '11px', color: '#555' }}>더블클릭으로 실행</span>
                    </div>
                  ) : (
                    bookmarks.map((b) => (
                      <div
                        key={b.id}
                        onDoubleClick={() => handleRunBookmark(b)}
                        title={`더블클릭으로 실행\n$ ${b.command}`}
                        style={styles.listItem}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <span style={styles.listItemText}>▶ {b.name}</span>
                        <button
                          onClick={(e) => handleDeleteBookmark(b.id, e)}
                          style={styles.deleteBtn}
                          title="삭제"
                        >×</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── 히스토리 패널 ── */}
            {sidebarTab === 'history' && (
              <div style={styles.sidebarPanel}>
                <div style={styles.sidebarPanelHeader}>
                  <span style={styles.sidebarPanelTitle}>히스토리</span>
                  <button onClick={handleClearHistory} style={{ ...styles.deleteBtn, fontSize: '11px', padding: '2px 6px' }} title="전체 삭제">전체삭제</button>
                </div>
                <input
                  type="text"
                  placeholder="명령어 검색..."
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  style={styles.searchInput}
                />
                <div style={styles.listScroll}>
                  {history.length === 0 ? (
                    <div style={styles.emptyMsg}>히스토리 없음</div>
                  ) : (
                    history.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleRunHistory(item)}
                        title={`클릭하여 현재 패인에서 실행\n실행 시각: ${item.startedAt}`}
                        style={{ ...styles.listItem, cursor: 'pointer' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <span style={{ ...styles.listItemText, fontFamily: 'monospace', fontSize: '12px' }}>
                          $ {item.command}
                        </span>
                        <span style={{ fontSize: '10px', color: '#555', flexShrink: 0 }}>
                          {new Date(item.startedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── 워크스페이스 패널 ── */}
            {sidebarTab === 'workspaces' && (
              <div style={styles.sidebarPanel}>
                <div style={styles.sidebarPanelHeader}>
                  <span style={styles.sidebarPanelTitle}>워크스페이스</span>
                  <button onClick={handleSaveWorkspace} style={styles.addBtn} title="현재 레이아웃 저장">저장</button>
                </div>
                <div style={styles.listScroll}>
                  {workspaces.length === 0 ? (
                    <div style={styles.emptyMsg}>
                      워크스페이스 없음<br />
                      <span style={{ fontSize: '11px', color: '#555' }}>현재 탭 구성을 저장하세요</span>
                    </div>
                  ) : (
                    workspaces.map((ws) => (
                      <div
                        key={ws.id}
                        onDoubleClick={() => handleRestoreWorkspace(ws)}
                        title={`더블클릭으로 복원\n탭 수: ${ws.layout.tabs.length}\n저장: ${new Date(ws.updatedAt).toLocaleDateString('ko-KR')}`}
                        style={styles.listItem}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={styles.listItemText}>⊞ {ws.name}</div>
                          <div style={{ fontSize: '10px', color: '#555' }}>
                            탭 {ws.layout.tabs.length}개 · {new Date(ws.updatedAt).toLocaleDateString('ko-KR')}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteWorkspace(ws.id, e)}
                          style={styles.deleteBtn}
                          title="삭제"
                        >×</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 패인 영역 ── */}
        <div style={styles.paneArea} ref={paneAreaRef}>
          {/* 패인 탭 바 (패인 2개 이상일 때) */}
          {activeTab && activeTab.panes.length > 1 && (
            <div style={styles.paneTabBar}>
              {activeTab.panes.map((pane) => (
                <div
                  key={pane.id}
                  style={{
                    ...styles.paneTabItem,
                    background: pane.id === activeTab.activePaneId ? '#252526' : 'transparent',
                    color: pane.id === activeTab.activePaneId ? '#fff' : '#666'
                  }}
                >
                  <span>{pane.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); closePane(activeTab.id, pane.id) }}
                    style={styles.closeBtn}
                    title="패인 닫기"
                  >×</button>
                </div>
              ))}
              <button onClick={() => addPane(activeTabId)} style={styles.newTabBtn} title="패인 추가">+</button>
            </div>
          )}

          {/* 터미널 패인 컨텐츠 */}
          <div style={styles.paneContent}>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                style={{ ...styles.paneRow, display: tab.id === activeTabId ? 'flex' : 'none' }}
              >
                {tab.panes.map((pane, i) => (
                  <React.Fragment key={pane.id}>
                    <div style={{ ...styles.paneCell, flex: pane.weight ?? 1 }}>
                      <TerminalView
                        key={pane.id}
                        paneId={pane.id}
                        settings={settings}
                        onExit={(code) => {
                          if (code !== 0) console.warn(`[App] Pane ${pane.id} exited with code ${code}`)
                        }}
                      />
                    </div>
                    {/* 리사이즈 핸들러 */}
                    {i < tab.panes.length - 1 && (
                      <div
                        style={styles.resizer}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setResizing({
                            tabId: tab.id,
                            prevId: tab.panes[i].id,
                            nextId: tab.panes[i+1].id,
                            startX: e.clientX,
                            prevW: tab.panes[i].weight ?? 1,
                            nextW: tab.panes[i+1].weight ?? 1
                          })
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
                {/* 패인 1개일 때도 분할 버튼 */}
                {tab.panes.length === 1 && (
                  <button
                    onClick={() => addPane(tab.id)}
                    style={styles.splitBtn}
                    title="화면 분할"
                  >
                    ⊞
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 설정 모달 ── */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(newSettings) => {
            window.api.db.saveSettings(newSettings)
            setSettings(newSettings)
            setSettingsOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 스타일 상수 (Ultra-sleek Modern Aesthetic)
// ─────────────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column',
    height: '100vh', width: '100vw',
    margin: 0, padding: 0,
    overflow: 'hidden', fontSize: '13px',
    background: 'var(--bg-base)'
  },
  tabBar: {
    display: 'flex', alignItems: 'center',
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border-light)',
    overflowX: 'auto', flexShrink: 0, minHeight: '38px',
  },
  tabItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '0 14px', height: '38px',
    cursor: 'pointer', borderRight: '1px solid var(--border-light)',
    fontSize: '13px', whiteSpace: 'nowrap', userSelect: 'none',
    transition: 'all 0.15s ease', fontWeight: 500
  },
  iconBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: '16px',
    padding: '0 12px', height: '38px', transition: 'color 0.15s ease'
  },
  newTabBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: '18px', padding: '0 14px', height: '38px',
    transition: 'color 0.15s ease'
  },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: '14px', padding: '0 4px', lineHeight: '1',
    transition: 'color 0.15s ease'
  },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: {
    width: '240px', minWidth: '180px', maxWidth: '300px',
    background: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border-light)',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  sidebarTabs: {
    display: 'flex', background: 'transparent',
    borderBottom: '1px solid var(--border-light)', flexShrink: 0
  },
  sidebarTabBtn: {
    flex: 1, border: 'none', cursor: 'pointer',
    padding: '8px 4px', fontSize: '11px', transition: 'all 0.15s ease',
    fontWeight: 600, background: 'transparent'
  },
  sidebarPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sidebarPanelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', background: 'transparent',
    borderBottom: '1px solid var(--border-light)', flexShrink: 0
  },
  sidebarPanelTitle: { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  addBtn: {
    background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-main)',
    cursor: 'pointer', fontSize: '12px', padding: '4px 10px', borderRadius: '4px',
    transition: 'all 0.15s ease', fontWeight: 500
  },
  listScroll: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  listItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 14px', cursor: 'pointer',
    borderBottom: '1px solid var(--border-light)', transition: 'background 0.15s ease'
  },
  listItemText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--text-main)' },
  deleteBtn: {
    background: 'transparent', border: 'none', color: 'var(--danger)',
    cursor: 'pointer', fontSize: '14px', padding: '0 4px', flexShrink: 0,
    opacity: 0.5, transition: 'opacity 0.15s ease'
  },
  emptyMsg: {
    padding: '30px 20px', color: 'var(--text-muted)', fontSize: '13px',
    textAlign: 'center', lineHeight: '1.6'
  },
  searchInput: {
    margin: '10px 12px', padding: '6px 10px',
    background: 'var(--bg-base)', border: '1px solid var(--border-light)',
    color: 'var(--text-main)', fontSize: '12px', borderRadius: '4px', outline: 'none',
    transition: 'border-color 0.15s ease'
  },
  paneArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' },
  paneTabBar: {
    display: 'flex', background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border-light)', flexShrink: 0
  },
  paneTabItem: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', cursor: 'pointer',
    fontSize: '12px', borderRight: '1px solid var(--border-light)',
    transition: 'all 0.15s ease'
  },
  paneContent: { flex: 1, display: 'flex', overflow: 'hidden' },
  paneRow: { flex: 1, overflow: 'hidden' },
  paneCell: {
    flex: 1, display: 'flex', flexDirection: 'column',
    borderRight: '1px solid var(--border-light)', overflow: 'hidden'
  },
  splitBtn: {
    width: '32px', background: 'var(--bg-panel)', color: 'var(--text-muted)',
    border: 'none', borderLeft: '1px solid var(--border-light)',
    cursor: 'pointer', fontSize: '16px', flexShrink: 0, transition: 'all 0.15s ease',
  },
  resizer: {
    width: '2px', background: 'var(--border-light)', cursor: 'col-resize', flexShrink: 0,
    transition: 'background 0.15s ease', zIndex: 10
  }
}

export default App
