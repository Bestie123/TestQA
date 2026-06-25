import React, { useState, useRef, useEffect } from 'react';
import { syncFromZephyr, syncFromZephyrTestRun, diffExcel, fetchCoverage, fetchZephyrTestRunTestCases, fetchZephyrProjects, TestRun } from '../api';
import * as XLSX from 'xlsx';

interface Props { api: string }

interface FolderNode { id: string; name: string; path: string; count?: number; children: FolderNode[] }

// ── Client-side API cache ──
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithCache(url: string): Promise<any> {
  const cached = apiCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const response = await fetch(url);
  const data = await response.json();
  apiCache.set(url, { data, timestamp: Date.now() });
  return data;
}

function invalidateCache(pattern?: string) {
  if (!pattern) { apiCache.clear(); return; }
  for (const key of apiCache.keys()) {
    if (key.includes(pattern)) apiCache.delete(key);
  }
}

const STATUS_DISPLAY: Record<string, string> = {
  'Approved': 'Утверждено',
  'Утверждено': 'Утверждено',
  'Draft': 'Черновик',
  'Черновик': 'Черновик',
  'Deprecated': 'Устаревший',
  'Устаревший': 'Устаревший',
  'Устарел': 'Устаревший',
  'Automated': 'Автоматизирован',
  'Автоматизирован': 'Автоматизирован',
  'In Review': 'В проверке',
  'IN_PROGRESS': 'В РАБОТЕ',
  'В РАБОТЕ': 'В РАБОТЕ',
  'Выполняется': 'В РАБОТЕ',
  'Completed': 'Выполнен',
  'Выполнен': 'Выполнен',
  'NOT_RUN': 'Не выполнен',
  'Не выполнен': 'Не выполнен',
};

const STATUS_COLORS: Record<string, string> = {
  'Утверждено': '#3abb4b',
  'Черновик': '#f0ad4e',
  'Устаревший': '#dc3545',
  'Автоматизирован': '#00bcd4',
  'В проверке': '#1976d2',
  'В РАБОТЕ': '#f0ad4e',
  'Выполнен': '#3abb4b',
  'Не выполнен': '#97a0af',
};

function statusDisplay(s: string): string { return STATUS_DISPLAY[s] || s; }
function statusColor(s: string): string { return STATUS_COLORS[statusDisplay(s)] || '#97a0af'; }

const KNOWN_STATUSES = ['Approved', 'Draft', 'Deprecated', 'Automated', 'In Review', 'IN_PROGRESS'];

const FILTER_CRITERIA = [
  { field: 'name', label: 'Наименование' },
  { field: 'status', label: 'Статус' },
  { field: 'priority', label: 'Приоритет' },
  { field: 'tag', label: 'Тег' },
  { field: 'createdDate', label: 'Дата создания' },
  { field: 'estimatedTime', label: 'Расчётное время' },
  { field: 'component', label: 'Компонент' },
  { field: 'owner', label: 'Владелец' },
  { field: 'coverageIssues', label: 'Покрытие (Задачи)' },
  { field: 'coveragePages', label: 'Покрытие (Страницы)' },
] as const;

const CYC_CRITERIA = [
  { field: 'cycVersion', label: 'Версии' },
  { field: 'cycIteration', label: 'Итерации' },
  { field: 'cycStatus', label: 'Статус' },
  { field: 'cycAssignedTo', label: 'Кому назначено' },
  { field: 'cycTestPlan', label: 'План тестирования' },
] as const;

const PLN_CRITERIA = [
  { field: 'plnStatus', label: 'Статус' },
  { field: 'plnTag', label: 'Тег' },
] as const;

const PRIORITY_COLORS: Record<string, string> = {
  'Highest': '#e34938',
  'High': '#f08b4e',
  'Medium': '#ffa900',
  'Нормальный': '#ffa900',
  'Low': '#6cb82c',
  'Lowest': '#97a0af',
};

const PAGE_SIZE = 100;

const styles = {
  zPage: {
    display: 'flex', flexDirection: 'column' as const, flex: 1, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,sans-serif',
    color: '#172b4d', fontSize: 14, background: '#f4f5f7', minHeight: 0, height: '100%', width: '100%',
  },
  navTabs: {
    display: 'flex', gap: 0, background: '#fff', borderBottom: '1px solid #dfe1e6', paddingLeft: 16,
  },
  navTab: {
    padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 500 as const, color: '#5e6c84',
    borderBottom: '2px solid transparent', userSelect: 'none' as const,
  },
  navTabActive: {
    padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 as const, color: '#0052cc',
    borderBottom: '2px solid #0052cc', userSelect: 'none' as const,
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' as const },
  sidebar: {
    minWidth: 160, background: '#fff', borderRight: '1px solid #dfe1e6',
    overflowY: 'auto' as const, padding: '8px 0', position: 'relative' as const,
    display: 'flex', flexDirection: 'column' as const,
  },
  main: { flex: 1, overflow: 'auto' as const, padding: 16 },
  folderItem: (selected: boolean, depth: number): React.CSSProperties => ({
    padding: '6px 16px 6px ' + (16 + depth * 16) + 'px',
    cursor: 'pointer', fontSize: 13, color: selected ? '#0052cc' : '#172b4d',
    background: selected ? '#ebf2ff' : 'transparent',
    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' as const,
  }),
  folderCount: { fontSize: 11, color: '#97a0af', marginLeft: 0 },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0',
    borderBottom: '1px solid #dfe1e6', marginBottom: 8, flexWrap: 'wrap' as const,
    background: '#fff', position: 'sticky' as const, top: 0, zIndex: 10,
  },
  btn: (primary = false): React.CSSProperties => ({
    padding: '6px 12px', fontSize: 13, fontWeight: 500 as const, border: '1px solid #dfe1e6',
    borderRadius: 3, cursor: 'pointer', background: primary ? '#0052cc' : '#fff',
    color: primary ? '#fff' : '#42526e', whiteSpace: 'nowrap' as const,
  }),
  searchInput: {
    padding: '6px 10px', border: '1px solid #dfe1e6', borderRadius: 3,
    fontSize: 13, width: 200, outline: 'none', background: '#fafbfc',
  },
  table: {
    width: '100%', borderCollapse: 'collapse' as const, fontSize: 13,
    background: '#fff', borderRadius: 3, boxShadow: '0 1px 1px rgba(9,30,66,.25)',
  },
  th: {
    padding: '8px 5px', textAlign: 'left' as const, fontWeight: 600 as const,
    color: '#5e6c84', fontSize: 11, textTransform: 'uppercase' as const,
    borderBottom: '2px solid #dfe1e6', whiteSpace: 'nowrap' as const,
    position: 'sticky' as const, top: 0, background: '#fff', zIndex: 2,
  },
  td: { padding: '6px 5px', borderBottom: '1px solid #ebecf0', verticalAlign: 'middle' as const },
  statusLozenge: (color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '0 8px', borderRadius: 12, fontSize: 12,
    fontWeight: 600, lineHeight: '22px', color: '#fff', background: color,
    maxWidth: '100%', whiteSpace: 'nowrap' as const,
  }),
  priorityDot: (color: string): React.CSSProperties => ({
    display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
    background: color, verticalAlign: 'middle',
  }),
  filterPanel: {
    padding: '12px 0', display: 'flex', gap: 12, flexWrap: 'wrap' as const,
    borderBottom: '1px solid #dfe1e6', marginBottom: 8,
  },
  pagination: {
    display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0',
    justifyContent: 'space-between' as const, fontSize: 13, color: '#5e6c84',
  },
  pageBtn: (active = false): React.CSSProperties => ({
    padding: '4px 10px', border: active ? '2px solid #0052cc' : '1px solid #dfe1e6',
    borderRadius: 3, cursor: 'pointer', background: active ? '#ebf2ff' : '#fff',
    color: active ? '#0052cc' : '#42526e', fontWeight: active ? 600 : 400,
    fontSize: 13, minWidth: 32, textAlign: 'center' as const,
  }),
  checkbox: { width: 16, height: 16, cursor: 'pointer', margin: 0, verticalAlign: 'middle' as const },
  progressBar: (pct: number): React.CSSProperties => ({
    height: 8, borderRadius: 4, background: '#ebecf0', overflow: 'hidden', minWidth: 80,
  }),
  progressFill: (pct: number): React.CSSProperties => ({
    height: '100%', borderRadius: 4, width: Math.min(pct, 100) + '%',
    background: pct >= 100 ? '#3abb4b' : pct >= 50 ? '#ffa900' : '#e34938',
    transition: 'width 0.3s',
  }),
  spinner: {
    display: 'inline-block', width: 14, height: 14, border: '2px solid #dfe1e6',
    borderTopColor: '#0052cc', borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  } as React.CSSProperties,
};

function StatusLozenge({ status }: { status?: string }) {
  const color = statusColor(status || '');
  const display = statusDisplay(status || '') || '—';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0 8px', borderRadius: 12, fontSize: 12,
      fontWeight: 600, lineHeight: '22px', color: '#fff', background: color,
      maxWidth: '100%', whiteSpace: 'nowrap' as const,
    }} data-testid="status-lozenge">
      {display}
    </span>
  );
}

function PriorityDot({ priority }: { priority?: string }) {
  const color = PRIORITY_COLORS[priority || ''] || '#97a0af';
  return <span style={styles.priorityDot(color)} title={priority || ''} />;
}

  function FolderTreeItem({ node, depth, activePath, onSelect, onSyncFolder, isRoot, rootLabel }: {
  node: FolderNode; depth: number; activePath: string; onSelect: (path: string) => void; onSyncFolder?: (folderId: string) => void; isRoot?: boolean; rootLabel?: string
}) {
  const [expanded, setExpanded] = useState(true);
  const val = node.path || node.name;
  const hasChildren = node.children && node.children.length > 0;
  const selected = activePath && activePath === val;
  
  // Format: "Все тест кейсы(6021)" or "Новый сайт(149)" — no space before parenthesis
  const displayCount = node.count !== undefined && node.count > 0 ? `(${node.count})` : '';
  const displayName = isRoot ? rootLabel : node.name;
  
  return (
    <>
      <div style={styles.folderItem(selected, depth)} onClick={() => onSelect(val)}>
        {hasChildren ? (
          <span onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ cursor: 'pointer', width: 16, textAlign: 'center', fontSize: 10, userSelect: 'none' }}>
            {expanded ? '▼' : '▶'}
          </span>
        ) : <span style={{ width: 16 }} />}
        <span>{displayName}{displayCount}</span>
        {onSyncFolder && (
          <span onClick={e => { e.stopPropagation(); onSyncFolder(node.id); }}
            style={{ cursor: 'pointer', color: '#0052cc', fontSize: 10, padding: '0 2px' }} title="Синхронизировать папку">
            🔄
          </span>
        )}
      </div>
      {expanded && hasChildren && node.children.map(child => (
        <FolderTreeItem key={child.id} node={child} depth={depth + 1}
          activePath={activePath}
          onSelect={onSelect} />
      ))}
    </>
  );
}

export function SyncPage({ api }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [statusText, setStatus] = useState('');
  const [projects, setProjects] = useState<{ key: string; name: string }[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [testPlans, setTestPlans] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTestRun, setSelectedTestRun] = useState('');
  const [syncResult, setSyncResult] = useState<any>(null);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'cases' | 'cycles' | 'plans' | 'reports' | 'config'>('cases');
  const [dataMode, setDataMode] = useState<'local' | 'remote'>('remote');

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sidebarW, setSidebarW] = useState(240);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showCriteriaMenu, setShowCriteriaMenu] = useState(false);
  const [criteriaSearch, setCriteriaSearch] = useState('');
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: sidebarW };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const w = Math.max(160, Math.min(500, dragRef.current.startW + (ev.clientX - dragRef.current.startX)));
      setSidebarW(w);
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const [searchText, setSearchText] = useState('');
  const [cycSearch, setCycSearch] = useState('');
  const [plnSearch, setPlnSearch] = useState('');
  const [plnActiveCriteria, setPlnActiveCriteria] = useState<string[]>([]);
  const [plnFilterValues, setPlnFilterValues] = useState<Record<string, string>>({});
  const [plnStatuses, setPlnStatuses] = useState<string[]>([]);
  const [plnShowFilterMenu, setPlnShowFilterMenu] = useState(false);
  const [plnShowCriteriaMenu, setPlnShowCriteriaMenu] = useState(false);
  const [plnCriteriaSearch, setPlnCriteriaSearch] = useState('');
  const [filterFolder, setFilterFolder] = useState('');

  // Per-tab folder state
  const [cycleFolders, setCycleFolders] = useState<FolderNode[]>([]);
  const [planFolders, setPlanFolders] = useState<FolderNode[]>([]);

  const [activeCriteria, setActiveCriteria] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({ status: KNOWN_STATUSES, priority: [], owner: [], component: [], tag: [] });
  const [coverage, setCoverage] = useState<any>(null);
  const [diffResults, setDiffResults] = useState<any>(null);
  const [selectedCycleKey, setSelectedCycleKey] = useState<string | null>(null);
  const [cycleTestCases, setCycleTestCases] = useState<any[]>([]);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [cycActiveCriteria, setCycActiveCriteria] = useState<string[]>([]);
  const [cycFilterValues, setCycFilterValues] = useState<Record<string, string>>({});
  const [cycStatuses, setCycStatuses] = useState<string[]>([]);
  const [cycShowFilterMenu, setCycShowFilterMenu] = useState(false);
  const [cycShowCriteriaMenu, setCycShowCriteriaMenu] = useState(false);
  const [cycCriteriaSearch, setCycCriteriaSearch] = useState('');
  const [cycPage, setCycPage] = useState(1);

  useEffect(() => {
    fetchZephyrProjects(api).then(list => {
      setProjects(list);
      if (list.length > 0) {
        const preferred = list.find((p: any) => p.key === 'IBPA2') || list.find((p: any) => p.key === 'IBPA') || list[0];
        setSelectedProject(preferred.key);
        setStatus(`Загружен список проектов (${list.length})`);
      }
    }).catch(() => {
      // Jira unreachable — load project list from local DB
      fetch(`${api}/local/testcases?limit=5000`).then(r => r.json()).then(data => {
        const byKey: Record<string, number> = {};
        for (const tc of (data.data || [])) {
          const match = tc.key?.match(/^([A-Z0-9]+)-/);
          if (match) byKey[match[1]] = (byKey[match[1]] || 0) + 1;
        }
        const list = Object.entries(byKey).map(([key, count]) => ({ key, name: `${key} (${count} TC)` })).sort((a, b) => a.key.localeCompare(b.key));
        setProjects(list);
        if (list.length > 0) {
          const preferred = list.find((p: any) => p.key === 'IBPA2') || list.find((p: any) => p.key === 'IBPA') || list[0];
          setSelectedProject(preferred.key);
          setStatus(`Проекты из локальной БД (${list.length})`);
        }
      }).catch(() => setStatus('Ошибка загрузки проектов'));
    });
  }, [api]);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    setTestCases([]);
    setFolders([]);
    setFilterFolder('');
    setPage(1);
    setFilteredCount(0);
    setStatus('Загрузка данных...');
    
    // Load folders from Zephyr API (fast), TCs from LOCAL SQLite (instant)
    const foldersUrl = `${api}/zephyr/folders?projectKey=${selectedProject}&type=testcase`;
    
    Promise.all([
      fetchWithCache(foldersUrl).catch(() => []),
      fetch(`${api}/local/testcases?projectKey=${selectedProject}&limit=100&offset=0`).then(r => r.json()).catch(() => ({ data: [], total: 0 })),
    ]).then(([folderTree, tcResult]) => {
      const tcData = tcResult?.data || [];
      let finalFolders: FolderNode[];
      if (Array.isArray(folderTree) && folderTree.length > 0) {
        finalFolders = addFolderCounts(folderTree, tcData);
      } else {
        // Zephyr unavailable — build folder tree from TC folder paths
        finalFolders = buildFolderTreeFromTCs(tcData);
      }
      setFolders(finalFolders);
      if (tcData.length > 0) {
        setTestCases(tcData);
        setFilteredCount(tcData.length);
        const st = new Set<string>(); const pr = new Set<string>(); const ow = new Set<string>();
        const cm = new Set<string>(); const tg = new Set<string>();
        for (const tc of tcData) {
          if (tc.status) st.add(tc.status);
          if (tc.priority) pr.add(tc.priority);
          if (tc.owner) ow.add(tc.owner);
          if (tc.component) cm.add(tc.component);
          if (tc.components) tc.components.forEach((c: string) => cm.add(c));
          if (tc.tags) {
            if (Array.isArray(tc.tags)) tc.tags.forEach((t: string) => tg.add(t));
            else if (typeof tc.tags === 'string') tg.add(tc.tags);
          }
          if (tc.labels) {
            if (Array.isArray(tc.labels)) tc.labels.forEach((t: string) => tg.add(t));
          }
        }
        setFilterOptions(prev => ({
          ...prev,
          status: [...new Set([...prev.status, ...st])].sort(),
          priority: [...new Set([...prev.priority, ...pr])].sort(),
          owner: [...new Set([...prev.owner, ...ow])].sort(),
          component: [...new Set([...prev.component, ...cm])].sort(),
          tag: [...new Set([...prev.tag, ...tg])].sort(),
        }));
        setStatus(`Загружено: ${tcData.length} TC (первые 100)`);
      }
    })
    .catch(() => setStatus('Ошибка загрузки'))
    .finally(() => setLoading(false));
  }, [api, selectedProject]);

  async function loadTestCases(p?: number) {
    setLoading(true);
    setStatus(dataMode === 'local' ? 'Загрузка TC из БД...' : 'Загрузка TC из Zephyr...');
    try {
      let merged: any[] = [];
      if (dataMode === 'local') {
        const params = new URLSearchParams();
        if (filterFolder) params.set('folder', filterFolder);
        if (searchText) params.set('search', searchText);
        params.set('limit', '500');
        params.set('offset', '0');
        const res = await fetch(`${api}/testcases?${params}`);
        const data = await res.json();
        merged = data.data || [];
      } else {
        const params = new URLSearchParams({ projectKey: selectedProject });
        if (filterFolder) params.set('folder', filterFolder);
        if (filterValues.status) params.set('status', filterValues.status);
        if (filterValues.priority) params.set('priority', filterValues.priority);
        if (filterValues.owner) params.set('owner', filterValues.owner);
        if (searchText) params.set('search', searchText);
        // Default: load first page only (100 items, ~13 sec)
        // "Load All" button sets maxPages=0
        params.set('maxPages', p === 0 ? '0' : '1');
        const url = `${api}/zephyr/testcases?${params}`;
        const data = await fetchWithCache(url);
        merged = Array.isArray(data) ? data : [];
      }
      setTestCases(merged);
      setFilteredCount(merged.length);
      const st = new Set<string>(); const pr = new Set<string>(); const ow = new Set<string>();
      const cm = new Set<string>(); const tg = new Set<string>();
      for (const tc of merged) {
        if (tc.status) st.add(tc.status);
        if (tc.priority) pr.add(tc.priority);
        if (tc.owner) ow.add(tc.owner);
        if (tc.component) cm.add(tc.component);
        if (tc.components) tc.components.forEach((c: string) => cm.add(c));
        if (tc.tags) {
          if (Array.isArray(tc.tags)) tc.tags.forEach((t: string) => tg.add(t));
          else if (typeof tc.tags === 'string') tg.add(tc.tags);
        }
        if (tc.labels) {
          if (Array.isArray(tc.labels)) tc.labels.forEach((t: string) => tg.add(t));
        }
      }
      setFilterOptions(prev => ({
        ...prev,
        status: [...new Set([...prev.status, ...st])].sort(),
        priority: [...new Set([...prev.priority, ...pr])].sort(),
        owner: [...new Set([...prev.owner, ...ow])].sort(),
        component: [...new Set([...prev.component, ...cm])].sort(),
        tag: [...new Set([...prev.tag, ...tg])].sort(),
      }));
      setStatus(`Загружено: ${merged.length} TC${dataMode === 'local' ? ' (локально)' : ''}`);
      setPage(p || 1);
    } catch (e: any) { setStatus(`Ошибка: ${e.message}`); }
    setLoading(false);
  }

  // Auto-load when switching tabs or data mode
  useEffect(() => {
    // Clear folder filter when switching tabs (each tab has its own folder structure)
    setFilterFolder('');
    
    if (activeTab === 'cases' && selectedProject && !loading) {
      // Load test cases and their folders
      if (testCases.length === 0 || dataMode === 'local') loadTestCases();
    }
    if (activeTab === 'cycles' && selectedProject && !loading) {
      // Load cycles and their folders
      loadTestRuns();
      loadCycleFolders();
    }
    if (activeTab === 'plans' && selectedProject && !loading) {
      // Load plans and their folders
      loadTestPlans();
      loadPlanFolders();
    }
  }, [activeTab, selectedProject, dataMode]);

  // Reload TC when folder filter changes
  useEffect(() => {
    if (selectedProject && testCases.length > 0) loadTestCases();
  }, [filterFolder]);

  // Reset cycles page when search/filter changes
  useEffect(() => {
    setCycPage(1);
  }, [cycSearch, cycActiveCriteria, cycFilterValues]);

  async function loadTestRuns() {
    if (!selectedProject) return;
    setLoading(true);
    setStatus(dataMode === 'local' ? 'Загрузка прогонов из БД...' : 'Загрузка тестовых прогонов...');
    try {
      let runs: any[];
      if (dataMode === 'local') {
        const res = await fetch(`${api}/local/testruns`);
        const data = await res.json();
        runs = data.data || [];
      } else {
        // Load from Zephyr API - first 500 only (fast, ~1.5 sec)
        const res = await fetch(`${api}/zephyr/testruns`);
        const data = await res.json();
        runs = Array.isArray(data) ? data : [];
      }
      // Match project key prefix (IBPA2 should match IBPA- runs)
      const baseKey = selectedProject.replace(/2$/, '');
      const filtered = runs.filter((r: any) => r.key?.startsWith(baseKey));
      setTestRuns(filtered);
      const st = new Set<string>();
      for (const r of filtered) { if (r.status) st.add(r.status); }
      setCycStatuses([...st].sort());
      setStatus(`Загружено прогонов: ${filtered.length}${dataMode === 'local' ? ' (локально)' : ''}`);
    } catch { setStatus('Ошибка загрузки прогонов'); }
    setLoading(false);
  }

  async function loadTestPlans() {
    if (!selectedProject) return;
    setLoading(true);
    setStatus(dataMode === 'local' ? 'Загрузка планов из БД...' : 'Загрузка тест-планов...');
    try {
      let plans: any[];
      if (dataMode === 'local') {
        const res = await fetch(`${api}/local/testplans`);
        const data = await res.json();
        plans = data.data || [];
      } else {
        const data = await fetchWithCache(`${api}/zephyr/testplans`);
        plans = Array.isArray(data) ? data : [];
      }
      const baseKey = selectedProject.replace(/2$/, '');
      const filtered = plans.filter((p: any) => p.key?.startsWith(baseKey));
      setTestPlans(filtered);
      const st = new Set<string>();
      for (const p of filtered) { if (p.status) st.add(p.status); }
      setPlnStatuses([...st].sort());
      setStatus(`Загружено планов: ${filtered.length}${dataMode === 'local' ? ' (локально)' : ''}`);
    } catch { setStatus('Ошибка загрузки планов'); }
    setLoading(false);
  }

  async function loadCycleFolders() {
    if (!selectedProject) return;
    try {
      if (dataMode === 'local') {
        // Build folders from local test_runs folder_id
        const res = await fetch(`${api}/local/testruns`);
        const data = await res.json();
        const runs = data.data || [];
        // Group by folder_id to create virtual folders
        const folderMap = new Map<string, FolderNode>();
        for (const r of runs) {
          if (r.folder_id) {
            const id = String(r.folder_id);
            if (!folderMap.has(id)) {
              folderMap.set(id, { id, name: `Папка ${id}`, path: `Папка ${id}`, children: [] });
            }
          }
        }
        setCycleFolders(Array.from(folderMap.values()));
      } else {
        // maxPages=0 for full folder tree
        const data = await fetchWithCache(`${api}/zephyr/folders?projectKey=${selectedProject}&type=cycles&maxPages=0`);
        if (Array.isArray(data)) {
          setCycleFolders(addFolderCounts(data, testRuns));
        }
      }
    } catch { /* silent */ }
  }

  async function loadPlanFolders() {
    if (!selectedProject) return;
    try {
      if (dataMode === 'local') {
        setPlanFolders([]);
      } else {
        // maxPages=0 for full folder tree
        const data = await fetchWithCache(`${api}/zephyr/folders?projectKey=${selectedProject}&type=plans&maxPages=0`);
        if (Array.isArray(data)) {
          setPlanFolders(addFolderCounts(data, testPlans));
        }
      }
    } catch { /* silent */ }
  }

  async function syncToLocal() {
    setLoading(true);
    setStatus('Синхронизация в локальную БД...');
    try {
      const [runsRes, plansRes] = await Promise.all([
        fetch(`${api}/local/sync/testruns`, { method: 'POST' }).then(r => r.json()),
        fetch(`${api}/local/sync/testplans`, { method: 'POST' }).then(r => r.json()),
      ]);
      invalidateCache();
      setStatus(`Синхронизировано: ${runsRes.synced || 0} прогонов, ${plansRes.synced || 0} планов`);
    } catch { setStatus('Ошибка синхронизации'); }
    setLoading(false);
  }

  async function handleSync() {
    if (!selectedProject) { setStatus('Выберите проект'); return; }
    setLoading(true);
    setStatus('Синхронизация всех TC...');
    try {
      await fetch(`${api}/zephyr/config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey: selectedProject })
      });
      const result = await syncFromZephyr(api);
      setSyncResult(result);
      invalidateCache('zephyr');
      setStatus(`Синхронизировано: ${result.fetched} TC`);
      setTimeout(() => loadTestCases(), 500);
    } catch { setStatus('Ошибка синхронизации'); }
    setLoading(false);
  }

  async function handleSyncTestRun() {
    if (!selectedTestRun) { setStatus('Выберите тестовый прогон'); return; }
    setLoading(true);
    setStatus(`Синхронизация прогона "${selectedTestRun}"...`);
    try {
      const result = await syncFromZephyrTestRun(api, selectedTestRun);
      setSyncResult(result);
      setStatus(`Синхронизировано: ${result.fetched} TC из прогона`);
      setTimeout(() => loadTestCases(), 500);
    } catch { setStatus('Ошибка'); }
    setLoading(false);
  }

  async function syncFolder(folderId: string) {
    setLoading(true);
    setStatus(`Синхронизация папки ${folderId}...`);
    try {
      // Find folder name for display
      const folderNode = findFolderById(activeTab === 'cases' ? folders : activeTab === 'cycles' ? cycleFolders : planFolders, folderId);
      const folderName = folderNode?.name || folderId;
      
      // Sync based on active tab
      if (activeTab === 'cases') {
        // For test cases, sync by folder path
        const result = await syncFromZephyr(api);
        setSyncResult(result);
        setStatus(`Синхронизировано: ${result.fetched} TC из папки "${folderName}"`);
        setTimeout(() => loadTestCases(), 500);
      } else if (activeTab === 'cycles') {
        // For test cycles, we need to sync all cycles and filter by folder
        const result = await syncToLocal();
        setStatus(`Синхронизировано прогоны из папки "${folderName}"`);
      } else if (activeTab === 'plans') {
        // For test plans, sync all plans
        const result = await syncToLocal();
        setStatus(`Синхронизировано планы из папки "${folderName}"`);
      }
    } catch { setStatus('Ошибка синхронизации папки'); }
    setLoading(false);
  }

  async function syncTestRun(runKey: string) {
    setLoading(true);
    setStatus(`Синхронизация прогона "${runKey}"...`);
    try {
      const result = await syncFromZephyrTestRun(api, runKey);
      setSyncResult(result);
      setStatus(`Синхронизировано: ${result.fetched} TC из прогона "${runKey}"`);
      setTimeout(() => loadTestCases(), 500);
    } catch { setStatus('Ошибка синхронизации прогона'); }
    setLoading(false);
  }

  async function syncTestCase(testCaseKey: string) {
    setLoading(true);
    setStatus(`Синхронизация тест-кейса "${testCaseKey}"...`);
    try {
      // Sync all TC (which will update this specific one)
      const result = await syncFromZephyr(api);
      setSyncResult(result);
      setStatus(`Тест-кейс "${testCaseKey}" синхронизирован`);
      setTimeout(() => loadTestCases(), 500);
    } catch { setStatus('Ошибка синхронизации тест-кейса'); }
    setLoading(false);
  }

  async function handleCoverage() {
    setStatus('Загрузка coverage...');
    try { setCoverage(await fetchCoverage(api)); setStatus('Готово'); }
    catch { setStatus('Ошибка загрузки'); }
  }

  async function handleDiff() {
    const file = fileInput.current?.files?.[0];
    if (!file) { setStatus('Выберите Excel-файл'); return; }
    setStatus('Чтение файла...');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      setStatus('Сравнение...');
      setDiffResults(await diffExcel(api, rows));
      setStatus('Готово');
    } catch { setStatus('Ошибка сравнения'); }
  }

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === visibleTC.length) { setSelected(new Set()); }
    else { setSelected(new Set(visibleTC.map(t => t.key))); }
  }

  // Client-side filtering
  function applyFilters(data: any[]): any[] {
    return data.filter(tc => {
      for (const field of activeCriteria) {
        if (field === 'name' && filterValues.name) {
          const search = filterValues.name.toLowerCase();
          if (!tc.name?.toLowerCase().includes(search) && !tc.key?.toLowerCase().includes(search)) return false;
        }
        if (field === 'status' && filterValues.status) {
          if (statusDisplay(tc.status || '') !== statusDisplay(filterValues.status)) return false;
        }
        if (field === 'priority' && filterValues.priority) {
          if (tc.priority !== filterValues.priority) return false;
        }
        if (field === 'owner' && filterValues.owner) {
          if (tc.owner !== filterValues.owner) return false;
        }
        if (field === 'tag' && filterValues.tag) {
          const search = filterValues.tag.toLowerCase();
          const tags = tc.tags || tc.labels || [];
          if (Array.isArray(tags)) {
            if (!tags.some((t: string) => t.toLowerCase().includes(search))) return false;
          } else if (typeof tags === 'string') {
            if (!tags.toLowerCase().includes(search)) return false;
          }
        }
        if (field === 'component' && filterValues.component) {
          if (tc.component !== filterValues.component && tc.components?.[0] !== filterValues.component) return false;
        }
        if (field === 'createdDate') {
          if (filterValues.createdDateFrom && tc.createdOn) {
            if (new Date(tc.createdOn) < new Date(filterValues.createdDateFrom)) return false;
          }
          if (filterValues.createdDateTo && tc.createdOn) {
            const to = new Date(filterValues.createdDateTo);
            to.setDate(to.getDate() + 1);
            if (new Date(tc.createdOn) >= to) return false;
          }
        }
        if (field === 'estimatedTime') {
          const val = tc.estimatedTime || tc.estimatedMinutes || 0;
          if (filterValues.estimatedTimeFrom && val < Number(filterValues.estimatedTimeFrom)) return false;
          if (filterValues.estimatedTimeTo && val > Number(filterValues.estimatedTimeTo)) return false;
        }
        if (field === 'coverageIssues') {
          const val = tc.coverageIssues || tc.linkedIssues?.length || 0;
          if (filterValues.coverageIssuesFrom && val < Number(filterValues.coverageIssuesFrom)) return false;
          if (filterValues.coverageIssuesTo && val > Number(filterValues.coverageIssuesTo)) return false;
        }
        if (field === 'coveragePages') {
          const val = tc.coveragePages || 0;
          if (filterValues.coveragePagesFrom && val < Number(filterValues.coveragePagesFrom)) return false;
          if (filterValues.coveragePagesTo && val > Number(filterValues.coveragePagesTo)) return false;
        }
      }
      return true;
    });
  }

  // Pagination + sorting
  function naturalSortKey(key: string): string {
    return key.replace(/(\d+)/g, (m) => m.padStart(10, '0'));
  }

  function toggleSort(field: string) {
    if (sortField === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortDir('asc'); }
  }

  const filteredTC = applyFilters(testCases);
  const sortedTC = [...filteredTC].sort((a, b) => {
    if (!sortField) return 0;
    const av = (a[sortField] || '').toString().toLowerCase();
    const bv = (b[sortField] || '').toString().toLowerCase();
    const ak = sortField === 'key' ? naturalSortKey(av) : av;
    const bk = sortField === 'key' ? naturalSortKey(bv) : bv;
    return sortDir === 'asc' ? (ak < bk ? -1 : ak > bk ? 1 : 0) : (ak > bk ? -1 : ak < bk ? 1 : 0);
  });

  const totalPages = Math.ceil(sortedTC.length / PAGE_SIZE) || 1;
  const visibleTC = sortedTC.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={styles.zPage}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Navigation tabs */}
      <div style={styles.navTabs}>
        <div style={activeTab === 'cases' ? styles.navTabActive : styles.navTab} onClick={() => setActiveTab('cases')}>
          Тест кейсы
        </div>
        <div style={activeTab === 'cycles' ? styles.navTabActive : styles.navTab} onClick={() => setActiveTab('cycles')}>
          Тестовые прогоны
        </div>
        <div style={activeTab === 'plans' ? styles.navTabActive : styles.navTab} onClick={() => setActiveTab('plans')}>
          Планы тестирования
        </div>
        <div style={activeTab === 'reports' ? styles.navTabActive : styles.navTab} onClick={() => setActiveTab('reports')}>
          Отчёты
        </div>
        <div style={activeTab === 'config' ? styles.navTabActive : styles.navTab} onClick={() => setActiveTab('config')}>
          Конфигурация
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16 }}>
          <span style={{ fontSize: 11, color: '#5e6c84' }}>Источник:</span>
          <div style={{ display: 'flex', border: '1px solid #dfe1e6', borderRadius: 3, overflow: 'hidden' }}>
            <button onClick={() => setDataMode('local')}
              style={{ padding: '4px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
                background: dataMode === 'local' ? '#0052cc' : '#fff',
                color: dataMode === 'local' ? '#fff' : '#42526e' }}>
              Локальная БД
            </button>
            <button onClick={() => setDataMode('remote')}
              style={{ padding: '4px 10px', fontSize: 11, border: 'none', borderLeft: '1px solid #dfe1e6', cursor: 'pointer',
                background: dataMode === 'remote' ? '#0052cc' : '#fff',
                color: dataMode === 'remote' ? '#fff' : '#42526e' }}>
              Zephyr (online)
            </button>
          </div>
        </div>
      </div>

      <div style={styles.body}>
        {/* Left sidebar: project selector + folder tree */}
        <div style={{ ...styles.sidebar, width: sidebarW }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #ebecf0', marginBottom: 8 }}>
            <select value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setTestRuns([]); }}
              style={{ width: '100%', padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }}>
              {projects.map(p => <option key={p.key} value={p.key}>{p.key} — {p.name}</option>)}
            </select>
          </div>

          {/* Show folder tree based on active tab */}
          {activeTab === 'cases' && folders.length > 0 && (
            <>
              {/* Root: "Все тест кейсы(6021)" */}
              <div style={styles.folderItem(!filterFolder, 0)} onClick={() => setFilterFolder('')}>
                <span style={{ width: 16 }} />
                <span>Все тест кейсы({testCases.length})</span>
              </div>
              {folders.map(f => (
                <FolderTreeItem key={f.id} node={f} depth={0}
                  activePath={filterFolder}
                  onSelect={path => setFilterFolder(filterFolder === path ? '' : path)}
                  onSyncFolder={(folderId) => syncFolder(folderId)} />
              ))}
            </>
          )}
          {activeTab === 'cases' && folders.length === 0 && !loading && (
            <div style={{ padding: '16px', fontSize: 12, color: '#97a0af' }}>
              {selectedProject ? 'Загрузите TC для появления папок' : 'Выберите проект'}
            </div>
          )}

          {activeTab === 'cycles' && (
            <>
              {/* Root: "Все тестовые прогоны(1581)" */}
              <div style={styles.folderItem(!filterFolder, 0)} onClick={() => setFilterFolder('')}>
                <span style={{ width: 16 }} />
                <span>Все тестовые прогоны({testRuns.length})</span>
              </div>
              {cycleFolders.length > 0 && cycleFolders.map(f => (
                <FolderTreeItem key={f.id} node={f} depth={0}
                  activePath={filterFolder}
                  onSelect={path => setFilterFolder(filterFolder === path ? '' : path)}
                  onSyncFolder={(folderId) => syncFolder(folderId)} />
              ))}
            </>
          )}
          {activeTab === 'cycles' && cycleFolders.length === 0 && !loading && testRuns.length === 0 && (
            <div style={{ padding: '16px', fontSize: 12, color: '#97a0af' }}>
              {selectedProject ? 'Загрузите прогоны для появления папок' : 'Выберите проект'}
            </div>
          )}

          {activeTab === 'plans' && (
            <>
              {/* Root: "Все планы тестирования" (no count in real Zephyr) */}
              <div style={styles.folderItem(!filterFolder, 0)} onClick={() => setFilterFolder('')}>
                <span style={{ width: 16 }} />
                <span>Все планы тестирования</span>
              </div>
              {planFolders.length > 0 && planFolders.map(f => (
                <FolderTreeItem key={f.id} node={f} depth={0}
                  activePath={filterFolder}
                  onSelect={path => setFilterFolder(filterFolder === path ? '' : path)}
                  onSyncFolder={(folderId) => syncFolder(folderId)} />
              ))}
            </>
          )}
          {activeTab === 'plans' && planFolders.length === 0 && !loading && (
            <div style={{ padding: '16px', fontSize: 12, color: '#97a0af' }}>
              {selectedProject ? 'Загрузите планы для появления папок' : 'Выберите проект'}
            </div>
          )}

          {/* Drag handle */}
          <div onMouseDown={onDragStart}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 10 }} />
        </div>

        {/* Main content */}
        <div style={styles.main}>
          {activeTab === 'cases' && renderTestCases()}
          {activeTab === 'cycles' && renderTestCycles()}
          {activeTab === 'plans' && renderTestPlans()}
          {activeTab === 'reports' && renderReports()}
          {activeTab === 'config' && renderConfig()}

          {/* Sync controls (collapsible) */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', color: '#5e6c84', fontSize: 13, userSelect: 'none' }}>
              Синхронизация и утилиты
            </summary>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <button style={{ ...styles.btn(true), background: '#00875a' }} onClick={syncToLocal} disabled={loading}>
                Синхронизировать в локальную БД
              </button>
              {testRuns.length > 0 && (
                <div>
                  <select value={selectedTestRun} onChange={e => setSelectedTestRun(e.target.value)}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, marginRight: 8 }}>
                    <option value="">— выберите прогон —</option>
                    {testRuns.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
                  </select>
                  <button style={styles.btn()} onClick={handleSyncTestRun} disabled={loading}>
                    Синхронизировать прогон
                  </button>
                </div>
              )}

              {syncResult && (
                <div style={{ fontSize: 13, color: '#5e6c84' }}>
                  Найдено: {syncResult.fetched} | Импортировано: {syncResult.imported} | Обновлено: {syncResult.updated}
                  {syncResult.errors?.length > 0 && (
                    <div style={{ color: '#dc3545', marginTop: 4 }}>
                      {syncResult.errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                </div>
              )}

              <div>
                <input type="file" ref={fileInput} accept=".xlsx" style={{ fontSize: 13, marginRight: 8 }} />
                <button style={styles.btn()} onClick={handleDiff}>Сравнить Excel</button>
              </div>

              <button style={styles.btn()} onClick={handleCoverage}>Coverage</button>
              {diffResults && (
                <span style={{ fontSize: 13, color: '#5e6c84' }}>
                  Различий: {diffResults.filter((d: any) => d.differences?.length > 0).length} |
                  Локально: {diffResults.filter((d: any) => d.localOnly).length} |
                  Удалённо: {diffResults.filter((d: any) => d.remoteOnly).length}
                </span>
              )}
            </div>
          </details>

          {/* Coverage */}
          {coverage && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Связи TC с задачами ({Object.keys(coverage).length} задач)
              </h3>
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>Issue</th><th style={styles.th}>TC</th></tr></thead>
                <tbody>
                  {Object.entries(coverage).slice(0, 50).map(([issue, tcs]: any) => (
                    <tr key={issue}>
                      <td style={styles.td}><span className="mono">{issue}</span></td>
                      <td style={styles.td}>{tcs.map((t: any) => t.key).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statusText && <p style={{ marginTop: 8, fontSize: 12, color: '#5e6c84', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading && <span style={styles.spinner} />}
            {statusText}
          </p>}
        </div>
      </div>
    </div>
  );

  function renderTestCases() {
    return <>
      {/* Toolbar - matches real Zephyr: Новый тест кейс, Архивировать, Клонировать, Еще, Фильтры */}
      <div style={styles.toolbar}>
        <input style={styles.searchInput} placeholder="Поиск" value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') loadTestCases(); }} />
        <button style={{ ...styles.btn(true), background: '#00875a' }} disabled>
          Новый тест кейс
        </button>
        <button style={styles.btn()} disabled>Архивировать</button>
        <button style={styles.btn()} disabled>Клонировать</button>
        <button style={styles.btn()}>Еще ▾</button>
        <button style={{
          ...styles.btn(), background: showFilterMenu ? '#ebf2ff' : '#fff',
          borderColor: showFilterMenu ? '#0052cc' : '#dfe1e6', color: showFilterMenu ? '#0052cc' : '#42526e',
        }} onClick={() => setShowFilterMenu(!showFilterMenu)}>
          Фильтры {showFilterMenu ? '▲' : '▼'}
        </button>
        <button style={styles.btn()} onClick={() => loadTestCases(0)} disabled={loading}>
          {loading ? 'Загрузка...' : 'Загрузить все'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#97a0af' }}>
          {activeCriteria.length > 0 ? `${filteredTC.length} из ${testCases.length}` : `${testCases.length}`} TC · {visibleTC.length} показано
        </span>
      </div>

      {/* Zephyr-style filter panel: add criteria one by one */}
      {showFilterMenu && (
        <div style={styles.filterPanel}>
          {activeCriteria.map(field => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5e6c84', minWidth: 100 }}>
                {FILTER_CRITERIA.find(c => c.field === field)?.label}:
              </span>
              {field === 'name' && (
                <input type="text" value={filterValues.name || ''} placeholder="Содержит..."
                  onChange={e => setFilterValues(p => ({ ...p, name: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 200 }} />
              )}
              {(field === 'status' || field === 'priority' || field === 'owner') && (
                <select value={filterValues[field] || ''} onChange={e => setFilterValues(p => ({ ...p, [field]: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }}>
                  <option value="">— все —</option>
                  {filterOptions[field]?.map((v: string) => <option key={v} value={v}>{field === 'status' ? statusDisplay(v) : v}</option>)}
                </select>
              )}
              {field === 'tag' && (
                <input type="text" value={filterValues.tag || ''} placeholder="Содержит..."
                  onChange={e => setFilterValues(p => ({ ...p, tag: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 200 }} />
              )}
              {field === 'component' && (
                <select value={filterValues.component || ''} onChange={e => setFilterValues(p => ({ ...p, component: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }}>
                  <option value="">— все —</option>
                  {filterOptions.component?.map((v: string) => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
              {field === 'createdDate' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="date" value={filterValues.createdDateFrom || ''} onChange={e => setFilterValues(p => ({ ...p, createdDateFrom: e.target.value }))}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }} />
                  <span style={{ fontSize: 12, color: '#5e6c84' }}>—</span>
                  <input type="date" value={filterValues.createdDateTo || ''} onChange={e => setFilterValues(p => ({ ...p, createdDateTo: e.target.value }))}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }} />
                </div>
              )}
              {field === 'estimatedTime' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min="0" value={filterValues.estimatedTimeFrom || ''} placeholder="От"
                    onChange={e => setFilterValues(p => ({ ...p, estimatedTimeFrom: e.target.value }))}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 80 }} />
                  <span style={{ fontSize: 12, color: '#5e6c84' }}>—</span>
                  <input type="number" min="0" value={filterValues.estimatedTimeTo || ''} placeholder="До"
                    onChange={e => setFilterValues(p => ({ ...p, estimatedTimeTo: e.target.value }))}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 80 }} />
                </div>
              )}
              {field === 'coverageIssues' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min="0" value={filterValues.coverageIssuesFrom || ''} placeholder="От"
                    onChange={e => setFilterValues(p => ({ ...p, coverageIssuesFrom: e.target.value }))}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 80 }} />
                  <span style={{ fontSize: 12, color: '#5e6c84' }}>—</span>
                  <input type="number" min="0" value={filterValues.coverageIssuesTo || ''} placeholder="До"
                    onChange={e => setFilterValues(p => ({ ...p, coverageIssuesTo: e.target.value }))}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 80 }} />
                </div>
              )}
              {field === 'coveragePages' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min="0" value={filterValues.coveragePagesFrom || ''} placeholder="От"
                    onChange={e => setFilterValues(p => ({ ...p, coveragePagesFrom: e.target.value }))}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 80 }} />
                  <span style={{ fontSize: 12, color: '#5e6c84' }}>—</span>
                  <input type="number" min="0" value={filterValues.coveragePagesTo || ''} placeholder="До"
                    onChange={e => setFilterValues(p => ({ ...p, coveragePagesTo: e.target.value }))}
                    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 80 }} />
                </div>
              )}
              <span onClick={() => {
                const next = activeCriteria.filter(f => f !== field);
                setActiveCriteria(next);
                setFilterValues(p => {
                  const r = { ...p };
                  if (field === 'createdDate') { delete r.createdDateFrom; delete r.createdDateTo; }
                  else if (field === 'estimatedTime') { delete r.estimatedTimeFrom; delete r.estimatedTimeTo; }
                  else if (field === 'coverageIssues') { delete r.coverageIssuesFrom; delete r.coverageIssuesTo; }
                  else if (field === 'coveragePages') { delete r.coveragePagesFrom; delete r.coveragePagesTo; }
                  else { delete r[field]; }
                  return r;
                });
              }} style={{ cursor: 'pointer', color: '#dc3545', fontSize: 14, padding: '0 4px' }} title="Удалить критерий">×</span>
            </div>
          ))}
          {FILTER_CRITERIA.filter(c => !activeCriteria.includes(c.field)).length > 0 && (
            <div style={{ position: 'relative' }}>
              <button style={styles.btn()} onClick={() => setShowCriteriaMenu(!showCriteriaMenu)}>
                + Добавить критерий
              </button>
              {showCriteriaMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 510, background: '#fff', border: '1px solid #dfe1e6', borderRadius: 3, boxShadow: '0 4px 8px rgba(0,0,0,.15)', minWidth: 250, maxHeight: 300, overflowY: 'auto' }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #dfe1e6', background: '#f4f5f7' }}>
                    <input autoFocus style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #dfe1e6', borderRadius: 3, fontSize: 13, outline: 'none' }}
                      placeholder="Поиск..." value={criteriaSearch} onChange={e => setCriteriaSearch(e.target.value)} />
                  </div>
                  <div style={{ padding: '4px 0', fontSize: 11, color: '#97a0af', fontWeight: 600, textTransform: 'uppercase', padding: '8px 12px 4px' }}>
                    Static Fields
                  </div>
                  {FILTER_CRITERIA.filter(c => !activeCriteria.includes(c.field) && c.label.toLowerCase().includes(criteriaSearch.toLowerCase())).map(c => (
                    <div key={c.field} role="option" onClick={() => { setActiveCriteria(p => [...p, c.field]); setCriteriaSearch(''); setShowCriteriaMenu(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#172b4d' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#ebf2ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {c.label}
                    </div>
                  ))}
                  {FILTER_CRITERIA.filter(c => !activeCriteria.includes(c.field) && c.label.toLowerCase().includes(criteriaSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '6px 12px', fontSize: 12, color: '#97a0af' }}>Ничего не найдено</div>
                  )}
                </div>
              )}
            </div>
          )}
          <button style={{ ...styles.btn(), fontSize: 12 }} disabled>Cохраненный фильтр</button>
        </div>
      )}

      {/* Table */}
      {visibleTC.length > 0 && (
        <>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 30 }}>
                  <input type="checkbox" style={styles.checkbox}
                    checked={selected.size === visibleTC.length && visibleTC.length > 0}
                    onChange={selectAll} />
                </th>
                <th style={{ ...styles.th, width: 30, cursor: 'pointer' }} title="Приоритет" onClick={() => toggleSort('priority')}>
                  П {sortField === 'priority' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => toggleSort('key')}>
                  Ключ {sortField === 'key' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...styles.th, width: 40, cursor: 'pointer' }} title="Версия" onClick={() => toggleSort('version')}>
                  B {sortField === 'version' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                  Наименование {sortField === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...styles.th, width: 120, cursor: 'pointer' }} onClick={() => toggleSort('status')}>
                  Статус {sortField === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...styles.th, width: 30 }} title="Последний прогон">R</th>
                <th style={{ ...styles.th, width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {visibleTC.map(tc => (
                <tr key={tc.key} style={{ background: selected.has(tc.key) ? '#ebf2ff' : 'transparent' }}>
                  <td style={styles.td}>
                    <input type="checkbox" style={styles.checkbox}
                      checked={selected.has(tc.key)} onChange={() => toggleSelect(tc.key)} />
                  </td>
                  <td style={styles.td}><PriorityDot priority={tc.priority} /></td>
                  <td style={styles.td}>
                    {tc.key?.includes('-') ? (
                      <a href={`https://jira.ifellow.ru/secure/Tests.jspa#/testCase/${tc.key}?projectId=${tc.projectId || ''}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#0052cc', textDecoration: 'none', fontWeight: 500 }}>
                        {tc.key}
                      </a>
                    ) : <span style={{ color: '#5e6c84' }}>{tc.key}</span>}
                  </td>
                  <td style={{ ...styles.td, color: '#5e6c84', fontSize: 12 }}>{tc.version || '—'}</td>
                  <td style={{ ...styles.td, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {tc.key?.includes('-')
                      ? <a href={`https://jira.ifellow.ru/secure/Tests.jspa#/testCase/${tc.key}?projectId=${tc.projectId || ''}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: '#172b4d', textDecoration: 'none' }}>{tc.name}</a>
                      : tc.name}
                  </td>
                  <td style={styles.td}><StatusLozenge status={tc.status} /></td>
                  <td style={{ ...styles.td, fontSize: 11, color: '#97a0af', textAlign: 'center' }}>—</td>
                  <td style={styles.td}>
                    <span onClick={() => syncTestCase(tc.key)}
                      style={{ cursor: 'pointer', color: '#0052cc', fontSize: 12, padding: '2px 6px', borderRadius: 3, background: '#ebf2ff' }}
                      title="Синхронизировать тест-кейс">
                      🔄
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination - matches real Zephyr: "1 - 100из 6021" */}
          {sortedTC.length > PAGE_SIZE && (
            <div style={styles.pagination}>
              <span>{PAGE_SIZE * (page - 1) + 1} - {Math.min(PAGE_SIZE * page, sortedTC.length)}из {sortedTC.length}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button style={styles.pageBtn()} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pn: number;
                  if (totalPages <= 5) pn = i + 1;
                  else if (page <= 3) pn = i + 1;
                  else if (page >= totalPages - 2) pn = totalPages - 4 + i;
                  else pn = page - 2 + i;
                  return (
                    <button key={pn} style={styles.pageBtn(pn === page)}
                      onClick={() => setPage(pn)}>{pn}</button>
                  );
                })}
                {totalPages > 5 && page < totalPages - 2 && (
                  <span style={{ padding: '4px 6px', fontSize: 12, color: '#97a0af' }}>…</span>
                )}
                {totalPages > 5 && (
                  <button style={styles.pageBtn(totalPages === page)}
                    onClick={() => setPage(totalPages)}>{totalPages}</button>
                )}
                <button style={styles.pageBtn()} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && testCases.length === 0 && folders.length > 0 && (
        <p style={{ color: '#97a0af', marginTop: 16, textAlign: 'center' }}>
          Нажми «Загрузить TC» для просмотра тест-кейсов
        </p>
      )}

      {!loading && testCases.length > 0 && sortedTC.length === 0 && activeCriteria.length > 0 && (
        <p style={{ color: '#97a0af', marginTop: 16, textAlign: 'center' }}>
          Ничего не найдено по заданным критериям. Попробуйте изменить фильтры.
        </p>
      )}
    </>;
  }

  function renderTestCycles() {
    const filtered = testRuns.filter(r => {
      if (cycSearch && !r.key?.includes(cycSearch) && !r.name?.toLowerCase().includes(cycSearch.toLowerCase())) return false;
      
      // Folder filter: find folder by path, match by folderId
      if (filterFolder) {
        const folderNode = findFolderByPath(cycleFolders, filterFolder);
        if (folderNode) {
          if (r.folderId && String(r.folderId) !== String(folderNode.id)) return false;
          if (!r.folderId) return false;
        }
      }
      
      // Apply active filter criteria
      for (const field of cycActiveCriteria) {
        if (field === 'cycVersion' && cycFilterValues.cycVersion) {
          if (!r.version?.toLowerCase().includes(cycFilterValues.cycVersion.toLowerCase())) return false;
        }
        if (field === 'cycIteration' && cycFilterValues.cycIteration) {
          if (!r.iteration?.toLowerCase().includes(cycFilterValues.cycIteration.toLowerCase())) return false;
        }
        if (field === 'cycStatus' && cycFilterValues.cycStatus) {
          if (r.status !== cycFilterValues.cycStatus) return false;
        }
        if (field === 'cycAssignedTo' && cycFilterValues.cycAssignedTo) {
          if (!r.assignedTo?.toLowerCase().includes(cycFilterValues.cycAssignedTo.toLowerCase())) return false;
        }
        if (field === 'cycTestPlan' && cycFilterValues.cycTestPlan) {
          if (!r.testPlan?.toLowerCase().includes(cycFilterValues.cycTestPlan.toLowerCase())) return false;
        }
      }
      
      return true;
    });

    const CYC_PAGE_SIZE = 40;
    const cycTotalPages = Math.ceil(filtered.length / CYC_PAGE_SIZE) || 1;
    const visibleRuns = filtered.slice((cycPage - 1) * CYC_PAGE_SIZE, cycPage * CYC_PAGE_SIZE);

    async function handleCycleClick(runKey: string) {
      if (selectedCycleKey === runKey) {
        setSelectedCycleKey(null);
        setCycleTestCases([]);
        return;
      }
      setSelectedCycleKey(runKey);
      setCycleLoading(true);
      setCycleTestCases([]);
      const res = await fetchZephyrTestRunTestCases(api, runKey);
      setCycleTestCases(res.data || []);
      setCycleLoading(false);
    }

    const execColor = (st: string) => {
      const s = (st || '').toUpperCase();
      if (s === 'PASS' || s === 'ПРОЙДЕН') return '#2e7d32';
      if (s === 'FAIL' || s === 'ПРОВАЛЕН') return '#c62828';
      if (s === 'SKIPPED' || s === 'ПРОПУЩЕН') return '#f57f17';
      if (s === 'BLOCKED' || s === 'ЗАБЛОКИРОВАН') return '#6a1b9a';
      if (s === 'IN_PROGRESS' || s === 'В РАБОТЕ') return '#1976d2';
      return '#97a0af';
    };
    const execLabel = (st: string) => {
      const s = (st || '').toUpperCase();
      if (s === 'PASS' || s === 'ПРОЙДЕН') return 'Пройден';
      if (s === 'FAIL' || s === 'ПРОВАЛЕН') return 'Провален';
      if (s === 'SKIPPED' || s === 'ПРОПУЩЕН') return 'Пропущен';
      if (s === 'BLOCKED' || s === 'ЗАБЛОКИРОВАН') return 'Заблокирован';
      if (s === 'IN_PROGRESS' || s === 'В РАБОТЕ') return 'В работе';
      return st || '—';
    };

    return <>
      {/* Toolbar - matches real Zephyr: New Test Cycle, Редактировать, Прогон, Клонировать, Удалить, Группировать, Фильтры */}
      <div style={styles.toolbar}>
        <button style={{ ...styles.btn(true), background: '#00875a' }} disabled>
          New Test Cycle
        </button>
        <button style={styles.btn()} disabled>Редактировать</button>
        <button style={styles.btn()} disabled>Прогон</button>
        <button style={styles.btn()} disabled>Клонировать</button>
        <button style={styles.btn()} disabled>Удалить</button>
        {filterFolder && (
          <span style={{ fontSize: 12, color: '#0052cc', background: '#ebf2ff', padding: '2px 8px', borderRadius: 3, cursor: 'pointer' }}
            onClick={() => setFilterFolder('')} title="Сбросить фильтр папки">
            📁 {filterFolder.split(' / ').pop()} ×
          </span>
        )}
        <div style={{ flex: 1 }} />
        <input style={{ ...styles.searchInput, width: 180 }} placeholder="Поиск..." value={cycSearch}
          onChange={e => setCycSearch(e.target.value)} />
        <button style={styles.btn()}>Группировать ▾</button>
        <button style={{
          ...styles.btn(), background: cycShowFilterMenu ? '#ebf2ff' : '#fff',
          borderColor: cycShowFilterMenu ? '#0052cc' : '#dfe1e6', color: cycShowFilterMenu ? '#0052cc' : '#42526e',
        }} onClick={() => setCycShowFilterMenu(!cycShowFilterMenu)}>
          Фильтры {cycShowFilterMenu ? '▲' : '▼'}
        </button>
        <span style={{ marginLeft: 8, fontSize: 12, color: '#97a0af' }}>
          {filtered.length} прогонов
        </span>
      </div>

      {/* Zephyr-style filter panel for cycles */}
      {cycShowFilterMenu && (
        <div style={styles.filterPanel}>
          {cycActiveCriteria.map(field => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5e6c84', minWidth: 100 }}>
                {CYC_CRITERIA.find(c => c.field === field)?.label}:
              </span>
              {field === 'cycVersion' && (
                <input type="text" value={cycFilterValues.cycVersion || ''} placeholder="Содержит..."
                  onChange={e => setCycFilterValues(p => ({ ...p, cycVersion: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 200 }} />
              )}
              {field === 'cycIteration' && (
                <input type="text" value={cycFilterValues.cycIteration || ''} placeholder="Содержит..."
                  onChange={e => setCycFilterValues(p => ({ ...p, cycIteration: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 200 }} />
              )}
              {field === 'cycStatus' && (
                <select value={cycFilterValues.cycStatus || ''} onChange={e => setCycFilterValues(p => ({ ...p, cycStatus: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }}>
                  <option value="">— все —</option>
                  {cycStatuses.map(s => <option key={s} value={s}>{statusDisplay(s)}</option>)}
                </select>
              )}
              {field === 'cycAssignedTo' && (
                <input type="text" value={cycFilterValues.cycAssignedTo || ''} placeholder="Содержит..."
                  onChange={e => setCycFilterValues(p => ({ ...p, cycAssignedTo: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 200 }} />
              )}
              {field === 'cycTestPlan' && (
                <input type="text" value={cycFilterValues.cycTestPlan || ''} placeholder="Содержит..."
                  onChange={e => setCycFilterValues(p => ({ ...p, cycTestPlan: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 200 }} />
              )}
              <span onClick={() => {
                const next = cycActiveCriteria.filter(f => f !== field);
                setCycActiveCriteria(next);
                setCycFilterValues(p => {
                  const r = { ...p };
                  delete r[field];
                  return r;
                });
              }} style={{ cursor: 'pointer', color: '#dc3545', fontSize: 14, padding: '0 4px' }} title="Удалить критерий">×</span>
            </div>
          ))}
          {CYC_CRITERIA.filter(c => !cycActiveCriteria.includes(c.field)).length > 0 && (
            <div style={{ position: 'relative' }}>
              <button style={styles.btn()} onClick={() => setCycShowCriteriaMenu(!cycShowCriteriaMenu)}>
                + Добавить критерий
              </button>
              {cycShowCriteriaMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, background: '#fff', border: '1px solid #dfe1e6', borderRadius: 3, boxShadow: '0 4px 8px rgba(0,0,0,.1)', minWidth: 200 }}>
                  <input autoFocus style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: 'none', borderBottom: '1px solid #dfe1e6', fontSize: 13, outline: 'none' }}
                    placeholder="Поиск критериев..." value={cycCriteriaSearch} onChange={e => setCycCriteriaSearch(e.target.value)} />
                  {CYC_CRITERIA.filter(c => !cycActiveCriteria.includes(c.field) && c.label.toLowerCase().includes(cycCriteriaSearch.toLowerCase())).map(c => (
                    <div key={c.field} onClick={() => { setCycActiveCriteria(p => [...p, c.field]); setCycCriteriaSearch(''); setCycShowCriteriaMenu(false); }}
                      style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#172b4d' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#ebf2ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 20 }}>
                <input type="checkbox" style={styles.checkbox}
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={() => {
                    if (selected.size === filtered.length) { setSelected(new Set()); }
                    else { setSelected(new Set(filtered.map(r => r.key))); }
                  }} />
              </th>
              <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => toggleSort('key')}>
                Key {sortField === 'key' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                Наименование {sortField === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
              </th>
              <th style={{ ...styles.th, width: 200 }}>Ход выполнения</th>
              <th style={{ ...styles.th, width: 100, cursor: 'pointer' }} onClick={() => toggleSort('status')}>
                Статус {sortField === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ ...styles.th, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibleRuns.map(run => {
              const pct = run.testResultStatuses
                ? Math.round(((run.testResultStatuses.pass + run.testResultStatuses.fail + run.testResultStatuses.skipped + run.testResultStatuses.blocked) / Math.max(run.testResultStatuses.pass + run.testResultStatuses.fail + run.testResultStatuses.skipped + run.testResultStatuses.blocked + run.testResultStatuses.unexecuted, 1)) * 100)
                : run.totalTestCases > 0 ? Math.round((run.totalExecuted / run.totalTestCases) * 100) : 0;
              const expanded = selectedCycleKey === run.key;
              return (
                <React.Fragment key={run.key}>
                  <tr onClick={() => handleCycleClick(run.key)}
                    style={{ cursor: 'pointer', background: expanded ? '#f4f5f7' : selected.has(run.key) ? '#ebf2ff' : 'transparent' }}>
                    <td style={styles.td} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" style={styles.checkbox}
                        checked={selected.has(run.key)}
                        onChange={() => toggleSelect(run.key)} />
                    </td>
                    <td style={styles.td}>
                      <a href={`https://jira.ifellow.ru/secure/Tests.jspa#/testPlayer/${run.key}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: '#0052cc', textDecoration: 'none', fontWeight: 500 }}>
                        {run.key}
                      </a>
                    </td>
                    <td style={{ ...styles.td, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={`https://jira.ifellow.ru/secure/Tests.jspa#/testPlayer/${run.key}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: '#172b4d', textDecoration: 'none' }}>
                        {run.name}
                      </a>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="100" height="6" style={{ flexShrink: 0 }}>
                          <rect rx="3" x="0" y="0" width="100" height="6" fill="#ebecf0" />
                          <rect rx="3" x="0" y="0"
                            width={Math.min(pct, 100)}
                            height="6"
                            fill={pct >= 100 ? '#3abb4b' : pct >= 50 ? '#ffa900' : '#e34938'} />
                        </svg>
                        <span style={{ fontSize: 14, color: '#172b4d', minWidth: 36 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <StatusLozenge status={run.status === 'IN_PROGRESS' ? 'В РАБОТЕ' : run.status} />
                    </td>
                    <td style={styles.td}>
                      <span onClick={e => { e.stopPropagation(); syncTestRun(run.key); }}
                        style={{ cursor: 'pointer', color: '#0052cc', fontSize: 12, padding: '2px 6px', borderRadius: 3, background: '#ebf2ff' }}
                        title="Синхронизировать прогон">
                        🔄
                      </span>
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${run.key}-detail`}>
                      <td colSpan={6} style={{ padding: 0, background: '#fafbfc' }}>
                        {cycleLoading ? (
                          <div style={{ padding: 16, textAlign: 'center', color: '#97a0af' }}>Загрузка...</div>
                        ) : cycleTestCases.length === 0 ? (
                          <div style={{ padding: 16, textAlign: 'center', color: '#97a0af' }}>Нет тест-кейсов в прогоне</div>
                        ) : (
                          <div style={{ padding: '8px 16px 16px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#42526e' }}>
                              Тест-кейсы ({cycleTestCases.length})
                            </div>
                            <table style={{ ...styles.table, border: '1px solid #dfe1e6' }}>
                              <thead>
                                <tr>
                                  <th style={{ ...styles.th, width: 30 }}>#</th>
                                  <th style={{ ...styles.th }}>Ключ</th>
                                  <th style={{ ...styles.th }}>Наименование</th>
                                  <th style={{ ...styles.th }}>Приоритет</th>
                                  <th style={{ ...styles.th, width: 100 }}>Статус</th>
                                  <th style={{ ...styles.th, width: 110 }}>Результат</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cycleTestCases.map((tc: any, i: number) => (
                                  <tr key={tc.key}>
                                    <td style={{ ...styles.td, textAlign: 'center', color: '#97a0af', fontSize: 12 }}>{i + 1}</td>
                                    <td style={styles.td}>
                                      <a href={`https://jira.ifellow.ru/secure/Tests.jspa#/testCase/${tc.key}?projectId=${tc.projectId || ''}`}
                                        target="_blank" rel="noopener noreferrer"
                                        style={{ color: '#0052cc', textDecoration: 'none', fontWeight: 500 }}>
                                        {tc.key}
                                      </a>
                                    </td>
                                    <td style={{ ...styles.td, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {tc.name}
                                    </td>
                                    <td style={styles.td}><PriorityDot priority={tc.priority} /></td>
                                    <td style={styles.td}><StatusLozenge status={tc.status} /></td>
                                    <td style={styles.td}>
                                      <span style={{
                                        display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                                        fontSize: 11, fontWeight: 600, color: '#fff',
                                        background: execColor(tc.executionStatus),
                                      }}>
                                        {execLabel(tc.executionStatus)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Pagination - matches real Zephyr: "1 - 40из 1581" */}
        {filtered.length > CYC_PAGE_SIZE && (
          <div style={styles.pagination}>
            <span>{CYC_PAGE_SIZE * (cycPage - 1) + 1} - {Math.min(CYC_PAGE_SIZE * cycPage, filtered.length)}из {filtered.length}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button style={styles.pageBtn()} onClick={() => setCycPage(p => Math.max(1, p - 1))} disabled={cycPage === 1}>‹</button>
              {Array.from({ length: Math.min(cycTotalPages, 5) }, (_, i) => {
                let pn: number;
                if (cycTotalPages <= 5) pn = i + 1;
                else if (cycPage <= 3) pn = i + 1;
                else if (cycPage >= cycTotalPages - 2) pn = cycTotalPages - 4 + i;
                else pn = cycPage - 2 + i;
                return (
                  <button key={pn} style={styles.pageBtn(pn === cycPage)}
                    onClick={() => setCycPage(pn)}>{pn}</button>
                );
              })}
              {cycTotalPages > 5 && cycPage < cycTotalPages - 2 && (
                <span style={{ padding: '4px 6px', fontSize: 12, color: '#97a0af' }}>…</span>
              )}
              {cycTotalPages > 5 && (
                <button style={styles.pageBtn(cycTotalPages === cycPage)}
                  onClick={() => setCycPage(cycTotalPages)}>{cycTotalPages}</button>
              )}
              <button style={styles.pageBtn()} onClick={() => setCycPage(p => Math.min(cycTotalPages, p + 1))} disabled={cycPage === cycTotalPages}>›</button>
            </div>
          </div>
        )}
        </>
      )}

      {!loading && filtered.length === 0 && (
        <p style={{ color: '#97a0af', marginTop: 16, textAlign: 'center' }}>
          {testRuns.length === 0 ? 'Нажми «Загрузить прогоны»' : 'Ничего не найдено'}
        </p>
      )}
    </>;
  }

  function renderTestPlans() {
    const filtered = testPlans.filter(p => {
      if (plnSearch && !p.key?.includes(plnSearch) && !p.name?.toLowerCase().includes(plnSearch.toLowerCase())) return false;
      
      // Apply active filter criteria
      for (const field of plnActiveCriteria) {
        if (field === 'plnStatus' && plnFilterValues.plnStatus) {
          if (p.status !== plnFilterValues.plnStatus) return false;
        }
        if (field === 'plnTag' && plnFilterValues.plnTag) {
          const search = plnFilterValues.plnTag.toLowerCase();
          const tags = p.tags || [];
          if (Array.isArray(tags)) {
            if (!tags.some((t: string) => t.toLowerCase().includes(search))) return false;
          } else if (typeof tags === 'string') {
            if (!tags.toLowerCase().includes(search)) return false;
          }
        }
      }
      
      return true;
    });
    return <>
      {/* Toolbar - matches real Zephyr: Новый план тестирования, Удалить, Клонировать, Фильтры */}
      <div style={styles.toolbar}>
        <button style={{ ...styles.btn(true), background: '#00875a' }} disabled>
          Новый план тестирования
        </button>
        <button style={styles.btn()} disabled>Удалить</button>
        <button style={styles.btn()} disabled>Клонировать</button>
        <button style={{
          ...styles.btn(), background: plnShowFilterMenu ? '#ebf2ff' : '#fff',
          borderColor: plnShowFilterMenu ? '#0052cc' : '#dfe1e6', color: plnShowFilterMenu ? '#0052cc' : '#42526e',
        }} onClick={() => setPlnShowFilterMenu(!plnShowFilterMenu)}>
          Фильтры {plnShowFilterMenu ? '▲' : '▼'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#97a0af' }}>
          {testPlans.length} планов · {filtered.length} показано
        </span>
      </div>

      {/* Zephyr-style filter panel for plans */}
      {plnShowFilterMenu && (
        <div style={styles.filterPanel}>
          {plnActiveCriteria.map(field => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5e6c84', minWidth: 100 }}>
                {PLN_CRITERIA.find(c => c.field === field)?.label}:
              </span>
              {field === 'plnStatus' && (
                <select value={plnFilterValues.plnStatus || ''} onChange={e => setPlnFilterValues(p => ({ ...p, plnStatus: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }}>
                  <option value="">— все —</option>
                  {plnStatuses.map(s => <option key={s} value={s}>{statusDisplay(s)}</option>)}
                </select>
              )}
              {field === 'plnTag' && (
                <input type="text" value={plnFilterValues.plnTag || ''} placeholder="Содержит..."
                  onChange={e => setPlnFilterValues(p => ({ ...p, plnTag: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3, width: 200 }} />
              )}
              <span onClick={() => {
                const next = plnActiveCriteria.filter(f => f !== field);
                setPlnActiveCriteria(next);
                setPlnFilterValues(p => { const r = { ...p }; delete r[field]; return r; });
              }} style={{ cursor: 'pointer', color: '#dc3545', fontSize: 14, padding: '0 4px' }} title="Удалить критерий">×</span>
            </div>
          ))}
          {PLN_CRITERIA.filter(c => !plnActiveCriteria.includes(c.field)).length > 0 && (
            <div style={{ position: 'relative' }}>
              <button style={styles.btn()} onClick={() => setPlnShowCriteriaMenu(!plnShowCriteriaMenu)}>
                + Добавить критерий
              </button>
              {plnShowCriteriaMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, background: '#fff', border: '1px solid #dfe1e6', borderRadius: 3, boxShadow: '0 4px 8px rgba(0,0,0,.1)', minWidth: 200 }}>
                  <input autoFocus style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: 'none', borderBottom: '1px solid #dfe1e6', fontSize: 13, outline: 'none' }}
                    placeholder="Поиск критериев..." value={plnCriteriaSearch} onChange={e => setPlnCriteriaSearch(e.target.value)} />
                  {PLN_CRITERIA.filter(c => !plnActiveCriteria.includes(c.field) && c.label.toLowerCase().includes(plnCriteriaSearch.toLowerCase())).map(c => (
                    <div key={c.field} onClick={() => { setPlnActiveCriteria(p => [...p, c.field]); setPlnCriteriaSearch(''); setPlnShowCriteriaMenu(false); }}
                      style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#172b4d' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#ebf2ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ключ</th>
              <th style={styles.th}>Наименование</th>
              <th style={{ ...styles.th, width: 120 }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.key}>
                <td style={styles.td}><span style={{ color: '#0052cc', fontWeight: 500 }}>{p.key}</span></td>
                <td style={styles.td}>{p.name}</td>
                <td style={styles.td}><StatusLozenge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && testPlans.length === 0 && (
        <p style={{ color: '#97a0af', marginTop: 16, textAlign: 'center' }}>
          Нажми «Загрузить планы»
        </p>
      )}
    </>;
  }

  function renderReports() {
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const tc of testCases) {
      const sd = statusDisplay(tc.status || '');
      byStatus[sd] = (byStatus[sd] || 0) + 1;
      byPriority[tc.priority || '—'] = (byPriority[tc.priority || '—'] || 0) + 1;
    }
    const reportStyle: React.CSSProperties = {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8,
    };
    const cardStyle: React.CSSProperties = {
      background: '#fff', borderRadius: 3, padding: 16,
      boxShadow: '0 1px 1px rgba(9,30,66,.25)',
    };
    return (
      <div style={reportStyle}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Общая статистика</h3>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#0052cc' }}>{testCases.length}</p>
          <p style={{ fontSize: 13, color: '#5e6c84' }}>тест-кейсов загружено</p>
          {coverage && <p style={{ fontSize: 13, color: '#5e6c84', marginTop: 8 }}>
            Связано с задачами: {Object.keys(coverage).length}
          </p>}
        </div>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>По статусу</h3>
          {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span><StatusLozenge status={s} /></span>
              <span style={{ fontWeight: 600 }}>{c}</span>
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>По приоритету</h3>
          {Object.entries(byPriority).sort((a, b) => b[1] - a[1]).map(([p, c]) => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span><PriorityDot priority={p} /> {p}</span>
              <span style={{ fontWeight: 600 }}>{c}</span>
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Действия</h3>
          <button style={styles.btn()} onClick={handleCoverage}>Загрузить coverage</button>
          {diffResults && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#5e6c84' }}>
              Различий: {diffResults.filter((d: any) => d.differences?.length > 0).length}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderConfig() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8, maxWidth: 600 }}>
        <div style={{ background: '#fff', borderRadius: 3, padding: 16, boxShadow: '0 1px 1px rgba(9,30,66,.25)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Проект</h3>
          <label style={{ fontSize: 13, color: '#5e6c84', display: 'flex', alignItems: 'center', gap: 8 }}>
            Текущий проект:
            <select value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setTestRuns([]); }}
              style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }}>
              {projects.map(p => <option key={p.key} value={p.key}>{p.key} — {p.name}</option>)}
            </select>
          </label>
        </div>
        <div style={{ background: '#fff', borderRadius: 3, padding: 16, boxShadow: '0 1px 1px rgba(9,30,66,.25)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Подключение к Zephyr</h3>
          <button style={styles.btn()} onClick={async () => {
            setStatus('Проверка подключения...');
            try {
              const res = await fetch(`${api}/zephyr/test-connection`, { method: 'POST' });
              const data = await res.json();
              setStatus(data.ok ? `✅ ${data.message}` : `❌ ${data.message}`);
            } catch { setStatus('❌ Ошибка подключения'); }
          }}>Проверить подключение</button>
        </div>
        <div style={{ background: '#fff', borderRadius: 3, padding: 16, boxShadow: '0 1px 1px rgba(9,30,66,.25)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Credentials</h3>
          <p style={{ fontSize: 13, color: '#5e6c84' }}>
            Настройка профилей Jira/Zephyr (токены, логины, пароли) — в разделе <strong>Настройки</strong> → <strong>Подключения к Jira</strong>.
          </p>
        </div>
      </div>
    );
  }

  function addFolderCounts(nodes: FolderNode[], tcs: any[]): FolderNode[] {
    return nodes.map(node => {
      const count = tcs.filter(tc => {
        if (tc.folderId && node.id) return String(tc.folderId) === String(node.id);
        return tc.folder?.startsWith(node.path || node.name);
      }).length;
      let childCount = 0;
      const children = node.children?.length > 0 ? addFolderCounts(node.children, tcs) : [];
      for (const c of children) childCount += c.count || 0;
      return { ...node, count: count || childCount || undefined, children };
    });
  }

  function findFolderById(nodes: FolderNode[], id: string): FolderNode | null {
    for (const node of nodes) {
      if (String(node.id) === id) return node;
      if (node.children?.length > 0) {
        const found = findFolderById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function findFolderByPath(nodes: FolderNode[], path: string): FolderNode | null {
    for (const node of nodes) {
      if ((node.path || node.name) === path) return node;
      if (node.children?.length > 0) {
        const found = findFolderByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  function renderFolderOptions(node: FolderNode, depth: number): JSX.Element[] {
    const result: JSX.Element[] = [];
    const val = node.path || node.name;
    result.push(
      <option key={node.id} value={val} style={{ paddingLeft: depth * 12 }}>
        {'—'.repeat(depth)} {node.name}
      </option>
    );
    if (node.children.length > 0) {
      result.push(...node.children.flatMap(c => renderFolderOptions(c, depth + 1)));
    }
    return result;
  }
}
