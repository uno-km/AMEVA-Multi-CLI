import { create } from 'zustand'
import { nanoid } from 'nanoid'

export interface Pane {
  id: string
  title: string
}

export interface Tab {
  id: string
  title: string
  panes: Pane[]
  activePaneId: string
}

interface TabStore {
  tabs: Tab[]
  activeTabId: string
  addTab: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  addPane: (tabId: string) => void
  closePane: (tabId: string, paneId: string) => void
}

export const useTabStore = create<TabStore>((set) => ({
  tabs: [{ id: 'default', title: 'Terminal', panes: [{ id: 'pane-1', title: 'Terminal' }], activePaneId: 'pane-1' }],
  activeTabId: 'default',
  addTab: () => set((state) => {
    const newPaneId = nanoid()
    const newTabId = nanoid()
    const newTab: Tab = {
      id: newTabId,
      title: 'New Tab',
      panes: [{ id: newPaneId, title: 'Terminal' }],
      activePaneId: newPaneId
    }
    return { tabs: [...state.tabs, newTab], activeTabId: newTabId }
  }),
  closeTab: (id) => set((state) => {
    const newTabs = state.tabs.filter(t => t.id !== id)
    if (newTabs.length === 0) return { tabs: [], activeTabId: '' }
    if (state.activeTabId === id) return { tabs: newTabs, activeTabId: newTabs[0].id }
    return { tabs: newTabs }
  }),
  setActiveTab: (id) => set({ activeTabId: id }),
  addPane: (tabId) => set((state) => {
    const newTabs = state.tabs.map(t => {
      if (t.id === tabId) {
        const newPaneId = nanoid()
        return { ...t, panes: [...t.panes, { id: newPaneId, title: 'Terminal' }], activePaneId: newPaneId }
      }
      return t
    })
    return { tabs: newTabs }
  }),
  closePane: (tabId, paneId) => set((state) => {
    const newTabs = state.tabs.map(t => {
      if (t.id === tabId) {
        const newPanes = t.panes.filter(p => p.id !== paneId)
        return { ...t, panes: newPanes, activePaneId: newPanes.length > 0 ? newPanes[0].id : '' }
      }
      return t
    })
    return { tabs: newTabs }
  })
}))
