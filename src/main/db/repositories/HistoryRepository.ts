import { AppDatabase } from '../Database'
import { SecretMasker } from '../../security/SecretMasker'

export interface HistoryItem {
  id: string
  command: string
  startedAt: string
  tags: string
}

export class HistoryRepository {
  constructor(private db: AppDatabase) {}

  getAll(limit = 200): HistoryItem[] {
    const stmt = this.db
      .getDb()
      .prepare('SELECT * FROM history ORDER BY startedAt DESC LIMIT ?')
    return stmt.all(limit) as HistoryItem[]
  }

  search(query: string, limit = 50): HistoryItem[] {
    const stmt = this.db
      .getDb()
      .prepare('SELECT * FROM history WHERE command LIKE ? ORDER BY startedAt DESC LIMIT ?')
    return stmt.all(`%${query}%`, limit) as HistoryItem[]
  }

  add(item: HistoryItem): void {
    const maskedCommand = SecretMasker.mask(item.command)
    // 동일한 명령어가 연속으로 들어오면 중복 저장하지 않음
    const last = this.db
      .getDb()
      .prepare('SELECT command FROM history ORDER BY startedAt DESC LIMIT 1')
      .get() as { command: string } | undefined
    if (last && last.command === maskedCommand) return

    const stmt = this.db.getDb().prepare(`
      INSERT INTO history (id, command, startedAt, tags)
      VALUES (@id, @command, @startedAt, @tags)
    `)
    stmt.run({ ...item, command: maskedCommand })
  }

  clear(): void {
    this.db.getDb().exec('DELETE FROM history')
  }
}
