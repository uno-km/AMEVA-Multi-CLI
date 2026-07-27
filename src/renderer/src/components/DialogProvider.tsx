import React, { createContext, useContext, useState, ReactNode } from 'react'

interface DialogState {
  isOpen: boolean
  type: 'confirm' | 'prompt'
  title: string
  message: string
  defaultValue?: string
  placeholder?: string
  multiline?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (value: any) => void
}

interface DialogContextProps {
  confirm: (title: string, message: string) => Promise<boolean>
  prompt: (title: string, message: string, defaultValue?: string, placeholder?: string, multiline?: boolean) => Promise<string | null>
}

const DialogContext = createContext<DialogContextProps | null>(null)

export const useDialog = () => {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within DialogProvider')
  return ctx
}

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [inputValue, setInputValue] = useState('')

  const confirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ isOpen: true, type: 'confirm', title, message, resolve })
    })
  }

  const prompt = (title: string, message: string, defaultValue = '', placeholder = '', multiline = false): Promise<string | null> => {
    return new Promise((resolve) => {
      setInputValue(defaultValue)
      setDialog({ isOpen: true, type: 'prompt', title, message, defaultValue, placeholder, multiline, resolve })
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClose = (value: any) => {
    if (dialog) {
      dialog.resolve(value)
      setDialog(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleClose(dialog?.type === 'prompt' ? inputValue : true)
  }

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      
      {dialog?.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => handleClose(dialog.type === 'prompt' ? null : false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '400px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>{dialog.title}</h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>{dialog.message}</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {dialog.type === 'prompt' && (
                dialog.multiline ? (
                  <textarea
                    autoFocus
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={dialog.placeholder}
                    style={{ 
                      width: '100%', boxSizing: 'border-box', 
                      minHeight: '120px', resize: 'vertical',
                      fontFamily: 'monospace', padding: '10px',
                      background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)',
                      border: '1px solid var(--border-light)', borderRadius: '4px'
                    }}
                  />
                ) : (
                  <input
                    autoFocus
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={dialog.placeholder}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                )
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleClose(dialog.type === 'prompt' ? null : false)}
                  style={cancelBtnStyle}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={dialog.type === 'confirm' ? dangerBtnStyle : primaryBtnStyle}
                >
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

const btnBase: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer'
}

const cancelBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: 'rgba(255,255,255,0.1)',
  color: 'var(--text-main)',
}

const primaryBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent)',
  color: '#fff',
}

const dangerBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--danger)',
  color: '#fff',
}
