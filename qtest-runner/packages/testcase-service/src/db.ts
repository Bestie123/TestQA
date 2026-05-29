import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'testcases.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Approved',
      precondition TEXT DEFAULT '',
      objective TEXT DEFAULT '',
      folder TEXT DEFAULT '',
      priority TEXT DEFAULT 'Normal',
      component TEXT DEFAULT '',
      labels TEXT DEFAULT '',
      owner TEXT DEFAULT '',
      estimated_time TEXT DEFAULT '',
      coverage_issues TEXT DEFAULT '',
      coverage_pages TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_steps (
      id TEXT PRIMARY KEY,
      test_case_id TEXT NOT NULL,
      idx INTEGER NOT NULL,
      action TEXT DEFAULT '',
      test_data TEXT DEFAULT '',
      expected_result TEXT DEFAULT '',
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_steps_tc ON test_steps(test_case_id);
    CREATE INDEX IF NOT EXISTS idx_tc_key ON test_cases(key);
    CREATE INDEX IF NOT EXISTS idx_tc_folder ON test_cases(folder);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
