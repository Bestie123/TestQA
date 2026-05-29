import { useEffect, useState } from 'react';
import { RecordingSession, fetchRecordings, startRecording, stopRecording, convertRecording, createTestCase, launchBrowser, startBrowserRecording, stopBrowserRecording } from '../api';

interface Props {
  api: string;
  onNavigate?: (page: string, param?: string) => void;
}

export function RecorderPage({ api, onNavigate }: Props) {
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [convertedSteps, setConvertedSteps] = useState<any[] | null>(null);
  const [createdTcKey, setCreatedTcKey] = useState<string | null>(null);

  useEffect(() => {
    fetchRecordings(api).then(setSessions).catch(() => {});
  }, [api]);

  async function handleStart() {
    const name = sessionName.trim() || `Session ${Date.now()}`;
    const session = await startRecording(api, name);
    const pid = await launchBrowser(api, session.id);
    if (!pid) { alert('Failed to launch browser. Is browser-agent running?'); return; }
    const ok = await startBrowserRecording(api, pid, session.id, window.location.origin);
    if (!ok) { alert('Failed to start recording'); return; }
    setActiveSession(session.id);
    setProfileId(pid);
    setSessions(prev => [session, ...prev]);
    setConvertedSteps(null);
  }

  async function handleStop() {
    if (!activeSession) return;
    await stopBrowserRecording(api, activeSession);
    await stopRecording(api, activeSession);
    setActiveSession(null);
    setProfileId(null);
    fetchRecordings(api).then(setSessions).catch(() => {});
  }

  async function handleConvert(sessionId: string) {
    const steps = await convertRecording(api, sessionId);
    setConvertedSteps(steps);
    setCreatedTcKey(null);
  }

  async function handleCreateTestCase() {
    if (!convertedSteps || convertedSteps.length === 0) return;
    const name = sessionName.trim() || 'Recorded Test';
    const key = 'TC-REC-' + Date.now().toString(36).toUpperCase();
    const tc = await createTestCase(api, { key, name, steps: convertedSteps });
    if (tc) {
      setCreatedTcKey(tc.key);
    }
  }

  return (
    <div className="recorder-page">
      <h1>Recorder — запись действий</h1>

      <div className="recorder-panel">
        <div className="recorder-controls">
          <input
            type="text"
            placeholder="Название сессии..."
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            disabled={!!activeSession}
          />
          {!activeSession ? (
            <button className="btn btn-rec" onClick={handleStart}>● Начать запись</button>
          ) : (
            <button className="btn btn-stop" onClick={handleStop}>■ Остановить</button>
          )}
        </div>
        {activeSession && (
          <div className="recording-active">
            <span className="rec-dot" />
            Идёт запись...
          </div>
        )}
      </div>

      <h3>Сохранённые сессии</h3>
      {sessions.length === 0 ? (
        <div className="empty-state">Нет записанных сессий</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Статус</th>
              <th>Действий</th>
              <th>Дата</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                <td>{(s as any).actionCount ?? s.actions?.length ?? 0}</td>
                <td className="mono">{s.startedAt?.slice(0, 19).replace('T', ' ')}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => handleConvert(s.id)}>
                    Конвертировать
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {convertedSteps && convertedSteps.length > 0 && (
        <div className="section">
          <h3>Сконвертированные шаги ({convertedSteps.length})</h3>
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
              {convertedSteps.map((step, i) => (
                <tr key={i}>
                  <td className="step-num">{i + 1}</td>
                  <td className="pre-wrap">{step.action}</td>
                  <td className="mono step-data">{step.testData}</td>
                  <td className="pre-wrap">{step.expectedResult}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleCreateTestCase}>
              {createdTcKey ? '✓ Создан' : 'Создать тест-кейс'}
            </button>
            {createdTcKey && onNavigate && (
              <button className="btn btn-success" onClick={() => onNavigate('execution', createdTcKey)}>
                ▶ Выполнить {createdTcKey}
              </button>
            )}
            {createdTcKey && (
              <span style={{ color: '#2e7d32', fontSize: 13 }}>
                Тест-кейс {createdTcKey} создан. Нажмите "Выполнить" для запуска.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
