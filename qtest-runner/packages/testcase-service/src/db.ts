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
      project_id TEXT DEFAULT '',
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

  // Migration: add project_id if missing (existing DBs)
  try { d.exec(`ALTER TABLE test_cases ADD COLUMN project_id TEXT DEFAULT ''`); } catch {}

  // Migration: add import_date if missing (existing DBs)
  try { d.exec(`ALTER TABLE test_cases ADD COLUMN import_date TEXT DEFAULT ''`); } catch {}

  // ── Local test runs (cycles) ──
  d.exec(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      project_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT DEFAULT '',
      total_test_cases INTEGER DEFAULT 0,
      total_executed INTEGER DEFAULT 0,
      total_pass INTEGER DEFAULT 0,
      total_fail INTEGER DEFAULT 0,
      folder_id INTEGER,
      iteration_id INTEGER,
      project_version_id INTEGER,
      environment_id INTEGER,
      planned_start_date TEXT DEFAULT '',
      planned_end_date TEXT DEFAULT '',
      execution_time INTEGER DEFAULT 0,
      estimated_time INTEGER DEFAULT 0,
      issue_count INTEGER DEFAULT 0,
      owner TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_on TEXT DEFAULT '',
      updated_on TEXT DEFAULT '',
      updated_by TEXT DEFAULT '',
      test_result_statuses TEXT DEFAULT '',
      synced_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tr_key ON test_runs(key);
    CREATE INDEX IF NOT EXISTS idx_tr_project ON test_runs(project_id);
  `);

  // ── Local test plans ──
  d.exec(`
    CREATE TABLE IF NOT EXISTS test_plans (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      project_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT DEFAULT '',
      folder_id INTEGER,
      created_by TEXT DEFAULT '',
      created_on TEXT DEFAULT '',
      updated_on TEXT DEFAULT '',
      synced_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tp_key ON test_plans(key);
    CREATE INDEX IF NOT EXISTS idx_tp_project ON test_plans(project_id);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
