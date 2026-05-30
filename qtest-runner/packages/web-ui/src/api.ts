export interface TestCase {
  id: string;
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
  estimated_time: string;
  coverage_issues: string;
  coverage_pages: string;
  steps: TestStep[];
  created_at: string;
  updated_at: string;
}

export interface TestStep {
  id: string;
  test_case_id: string;
  idx: number;
  action: string;
  test_data: string;
  expected_result: string;
}

async function safeJson<T>(res: Response | Promise<Response>, fallback: T): Promise<T> {
  const r = await res;
  if (!r.ok) return fallback;
  try { return await r.json(); } catch { return fallback; }
}

const sj = safeJson;

export async function fetchTestCases(
  api: string,
  params?: { folder?: string; search?: string }
): Promise<TestCase[]> {
  const q = new URLSearchParams();
  if (params?.folder) q.set('folder', params.folder);
  if (params?.search) q.set('search', params.search);
  const url = `${api}/testcases${q.toString() ? '?' + q.toString() : ''}`;
  return sj(fetch(url), []);
}

export async function fetchTestCase(api: string, key: string): Promise<TestCase | null> {
  return sj(fetch(`${api}/testcases/${encodeURIComponent(key)}`), null);
}

export async function fetchFolders(api: string): Promise<string[]> {
  return sj(fetch(`${api}/folders`), []);
}

// ── Execution types ──
export interface Execution {
  id: string;
  test_case_key: string;
  test_case_name: string;
  status: string;
  folder: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  steps: StepResult[];
}

export interface StepResult {
  id: string;
  execution_id: string;
  step_index: number;
  action: string;
  test_data: string;
  expected_result: string;
  status: string;
  screenshot: string;
  notes: string;
  started_at: string;
  completed_at: string;
}

async function postJson(api: string, path: string, body: any): Promise<any> {
  return sj(fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), null);
}

export async function createExecution(api: string, testCaseKey: string): Promise<Execution> {
  return postJson(api, '/executions', { testCaseKey });
}

export async function startExecution(api: string, id: string): Promise<Execution> {
  return sj(fetch(`${api}/executions/${id}/start`, { method: 'POST' }), null);
}

export async function fetchExecution(api: string, id: string): Promise<Execution> {
  return sj(fetch(`${api}/executions/${id}`), null);
}

export async function updateStepStatus(
  api: string,
  executionId: string,
  stepIndex: number,
  status: string,
  screenshot?: string,
  notes?: string
): Promise<Execution> {
  return postJson(api, `/executions/${executionId}/steps/${stepIndex}`, { status, screenshot, notes });
}

export async function fetchExecutions(api: string): Promise<Execution[]> {
  return sj(fetch(`${api}/executions`), []);
}

// ── Recording types ──
export interface RecordingSession {
  id: string;
  name: string;
  status: string;
  profileId: string;
  startedAt: string;
  stoppedAt: string;
  actions: RecordedAction[];
  actionCount?: number;
}

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
}

export interface CompositeStep {
  id: string;
  name: string;
  description: string;
  steps: any[];
  parameters: any[];
  createdAt: string;
  updatedAt: string;
}

export async function startRecording(api: string, name: string, profileId?: string): Promise<RecordingSession> {
  return postJson(api, '/recordings/start', { name, profileId });
}

export async function stopRecording(api: string, sessionId: string): Promise<RecordingSession> {
  return sj(fetch(`${api}/recordings/${sessionId}/stop`, { method: 'POST' }), null);
}

export async function fetchRecording(api: string, sessionId: string): Promise<RecordingSession> {
  return sj(fetch(`${api}/recordings/${sessionId}`), null);
}

export async function fetchRecordings(api: string): Promise<RecordingSession[]> {
  return sj(fetch(`${api}/recordings`), []);
}

export async function convertRecording(api: string, sessionId: string): Promise<{ action: string; testData: string; expectedResult: string }[]> {
  return sj(fetch(`${api}/recordings/${sessionId}/convert`, { method: 'POST' }), []);
}

export async function fetchCompositeSteps(api: string): Promise<CompositeStep[]> {
  return sj(fetch(`${api}/composite-steps`), []);
}

export async function createCompositeStep(api: string, data: { name: string; description: string; steps: any[]; parameters?: any[] }): Promise<CompositeStep> {
  return postJson(api, '/composite-steps', data);
}

// Browser-agent CDP-based recording
export async function launchBrowser(agentApi: string, profileName: string): Promise<string | null> {
  const r = await sj(fetch(`${agentApi}/launch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileName }) }), null);
  return r?.profileId || null;
}

export async function startBrowserRecording(agentApi: string, profileId: string, sessionId: string, recorderUrl: string): Promise<boolean> {
  const r = await sj(fetch(`${agentApi}/record/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId, sessionId, recorderUrl }) }), null);
  return r?.ok === true;
}

export async function stopBrowserRecording(agentApi: string, sessionId: string): Promise<boolean> {
  const r = await sj(fetch(`${agentApi}/record/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) }), null);
  return r?.ok === true;
}

// ── Zephyr Sync / Diff / Coverage types ──
export interface SyncResult {
  fetched: number;
  imported: number;
  updated: number;
  errors: string[];
}

export interface DiffEntry {
  field: string;
  localValue: string;
  remoteValue: string;
}

export interface DiffResult {
  key: string;
  name: string;
  differences: DiffEntry[];
  localOnly: boolean;
  remoteOnly: boolean;
}

export interface ReportSummary {
  total: number;
  byStatus: Record<string, number>;
  byTestCase: { test_case_key: string; test_case_name: string; total: number; passed: number; failed: number; blocked: number }[];
  avgDurationSeconds: number;
}

export async function syncFromZephyr(api: string): Promise<SyncResult> {
  return sj(fetch(`${api}/zephyr/sync`, { method: 'POST' }), { fetched: 0, imported: 0, updated: 0, errors: ['API unavailable'] });
}

export async function diffExcel(api: string, rows: string[][]): Promise<DiffResult[]> {
  return postJson(api, '/diff/excel', { rows });
}

export async function fetchCoverage(api: string): Promise<Record<string, { key: string; name: string; folder: string }[]>> {
  return sj(fetch(`${api}/coverage`), {});
}

export async function fetchReportSummary(api: string): Promise<ReportSummary> {
  return sj(fetch(`${api}/reports/summary`), { total: 0, byStatus: {}, byTestCase: [], avgDurationSeconds: 0 });
}

export async function fetchReportHistory(api: string): Promise<Record<string, Record<string, number>>> {
  return sj(fetch(`${api}/reports/history`), {});
}

export async function importExcel(
  api: string,
  rows: string[][]
): Promise<{ imported: number; updated: number; skipped: number; errors: string[] }> {
  return postJson(api, '/import', { rows });
}

export async function createTestCase(api: string, data: { key: string; name: string; folder?: string; steps: { action: string; testData: string; expectedResult: string }[] }): Promise<TestCase | null> {
  return sj(fetch(`${api}/testcases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }), null);
}

export async function autoNextStep(api: string, executionId: string): Promise<any> {
  return sj(fetch(`${api}/executions/${executionId}/auto-next`, { method: 'POST' }), null);
}

// ── Settings ──

export async function getSettings(api: string): Promise<Record<string, string>> {
  return sj(fetch(`${api}/settings`), {});
}

export async function setSettingsBulk(api: string, settings: Record<string, string>): Promise<Record<string, string>> {
  return sj(fetch(`${api}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  }), {});
}
