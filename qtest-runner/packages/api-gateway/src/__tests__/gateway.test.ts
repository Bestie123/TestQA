import { describe, it, expect } from 'vitest';

function getTarget(url: string): { host: string; port: number; path: string } | null {
  const routes: { prefix: string; host: string; port: number; stripPrefix?: boolean }[] = [
    { prefix: '/api/testcases', host: 'localhost', port: 3001 },
    { prefix: '/api/folders', host: 'localhost', port: 3001 },
    { prefix: '/api/import', host: 'localhost', port: 3001 },
    { prefix: '/api/zephyr', host: 'localhost', port: 3001 },
    { prefix: '/api/diff', host: 'localhost', port: 3001 },
    { prefix: '/api/coverage', host: 'localhost', port: 3001 },
    { prefix: '/api/steps', host: 'localhost', port: 3002 },
    { prefix: '/api/categories', host: 'localhost', port: 3002 },
    { prefix: '/api/composite-steps', host: 'localhost', port: 3002 },
    { prefix: '/api/composite-categories', host: 'localhost', port: 3002 },
    { prefix: '/api/executions', host: 'localhost', port: 3003 },
    { prefix: '/api/reports', host: 'localhost', port: 3003 },
    { prefix: '/api/recordings', host: 'localhost', port: 3004 },
    { prefix: '/api/user-switch', host: 'localhost', port: 3004 },
    { prefix: '/api/settings', host: 'localhost', port: 3004 },
    { prefix: '/api/record', host: 'localhost', port: 3005 },
    { prefix: '/api/launch', host: 'localhost', port: 3005 },
    { prefix: '/api/profiles', host: 'localhost', port: 3005 },
    { prefix: '/api/agent', host: 'localhost', port: 3005, stripPrefix: true },
    { prefix: '/api/execute-step', host: 'localhost', port: 3005 },
    { prefix: '/api/videos', host: 'localhost', port: 3005 },
    { prefix: '/api/video', host: 'localhost', port: 3005 },
    { prefix: '/api/debug', host: 'localhost', port: 3005 },
  ];
  for (const r of routes) {
    if (url.startsWith(r.prefix)) {
      const path = (r as any).stripPrefix ? url.replace(r.prefix, '') : url;
      return { host: r.host, port: r.port, path };
    }
  }
  return null;
}

function cleanHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> {
  const cleaned: Record<string, string | string[] | undefined> = {};
  const skip = ['host', 'connection', 'keep-alive', 'transfer-encoding'];
  for (const [k, v] of Object.entries(headers)) {
    if (!skip.includes(k.toLowerCase())) cleaned[k] = v;
  }
  return cleaned;
}

describe('api-gateway routing', () => {
  describe('testcase-service (3001)', () => {
    it('routes /api/testcases', () => {
      expect(getTarget('/api/testcases')).toEqual({ host: 'localhost', port: 3001, path: '/api/testcases' });
    });

    it('routes /api/testcases/IBPA-123', () => {
      expect(getTarget('/api/testcases/IBPA-123')).toEqual({ host: 'localhost', port: 3001, path: '/api/testcases/IBPA-123' });
    });

    it('routes /api/folders', () => {
      expect(getTarget('/api/folders')).toEqual({ host: 'localhost', port: 3001, path: '/api/folders' });
    });

    it('routes /api/zephyr/sync', () => {
      expect(getTarget('/api/zephyr/sync')).toEqual({ host: 'localhost', port: 3001, path: '/api/zephyr/sync' });
    });

    it('routes /api/zephyr/test-connection', () => {
      expect(getTarget('/api/zephyr/test-connection')).toEqual({ host: 'localhost', port: 3001, path: '/api/zephyr/test-connection' });
    });

    it('routes /api/coverage', () => {
      expect(getTarget('/api/coverage')).toEqual({ host: 'localhost', port: 3001, path: '/api/coverage' });
    });

    it('routes /api/diff/excel', () => {
      expect(getTarget('/api/diff/excel')).toEqual({ host: 'localhost', port: 3001, path: '/api/diff/excel' });
    });
  });

  describe('step-library-service (3002)', () => {
    it('routes /api/steps', () => {
      expect(getTarget('/api/steps')).toEqual({ host: 'localhost', port: 3002, path: '/api/steps' });
    });

    it('routes /api/composite-steps', () => {
      expect(getTarget('/api/composite-steps')).toEqual({ host: 'localhost', port: 3002, path: '/api/composite-steps' });
    });

    it('routes /api/composite-categories', () => {
      expect(getTarget('/api/composite-categories')).toEqual({ host: 'localhost', port: 3002, path: '/api/composite-categories' });
    });

    it('routes /api/categories', () => {
      expect(getTarget('/api/categories')).toEqual({ host: 'localhost', port: 3002, path: '/api/categories' });
    });
  });

  describe('execution-service (3003)', () => {
    it('routes /api/executions', () => {
      expect(getTarget('/api/executions')).toEqual({ host: 'localhost', port: 3003, path: '/api/executions' });
    });

    it('routes /api/executions/abc-123/start', () => {
      expect(getTarget('/api/executions/abc-123/start')).toEqual({ host: 'localhost', port: 3003, path: '/api/executions/abc-123/start' });
    });

    it('routes /api/reports/summary', () => {
      expect(getTarget('/api/reports/summary')).toEqual({ host: 'localhost', port: 3003, path: '/api/reports/summary' });
    });
  });

  describe('recorder-service (3004)', () => {
    it('routes /api/recordings', () => {
      expect(getTarget('/api/recordings')).toEqual({ host: 'localhost', port: 3004, path: '/api/recordings' });
    });

    it('routes /api/recordings/start', () => {
      expect(getTarget('/api/recordings/start')).toEqual({ host: 'localhost', port: 3004, path: '/api/recordings/start' });
    });

    it('routes /api/settings', () => {
      expect(getTarget('/api/settings')).toEqual({ host: 'localhost', port: 3004, path: '/api/settings' });
    });

    it('routes /api/user-switch/config', () => {
      expect(getTarget('/api/user-switch/config')).toEqual({ host: 'localhost', port: 3004, path: '/api/user-switch/config' });
    });
  });

  describe('browser-agent (3005)', () => {
    it('routes /api/launch', () => {
      expect(getTarget('/api/launch')).toEqual({ host: 'localhost', port: 3005, path: '/api/launch' });
    });

    it('routes /api/record/start', () => {
      expect(getTarget('/api/record/start')).toEqual({ host: 'localhost', port: 3005, path: '/api/record/start' });
    });

    it('routes /api/execute-step', () => {
      expect(getTarget('/api/execute-step')).toEqual({ host: 'localhost', port: 3005, path: '/api/execute-step' });
    });

    it('routes /api/videos', () => {
      expect(getTarget('/api/videos')).toEqual({ host: 'localhost', port: 3005, path: '/api/videos' });
    });

    it('routes /api/video/download?file=test.webm', () => {
      expect(getTarget('/api/video/download?file=test.webm')).toEqual({ host: 'localhost', port: 3005, path: '/api/video/download?file=test.webm' });
    });

    it('routes /api/debug/recordings', () => {
      expect(getTarget('/api/debug/recordings')).toEqual({ host: 'localhost', port: 3005, path: '/api/debug/recordings' });
    });

    it('stripPrefix: /api/agent/health → /health', () => {
      expect(getTarget('/api/agent/health')).toEqual({ host: 'localhost', port: 3005, path: '/health' });
    });
  });

  describe('error handling', () => {
    it('returns null for unknown route', () => {
      expect(getTarget('/api/unknown')).toBeNull();
    });

    it('returns null for root path', () => {
      expect(getTarget('/')).toBeNull();
    });

    it('returns null for health endpoint (not in routes)', () => {
      expect(getTarget('/health')).toBeNull();
    });
  });
});

describe('cleanHeaders', () => {
  it('removes host header', () => {
    const result = cleanHeaders({ host: 'localhost', 'content-type': 'application/json' });
    expect(result).not.toHaveProperty('host');
    expect(result).toHaveProperty('content-type');
  });

  it('removes connection header', () => {
    const result = cleanHeaders({ connection: 'keep-alive', accept: '*/*' });
    expect(result).not.toHaveProperty('connection');
  });

  it('removes keep-alive header', () => {
    const result = cleanHeaders({ 'keep-alive': 'timeout=5', accept: 'application/json' });
    expect(result).not.toHaveProperty('keep-alive');
    expect(result).toHaveProperty('accept');
  });

  it('removes transfer-encoding header', () => {
    const result = cleanHeaders({ 'transfer-encoding': 'chunked' });
    expect(result).not.toHaveProperty('transfer-encoding');
  });

  it('preserves unknown headers', () => {
    const result = cleanHeaders({ authorization: 'Bearer token123', 'x-custom': 'value' });
    expect(result).toEqual({ authorization: 'Bearer token123', 'x-custom': 'value' });
  });

  it('preserves content-type and content-length', () => {
    const result = cleanHeaders({ 'content-type': 'application/json', 'content-length': '42' });
    expect(result).toEqual({ 'content-type': 'application/json', 'content-length': '42' });
  });

  it('case-insensitive header filtering', () => {
    const result = cleanHeaders({ Host: 'localhost', CONNECTION: 'close' });
    expect(result).not.toHaveProperty('Host');
    expect(result).not.toHaveProperty('CONNECTION');
  });
});
