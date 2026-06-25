import { useEffect, useState } from 'react';
import { TestCase, fetchTestCases, fetchFolders } from '../api';

interface Props {
  api: string;
  onSelect: (key: string) => void;
}

const PAGE_SIZE = 100;

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
};
function statusDisplay(s: string): string { return STATUS_DISPLAY[s] || s; }

export function TestCaseList({ api, onSelect }: Props) {
  const [tcs, setTcs] = useState<TestCase[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [diffMap, setDiffMap] = useState<Record<string, any>>({});
  const [diffing, setDiffing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchFolders(api).then(setFolders).catch(() => {});
  }, [api]);

  useEffect(() => {
    setLoading(true);
    fetchTestCases(api, { search, folder: folderFilter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then(res => { setTcs(res.data); setTotal(res.total); setLoading(false); })
      .catch(() => { setTcs([]); setTotal(0); setLoading(false); });
  }, [api, search, folderFilter, page]);

  const [total, setTotal] = useState(0);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  async function checkDiff(key: string) {
    setDiffing(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${api}/zephyr/testcases?projectKey=${key.split('-')[0]}&maxPages=1`);
      const zephyrTCs = await res.json();
      const remote = Array.isArray(zephyrTCs) ? zephyrTCs.find((t: any) => t.key === key) : null;
      if (!remote) { setDiffMap(prev => ({ ...prev, [key]: { error: 'Не найден в Zephyr' } })); return; }
      const local = tcs.find(t => t.key === key);
      if (!local) return;
      const diffs: { field: string; local: string; remote: string }[] = [];
      if (local.name !== remote.name) diffs.push({ field: 'Name', local: local.name, remote: remote.name });
      if (local.status !== remote.status) diffs.push({ field: 'Status', local: local.status, remote: remote.status || '' });
      if ((local.precondition || '') !== (remote.precondition || '')) diffs.push({ field: 'Precondition', local: local.precondition || '', remote: remote.precondition || '' });
      setDiffMap(prev => ({ ...prev, [key]: diffs.length > 0 ? diffs : { ok: true } }));
    } catch { setDiffMap(prev => ({ ...prev, [key]: { error: 'Ошибка запроса' } })); }
    setDiffing(prev => ({ ...prev, [key]: false }));
  }

  const btn: React.CSSProperties = {
    padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 3,
    cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--text)', margin: '0 2px',
  };
  const btnActive: React.CSSProperties = { ...btn, background: 'var(--accent)', color: '#fff', fontWeight: 600 };

  return (
    <div style={{ padding: '20px 24px' }}>
      <h1>Тест-кейсы (локальная БД)</h1>
      <div className="search-row">
        <input type="text" placeholder="Поиск по названию или ключу..." value={search}
          onChange={e => setSearch(e.target.value)} />
        <select value={folderFilter} onChange={e => setFolderFilter(e.target.value)}>
          <option value="">Все папки</option>
          {folders.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {total} TC · стр. {page}/{totalPages}
        </span>
      </div>
      {loading ? <div className="empty-state">Загрузка...</div> : tcs.length === 0 ? (
        <div className="empty-state">Нет тест-кейсов. Импортируйте Excel-файл на странице «Импорт».</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Name</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Steps</th>
                <th>Сравнить</th>
              </tr>
            </thead>
            <tbody>
              {tcs.map(tc => (
                <tr key={tc.key} onClick={() => onSelect(tc.key)} className="clickable">
                  <td className="mono key-cell">{tc.key}</td>
                  <td>{tc.name}</td>
                  <td><span className={`badge badge-${tc.priority.toLowerCase()}`}>{tc.priority}</span></td>
                  <td><span className={`badge badge-${tc.status.toLowerCase()}`}>{statusDisplay(tc.status)}</span></td>
                  <td>{tc.steps?.length || 0}</td>
                  <td style={{ fontSize: 12 }}>
                    {diffMap[tc.key] ? (
                      diffMap[tc.key].ok ? <span style={{ color: '#4caf50' }}>✓ синх.</span> :
                      diffMap[tc.key].error ? <span style={{ color: '#f44336' }}>{diffMap[tc.key].error}</span> :
                      <details>
                        <summary style={{ color: '#ff9800', cursor: 'pointer' }}>
                          {diffMap[tc.key].length} различий
                        </summary>
                        {diffMap[tc.key].map((d: any, i: number) => (
                          <div key={i} style={{ margin: '4px 0', fontSize: 11 }}>
                            <strong>{d.field}:</strong><br />
                            <span style={{ color: '#4caf50' }}>лок: {d.local.slice(0, 60)}</span><br />
                            <span style={{ color: '#2196f3' }}>Zeph: {d.remote.slice(0, 60)}</span>
                          </div>
                        ))}
                      </details>
                    ) : (
                      <button style={{ ...btn, fontSize: 11 }}
                        onClick={e => { e.stopPropagation(); checkDiff(tc.key); }}
                        disabled={diffing[tc.key]}>
                        {diffing[tc.key] ? '...' : 'Zephyr'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '12px 0', alignItems: 'center' }}>
              <button style={btn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              <span style={{ fontSize: 13, margin: '0 8px' }}>{page} / {totalPages}</span>
              <button style={btn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
