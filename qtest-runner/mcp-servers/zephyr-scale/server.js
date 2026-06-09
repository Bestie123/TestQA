#!/usr/bin/env node
/**
 * Zephyr Scale MCP Server v2
 * Robust Zephyr Scale API wrapper with proper error handling
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Credentials ──

function loadCredentials() {
  const credPath = path.join(process.env.USERPROFILE || process.env.HOME, '.qtest', 'credentials.json');
  try {
    const data = fs.readFileSync(credPath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

function getActiveProfile(creds) {
  if (!creds) return null;
  const activeName = creds.zephyr || creds.default;
  if (activeName && creds.profiles && creds.profiles[activeName]) {
    return { name: activeName, ...creds.profiles[activeName] };
  }
  if (creds.profiles) {
    const first = Object.keys(creds.profiles)[0];
    if (first) return { name: first, ...creds.profiles[first] };
  }
  return null;
}

// ── API Request ──

function apiRequest(profile, urlPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(profile.host + urlPath);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${profile.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 401) {
          reject(new Error('Unauthorized: Check your token'));
          return;
        }
        if (res.statusCode === 404) {
          reject(new Error(`Not found: ${urlPath}`));
          return;
        }
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data.substring(0, 5000) }); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Tool Implementations ──

async function listProjects(profile) {
  const data = await apiRequest(profile, '/rest/tests/latest/projects');
  if (!Array.isArray(data)) return data;
  return data.map(p => ({ key: p.key, name: p.name, id: p.id }));
}

async function listTestCases(profile, args) {
  const projectKey = args.projectKey || 'IBPA2';
  const params = new URLSearchParams({ projectKey });
  if (args.folder) params.set('folder', args.folder);
  if (args.status) params.set('status', args.status);
  if (args.search) params.set('search', args.search);
  if (args.maxResults) params.set('maxResults', String(args.maxResults));

  const data = await apiRequest(profile, `/rest/tests/latest/testcases?${params}`);
  if (!Array.isArray(data)) return data;
  return data.slice(0, 50).map(tc => ({
    key: tc.key,
    name: tc.name,
    status: tc.status?.name || tc.status,
    priority: tc.priority?.name || tc.priority,
    folder: tc.folder?.name || tc.folder,
  }));
}

async function getTestCase(profile, args) {
  return await apiRequest(profile, `/rest/tests/latest/testcases/${encodeURIComponent(args.key)}`);
}

async function listCycles(profile, args) {
  const projectKey = args.projectKey || 'IBPA2';
  const data = await apiRequest(profile, `/rest/tests/latest/testcycles?projectKey=${projectKey}`);
  if (!Array.isArray(data)) return data;
  return data.map(c => ({
    key: c.key,
    name: c.name,
    status: c.status,
    totalTestCases: c.totalTestCases,
    totalExecuted: c.totalExecuted,
  }));
}

async function listPlans(profile, args) {
  const projectKey = args.projectKey || 'IBPA2';
  const data = await apiRequest(profile, `/rest/tests/latest/testplans?projectKey=${projectKey}`);
  if (!Array.isArray(data)) return data;
  return data.map(p => ({ key: p.key, name: p.name, status: p.status }));
}

async function listFolders(profile, args) {
  const projectKey = args.projectKey || 'IBPA2';
  return await apiRequest(profile, `/rest/tests/latest/folders?projectKey=${projectKey}`);
}

async function getExecution(profile, args) {
  const data = await apiRequest(profile, `/rest/tests/latest/testcases/${encodeURIComponent(args.key)}/testresults`);
  if (!Array.isArray(data)) return data;
  return data.slice(0, 10).map(r => ({
    key: r.key,
    status: r.status,
    executedOn: r.executedOn,
    executedBy: r.executedBy,
  }));
}

// ── MCP Protocol ──

const tools = [
  { name: 'zephyr_list_projects', description: 'List all Zephyr Scale projects', inputSchema: { type: 'object', properties: {} } },
  { name: 'zephyr_list_testcases', description: 'List test cases', inputSchema: { type: 'object', properties: {
    projectKey: { type: 'string' }, folder: { type: 'string' }, status: { type: 'string' },
    search: { type: 'string' }, maxResults: { type: 'number' },
  }}},
  { name: 'zephyr_get_testcase', description: 'Get test case details', inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
  { name: 'zephyr_list_cycles', description: 'List test cycles', inputSchema: { type: 'object', properties: { projectKey: { type: 'string' } } } },
  { name: 'zephyr_list_plans', description: 'List test plans', inputSchema: { type: 'object', properties: { projectKey: { type: 'string' } } } },
  { name: 'zephyr_list_folders', description: 'List folder tree', inputSchema: { type: 'object', properties: { projectKey: { type: 'string' } } } },
  { name: 'zephyr_get_execution', description: 'Get test execution results', inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
];

async function handleToolCall(name, args) {
  const creds = loadCredentials();
  if (!creds) return { error: 'Credentials not found at ~/.qtest/credentials.json' };
  const profile = getActiveProfile(creds);
  if (!profile) return { error: 'No active profile found' };
  if (!profile.host || !profile.token) return { error: 'Profile missing host or token' };

  switch (name) {
    case 'zephyr_list_projects': return await listProjects(profile);
    case 'zephyr_list_testcases': return await listTestCases(profile, args);
    case 'zephyr_get_testcase': return await getTestCase(profile, args);
    case 'zephyr_list_cycles': return await listCycles(profile, args);
    case 'zephyr_list_plans': return await listPlans(profile, args);
    case 'zephyr_list_folders': return await listFolders(profile, args);
    case 'zephyr_get_execution': return await getExecution(profile, args);
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
      serverInfo: { name: 'zephyr-scale-mcp', version: '2.0.0' },
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
