import { useEffect, useState, useCallback, useRef } from 'react';
import { Execution, fetchExecution, startExecution, updateStepStatus, autoNextStep } from '../api';

interface Props {
  api: string;
  executionId: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  running: 'Выполняется',
  passed: 'Пройден',
  failed: 'Провален',
  skipped: 'Пропущен',
  blocked: 'Заблокирован',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#9e9e9e',
  running: '#1976d2',
  passed: '#2e7d32',
  failed: '#c62828',
  skipped: '#f57f17',
  blocked: '#6a1b9a',
};

export function ExecutionPage({ api, executionId, onBack }: Props) {
  const [exec, setExec] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoMode, setAutoMode] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const autoRef = useRef(false);

  const load = useCallback(() => {
    fetchExecution(api, executionId)
      .then(setExec)
      .catch(() => setError('Ошибка загрузки выполнения'))
      .finally(() => setLoading(false));
  }, [api, executionId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoMode || autoBusy || !exec) return;
    const runningStep = exec.steps.find(s => s.status === 'running');
    if (!runningStep || ['passed', 'failed', 'skipped', 'blocked'].includes(runningStep.status)) return;
    runAutoStep();
  }, [exec, autoMode, autoBusy]);

  async function runAutoStep() {
    if (autoBusy) return;
    setAutoBusy(true);
    try {
      const result = await autoNextStep(api, executionId);
      if (result && result.execution) setExec(result.execution);
    } catch {
      setError('Ошибка авто-выполнения');
    }
    setAutoBusy(false);
  }

  async function handleStart() {
    setLoading(true);
    try {
      const updated = await startExecution(api, executionId);
      setExec(updated);
    } catch {
      setError('Ошибка запуска');
    }
    setLoading(false);
  }

  async function handleStepStatus(stepIndex: number, status: string) {
    try {
      const updated = await updateStepStatus(api, executionId, stepIndex, status);
      setExec(updated);
    } catch {
      setError('Ошибка обновления шага');
    }
  }

  function toggleAuto() {
    const next = !autoMode;
    setAutoMode(next);
    if (next && exec) {
      const runningStep = exec.steps.find(s => s.status === 'running');
      if (runningStep) runAutoStep();
    }
  }

  if (loading) return <p>Загрузка...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!exec) return <p className="error">Выполнение не найдено</p>;

  const currentStepIdx = exec.steps.findIndex(s => s.status === 'running');
  const currentStep = currentStepIdx >= 0 ? exec.steps[currentStepIdx] : null;

  return (
    <div className="execution-page">
      <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
        ← Назад
      </a>

      <div className="exec-header">
        <h1>
          <span className="mono">{exec.test_case_key}</span>: {exec.test_case_name}
        </h1>
        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            className="exec-badge"
            style={{ background: STATUS_COLORS[exec.status] || '#9e9e9e' }}
          >
            {STATUS_LABELS[exec.status] || exec.status}
          </span>
          {exec.status !== 'not_started' && (
            <button
              className={`btn ${autoMode ? 'btn-auto-on' : 'btn-auto-off'}`}
              onClick={toggleAuto}
              title={autoMode ? 'Выключить авто-режим' : 'Включить авто-режим'}
            >
              {autoMode ? '⚡ Авто' : '🔄 Ручной'}
            </button>
          )}
        </span>
      </div>

      {exec.status === 'not_started' && (
        <div className="exec-start-box">
          <p>Тест-кейс готов к выполнению. Нажмите «Старт» для начала.</p>
          <button className="btn btn-start" onClick={handleStart}>Старт</button>
        </div>
      )}

      {exec.status !== 'not_started' && (
        <div className="exec-progress-bar">
          <div className="exec-progress-fill" style={{
            width: `${exec.steps.length > 0 ? (exec.steps.filter(s => ['passed', 'failed', 'skipped', 'blocked'].includes(s.status)).length / exec.steps.length) * 100 : 0}%`
          }} />
        </div>
      )}

      <div className="exec-content">
        <div className="exec-steps-list">
          <h3>Шаги ({exec.steps.length})</h3>
          {exec.steps.map((step) => (
            <div
              key={step.id}
              className={`exec-step-item ${step.status === 'running' ? 'exec-step-current' : ''} ${['passed', 'failed', 'skipped', 'blocked'].includes(step.status) ? 'exec-step-done' : ''}`}
              onClick={() => {
                if (step.status === 'running' || step.status === 'pending') {
                  const target = document.getElementById(`step-detail-${step.step_index}`);
                  if (target) target.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              <span className="exec-step-index">{step.step_index + 1}</span>
              <span className="exec-step-action">{step.action || `Шаг ${step.step_index + 1}`}</span>
              <span
                className="exec-step-status"
                style={{ color: STATUS_COLORS[step.status] || '#9e9e9e' }}
              >
                {STATUS_LABELS[step.status] || step.status}
              </span>
            </div>
          ))}
        </div>

        <div className="exec-steps-detail">
          {currentStep && (
            <div id={`step-detail-${currentStep.step_index}`} className="exec-step-card">
              <h3>Шаг {currentStep.step_index + 1} {autoMode ? '(авто)' : '— выполняется'}</h3>
              <div className="exec-step-field">
                <strong>Действие:</strong>
                <div className="pre-wrap">{currentStep.action}</div>
              </div>
              {currentStep.test_data && (
                <div className="exec-step-field">
                  <strong>Тестовые данные:</strong>
                  <div className="pre-wrap mono">{currentStep.test_data}</div>
                </div>
              )}
              <div className="exec-step-field">
                <strong>Ожидаемый результат:</strong>
                <div className="pre-wrap">{currentStep.expected_result}</div>
              </div>
              {currentStep.screenshot && (
                <div className="exec-step-field">
                  <strong>Скриншот:</strong>
                  <img src={currentStep.screenshot} alt={`Шаг ${currentStep.step_index + 1}`} style={{ maxWidth: '100%', border: '1px solid #ddd', borderRadius: '4px', marginTop: '4px' }} />
                </div>
              )}
              {currentStep.notes && (
                <div className="exec-step-field">
                  <strong>Результат:</strong>
                  <div className="pre-wrap">{currentStep.notes}</div>
                </div>
              )}
              {!autoMode && (
                <div className="exec-step-actions">
                  <button className="btn btn-pass" onClick={() => handleStepStatus(currentStep.step_index, 'passed')}>
                    ✓ Пройден
                  </button>
                  <button className="btn btn-fail" onClick={() => handleStepStatus(currentStep.step_index, 'failed')}>
                    ✗ Провален
                  </button>
                  <button className="btn btn-skip" onClick={() => handleStepStatus(currentStep.step_index, 'skipped')}>
                    → Пропущен
                  </button>
                  <button className="btn btn-block" onClick={() => handleStepStatus(currentStep.step_index, 'blocked')}>
                    ⊘ Заблокирован
                  </button>
                </div>
              )}
              {autoMode && autoBusy && <p style={{ color: '#1976d2' }}>Выполняется автоматически...</p>}
            </div>
          )}

          {!currentStep && exec.status === 'passed' && (
            <div className="exec-complete exec-complete-pass">
              <h3>✓ Все шаги пройдены</h3>
              <p>Тест-кейс выполнен успешно.</p>
            </div>
          )}
          {!currentStep && exec.status === 'failed' && (
            <div className="exec-complete exec-complete-fail">
              <h3>✗ Выполнение завершено с ошибками</h3>
              <p>Один или несколько шагов не пройдены.</p>
            </div>
          )}
          {!currentStep && exec.status === 'blocked' && (
            <div className="exec-complete exec-complete-block">
              <h3>⊘ Выполнение заблокировано</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
