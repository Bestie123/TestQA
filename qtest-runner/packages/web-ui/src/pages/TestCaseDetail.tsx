import { useEffect, useState } from 'react';
import { TestCase, fetchTestCase } from '../api';

interface Props {
  api: string;
  testCaseKey: string;
  onBack: () => void;
  onRun?: (key: string) => void;
}

export function TestCaseDetail({ api, testCaseKey, onBack, onRun }: Props) {
  const [tc, setTc] = useState<TestCase | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTestCase(api, testCaseKey).then((data) => {
      if (data) setTc(data); else setError('Тест-кейс не найден');
    });
  }, [api, testCaseKey]);

  if (error) return <p className="error">{error}</p>;
  if (!tc) return <p>Загрузка...</p>;
  if (!tc.steps) (tc as any).steps = [];

  return (
    <div className="detail-page">
      <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
        ← Назад к списку
      </a>
      <div className="detail-header">
        <h1><span className="mono">{tc.key}</span>: {tc.name}</h1>
        {onRun && (
          <button className="btn btn-run" onClick={() => onRun(tc.key)}>
            ▶ Выполнить
          </button>
        )}
      </div>

      <div className="meta-box">
        <div><strong>Приоритет:</strong> {tc.priority}</div>
        <div><strong>Статус:</strong> {tc.status}</div>
        <div><strong>Owner:</strong> {tc.owner}</div>
        <div><strong>Шагов:</strong> {tc.steps?.length || 0}</div>
        <div><strong>Папка:</strong> <span className="folder-path">{tc.folder}</span></div>
        {tc.coverage_issues && <div><strong>Coverage:</strong> <span className="mono">{tc.coverage_issues}</span></div>}
      </div>

      {tc.precondition && (
        <div className="section">
          <h3>Предусловия</h3>
          <div className="pre-wrap">{tc.precondition}</div>
        </div>
      )}

      {tc.objective && (
        <div className="section">
          <h3>Цель</h3>
          <div className="pre-wrap">{tc.objective}</div>
        </div>
      )}

      <div className="section">
        <h3>Шаги ({tc.steps.length})</h3>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Действие</th>
              <th style={{ width: 180 }}>Тестовые данные</th>
              <th>Ожидаемый результат</th>
            </tr>
          </thead>
          <tbody>
            {tc.steps.map((step, i) => (
              <tr key={step.id}>
                <td className="step-num">{i + 1}</td>
                <td className="pre-wrap">{step.action}</td>
                <td className="mono step-data">{step.test_data}</td>
                <td className="pre-wrap">{step.expected_result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
