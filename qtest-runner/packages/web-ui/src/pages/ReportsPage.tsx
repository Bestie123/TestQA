import { useEffect, useState } from 'react';
import { fetchReportSummary, fetchReportHistory } from '../api';

interface Props { api: string }

export function ReportsPage({ api }: Props) {
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<Record<string, Record<string, number>> | null>(null);

  useEffect(() => {
    fetchReportSummary(api).then(setSummary).catch(() => {});
    fetchReportHistory(api).then(setHistory).catch(() => {});
  }, [api]);

  return (
    <div className="reports-page">
      <h1>Отчёты и статистика</h1>

      {summary && (
        <div className="report-cards">
          <div className="report-card">
            <div className="report-num">{summary.total}</div>
            <div className="report-label">Всего выполнений</div>
          </div>
          <div className="report-card card-pass">
            <div className="report-num">{summary.byStatus?.passed || 0}</div>
            <div className="report-label">Пройдено</div>
          </div>
          <div className="report-card card-fail">
            <div className="report-num">{summary.byStatus?.failed || 0}</div>
            <div className="report-label">Провалено</div>
          </div>
          <div className="report-card card-avg">
            <div className="report-num">{summary.avgDurationSeconds}c</div>
            <div className="report-label">Средняя длительность</div>
          </div>
        </div>
      )}

      {summary?.byTestCase && summary.byTestCase.length > 0 && (
        <div className="section">
          <h3>Статистика по тест-кейсам</h3>
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Name</th>
                <th>Всего</th>
                <th>Пройдено</th>
                <th>Провалено</th>
                <th>% успеха</th>
              </tr>
            </thead>
            <tbody>
              {summary.byTestCase.map((tc: any) => (
                <tr key={tc.test_case_key}>
                  <td className="mono">{tc.test_case_key}</td>
                  <td>{tc.test_case_name}</td>
                  <td>{tc.total}</td>
                  <td style={{ color: '#2e7d32' }}>{tc.passed}</td>
                  <td style={{ color: '#c62828' }}>{tc.failed}</td>
                  <td>{tc.total > 0 ? Math.round((tc.passed / tc.total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history && Object.keys(history).length > 0 && (
        <div className="section">
          <h3>История выполнений (по дням)</h3>
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Пройдено</th>
                <th>Провалено</th>
                <th>Заблокировано</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(history).map(([day, statuses]) => (
                <tr key={day}>
                  <td className="mono">{day}</td>
                  <td style={{ color: '#2e7d32' }}>{(statuses as any).passed || 0}</td>
                  <td style={{ color: '#c62828' }}>{(statuses as any).failed || 0}</td>
                  <td style={{ color: '#6a1b9a' }}>{(statuses as any).blocked || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!summary && <p className="empty-state">Нет данных о выполнениях</p>}
    </div>
  );
}
