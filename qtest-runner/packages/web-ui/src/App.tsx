import { useState, useEffect } from 'react';
import { TestCaseList } from './pages/TestCaseList';
import { TestCaseDetail } from './pages/TestCaseDetail';
import { ImportPage } from './pages/ImportPage';
import { ExecutionPage } from './pages/ExecutionPage';
import { RecorderPage } from './pages/RecorderPage';
import { SyncPage } from './pages/SyncPage';
import { ReportsPage } from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import { createExecution, fetchExecutions, fetchHealth } from './api';

const API = '/api';

const THEMES = [
  { id: 'light', label: '☀️ Светлая' },
  { id: 'dark', label: '🌙 Тёмная' },
  { id: 'opencode', label: '⚫ OpenCode' },
  { id: 'green', label: '💚 Хакерская' },
  { id: 'purple', label: '💜 Фиолетовая' },
  { id: 'ocean', label: '🌊 Океан' },
  { id: 'sunset', label: '🌅 Закат' },
];

export function App() {
  const [page, setPage] = useState<'list' | 'detail' | 'import' | 'execution' | 'recorder' | 'sync' | 'reports' | 'settings' | 'docs'>('list');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const check = async () => {
      const h = await fetchHealth(API);
      setHealthOk(h?.status === 'ok');
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleRunExecution(testCaseKey: string) {
    const exec = await createExecution(API, testCaseKey);
    if (exec && exec.id) {
      setExecutionId(exec.id);
      setPage('execution');
    } else {
      alert('Ошибка создания выполнения. Убедитесь, что все сервисы запущены (start.bat).');
    }
  }

  return (
    <div className="app">
      <nav>
        <a
          href="#"
          className={page === 'list' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setPage('list'); }}
        >
          QTest Runner
        </a>
        <a
          href="#"
          className={page === 'import' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setPage('import'); }}
        >
          Импорт
        </a>
        <a
          href="#"
          className={page === 'recorder' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setPage('recorder'); }}
        >
          Recorder
        </a>
        <a
          href="#"
          className={page === 'sync' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setPage('sync'); }}
        >
          Sync
        </a>
        <a
          href="#"
          className={page === 'execution' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setPage('execution'); }}
        >
          Выполнения
        </a>
        <a
          href="#"
          className={page === 'reports' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setPage('reports'); }}
        >
          Отчёты
        </a>
        <a
          href="#"
          className={page === 'settings' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setPage('settings'); }}
        >
          Настройки
        </a>
        <a
          href="#"
          className={page === 'docs' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setPage('docs'); }}
        >
          Docs
        </a>
        {selectedKey && <span className="nav-breadcrumb">/ {selectedKey}</span>}
        <span className="nav-spacer" />
        <span
          className={`health-dot ${healthOk === null ? 'loading' : healthOk ? 'ok' : 'fail'}`}
          title={healthOk === null ? 'Проверка...' : healthOk ? 'Сервисы работают' : 'Сервисы не отвечают'}
        />
        <select
          className="theme-toggle"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          {THEMES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </nav>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {page === 'list' && (
          <TestCaseList
            api={API}
            onSelect={(key) => { setSelectedKey(key); setPage('detail'); }}
          />
        )}
        {page === 'detail' && selectedKey && (
          <TestCaseDetail
            api={API}
            testCaseKey={selectedKey}
            onBack={() => { setSelectedKey(null); setPage('list'); }}
            onRun={() => handleRunExecution(selectedKey)}
          />
        )}
        {page === 'import' && <ImportPage api={API} />}
        {page === 'recorder' && <RecorderPage api={API} onNavigate={(p, param) => { if (p === 'execution' && param) handleRunExecution(param); }} />}
        {page === 'sync' && <SyncPage api={API} />}
        {page === 'reports' && <ReportsPage api={API} />}
        {page === 'settings' && <SettingsPage api={API} />}
        {page === 'docs' && (
          <iframe
            src={import.meta.env.VITE_DOCS_URL || 'http://localhost:5174'}
            style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
            title="Documentation"
          />
        )}
        {page === 'execution' && (
          <ExecutionPage
            api={API}
            executionId={executionId}
            onBack={() => { setExecutionId(null); setPage('list'); }}
          />
        )}
      </div>
    </div>
  );
}
