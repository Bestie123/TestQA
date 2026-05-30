import { useState } from 'react';
import { TestCaseList } from './pages/TestCaseList';
import { TestCaseDetail } from './pages/TestCaseDetail';
import { ImportPage } from './pages/ImportPage';
import { ExecutionPage } from './pages/ExecutionPage';
import { RecorderPage } from './pages/RecorderPage';
import { SyncPage } from './pages/SyncPage';
import { ReportsPage } from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import { createExecution } from './api';

const API = '/api';

export function App() {
  const [page, setPage] = useState<'list' | 'detail' | 'import' | 'execution' | 'recorder' | 'sync' | 'reports' | 'settings' | 'docs'>('list');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);

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
      </nav>

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
          src="http://localhost:5173"
          style={{ width: '100%', height: 'calc(100vh - 50px)', border: 'none' }}
          title="Documentation"
        />
      )}
      {page === 'execution' && executionId && (
        <ExecutionPage
          api={API}
          executionId={executionId}
          onBack={() => { setExecutionId(null); setPage('detail'); }}
        />
      )}
    </div>
  );
}
