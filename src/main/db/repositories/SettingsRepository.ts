import { AppDatabase } from '../Database'

export interface AppSettings {
  fontSize: number
  fontFamily: string
  theme: 'dark' | 'light'
  cursorBlink: boolean
  scrollback: number
  shellOverride?: string
}

const DEFAULTS: AppSettings = {
  fontSize: 14,
  fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
  theme: 'dark',
  cursorBlink: true,
  scrollback: 5000
}

export class SettingsRepository {
  constructor(private db: AppDatabase) {
    this.ensureDefaults()
  }

  private ensureDefaults(): void {
    const insert = this.db.getDb().prepare(`
      INSERT OR IGNORE INTO settings (key, value) VALUES (@key, @value)
    `)
    const insertMany = this.db.getDb().transaction((entries: Array<{ key: string; value: string }>) => {
      for (const e of entries) insert.run(e)
    })
    insertMany(
      Object.entries(DEFAULTS).map(([key, value]) => ({
        key,
        value: JSON.stringify(value)
      }))
    )
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    const stmt = this.db.getDb().prepare('SELECT value FROM settings WHERE key = ?')
    const row = stmt.get(key) as { value: string } | undefined
    if (!row) return DEFAULTS[key]
    try {
      return JSON.parse(row.value) as AppSettings[K]
    } catch {
      return DEFAULTS[key]
    }
  }

  getAll(): AppSettings {
    const stmt = this.db.getDb().prepare('SELECT key, value FROM settings')
    const rows = stmt.all() as Array<{ key: string; value: string }>
    const result = { ...DEFAULTS }
    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, row.key)) {
        try {
          ;(result as Record<string, unknown>)[row.key] = JSON.parse(row.value)
        } catch {
          // keep default
        }
      }
    }
    return result
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    const stmt = this.db.getDb().prepare(`
      INSERT INTO settings (key, value) VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `)
    stmt.run({ key, value: JSON.stringify(value) })
  }

  setAll(settings: Partial<AppSettings>): void {
    const setMany = this.db.getDb().transaction((entries: Array<{ key: string; value: string }>) => {
      const stmt = this.db.getDb().prepare(`
        INSERT INTO settings (key, value) VALUES (@key, @value)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
      `)
      for (const e of entries) stmt.run(e)
    })
    setMany(
      Object.entries(settings).map(([key, value]) => ({
        key,
        value: JSON.stringify(value)
      }))
    )
  }
}
