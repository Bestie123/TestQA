import Fastify from 'fastify';
import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuid } from 'uuid';
import http from 'http';

const PORT = parseInt(process.env.PORT || '3003', 10);
const TC_SERVICE = `http://${process.env.TC_HOST || 'localhost'}:${process.env.TC_PORT || '3001'}`;
const AGENT_SERVICE = `http://${process.env.AGENT_HOST || 'localhost'}:${process.env.AGENT_PORT || '3005'}`;
const SL_SERVICE = `http://${process.env.SL_HOST || 'localhost'}:${process.env.SL_PORT || '3002'}`;
const DB_PATH = path.join(__dirname, '..', 'executions.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    test_case_key TEXT NOT NULL,
    test_case_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    folder TEXT DEFAULT '',
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS step_results (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    action TEXT DEFAULT '',
    test_data TEXT DEFAULT '',
    expected_result TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    screenshot TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_step_results_exec ON step_results(execution_id);
`);

const app = Fastify({ logger: true });

app.addHook('onRequest', async (_req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

app.options('/*', async (_req, reply) => {
  reply.code(204).send();
});

function fetchTestcase(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`${TC_SERVICE}/api/testcases/${encodeURIComponent(key)}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`TC service returned ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function httpPost(url: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname, port: parseInt(u.port, 10) || 80,
      path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); } catch { reject(new Error(`HTTP POST ${url}: ${chunks}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function extractBindings(action: string, testData: string, expectedResult: string): Record<string, string> | null {
  if (action !== 'composite') return null;
  try {
    const parsed = JSON.parse(expectedResult || '{}');
    return parsed.bindings || parsed;
  } catch { return {}; }
}

app.get('/health', async () => ({ status: 'ok', service: 'execution-service' }));

app.post<{ Body: { testCaseKey: string } }>('/api/executions', async (req, reply) => {
  const { testCaseKey } = req.body;
  if (!testCaseKey) { reply.code(400); return { error: 'testCaseKey is required' }; }
  let tc: any;
  try {
    tc = await fetchTestcase(testCaseKey);
  } catch (e: any) {
    reply.code(502); return { error: `Failed to fetch test case: ${e.message}` };
  }
  const steps = tc.steps || [];
  // Pre-fetch composite step expansions (async, outside txn)
  const expandedMap = new Map<string, any[]>();
  for (const step of steps) {
    if (step.action === 'composite') {
      const compositeId = step.test_data || '';
      if (!compositeId || expandedMap.has(compositeId)) continue;
      try {
        const bindings = extractBindings(step.action, step.test_data, step.expected_result) || {};
        const result = await httpPost(`${SL_SERVICE}/api/composite-steps/${compositeId}/expand`, { bindings });
        expandedMap.set(compositeId, result.expanded || []);
      } catch {
        // Fallback: leave as single composite step
      }
    }
  }
  const executionId = uuid();
  const now = new Date().toISOString();
  const insertExec = db.prepare(`INSERT INTO executions (id, test_case_key, test_case_name, status, folder, started_at, created_at) VALUES (?, ?, ?, 'running', ?, ?, ?)`);
  const insertStep = db.prepare(`INSERT INTO step_results (id, execution_id, step_index, action, test_data, expected_result, status, started_at) VALUES (?, ?, ?, ?, ?, ?, 'running', ?)`);
  const updateExec = db.prepare(`UPDATE executions SET status = ? WHERE id = ?`);
  const txn = db.transaction(() => {
    insertExec.run(executionId, tc.key, tc.name, tc.folder || '', now, now);
    let stepIdx = 0;
    for (const step of steps) {
      const compositeId = step.test_data || '';
      if (step.action === 'composite' && expandedMap.has(compositeId)) {
        const expanded = expandedMap.get(compositeId)!;
        for (const es of expanded) {
          const testData = [
            es.selector ? `selector:${es.selector}` : '',
            es.value ? `value:${es.value}` : '',
            es.url ? `url:${es.url}` : '',
          ].filter(Boolean).join(' ');
          insertStep.run(uuid(), executionId, stepIdx++, es.action, testData, es.text || '', now);
        }
      } else {
        insertStep.run(uuid(), executionId, stepIdx++, step.action, step.test_data, step.expected_result, now);
      }
    }
    if (stepIdx === 0) {
      updateExec.run('passed', executionId);
    }
  });
  txn();
  const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any;
  execution.steps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(executionId);
  reply.code(201);
  return execution;
});

app.get('/api/executions', async () => {
  const executions = db.prepare('SELECT * FROM executions ORDER BY created_at DESC').all() as any[];
  for (const exec of executions) {
    exec.steps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(exec.id);
  }
  return executions;
});

app.get<{ Params: { id: string } }>('/api/executions/:id', async (req, reply) => {
  const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any;
  if (!execution) { reply.code(404); return { error: 'Execution not found' }; }
  execution.steps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(execution.id);
  return execution;
});

app.post<{ Params: { id: string } }>('/api/executions/:id/start', async (req, reply) => {
  const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any;
  if (!execution) { reply.code(404); return { error: 'Execution not found' }; }
  const now = new Date().toISOString();
  db.prepare(`UPDATE executions SET status = 'running', started_at = ? WHERE id = ?`).run(now, req.params.id);
  const firstStep = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index LIMIT 1').get(req.params.id) as any;
  if (firstStep) {
    db.prepare(`UPDATE step_results SET status = 'running', started_at = ? WHERE id = ?`).run(now, firstStep.id);
  }
  const updated = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any;
  updated.steps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(req.params.id);
  return updated;
});

// ── Auto-execution: execution-service → browser-agent ──

function callAgent(body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: process.env.AGENT_HOST || 'localhost',
      port: parseInt(process.env.AGENT_PORT || '3005', 10),
      path: '/api/execute-step',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); } catch { reject(new Error(`Agent returned: ${chunks}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function ensureAgentSession(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: process.env.AGENT_HOST || 'localhost', port: parseInt(process.env.AGENT_PORT || '3005', 10), path: '/api/launch', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.profileId) resolve(parsed.profileId);
            else reject(new Error('No profileId from agent'));
          } catch { reject(new Error(`Failed to launch agent: ${data}`)); }
        });
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify({ profileName: 'AutoExecution' }));
    req.end();
  });
}

app.post<{ Params: { id: string } }>('/api/executions/:id/auto-next', async (req, reply) => {
  const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any;
  if (!execution) { reply.code(404); return { error: 'Execution not found' }; }

  const runningStep = db.prepare("SELECT * FROM step_results WHERE execution_id = ? AND status = 'running' ORDER BY step_index LIMIT 1").get(req.params.id) as any;
  if (!runningStep) { reply.code(400); return { error: 'No running step found' }; }

  try {
    // If step is composite (wasn't expanded during creation), skip it
    if (runningStep.action === 'composite') {
      const now = new Date().toISOString();
      db.prepare(`UPDATE step_results SET status = 'passed', notes = 'Composite step (expanded at creation)', completed_at = ? WHERE id = ?`).run(now, runningStep.id);
      // Move to next step
      const allSteps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(req.params.id) as any[];
      const currentIdx = allSteps.findIndex((s: any) => s.id === runningStep.id);
      if (currentIdx < allSteps.length - 1) {
        const nextStep = allSteps[currentIdx + 1];
        db.prepare(`UPDATE step_results SET status = 'running', started_at = ? WHERE id = ?`).run(now, nextStep.id);
      }
      const updated = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any;
      updated.steps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(req.params.id);
      return { execution: updated, skippedComposite: true };
    }

    // Ensure agent session exists
    let profileId: string;
    try { profileId = await ensureAgentSession(); }
    catch { reply.code(502); return { error: 'browser-agent not available. Start it first.' }; }

    // Execute the step via browser-agent
    const agentResult = await callAgent({
      profileId,
      action: runningStep.action,
      testData: runningStep.test_data,
      expectedResult: runningStep.expected_result,
    });

        const firstResult = agentResult.results?.[0] || { status: 'failed', error: 'No result' };
        const stepStatus = firstResult.status === 'passed' ? 'passed' : 'failed';
        const screenshot = firstResult.screenshot || '';
        const notes = firstResult.error || firstResult.status || '';

    const now = new Date().toISOString();
    db.prepare(`UPDATE step_results SET status = ?, screenshot = ?, notes = ?, completed_at = ? WHERE id = ?`).run(stepStatus, screenshot, notes, now, runningStep.id);

    // Advance to next step
    const allSteps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(req.params.id) as any[];
    const currentIdx = allSteps.findIndex((s: any) => s.id === runningStep.id);
    if (stepStatus === 'passed' && currentIdx < allSteps.length - 1) {
      const nextStep = allSteps[currentIdx + 1];
      db.prepare(`UPDATE step_results SET status = 'running', started_at = ? WHERE id = ?`).run(now, nextStep.id);
    }

    const anyFailed = allSteps.some((s: any) => s.status === 'failed' || s.status === 'blocked');
    const allDone = allSteps.every((s: any) => ['passed', 'failed', 'skipped', 'blocked'].includes(s.status));
    let execStatus = 'running';
    if (anyFailed) execStatus = 'failed';
    else if (allDone) execStatus = 'passed';
    if (execStatus !== 'running') {
      db.prepare(`UPDATE executions SET status = ?, completed_at = ? WHERE id = ?`).run(execStatus, now, req.params.id);
    }

    const updated = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any;
    updated.steps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(req.params.id);
    return { execution: updated, agentCommands: agentResult.commands, agentResults: agentResult.results };
  } catch (err: any) {
    reply.code(500); return { error: err.message };
  }
});

app.patch<{ Params: { id: string; index: string }; Body: { status: string; screenshot?: string; notes?: string } }>('/api/executions/:id/steps/:index', async (req, reply) => {
  const { id, index } = req.params;
  const stepIndex = parseInt(index, 10);
  const { status, screenshot, notes } = req.body;
  const validStatuses = ['pending', 'running', 'passed', 'failed', 'skipped', 'blocked'];
  if (!validStatuses.includes(status)) {
    reply.code(400); return { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
  }
  const step = db.prepare('SELECT * FROM step_results WHERE execution_id = ? AND step_index = ?').get(id, stepIndex) as any;
  if (!step) { reply.code(404); return { error: 'Step not found' }; }
  const now = new Date().toISOString();
  const completed = ['passed', 'failed', 'skipped', 'blocked'].includes(status) ? now : null;
  db.prepare(`UPDATE step_results SET status = ?, screenshot = COALESCE(?, screenshot), notes = COALESCE(?, notes), completed_at = COALESCE(?, completed_at) WHERE id = ?`).run(status, screenshot || null, notes || null, completed, step.id);

  const allSteps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(id) as any[];
  const currentIdx = allSteps.findIndex((s: any) => s.id === step.id);
  if (status === 'passed' && currentIdx < allSteps.length - 1) {
    const nextStep = allSteps[currentIdx + 1];
    db.prepare(`UPDATE step_results SET status = 'running', started_at = ? WHERE id = ?`).run(now, nextStep.id);
  }
  const anyFailed = allSteps.some((s: any) => s.status === 'failed' || s.status === 'blocked');
  const allDone = allSteps.every((s: any) => ['passed', 'failed', 'skipped', 'blocked'].includes(s.status));
  let execStatus = 'running';
  if (anyFailed) execStatus = 'failed';
  else if (allDone) execStatus = 'passed';
  if (execStatus !== 'running') {
    db.prepare(`UPDATE executions SET status = ?, completed_at = ? WHERE id = ?`).run(execStatus, now, id);
  }
  const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as any;
  execution.steps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(id);
  return execution;
});

app.post<{ Params: { id: string; index: string }; Body: { screenshot: string } }>('/api/executions/:id/steps/:index/screenshot', async (req, reply) => {
  const { id, index } = req.params;
  const stepIndex = parseInt(index, 10);
  const step = db.prepare('SELECT * FROM step_results WHERE execution_id = ? AND step_index = ?').get(id, stepIndex) as any;
  if (!step) { reply.code(404); return { error: 'Step not found' }; }
  db.prepare(`UPDATE step_results SET screenshot = ? WHERE id = ?`).run(req.body.screenshot, step.id);
  return { ok: true };
});

// ── Reports / Statistics ──
app.get('/api/reports/summary', async () => {
  const total = db.prepare('SELECT COUNT(*) as c FROM executions').get() as any;
  const byStatus = db.prepare('SELECT status, COUNT(*) as c FROM executions GROUP BY status').all() as any[];
  const byTc = db.prepare(`
    SELECT test_case_key, test_case_name,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
    FROM executions
    GROUP BY test_case_key
    ORDER BY total DESC
    LIMIT 50
  `).all() as any[];
  const avgDuration = db.prepare(`
    SELECT AVG(
      (julianday(completed_at) - julianday(started_at)) * 86400
    ) as avg_seconds
    FROM executions
    WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
  `).get() as any;
  const statusMap: Record<string, number> = {};
  for (const s of byStatus) statusMap[s.status] = s.c;
  return {
    total: total?.c || 0,
    byStatus: statusMap,
    byTestCase: byTc,
    avgDurationSeconds: Math.round(avgDuration?.avg_seconds || 0),
  };
});

app.get('/api/reports/history', async () => {
  const rows = db.prepare(`
    SELECT date(created_at) as day, status, COUNT(*) as c
    FROM executions
    GROUP BY date(created_at), status
    ORDER BY day ASC
  `).all() as any[];
  const history: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!history[r.day]) history[r.day] = {};
    history[r.day][r.status] = r.c;
  }
  return history;
});

app.get('/api/reports/test-case/:key', async (req: any, reply: any) => {
  const execs = db.prepare(`
    SELECT id, status, started_at, completed_at, created_at
    FROM executions
    WHERE test_case_key = ?
    ORDER BY created_at DESC
  `).all(req.params.key) as any[];
  for (const ex of execs) {
    ex.steps = db.prepare('SELECT * FROM step_results WHERE execution_id = ? ORDER BY step_index').all(ex.id);
  }
  return execs;
});

function gracefulShutdown(signal: string) {
  console.log(`[${signal}] Shutting down execution-service...`);
  app.close().then(() => {
    db.close();
    console.log('execution-service stopped');
    process.exit(0);
  }).catch(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));

async function start() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`execution-service running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
start();
