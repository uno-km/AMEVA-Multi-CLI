import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'

export class AppDatabase {
  private db: Database.Database

  constructor() {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'ameva-multi-cli.sqlite')
    this.db = new Database(dbPath)
    // WAL 모드 활성화: 읽기/쓰기 동시성 향상
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'local',
        command TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        tags TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        layout TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  public getDb(): Database.Database {
    return this.db
  }

  public close(): void {
    this.db.close()
  }
}
