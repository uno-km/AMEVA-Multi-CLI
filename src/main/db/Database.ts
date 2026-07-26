import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

export class AppDatabase {
  private db: Database.Database

  constructor() {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'ameva-multi-cli.sqlite')
    this.db = new Database(dbPath)
    this.initSchema()
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        command TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        command TEXT,
        startedAt TEXT,
        tags TEXT
      );
    `)
  }

  public getDb(): Database.Database {
    return this.db
  }
}
