// Test: does addActionsBulk work with partial action objects?
const uuid = require('uuid');

// Get db
const d = require('better-sqlite3')('recordings.db');

// Create a new test session
const testSessionId = uuid.v4();
d.prepare('INSERT INTO recording_sessions (id, name, status) VALUES (?, ?, ?)').run(testSessionId, 'bulk_test', 'recording');

// Actions with only partial properties (like browser-agent sends)
const actions = [
  { actionType: 'request', selector: '', selectorText: '', value: '', url: 'https://test.com/', method: 'GET', resourceType: 'document', postData: '', headers: '{}', timestamp: new Date().toISOString() },
  { actionType: 'navigate', selector: '', selectorText: 'https://test.com/', value: '', url: 'https://test.com/', timestamp: new Date().toISOString() },
  { actionType: 'page_load', selector: '', selectorText: '', value: '', url: 'https://test.com/', timestamp: new Date().toISOString() },
  { actionType: 'response', url: 'https://test.com/', status: 200, method: 'GET', body: '', timestamp: new Date().toISOString() },
];

// Manually call addAction for each
function addAction(sessionId, action) {
    const id = uuid.v4();
    const maxIdx = d.prepare('SELECT COALESCE(MAX(idx), -1) + 1 AS next FROM recorded_actions WHERE session_id = ?').get(sessionId);
    console.log(`  actionType=${action.actionType} maxIdx.next=${maxIdx.next} keys=${Object.keys(action).length}`);
    d.prepare(`INSERT INTO recorded_actions (id, session_id, action_type, selector, selector_text, value, url, page_title, tab_id, screenshot, timestamp, idx, method, resource_type, post_data, headers_json, status_code, response_body, error, level, combo, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, sessionId, action.actionType, action.selector, action.selectorText, action.value, action.url, action.pageTitle, action.tabId, action.screenshot, action.timestamp, maxIdx.next, action.method, action.resourceType, action.postData, action.headers, action.status, action.body, action.error, action.level, action.combo, action.modifiers);
    return { ...action, id, sessionId, index: maxIdx.next };
}

try {
  for (const a of actions) {
    addAction(testSessionId, a);
  }
  console.log('All 4 actions added OK');
} catch(e) {
  console.log('ERROR:', e.message);
}

const cnt = d.prepare('SELECT COUNT(*) as c FROM recorded_actions WHERE session_id = ?').get(testSessionId).c;
console.log('Actions in DB:', cnt);
d.close();
