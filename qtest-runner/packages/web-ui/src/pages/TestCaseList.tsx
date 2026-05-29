import { useEffect, useState } from 'react';
import { TestCase, fetchTestCases, fetchFolders } from '../api';

interface Props {
  api: string;
  onSelect: (key: string) => void;
}

export function TestCaseList({ api, onSelect }: Props) {
  const [tcs, setTcs] = useState<TestCase[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('');

  useEffect(() => {
    fetchFolders(api).then(setFolders).catch(() => {});
  }, [api]);

  useEffect(() => {
    fetchTestCases(api, { search, folder: folderFilter })
      .then(setTcs)
      .catch(() => setTcs([]));
  }, [api, search, folderFilter]);

  return (
    <div>
      <h1>Тест-кейсы</h1>
      <div className="search-row">
        <input
          type="text"
          placeholder="Поиск по названию или ключу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}>
          <option value="">Все папки</option>
          {folders.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      {tcs.length === 0 ? (
        <div className="empty-state">
          Нет тест-кейсов. Импортируйте Excel-файл на странице «Импорт».
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Steps</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {tcs.map((tc) => (
              <tr key={tc.key} onClick={() => onSelect(tc.key)} className="clickable">
                <td className="mono key-cell">{tc.key}</td>
                <td>{tc.name}</td>
                <td><span className={`badge badge-${tc.priority.toLowerCase()}`}>{tc.priority}</span></td>
                <td><span className={`badge badge-${tc.status.toLowerCase()}`}>{tc.status}</span></td>
                <td>{tc.steps?.length || 0}</td>
                <td className="mono coverage-cell">{tc.coverage_issues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
