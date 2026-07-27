import { create } from 'zustand'
import { nanoid } from 'nanoid'

export interface Pane {
  id: string
  title: string
  cwd?: string
  weight?: number
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
  renameTab: (tabId: string, title: string) => void
  getActiveTab: () => Tab | undefined
  setPaneWeight: (tabId: string, paneId: string, weight: number) => void
}

const createDefaultTab = (): Tab => {
  const paneId = nanoid()
  return {
    id: nanoid(),
    title: 'Terminal',
    panes: [{ id: paneId, title: 'Terminal', weight: 1 }],
    activePaneId: paneId
  }
}

export const useTabStore = create<TabStore>((set, get) => {
  const initialTab = createDefaultTab()
  return {
    tabs: [initialTab],
    activeTabId: initialTab.id,

    addTab: () =>
      set((state) => {
        const newTab = createDefaultTab()
        return { tabs: [...state.tabs, newTab], activeTabId: newTab.id }
      }),

    closeTab: (id) =>
      set((state) => {
        const newTabs = state.tabs.filter((t) => t.id !== id)
        if (newTabs.length === 0) {
          // 탭이 0개가 되면 새 기본 탭을 자동 생성 (빈 탭으로 인한 크래시 방지)
          const fallback = createDefaultTab()
          return { tabs: [fallback], activeTabId: fallback.id }
        }
        const newActiveId =
          state.activeTabId === id ? newTabs[newTabs.length - 1].id : state.activeTabId
        return { tabs: newTabs, activeTabId: newActiveId }
      }),

    setActiveTab: (id) => set({ activeTabId: id }),

    addPane: (tabId) =>
      set((state) => {
        const newTabs = state.tabs.map((t) => {
          if (t.id === tabId) {
            const newPaneId = nanoid()
            return {
              ...t,
              panes: [...t.panes, { id: newPaneId, title: 'Terminal', weight: 1 }],
              activePaneId: newPaneId
            }
          }
          return t
        })
        return { tabs: newTabs }
      }),

    closePane: (tabId, paneId) =>
      set((state) => {
        const newTabs = state.tabs.map((t) => {
          if (t.id === tabId) {
            const newPanes = t.panes.filter((p) => p.id !== paneId)
            if (newPanes.length === 0) {
              // 패인이 0개가 되면 새 패인 자동 생성 (탭은 유지)
              const newPaneId = nanoid()
              return {
                ...t,
                panes: [{ id: newPaneId, title: 'Terminal', weight: 1 }],
                activePaneId: newPaneId
              }
            }
            const newActivePaneId =
              t.activePaneId === paneId ? newPanes[newPanes.length - 1].id : t.activePaneId
            return { ...t, panes: newPanes, activePaneId: newActivePaneId }
          }
          return t
        })
        return { tabs: newTabs }
      }),

    renameTab: (tabId, title) =>
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t))
      })),

    getActiveTab: () => {
      const { tabs, activeTabId } = get()
      return tabs.find((t) => t.id === activeTabId)
    },

    setPaneWeight: (tabId, paneId, weight) =>
      set((state) => ({
        tabs: state.tabs.map((t) => {
          if (t.id !== tabId) return t
          return {
            ...t,
            panes: t.panes.map((p) => (p.id === paneId ? { ...p, weight } : p))
          }
        })
      }))
  }
})
