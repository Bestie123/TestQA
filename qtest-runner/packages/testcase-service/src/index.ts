import Fastify from 'fastify';
import { getDb, closeDb } from './db';
import { parseExcelRows, importTestCases } from './importer';
import { getZephyrConfig, setZephyrConfig, syncFromZephyr } from './zephyr-client';
import { diffExcelWithLocal } from './diff-engine';

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = Fastify({ logger: true });

// ── Health ──
app.get('/health', async () => ({ status: 'ok', service: 'testcase-service' }));

// ── List test cases ──
app.get<{ Querystring: { folder?: string; search?: string } }>('/api/testcases', async (req) => {
  const db = getDb();
  let query = 'SELECT * FROM test_cases';
  const params: string[] = [];
  const conditions: string[] = [];

  if (req.query.folder) {
    conditions.push('folder LIKE ?');
    params.push(`%${req.query.folder}%`);
  }
  if (req.query.search) {
    conditions.push('(name LIKE ? OR key LIKE ?)');
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY folder, key';

  const tcs = db.prepare(query).all(...params);

  for (const tc of tcs as any[]) {
    tc.steps = db.prepare('SELECT * FROM test_steps WHERE test_case_id = ? ORDER BY idx').all(tc.id);
  }

  return tcs;
});

// ── Get single test case ──
app.get<{ Params: { key: string } }>('/api/testcases/:key', async (req, reply) => {
  const db = getDb();
  const tc = db.prepare('SELECT * FROM test_cases WHERE key = ?').get(req.params.key) as any;
  if (!tc) {
    reply.code(404);
    return { error: 'Test case not found' };
  }
  tc.steps = db.prepare('SELECT * FROM test_steps WHERE test_case_id = ? ORDER BY idx').all(tc.id);
  return tc;
});

// ── Get folders list ──
app.get('/api/folders', async () => {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT folder FROM test_cases WHERE folder != '' ORDER BY folder").all();
  return rows.map((r: any) => r.folder);
});

// ── Import Excel data ──
app.post<{ Body: { rows: string[][] } }>('/api/import', async (req) => {
  const parsed = parseExcelRows(req.body.rows);
  const result = importTestCases(parsed);
  return result;
});

// ── Create test case from steps ──
app.post<{ Body: { key: string; name: string; folder?: string; steps: { action: string; testData: string; expectedResult: string }[] } }>('/api/testcases', async (req, reply) => {
  const db = getDb();
  const { key, name, folder, steps } = req.body;
  if (!key || !name) { reply.code(400); return { error: 'key and name are required' }; }
  const existing = db.prepare('SELECT id FROM test_cases WHERE key = ?').get(key);
  if (existing) { reply.code(409); return { error: `Test case ${key} already exists` }; }
  const id = require('crypto').randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO test_cases (id, key, name, folder, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'created', ?, ?)`).run(id, key, name, folder || '', now, now);
  for (let i = 0; i < steps.length; i++) {
    const stepId = require('crypto').randomUUID();
    db.prepare(`INSERT INTO test_steps (id, test_case_id, idx, action, test_data, expected_result) VALUES (?, ?, ?, ?, ?, ?)`).run(stepId, id, i, steps[i].action, steps[i].testData, steps[i].expectedResult);
  }
  const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id) as any;
  tc.steps = db.prepare('SELECT * FROM test_steps WHERE test_case_id = ? ORDER BY idx').all(id);
  reply.code(201);
  return tc;
});

// ── Zephyr Sync ──
app.get('/api/zephyr/config', async () => {
  return getZephyrConfig();
});

app.put<{ Body: { baseUrl?: string; projectKey?: string; apiToken?: string } }>('/api/zephyr/config', async (req) => {
  setZephyrConfig(req.body);
  return getZephyrConfig();
});

app.post('/api/zephyr/sync', async () => {
  const result = await syncFromZephyr();
  return result;
});

// ── Diff ──
app.post<{ Body: { rows: string[][] } }>('/api/diff/excel', async (req) => {
  const diffs = diffExcelWithLocal(req.body.rows);
  return diffs;
});

// ── Coverage (Issues) ──
app.get('/api/coverage', async () => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT key, name, coverage_issues, folder
    FROM test_cases
    WHERE coverage_issues != '' AND coverage_issues IS NOT NULL
    ORDER BY key
  `).all() as any[];
  const issuesMap: Record<string, { key: string; name: string; folder: string }[]> = {};
  for (const row of rows) {
    const issues = (row.coverage_issues || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    for (const issue of issues) {
      if (!issuesMap[issue]) issuesMap[issue] = [];
      issuesMap[issue].push({ key: row.key, name: row.name, folder: row.folder });
    }
  }
  return issuesMap;
});

app.get<{ Params: { issueKey: string } }>('/api/coverage/:issueKey', async (req, reply) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT key, name, folder, coverage_issues
    FROM test_cases
    WHERE coverage_issues LIKE ?
    ORDER BY key
  `).all(`%${req.params.issueKey}%`);
  return rows;
});

// ── Start ──
async function start() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`testcase-service running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    closeDb();
    process.exit(1);
  }
}

start();
