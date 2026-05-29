import { getDb } from './db';

export interface DiffResult {
  key: string;
  name: string;
  differences: DiffEntry[];
  localOnly: boolean;
  remoteOnly: boolean;
}

export interface DiffEntry {
  field: string;
  localValue: string;
  remoteValue: string;
}

export function diffWithLocal(remoteCases: any[]): DiffResult[] {
  const db = getDb();
  const results: DiffResult[] = [];
  const localKeys = new Set<string>();
  const remoteKeys = new Set<string>();

  const localRows = db.prepare('SELECT * FROM test_cases').all() as any[];
  for (const row of localRows) {
    row.steps = db.prepare('SELECT * FROM test_steps WHERE test_case_id = ? ORDER BY idx').all(row.id);
    localKeys.add(row.key);
  }

  for (const rc of remoteCases) {
    remoteKeys.add(rc.key);
    const local = localRows.find((r: any) => r.key === rc.key);
    if (!local) {
      results.push({ key: rc.key, name: rc.name, differences: [], localOnly: false, remoteOnly: true });
      continue;
    }
    const differences: DiffEntry[] = [];
    const check = (field: string, localVal: string, remoteVal: string) => {
      if (String(localVal || '') !== String(remoteVal || '')) {
        differences.push({ field, localValue: localVal || '', remoteValue: remoteVal || '' });
      }
    };
    check('name', local.name, rc.name);
    check('status', local.status, rc.status);
    check('precondition', local.precondition || '', rc.precondition);
    check('objective', local.objective || '', rc.objective);
    check('folder', local.folder || '', rc.folder);
    check('priority', local.priority || '', rc.priority);
    check('component', local.component || '', rc.component);
    check('labels', local.labels || '', rc.labels);
    check('coverageIssues', local.coverage_issues || '', rc.coverageIssues);
    check('coveragePages', local.coverage_pages || '', rc.coveragePages);

    const localStepCount = local.steps?.length || 0;
    const remoteStepCount = rc.steps?.length || 0;
    if (localStepCount !== remoteStepCount) {
      differences.push({ field: 'steps.count', localValue: String(localStepCount), remoteValue: String(remoteStepCount) });
    }

    if (differences.length > 0) {
      results.push({ key: rc.key, name: rc.name, differences, localOnly: false, remoteOnly: false });
    }
  }

  for (const lr of localRows) {
    if (!remoteKeys.has(lr.key)) {
      results.push({ key: lr.key, name: lr.name, differences: [], localOnly: true, remoteOnly: false });
    }
  }

  return results;
}

export function diffExcelWithLocal(excelRows: string[][]): DiffResult[] {
  const { parseExcelRows } = require('./importer');
  const parsed = parseExcelRows(excelRows);
  return diffWithLocal(parsed.testCases);
}
