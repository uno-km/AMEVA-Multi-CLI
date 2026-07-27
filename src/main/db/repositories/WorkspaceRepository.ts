import { AppDatabase } from '../Database'

export interface Workspace {
  id: string
  name: string
  layout: WorkspaceLayout
  createdAt: string
  updatedAt: string
}

export interface WorkspaceLayout {
  tabs: WorkspaceTab[]
}

export interface WorkspaceTab {
  id: string
  title: string
  rootNode: any
}

export interface WorkspacePane {
  id: string
  title: string
  cwd?: string
  bookmarkId?: string
}

export class WorkspaceRepository {
  constructor(private db: AppDatabase) {}

  getAll(): Workspace[] {
    const stmt = this.db
      .getDb()
      .prepare('SELECT * FROM workspaces ORDER BY updatedAt DESC')
    const rows = stmt.all() as Array<{ id: string; name: string; layout: string; createdAt: string; updatedAt: string }>
    return rows.map((r) => ({
      ...r,
      layout: this.parseLayout(r.layout)
    }))
  }

  getById(id: string): Workspace | null {
    const stmt = this.db.getDb().prepare('SELECT * FROM workspaces WHERE id = ?')
    const row = stmt.get(id) as { id: string; name: string; layout: string; createdAt: string; updatedAt: string } | undefined
    if (!row) return null
    return { ...row, layout: this.parseLayout(row.layout) }
  }

  save(workspace: Workspace): void {
    const now = new Date().toISOString()
    const stmt = this.db.getDb().prepare(`
      INSERT INTO workspaces (id, name, layout, createdAt, updatedAt)
      VALUES (@id, @name, @layout, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        layout=excluded.layout,
        updatedAt=excluded.updatedAt
    `)
    stmt.run({
      id: workspace.id,
      name: workspace.name,
      layout: JSON.stringify(workspace.layout),
      createdAt: workspace.createdAt || now,
      updatedAt: now
    })
  }

  delete(id: string): void {
    const stmt = this.db.getDb().prepare('DELETE FROM workspaces WHERE id = ?')
    stmt.run(id)
  }

  private parseLayout(raw: string): WorkspaceLayout {
    try {
      return JSON.parse(raw) as WorkspaceLayout
    } catch {
      console.error('[WorkspaceRepository] Failed to parse layout JSON')
      return { tabs: [] }
    }
  }
}
