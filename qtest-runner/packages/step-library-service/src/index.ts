import Fastify from 'fastify';
import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuid } from 'uuid';

const PORT = parseInt(process.env.PORT || '3002', 10);
const DB_PATH = path.join(__dirname, '..', 'steps.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS library_steps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    action TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS step_parameters (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL,
    name TEXT NOT NULL,
    label TEXT DEFAULT '',
    param_type TEXT DEFAULT 'string',
    options TEXT DEFAULT '',
    required INTEGER DEFAULT 0,
    default_value TEXT DEFAULT '',
    FOREIGN KEY (step_id) REFERENCES library_steps(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS composite_steps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    parameters_json TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS composite_step_items (
    id TEXT PRIMARY KEY,
    composite_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    library_step_id TEXT,
    action TEXT NOT NULL,
    selector TEXT DEFAULT '',
    value TEXT DEFAULT '',
    url TEXT DEFAULT '',
    text TEXT DEFAULT '',
    parameter_bindings_json TEXT DEFAULT '{}',
    FOREIGN KEY (composite_id) REFERENCES composite_steps(id) ON DELETE CASCADE
  );
`);

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok', service: 'step-library-service' }));

// ── Library Steps ──
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

// ── Composite Steps CRUD ──
app.get('/api/composite-steps', async (req: any) => {
  const { category } = req.query as any;
  let stmt = 'SELECT * FROM composite_steps';
  const params: any[] = [];
  if (category) {
    stmt += ' WHERE category = ?';
    params.push(category);
  }
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
      insertItem.run(
        uuid(), id, i,
        item.libraryStepId || null,
        item.action || '',
        item.selector || '',
        item.value || '',
        item.url || '',
        item.text || '',
        JSON.stringify(item.parameterBindings || {})
      );
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
  db.prepare(
    'UPDATE composite_steps SET name = COALESCE(?, name), description = COALESCE(?, description), category = COALESCE(?, category), parameters_json = ?, updated_at = ? WHERE id = ?'
  ).run(name || null, description || null, category || null, parametersJson, now, req.params.id);
  if (steps) {
    const deleteItems = db.prepare('DELETE FROM composite_step_items WHERE composite_id = ?');
    const insertItem = db.prepare(
      'INSERT INTO composite_step_items (id, composite_id, sort_order, library_step_id, action, selector, value, url, text, parameter_bindings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const txn = db.transaction(() => {
      deleteItems.run(req.params.id);
      for (let i = 0; i < steps.length; i++) {
        const item = steps[i];
        insertItem.run(
          uuid(), req.params.id, i,
          item.libraryStepId || null,
          item.action || '',
          item.selector || '',
          item.value || '',
          item.url || '',
          item.text || '',
          JSON.stringify(item.parameterBindings || {})
        );
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

// ── Expand ──
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

// ── Seed ──
function seed() {
  db.exec(`
    INSERT OR IGNORE INTO library_steps (id, name, description, category, action) VALUES
      ('lib-login', 'Авторизация в Jira', 'Вход в систему Jira под указанным пользователем', 'Авторизация', 'login'),
      ('lib-logout', 'Выход из системы', 'Завершение сессии текущего пользователя', 'Авторизация', 'logout'),
      ('lib-switch-user', 'Смена пользователя', 'Переключение между пользователями (logout → login)', 'Авторизация', 'switch_user'),
      ('lib-click-btn', 'Нажать кнопку', 'Нажать на кнопку с указанным текстом', 'Навигация', 'click_button'),
      ('lib-fill-field', 'Заполнить поле', 'Ввести текст в указанное поле', 'Ввод данных', 'fill_field'),
      ('lib-navigate', 'Перейти по URL', 'Открыть указанный URL в браузере', 'Навигация', 'navigate'),
      ('lib-verify-text', 'Проверить текст', 'Проверить наличие текста на странице', 'Проверки', 'verify_text'),
      ('lib-screenshot', 'Сделать скриншот', 'Сделать скриншот текущего состояния', 'Проверки', 'screenshot');
  `);
  const cnt = db.prepare("SELECT COUNT(*) as c FROM composite_steps").get() as any;
  if (cnt.c > 0) return;
  const now = new Date().toISOString();
  const insertComp = db.prepare(
    'INSERT INTO composite_steps (id, name, description, category, parameters_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO composite_step_items (id, composite_id, sort_order, library_step_id, action, selector, value, url, text, parameter_bindings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const seedTxn = db.transaction(() => {
    // comp-jira-login
    insertComp.run('comp-jira-login', 'Авторизация в Jira',
      'Вход в Jira: открыть страницу логина, ввести логин/пароль, нажать Войти',
      'Авторизация',
      JSON.stringify([
        { name: 'url', label: 'URL Jira', type: 'url', options: [], required: true, defaultValue: '' },
        { name: 'username', label: 'Логин', type: 'string', options: [], required: true, defaultValue: '' },
        { name: 'password', label: 'Пароль', type: 'string', options: [], required: true, defaultValue: '' },
      ]),
      now, now);
    insertItem.run(uuid(), 'comp-jira-login', 0, null, 'navigate', '', '', '{{url}}', 'Открыть страницу логина Jira', '{}');
    insertItem.run(uuid(), 'comp-jira-login', 1, 'lib-fill-field', '', '#username', '{{username}}', '', '', '{}');
    insertItem.run(uuid(), 'comp-jira-login', 2, 'lib-fill-field', '', '#password', '{{password}}', '', '', '{}');
    insertItem.run(uuid(), 'comp-jira-login', 3, 'lib-click-btn', '', '#login-button', '', '', '', '{}');

    // comp-create-task
    insertComp.run('comp-create-task', 'Создание задачи в Jira',
      'Создание новой задачи: открыть форму создания, заполнить поля, создать',
      'Задачи',
      JSON.stringify([
        { name: 'projectUrl', label: 'URL проекта', type: 'url', options: [], required: true, defaultValue: '' },
        { name: 'summary', label: 'Тема', type: 'string', options: [], required: true, defaultValue: '' },
        { name: 'description', label: 'Описание', type: 'string', options: [], required: false, defaultValue: '' },
      ]),
      now, now);
    insertItem.run(uuid(), 'comp-create-task', 0, 'lib-navigate', '', '', '', '{{projectUrl}}', 'Открыть страницу создания задачи', '{}');
    insertItem.run(uuid(), 'comp-create-task', 1, 'lib-fill-field', '', '#summary', '{{summary}}', '', '', '{}');
    insertItem.run(uuid(), 'comp-create-task', 2, 'lib-fill-field', '', '#description', '{{description}}', '', '', '{}');
    insertItem.run(uuid(), 'comp-create-task', 3, 'lib-click-btn', '', '#create-issue-submit', '', '', '', '{}');

    // comp-screenshot-verify
    insertComp.run('comp-screenshot-verify', 'Скриншот и проверка текста',
      'Сделать скриншот и проверить наличие текста на странице',
      'Проверки',
      JSON.stringify([
        { name: 'text', label: 'Текст для проверки', type: 'string', options: [], required: true, defaultValue: '' },
      ]),
      now, now);
    insertItem.run(uuid(), 'comp-screenshot-verify', 0, 'lib-screenshot', '', '', '', '', 'Сделать скриншот', '{}');
    insertItem.run(uuid(), 'comp-screenshot-verify', 1, 'lib-verify-text', '', '', '', '', '{{text}}', '{"text":"text"}');
  });
  seedTxn();
}

seed();

function gracefulShutdown(signal: string) {
  console.log(`[${signal}] Shutting down step-library-service...`);
  app.close().then(() => {
    db.close();
    console.log('step-library-service stopped');
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
    console.log(`step-library-service running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
