import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import {
  getDb, createSession, stopSession, getSession, listSessions,
  addAction, addActionsBulk, convertToSteps,
  saveCompositeStep, listCompositeSteps,
  getUserSwitchConfig, updateUserSwitchConfig,
} from './db';

const PORT = parseInt(process.env.RECORDER_PORT || '3004', 10);
const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'recorder-service' }));
    return;
  }

  const body: Buffer[] = [];
  req.on('data', (chunk) => body.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(body).toString();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { /* ignore */ }

    try {
      const [path, qs] = (req.url || '').split('?');

      // Sessions
      if (path === '/api/recordings' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(listSessions()));
        return;
      }

      if (path === '/api/recordings/start' && req.method === 'POST') {
        const session = createSession(data.name || 'Unnamed', data.profileId || '');
        res.writeHead(201);
        res.end(JSON.stringify(session));
        return;
      }

      if (path?.match(/^\/api\/recordings\/([^/]+)\/stop$/) && req.method === 'POST') {
        const id = path.match(/^\/api\/recordings\/([^/]+)\/stop$/)?.[1] || '';
        const session = stopSession(id);
        if (!session) { res.writeHead(404); res.end(JSON.stringify({ error: 'Session not found' })); return; }
        res.writeHead(200);
        res.end(JSON.stringify(session));
        return;
      }

      if (path?.match(/^\/api\/recordings\/([^/]+)$/) && req.method === 'GET') {
        const id = path.match(/^\/api\/recordings\/([^/]+)$/)?.[1] || '';
        const session = getSession(id);
        if (!session) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
        res.writeHead(200);
        res.end(JSON.stringify(session));
        return;
      }

      if (path?.match(/^\/api\/recordings\/([^/]+)\/actions$/) && req.method === 'POST') {
        const id = path.match(/^\/api\/recordings\/([^/]+)\/actions$/)?.[1] || '';
        const actions = data.actions || [data];
        console.log(`[recorder-service] received ${actions.length} actions for session ${id.slice(0,8)}`);
        for (const action of actions) {
          const detail = action.actionType === 'click'
            ? `click: "${(action.selectorText||'').slice(0,40)}" [${action.selector}]`
            : action.actionType === 'fill'
            ? `fill: "${(action.selectorText||'').slice(0,40)}" = "${(action.value||'').slice(0,40)}"`
            : action.actionType === 'select'
            ? `select: "${(action.selectorText||'').slice(0,40)}" = "${action.value}"`
            : action.actionType === 'navigate'
            ? `navigate: ${(action.selectorText||action.url||'').slice(0,60)}`
            : action.actionType === 'keypress'
            ? `keypress: ${action.value}`
            : action.actionType === 'check'
            ? `check: "${(action.selectorText||'').slice(0,40)}" = ${action.value}`
            : action.actionType === 'page_load'
            ? `page_load: ${(action.url||'').slice(0,60)}`
            : action.actionType === 'scroll'
            ? `scroll: ${action.value}`
            : action.actionType === 'element_appear'
            ? `element_appear: ${action.value} [${action.selector}]`
            : action.actionType;
          console.log(`[recorder-service]   → ${detail}`);
        }
        const saved = addActionsBulk(id, actions);
        console.log(`[recorder-service] saved ${saved.length} actions`);
        res.writeHead(201);
        res.end(JSON.stringify(saved));
        return;
      }

      if (path?.match(/^\/api\/recordings\/([^/]+)\/convert$/) && req.method === 'POST') {
        const id = path.match(/^\/api\/recordings\/([^/]+)\/convert$/)?.[1] || '';
        const steps = convertToSteps(id);
        res.writeHead(200);
        res.end(JSON.stringify(steps));
        return;
      }

      // Composite steps
      if (path === '/api/composite-steps' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(listCompositeSteps()));
        return;
      }

      if (path === '/api/composite-steps' && req.method === 'POST') {
        const cs = saveCompositeStep(data.name, data.description, data.steps || [], data.parameters || []);
        res.writeHead(201);
        res.end(JSON.stringify(cs));
        return;
      }

      // User switch config
      if (path === '/api/user-switch/config' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(getUserSwitchConfig()));
        return;
      }

      if (path === '/api/user-switch/config' && req.method === 'PUT') {
        const cfg = updateUserSwitchConfig(data);
        res.writeHead(200);
        res.end(JSON.stringify(cfg));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err: any) {
      console.error(`[recorder-service] ERROR on ${req.url}: ${err.message}`);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case 'record:action': {
        if (!msg.sessionId) {
          ws.send(JSON.stringify({ type: 'error', message: 'sessionId required' }));
          return;
        }
        const detail = msg.actionType === 'click'
          ? `click: "${(msg.selectorText||'').slice(0,40)}" [${msg.selector}]`
          : msg.actionType === 'fill'
          ? `fill: "${(msg.selectorText||'').slice(0,40)}" = "${(msg.value||'').slice(0,40)}"`
          : msg.actionType === 'select'
          ? `select: "${(msg.selectorText||'').slice(0,40)}" = "${msg.value}"`
          : msg.actionType === 'navigate'
          ? `navigate: ${(msg.selectorText||msg.url||'').slice(0,60)}`
          : msg.actionType === 'keypress'
          ? `keypress: ${msg.value}`
          : msg.actionType === 'response'
          ? `response: ${msg.status} ${msg.method} ${(msg.url||'').slice(0,60)}`
          : msg.actionType === 'request'
          ? `request: ${msg.method} ${(msg.url||'').slice(0,60)}`
          : msg.actionType;
        console.log(`[recorder-service] WS action: ${msg.actionType} ${detail} session=${msg.sessionId.slice(0,8)}`);
        const action = addAction(msg.sessionId, {
          actionType: msg.actionType || 'unknown',
          selector: msg.selector || '',
          selectorText: msg.selectorText || '',
          value: msg.value || '',
          url: msg.url || '',
          pageTitle: msg.pageTitle || '',
          tabId: msg.tabId || '',
          screenshot: msg.screenshot || '',
          timestamp: msg.timestamp || new Date().toISOString(),
          method: msg.method || '',
          resourceType: msg.resourceType || '',
          postData: msg.postData || '',
          headers: JSON.stringify(msg.headers || {}),
          status: msg.status || 0,
          body: msg.body || '',
          error: msg.error || '',
          level: msg.level || '',
          combo: msg.combo || '',
          modifiers: msg.modifiers || '',
          inputType: msg.inputType || '',
          checked: msg.checked || false,
          optionIndex: msg.optionIndex || 0,
          x: msg.x || 0,
          y: msg.y || 0,
          scrollY: msg.scrollY || 0,
          scrollMax: msg.scrollMax || 0,
          shadowDom: msg.shadowDom || false,
          displayValue: msg.displayValue || '',
          frameName: msg.frameName || '',
          frameUrl: msg.frameUrl || '',
          frameSelector: msg.frameSelector || '',
          iframeAction: msg.iframeAction || false,
          length: msg.length || 0,
          selectionText: msg.selectionText || '',
        });
        ws.send(JSON.stringify({ type: 'recorded', actionId: action.id }));
        break;
      }

      case 'record:start': {
        const session = createSession(msg.name || 'Recorded', msg.profileId || '');
        ws.send(JSON.stringify({ type: 'recording:started', sessionId: session.id }));
        break;
      }

      case 'record:stop': {
        if (!msg.sessionId) {
          ws.send(JSON.stringify({ type: 'error', message: 'sessionId required' }));
          return;
        }
        const session = stopSession(msg.sessionId);
        ws.send(JSON.stringify({ type: 'recording:stopped', session }));
        break;
      }

      case 'record:convert': {
        if (!msg.sessionId) {
          ws.send(JSON.stringify({ type: 'error', message: 'sessionId required' }));
          return;
        }
        const steps = convertToSteps(msg.sessionId);
        ws.send(JSON.stringify({ type: 'converted', steps }));
        break;
      }
    }
  });
});

function gracefulShutdown(signal: string) {
  console.log(`[${signal}] Shutting down recorder-service...`);
  wss?.clients?.forEach((client) => client.close());
  httpServer.close(() => {
    try { getDb().close(); } catch { /* DB may already be closed */ }
    console.log('recorder-service stopped');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));

export function startRecorderServer(): void {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`recorder-service running on port ${PORT}`);
  });
}
