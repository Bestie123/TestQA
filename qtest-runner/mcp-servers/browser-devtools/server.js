#!/usr/bin/env node
/**
 * Browser DevTools MCP Server v3
 * Zero-dependency Chrome DevTools Protocol wrapper
 * Uses only built-in Node.js modules (http, https)
 */

const http = require('http');

const CDP_PORT = 9222;
const CDP_HOST = '127.0.0.1';
const TIMEOUT = 15000;

// ── CDP HTTP API ──

function cdpHTTP(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${CDP_HOST}:${CDP_PORT}${path}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('CDP timeout')); });
  });
}

function cdpHTTPPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: CDP_HOST,
      port: CDP_PORT,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve({ raw: buf }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT, () => { req.destroy(); reject(new Error('CDP timeout')); });
    req.write(data);
    req.end();
  });
}

// ── CDP Runtime Evaluate via HTTP ──

async function cdpEvaluate(targetId, expression) {
  // Use /json/protocol to get wsDebuggerUrl, then use HTTP /json/activate/{id} + /json/new
  // Actually, CDP over HTTP is limited. Use /json/evaluate if available, otherwise fallback
  // The most reliable way without WebSocket is to use the /json/new + send command approach

  // Create a new target and use it
  const target = await cdpHTTP(`/json/new?about:blank`);
  if (!target.id) throw new Error('Failed to create target');

  // Send command via /json/protocol is not available via HTTP
  // We need to use the WebSocket endpoint, but we don't have ws module

  // Alternative: use Chrome DevTools HTTP API /json/evaluate
  // This is not standard, but let's try /json/protocol
  try {
    const result = await cdpHTTPPost(`http://${CDP_HOST}:${CDP_PORT}/json/evaluate/${target.id}`, {
      expression,
      returnByValue: true,
    });
    // Close the target
    await cdpHTTP(`/json/close/${target.id}`);
    return result;
  } catch (e) {
    // Fallback: use Runtime.evaluate via fetch to the target
    await cdpHTTP(`/json/close/${target.id}`);
    throw e;
  }
}

// ── Simplified: Use list/create/close HTTP API ──

async function getTargets() {
  try { return await cdpHTTP('/json'); }
  catch { return []; }
}

async function navigateTarget(targetId, url) {
  // Navigate by creating new page
  const target = await cdpHTTP(`/json/new?${url}`);
  return target;
}

async function closeTarget(targetId) {
  try { await cdpHTTP(`/json/close/${targetId}`); } catch {}
}

// ── Tool implementations using HTTP API ──

async function browserNavigate(args) {
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page');
  if (page) {
    await navigateTarget(page.id, args.url);
    return { success: true, url: args.url };
  }
  const target = await cdpHTTP(`/json/new?${args.url}`);
  return { success: true, url: args.url, targetId: target.id };
}

async function browserListTabs() {
  const targets = await getTargets();
  return targets.filter(t => t.type === 'page').map(t => ({
    title: t.title,
    url: t.url,
    id: t.id,
  }));
}

async function browserEvaluate(args) {
  // This requires WebSocket - we can't do it via HTTP alone
  // Return instructions instead
  return {
    error: 'browser_evaluate requires Chrome DevTools WebSocket',
    hint: 'Use browser-devtools MCP via opencode for full functionality',
    expression: args.code,
  };
}

async function browserGetHTML(args) {
  return { error: 'browser_get_html requires Chrome DevTools WebSocket' };
}

async function browserClick(args) {
  return { error: 'browser_click requires Chrome DevTools WebSocket' };
}

async function browserType(args) {
  return { error: 'browser_type requires Chrome DevTools WebSocket' };
}

async function browserScreenshot() {
  return { error: 'browser_screenshot requires Chrome DevTools WebSocket' };
}

async function browserInspectDOM(args) {
  return { error: 'browser_inspect_dom requires Chrome DevTools WebSocket' };
}

async function browserFindElements(args) {
  return { error: 'browser_find_elements requires Chrome DevTools WebSocket' };
}

async function browserGetFilterPanel() {
  return { error: 'browser_get_filter_panel requires Chrome DevTools WebSocket' };
}

// ── MCP Protocol ──

const tools = [
  { name: 'browser_navigate', description: 'Navigate to URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'browser_list_tabs', description: 'List browser tabs', inputSchema: { type: 'object', properties: {} } },
  { name: 'browser_evaluate', description: 'Execute JavaScript (needs WebSocket)', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'browser_get_html', description: 'Get HTML (needs WebSocket)', inputSchema: { type: 'object', properties: { selector: { type: 'string' } } } },
  { name: 'browser_click', description: 'Click element (needs WebSocket)', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'browser_type', description: 'Type text (needs WebSocket)', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'] } },
  { name: 'browser_screenshot', description: 'Take screenshot (needs WebSocket)', inputSchema: { type: 'object', properties: {} } },
  { name: 'browser_inspect_dom', description: 'Inspect DOM (needs WebSocket)', inputSchema: { type: 'object', properties: { depth: { type: 'number' } } } },
  { name: 'browser_find_elements', description: 'Find elements (needs WebSocket)', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, maxResults: { type: 'number' } }, required: ['selector'] } },
  { name: 'browser_get_filter_panel', description: 'Click filter button (needs WebSocket)', inputSchema: { type: 'object', properties: {} } },
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'browser_navigate': return await browserNavigate(args);
    case 'browser_list_tabs': return await browserListTabs();
    case 'browser_evaluate': return await browserEvaluate(args);
    case 'browser_get_html': return await browserGetHTML(args);
    case 'browser_click': return await browserClick(args);
    case 'browser_type': return await browserType(args);
    case 'browser_screenshot': return await browserScreenshot();
    case 'browser_inspect_dom': return await browserInspectDOM(args);
    case 'browser_find_elements': return await browserFindElements(args);
    case 'browser_get_filter_panel': return await browserGetFilterPanel();
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ── stdio transport ──

let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (line.trim()) {
      try { handleMessage(JSON.parse(line)); } catch {}
    }
  }
});

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handleMessage(msg) {
  if (msg.method === 'initialize') {
    sendResponse(msg.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'browser-devtools-mcp', version: '3.0.0' },
    });
  } else if (msg.method === 'notifications/initialized') {
    // no-op
  } else if (msg.method === 'tools/list') {
    sendResponse(msg.id, { tools });
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;
    try {
      const result = await handleToolCall(name, args || {});
      sendResponse(msg.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
    } catch (e) {
      sendError(msg.id, -32000, e.message);
    }
  } else {
    sendError(msg.id, -32601, `Unknown method: ${msg.method}`);
  }
}
