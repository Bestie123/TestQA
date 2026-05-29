import http from 'http';

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
  steps: { action: string; testData: string; expectedResult: string }[];
}

let config: ZephyrConfig = {
  baseUrl: process.env.ZEPHYR_BASE_URL || 'https://jira.ifellow.ru',
  projectKey: process.env.ZEPHYR_PROJECT_KEY || 'IBPA',
  apiToken: process.env.ZEPHYR_API_TOKEN || '',
};

export function setZephyrConfig(cfg: Partial<ZephyrConfig>): void {
  config = { ...config, ...cfg };
}

export function getZephyrConfig(): ZephyrConfig {
  return { ...config };
}

function apiRequest(path: string, method: string = 'GET'): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.baseUrl);
    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(config.apiToken ? { 'Authorization': `Bearer ${config.apiToken}` } : {}),
      },
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        } else {
          reject(new Error(`Zephyr API ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

export async function fetchTestCasesFromZephyr(): Promise<ZephyrTestCase[]> {
  const projectKey = config.projectKey;
  const response = await apiRequest(`/rest/zephyr/latest/testcase?projectKey=${projectKey}&maxResults=500`);
  const tcs: ZephyrTestCase[] = [];

  const entries = response?.data || response?.entries || response || [];
  for (const entry of entries) {
    tcs.push({
      key: entry.key || entry.id || '',
      name: entry.name || '',
      status: entry.status || 'Approved',
      precondition: entry.precondition || '',
      objective: entry.objective || '',
      folder: entry.folder || '',
      priority: entry.priority || 'Normal',
      component: entry.component || '',
      labels: entry.labels || '',
      owner: entry.owner || '',
      estimatedTime: '',
      coverageIssues: '',
      coveragePages: '',
      steps: (entry.steps || []).map((s: any, i: number) => ({
        action: s.action || '',
        testData: s.testData || '',
        expectedResult: s.expectedResult || '',
      })),
    });
  }

  return tcs;
}

export async function syncFromZephyr(): Promise<{ fetched: number; imported: number; updated: number; errors: string[] }> {
  const { importTestCases, parseExcelRows } = require('./importer');
  try {
    const remote = await fetchTestCasesFromZephyr();
    return { fetched: remote.length, imported: 0, updated: 0, errors: [] };
  } catch (err: any) {
    return { fetched: 0, imported: 0, updated: 0, errors: [err.message] };
  }
}
