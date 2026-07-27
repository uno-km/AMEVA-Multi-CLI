import { create } from 'zustand'
import { nanoid } from 'nanoid'

export type SplitDirection = 'horizontal' | 'vertical' // horizontal: left/right columns, vertical: top/bottom rows

export interface PaneNode {
  id: string
  type: 'pane' | 'split'
  title?: string
  cwd?: string
  direction?: SplitDirection
  children?: PaneNode[]
  weight?: number // relative size in flex layout
}

export interface Tab {
  id: string
  title: string
  rootNode: PaneNode
  activePaneId: string
}

interface TabStore {
  tabs: Tab[]
  activeTabId: string
  addTab: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setActivePane: (tabId: string, paneId: string) => void
  addPane: (tabId: string) => void
  splitPane: (tabId: string, targetPaneId: string, direction: SplitDirection, insertAfter?: boolean) => void
  movePane: (tabId: string, sourcePaneId: string, targetPaneId: string, direction: SplitDirection, insertAfter: boolean) => void
  closePane: (tabId: string, paneId: string) => void
  renameTab: (tabId: string, title: string) => void
  renamePane: (tabId: string, paneId: string, title: string) => void
  getActiveTab: () => Tab | undefined
  setPaneWeight: (tabId: string, nodeId: string, weight: number) => void
}

const createDefaultPane = (): PaneNode => ({
  id: nanoid(),
  type: 'pane',
  title: 'Terminal',
  weight: 1
})

const createDefaultTab = (): Tab => {
  const root = createDefaultPane()
  return {
    id: nanoid(),
    title: 'Terminal',
    rootNode: root,
    activePaneId: root.id
  }
}

// Tree Helpers
function removeNode(node: PaneNode, targetId: string): PaneNode | null {
  if (node.id === targetId) return null
  if (node.type === 'split' && node.children) {
    const newChildren = node.children
      .map(c => removeNode(c, targetId))
      .filter((c): c is PaneNode => c !== null)
    
    if (newChildren.length === 0) return null
    if (newChildren.length === 1) {
      return { ...newChildren[0], weight: node.weight }
    }
    return { ...node, children: newChildren }
  }
  return node
}

function splitNodeTree(node: PaneNode, targetId: string, direction: SplitDirection, insertAfter: boolean, newPane: PaneNode): PaneNode {
  if (node.id === targetId) {
    return {
      id: nanoid(),
      type: 'split',
      direction,
      weight: node.weight,
      children: insertAfter ? [{ ...node, weight: 1 }, newPane] : [newPane, { ...node, weight: 1 }]
    }
  }
  if (node.type === 'split' && node.children) {
    return {
      ...node,
      children: node.children.map(c => splitNodeTree(c, targetId, direction, insertAfter, newPane))
    }
  }
  return node
}

function updateNodeWeight(node: PaneNode, targetId: string, weight: number): PaneNode {
  if (node.id === targetId) {
    return { ...node, weight }
  }
  if (node.type === 'split' && node.children) {
    return {
      ...node,
      children: node.children.map(c => updateNodeWeight(c, targetId, weight))
    }
  }
  return node
}

function updateNodeTitle(node: PaneNode, targetId: string, title: string): PaneNode {
  if (node.id === targetId) {
    return { ...node, title }
  }
  if (node.type === 'split' && node.children) {
    return {
      ...node,
      children: node.children.map(c => updateNodeTitle(c, targetId, title))
    }
  }
  return node
}

function getAllPaneIds(node: PaneNode): string[] {
  if (node.type === 'pane') return [node.id]
  return node.children ? node.children.flatMap(getAllPaneIds) : []
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
          const fallback = createDefaultTab()
          return { tabs: [fallback], activeTabId: fallback.id }
        }
        const newActiveId =
          state.activeTabId === id ? newTabs[newTabs.length - 1].id : state.activeTabId
        return { tabs: newTabs, activeTabId: newActiveId }
      }),

    setActiveTab: (id) => set({ activeTabId: id }),

    setActivePane: (tabId, paneId) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === tabId)
        if (tab && tab.activePaneId === paneId) return state
        return {
          tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, activePaneId: paneId } : t))
        }
      }),

    addPane: (tabId) =>
      set((state) => {
        const newTabs = state.tabs.map((t) => {
          if (t.id === tabId) {
            const newPane = createDefaultPane()
            let newRoot = t.rootNode
            if (newRoot.type === 'split' && newRoot.direction === 'horizontal' && newRoot.children) {
              newRoot = { ...newRoot, children: [...newRoot.children, newPane] }
            } else {
              newRoot = {
                id: nanoid(),
                type: 'split',
                direction: 'horizontal',
                weight: newRoot.weight,
                children: [{ ...newRoot, weight: 1 }, newPane]
              }
            }
            return { ...t, rootNode: newRoot, activePaneId: newPane.id }
          }
          return t
        })
        return { tabs: newTabs }
      }),

    splitPane: (tabId, targetPaneId, direction, insertAfter = true) =>
      set((state) => {
        const newTabs = state.tabs.map((t) => {
          if (t.id === tabId) {
            const newPane = createDefaultPane()
            const newRoot = splitNodeTree(t.rootNode, targetPaneId, direction, insertAfter, newPane)
            return { ...t, rootNode: newRoot, activePaneId: newPane.id }
          }
          return t
        })
        return { tabs: newTabs }
      }),

    movePane: (tabId, sourcePaneId, targetPaneId, direction, insertAfter) =>
      set((state) => {
        const newTabs = state.tabs.map((t) => {
          if (t.id === tabId) {
            let sourcePane: PaneNode | null = null
            const findPane = (n: PaneNode): PaneNode | null => {
              if (n.id === sourcePaneId) return n
              if (n.type === 'split' && n.children) {
                for (const c of n.children) {
                  const found = findPane(c)
                  if (found) return found
                }
              }
              return null
            }
            sourcePane = findPane(t.rootNode)
            if (!sourcePane) return t

            let newRoot = removeNode(t.rootNode, sourcePaneId)
            if (!newRoot) return t
            newRoot = splitNodeTree(newRoot, targetPaneId, direction, insertAfter, { ...sourcePane, weight: 1 })
            return { ...t, rootNode: newRoot, activePaneId: sourcePaneId }
          }
          return t
        })
        return { tabs: newTabs }
      }),

    closePane: (tabId, paneId) =>
      set((state) => {
        const newTabs = state.tabs.map((t) => {
          if (t.id === tabId) {
            let newRoot = removeNode(t.rootNode, paneId)
            let newActiveId = t.activePaneId
            if (!newRoot) {
              newRoot = createDefaultPane()
              newActiveId = newRoot.id
            } else if (newActiveId === paneId) {
              const ids = getAllPaneIds(newRoot)
              newActiveId = ids.length > 0 ? ids[ids.length - 1] : newRoot.id
            }
            return { ...t, rootNode: newRoot, activePaneId: newActiveId }
          }
          return t
        })
        return { tabs: newTabs }
      }),

    renameTab: (tabId, title) =>
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t))
      })),

    renamePane: (tabId, paneId, title) =>
      set((state) => ({
        tabs: state.tabs.map((t) => {
          if (t.id !== tabId) return t
          return {
            ...t,
            rootNode: updateNodeTitle(t.rootNode, paneId, title)
          }
        })
      })),

    getActiveTab: () => {
      const { tabs, activeTabId } = get()
      return tabs.find((t) => t.id === activeTabId)
    },

    setPaneWeight: (tabId, nodeId, weight) =>
      set((state) => ({
        tabs: state.tabs.map((t) => {
          if (t.id !== tabId) return t
          return {
            ...t,
            rootNode: updateNodeWeight(t.rootNode, nodeId, weight)
          }
        })
      }))
  }
})
