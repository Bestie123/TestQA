import { useState, useRef } from 'react';
import { importExcel } from '../api';
import * as XLSX from 'xlsx';

interface Props {
  api: string;
}

export function ImportPage({ api }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  async function handleImport() {
    const file = fileInput.current?.files?.[0];
    if (!file) { setError('Выберите Excel-файл'); return; }
    setError('');
    setResult(null);
    setStatus('Чтение файла...');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      setStatus('Импорт...');
      const res = await importExcel(api, rows);
      setResult(res);
      setStatus('Готово');
    } catch (e: any) {
      setError(e?.message || 'Ошибка импорта');
      setStatus('');
    }
  }

  return (
    <div>
      <h1>Импорт тест-кейсов из Excel</h1>
      <div className="import-box">
        <input type="file" ref={fileInput} accept=".xlsx" style={{ marginBottom: 12, display: 'block' }} />
        <button className="btn" onClick={handleImport} disabled={!!status}>
          Импортировать
        </button>
        {status && <p className="status-text">{status}</p>}
        {error && <p className="error">{error}</p>}
        {result && (
          <div className="result-box">
            <p><strong>Импортировано:</strong> {result.imported}</p>
            <p><strong>Обновлено:</strong> {result.updated}</p>
            <p><strong>Пропущено:</strong> {result.skipped}</p>
            {result.errors?.length > 0 && (
              <div>
                <strong className="error-text">Ошибки:</strong>
                <ul className="error-list">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
