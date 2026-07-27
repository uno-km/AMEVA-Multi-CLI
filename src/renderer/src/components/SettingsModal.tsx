import React, { useState, useEffect } from 'react'

interface Props {
  settings: AppSettings
  onClose: () => void
  onSave: (settings: AppSettings) => void
}

export const SettingsModal: React.FC<Props> = ({ settings, onClose, onSave }) => {
  const [draft, setDraft] = useState<AppSettings>(settings)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(draft)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '400px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)', fontWeight: 600 }}>설정 (Settings)</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <label style={labelStyle}>
            폰트 크기 (px)
            <input
              type="number"
              value={draft.fontSize}
              onChange={(e) => setDraft({ ...draft, fontSize: Number(e.target.value) })}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            폰트 패밀리
            <input
              type="text"
              value={draft.fontFamily}
              onChange={(e) => setDraft({ ...draft, fontFamily: e.target.value })}
              style={inputStyle}
              placeholder="'Fira Code', monospace"
            />
          </label>

          <label style={labelStyle}>
            테마
            <select
              value={draft.theme}
              onChange={(e) => setDraft({ ...draft, theme: e.target.value as 'dark' | 'light' })}
              style={inputStyle}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={draft.cursorBlink}
              onChange={(e) => setDraft({ ...draft, cursorBlink: e.target.checked })}
            />
            커서 깜빡임
          </label>

          <label style={labelStyle}>
            스크롤백 (줄 수)
            <input
              type="number"
              value={draft.scrollback}
              onChange={(e) => setDraft({ ...draft, scrollback: Number(e.target.value) })}
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>취소</button>
            <button type="submit" style={saveBtnStyle}>저장</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  color: 'var(--text-muted)',
  fontSize: '13px',
  fontWeight: 500
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(0, 0, 0, 0.2)',
  border: '1px solid var(--glass-border)',
  color: 'var(--text-main)',
  borderRadius: '6px',
  outline: 'none',
  fontSize: '13px'
}

const btnBase: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  border: 'none'
}

const cancelBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: 'rgba(255,255,255,0.1)',
  color: 'var(--text-main)'
}

const saveBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent)',
  color: '#fff'
}
