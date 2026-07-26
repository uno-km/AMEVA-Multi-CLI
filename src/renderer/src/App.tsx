import React from 'react'
import { TerminalView } from './components/TerminalView'
import { useTabStore } from './stores/tabStore'

function App(): JSX.Element {
  const { tabs, activeTabId, addTab, setActiveTab, closeTab, addPane } = useTabStore()
  const activeTab = tabs.find(t => t.id === activeTabId)

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
  )
}

export default App

