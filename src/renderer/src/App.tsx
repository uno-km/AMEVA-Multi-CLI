import React, { useEffect, useState } from 'react'
import { TerminalView } from './components/TerminalView'
import { useTabStore } from './stores/tabStore'
import { nanoid } from 'nanoid'

function App(): JSX.Element {
  const { tabs, activeTabId, addTab, setActiveTab, closeTab, addPane } = useTabStore()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const [bookmarks, setBookmarks] = useState<any[]>([])

  useEffect(() => {
    // Load session
    // @ts-ignore
    window.api.db.getSession('default').then(savedTabs => {
      if (savedTabs && savedTabs.length > 0) {
        useTabStore.setState({ tabs: savedTabs, activeTabId: savedTabs[0].id })
      }
    })

    // Load bookmarks
    // @ts-ignore
    window.api.db.getBookmarks().then(setBookmarks)
  }, [])

  useEffect(() => {
    // Save session on change
    if (tabs.length > 0) {
      // @ts-ignore
      window.api.db.saveSession('default', tabs)
    }
  }, [tabs])

  const handleAddBookmark = () => {
    const b = { id: nanoid(), name: 'New Bookmark', type: 'local', command: 'echo hello', createdAt: new Date().toISOString() }
    // @ts-ignore
    window.api.db.addBookmark(b)
    setBookmarks([b, ...bookmarks])
  }

  const handleRunBookmark = (b: any) => {
    const newPaneId = nanoid()
    if (tabs.length === 0) {
      const newTabId = nanoid()
      useTabStore.setState({ tabs: [{ id: newTabId, title: 'Bookmark', panes: [{ id: newPaneId, title: b.name }], activePaneId: newPaneId }], activeTabId: newTabId })
    } else {
      const activeTab = tabs.find(t => t.id === activeTabId)
      if (activeTab) {
        const newTabs = tabs.map(t => t.id === activeTab.id ? { ...t, panes: [...t.panes, { id: newPaneId, title: b.name }], activePaneId: newPaneId } : t)
        useTabStore.setState({ tabs: newTabs })
      }
    }
    // Give time for TerminalView to mount, then write the command
    setTimeout(() => {
      // @ts-ignore
      window.api.terminal.write(newPaneId, b.command + '\r')
    }, 500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', margin: 0, padding: 0 }}>
      {/* Title / Tab bar */}
      <div style={{ display: 'flex', background: '#222', borderBottom: '1px solid #444', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '8px 16px', background: tab.id === activeTabId ? '#444' : '#222', color: 'white', cursor: 'pointer', borderRight: '1px solid #444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{tab.title}</span>
            <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>x</button>
          </div>
        ))}
        <button onClick={addTab} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>+ New Tab</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: '200px', background: '#1e1e1e', borderRight: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px', background: '#333', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
            Bookmarks
            <button onClick={handleAddBookmark} style={{ background: '#555', color: 'white', border: 'none', cursor: 'pointer' }}>+</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', color: '#ccc' }}>
            {bookmarks.map(b => (
              <div key={b.id} onDoubleClick={() => handleRunBookmark(b)} style={{ padding: '5px', borderBottom: '1px solid #333', cursor: 'pointer' }}>
                {b.name}
              </div>
            ))}
          </div>
        </div>
        {/* Pane Area */}
        <div style={{ flex: 1, display: 'flex', background: '#000' }}>
          {activeTab && activeTab.panes.map(pane => (
            <div key={pane.id} style={{ flex: 1, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '4px', background: '#333', color: 'white', fontSize: '12px' }}>{pane.title}</div>
              <div style={{ flex: 1 }}>
                <TerminalView key={pane.id} />
              </div>
            </div>
          ))}
          {activeTab && activeTab.panes.length > 0 && (
            <button onClick={() => addPane(activeTab.id)} style={{ width: '40px', background: '#222', color: 'white', border: 'none', cursor: 'pointer' }}>+</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

