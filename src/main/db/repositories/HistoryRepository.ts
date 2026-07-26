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

  getAll(): HistoryItem[] {
    const stmt = this.db.getDb().prepare('SELECT * FROM history ORDER BY startedAt DESC LIMIT 100')
    return stmt.all() as HistoryItem[]
  }

  add(item: HistoryItem): void {
    const maskedCommand = SecretMasker.mask(item.command)
    const stmt = this.db.getDb().prepare(`
      INSERT INTO history (id, command, startedAt, tags)
      VALUES (@id, @command, @startedAt, @tags)
    `)
    stmt.run({ ...item, command: maskedCommand })
  }
}
