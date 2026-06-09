import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { v4 as uuid } from 'uuid';

// ── In-memory mock database ──
const mockDb = vi.hoisted(() => {
  const tables: Record<string, any[]> = {
    library_steps: [],
    step_parameters: [],
    composite_steps: [],
    composite_step_items: [],
  };

  return {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn((sql: string) => ({
      run: vi.fn((...args: any[]) => {
        const isInsert = /^INSERT/i.test(sql.trim());
        const isUpdate = /^UPDATE/i.test(sql.trim());
        const isDelete = /^DELETE/i.test(sql.trim());

        const tbl = (() => {
          if (isInsert) { const m = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i); return m?.[1]?.toLowerCase(); }
          if (isUpdate) { const m = sql.match(/UPDATE\s+(\w+)/i); return m?.[1]?.toLowerCase(); }
          if (isDelete) { const m = sql.match(/FROM\s+(\w+)/i); return m?.[1]?.toLowerCase(); }
          return null;
        })();
        if (!tbl || !tables[tbl]) return { changes: 0 };

        if (isInsert) {
          const cols = (sql.match(/\(([^)]+)\)\s*VALUES/i)?.[1]?.split(',').map(c => c.trim())) || [];
          const row: Record<string, any> = {};
          cols.forEach((col, i) => { row[col] = args[i]; });
          tables[tbl].push(row);
          return { changes: 1, lastInsertRowid: tables[tbl].length };
        }

        if (isUpdate) {
          const id = args[args.length - 1];
          const row = tables[tbl].find(r => r.id === id);
          if (!row) return { changes: 0 };
          const clause = sql.match(/SET\s+(.+?)(?:WHERE|$)/i)?.[1] || '';
          const parts: string[] = [];
          let depth = 0, cur = '';
          for (const ch of clause) {
            if (ch === '(') { depth++; cur += ch; }
            else if (ch === ')') { depth--; cur += ch; }
            else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
            else { cur += ch; }
          }
          if (cur.trim()) parts.push(cur.trim());
          let pIdx = 0;
          for (const part of parts) {
            const eq = part.indexOf('=');
            if (eq === -1) { pIdx++; continue; }
            const col = part.substring(0, eq).trim();
            const val = args[pIdx++];
            if (/COALESCE/i.test(part)) { if (val != null) row[col] = val; }
            else { row[col] = val; }
          }
          return { changes: 1 };
        }

        if (isDelete) {
          const id = args[0];
          if (/composite_id\s*=\s*\?/i.test(sql)) {
            tables[tbl] = tables[tbl].filter(r => r.composite_id !== id);
          } else if (/id\s*=\s*\?/i.test(sql)) {
            tables[tbl] = tables[tbl].filter(r => r.id !== id);
            if (tbl === 'composite_steps') {
              tables['composite_step_items'] =
                tables['composite_step_items'].filter(r => r.composite_id !== id);
            }
          } else { tables[tbl] = []; }
          return { changes: 1 };
        }

        return { changes: 0 };
      }),
      get: vi.fn((...args: any[]) => {
        const t = sql.match(/FROM\s+(\w+)/i)?.[1]?.toLowerCase();
        if (!t || !tables[t]) return null;
        if (/COUNT\s*\(\s*\*\s*\)/i.test(sql)) return { c: tables[t].length };
        if (/WHERE\s+id\s*=\s*\?/i.test(sql)) return tables[t].find(r => r.id === args[0]) || null;
        if (/WHERE\s+step_id\s*=\s*\?/i.test(sql)) return tables[t].find(r => r.step_id === args[0]) || null;
        return tables[t][0] || null;
      }),
      all: vi.fn((...args: any[]) => {
        const t = sql.match(/FROM\s+(\w+)/i)?.[1]?.toLowerCase();
        if (!t || !tables[t]) return [];
        if (/DISTINCT\s+category/i.test(sql)) {
          const cats = [...new Set(tables[t].map(r => r.category).filter(Boolean))];
          return cats.map(c => ({ category: c }));
        }
        if (/WHERE\s+composite_id\s*=\s*\?/i.test(sql)) {
          return tables[t]
            .filter(r => r.composite_id === args[0])
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        }
        if (/WHERE\s+category\s*=\s*\?/i.test(sql) && !/DISTINCT/i.test(sql))
          return tables[t].filter(r => r.category === args[0]);
        if (/WHERE\s+step_id\s*=\s*\?/i.test(sql))
          return tables[t].filter(r => r.step_id === args[0]);
        return [...tables[t]];
      }),
    })),
    close: vi.fn(),
    transaction: vi.fn((fn: Function) => {
      const wrapper = (...args: any[]) => fn(...args);
      return wrapper;
    }),
    __table: (name: string) => tables[name] as any[],
    __reset: () => { Object.values(tables).forEach((t: any) => (t.length = 0)); },
  };
});

vi.mock('better-sqlite3', () => ({ default: vi.fn(function () { return mockDb; }) }));
vi.mock('uuid', () => ({ v4: vi.fn(() => '00000000-0000-0000-0000-000000000000') }));

// ── Helpers ──

function addStep(overrides: Record<string, any> = {}) {
  const row = { id: 'lib-1', name: 'Test Step', description: '', category: '', action: 'test_action', created_at: '2025-01-01T00:00:00.000Z', ...overrides };
  mockDb.__table('library_steps').push(row);
  return row;
}

function addParam(overrides: Record<string, any> = {}) {
  const row = { id: 'p-1', step_id: 'lib-1', name: 'param1', label: '', param_type: 'string', options: '', required: 0, default_value: '', ...overrides };
  mockDb.__table('step_parameters').push(row);
  return row;
}

function addComposite(overrides: Record<string, any> = {}) {
  const row = { id: 'comp-1', name: 'Comp A', description: '', category: '', parameters_json: '[]', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z', ...overrides };
  mockDb.__table('composite_steps').push(row);
  return row;
}

function addCompItem(overrides: Record<string, any> = {}) {
  const row = { id: 'ci-1', composite_id: 'comp-1', sort_order: 0, library_step_id: null, action: 'click', selector: '#btn', value: '', url: '', text: '', parameter_bindings_json: '{}', ...overrides };
  mockDb.__table('composite_step_items').push(row);
  return row;
}

// ── Build test app (mirrors src/index.ts routes) ──

function buildApp() {
  const db = mockDb as any;
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok', service: 'step-library-service' }));

  app.get('/api/steps', async () => {
    const steps = db.prepare('SELECT * FROM library_steps ORDER BY category, name').all() as any[];
    for (const step of steps) {
      step.parameters = db.prepare('SELECT * FROM step_parameters WHERE step_id = ?').all(step.id);
    }
    return steps;
  });

  app.get('/api/steps/:id', async (req: any, reply: any) => {
    const step = db.prepare('SELECT * FROM library_steps WHERE id = ?').get(req.params.id) as any;
    if (!step) { reply.code(404); return { error: 'Step not found' }; }
    step.parameters = db.prepare('SELECT * FROM step_parameters WHERE step_id = ?').all(step.id);
    return step;
  });

  app.get('/api/categories', async () => {
    const rows = db.prepare("SELECT DISTINCT category FROM library_steps WHERE category != '' ORDER BY category").all() as any[];
    return { categories: rows.map((r: any) => r.category) };
  });

  app.get('/api/composite-steps', async (req: any) => {
    const { category } = req.query as any;
    let stmt = 'SELECT * FROM composite_steps';
    const params: any[] = [];
    if (category) { stmt += ' WHERE category = ?'; params.push(category); }
    stmt += ' ORDER BY name';
    const composites = db.prepare(stmt).all(...params) as any[];
    for (const comp of composites) {
      comp.parameters = JSON.parse(comp.parameters_json || '[]');
      delete comp.parameters_json;
      comp.steps = db.prepare('SELECT * FROM composite_step_items WHERE composite_id = ? ORDER BY sort_order').all(comp.id) as any[];
      for (const item of comp.steps) {
        item.parameterBindings = JSON.parse(item.parameter_bindings_json || '{}');
        delete item.parameter_bindings_json;
        delete item.composite_id;
      }
    }
    return composites;
  });

  app.get('/api/composite-steps/:id', async (req: any, reply: any) => {
    const comp = db.prepare('SELECT * FROM composite_steps WHERE id = ?').get(req.params.id) as any;
    if (!comp) { reply.code(404); return { error: 'Composite step not found' }; }
    comp.parameters = JSON.parse(comp.parameters_json || '[]');
    delete comp.parameters_json;
    comp.steps = db.prepare('SELECT * FROM composite_step_items WHERE composite_id = ? ORDER BY sort_order').all(comp.id) as any[];
    for (const item of comp.steps) {
      item.parameterBindings = JSON.parse(item.parameter_bindings_json || '{}');
      delete item.parameter_bindings_json;
      delete item.composite_id;
    }
    return comp;
  });

  app.post('/api/composite-steps', async (req: any, reply: any) => {
    const { name, description, category, parameters, steps } = req.body;
    if (!name || !steps) { reply.code(400); return { error: 'name and steps are required' }; }
    const id = req.body.id || uuid();
    const now = new Date().toISOString();
    const parametersJson = JSON.stringify(parameters || []);
    const insertComp = db.prepare(
      'INSERT INTO composite_steps (id, name, description, category, parameters_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO composite_step_items (id, composite_id, sort_order, library_step_id, action, selector, value, url, text, parameter_bindings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const txn = db.transaction(() => {
      insertComp.run(id, name, description || '', category || '', parametersJson, now, now);
      for (let i = 0; i < steps.length; i++) {
        const item = steps[i];
        insertItem.run(uuid(), id, i, item.libraryStepId || null, item.action || '', item.selector || '', item.value || '', item.url || '', item.text || '', JSON.stringify(item.parameterBindings || {}));
      }
    });
    txn();
    reply.code(201);
    return { id };
  });

  app.put('/api/composite-steps/:id', async (req: any, reply: any) => {
    const existing = db.prepare('SELECT * FROM composite_steps WHERE id = ?').get(req.params.id) as any;
    if (!existing) { reply.code(404); return { error: 'Composite step not found' }; }
    const { name, description, category, parameters, steps } = req.body;
    const now = new Date().toISOString();
    const parametersJson = JSON.stringify(parameters !== undefined ? parameters : JSON.parse(existing.parameters_json || '[]'));
    db.prepare('UPDATE composite_steps SET name = COALESCE(?, name), description = COALESCE(?, description), category = COALESCE(?, category), parameters_json = ?, updated_at = ? WHERE id = ?')
      .run(name || null, description || null, category || null, parametersJson, now, req.params.id);
    if (steps) {
      const deleteItems = db.prepare('DELETE FROM composite_step_items WHERE composite_id = ?');
      const insertItem = db.prepare(
        'INSERT INTO composite_step_items (id, composite_id, sort_order, library_step_id, action, selector, value, url, text, parameter_bindings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const txn = db.transaction(() => {
        deleteItems.run(req.params.id);
        for (let i = 0; i < steps.length; i++) {
          const item = steps[i];
          insertItem.run(uuid(), req.params.id, i, item.libraryStepId || null, item.action || '', item.selector || '', item.value || '', item.url || '', item.text || '', JSON.stringify(item.parameterBindings || {}));
        }
      });
      txn();
    }
    return { ok: true };
  });

  app.delete('/api/composite-steps/:id', async (req: any, reply: any) => {
    const existing = db.prepare('SELECT * FROM composite_steps WHERE id = ?').get(req.params.id) as any;
    if (!existing) { reply.code(404); return { error: 'Composite step not found' }; }
    db.prepare('DELETE FROM composite_steps WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  app.post('/api/composite-steps/:id/expand', async (req: any, reply: any) => {
    const comp = db.prepare('SELECT * FROM composite_steps WHERE id = ?').get(req.params.id) as any;
    if (!comp) { reply.code(404); return { error: 'Composite step not found' }; }
    const parameters = JSON.parse(comp.parameters_json || '[]') as any[];
    const bindings = (req.body?.bindings || {}) as Record<string, string>;
    const resolve = (val: string): string => {
      if (!val) return '';
      return val.replace(/\{\{(\w+)\}\}/g, (_, key) => bindings[key] !== undefined ? String(bindings[key]) : `{{${key}}}`);
    };
    const items = db.prepare('SELECT * FROM composite_step_items WHERE composite_id = ? ORDER BY sort_order').all(comp.id) as any[];
    const expanded = items.map((item: any, idx: number) => {
      let action = resolve(item.action);
      const selector = resolve(item.selector || '');
      const value = resolve(item.value || '');
      const url = resolve(item.url || '');
      let text = resolve(item.text || '');
      if (item.library_step_id) {
        const libStep = db.prepare('SELECT * FROM library_steps WHERE id = ?').get(item.library_step_id) as any;
        if (libStep) {
          if (!action) action = resolve(libStep.action);
          if (!text && libStep.description) text = resolve(libStep.description);
        }
      }
      return { index: idx, action, selector, value, url, text };
    });
    return { id: comp.id, name: comp.name, description: resolve(comp.description || ''), parameters, expanded };
  });

  app.get('/api/composite-categories', async () => {
    const rows = db.prepare("SELECT DISTINCT category FROM composite_steps WHERE category != '' ORDER BY category").all() as any[];
    return { categories: rows.map((r: any) => r.category) };
  });

  return app;
}

let app: any;

beforeEach(() => {
  mockDb.__reset();
});

afterAll(async () => {
  if (app) await app.close();
});

// ── GET /health ──

describe('GET /health', () => {
  it('returns health status', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'step-library-service' });
  });
});

// ── GET /api/steps ──

describe('GET /api/steps', () => {
  it('returns empty array when no steps exist', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/steps' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns all steps with parameters', async () => {
    addStep({ id: 's1', name: 'Alpha', category: 'CatA', action: 'act1' });
    addStep({ id: 's2', name: 'Beta', category: 'CatB', action: 'act2' });
    addParam({ id: 'pa', step_id: 's1', name: 'x' });
    app = buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/steps' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe('s1');
    expect(body[0].parameters).toHaveLength(1);
    expect(body[0].parameters[0].name).toBe('x');
    expect(body[1].id).toBe('s2');
    expect(body[1].parameters).toEqual([]);
  });
});

// ── GET /api/steps/:id ──

describe('GET /api/steps/:id', () => {
  it('returns a step by id', async () => {
    addStep({ id: 's1', name: 'My Step' });
    addParam({ id: 'p1', step_id: 's1', name: 'p' });
    app = buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/steps/s1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('s1');
    expect(res.json().name).toBe('My Step');
    expect(res.json().parameters).toHaveLength(1);
  });

  it('returns 404 for unknown step', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/steps/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Step not found' });
  });
});

// ── GET /api/categories ──

describe('GET /api/categories', () => {
  it('returns distinct non-empty categories from library_steps', async () => {
    addStep({ id: 's1', category: 'Auth', action: 'login' });
    addStep({ id: 's2', category: 'Auth', action: 'logout' });
    addStep({ id: 's3', category: 'Nav', action: 'navigate' });
    addStep({ id: 's4', category: '', action: 'other' });
    app = buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categories: ['Auth', 'Nav'] });
  });

  it('returns empty list when no categories', async () => {
    addStep({ id: 's1', category: '', action: 'x' });
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(res.json()).toEqual({ categories: [] });
  });
});

// ── GET /api/composite-steps ──

describe('GET /api/composite-steps', () => {
  it('returns empty array when no composites', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/composite-steps' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns composites with parsed parameters and steps', async () => {
    addComposite({ id: 'c1', name: 'Comp1', category: 'CatX', parameters_json: JSON.stringify([{ name: 'url', type: 'string' }]) });
    addCompItem({ composite_id: 'c1', id: 'i1', action: 'navigate', selector: '#x', parameter_bindings_json: JSON.stringify({ url: 'url' }) });
    app = buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/composite-steps' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('c1');
    expect(body[0].parameters).toEqual([{ name: 'url', type: 'string' }]);
    expect(body[0].parameters_json).toBeUndefined();
    expect(body[0].steps).toHaveLength(1);
    expect(body[0].steps[0].action).toBe('navigate');
    expect(body[0].steps[0].parameterBindings).toEqual({ url: 'url' });
    expect(body[0].steps[0].parameter_bindings_json).toBeUndefined();
    expect(body[0].steps[0].composite_id).toBeUndefined();
  });

  it('filters by category query param', async () => {
    addComposite({ id: 'c1', name: 'A', category: 'Auth' });
    addComposite({ id: 'c2', name: 'B', category: 'Nav' });
    addCompItem({ composite_id: 'c1' });
    addCompItem({ composite_id: 'c2' });
    app = buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/composite-steps?category=Auth' });
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('c1');
  });
});

// ── GET /api/composite-steps/:id ──

describe('GET /api/composite-steps/:id', () => {
  it('returns a composite step by id', async () => {
    addComposite({ id: 'c1', name: 'My Comp', parameters_json: JSON.stringify([{ name: 'x', type: 'string' }]) });
    addCompItem({ composite_id: 'c1', id: 'i1', action: 'fill' });
    app = buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/composite-steps/c1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('c1');
    expect(res.json().name).toBe('My Comp');
    expect(res.json().parameters).toEqual([{ name: 'x', type: 'string' }]);
    expect(res.json().steps).toHaveLength(1);
  });

  it('returns 404 for unknown composite', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/composite-steps/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Composite step not found' });
  });
});

// ── POST /api/composite-steps ──

describe('POST /api/composite-steps', () => {
  it('creates a composite step and returns its id', async () => {
    app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/composite-steps',
      payload: { name: 'New Comp', description: 'A new composite', category: 'Test', parameters: [{ name: 'url', type: 'string' }], steps: [{ action: 'navigate', url: 'https://ex.com' }, { action: 'click', selector: '#btn' }] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBeDefined();

    expect(mockDb.__table('composite_steps')).toHaveLength(1);
    expect(mockDb.__table('composite_steps')[0].name).toBe('New Comp');
    expect(mockDb.__table('composite_step_items')).toHaveLength(2);
    expect(mockDb.__table('composite_step_items')[0].action).toBe('navigate');
  });

  it('uses a custom id when provided in body', async () => {
    app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/composite-steps',
      payload: { id: 'my-custom-id', name: 'Custom', steps: [{ action: 'click' }] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe('my-custom-id');
  });

  it('returns 400 when name is missing', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/composite-steps', payload: { steps: [{ action: 'click' }] } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'name and steps are required' });
  });

  it('returns 400 when steps is missing', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/composite-steps', payload: { name: 'X' } });
    expect(res.statusCode).toBe(400);
  });
});

// ── PUT /api/composite-steps/:id ──

describe('PUT /api/composite-steps/:id', () => {
  it('updates composite step metadata', async () => {
    addComposite({ id: 'c1', name: 'Old Name', category: 'Old' });
    app = buildApp();

    const res = await app.inject({
      method: 'PUT', url: '/api/composite-steps/c1',
      payload: { name: 'New Name', category: 'New' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(mockDb.__table('composite_steps')[0].name).toBe('New Name');
    expect(mockDb.__table('composite_steps')[0].category).toBe('New');
  });

  it('replaces steps when steps array is provided', async () => {
    addComposite({ id: 'c1', name: 'Comp' });
    addCompItem({ composite_id: 'c1', id: 'old-item', action: 'old_action' });
    app = buildApp();

    const res = await app.inject({
      method: 'PUT', url: '/api/composite-steps/c1',
      payload: { steps: [{ action: 'new_action', selector: '#x' }] },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDb.__table('composite_step_items')).toHaveLength(1);
    expect(mockDb.__table('composite_step_items')[0].action).toBe('new_action');
  });

  it('returns 404 for unknown composite', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'PUT', url: '/api/composite-steps/nope', payload: { name: 'X' } });
    expect(res.statusCode).toBe(404);
  });
});

// ── DELETE /api/composite-steps/:id ──

describe('DELETE /api/composite-steps/:id', () => {
  it('deletes a composite step and its items (cascade)', async () => {
    addComposite({ id: 'c1', name: 'To Delete' });
    addCompItem({ composite_id: 'c1', id: 'i1' });
    app = buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/api/composite-steps/c1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(mockDb.__table('composite_steps')).toHaveLength(0);
    expect(mockDb.__table('composite_step_items')).toHaveLength(0);
  });

  it('returns 404 for unknown composite', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/api/composite-steps/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Composite step not found' });
  });
});

// ── POST /api/composite-steps/:id/expand ──

describe('POST /api/composite-steps/:id/expand', () => {
  it('expands a composite step resolving parameter bindings', async () => {
    addStep({ id: 'lib-fill', action: 'fill_field', description: 'Fill field {{field}}' });
    addComposite({ id: 'c1', name: 'Login', description: 'Login flow for {{env}}', parameters_json: JSON.stringify([{ name: 'url', type: 'string' }, { name: 'username', type: 'string' }]) });
    addCompItem({ composite_id: 'c1', id: 'i1', sort_order: 0, library_step_id: null, action: 'navigate', url: '{{url}}', text: 'Open {{url}}' });
    addCompItem({ composite_id: 'c1', id: 'i2', sort_order: 1, library_step_id: 'lib-fill', action: '', selector: '#username', value: '{{username}}', text: '' });
    app = buildApp();

    const res = await app.inject({
      method: 'POST', url: '/api/composite-steps/c1/expand',
      payload: { bindings: { url: 'https://jira.example.com', username: 'admin', env: 'staging', field: 'some field' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe('c1');
    expect(body.name).toBe('Login');
    expect(body.description).toBe('Login flow for staging');
    expect(body.parameters).toHaveLength(2);
    expect(body.expanded).toHaveLength(2);
    expect(body.expanded[0].action).toBe('navigate');
    expect(body.expanded[0].url).toBe('https://jira.example.com');
    expect(body.expanded[0].text).toBe('Open https://jira.example.com');
    expect(body.expanded[1].action).toBe('fill_field');
    expect(body.expanded[1].text).toBe('Fill field some field');
    expect(body.expanded[1].selector).toBe('#username');
    expect(body.expanded[1].value).toBe('admin');
  });

  it('handles missing bindings — keeps {{template}} intact', async () => {
    addComposite({ id: 'c1', name: 'Test', parameters_json: '[]' });
    addCompItem({ composite_id: 'c1', action: 'navigate', url: '{{missing}}' });
    app = buildApp();

    const res = await app.inject({ method: 'POST', url: '/api/composite-steps/c1/expand', payload: { bindings: {} } });
    expect(res.statusCode).toBe(200);
    expect(res.json().expanded[0].url).toBe('{{missing}}');
  });

  it('handles empty string values', async () => {
    addComposite({ id: 'c1', name: 'Test', parameters_json: '[]' });
    addCompItem({ composite_id: 'c1', action: 'navigate', url: '', value: '' });
    app = buildApp();

    const res = await app.inject({ method: 'POST', url: '/api/composite-steps/c1/expand', payload: { bindings: {} } });
    expect(res.statusCode).toBe(200);
    expect(res.json().expanded[0].url).toBe('');
  });

  it('returns 404 for unknown composite', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/composite-steps/nope/expand', payload: { bindings: {} } });
    expect(res.statusCode).toBe(404);
  });
});

// ── GET /api/composite-categories ──

describe('GET /api/composite-categories', () => {
  it('returns distinct non-empty categories from composite_steps', async () => {
    addComposite({ id: 'c1', category: 'Auth', name: 'A' });
    addComposite({ id: 'c2', category: 'Auth', name: 'B' });
    addComposite({ id: 'c3', category: 'Nav', name: 'C' });
    addComposite({ id: 'c4', category: '', name: 'D' });
    app = buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/composite-categories' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categories: ['Auth', 'Nav'] });
  });

  it('returns empty list when no categories', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/composite-categories' });
    expect(res.json()).toEqual({ categories: [] });
  });
});
