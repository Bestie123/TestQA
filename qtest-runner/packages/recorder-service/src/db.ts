import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuid } from 'uuid';

const DB_PATH = path.join(__dirname, '..', 'recordings.db');

let db: Database.Database;

export interface RecordedAction {
  id: string;
  sessionId: string;
  actionType: string;
  selector: string;
  selectorText: string;
  value: string;
  url: string;
  pageTitle: string;
  tabId: string;
  screenshot: string;
  timestamp: string;
  index: number;
  // Extended fields
  method: string;
  resourceType: string;
  postData: string;
  headers: string;
  status: number;
  body: string;
  error: string;
  level: string;
  combo: string;
  modifiers: string;
  inputType: string;
  checked: boolean;
  optionIndex: number;
  x: number;
  y: number;
  scrollY: number;
  scrollMax: number;
  shadowDom: boolean;
  displayValue: string;
  frameName: string;
  frameUrl: string;
  frameSelector: string;
  iframeAction: boolean;
}

export interface RecordingSession {
  id: string;
  name: string;
  status: string;
  profileId: string;
  startedAt: string;
  stoppedAt: string;
  actions: RecordedAction[];
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recording_sessions (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'recording',
      profile_id TEXT DEFAULT '',
      started_at TEXT DEFAULT (datetime('now')),
      stopped_at TEXT
    );
    CREATE TABLE IF NOT EXISTS recorded_actions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      selector TEXT DEFAULT '',
      selector_text TEXT DEFAULT '',
      value TEXT DEFAULT '',
      url TEXT DEFAULT '',
      page_title TEXT DEFAULT '',
      tab_id TEXT DEFAULT '',
      screenshot TEXT DEFAULT '',
      timestamp TEXT DEFAULT (datetime('now')),
      idx INTEGER NOT NULL,
      method TEXT DEFAULT '',
      resource_type TEXT DEFAULT '',
      post_data TEXT DEFAULT '',
      headers_json TEXT DEFAULT '{}',
      status_code INTEGER DEFAULT 0,
      response_body TEXT DEFAULT '',
      error TEXT DEFAULT '',
      level TEXT DEFAULT '',
      combo TEXT DEFAULT '',
      modifiers TEXT DEFAULT '',
      input_type TEXT DEFAULT '',
      checked INTEGER DEFAULT 0,
      option_index INTEGER DEFAULT 0,
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      scroll_y REAL DEFAULT 0,
      scroll_max REAL DEFAULT 0,
      shadow_dom INTEGER DEFAULT 0,
      display_value TEXT DEFAULT '',
      frame_name TEXT DEFAULT '',
      frame_url TEXT DEFAULT '',
      frame_selector TEXT DEFAULT '',
      iframe_action INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_actions_session ON recorded_actions(session_id);
    CREATE INDEX IF NOT EXISTS idx_actions_type ON recorded_actions(action_type);
    CREATE TABLE IF NOT EXISTS composite_steps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      steps_json TEXT DEFAULT '[]',
      parameters_json TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_switch_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      hotkey TEXT DEFAULT 'Ctrl+Shift+U',
      enabled INTEGER DEFAULT 1,
      profiles_json TEXT DEFAULT '[]'
    );
  `);
  // Migration: add columns that may not exist in old databases
  const migrations = [
    'ALTER TABLE recorded_actions ADD COLUMN input_type TEXT DEFAULT \'\'',
    'ALTER TABLE recorded_actions ADD COLUMN checked INTEGER DEFAULT 0',
    'ALTER TABLE recorded_actions ADD COLUMN option_index INTEGER DEFAULT 0',
    'ALTER TABLE recorded_actions ADD COLUMN x INTEGER DEFAULT 0',
    'ALTER TABLE recorded_actions ADD COLUMN y INTEGER DEFAULT 0',
    'ALTER TABLE recorded_actions ADD COLUMN scroll_y INTEGER DEFAULT 0',
    'ALTER TABLE recorded_actions ADD COLUMN scroll_max INTEGER DEFAULT 0',
    'ALTER TABLE recorded_actions ADD COLUMN shadow_dom INTEGER DEFAULT 0',
    'ALTER TABLE recorded_actions ADD COLUMN display_value TEXT DEFAULT \'\'',
    'ALTER TABLE recorded_actions ADD COLUMN frame_name TEXT DEFAULT \'\'',
    'ALTER TABLE recorded_actions ADD COLUMN frame_url TEXT DEFAULT \'\'',
    'ALTER TABLE recorded_actions ADD COLUMN frame_selector TEXT DEFAULT \'\'',
    'ALTER TABLE recorded_actions ADD COLUMN iframe_action INTEGER DEFAULT 0',
  ];
  for (const m of migrations) {
    try { db.exec(m); } catch {}
  }
}

export function createSession(name: string, profileId: string): RecordingSession {
  const d = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  d.prepare(`INSERT INTO recording_sessions (id, name, status, profile_id, started_at) VALUES (?, ?, 'recording', ?, ?)`)
    .run(id, name, profileId, now);
  return { id, name, status: 'recording', profileId, startedAt: now, stoppedAt: '', actions: [] };
}

export function stopSession(sessionId: string): RecordingSession | null {
  const d = getDb();
  const now = new Date().toISOString();
  const result = d.prepare(`UPDATE recording_sessions SET status = 'stopped', stopped_at = ? WHERE id = ?`).run(now, sessionId);
  if (result.changes === 0) return null;
  return getSession(sessionId);
}

function mapAction(row: any): RecordedAction {
  return {
    id: row.id,
    sessionId: row.session_id,
    actionType: row.action_type,
    selector: row.selector,
    selectorText: row.selector_text,
    value: row.value,
    url: row.url,
    pageTitle: row.page_title,
    tabId: row.tab_id,
    screenshot: row.screenshot,
    timestamp: row.timestamp,
    index: row.idx,
    method: row.method || '',
    resourceType: row.resource_type || '',
    postData: row.post_data || '',
    headers: row.headers_json || '{}',
    status: row.status_code || 0,
    body: row.response_body || '',
    error: row.error || '',
    level: row.level || '',
    combo: row.combo || '',
    modifiers: row.modifiers || '',
    inputType: row.input_type || '',
    checked: !!row.checked,
    optionIndex: row.option_index || 0,
    x: row.x || 0,
    y: row.y || 0,
    scrollY: row.scroll_y || 0,
    scrollMax: row.scroll_max || 0,
    shadowDom: !!row.shadow_dom,
    displayValue: row.display_value || '',
    frameName: row.frame_name || '',
    frameUrl: row.frame_url || '',
    frameSelector: row.frame_selector || '',
    iframeAction: !!row.iframe_action,
  };
}

export function getSession(sessionId: string): RecordingSession | null {
  const d = getDb();
  const row = d.prepare('SELECT * FROM recording_sessions WHERE id = ?').get(sessionId) as any;
  if (!row) return null;
  const actions = (d.prepare('SELECT * FROM recorded_actions WHERE session_id = ? ORDER BY idx').all(sessionId) as any[]).map(mapAction);
  return {
    id: row.id, name: row.name, status: row.status,
    profileId: row.profile_id, startedAt: row.started_at,
    stoppedAt: row.stopped_at || '', actions,
  };
}

export function listSessions(): RecordingSession[] {
  const d = getDb();
  const rows = d.prepare(`
    SELECT rs.*, (SELECT COUNT(*) FROM recorded_actions ra WHERE ra.session_id = rs.id) as action_count
    FROM recording_sessions rs ORDER BY rs.started_at DESC
  `).all() as any[];
  return rows.map((r: any) => ({
    id: r.id, name: r.name, status: r.status,
    profileId: r.profile_id, startedAt: r.started_at,
    stoppedAt: r.stopped_at || '',
    actionCount: r.action_count || 0,
    actions: [],
  }));
}

export function addAction(sessionId: string, action: Omit<RecordedAction, 'id' | 'sessionId' | 'index'>): RecordedAction {
  const d = getDb();
  const id = uuid();
  const maxIdx = d.prepare('SELECT COALESCE(MAX(idx), -1) + 1 AS next FROM recorded_actions WHERE session_id = ?').get(sessionId) as any;
  // Ensure all fields have explicit defaults — better-sqlite3 v11 rejects undefined
  const vals: any[] = [
    id,
    sessionId,
    action.actionType ?? '',
    action.selector ?? '',
    action.selectorText ?? '',
    action.value ?? '',
    action.url ?? '',
    action.pageTitle ?? '',
    action.tabId ?? '',
    action.screenshot ?? '',
    action.timestamp ?? new Date().toISOString(),
    maxIdx.next ?? 0,
    action.method ?? '',
    action.resourceType ?? '',
    action.postData ?? '',
    action.headers ? (typeof action.headers === 'string' ? action.headers : JSON.stringify(action.headers)) : '{}',
    action.status ?? 0,
    action.body ?? '',
    action.error ?? '',
    action.level ?? '',
    action.combo ?? '',
    action.modifiers ?? '',
    action.inputType ?? '',
    action.checked ? 1 : 0,
    action.optionIndex ?? 0,
    action.x ?? 0,
    action.y ?? 0,
    action.scrollY ?? 0,
    action.scrollMax ?? 0,
    action.shadowDom ? 1 : 0,
    action.displayValue ?? '',
    action.frameName ?? '',
    action.frameUrl ?? '',
    action.frameSelector ?? '',
    action.iframeAction ? 1 : 0,
  ];
    const sql = `INSERT INTO recorded_actions (id, session_id, action_type, selector, selector_text, value, url, page_title, tab_id, screenshot, timestamp, idx, method, resource_type, post_data, headers_json, status_code, response_body, error, level, combo, modifiers, input_type, checked, option_index, x, y, scroll_y, scroll_max, shadow_dom, display_value, frame_name, frame_url, frame_selector, iframe_action) VALUES (${vals.map(() => '?').join(', ')})`;
    d.prepare(sql).run(...vals);
    return { id, sessionId, index: maxIdx.next, ...action };
}

export function addActionsBulk(sessionId: string, actions: Omit<RecordedAction, 'id' | 'sessionId' | 'index'>[]): RecordedAction[] {
  const results: RecordedAction[] = [];
  for (const a of actions) {
    try {
      results.push(addAction(sessionId, a));
    } catch (err: any) {
      console.error(`[recorder-service] addAction error: ${err.message} actionType=${a.actionType}`);
      throw err;
    }
  }
  return results;
}

export interface ConvertedStep {
  action: string;
  testData: string;
  expectedResult: string;
  // Extended fields for detailed test case format
  actionType: string;
  selector: string;
  selectorText: string;
  url: string;
  pageTitle: string;
  timestamp: string;
  httpMethod: string;
  httpStatus: number;
  httpUrl: string;
  requestBody: string;
  responseBody: string;
  curl: string;
  combo: string;
  displayValue: string;
  screenshot: string;
}

export function convertToSteps(sessionId: string): ConvertedStep[] {
  const session = getSession(sessionId);
  if (!session) return [];
  const steps: ConvertedStep[] = [];
  let hasNavigate = false;
  let lastUrl = '';
  let lastDragSource: RecordedAction | null = null;

  function makeStep(a: RecordedAction, action: string, testData: string, expectedResult: string): ConvertedStep {
    return {
      action,
      testData,
      expectedResult,
      actionType: a.actionType,
      selector: a.selector || '',
      selectorText: a.selectorText || '',
      url: a.url || '',
      pageTitle: a.pageTitle || '',
      timestamp: a.timestamp || '',
      httpMethod: a.method || '',
      httpStatus: a.status || 0,
      httpUrl: a.url || '',
      requestBody: a.postData || '',
      responseBody: (a.body || '').slice(0, 200),
      curl: '',
      combo: a.combo || '',
      displayValue: '',
      screenshot: a.screenshot || '',
    };
  }

  function makeCurl(method: string, url: string, postData?: string): string {
    if (!url) return '';
    let cmd = `curl -X ${method || 'GET'} "${url}"`;
    if (postData) {
      cmd += ` -H 'Content-Type: application/json' -d '${postData}'`;
    }
    return cmd;
  }

  for (const a of session.actions) {
    switch (a.actionType) {
      case 'navigate':
        if (a.url === lastUrl) break;
        lastUrl = a.url;
        hasNavigate = true;
        steps.push(makeStep(a,
          `Перейти по URL ${a.url || ''}`,
          a.url || '',
          `Страница загружена${a.pageTitle ? ': "' + a.pageTitle + '"' : ''}`
        ));
        break;
      case 'page_load':
        if (!hasNavigate && a.url) {
          hasNavigate = true;
          steps.push(makeStep(a,
            `Перейти по URL ${a.url}`,
            a.url,
            `Страница загружена${a.pageTitle ? ': "' + a.pageTitle + '"' : ''}`
          ));
        }
        break;
      case 'click':
        steps.push(makeStep(a,
          `Нажать "${a.selectorText || ''}" [selector=${a.selector}]`,
          '',
          'Элемент активирован'
        ));
        break;
      case 'dblclick':
        steps.push(makeStep(a,
          `Дважды нажать "${a.selectorText || ''}" [selector=${a.selector}]`,
          '',
          'Элемент активирован'
        ));
        break;
      case 'fill':
      case 'input':
        steps.push(makeStep(a,
          `Заполнить "${a.selectorText || ''}" [selector=${a.selector}] = "${(a.value || '').slice(0, 60)}"`,
          a.value || '',
          'Поле заполнено'
        ));
        break;
      case 'select': {
        const step = makeStep(a,
          `Выбрать "${a.value}" в "${a.selectorText || ''}" [selector=${a.selector}]`,
          a.value || '',
          'Значение выбрано'
        );
        step.displayValue = a.value || '';
        steps.push(step);
        break;
      }
      case 'keypress': {
        const combo = a.combo || a.value;
        if (a.value === 'Enter') {
          steps.push(makeStep(a,
            `Нажать Enter на "${a.selectorText || ''}" [selector=${a.selector}]`,
            '',
            'Действие выполнено'
          ));
        } else if (a.value === 'Tab') {
          steps.push(makeStep(a, 'Нажать Tab', '', 'Фокус перемещён'));
        } else if (a.value === 'Escape') {
          steps.push(makeStep(a, 'Нажать Escape', '', 'Действие отменено'));
        } else if (combo && combo !== a.value) {
          steps.push(makeStep(a,
            `Нажать ${combo} на "${a.selectorText || ''}" [selector=${a.selector}]`,
            '',
            'Действие выполнено'
          ));
        } else {
          steps.push(makeStep(a,
            `Нажать клавишу "${a.value}"`,
            '',
            'Клавиша нажата'
          ));
        }
        break;
      }
      case 'check':
        steps.push(makeStep(a,
          `${a.value === 'checked' ? 'Отметить' : 'Снять отметку'} "${a.selectorText || ''}" [selector=${a.selector}, type=${a.inputType || ''}]`,
          '',
          `Состояние: ${a.value}`
        ));
        break;
      case 'dragstart':
        lastDragSource = a;
        break;
      case 'drop':
        if (lastDragSource) {
          steps.push(makeStep(a,
            `Перетащить "${lastDragSource.selectorText || ''}" в "${a.selectorText || ''}"`,
            lastDragSource.selector || '',
            'Элемент перетащен'
          ));
          lastDragSource = null;
        } else {
          steps.push(makeStep(a,
            `Перетащить элемент в "${a.selectorText || ''}"`,
            '',
            'Элемент перетащен'
          ));
        }
        break;
      case 'dragend':
        break;
      case 'submit':
        steps.push(makeStep(a,
          `Отправить форму "${a.selectorText || a.selector || ''}"`,
          '',
          'Форма отправлена'
        ));
        break;
      case 'switch_user':
        steps.push(makeStep(a,
          `Сменить пользователя`,
          a.value || '',
          'Пользователь сменён'
        ));
        break;
      case 'focus':
        break;
      case 'contextmenu':
        steps.push(makeStep(a,
          `Нажать правой кнопкой на "${a.selectorText || ''}" [x=${a.x}, y=${a.y}]`,
          '',
          'Контекстное меню открыто'
        ));
        break;
      case 'element_appear':
        steps.push(makeStep(a,
          `Появился <${a.value || ''}> "${a.selectorText || ''}" [selector=${a.selector}]`,
          '',
          'Элемент виден на странице'
        ));
        break;
      case 'element_remove':
      case 'attr_change':
      case 'text_change':
        break;
      case 'element_resize':
        steps.push(makeStep(a,
          `Элемент "${a.selectorText || ''}" изменил размер: ${a.value || ''}`,
          a.value || '',
          'Размер элемента изменился'
        ));
        break;
      case 'element_intersect':
        steps.push(makeStep(a,
          `Элемент "${a.selectorText || ''}" стал ${(a.value || '').startsWith('visible') ? 'видим' : 'скрыт'}`,
          a.value || '',
          'Видимость элемента изменилась'
        ));
        break;
      case 'scroll':
        steps.push(makeStep(a,
          `Прокрутить страницу до ${a.value || 'позиции'}`,
          '',
          'Страница прокручена'
        ));
        break;
      case 'dialog':
        steps.push(makeStep(a,
          `Диалог "${a.selectorText || ''}": "${(a.value || '').slice(0, 60)}"`,
          a.value || '',
          'Диалог обработан'
        ));
        break;
      case 'resize':
      case 'clipboard':
        break;
      case 'request': {
        const step = makeStep(a,
          `HTTP ${a.method} ${a.url || ''}`,
          a.postData || '',
          'Запрос отправлен'
        );
        step.httpMethod = a.method || 'GET';
        step.httpUrl = a.url || '';
        step.requestBody = a.postData || '';
        step.curl = makeCurl(a.method, a.url || '', a.postData || '');
        steps.push(step);
        break;
      }
      case 'response': {
        const isOk = a.status && a.status >= 200 && a.status < 300;
        const step = makeStep(a,
          `HTTP ${a.method} ${a.url || ''} → ${a.status || '???'} ${isOk ? 'OK' : 'ERROR'}`,
          (a.body || '').slice(0, 200),
          isOk ? 'Ответ получен' : `Ошибка: ${a.status}`
        );
        step.httpMethod = a.method || '';
        step.httpStatus = a.status || 0;
        step.httpUrl = a.url || '';
        step.responseBody = (a.body || '').slice(0, 200);
        step.curl = makeCurl(a.method || 'GET', a.url || '');
        steps.push(step);
        break;
      }
      case 'request_failed':
        steps.push(makeStep(a,
          `HTTP ${a.method || 'GET'} ${a.url || ''} → ОШИБКА: ${a.error || 'unknown'}`,
          '',
          `Ошибка: ${a.error || 'unknown'}`
        ));
        break;
      case 'js_error':
        steps.push(makeStep(a,
          `JavaScript ошибка: ${(a.value || '').slice(0, 100)}`,
          a.value || '',
          'Ошибка зафиксирована'
        ));
        break;
      case 'unhandled_rejection':
        steps.push(makeStep(a,
          `Необработанный Promise: ${(a.value || '').slice(0, 100)}`,
          a.value || '',
          'Ошибка зафиксирована'
        ));
        break;
      case 'cookie_consent':
        steps.push(makeStep(a,
          `Обнаружен Cookie Consent баннер`,
          '',
          'Баннер обработан'
        ));
        break;
      case 'jira_env':
        break; // informational, skip
      case 'captcha_detected':
        steps.push(makeStep(a,
          `Обнаружена CAPTCHA: ${a.selectorText || a.value || 'неизвестный тип'}`,
          '',
          'Требуется ручное прохождение CAPTCHA или автоматическое решение'
        ));
        break;
      case 'touchstart':
        steps.push(makeStep(a,
          `Нажать на экран (touch) по [${a.x}, ${a.y}] на "${a.selectorText || ''}"`,
          '',
          'Касание зафиксировано'
        ));
        break;
      case 'touchend':
        break;
      case 'touchmove':
        steps.push(makeStep(a,
          `Свайп по экрану в позицию ${a.value || ''}`,
          '',
          'Жест зафиксирован'
        ));
        break;
      case 'transition_end':
        steps.push(makeStep(a,
          `CSS transition "${a.selectorText || ''}" завершена (${a.value || ''})`,
          '',
          'Анимация завершена'
        ));
        break;
      case 'animation_end':
        steps.push(makeStep(a,
          `CSS animation "${a.selectorText || ''}" завершена (${a.value || ''})`,
          '',
          'Анимация завершена'
        ));
        break;
      case 'visibility_change':
        steps.push(makeStep(a,
          `Видимость страницы изменилась: ${a.value === 'hidden' ? 'вкладка скрыта' : 'вкладка активна'}`,
          '',
          'Изменение видимости зафиксировано'
        ));
        break;
      case 'file_upload':
        steps.push(makeStep(a,
          `Загрузить файл "${(a.value || '').slice(0, 100)}" в "${a.selectorText || ''}"`,
          a.value || '',
          'Файл загружен'
        ));
        break;
      case 'user_switch':
        steps.push(makeStep(a,
          `Переключить пользователя с "${(a.selectorText || 'текущий')}" на "${(a.value || 'следующий')}"`,
          '',
          `Пользователь переключён на "${a.value}"`
        ));
        break;
      case 'popover_toggle':
        steps.push(makeStep(a,
          `Поповер "${(a.selectorText || a.selector || '')}" ${(a.value || '').includes('show') ? 'открыт' : 'закрыт'}`,
          '',
          `Поповер ${(a.value || '').includes('show') ? 'открыт' : 'закрыт'}`
        ));
        break;
      case 'media_play':
        steps.push(makeStep(a,
          `Воспроизвести медиа "${(a.selectorText || a.selector || '')}"`,
          '',
          'Медиа начало воспроизведение'
        ));
        break;
      case 'media_pause':
        steps.push(makeStep(a,
          `Поставить на паузу медиа "${(a.selectorText || a.selector || '')}"`,
          '',
          'Медиа поставлено на паузу'
        ));
        break;
      case 'media_seeked':
        steps.push(makeStep(a,
          `Перемотать медиа "${(a.selectorText || a.selector || '')}" на ${a.value || ''}`,
          '',
          'Медиа перемотано'
        ));
        break;
      case 'media_volume':
        steps.push(makeStep(a,
          `Изменить громкость медиа: ${a.value || ''}`,
          '',
          'Громкость изменена'
        ));
        break;
      case 'dialog_element':
        steps.push(makeStep(a,
          `<dialog> ${a.value === 'open' ? 'открыт' : 'закрыт'}: "${a.selectorText || ''}"`,
          '',
          `Диалог ${a.value === 'open' ? 'открыт' : 'закрыт'}`
        ));
        break;
      case 'details_toggle':
        steps.push(makeStep(a,
          `<details> "${a.selectorText || ''}" ${a.value === 'open' ? 'развёрнут' : 'свёрнут'}`,
          '',
          `Элемент ${a.value === 'open' ? 'развёрнут' : 'свёрнут'}`
        ));
        break;
      case 'ime_composition':
        steps.push(makeStep(a,
          `Ввод текста через IME: "${(a.displayValue || a.value || '').slice(0, 60)}"`,
          a.displayValue || a.value || '',
          'Текст введён через IME'
        ));
        break;
      case 'dragstart':
        steps.push(makeStep(a,
          `Начать перетаскивание "${a.selectorText || a.selector || ''}"`,
          '',
          'Элемент захвачен для перетаскивания'
        ));
        break;
      case 'dragend':
        steps.push(makeStep(a,
          `Завершить перетаскивание (${a.value || ''})`,
          '',
          'Перетаскивание завершено'
        ));
        break;
      case 'drop':
        steps.push(makeStep(a,
          `Опустить элемент на "${a.selectorText || a.selector || ''}"`,
          '',
          'Элемент отпущен на целевой области'
        ));
        break;
      case 'hover':
        steps.push(makeStep(a,
          `Навести мышь на "${a.selectorText || a.selector || ''}" [selector=${a.selector}]`,
          '',
          'Элемент подсвечен'
        ));
        break;
      case 'drag':
        steps.push(makeStep(a,
          `Перетащить элемент "${a.selectorText || a.selector || ''}" в "${a.value || ''}"`,
          a.value || '',
          'Элемент перемещён'
        ));
        break;
      case 'wheel':
        steps.push(makeStep(a,
          `Прокрутить колёсиком мыши: ${a.value || ''}`,
          '',
          'Прокрутка выполнена'
        ));
        break;
      case 'waitForSelector':
        steps.push(makeStep(a,
          `Дождаться появления элемента "${a.selectorText || a.selector || ''}"`,
          '',
          'Элемент появился на странице'
        ));
        break;
      case 'assertText':
        steps.push(makeStep(a,
          `Проверить что текст "${(a.value || '').slice(0, 60)}" отображается`,
          a.value || '',
          'Текст найден на странице'
        ));
        break;
      case 'assertVisible':
        steps.push(makeStep(a,
          `Проверить видимость элемента "${a.selectorText || ''}"`,
          '',
          'Элемент видим'
        ));
        break;
      case 'assertValue':
        steps.push(makeStep(a,
          `Проверить значение поля "${a.selectorText || ''}" = "${(a.value || '').slice(0, 60)}"`,
          a.value || '',
          'Значение соответствует ожидаемому'
        ));
        break;
      case 'assertChecked':
        steps.push(makeStep(a,
          `Проверить состояние чекбокса "${a.selectorText || ''}"`,
          '',
          `Чекбокс ${a.value || ''}`
        ));
        break;
      case 'assertUrl':
        steps.push(makeStep(a,
          `Проверить URL содержит "${(a.value || '').slice(0, 80)}"`,
          a.value || '',
          'URL соответствует ожидаемому'
        ));
        break;
      case 'console':
        steps.push(makeStep(a,
          `Консоль [${a.level || 'log'}]: "${(a.value || '').slice(0, 60)}"`,
          a.value || '',
          'Сообщение залогировано'
        ));
        break;
      default:
        steps.push(makeStep(a,
          `${a.actionType}: ${a.selectorText || a.selector || a.value || ''}`,
          a.value || '',
          'Выполнено'
        ));
    }
  }
  if (!hasNavigate && session.actions.length > 0) {
    const firstUrl = session.actions[0].url;
    if (firstUrl) {
      steps.unshift(makeStep(session.actions[0],
        `Перейти по URL ${firstUrl}`,
        firstUrl,
        'Страница загружена'
      ));
    }
  }
  return steps;
}

export function saveCompositeStep(name: string, description: string, steps: any[], parameters: any[]): any {
  const d = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  d.prepare(`INSERT INTO composite_steps (id, name, description, steps_json, parameters_json) VALUES (?, ?, ?, ?, ?)`)
    .run(id, name, description, JSON.stringify(steps), JSON.stringify(parameters));
  return { id, name, description, steps, parameters, createdAt: now, updatedAt: now };
}

export function listCompositeSteps(): any[] {
  const d = getDb();
  return d.prepare('SELECT * FROM composite_steps ORDER BY name').all() as any[];
}

export function getUserSwitchConfig(): any {
  const d = getDb();
  let row = d.prepare('SELECT * FROM user_switch_config WHERE id = 1').get() as any;
  if (!row) {
    d.prepare(`INSERT INTO user_switch_config (hotkey, enabled, profiles_json) VALUES ('Ctrl+Shift+U', 1, '[]')`).run();
    row = d.prepare('SELECT * FROM user_switch_config WHERE id = 1').get() as any;
  }
  return {
    hotkey: row.hotkey, enabled: !!row.enabled,
    profiles: JSON.parse(row.profiles_json || '[]'),
  };
}

export function updateUserSwitchConfig(config: { hotkey?: string; enabled?: boolean; profiles?: any[] }): any {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM user_switch_config WHERE id = 1').get() as any;
  const hotkey = config.hotkey ?? existing?.hotkey ?? 'Ctrl+Shift+U';
  const enabled = config.enabled !== undefined ? (config.enabled ? 1 : 0) : existing?.enabled ?? 1;
  const profiles = JSON.stringify(config.profiles ?? JSON.parse(existing?.profiles_json || '[]'));
  d.prepare(`UPDATE user_switch_config SET hotkey = ?, enabled = ?, profiles_json = ? WHERE id = 1`).run(hotkey, enabled, profiles);
  return getUserSwitchConfig();
}
