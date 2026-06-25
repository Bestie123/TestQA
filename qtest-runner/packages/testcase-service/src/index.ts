import Fastify from 'fastify';
import { getDb, closeDb } from './db';
import { parseExcelRows, importTestCases, saveTestCaseLocally } from './importer';
import { getZephyrConfig, setZephyrConfig, syncFromZephyr, testConnection, fetchProjects, debugZephyrResponse, fetchTestRuns, fetchTestPlans, syncFromZephyrTestRun, queryZephyrTestCases, fetchFolderTree, fetchFolderTreeFromApi, loadCredentialsFile, saveCredentialsFile, createZephyrTestCase, fetchTestRunTestCases, clearCache } from './zephyr-client';
import { diffExcelWithLocal } from './diff-engine';

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = Fastify({ logger: true });

// ── Health ──
app.get('/health', async () => ({ status: 'ok', service: 'testcase-service' }));

// ── List test cases ──
app.get<{ Querystring: { folder?: string; search?: string; limit?: string; offset?: string } }>('/api/testcases', async (req) => {
  const db = getDb();
  let query = 'SELECT * FROM test_cases';
  let countQuery = 'SELECT COUNT(*) as total FROM test_cases';
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
    const where = ' WHERE ' + conditions.join(' AND ');
    query += where;
    countQuery += where;
  }
  query += ' ORDER BY folder, key';

  const total = (db.prepare(countQuery).get(...params) as any).total;

  const limit = parseInt(req.query.limit || '0', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  if (limit > 0) query += ` LIMIT ? OFFSET ?`;
  const allParams = limit > 0 ? [...params, limit, offset] : params;

  const tcs = db.prepare(query).all(...allParams);

  for (const tc of tcs as any[]) {
    tc.steps = db.prepare('SELECT * FROM test_steps WHERE test_case_id = ? ORDER BY idx').all(tc.id);
  }

  return { data: tcs, total };
});

// ── Local test runs (from SQLite) ──
app.get('/api/local/testruns', async (req: any) => {
  const db = getDb();
  const q = req.query as any;
  let query = 'SELECT * FROM test_runs';
  const params: string[] = [];
  const conditions: string[] = [];

  if (q.search) {
    conditions.push('(name LIKE ? OR key LIKE ?)');
    params.push(`%${q.search}%`, `%${q.search}%`);
  }
  if (q.status) {
    conditions.push('status = ?');
    params.push(q.status);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY name ASC';

  const runs = db.prepare(query).all(...params);
  // Parse test_result_statuses JSON
  for (const r of runs as any[]) {
    if (r.test_result_statuses) {
      try { r.test_result_statuses = JSON.parse(r.test_result_statuses); } catch { r.test_result_statuses = null; }
    }
  }
  return { data: runs, total: runs.length };
});

// ── Local test plans (from SQLite) ──
app.get('/api/local/testplans', async (req: any) => {
  const db = getDb();
  const q = req.query as any;
  let query = 'SELECT * FROM test_plans';
  const params: string[] = [];
  const conditions: string[] = [];

  if (q.search) {
    conditions.push('(name LIKE ? OR key LIKE ?)');
    params.push(`%${q.search}%`, `%${q.search}%`);
  }
  if (q.status) {
    conditions.push('status = ?');
    params.push(q.status);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY name ASC';

  const plans = db.prepare(query).all(...params);
  return { data: plans, total: plans.length };
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
app.post<{ Body: { key: string; name: string; folder?: string; projectKey?: string; priority?: string; precondition?: string; objective?: string; steps: { action: string; testData: string; expectedResult: string }[] } }>('/api/testcases', async (req, reply) => {
  const db = getDb();
  const { key, name, folder, projectKey, priority, precondition, objective, steps } = req.body;
  if (!key || !name) { reply.code(400); return { error: 'key and name are required' }; }
  const existing = db.prepare('SELECT id FROM test_cases WHERE key = ?').get(key);
  if (existing) { reply.code(409); return { error: `Test case ${key} already exists` }; }
  const id = require('crypto').randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO test_cases (id, key, name, folder, status, precondition, objective, priority, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'created', ?, ?, ?, ?, ?, ?)`)
    .run(id, key, name, folder || '', precondition || '', objective || '', priority || 'Normal', projectKey || '', now, now);
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

// ── Credentials file management ──
app.get('/api/credentials', async () => {
  const creds = loadCredentialsFile();
  return { ...creds, _path: require('path').join(require('os').homedir(), '.qtest', 'credentials.json') };
});

app.put<{ Body: { profiles?: Record<string, { host?: string; token?: string }>; zephyr?: string; default?: string; host?: string; token?: string } }>('/api/credentials', async (req) => {
  saveCredentialsFile(req.body);
  return { ok: true };
});

app.post('/api/zephyr/sync', async () => {
  const result = await syncFromZephyr();
  clearCache();
  return result;
});

app.post('/api/zephyr/test-connection', async () => {
  const result = await testConnection();
  return result;
});

// ── Publish recorded steps as new Zephyr test case ──
app.post<{ Body: {
  name: string;
  projectKey?: string;
  folder?: string;
  priority?: string;
  precondition?: string;
  objective?: string;
  labels?: string[];
  steps: { action: string; testData: string; expectedResult: string }[];
} }>('/api/zephyr/publish', async (req, reply) => {
  const { name, projectKey, folder, priority, precondition, objective, labels, steps } = req.body;
  if (!name || !steps?.length) {
    reply.code(400);
    return { error: 'name and steps are required' };
  }
  const pk = projectKey || getZephyrConfig().projectKey;
  let zephyrKey: string | null = null;
  let zephyrError: string | null = null;

  // Try Zephyr API; fallback to local-only if it fails
  try {
    const created = await createZephyrTestCase({ name, projectKey: pk, folder, priority, precondition, objective, labels, steps });
    zephyrKey = created.key;
  } catch (err: any) {
    zephyrError = err.message;
  }

  // Always save locally
  const localKey = zephyrKey || ('TC-REC-' + Date.now().toString(36).toUpperCase());
  try {
    saveTestCaseLocally({ key: localKey, name, folder, status: 'Draft', precondition, objective, priority, projectKey: pk, steps });
  } catch (dbErr: any) {
    // Local save failed — still return what we have
  }

  const response: any = { key: localKey, name, status: 'Draft' };
  if (zephyrKey) response.zephyrKey = zephyrKey;
  if (zephyrError) response.zephyrError = zephyrError;
  if (!zephyrKey && zephyrError) response.warning = `Zephyr API недоступен: ${zephyrError}. ТК сохранён локально.`;
  reply.code(zephyrKey ? 201 : 200);
  return response;
});

app.get('/api/zephyr/projects', async () => {
  const projects = await fetchProjects();
  return projects;
});

app.get('/api/zephyr/testruns', async () => {
  const runs = await fetchTestRuns();
  return runs;
});

app.get<{ Params: { key: string } }>('/api/zephyr/testruns/:key/testcases', async (req, reply) => {
  try {
    const tcs = await fetchTestRunTestCases(req.params.key);
    return { data: tcs, total: tcs.length };
  } catch (err: any) {
    reply.code(500);
    return { error: `Failed to fetch test cases for test run ${req.params.key}: ${err.message}` };
  }
});

app.get('/api/zephyr/testplans', async (req: any) => {
  const q = req.query as any;
  const plans = await fetchTestPlans(q.projectKey || '');
  return plans;
});

app.post('/api/zephyr/sync/testrun', async (req: any, reply: any) => {
  const testRunKey = req.body?.testRunKey;
  if (!testRunKey) { reply.code(400); return { error: 'testRunKey is required' }; }
  const result = await syncFromZephyrTestRun(testRunKey);
  clearCache();
  return result;
});

app.get('/api/zephyr/debug-response', async () => {
  try {
    const raw = await debugZephyrResponse();
    return raw;
  } catch (err: any) {
    return { error: err.message };
  }
});

app.post('/api/zephyr/cache/clear', async () => {
  clearCache();
  return { ok: true, message: 'Cache cleared' };
});

// ── Sync runs/plans to local DB ──
app.post('/api/local/sync/testruns', async () => {
  const db = getDb();
  const runs = await fetchTestRuns();
  const insert = db.prepare(`INSERT OR REPLACE INTO test_runs 
    (id, key, project_id, name, description, status, total_test_cases, total_executed, total_pass, total_fail,
     folder_id, iteration_id, project_version_id, environment_id, planned_start_date, planned_end_date,
     execution_time, estimated_time, issue_count, owner, created_by, created_on, updated_on, updated_by, test_result_statuses)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const r of runs) {
      insert.run(r.id, r.key, r.projectId || null, r.name, r.description || '', r.status || '',
        r.totalTestCases || 0, r.totalExecuted || 0, r.totalPass || 0, r.totalFail || 0,
        r.folderId ?? null, r.iterationId ?? null, r.projectVersionId ?? null, r.environmentId ?? null,
        r.plannedStartDate || '', r.plannedEndDate || '', r.executionTime || 0, r.estimatedTime || 0,
        r.issueCount || 0, r.owner || '', r.createdBy || '', r.startedOn || '', r.updatedOn || '', r.updatedBy || '',
        r.testResultStatuses ? JSON.stringify(r.testResultStatuses) : null);
    }
  });
  tx();
  return { ok: true, synced: runs.length };
});

app.post('/api/local/sync/testplans', async () => {
  const db = getDb();
  const cfg = getZephyrConfig();
  let plans: any[] = [];
  try {
    const res = await fetch(`${cfg.baseUrl}/rest/tests/latest/testplan/search?projectKey=${cfg.projectKey}&maxResults=500`, {
      headers: { 'Content-Type': 'application/json', ...(cfg.apiToken ? { 'Authorization': `Bearer ${cfg.apiToken}` } : {}) },
      signal: AbortSignal.timeout(30000),
    });
    const data: any = await res.json();
    plans = data?.results || [];
  } catch { plans = []; }
  const insert = db.prepare(`INSERT OR REPLACE INTO test_plans 
    (id, key, project_id, name, description, status, folder_id, created_by, created_on, updated_on)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const p of plans) {
      insert.run(p.id, p.key, p.projectId || null, p.name || '', p.description || '',
        p.status?.name || '', p.folderId ?? null, p.createdBy || '', p.createdOn || '', p.updatedOn || '');
    }
  });
  tx();
  return { ok: true, synced: plans.length };
});

app.get('/api/zephyr/folders', async (req: any) => {
  const q = req.query as any;
  const projectKey = q?.projectKey || '';
  const type = q?.type || 'testcase';
  try {
    return await fetchFolderTreeFromApi(projectKey, type);
  } catch (err: any) {
    return { error: err.message };
  }
});

app.get('/api/zephyr/testcases', async (req: any) => {
  const q = req.query as any;
  try {
    const maxPages = q.maxPages !== undefined ? parseInt(q.maxPages as string, 10) : 5;
    const results = await queryZephyrTestCases(q.folder, q.status, q.priority, q.owner, q.search, q.projectKey, maxPages);
    return results;
  } catch (err: any) {
    return { error: err.message };
  }
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

function gracefulShutdown(signal: string) {
  console.log(`[${signal}] Shutting down testcase-service...`);
  app.close().then(() => {
    closeDb();
    console.log('testcase-service stopped');
    process.exit(0);
  }).catch(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));

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
