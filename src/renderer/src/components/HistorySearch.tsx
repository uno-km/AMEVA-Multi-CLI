import React, { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  /** 선택된 명령어를 부모에게 전달 */
  onSelect: (command: string) => void
  /** 오버레이 닫기 */
  onClose: () => void
}

/**
 * Ctrl+R 히스토리 검색 오버레이.
 * 터미널 위에 플로팅되어 히스토리를 검색·선택하면 onSelect()로 명령어를 전달한다.
 */
export const HistorySearch: React.FC<Props> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<HistoryItem[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // 포커스
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 쿼리 변경 시 히스토리 검색
  useEffect(() => {
    const load = query.trim()
      ? window.api.db.searchHistory(query)
      : window.api.db.getHistory()
    load
      .then((result) => {
        setItems(result)
        setSelectedIdx(0)
      })
      .catch(console.error)
  }, [query])

  // 선택 인덱스가 범위를 벗어나지 않도록
  const safeIdx = Math.min(selectedIdx, Math.max(0, items.length - 1))

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIdx((i) => Math.min(i + 1, items.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIdx((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (items[safeIdx]) {
            onSelect(items[safeIdx].command)
          }
          break
        default:
          break
      }
    },
    [items, safeIdx, onClose, onSelect]
  )

  return (
    // 배경 오버레이 - 바깥 클릭 시 닫힘
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '48px',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
        animation: 'overlayShow 0.15s ease forwards'
      }}
    >
      {/* 검색 패널 - 클릭 이벤트 전파 차단 */}
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '90%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease forwards'
        }}
      >
        {/* 검색창 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-light)'
          }}
        >
          <span style={{ color: 'var(--accent)', fontSize: '16px' }}>⟳</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="히스토리 검색... (↑↓ 이동, Enter 선택, Esc 닫기)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '14px',
              fontFamily: '"Fira Code", monospace'
            }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>
            {items.length}개
          </span>
        </div>

        {/* 결과 목록 */}
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div
              style={{
                padding: '24px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                fontSize: '13px'
              }}
            >
              {query ? '검색 결과 없음' : '히스토리 없음'}
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => onSelect(item.command)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: idx === safeIdx ? 'var(--border-focus)' : 'transparent',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-light)',
                  transition: 'background 0.1s ease'
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <span
                  style={{
                    color: idx === safeIdx ? '#fff' : 'var(--text-main)',
                    fontFamily: '"Fira Code", monospace',
                    fontSize: '13px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                >
                  <span style={{ color: 'var(--accent)', marginRight: '8px' }}>$</span>
                  {item.command}
                </span>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    flexShrink: 0,
                    marginLeft: '16px'
                  }}
                >
                  {new Date(item.startedAt).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))
          )}
        </div>

        {/* 하단 힌트 */}
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--bg-sidebar)',
            color: 'var(--text-muted)',
            fontSize: '11px',
            display: 'flex',
            gap: '16px'
          }}
        >
          <span><kbd style={kbdStyle}>↑↓</kbd> 이동</span>
          <span><kbd style={kbdStyle}>Enter</kbd> 선택</span>
          <span><kbd style={kbdStyle}>Esc</kbd> 닫기</span>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-light)',
  borderRadius: '4px',
  padding: '2px 6px',
  fontFamily: 'monospace',
  fontSize: '10px',
  color: 'var(--text-main)'
}
