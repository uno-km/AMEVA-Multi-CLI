import { AppDatabase } from '../Database'

export class SessionRepository {
  constructor(private db: AppDatabase) {
    this.db.getDb().exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        data TEXT,
        updatedAt TEXT
      );
    `)
  }

  saveSession(id: string, data: any): void {
    const stmt = this.db.getDb().prepare(`
      INSERT INTO sessions (id, data, updatedAt)
      VALUES (@id, @data, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updatedAt=excluded.updatedAt
    `)
    stmt.run({ id, data: JSON.stringify(data), updatedAt: new Date().toISOString() })
  }

  getSession(id: string): any | null {
    const stmt = this.db.getDb().prepare('SELECT data FROM sessions WHERE id = ?')
    const row = stmt.get(id) as { data: string } | undefined
    return row ? JSON.parse(row.data) : null
  }
}
