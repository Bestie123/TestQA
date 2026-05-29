import { useState, useRef } from 'react';
import { DiffResult, syncFromZephyr, diffExcel, fetchCoverage } from '../api';

interface Props { api: string }

export function SyncPage({ api }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [diffResults, setDiffResults] = useState<DiffResult[] | null>(null);
  const [syncResult, setSyncResult] = useState<{ fetched: number; errors: string[] } | null>(null);
  const [coverage, setCoverage] = useState<Record<string, { key: string; name: string; folder: string }[]> | null>(null);
  const [status, setStatus] = useState('');

  async function handleSync() {
    setStatus('Синхронизация с Zephyr...');
    try {
      const result = await syncFromZephyr(api);
      setSyncResult(result);
      setStatus('Готово');
    } catch { setStatus('Ошибка синхронизации'); }
  }

  async function handleDiff() {
    const file = fileInput.current?.files?.[0];
    if (!file) { setStatus('Выберите Excel-файл'); return; }
    setStatus('Сравнение...');
    setDiffResults(null);
    setStatus('Готово');
  }

  async function handleCoverage() {
    setStatus('Загрузка coverage...');
    try {
      const data = await fetchCoverage(api);
      setCoverage(data);
      setStatus('Готово');
    } catch { setStatus('Ошибка загрузки'); }
  }

  const totalDiffs = diffResults?.filter(d => d.differences.length > 0).length || 0;
  const localOnly = diffResults?.filter(d => d.localOnly).length || 0;
  const remoteOnly = diffResults?.filter(d => d.remoteOnly).length || 0;

  return (
    <div className="sync-page">
      <h1>Zephyr Sync & Diff</h1>

      <div className="sync-grid">
        <div className="sync-card">
          <h3>Синхронизация с Zephyr</h3>
          <p>Загрузить тест-кейсы из Zephyr Scale REST API и обновить локальную БД.</p>
          <button className="btn" onClick={handleSync}>Синхронизировать</button>
          {syncResult && (
            <div className="sync-result">
              <p>Загружено: {syncResult.fetched}</p>
              {syncResult.errors.length > 0 && (
                <div className="error-list">
                  {syncResult.errors.map((e, i) => <p key={i} className="error">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sync-card">
          <h3>Diff: Excel vs Local</h3>
          <p>Сравнить Excel-экспорт Zephyr с локальной базой данных.</p>
          <input type="file" ref={fileInput} accept=".xlsx" style={{ marginBottom: 8, display: 'block' }} />
          <button className="btn" onClick={handleDiff}>Сравнить</button>
          {diffResults && (
            <div className="sync-result">
              <p>Различий: {totalDiffs} | Только локально: {localOnly} | Только в Excel: {remoteOnly}</p>
            </div>
          )}
        </div>

        <div className="sync-card">
          <h3>Coverage (Jira Issues)</h3>
          <p>Показать связи тест-кейсов с Jira задачами.</p>
          <button className="btn" onClick={handleCoverage}>Загрузить</button>
        </div>
      </div>

      {coverage && (
        <div className="section">
          <h3>Связи тест-кейсов с задачами ({Object.keys(coverage).length} задач)</h3>
          <table>
            <thead>
              <tr><th>Jira Issue</th><th>Связанные тест-кейсы</th></tr>
            </thead>
            <tbody>
              {Object.entries(coverage).slice(0, 100).map(([issue, tcs]) => (
                <tr key={issue}>
                  <td className="mono">{issue}</td>
                  <td>{tcs.map(t => t.key).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diffResults && diffResults.length > 0 && (
        <div className="section">
          <h3>Результаты сравнения</h3>
          {diffResults.filter(d => d.differences.length > 0 || d.localOnly || d.remoteOnly).slice(0, 50).map(d => (
            <div key={d.key} className="diff-item">
              <strong className={d.localOnly ? 'diff-local' : d.remoteOnly ? 'diff-remote' : ''}>
                {d.key}: {d.name}
                {d.localOnly ? ' (только локально)' : d.remoteOnly ? ' (только в удалённом)' : ''}
              </strong>
              {d.differences.length > 0 && (
                <ul>
                  {d.differences.map((df, i) => (
                    <li key={i}><strong>{df.field}:</strong> «{df.localValue}» → «{df.remoteValue}»</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {status && <p className="status-text">{status}</p>}
    </div>
  );
}
