const d = require('better-sqlite3')('recordings.db');
const uuid = require('uuid');

// Simulate exactly what addAction does
const sessionId = '846e40f4-d817-4ac1-b402-37989c74a61c';
const action = {
  actionType: 'navigate',
  selector: '',
  selectorText: 'https://example.com/',
  value: '',
  url: 'https://example.com/',
  pageTitle: '',
  tabId: '',
  screenshot: '',
  timestamp: new Date().toISOString(),
  method: '',
  resourceType: '',
  postData: '',
  headers: '{}',
  status: 0,
  body: '',
  error: '',
  level: '',
  combo: '',
  modifiers: ''
};

const id = uuid.v4();
const maxIdx = d.prepare('SELECT COALESCE(MAX(idx), -1) + 1 AS next FROM recorded_actions WHERE session_id = ?').get(sessionId);
console.log('maxIdx:', JSON.stringify(maxIdx));
console.log('maxIdx.next:', maxIdx.next);

try {
  d.prepare(`INSERT INTO recorded_actions (id, session_id, action_type, selector, selector_text, value, url, page_title, tab_id, screenshot, timestamp, idx, method, resource_type, post_data, headers_json, status_code, response_body, error, level, combo, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, sessionId, action.actionType, action.selector, action.selectorText, action.value, action.url, action.pageTitle, action.tabId, action.screenshot, action.timestamp, maxIdx.next, action.method, action.resourceType, action.postData, action.headers, action.status, action.body, action.error, action.level, action.combo, action.modifiers);
  console.log('INSERT OK');
} catch(e) {
  console.log('INSERT ERROR:', e.message);
}

console.log('Total:', d.prepare('SELECT COUNT(*) as c FROM recorded_actions').get().c);
d.close();
