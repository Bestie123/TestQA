#!/usr/bin/env node
/**
 * Wiki & Jira Search MCP Server
 * Быстрый поиск по wiki.ifellow.ru и jira.ifellow.ru
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

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

function getJiraProfile(creds) {
  if (!creds) return null;
  const activeName = creds.zephyr || creds.jira || creds.default;
  if (activeName && creds.profiles && creds.profiles[activeName]) {
    return { name: activeName, ...creds.profiles[activeName] };
  }
  if (creds.profiles) {
    const first = Object.keys(creds.profiles)[0];
    if (first) return { name: first, ...creds.profiles[first] };
  }
  return null;
}

// ── HTTP Request ──

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
      timeout: 15000,
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 401) {
          reject(new Error('Unauthorized: Check credentials'));
          return;
        }
        if (res.statusCode === 403) {
          reject(new Error('Forbidden: No access'));
          return;
        }
        if (res.statusCode === 404) {
          reject(new Error(`Not found: ${parsedUrl.pathname}`));
          return;
        }
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data.substring(0, 10000) }); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

// ── Confluence Wiki API ──

async function searchWiki(spaceKey, query) {
  // Confluence search API
  const url = `https://wiki.ifellow.ru/rest/api/search?cql=space=${spaceKey} AND text~"${encodeURIComponent(query)}"&expand=content&limit=10`;
  try {
    const data = await httpRequest(url);
    if (!data.results) return data;
    return data.results.map(r => ({
      id: r.content?.id,
      title: r.title,
      space: r.content?.space?.name,
      url: r.content?._links?.webview ? `https://wiki.ifellow.ru${r.content._links.webview}` : '',
      excerpt: r.excerpt || '',
    }));
  } catch (e) {
    return { error: e.message };
  }
}

async function getWikiPage(pageId) {
  const url = `https://wiki.ifellow.ru/rest/api/content/${pageId}?expand=body.storage,version`;
  try {
    const data = await httpRequest(url);
    if (!data.id) return data;
    // Strip HTML tags for cleaner output
    const content = data.body?.storage?.value || '';
    const textOnly = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      id: data.id,
      title: data.title,
      space: data.space?.name,
      url: `https://wiki.ifellow.ru/pages/viewpage.action?pageId=${data.id}`,
      content: textOnly.substring(0, 5000),
      lastModified: data.version?.when,
      lastEditedBy: data.version?.by?.displayName,
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function listWikiSpaces() {
  const url = 'https://wiki.ifellow.ru/rest/api/space?limit=50';
  try {
    const data = await httpRequest(url);
    if (!data.results) return data;
    return data.results.map(s => ({
      key: s.key,
      name: s.name,
      url: `https://wiki.ifellow.ru/display/${s.key}`,
    }));
  } catch (e) {
    return { error: e.message };
  }
}

// ── Jira API (Zephyr Scale test cases are regular Jira issues) ──

async function searchTestCases(profile, projectKey, search, maxResults = 20) {
  // Test cases in Zephyr Scale are regular Jira issues with type "Тест кейс"
  const jql = `project=${projectKey} AND summary~"${search}" AND issuetype="Тест кейс"`;
  const urlPath = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,priority,issuetype`;

  try {
    const data = await httpRequest(`${profile.host}${urlPath}`, {
      headers: { 'Authorization': `Bearer ${profile.token}` },
    });
    if (!data.issues) return data;
    return data.issues.map(i => ({
      key: i.key,
      name: i.fields?.summary,
      status: i.fields?.status?.name,
      priority: i.fields?.priority?.name,
      url: `https://jira.ifellow.ru/secure/Tests.jspa#/testCase/${i.key}`,
    }));
  } catch (e) {
    return { error: e.message };
  }
}

async function searchJiraIssues(profile, projectKey, search, maxResults = 20) {
  // Search all Jira issues (not just test cases)
  const jql = `project=${projectKey} AND text~"${search}"`;
  const urlPath = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,priority,issuetype`;

  try {
    const data = await httpRequest(`${profile.host}${urlPath}`, {
      headers: { 'Authorization': `Bearer ${profile.token}` },
    });
    if (!data.issues) return data;
    return { total: data.total, issues: data.issues.map(i => ({
      key: i.key,
      name: i.fields?.summary,
      status: i.fields?.status?.name,
      type: i.fields?.issuetype?.name,
      url: `https://jira.ifellow.ru/browse/${i.key}`,
    }))};
  } catch (e) {
    return { error: e.message };
  }
}

async function getTestCase(profile, key) {
  const urlPath = `/rest/api/2/issue/${key}?fields=summary,status,description,issuetype,priority`;

  try {
    const data = await httpRequest(`${profile.host}${urlPath}`, {
      headers: { 'Authorization': `Bearer ${profile.token}` },
    });
    const f = data.fields;
    return {
      key: data.key,
      name: f.summary,
      status: f.status?.name,
      priority: f.priority?.name,
      type: f.issuetype?.name,
      description: (f.description || '').substring(0, 3000),
      url: `https://jira.ifellow.ru/secure/Tests.jspa#/testCase/${data.key}`,
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function listFolders(profile, projectKey) {
  // Jira doesn't have folders like Zephyr, return project structure
  const urlPath = `/rest/api/2/project/${projectKey}`;
  try {
    const data = await httpRequest(`${profile.host}${urlPath}`, {
      headers: { 'Authorization': `Bearer ${profile.token}` },
    });
    return { key: data.key, name: data.name, lead: data.lead?.displayName };
  } catch (e) {
    return { error: e.message };
  }
}

// ── MCP Protocol ──

const tools = [
  {
    name: 'wiki_search',
    description: 'Поиск страниц в wiki.ifellow.ru по ключевому слову',
    inputSchema: {
      type: 'object',
      properties: {
        spaceKey: { type: 'string', description: 'Ключ пространства (RegDoc, и др.)' },
        query: { type: 'string', description: 'Поисковый запрос' },
      },
      required: ['query'],
    },
  },
  {
    name: 'wiki_get_page',
    description: 'Получить содержимое страницы wiki по ID',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'ID страницы wiki' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'wiki_list_spaces',
    description: 'Список пространств wiki',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'zephyr_search',
    description: 'Поиск тест-кейсов в Zephyr Scale по ключевому слову',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Ключ проекта (IBPA, IBPA2)' },
        search: { type: 'string', description: 'Поисковый запрос' },
        maxResults: { type: 'number', description: 'Максимум результатов (по умолчанию 20)' },
      },
      required: ['search'],
    },
  },
  {
    name: 'zephyr_get_case',
    description: 'Получить детали тест-кейса по ключу (IBPA-T1234)',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Ключ тест-кейса (IBPA-T1234)' },
      },
      required: ['key'],
    },
  },
  {
    name: 'jira_search',
    description: 'Поиск задач в Jira по ключевому слову (все типы задач)',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Ключ проекта (IBPA, IBPA2)' },
        search: { type: 'string', description: 'Поисковый запрос' },
        maxResults: { type: 'number', description: 'Максимум результатов (по умолчанию 20)' },
      },
      required: ['search'],
    },
  },
  {
    name: 'jira_get_issue',
    description: 'Получить детали задачи Jira по ключу (IBPA-1234)',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Ключ задачи (IBPA-1234)' },
      },
      required: ['key'],
    },
  },
];

async function handleToolCall(name, args) {
  const creds = loadCredentials();
  const profile = getJiraProfile(creds);

  switch (name) {
    case 'wiki_search':
      return await searchWiki(args.spaceKey || 'RegDoc', args.query);
    case 'wiki_get_page':
      return await getWikiPage(args.pageId);
    case 'wiki_list_spaces':
      return await listWikiSpaces();
    case 'zephyr_search':
      if (!profile) return { error: 'Jira credentials not found' };
      return await searchTestCases(profile, args.projectKey || 'IBPA', args.search, args.maxResults);
    case 'zephyr_get_case':
      if (!profile) return { error: 'Jira credentials not found' };
      return await getTestCase(profile, args.key);
    case 'jira_search':
      if (!profile) return { error: 'Jira credentials not found' };
      return await searchJiraIssues(profile, args.projectKey || 'IBPA', args.search, args.maxResults);
    case 'jira_get_issue':
      if (!profile) return { error: 'Jira credentials not found' };
      return await getTestCase(profile, args.key);
    default:
      return { error: `Unknown tool: ${name}` };
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
      serverInfo: { name: 'wiki-jira-search', version: '1.0.0' },
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
