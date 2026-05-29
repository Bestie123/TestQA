import { getDb } from './db';
import { v4 as uuid } from 'uuid';

export interface ExcelParseResult {
  testCases: ExcelTestCase[];
  errors: string[];
}

interface ExcelTestCase {
  key: string;
  name: string;
  status: string;
  precondition: string;
  objective: string;
  folder: string;
  priority: string;
  component: string;
  labels: string;
  owner: string;
  estimatedTime: string;
  coverageIssues: string;
  coveragePages: string;
  steps: ExcelStep[];
}

interface ExcelStep {
  action: string;
  testData: string;
  expectedResult: string;
}

export function parseExcelRows(rows: string[][]): ExcelParseResult {
  const result: ExcelParseResult = { testCases: [], errors: [] };
  let current: ExcelTestCase | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const key = (row[0] || '').trim();

    if (key) {
      if (current) {
        if (current.steps.length === 0) {
          result.errors.push(`TC ${current.key}: нет шагов`);
        }
        result.testCases.push(current);
      }

      const step = (row[13] || '').trim();
      current = {
        key,
        name: (row[1] || '').trim(),
        status: (row[2] || 'Approved').trim(),
        precondition: (row[3] || '').trim(),
        objective: (row[4] || '').trim(),
        folder: (row[5] || '').trim(),
        priority: (row[6] || 'Normal').trim(),
        component: (row[7] || '').trim(),
        labels: (row[8] || '').trim(),
        owner: (row[9] || '').trim(),
        estimatedTime: (row[10] || '').trim(),
        coverageIssues: (row[11] || '').trim(),
        coveragePages: (row[12] || '').trim(),
        steps: [],
      };

      if (step) {
        current.steps.push({
          action: step,
          testData: (row[14] || '').trim(),
          expectedResult: (row[15] || '').trim(),
        });
      }
    } else if (current) {
      const step = (row[13] || '').trim();
      if (step) {
        current.steps.push({
          action: step,
          testData: (row[14] || '').trim(),
          expectedResult: (row[15] || '').trim(),
        });
      }
    }
  }

  if (current) {
    if (current.steps.length === 0) {
      result.errors.push(`TC ${current.key}: нет шагов`);
    }
    result.testCases.push(current);
  }

  return result;
}

export function importTestCases(parsed: ExcelParseResult): {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
} {
  const db = getDb();
  const insertTc = db.prepare(`
    INSERT INTO test_cases (id, key, name, status, precondition, objective, folder,
      priority, component, labels, owner, estimated_time, coverage_issues, coverage_pages)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      precondition = excluded.precondition,
      objective = excluded.objective,
      folder = excluded.folder,
      priority = excluded.priority,
      component = excluded.component,
      labels = excluded.labels,
      owner = excluded.owner,
      estimated_time = excluded.estimated_time,
      coverage_issues = excluded.coverage_issues,
      coverage_pages = excluded.coverage_pages,
      updated_at = datetime('now')
  `);

  const deleteSteps = db.prepare('DELETE FROM test_steps WHERE test_case_id = ?');
  const insertStep = db.prepare(`
    INSERT INTO test_steps (id, test_case_id, idx, action, test_data, expected_result)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [...parsed.errors];

  const transaction = db.transaction(() => {
    for (const tc of parsed.testCases) {
      if (!tc.key || !tc.name) {
        skipped++;
        continue;
      }

      const existing = db.prepare('SELECT id FROM test_cases WHERE key = ?').get(tc.key) as { id: string } | undefined;
      const existingId = existing?.id;
      const tcId = uuid();

      insertTc.run(
        tcId, tc.key, tc.name, tc.status, tc.precondition, tc.objective,
        tc.folder, tc.priority, tc.component, tc.labels, tc.owner,
        tc.estimatedTime, tc.coverageIssues, tc.coveragePages
      );

      if (existing) {
        updated++;
        deleteSteps.run(existingId!);
      } else {
        imported++;
      }

      for (let i = 0; i < tc.steps.length; i++) {
        const s = tc.steps[i];
        insertStep.run(uuid(), existing ? existingId : tcId, i, s.action, s.testData, s.expectedResult);
      }
    }
  });

  transaction();

  return { imported, updated, skipped, errors };
}
