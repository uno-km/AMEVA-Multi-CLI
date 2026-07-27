import { AppDatabase } from '../Database'

export interface Bookmark {
  id: string
  name: string
  type: string
  command: string
  createdAt: string
}

export class BookmarkRepository {
  constructor(private db: AppDatabase) {}

  getAll(): Bookmark[] {
    const stmt = this.db.getDb().prepare('SELECT * FROM bookmarks ORDER BY createdAt DESC')
    return stmt.all() as Bookmark[]
  }

  add(bookmark: Bookmark): void {
    const stmt = this.db.getDb().prepare(`
      INSERT INTO bookmarks (id, name, type, command, createdAt)
      VALUES (@id, @name, @type, @command, @createdAt)
      ON CONFLICT(id) DO NOTHING
    `)
    stmt.run(bookmark)
  }

  delete(id: string): void {
    const stmt = this.db.getDb().prepare('DELETE FROM bookmarks WHERE id = ?')
    stmt.run(id)
  }
}
