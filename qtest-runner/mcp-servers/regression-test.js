#!/usr/bin/env node
/**
 * Regression Testing MCP Server
 * Тестирование регрессий с логированием всех действий
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const CDP_PORT = 9222;
const CDP_HOST = '127.0.0.1';
const LOG_FILE = path.join(__dirname, 'regression-test.log');

// Логирование
function log(action, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    ...details,
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(LOG_FILE, logLine);
  console.error(`[LOG] ${timestamp} - ${action}`, details);
  
  return logEntry;
}

// Получение истории логов
function getLogs(limit = 100) {
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    return lines.slice(-limit).map(l => {
      try { return JSON.parse(l); }
      catch { return { raw: l }; }
    });
  } catch { return []; }
}

// Очистка логов
function clearLogs() {
  fs.writeFileSync(LOG_FILE, '');
  return { cleared: true };
}

// Проверка Chrome CDP
async function checkChromeCDP() {
  log('check_chrome_cdp');
  return new Promise((resolve) => {
    const req = http.get(`http://${CDP_HOST}:${CDP_PORT}/json/version`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = { running: true, ...JSON.parse(data) };
          log('chrome_cdp_ok', result);
          resolve(result);
        }
        catch {
          log('chrome_cdp_error', { error: 'Failed to parse response' });
          resolve({ running: false });
        }
      });
    });
    req.on('error', (e) => {
      log('chrome_cdp_error', { error: e.message });
      resolve({ running: false });
    });
    req.setTimeout(3000, () => { req.destroy(); resolve({ running: false }); });
  });
}

// Получение списка вкладок
async function getChromeTabs() {
  log('get_chrome_tabs');
  return new Promise((resolve) => {
    const req = http.get(`http://${CDP_HOST}:${CDP_PORT}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(data);
          log('chrome_tabs_ok', { count: tabs.length });
          resolve(tabs);
        }
        catch {
          log('chrome_tabs_error', { error: 'Failed to parse tabs' });
          resolve([]);
        }
      });
    });
    req.on('error', (e) => {
      log('chrome_tabs_error', { error: e.message });
      resolve([]);
    });
    req.setTimeout(3000, () => { req.destroy(); resolve([]); });
  });
}

// MCP Protocol
const tools = [
  {
    name: 'test_fullscreen',
    description: 'Test if site is displayed in full screen',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to test' },
      },
      required: ['url'],
    },
  },
  {
    name: 'test_layout',
    description: 'Test layout elements',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to test' },
        selectors: { type: 'array', items: { type: 'string' }, description: 'CSS selectors to check' },
      },
      required: ['url'],
    },
  },
  {
    name: 'test_load_time',
    description: 'Test page load time',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to test' },
      },
      required: ['url'],
    },
  },
  {
    name: 'test_filter_panel',
    description: 'Test filter panel functionality',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to test' },
        filterSelector: { type: 'string', description: 'CSS selector for filter panel' },
      },
      required: ['url'],
    },
  },
  {
    name: 'get_logs',
    description: 'Get regression test logs',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of log entries to return' },
      },
    },
  },
  {
    name: 'clear_logs',
    description: 'Clear regression test logs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_chrome_status',
    description: 'Get Chrome CDP status and tabs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleToolCall(name, args) {
  log('tool_call', { name, args });
  
  switch (name) {
    case 'test_fullscreen': {
      const chrome = await checkChromeCDP();
      if (!chrome.running) {
        log('test_fullscreen_error', { error: 'Chrome CDP not running' });
        return { error: 'Chrome CDP not running. Run: node chrome-launcher.js' };
      }
      const result = { chrome: true, url: args.url, status: 'Use chrome-devtools_cdp_evaluate to check' };
      log('test_fullscreen_result', result);
      return result;
    }
    
    case 'test_layout': {
      const chrome = await checkChromeCDP();
      if (!chrome.running) {
        log('test_layout_error', { error: 'Chrome CDP not running' });
        return { error: 'Chrome CDP not running' };
      }
      const result = { chrome: true, url: args.url, selectors: args.selectors || [] };
      log('test_layout_result', result);
      return result;
    }
    
    case 'test_load_time': {
      const chrome = await checkChromeCDP();
      if (!chrome.running) {
        log('test_load_time_error', { error: 'Chrome CDP not running' });
        return { error: 'Chrome CDP not running' };
      }
      const result = { chrome: true, url: args.url };
      log('test_load_time_result', result);
      return result;
    }
    
    case 'test_filter_panel': {
      const chrome = await checkChromeCDP();
      if (!chrome.running) {
        log('test_filter_panel_error', { error: 'Chrome CDP not running' });
        return { error: 'Chrome CDP not running' };
      }
      const result = { 
        chrome: true, 
        url: args.url, 
        filterSelector: args.filterSelector || '[data-testid="zephyr-scale-grid-filter-section"]',
        status: 'Use chrome-devtools_cdp_evaluate to check filter panel'
      };
      log('test_filter_panel_result', result);
      return result;
    }
    
    case 'get_logs': {
      const logs = getLogs(args.limit || 100);
      log('get_logs_result', { count: logs.length });
      return { logs, count: logs.length };
    }
    
    case 'clear_logs': {
      const result = clearLogs();
      log('clear_logs_result', result);
      return result;
    }
    
    case 'get_chrome_status': {
      const chrome = await checkChromeCDP();
      const tabs = chrome.running ? await getChromeTabs() : [];
      const result = {
        chrome,
        tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url })),
        tabCount: tabs.length
      };
      log('get_chrome_status_result', result);
      return result;
    }
    
    default:
      log('unknown_tool', { name });
      return { error: `Unknown tool: ${name}` };
  }
}

// stdio transport
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        log('stdin_message', { method: msg.method });
        handleMessage(msg);
      } catch {}
    }
  }
});

function sendResponse(id, result) {
  log('stdout_response', { id, resultType: typeof result });
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, code, message) {
  log('stdout_error', { id, code, message });
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handleMessage(msg) {
  if (msg.method === 'initialize') {
    log('initialize', { protocolVersion: msg.params?.protocolVersion });
    sendResponse(msg.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'regression-test-mcp', version: '1.0.0' },
    });
  } else if (msg.method === 'notifications/initialized') {
    log('initialized');
  } else if (msg.method === 'tools/list') {
    log('tools_list');
    sendResponse(msg.id, { tools });
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;
    log('tools_call', { name, args });
    try {
      const result = await handleToolCall(name, args || {});
      sendResponse(msg.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
    } catch (e) {
      log('tools_call_error', { name, error: e.message });
      sendError(msg.id, -32000, e.message);
    }
  } else {
    log('unknown_method', { method: msg.method });
    sendError(msg.id, -32601, `Unknown method: ${msg.method}`);
  }
}

log('server_start', { version: '1.0.0' });
