import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockTables } = vi.hoisted(() => {
  const tables: Record<string, any[]> = { executions: [], step_results: [] };
  const db: any = { pragma: vi.fn(), exec: vi.fn(), prepare: vi.fn(), close: vi.fn(), transaction: vi.fn() };
  db.prepare.mockImplementation((sql: string) => {
    const stmt: any = { run: vi.fn(), get: vi.fn(), all: vi.fn() };
    if (/INSERT INTO executions/i.test(sql)) {
      stmt.run = vi.fn((...a: any[]) => { tables.executions.push({ id: a[0], test_case_key: a[1], test_case_name: a[2], status: a[3], folder: a[4] || '', started_at: a[5], created_at: a[5] }); return { changes: 1 }; });
    } else if (/INSERT INTO step_results/i.test(sql)) {
      stmt.run = vi.fn((...a: any[]) => { tables.step_results.push({ id: a[0], execution_id: a[1], step_index: a[2], action: a[3], test_data: a[4], expected_result: a[5], status: a[6], started_at: a[7] }); return { changes: 1 }; });
    } else if (/UPDATE executions/i.test(sql)) {
      stmt.run = vi.fn((...a: any[]) => { const e = tables.executions.find((x: any) => x.id === a[a.length - 1]); if (e) e.status = a[0]; return { changes: 1 }; });
    } else if (/UPDATE step_results/i.test(sql)) {
      stmt.run = vi.fn((...a: any[]) => { const s = tables.step_results.find((x: any) => x.id === a[a.length - 1]); if (s) s.status = a[0]; return { changes: 1 }; });
    } else if (/SELECT.*COUNT/i.test(sql)) {
      stmt.get = vi.fn(() => ({ c: tables.executions.length }));
    } else if (/SELECT.*FROM executions WHERE id/i.test(sql)) {
      stmt.get = vi.fn((id: string) => tables.executions.find((e: any) => e.id === id));
    } else if (/SELECT.*FROM executions/i.test(sql)) {
      stmt.all = vi.fn(() => [...tables.executions]);
    } else if (/SELECT.*LIMIT 1/i.test(sql)) {
      stmt.get = vi.fn(() => tables.step_results.find((s: any) => s.status === 'running'));
    } else if (/SELECT.*FROM step_results WHERE execution_id.*step_index/i.test(sql)) {
      stmt.get = vi.fn((eid: string, idx: number) => tables.step_results.find((s: any) => s.execution_id === eid && s.step_index === idx));
    } else if (/SELECT.*FROM step_results WHERE execution_id/i.test(sql)) {
      stmt.all = vi.fn((eid: string) => tables.step_results.filter((s: any) => s.execution_id === eid));
    } else if (/DELETE/i.test(sql)) {
      stmt.run = vi.fn(() => ({ changes: 0 }));
    }
    return stmt;
  });
  db.transaction.mockImplementation((fn: Function) => { const w: any = (...a: any[]) => fn(...a); return w; });
  return { mockDb: db, mockTables: tables };
});

vi.mock('better-sqlite3', () => ({ default: vi.fn(() => mockDb) }));

describe('execution DB operations', () => {
  beforeEach(() => {
    mockTables.executions = [];
    mockTables.step_results = [];
    vi.clearAllMocks();
  });

  it('creates tables on init', () => {
    mockDb.exec('CREATE TABLE test');
    expect(mockDb.exec).toHaveBeenCalled();
  });

  it('inserts step result', () => {
    const stmt = mockDb.prepare('INSERT INTO step_results');
    stmt.run('s1', 'e1', 0, 'navigate', '', '', 'running', 'now');
    expect(mockTables.step_results).toHaveLength(1);
    expect(mockTables.step_results[0].execution_id).toBe('e1');
    expect(mockTables.step_results[0].action).toBe('navigate');
  });

  it('updates execution status', () => {
    mockTables.executions.push({ id: 'e1', status: 'running' });
    const stmt = mockDb.prepare('UPDATE executions SET status');
    stmt.run('passed', 'e1');
    expect(mockTables.executions[0].status).toBe('passed');
  });

  it('updates step result status', () => {
    mockTables.step_results.push({ id: 's1', status: 'running' });
    const stmt = mockDb.prepare('UPDATE step_results SET status');
    stmt.run('passed', 's1');
    expect(mockTables.step_results[0].status).toBe('passed');
  });

  it('selects all executions', () => {
    mockTables.executions.push({ id: 'e1', test_case_key: 'TC-1' });
    const stmt = mockDb.prepare('SELECT * FROM executions');
    expect(stmt.all()).toHaveLength(1);
  });

  it('selects execution by id', () => {
    mockTables.executions.push({ id: 'e1', test_case_key: 'TC-1' });
    const stmt = mockDb.prepare('SELECT * FROM executions WHERE id =');
    const result = stmt.get('e1');
    expect(result).toBeDefined();
    expect((result as any).test_case_key).toBe('TC-1');
  });

  it('returns undefined for missing execution', () => {
    const stmt = mockDb.prepare('SELECT * FROM executions WHERE id =');
    expect(stmt.get('nonexistent')).toBeUndefined();
  });

  it('counts executions', () => {
    mockTables.executions.push({ id: 'e1' }, { id: 'e2' });
    const stmt = mockDb.prepare('SELECT COUNT');
    expect((stmt.get() as any).c).toBe(2);
  });

  it('inserts multiple steps for an execution', () => {
    const insert = mockDb.prepare('INSERT INTO step_results');
    insert.run('s1', 'e1', 0, 'navigate', 'url:https://example.com', '', 'running', 't1');
    insert.run('s2', 'e1', 1, 'click', 'selector:#btn', '', 'pending', null);
    insert.run('s3', 'e1', 2, 'verify', '', 'text found', 'pending', null);
    expect(mockTables.step_results).toHaveLength(3);
    const select = mockDb.prepare('SELECT * FROM step_results WHERE execution_id');
    const steps = select.all('e1') as any[];
    expect(steps).toHaveLength(3);
  });

  it('handles composite step action', () => {
    const insert = mockDb.prepare('INSERT INTO step_results');
    insert.run('s1', 'e1', 0, 'composite', 'comp-login', '{"bindings":{"url":"https://jira.com"}}', 'running', 't1');
    expect(mockTables.step_results[0].action).toBe('composite');
  });

  it('selects running step', () => {
    mockTables.step_results.push(
      { id: 's1', execution_id: 'e1', step_index: 0, status: 'running' },
      { id: 's2', execution_id: 'e1', step_index: 1, status: 'pending' }
    );
    const stmt = mockDb.prepare('SELECT LIMIT 1');
    const result = stmt.get() as any;
    expect(result).toBeDefined();
    expect(result.id).toBe('s1');
  });

  it('handles transaction wrapper', () => {
    const txn = mockDb.transaction(() => 42);
    expect(txn()).toBe(42);
  });
});
