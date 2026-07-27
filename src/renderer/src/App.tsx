import React, { useEffect, useState, useCallback, useRef } from 'react'
import { SettingsModal } from './components/SettingsModal'
import { useDialog } from './components/DialogProvider'
import { useTabStore, type Tab, type PaneNode } from './stores/tabStore'
import { PaneRenderer } from './components/PaneRenderer'
import { nanoid } from 'nanoid'

// ─────────────────────────────────────────────────────────────────────────────
// 타입 가드 및 헬퍼
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
        typeof (t as Tab).rootNode === 'object'
    )
  )
}

function refreshNodeIds(node: any): any {
  if (!node) return node
  if (node.type === 'pane') {
    return { ...node, id: nanoid() }
  }
  if (node.type === 'split' && node.children) {
    return {
      ...node,
      id: nanoid(),
      children: node.children.map(refreshNodeIds)
    }
  }
  return { ...node, id: nanoid() }
}

function getFirstPaneId(node: any): string {
  if (node.type === 'pane') return node.id
  if (node.children && node.children.length > 0) return getFirstPaneId(node.children[0])
  return nanoid()
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
type SidebarTab = 'bookmarks' | 'history' | 'snapshots'

function App(): JSX.Element {
  const { tabs, activeTabId, addTab, setActiveTab, closeTab } = useTabStore()
  const { confirm, prompt } = useDialog()

  // 북마크
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  // 히스토리
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  // 스냅샷 (기존 워크스페이스)
  const [snapshots, setSnapshots] = useState<Workspace[]>([])
  // 사이드바
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('bookmarks')
  // 설정
  const [settings, setSettings] = useState<AppSettings>({ fontSize: 14, fontFamily: '', theme: 'dark', cursorBlink: true, scrollback: 5000 })
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 세션 저장 debounce 타이머
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 초기 로드 ──
  useEffect(() => {
    // 세션 복원
    window.api.db
      .getSession('default')
      .then((savedTabs) => {
        if (isValidTabArray(savedTabs)) {
          const freshTabs = savedTabs.map((tab) => {
            const freshRoot = refreshNodeIds(tab.rootNode)
            const freshActivePaneId = getFirstPaneId(freshRoot)
            return { ...tab, id: nanoid(), rootNode: freshRoot, activePaneId: freshActivePaneId }
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

    // 스냅샷 로드
    window.api.db
      .getWorkspaces()
      .then(setSnapshots)
      .catch((err) => console.error('[App] Failed to load snapshots:', err))

    // 설정 로드
    window.api.db
      .getSettings()
      .then((s) => {
        if (s) setSettings(s)
      })
      .catch((err) => console.error('[App] Failed to load settings:', err))
  }, [])

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

  // ── 새로고침 기본 동작 막기 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isF5 = e.key === 'F5'
      const isCtrlR = e.ctrlKey && e.key.toLowerCase() === 'r'
      const isCtrlShiftR = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r'
      
      if (isF5 || isCtrlR || isCtrlShiftR) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // 북마크 핸들러 (현재 활성화된 터미널에서 실행되도록 수정)
  // ─────────────────────────────────────────────────────────────────────────
  const handleAddBookmark = useCallback(async () => {
    const name = await prompt('명령어 묶음 추가', '북마크 이름 (예: 빌드 & 배포):', '새 명령어 묶음')
    if (!name?.trim()) return
    const command = await prompt('명령어 입력', '실행할 명령어 (여러 개는 && 로 연결하거나 개행 가능):', 'npm run build && echo "Done"')
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
      const activeTab = tabs.find((t) => t.id === activeTabId)
      if (!activeTab || !activeTab.activePaneId) return
      
      // 명령어 문자열의 실제 줄바꿈을 CR로 변환하여 전송 (여러 줄 명령어 대응)
      const formattedCommand = b.command.replace(/\n/g, '\r') + '\r'
      window.api.terminal.write(activeTab.activePaneId, formattedCommand)
    },
    [tabs, activeTabId]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // 히스토리 핸들러
  // ─────────────────────────────────────────────────────────────────────────
  const handleRunHistory = useCallback(
    (item: HistoryItem) => {
      const activeTab = tabs.find((t) => t.id === activeTabId)
      if (!activeTab || !activeTab.activePaneId) return
      window.api.terminal.write(activeTab.activePaneId, item.command + '\r')
    },
    [tabs, activeTabId]
  )

  const handleClearHistory = useCallback(async () => {
    if (!(await confirm('히스토리 전체 삭제', '히스토리를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'))) return
    window.api.db.clearHistory()
    setHistory([])
  }, [confirm])

  // ─────────────────────────────────────────────────────────────────────────
  // 스냅샷(워크스페이스) 핸들러
  // ─────────────────────────────────────────────────────────────────────────
  const handleSaveSnapshot = useCallback(async () => {
    const name = await prompt('스냅샷 저장', '현재 터미널 분할 레이아웃을 저장할 이름을 입력하세요:', '내 레이아웃 스냅샷')
    if (!name?.trim()) return
    const ws: Workspace = {
      id: nanoid(),
      name: name.trim(),
      layout: {
        tabs: tabs.map((tab) => ({
          id: tab.id,
          title: tab.title,
          rootNode: tab.rootNode
        }))
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    window.api.db.saveWorkspace(ws)
    setSnapshots((prev) => [ws, ...prev])
  }, [tabs, prompt])

  const handleRestoreSnapshot = useCallback(async (ws: Workspace) => {
    if (!(await confirm('스냅샷 복원', `"${ws.name}" 스냅샷을 복원하시겠습니까?\n현재 열려있는 모든 탭이 닫히고 덮어씌워집니다.`))) return
    const freshTabs: Tab[] = ws.layout.tabs.map((wt) => {
      const freshRoot = refreshNodeIds(wt.rootNode)
      const freshActivePaneId = getFirstPaneId(freshRoot)
      return { id: nanoid(), title: wt.title, rootNode: freshRoot, activePaneId: freshActivePaneId }
    })
    if (freshTabs.length === 0) return
    useTabStore.setState({ tabs: freshTabs, activeTabId: freshTabs[0].id })
  }, [confirm])

  const handleDeleteSnapshot = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!(await confirm('스냅샷 삭제', '이 스냅샷을 삭제하시겠습니까?'))) return
    window.api.db.deleteWorkspace(id)
    setSnapshots((prev) => prev.filter((w) => w.id !== id))
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
          onClick={() => window.location.reload()}
          style={styles.iconBtn}
          title="강력 새로고침"
        >
          ↻
        </button>
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
              {(['bookmarks', 'history', 'snapshots'] as SidebarTab[]).map((t) => (
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
                  {t === 'bookmarks' ? '★ 북마크' : t === 'history' ? '⟳ 히스토리' : '⊞ 스냅샷'}
                </button>
              ))}
            </div>

            {/* ── 북마크 패널 ── */}
            {sidebarTab === 'bookmarks' && (
              <div style={styles.sidebarPanel}>
                <div style={styles.sidebarPanelHeader}>
                  <span style={styles.sidebarPanelTitle}>명령어 북마크</span>
                  <button onClick={handleAddBookmark} style={styles.addBtn} title="북마크 추가">+</button>
                </div>
                <div style={styles.listScroll}>
                  {bookmarks.length === 0 ? (
                    <div style={styles.emptyMsg}>
                      북마크 없음<br />
                      <span style={{ fontSize: '11px', color: '#555' }}>더블클릭으로 현재 패인에서 실행</span>
                    </div>
                  ) : (
                    bookmarks.map((b) => (
                      <div
                        key={b.id}
                        onDoubleClick={() => handleRunBookmark(b)}
                        title={`더블클릭으로 현재 패인에서 실행\n$ ${b.command}`}
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

            {/* ── 스냅샷 패널 ── */}
            {sidebarTab === 'snapshots' && (
              <div style={styles.sidebarPanel}>
                <div style={styles.sidebarPanelHeader}>
                  <span style={styles.sidebarPanelTitle}>레이아웃 스냅샷</span>
                  <button onClick={handleSaveSnapshot} style={styles.addBtn} title="현재 레이아웃 저장">저장</button>
                </div>
                <div style={styles.listScroll}>
                  {snapshots.length === 0 ? (
                    <div style={styles.emptyMsg}>
                      스냅샷 없음<br />
                      <span style={{ fontSize: '11px', color: '#555' }}>분할된 화면을 그대로 저장해보세요!</span>
                    </div>
                  ) : (
                    snapshots.map((ws) => (
                      <div
                        key={ws.id}
                        onDoubleClick={() => handleRestoreSnapshot(ws)}
                        title={`더블클릭으로 복원\n저장: ${new Date(ws.updatedAt).toLocaleDateString('ko-KR')}`}
                        style={styles.listItem}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={styles.listItemText}>⊞ {ws.name}</div>
                          <div style={{ fontSize: '10px', color: '#555' }}>
                            {new Date(ws.updatedAt).toLocaleDateString('ko-KR')}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSnapshot(ws.id, e)}
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

        {/* ── 트리 기반 패인 렌더링 영역 ── */}
        <div style={styles.paneArea}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                width: '100%',
                height: '100%',
                display: tab.id === activeTabId ? 'flex' : 'none',
              }}
            >
              <PaneRenderer
                tabId={tab.id}
                node={tab.rootNode}
                activePaneId={tab.activePaneId}
                settings={settings}
              />
            </div>
          ))}
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
  paneArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }
}

export default App
