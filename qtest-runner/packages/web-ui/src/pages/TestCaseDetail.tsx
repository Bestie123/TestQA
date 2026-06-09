import { useEffect, useState } from 'react';
import { TestCase, Execution, fetchTestCase, fetchTestCaseExecutions } from '../api';

interface Props {
  api: string;
  testCaseKey: string;
  onBack: () => void;
  onRun?: (key: string) => void;
}

const STATUS_DISPLAY: Record<string, string> = {
  'Approved': 'Утверждено', 'Утверждено': 'Утверждено', 'Draft': 'Черновик', 'Черновик': 'Черновик',
  'Deprecated': 'Устаревший', 'Устаревший': 'Устаревший', 'Устарел': 'Устаревший',
  'Automated': 'Автоматизирован', 'Автоматизирован': 'Автоматизирован',
  'In Review': 'В проверке', 'IN_PROGRESS': 'В РАБОТЕ', 'В РАБОТЕ': 'В РАБОТЕ',
};
function statusDisplay(s: string): string { return STATUS_DISPLAY[s] || s; }

const STATUS_COLORS: Record<string, string> = {
  'Утверждено': '#2e7d32', 'Черновик': '#f57f17', 'Устаревший': '#9e9e9e',
  'В проверке': '#1976d2', 'Автоматизирован': '#00bcd4', 'В РАБОТЕ': '#f57f17',
  default: '#9e9e9e',
};

const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#c62828', High: '#f57f17', Medium: '#fbc02d', Normal: '#fbc02d',
  Low: '#388e3c', Lowest: '#9e9e9e', default: '#9e9e9e',
};

const execColor = (st: string) => {
  const s = (st || '').toUpperCase();
  if (s === 'PASS' || s === 'PASSED' || s === 'ПРОЙДЕН') return '#2e7d32';
  if (s === 'FAIL' || s === 'FAILED' || s === 'ПРОВАЛЕН') return '#c62828';
  if (s === 'SKIPPED' || s === 'ПРОПУЩЕН') return '#f57f17';
  if (s === 'BLOCKED' || s === 'ЗАБЛОКИРОВАН') return '#6a1b9a';
  if (s === 'RUNNING' || s === 'В РАБОТЕ') return '#1976d2';
  if (s === 'NOT_STARTED' || s === 'НЕ ЗАПУСКАЛСЯ') return '#97a0af';
  return '#97a0af';
};

const execLabel = (st: string) => {
  const s = (st || '').toUpperCase();
  if (s === 'PASS' || s === 'PASSED' || s === 'ПРОЙДЕН') return 'Пройден';
  if (s === 'FAIL' || s === 'FAILED' || s === 'ПРОВАЛЕН') return 'Провален';
  if (s === 'SKIPPED' || s === 'ПРОПУЩЕН') return 'Пропущен';
  if (s === 'BLOCKED' || s === 'ЗАБЛОКИРОВАН') return 'Заблокирован';
  if (s === 'RUNNING' || s === 'В РАБОТЕ') return 'В работе';
  if (s === 'NOT_STARTED' || s === 'НЕ ЗАПУСКАЛСЯ') return 'Не запускался';
  return st || '—';
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
  color: active ? '#0052cc' : '#5e6c84',
  borderBottom: active ? '2px solid #0052cc' : '2px solid transparent',
  userSelect: 'none' as const,
});

const sectionStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 3, padding: 16, marginTop: 16,
  boxShadow: '0 1px 1px rgba(9,30,66,.25)',
};

export function TestCaseDetail({ api, testCaseKey, onBack, onRun }: Props) {
  const [tc, setTc] = useState<TestCase | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'steps' | 'execution'>('details');
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [execLoading, setExecLoading] = useState(false);

  useEffect(() => {
    fetchTestCase(api, testCaseKey).then((data) => {
      if (data) setTc(data); else setError('Тест-кейс не найден');
    });
  }, [api, testCaseKey]);

  useEffect(() => {
    if (activeTab === 'execution' && executions.length === 0 && !execLoading) {
      setExecLoading(true);
      fetchTestCaseExecutions(api, testCaseKey).then(data => {
        setExecutions(data || []);
        setExecLoading(false);
      });
    }
  }, [activeTab]);

  if (error) return <p className="error">{error}</p>;
  if (!tc) return <p>Загрузка...</p>;
  if (!tc.steps) (tc as any).steps = [];

  const statusColor = STATUS_COLORS[statusDisplay(tc.status)] || STATUS_COLORS.default;
  const priorityColor = PRIORITY_COLORS[tc.priority] || PRIORITY_COLORS.default;

  return (
    <div className="detail-page">
      <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
        ← Назад к списку
      </a>

      {/* Header */}
      <div className="detail-header" style={{ borderBottom: '1px solid #dfe1e6', paddingBottom: 12, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono">{tc.key}</span>
            <span className="version-badge" style={{
              fontSize: 11, color: '#5e6c84', border: '1px solid #dfe1e6',
              borderRadius: 3, padding: '0 6px', lineHeight: '20px',
            }}>{tc.version || '1.0'}</span>
          </h1>
          <p style={{ fontSize: 16, marginTop: 4, color: '#172b4d' }}>{tc.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'start', marginTop: 8 }}>
          {tc.key?.includes('-') && (
            <a href={`https://jira.ifellow.ru/secure/Tests.jspa#/testCase/${tc.key}${tc.project_id ? '?projectId=' + tc.project_id : ''}`}
              target="_blank" rel="noopener noreferrer"
              style={{ padding: '6px 12px', border: '1px solid #dfe1e6', borderRadius: 3,
                fontSize: 13, color: '#42526e', textDecoration: 'none', background: '#fff' }}>
              Открыть в Zephyr ↗
            </a>
          )}
          {onRun && (
            <button onClick={() => onRun(tc.key)}
              style={{ padding: '6px 12px', border: '1px solid #0052cc', borderRadius: 3,
                fontSize: 13, color: '#fff', background: '#0052cc', cursor: 'pointer' }}>
              ▶ Выполнить
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #dfe1e6', background: '#fff' }}>
        <div style={tabStyle(activeTab === 'details')} onClick={() => setActiveTab('details')}>Подробнее</div>
        <div style={tabStyle(activeTab === 'steps')} onClick={() => setActiveTab('steps')}>Шаги</div>
        <div style={tabStyle(activeTab === 'execution')} onClick={() => setActiveTab('execution')}>Выполнение</div>
      </div>

      {/* Content */}
      {activeTab === 'details' && renderDetails()}
      {activeTab === 'steps' && renderSteps()}
      {activeTab === 'execution' && renderExecution()}
    </div>
  );

  function renderDetails() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginTop: 16 }}>
        {/* Left — main fields */}
        <div style={sectionStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5e6c84', marginBottom: 4 }}>
              Наименование <span style={{ color: '#dc3545' }}>*</span>
            </div>
            <div style={{ fontSize: 14, color: '#172b4d' }}>{tc.name}</div>
          </div>

          {tc.objective && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#5e6c84', marginBottom: 4 }}>
                Задача тест кейса
              </div>
              <div className="pre-wrap" style={{ fontSize: 14, color: '#172b4d' }}
                dangerouslySetInnerHTML={{ __html: tc.objective }} />
            </div>
          )}

          {tc.precondition && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#5e6c84', marginBottom: 4 }}>
                Предварительные действия до начала работы с тест кейсом
              </div>
              <div className="pre-wrap" style={{ fontSize: 14, color: '#172b4d' }}
                dangerouslySetInnerHTML={{ __html: tc.precondition }} />
            </div>
          )}
        </div>

        {/* Right — metadata sidebar */}
        <div style={{ ...sectionStyle, minWidth: 280, margin: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', fontSize: 13 }}>
            <span style={{ color: '#5e6c84' }}>Статус</span>
            <span><StatusBadge color={statusColor} label={statusDisplay(tc.status)} /></span>

            <span style={{ color: '#5e6c84' }}>Приоритет</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                background: priorityColor, verticalAlign: 'middle',
              }} />
              {tc.priority}
            </span>

            <span style={{ color: '#5e6c84' }}>Компонент</span>
            <span>{tc.component || 'Нет'}</span>

            <span style={{ color: '#5e6c84' }}>Владелец</span>
            <span>{tc.owner || '—'}</span>

            <span style={{ color: '#5e6c84' }}>Расчётное время</span>
            <span>{tc.estimated_time || '—'}</span>

            <span style={{ color: '#5e6c84' }}>Папка</span>
            <span style={{ fontSize: 12, color: '#5e6c84' }}>{tc.folder || '—'}</span>

            <span style={{ color: '#5e6c84' }}>Теги</span>
            <span>{tc.labels || '—'}</span>
          </div>
        </div>
      </div>
    );
  }

  function renderSteps() {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px 0' }}>
          Шаги ({tc.steps.length})
        </h3>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13,
          background: '#fff', borderRadius: 3,
          boxShadow: '0 1px 1px rgba(9,30,66,.25)',
        }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 600, color: '#5e6c84',
                fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #dfe1e6', width: 40 }}>#</th>
              <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 600, color: '#5e6c84',
                fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #dfe1e6' }}>Шаг</th>
              <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 600, color: '#5e6c84',
                fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #dfe1e6', width: 200 }}>Тестовые данные</th>
              <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 600, color: '#5e6c84',
                fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #dfe1e6' }}>Ожидаемый результат</th>
            </tr>
          </thead>
          <tbody>
            {tc.steps.map((step, i) => (
              <tr key={step.id}>
                <td style={{ padding: '6px 5px', borderBottom: '1px solid #ebecf0', color: '#97a0af', textAlign: 'center', fontSize: 12 }}>{i + 1}</td>
                <td style={{ padding: '6px 5px', borderBottom: '1px solid #ebecf0' }} className="pre-wrap">{step.action}</td>
                <td style={{ padding: '6px 5px', borderBottom: '1px solid #ebecf0', fontFamily: 'monospace', fontSize: 12 }} className="step-data">{step.test_data}</td>
                <td style={{ padding: '6px 5px', borderBottom: '1px solid #ebecf0' }} className="pre-wrap">{step.expected_result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderExecution() {
    if (execLoading) return <p style={{ color: '#97a0af', marginTop: 16, textAlign: 'center' }}>Загрузка...</p>;
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px 0' }}>
          Выполнения ({executions.length})
        </h3>
        {executions.length === 0 ? (
          <p style={{ color: '#97a0af', fontSize: 13 }}>Нет выполнений для этого тест-кейса</p>
        ) : (
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: 13,
            background: '#fff', borderRadius: 3,
            boxShadow: '0 1px 1px rgba(9,30,66,.25)',
          }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 600, color: '#5e6c84',
                  fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #dfe1e6' }}>ID</th>
                <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 600, color: '#5e6c84',
                  fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #dfe1e6', width: 110 }}>Статус</th>
                <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 600, color: '#5e6c84',
                  fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #dfe1e6' }}>Дата</th>
                <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 600, color: '#5e6c84',
                  fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #dfe1e6', width: 80 }}>Шаги</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((ex) => {
                const doneSteps = (ex.steps || []).filter((s: any) =>
                  ['passed', 'failed', 'skipped', 'blocked'].includes(s.status)
                ).length;
                const totalSteps = (ex.steps || []).length;
                return (
                  <tr key={ex.id}>
                    <td style={{ padding: '6px 5px', borderBottom: '1px solid #ebecf0', fontFamily: 'monospace', fontSize: 12 }}>
                      {ex.id.substring(0, 8)}...
                    </td>
                    <td style={{ padding: '6px 5px', borderBottom: '1px solid #ebecf0' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                        fontSize: 11, fontWeight: 600, color: '#fff',
                        background: execColor(ex.status),
                      }}>{execLabel(ex.status)}</span>
                    </td>
                    <td style={{ padding: '6px 5px', borderBottom: '1px solid #ebecf0', fontSize: 12, color: '#5e6c84' }}>
                      {ex.created_at ? new Date(ex.created_at).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td style={{ padding: '6px 5px', borderBottom: '1px solid #ebecf0', fontSize: 12, color: '#5e6c84', textAlign: 'center' }}>
                      {totalSteps > 0 ? `${doneSteps}/${totalSteps}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0 8px', borderRadius: 12, fontSize: 12,
      fontWeight: 600, lineHeight: '22px', color: '#fff', background: color,
    }}>{label}</span>
  );
}
