// ══════════════════════════════════════════════════════════════
// Action Queue — очередь programmatic actions для отправки
// в recorder-service (HTTP batch flush каждые 2 секунды)
//
// Используется mcp-browser для записи действий, выполненных
// через Playwright API (click, type, press, navigate, evaluate)
// ══════════════════════════════════════════════════════════════

import http from 'http';
import { RecordedAction } from './types';

export class ActionQueue {
  private pending: RecordedAction[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private recorderUrl: string;

  constructor(recorderUrl: string) {
    this.recorderUrl = recorderUrl;
  }

  start(sessionId: string): void {
    this.sessionId = sessionId;
    this.pending = [];
    this.flushTimer = setInterval(() => this.flush(), 2000);
  }

  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Final flush with retries (same as browser-agent recorder.ts:1122-1129)
    await this.flushWithRetries(3, 1000);
    this.sessionId = null;
  }

  push(action: RecordedAction): void {
    if (!this.sessionId) return;
    action.timestamp = action.timestamp || new Date().toISOString();
    this.pending.push(action);
  }

  isActive(): boolean {
    return this.sessionId !== null;
  }

  private async flush(): Promise<void> {
    if (this.pending.length === 0 || !this.sessionId) return;
    const actions = this.pending.splice(0);
    try {
      await postJson(
        `${this.recorderUrl}/api/recordings/${this.sessionId}/actions`,
        { actions }
      );
    } catch (err) {
      // Re-queue on failure (same as browser-agent recorder.ts:1152)
      this.pending.unshift(...actions);
      console.error(`[recorder-shared] flush failed, re-queued ${actions.length} actions`);
    }
  }

  private async flushWithRetries(retries: number, delayMs: number): Promise<void> {
    for (let i = 0; i < retries; i++) {
      if (this.pending.length === 0) break;
      await this.flush();
      if (this.pending.length > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
}

function postJson(url: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(chunks)); } catch { resolve(null); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${chunks.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════════
// Action Builders
// ══════════════════════════════════════════════════════════════

export function buildClickAction(selector: string, text?: string): RecordedAction {
  return {
    actionType: 'click', selector, selectorText: text || '',
    source: 'programmatic', timestamp: new Date().toISOString(),
  };
}

export function buildFillAction(selector: string, value: string, inputType?: string): RecordedAction {
  return {
    actionType: 'fill', selector, value, inputType: inputType || 'text',
    source: 'programmatic', timestamp: new Date().toISOString(),
  };
}

export function buildKeypressAction(key: string, selector?: string): RecordedAction {
  return {
    actionType: 'keypress', selector: selector || '', value: key,
    source: 'programmatic', timestamp: new Date().toISOString(),
  };
}

export function buildNavigateAction(url: string): RecordedAction {
  return {
    actionType: 'navigate', url, selectorText: url,
    source: 'programmatic', timestamp: new Date().toISOString(),
  };
}

export function buildEvaluateAction(code: string, result?: string): RecordedAction {
  return {
    actionType: 'evaluate', value: code.slice(0, 200), selectorText: result?.slice(0, 100) || '',
    source: 'programmatic', timestamp: new Date().toISOString(),
  };
}

export function buildStepMarker(stepNumber: number, description: string, expectedResult?: string): RecordedAction {
  return {
    actionType: 'step_marker', stepNumber, description, expectedResult,
    source: 'programmatic', timestamp: new Date().toISOString(),
  };
}

export function buildManualAction(
  description: string, actionType: 'verify' | 'observe' | 'note' | 'assert',
  selector?: string, expected?: string, actual?: string, screenshot?: string
): RecordedAction {
  return {
    actionType: 'manual_action', description, actionType2: actionType,
    selector, expected, actual, screenshot,
    source: 'programmatic', timestamp: new Date().toISOString(),
  };
}
