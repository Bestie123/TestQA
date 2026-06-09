import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as http from 'http';

// ── Hoisted: set env + create mock refs before module import ──
const {
  mockExecuteStep, mockGetSession, mockParseStep, mockCreateProfile,
  mockLaunchSession, mockCloseSession, mockListVideos, mockGetVideoPath,
  mockStartRecording, mockStopRecording, mockIsRecording, mockListProfiles,
  mockGetRecordingsDebug, mockPushAction, mockGetSessionIdForProfile,
  mockGetProfile,
} = vi.hoisted(() => {
  process.env.AGENT_PORT = '19007';
  return {
    mockExecuteStep: vi.fn(),
    mockGetSession: vi.fn(),
    mockParseStep: vi.fn(),
    mockCreateProfile: vi.fn(),
    mockLaunchSession: vi.fn(),
    mockCloseSession: vi.fn(),
    mockListVideos: vi.fn(() => []),
    mockGetVideoPath: vi.fn(),
    mockStartRecording: vi.fn(),
    mockStopRecording: vi.fn(),
    mockIsRecording: vi.fn(),
    mockListProfiles: vi.fn(() => []),
    mockGetRecordingsDebug: vi.fn(() => ({})),
    mockPushAction: vi.fn(),
    mockGetSessionIdForProfile: vi.fn(),
    mockGetProfile: vi.fn(),
  };
});

vi.mock('../browser-manager', () => ({
  getSession: mockGetSession,
  launchSession: mockLaunchSession,
  closeSession: mockCloseSession,
  listVideos: mockListVideos,
  getVideoPath: mockGetVideoPath,
  videoDir: '/tmp/videos',
}));
vi.mock('../profile-manager', () => ({
  createProfile: mockCreateProfile,
  listProfiles: mockListProfiles,
  getProfile: mockGetProfile,
}));
vi.mock('../executor', () => ({
  executeStep: mockExecuteStep,
}));
vi.mock('../action-parser', () => ({
  parseStep: mockParseStep,
}));
vi.mock('../recorder', () => ({
  startRecording: mockStartRecording,
  stopRecording: mockStopRecording,
  isRecording: mockIsRecording,
  getRecordingsDebug: mockGetRecordingsDebug,
  pushAction: mockPushAction,
  getSessionIdForProfile: mockGetSessionIdForProfile,
}));

// ── Import module AFTER mocks are set up ──
import { startWSServer, httpServer, clients } from '../ws-server';

function req(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: 19007,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const r = http.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        let data: any;
        try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { data = null; }
        resolve({ status: res.statusCode || 0, data });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const fakeSession = Object.create(null);

beforeAll(() => {
  startWSServer();
});

afterAll(() => {
  httpServer.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Basic endpoints ──
describe('GET /health', () => {
  it('returns ok status', async () => {
    const { status, data } = await req('GET', '/health');
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.service).toBe('browser-agent');
  });
});

describe('GET /api/videos', () => {
  it('returns video list', async () => {
    const { status, data } = await req('GET', '/api/videos');
    expect(status).toBe(200);
    expect(data.videos).toEqual([]);
  });
});

describe('GET /api/profiles', () => {
  it('returns profile list', async () => {
    const { status, data } = await req('GET', '/api/profiles');
    expect(status).toBe(200);
    expect(data).toEqual([]);
  });
});

describe('404', () => {
  it('returns 404 for unknown path', async () => {
    const { status, data } = await req('GET', '/api/nonexistent');
    expect(status).toBe(404);
    expect(data.error).toBe('Not found');
  });
});

// ── /api/execute-step ──
describe('POST /api/execute-step', () => {
  it('returns 400 when no session', async () => {
    mockGetSession.mockReturnValue(null);
    const { status } = await req('POST', '/api/execute-step', { action: 'click' });
    expect(status).toBe(400);
  });

  it('executes parseStep result and returns commands+results', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([{ action: 'click' }]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    const { status, data } = await req('POST', '/api/execute-step', { action: 'click', profileId: 'p1' });
    expect(status).toBe(200);
    expect(data.commands).toHaveLength(1);
    expect(data.commands[0].action).toBe('click');
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toBe('success');
    expect(mockExecuteStep).toHaveBeenCalledOnce();
  });

  it('forwards body.selector to commands without own selector', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([{ action: 'click' }]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    const { status, data } = await req('POST', '/api/execute-step', { action: 'click', selector: '#btn', profileId: 'p1' });
    expect(status).toBe(200);
    expect(data.commands[0].selector).toBe('#btn');
  });

  it('forwards body.url to navigate command', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([{ action: 'navigate' }]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    await req('POST', '/api/execute-step', { action: 'navigate', url: 'https://example.com', profileId: 'p1' });
    const cmd = mockExecuteStep.mock.calls[0][1];
    expect(cmd.action).toBe('navigate');
    expect(cmd.url).toBe('https://example.com');
  });

  it('forwards body.text to assertText command', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([{ action: 'assertText' }]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    await req('POST', '/api/execute-step', { action: 'assertText', text: 'hello', profileId: 'p1' });
    const cmd = mockExecuteStep.mock.calls[0][1];
    expect(cmd.text).toBe('hello');
  });

  it('forwards body.key to keypress command', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([{ action: 'keypress' }]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    await req('POST', '/api/execute-step', { action: 'press', key: 'Tab', profileId: 'p1' });
    const cmd = mockExecuteStep.mock.calls[0][1];
    expect(cmd.action).toBe('keypress');
    expect(cmd.value).toBe('Tab');
  });

  it('creates keypress command from body.key when no commands returned', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    await req('POST', '/api/execute-step', { action: 'press', key: 'Escape', profileId: 'p1' });
    const cmd = mockExecuteStep.mock.calls[0][1];
    expect(cmd.action).toBe('keypress');
    expect(cmd.value).toBe('Escape');
  });

  it('forwards frame metadata to all commands', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([{ action: 'click' }, { action: 'fill', value: 'x' }]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    const { data } = await req('POST', '/api/execute-step', {
      action: 'click', frameName: 'myframe', frameUrl: 'https://frame.com', profileId: 'p1',
    });
    for (const cmd of data.commands) {
      expect(cmd.frameName).toBe('myframe');
      expect(cmd.frameUrl).toBe('https://frame.com');
    }
  });

  it('creates click command from body.action + body.selector when parseStep returns nothing', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    await req('POST', '/api/execute-step', { action: 'click', selector: '.btn', x: 10, y: 20, profileId: 'p1' });
    const cmd = mockExecuteStep.mock.calls[0][1];
    expect(cmd.action).toBe('click');
    expect(cmd.selector).toBe('.btn');
    expect(cmd.x).toBe(10);
    expect(cmd.y).toBe(20);
  });

  it('creates fill command from action+selector when parseStep returns nothing', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([]);
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    await req('POST', '/api/execute-step', { action: 'fill', selector: '#input', value: 'test', profileId: 'p1' });
    const cmd = mockExecuteStep.mock.calls[0][1];
    expect(cmd.action).toBe('fill');
    expect(cmd.selector).toBe('#input');
    expect(cmd.value).toBe('test');
  });

  it('stops on first failed command', async () => {
    mockGetSession.mockReturnValue(fakeSession);
    mockParseStep.mockReturnValue([{ action: 'click' }, { action: 'fill', value: 'x' }]);
    mockExecuteStep
      .mockResolvedValueOnce({ status: 'failed', error: 'oh no' })
      .mockResolvedValueOnce({ status: 'success' });

    const { data } = await req('POST', '/api/execute-step', { action: 'click', profileId: 'p1' });
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toBe('failed');
    expect(mockExecuteStep).toHaveBeenCalledTimes(1);
  });
});

// ── WebSocket handleMessage ──
describe('handleMessage', () => {
  beforeEach(() => {
    clients.set('c1', { ws: { send: vi.fn() } as any, clientId: 'c1', profileId: 'p1' });
  });

  afterEach(() => {
    clients.delete('c1');
  });

  it('routes launch message', async () => {
    mockCreateProfile.mockReturnValue({ id: 'p1', name: 'Test' });
    mockLaunchSession.mockResolvedValue(undefined);

    const ws = { send: vi.fn() } as any;
    clients.set('c2', { ws, clientId: 'c2', profileId: null });
    const { handleMessage } = await import('../ws-server');
    await handleMessage('c2', { type: 'launch', profileName: 'Test' }, ws);

    expect(mockCreateProfile).toHaveBeenCalledWith('Test', './chrome-data/Test');
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'launched', profileId: 'p1' }));
    clients.delete('c2');
  });

  it('routes execute message', async () => {
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    const ws = { send: vi.fn() } as any;
    const { handleMessage } = await import('../ws-server');
    await handleMessage('c1', { type: 'execute', commands: [{ action: 'click' }] }, ws);

    expect(mockExecuteStep).toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"executed"'));
  });

  it('routes navigate message', async () => {
    mockExecuteStep.mockResolvedValue({ status: 'success' });

    const ws = { send: vi.fn() } as any;
    const { handleMessage } = await import('../ws-server');
    await handleMessage('c1', { type: 'navigate', url: 'https://x.com' }, ws);

    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"step:result"'));
  });

  it('rejects unknown message type', async () => {
    const ws = { send: vi.fn() } as any;
    const { handleMessage } = await import('../ws-server');
    await handleMessage('c1', { type: 'bogus' }, ws);

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'error', message: 'Unknown type: bogus' }));
  });
});
