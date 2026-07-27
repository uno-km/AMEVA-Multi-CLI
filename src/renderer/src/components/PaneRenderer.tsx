import React, { useState, useRef, useEffect, useCallback } from 'react'
import { TerminalView } from './TerminalView'
import { PaneNode, useTabStore, SplitDirection } from '../stores/tabStore'

interface Props {
  tabId: string
  node: PaneNode
  settings: any
}

// activePaneId를 prop으로 받지 않고 각 leaf pane이 직접 구독
// → 클릭 시 변경된 pane 딱 2개(이전 활성 + 새 활성)만 re-render
export const PaneRenderer: React.FC<Props> = React.memo(({ tabId, node, settings }) => {
  const { setActivePane, closePane, setPaneWeight, movePane, splitPane } = useTabStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const [resizing, setResizing] = useState<{
    index: number; startPos: number; prevW: number; nextW: number
  } | null>(null)

  const tempWeightRef = useRef<{ prevW: number; nextW: number } | null>(null)

  useEffect(() => {
    if (!resizing || !containerRef.current || node.type !== 'split' || !node.children) return

    const isRow = node.direction === 'horizontal'

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      if (!containerRef.current) return
      const delta = isRow ? e.clientX - resizing.startPos : e.clientY - resizing.startPos
      const totalSize = isRow ? containerRef.current.clientWidth : containerRef.current.clientHeight
      
      const totalWeight = node.children!.reduce((sum, c) => sum + (c.weight ?? 1), 0)
      const weightDelta = (delta / totalSize) * totalWeight

      const newPrevW = Math.max(0.1, resizing.prevW + weightDelta)
      const newNextW = Math.max(0.1, resizing.nextW - weightDelta)

      const childPrevNode = containerRef.current.children[resizing.index * 2] as HTMLElement
      const childNextNode = containerRef.current.children[(resizing.index + 1) * 2] as HTMLElement
      
      if (childPrevNode) childPrevNode.style.flex = String(newPrevW)
      if (childNextNode) childNextNode.style.flex = String(newNextW)

      tempWeightRef.current = { prevW: newPrevW, nextW: newNextW }
    }

    const handleMouseUp = () => {
      if (tempWeightRef.current) {
        const childPrev = node.children![resizing.index]
        const childNext = node.children![resizing.index + 1]
        setPaneWeight(tabId, childPrev.id, tempWeightRef.current.prevW)
        setPaneWeight(tabId, childNext.id, tempWeightRef.current.nextW)
      }
      setResizing(null)
      tempWeightRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, tabId, node, setPaneWeight])

  if (node.type === 'split' && node.children) {
    const isRow = node.direction === 'horizontal'
    return (
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: isRow ? 'row' : 'column',
          flex: node.weight ?? 1,
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {node.children.map((child, i) => (
          <React.Fragment key={child.id}>
            <PaneRenderer tabId={tabId} node={child} settings={settings} />
            {i < node.children!.length - 1 && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault()
                  setResizing({
                    index: i,
                    startPos: isRow ? e.clientX : e.clientY,
                    prevW: node.children![i].weight ?? 1,
                    nextW: node.children![i+1].weight ?? 1
                  })
                }}
                style={{
                  [isRow ? 'width' : 'height']: '8px',
                  background: resizing?.index === i ? 'var(--accent)' : 'var(--border-light)',
                  cursor: isRow ? 'col-resize' : 'row-resize',
                  zIndex: 10,
                  flexShrink: 0
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  // Leaf pane: activePaneId를 Zustand selector로 직접 구독
  // → 이 pane의 활성 여부가 바뀔 때만 이 컴포넌트가 re-render됨
  return <LeafPane tabId={tabId} node={node} settings={settings} closePane={closePane} splitPane={splitPane} movePane={movePane} />
})

// LeafPane을 별도 컴포넌트로 분리해서 selector 구독 격리
interface LeafPaneProps {
  tabId: string
  node: PaneNode
  settings: any
  closePane: (tabId: string, paneId: string) => void
  splitPane: (tabId: string, targetPaneId: string, direction: SplitDirection, insertAfter?: boolean) => void
  movePane: (tabId: string, sourcePaneId: string, targetPaneId: string, direction: SplitDirection, insertAfter: boolean) => void
}

const LeafPane: React.FC<LeafPaneProps> = React.memo(({ tabId, node, settings, closePane, splitPane, movePane }) => {
  // 이 pane의 isActive 여부만 구독 → 다른 pane 변경은 무시
  const isActive = useTabStore(s => s.tabs.find(t => t.id === tabId)?.activePaneId === node.id)

  return (
    <div className={`pane-leaf${isActive ? ' pane-active' : ''}`}>
      {/* 탭 헤더 */}
      <div
        className="pane-header"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', node.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
      >
        <span style={{ flex: 1 }}>{node.title || 'Terminal'}</span>
        <button
          onClick={() => splitPane(tabId, node.id, 'horizontal', true)}
          style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', marginRight: '6px' }}
          title="오른쪽으로 분할"
        >
          ◨
        </button>
        <button
          onClick={() => splitPane(tabId, node.id, 'vertical', true)}
          style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', marginRight: '6px' }}
          title="아래로 분할"
        >
          ⬒
        </button>
        <button
          onClick={() => closePane(tabId, node.id)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '16px'
          }}
          title="닫기"
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <TerminalView
          paneId={node.id}
          tabId={tabId}
          settings={settings}
        />
        <DropZones tabId={tabId} paneId={node.id} movePane={movePane} />
      </div>
    </div>
  )
})

const DropZones: React.FC<{
  tabId: string,
  paneId: string,
  movePane: (tId: string, sId: string, pId: string, dir: SplitDirection, after: boolean) => void
}> = ({ tabId, paneId, movePane }) => {
  const [dragOver, setDragOver] = useState<'top'|'bottom'|'left'|'right'|null>(null)

  const handleDragOver = (e: React.DragEvent, zone: 'top'|'bottom'|'left'|'right') => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(zone)
  }

  const handleDrop = (e: React.DragEvent, zone: 'top'|'bottom'|'left'|'right') => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const sourcePaneId = e.dataTransfer.getData('text/plain')
    if (!sourcePaneId || sourcePaneId === paneId) return

    const direction: SplitDirection = (zone === 'left' || zone === 'right') ? 'horizontal' : 'vertical'
    const insertAfter = zone === 'right' || zone === 'bottom'

    movePane(tabId, sourcePaneId, paneId, direction, insertAfter)
  }

  const zoneStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 20,
  }
  const highlight = 'rgba(0, 122, 204, 0.3)'

  return (
    <>
      <div
        onDragOver={(e) => handleDragOver(e, 'top')}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => handleDrop(e, 'top')}
        style={{ ...zoneStyle, top: 0, left: 0, right: 0, height: '25%', background: dragOver === 'top' ? highlight : 'transparent' }}
      />
      <div
        onDragOver={(e) => handleDragOver(e, 'bottom')}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => handleDrop(e, 'bottom')}
        style={{ ...zoneStyle, bottom: 0, left: 0, right: 0, height: '25%', background: dragOver === 'bottom' ? highlight : 'transparent' }}
      />
      <div
        onDragOver={(e) => handleDragOver(e, 'left')}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => handleDrop(e, 'left')}
        style={{ ...zoneStyle, top: '25%', bottom: '25%', left: 0, width: '25%', background: dragOver === 'left' ? highlight : 'transparent' }}
      />
      <div
        onDragOver={(e) => handleDragOver(e, 'right')}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => handleDrop(e, 'right')}
        style={{ ...zoneStyle, top: '25%', bottom: '25%', right: 0, width: '25%', background: dragOver === 'right' ? highlight : 'transparent' }}
      />
    </>
  )
}
