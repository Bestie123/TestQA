import fs from 'fs';
import path from 'path';
import os from 'os';

// ── In-memory cache for Zephyr API responses ──
const apiCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet(key: string): any | null {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { apiCache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key: string, data: any): void {
  apiCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

export function clearCache(): void { apiCache.clear(); }

export interface ZephyrConfig {
  baseUrl: string;
  projectKey: string;
  apiToken?: string;
}

export interface ZephyrTestCase {
  key: string;
  name: string;
  status: string;
  precondition: string;
  objective: string;
  folder: string;
  priority: string;
  component: string;
  labels: string;
  owner: string;
  estimatedTime: string;
  coverageIssues: string;
  coveragePages: string;
  projectId?: string;
  steps: { action: string; testData: string; expectedResult: string }[];
}

const CREDENTIALS_PATH = path.join(os.homedir(), '.qtest', 'credentials.json');

export interface CredentialsFile {
  profiles?: Record<string, { host?: string; token?: string }>;
  default?: string;
  zephyr?: string;
  host?: string;
  token?: string;
}

function loadCredentials(): { host?: string; token?: string } {
  try {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      let raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const parsed: CredentialsFile = JSON.parse(raw);
      if (parsed.profiles) {
        const zephyrProfile = parsed.zephyr || parsed.default || 'dev';
        const profile = parsed.profiles[zephyrProfile];
        if (profile) return { host: profile.host, token: profile.token };
      }
      return { host: parsed.host, token: parsed.token };
    }
  } catch { /* ignore */ }
  return {};
}

export function loadCredentialsFile(): CredentialsFile {
  try {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      let raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return {};
}

export function saveCredentialsFile(data: CredentialsFile): void {
  const dir = path.dirname(CREDENTIALS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

const creds = loadCredentials();

let config: ZephyrConfig = {
  baseUrl: creds.host || process.env.ZEPHYR_BASE_URL || 'https://jira.ifellow.ru',
  projectKey: process.env.ZEPHYR_PROJECT_KEY || 'IBPA',
  apiToken: creds.token || process.env.ZEPHYR_API_TOKEN || '',
};

export function setZephyrConfig(cfg: Partial<ZephyrConfig>): void {
  config = { ...config, ...cfg };
}

export function getZephyrConfig(): ZephyrConfig {
  return { ...config };
}

function apiRequest(path: string, method: string = 'GET', body?: any, timeoutMs?: number): Promise<any> {
  // Use cache for GET requests
  if (method === 'GET') {
    const cached = cacheGet(path);
    if (cached !== null) return Promise.resolve(cached);
  }

  const url = new URL(path, config.baseUrl).toString();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(config.apiToken ? { 'Authorization': `Bearer ${config.apiToken}` } : {}),
  };
  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs || 30000),
  }).then(async (res) => {
    if (res.ok) {
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = text; }
      if (method === 'GET') cacheSet(path, data);
      return data;
    }
    const text = await res.text();
    throw new Error(`Zephyr API ${res.status}: ${text.slice(0, 200)}`);
  });
}

export interface JiraProject {
  key: string;
  name: string;
  projectTypeKey: string;
  lead?: string;
}

export interface ZephyrTestRun {
  id: number;
  key: string;
  projectId: number;
  name: string;
  description?: string;
  status?: string;
  totalTestCases?: number;
  totalExecuted?: number;
  totalPass?: number;
  totalFail?: number;
  createdBy?: string;
  startedOn?: string;
  completedOn?: string;
  folderId?: number | null;
  iterationId?: number | null;
  projectVersionId?: number | null;
  environmentId?: number | null;
  plannedStartDate?: string;
  plannedEndDate?: string;
  executionTime?: number;
  estimatedTime?: number;
  issueCount?: number;
  testResultStatuses?: {
    pass: number;
    fail: number;
    skipped: number;
    blocked: number;
    unexecuted: number;
  };
  owner?: string;
  updatedOn?: string;
  updatedBy?: string;
}

export interface JiraProjectFull {
  key: string;
  name: string;
  id: string;
  projectTypeKey: string;
  lead?: string;
}

export async function fetchProjects(): Promise<JiraProjectFull[]> {
  const response = await apiRequest('/rest/api/latest/project');
  return (Array.isArray(response) ? response : []).map((p: any) => ({
    key: p.key,
    name: p.name,
    id: String(p.id),
    projectTypeKey: p.projectTypeKey,
    lead: p.lead?.displayName || '',
  }));
}

export async function fetchTestCasesFromZephyr(): Promise<ZephyrTestCase[]> {
  const projectKey = config.projectKey;
  const tcs: ZephyrTestCase[] = [];
  const pageSize = 100;
  let startAt = 0;
  let total = 0;

  do {
    let response: any;
    try {
      response = await apiRequest(`/rest/tests/latest/testcase/search?projectKey=${projectKey}&maxResults=${pageSize}&startAt=${startAt}`);
    } catch (err: any) {
      console.error(`[zephyr] fetchTestCases error at ${startAt}: ${err.message}`);
      throw err;
    }

    if (total === 0) total = response?.total || 0;
    const items = response?.results || [];
    for (const entry of items) {
      if (!entry?.key) continue;
      tcs.push({
        key: entry.key || '',
        name: entry.name || '',
        status: entry.status?.name || entry.status || 'Approved',
        precondition: entry.precondition || '',
        objective: entry.objective || '',
        folder: entry.folder?.name || '',
        priority: entry.priority?.name || 'Normal',
        component: entry.component || '',
        labels: Array.isArray(entry.labels) ? entry.labels.join(', ') : (entry.labels || ''),
        owner: entry.owner || '',
        estimatedTime: '',
        coverageIssues: (entry.traceLinks || []).filter((t: any) => t.issueId).map((t: any) => t.issueId).join(', '),
        coveragePages: (entry.traceLinks || []).filter((t: any) => t.confluencePageId).map((t: any) => t.confluencePageId).join(', '),
        projectId: entry.projectId ? String(entry.projectId) : '',
        steps: (entry.testScript?.steps || entry.testScript?.testSteps || []).map((s: any) => ({
          action: s.description || s.action || '',
          testData: s.testData || s.data || '',
          expectedResult: s.expectedResult || s.result || '',
        })),
      });
    }
    startAt += items.length;
  } while (startAt < total);

  return tcs;
}

export async function debugZephyrResponse(): Promise<any> {
  const projectKey = config.projectKey;
  const response = await apiRequest(`/rest/tests/latest/testcase/search?projectKey=${projectKey}&maxResults=2`);
  return { total: response?.total || 0, sampleFields: response?.results?.[0] ? Object.keys(response.results[0]) : [] };
}

export async function testConnection(): Promise<{ ok: boolean; version?: string; message: string }> {
  try {
    const info = await apiRequest('/rest/api/latest/serverInfo');
    return { ok: true, version: info.version, message: `Jira ${info.version} connected via ${config.baseUrl}` };
  } catch (err: any) {
    return { ok: false, message: `Connection failed: ${err.message}` };
  }
}

export async function syncFromZephyr(): Promise<{ fetched: number; imported: number; updated: number; errors: string[] }> {
  const { importTestCases } = require('./importer');
  try {
    const remote = await fetchTestCasesFromZephyr();
    if (remote.length === 0) {
      return { fetched: 0, imported: 0, updated: 0, errors: ['No test cases found in Zephyr'] };
    }
    const result = importTestCases({ testCases: remote, errors: [] });
    return { fetched: remote.length, imported: result.imported || 0, updated: result.updated || 0, errors: result.errors || [] };
  } catch (err: any) {
    return { fetched: 0, imported: 0, updated: 0, errors: [err.message] };
  }
}

// ── Direct Zephyr query for Web UI filters ──
export async function queryZephyrTestCases(folder?: string, status?: string, priority?: string, owner?: string, search?: string, projectKeyArg?: string, maxPagesArg?: number): Promise<any[]> {
  const pk = projectKeyArg || config.projectKey;
  const results: any[] = [];
  const pageSize = 100; // Zephyr API caps at 100 per page regardless of maxResults
  const maxPages = maxPagesArg === 0 ? 999 : (maxPagesArg || 5); // 0 = unlimited (max 999 pages = ~100k TC)
  let startAt = 0;
  let totalFromApi = 0;

  console.log(`[zephyr] queryZephyrTestCases: projectKey=${pk}, maxPages=${maxPagesArg} (effective: ${maxPages}), pageSize=${pageSize}`);

  for (let page = 0; page < maxPages; page++) {
    let response: any;
    try {
      response = await apiRequest(`/rest/tests/latest/testcase/search?projectKey=${pk}&maxResults=${pageSize}&startAt=${startAt}`, 'GET', undefined, 120000);
    } catch (err: any) {
      console.error(`[zephyr] queryZephyrTestCases error at page ${page}, startAt=${startAt}: ${err.message}`);
      break;
    }

    const items = response?.results || [];
    if (page === 0) totalFromApi = response?.total || 0;
    if (items.length === 0) {
      console.log(`[zephyr] queryZephyrTestCases: page ${page} returned 0 items, stopping. Total so far: ${results.length}`);
      break;
    }

    console.log(`[zephyr] queryZephyrTestCases: page ${page}, startAt=${startAt}, got ${items.length} items, total so far: ${results.length + items.length}/${totalFromApi}`);

    for (const e of items) {
      if (!e?.key) continue;
      const name = e.name || '';
      const st = e.status?.name || '';
      const pr = e.priority?.name || '';
      const ow = e.owner || '';
      const fld = buildFolderPath(e.folder);

      if (folder && !fld.includes(folder)) continue;
      if (status && st !== status) continue;
      if (priority && pr !== priority) continue;
      if (owner && ow !== owner) continue;
      if (search && !name.toLowerCase().includes(search.toLowerCase()) && !e.key.toLowerCase().includes(search.toLowerCase())) continue;

      results.push({
        key: e.key,
        name,
        status: st,
        priority: pr,
        folder: fld,
        owner: ow,
        createdOn: e.createdOn || '',
        projectId: e.projectId || 0,
      });
    }
    startAt += items.length;
    // Stop when we've fetched all items or reached the limit
    if (startAt >= totalFromApi) {
      console.log(`[zephyr] queryZephyrTestCases: reached total ${totalFromApi}, stopping.`);
      break;
    }
  }

  console.log(`[zephyr] queryZephyrTestCases done: ${results.length} filtered results from ${totalFromApi} total`);
  return results;
}

function buildFolderPath(folder: any): string {
  const parts: string[] = [];
  let f = folder;
  while (f) {
    if (f.name) parts.unshift(f.name);
    f = f.parent;
  }
  return parts.join(' / ');
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  children: FolderNode[];
}

// ── Fast folder tree from Zephyr folder API (not from TC results) ──
export async function fetchFolderTreeFromApi(projectKey?: string, type: string = 'testcase'): Promise<FolderNode[]> {
  const pk = projectKey || config.projectKey;
  const projectId = await getProjectId(pk);
  
  // Map type to Zephyr API folder tree type
  const apiType = type === 'cycles' ? 'testrun' : type === 'plans' ? 'testplan' : 'testcase';
  
  try {
    const response = await apiRequest(`/rest/tests/1.0/project/${projectId}/foldertree/${apiType}`);
    return parseFolderTreeResponse(response);
  } catch {
    // Fallback to extraction from search results
    return fetchFolderTree(pk, 1);
  }
}

function parseFolderTreeResponse(data: any): FolderNode[] {
  // Zephyr API returns nested structure: { projectId, itemsCount, children: [{ id, name, children: [...] }] }
  // NOT a flat array!
  if (!data) return [];
  
  // If it's the nested format with children property
  if (data.children && Array.isArray(data.children)) {
    return convertNestedToNodes(data.children);
  }
  
  // Fallback: if it's a flat array (old format)
  if (Array.isArray(data)) {
    return convertFlatToNodes(data);
  }
  
  return [];
}

function convertNestedToNodes(children: any[]): FolderNode[] {
  if (!Array.isArray(children)) return [];
  return children.map(item => ({
    id: String(item.id),
    name: item.name || '',
    path: '',
    count: item.itemsCount || 0,
    children: convertNestedToNodes(item.children || []),
  }));
}

function convertFlatToNodes(data: any[]): FolderNode[] {
  const nodeMap = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const item of data) {
    const id = String(item.id);
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, name: item.name || '', path: '', children: [] });
    }
  }

  for (const item of data) {
    const id = String(item.id);
    const node = nodeMap.get(id)!;
    const parentId = item.parentId ? String(item.parentId) : null;
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Build paths
  function buildPaths(nodes: FolderNode[], parentPath: string) {
    for (const node of nodes) {
      node.path = parentPath ? `${parentPath} / ${node.name}` : node.name;
      if (node.children.length > 0) buildPaths(node.children, node.path);
    }
  }
  buildPaths(roots, '');

  return roots;
}

export async function fetchFolderTree(projectKey?: string, maxPages?: number): Promise<FolderNode[]> {
  const pk = projectKey || config.projectKey;
  const folderMap = new Map<string, { id: string; name: string; parent: any }>();
  const pageSize = 200;
  const pages = maxPages === 0 ? 999 : (maxPages || 1); // 0 = unlimited (max 999 pages)

  // Fetch pages to get folders
  for (let page = 0; page < pages; page++) {
    try {
      const response = await apiRequest(`/rest/tests/latest/testcase/search?projectKey=${pk}&maxResults=${pageSize}&startAt=${page * pageSize}`);
      const items = response?.results || [];
      if (items.length === 0) break;
      for (const e of items) {
        let f = e?.folder;
        while (f && f.id) {
          const key = `${f.id}`;
          if (!folderMap.has(key)) folderMap.set(key, { id: key, name: f.name || '', parent: f.parent || null });
          f = f.parent;
        }
      }
      if (items.length < pageSize) break;
    } catch { break; }
  }

  // Build tree
  const nodeMap = new Map<string, FolderNode>();
  for (const [id, info] of folderMap) {
    nodeMap.set(id, { id, name: info.name, path: '', children: [] });
  }

  const roots: FolderNode[] = [];
  for (const [id, info] of folderMap) {
    const node = nodeMap.get(id)!;
    if (info.parent && info.parent.id) {
      const parent = nodeMap.get(`${info.parent.id}`);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
    // Build path
    const parts: string[] = [info.name];
    let p = info.parent;
    while (p && p.id) {
      parts.unshift(p.name);
      p = p.parent;
    }
    node.path = parts.join(' / ');
  }

  return roots;
}

// ── Test Runs (Cycles) ──

export async function fetchTestRuns(projectKey?: string): Promise<ZephyrTestRun[]> {
  const pk = projectKey || config.projectKey;
  const fields = 'id,key,name,folderId,iterationId,projectVersionId,environmentId,plannedStartDate,plannedEndDate,executionTime,estimatedTime,testResultStatuses,testCaseCount,issueCount,status(id,name,i18nKey,color),createdOn,createdBy,updatedOn,updatedBy,owner';
  const projectId = await getProjectId(pk);
  const query = `testRun.projectId IN (${projectId}) ORDER BY testRun.name ASC`;
  
  const allRuns: ZephyrTestRun[] = [];
  let startAt = 0;
  const pageSize = 500;
  let total = 0;
  
  console.log(`[zephyr] fetchTestRuns: projectKey=${pk}, projectId=${projectId}, pageSize=${pageSize}`);
  
  do {
    // Use + for spaces in query (v1.0 API uses form encoding, not URI encoding for query)
    const response = await apiRequest(
      `/rest/tests/1.0/testrun/search?fields=${encodeURIComponent(fields)}&query=${encodeURIComponent(query).replace(/%20/g, '+')}&maxResults=${pageSize}&startAt=${startAt}&archived=false`,
      'GET',
      undefined,
      120000
    );
    
    const items = (response?.results || []).filter((r: any) => r?.key?.startsWith(pk));
    if (total === 0) total = response?.total || items.length;
    
    console.log(`[zephyr] fetchTestRuns: startAt=${startAt}, got ${items.length} items (filtered from ${(response?.results || []).length}), total so far: ${allRuns.length + items.length}/${total}`);
    
    for (const r of items) {
      allRuns.push({
        id: r.id,
        key: r.key,
        projectId: r.projectId,
        name: r.name || '',
        description: r.description || '',
        status: r.status?.name || '',
        totalTestCases: r.testCaseCount || r.totalTestCases || r.testCount || 0,
        totalExecuted: r.totalExecuted || r.executedCount || 0,
        totalPass: r.totalPass || r.passedCount || 0,
        totalFail: r.totalFail || r.failedCount || 0,
        createdBy: r.createdBy || '',
        startedOn: r.startedOn || '',
        completedOn: r.completedOn || '',
        folderId: r.folderId ?? null,
        iterationId: r.iterationId ?? null,
        projectVersionId: r.projectVersionId ?? null,
        environmentId: r.environmentId ?? null,
        plannedStartDate: r.plannedStartDate || '',
        plannedEndDate: r.plannedEndDate || '',
        executionTime: r.executionTime || 0,
        estimatedTime: r.estimatedTime || 0,
        issueCount: r.issueCount || 0,
        testResultStatuses: r.testResultStatuses || null,
        owner: r.owner || '',
        updatedOn: r.updatedOn || '',
        updatedBy: r.updatedBy || '',
      });
    }
    
    startAt += items.length;
    // Stop when we've fetched all items or reached the limit
    if (startAt >= total) {
      console.log(`[zephyr] fetchTestRuns: reached total ${total}, stopping.`);
      break;
    }
    if (items.length === 0) {
      console.log(`[zephyr] fetchTestRuns: got 0 items, stopping.`);
      break;
    }
  } while (startAt < total);
  
  console.log(`[zephyr] fetchTestRuns done: ${allRuns.length} runs`);
  return allRuns;
}

async function getProjectId(projectKey: string): Promise<number> {
  try {
    const projects = await fetchProjects();
    const match = projects.find(p => p.key === projectKey);
    if (match) return parseInt(match.id, 10);
  } catch { /* ignore */ }
  return 10904;
}

export async function syncFromZephyrTestRun(testRunKey: string): Promise<{ fetched: number; imported: number; errors: string[] }> {
  const { importTestCases } = require('./importer');
  try {
    // Fetch test cases belonging to this test run
    const response = await apiRequest(`/rest/tests/latest/testcase/search?testRunKey=${testRunKey}&maxResults=500`);
    const entries = response?.results || [];
    const tcs: ZephyrTestCase[] = entries.filter((e: any) => e?.key).map((entry: any) => ({
      key: entry.key || '',
      name: entry.name || '',
      status: entry.status?.name || entry.status || 'Approved',
      precondition: entry.precondition || '',
      objective: entry.objective || '',
      folder: entry.folder?.name || '',
      priority: entry.priority?.name || 'Normal',
      component: entry.component || '',
      labels: Array.isArray(entry.labels) ? entry.labels.join(', ') : (entry.labels || ''),
      owner: entry.owner || '',
      estimatedTime: '',
      coverageIssues: (entry.traceLinks || []).filter((t: any) => t.issueId).map((t: any) => t.issueId).join(', '),
      coveragePages: (entry.traceLinks || []).filter((t: any) => t.confluencePageId).map((t: any) => t.confluencePageId).join(', '),
      projectId: entry.projectId ? String(entry.projectId) : '',
      steps: (entry.testScript?.steps || entry.testScript?.testSteps || []).map((s: any) => ({
        action: s.description || s.action || '',
        testData: s.testData || s.data || '',
        expectedResult: s.expectedResult || s.result || '',
      })),
    }));
    if (tcs.length === 0) {
      return { fetched: 0, imported: 0, errors: ['No test cases found for this test run'] };
    }
    const result = importTestCases({ testCases: tcs, errors: [] });
    return { fetched: tcs.length, imported: result.imported || 0, errors: result.errors || [] };
  } catch (err: any) {
    return { fetched: 0, imported: 0, errors: [err.message] };
  }
}

// ── Get test cases for a specific test run (read-only, no import) ──
export async function fetchTestRunTestCases(testRunKey: string): Promise<any[]> {
  try {
    const response = await apiRequest(`/rest/tests/latest/testcase/search?testRunKey=${testRunKey}&maxResults=500`);
    const entries = response?.results || [];
    return entries.filter((e: any) => e?.key).map((entry: any) => ({
      key: entry.key || '',
      name: entry.name || '',
      status: entry.status?.name || entry.status || '',
      precondition: entry.precondition || '',
      objective: entry.objective || '',
      folder: entry.folder?.name || '',
      priority: entry.priority?.name || 'Normal',
      owner: entry.owner || '',
      projectId: entry.projectId ? String(entry.projectId) : '',
      executionStatus: entry.executionStatus?.name || entry.executionStatus || '',
      executedBy: entry.executedBy || '',
      executedOn: entry.executedOn || '',
      steps: (entry.testScript?.steps || entry.testScript?.testSteps || []).map((s: any) => ({
        action: s.description || s.action || '',
        testData: s.testData || s.data || '',
        expectedResult: s.expectedResult || s.result || '',
      })),
    }));
  } catch (err: any) {
    console.error(`[zephyr] fetchTestRunTestCases error: ${err.message}`);
    throw err;
  }
}

// ── Create Test Case in Zephyr ──
export async function createZephyrTestCase(data: {
  name: string;
  projectKey: string;
  folder?: string;
  priority?: string;
  precondition?: string;
  objective?: string;
  labels?: string[];
  steps: { action: string; testData: string; expectedResult: string }[];
}): Promise<{ key: string; name: string; status: string }> {
  const body: any = {
    name: data.name,
    projectKey: data.projectKey,
    status: { name: 'Draft' },
    testScript: {
      steps: data.steps.map(s => ({
        description: s.action || '',
        data: s.testData || '',
        result: s.expectedResult || '',
      })),
    },
  };
  if (data.folder) body.folder = { name: data.folder };
  if (data.priority) body.priority = { name: data.priority };
  if (data.precondition) body.precondition = data.precondition;
  if (data.objective) body.objective = data.objective;
  if (data.labels?.length) body.labels = data.labels;

  return apiRequest('/rest/tests/latest/testcase', 'POST', body);
}

export async function fetchTestPlans(projectKey?: string): Promise<{ id: number; key: string; name: string; status: string }[]> {
  const pk = projectKey || config.projectKey;
  try {
    const response = await apiRequest(`/rest/tests/latest/testplan/search?maxResults=500&projectKey=${pk}`);
    return (response?.results || []).filter((r: any) => r?.key).map((r: any) => ({
      id: r.id,
      key: r.key,
      name: r.name || '',
      status: r.status?.name || '',
    }));
  } catch {
    return [];
  }
}
