import { AppDatabase } from '../Database'

export class SessionRepository {
  constructor(private db: AppDatabase) {}

  saveSession<T>(id: string, data: T): void {
    const stmt = this.db.getDb().prepare(`
      INSERT INTO sessions (id, data, updatedAt)
      VALUES (@id, @data, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updatedAt=excluded.updatedAt
    `)
    stmt.run({ id, data: JSON.stringify(data), updatedAt: new Date().toISOString() })
  }

  getSession<T>(id: string): T | null {
    const stmt = this.db.getDb().prepare('SELECT data FROM sessions WHERE id = ?')
    const row = stmt.get(id) as { data: string } | undefined
    if (!row) return null
    try {
      return JSON.parse(row.data) as T
    } catch {
      console.error(`[SessionRepository] Failed to parse session data for id="${id}"`)
      return null
    }
  }

  deleteSession(id: string): void {
    const stmt = this.db.getDb().prepare('DELETE FROM sessions WHERE id = ?')
    stmt.run(id)
  }
}
