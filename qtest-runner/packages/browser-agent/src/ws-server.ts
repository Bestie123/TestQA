import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { launchSession, closeSession, getSession, listVideos, getVideoPath, videoDir } from './browser-manager';
import { createProfile, listProfiles, getProfile } from './profile-manager';
import { executeStep, StepCommand } from './executor';
import { parseStep } from './action-parser';
import { startRecording as recStart, stopRecording as recStop, isRecording, getRecordingsDebug, pushAction, getSessionIdForProfile } from './recorder';

const PORT = parseInt(process.env.AGENT_PORT || '3005', 10);

interface ClientInfo {
  ws: WebSocket;
  clientId: string;
  profileId: string | null;
}

const clients: Map<string, ClientInfo> = new Map();
let defaultProfileId: string | null = null;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

function json(res: ServerResponse, code: number, data: any) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const httpServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url || '';

  if (url === '/health' && req.method === 'GET') {
    json(res, 200, { status: 'ok', service: 'browser-agent', clients: clients.size, hasSession: !!defaultProfileId });
    return;
  }

  if (url === '/api/profiles' && req.method === 'GET') {
    json(res, 200, listProfiles());
    return;
  }

  // Auto-launch a default session
  if (url === '/api/launch' && req.method === 'POST') {
    try {
      if (defaultProfileId) {
        const existing = getSession(defaultProfileId);
        if (existing) {
          // Check if browser context is still alive
          try {
            await existing.page.evaluate('1+1');
            json(res, 200, { profileId: defaultProfileId, alreadyRunning: true });
            return;
          } catch {
            // Browser was killed, clean up stale session
            defaultProfileId = null;
          }
        } else {
          defaultProfileId = null;
        }
      }
      const body = JSON.parse(await readBody(req));
      const profileName = body.profileName || 'Auto';
      const userDataDir = body.userDataDir || `./chrome-data/${profileName}`;
      const profile = createProfile(profileName, userDataDir);
      await launchSession(profile);
      defaultProfileId = profile.id;
      json(res, 201, { profileId: profile.id });
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  // Execute a step by parsing the action text
  if (url === '/api/execute-step' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const profileId = body.profileId || defaultProfileId;
      if (!profileId || !getSession(profileId)) {
        json(res, 400, { error: 'No active browser session. Launch first (POST /api/launch).' });
        return;
      }
      const commands = parseStep(body.action || '', body.testData || body.value || '', body.expectedResult || '');
      // Forward body.value to commands that need it (fill, select)
      if (body.value !== undefined) {
        for (const cmd of commands) {
          if (cmd.action === 'fill' || cmd.action === 'select') {
            cmd.value = body.value;
          }
        }
      }
      // Forward body.url to navigate commands (or create navigate command if none)
      if (body.url) {
        let hasNavigate = false;
        for (const cmd of commands) {
          if (cmd.action === 'navigate') {
            cmd.url = body.url;
            hasNavigate = true;
          }
        }
        if (!hasNavigate && body.action === 'navigate') {
          commands.push({ action: 'navigate', url: body.url });
        }
      }
      // Forward body.selector to selector-using commands (only if cmd has no own selector)
      if (body.selector) {
        const selectorActions = ['click', 'fill', 'select', 'hover', 'assertText', 'assertVisible', 'assertValue', 'assertChecked', 'waitForSelector', 'fileUpload', 'dragTo', 'drag'];
        for (const cmd of commands) {
          if (selectorActions.includes(cmd.action) && !cmd.selector) {
            cmd.selector = body.selector;
          }
        }
        // If no commands created but we have a selector, create the appropriate command
        if (commands.length === 0 && body.action) {
          if (body.action === 'click' || body.action === 'hover' || body.action === 'canvas_click') {
            commands.push({ action: 'click', selector: body.selector, x: body.x, y: body.y });
          } else if (body.action === 'dblclick') {
            commands.push({ action: 'dblclick', selector: body.selector });
          } else if (body.action === 'rightClick' || body.action === 'contextmenu') {
            commands.push({ action: 'rightClick', selector: body.selector });
          } else if (body.action === 'fill') {
            commands.push({ action: 'fill', selector: body.selector, value: body.value || '' });
          } else if (body.action === 'select') {
            commands.push({ action: 'select', selector: body.selector, value: body.value || '' });
          } else if (body.action === 'assertText' || body.action === 'assertVisible' || body.action === 'assertValue' || body.action === 'assertChecked') {
            commands.push({ action: body.action, selector: body.selector, text: body.text || body.value, value: body.value });
          } else if (body.action === 'waitForSelector') {
            commands.push({ action: 'waitForSelector', selector: body.selector });
          } else if (body.action === 'fileUpload' || body.action === 'setInputFiles') {
            commands.push({ action: 'fileUpload', selector: body.selector, file: body.value || '' });
          }
        }
      }
      // Forward body.text to assert*/verify commands
      if (body.text) {
        for (const cmd of commands) {
          if (cmd.action === 'assertText' || cmd.action === 'assertVisible' || cmd.action === 'assertUrl' || cmd.action === 'verify') {
            cmd.text = body.text;
          }
          if (cmd.action === 'assertValue' || cmd.action === 'assertChecked') {
            cmd.value = body.text;
          }
        }
      }
      // Forward body.key to keypress commands
      if (body.key) {
        for (const cmd of commands) {
          if (cmd.action === 'keypress') {
            cmd.value = body.key;
          }
        }
        if (commands.length === 0 && (body.action === 'keypress' || body.action === 'press')) {
          commands.push({ action: 'keypress', value: body.key });
        }
      }
      // Forward frame metadata to all commands
      if (body.frameName || body.frameUrl || body.frameSelector) {
        for (const cmd of commands) {
          if (body.frameName) cmd.frameName = body.frameName;
          if (body.frameUrl) cmd.frameUrl = body.frameUrl;
          if (body.frameSelector) cmd.frameSelector = body.frameSelector;
        }
      }
      const results = [];
      for (const cmd of commands) {
        const result = await executeStep(profileId, cmd);
        results.push(result);
        if (result.status === 'failed') break;
      }
      json(res, 200, { commands, results });
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  // ── Recording ──
  if (url === '/api/record/start' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const { profileId, sessionId, recorderUrl } = body;
      if (!profileId || !sessionId || !recorderUrl) {
        json(res, 400, { error: 'profileId, sessionId, recorderUrl required' });
        return;
      }
      // Verify browser context is alive before starting recording
      const session = getSession(profileId);
      if (!session) {
        json(res, 400, { error: 'Browser session not found. Please relaunch the browser from the Recorder page.' });
        return;
      }
      try {
        await session.page.evaluate('1+1');
      } catch {
        json(res, 400, { error: 'Browser was closed. Please relaunch the browser from the Recorder page.' });
        return;
      }
      await recStart(profileId, sessionId, recorderUrl);
      json(res, 200, { ok: true, sessionId });
    } catch (err: any) {
      console.error(`[ws-server] /api/record/start FAILED:`, err.message, err.stack);
      json(res, 500, { error: err.message });
    }
    return;
  }

  if (url === '/api/debug/recordings' && req.method === 'GET') {
    json(res, 200, getRecordingsDebug());
    return;
  }

  if (url === '/api/record/stop' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const { sessionId } = body;
      if (!sessionId) { json(res, 400, { error: 'sessionId required' }); return; }
      const videoPath = await recStop(sessionId);
      json(res, 200, { ok: true, sessionId, videoPath: videoPath || null });
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  // ── User Switch — trigger programmatic user switch ──
  if (url === '/api/user-switch/switch' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const { sessionId, profileId, toUser } = body;
      if (!sessionId && !profileId) { json(res, 400, { error: 'sessionId or profileId required' }); return; }
      if (profileId) {
        const sid = getSessionIdForProfile(profileId);
        if (sid) {
          pushAction(sid, { actionType: 'user_switch', value: toUser || 'next', selectorText: 'programmatic', url: '', timestamp: new Date().toISOString() });
          json(res, 200, { ok: true, sessionId: sid, toUser: toUser || 'next' });
        } else {
          json(res, 400, { error: 'No active recording for profile' });
        }
      } else {
        pushAction(sessionId, { actionType: 'user_switch', value: toUser || 'next', selectorText: 'programmatic', url: '', timestamp: new Date().toISOString() });
        json(res, 200, { ok: true, sessionId, toUser: toUser || 'next' });
      }
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  // ── Video recording endpoints ──
  if (url === '/api/videos' && req.method === 'GET') {
    json(res, 200, { videos: listVideos() });
    return;
  }

  if (url === '/api/video/download' && req.method === 'GET') {
    try {
      const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
      const fileName = parsedUrl.searchParams.get('file') || '';
      if (!fileName) { json(res, 400, { error: 'file parameter required' }); return; }
      const fs = require('fs');
      const path = require('path');
      const safePath = path.resolve(videoDir, path.basename(fileName));
      if (!safePath.startsWith(path.resolve(videoDir))) { json(res, 403, { error: 'Forbidden' }); return; }
      if (!fs.existsSync(safePath)) { json(res, 404, { error: 'File not found' }); return; }
      const stat = fs.statSync(safePath);
      res.writeHead(200, {
        'Content-Type': 'video/webm',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });
      fs.createReadStream(safePath).pipe(res);
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  if (url === '/api/video/path' && req.method === 'GET') {
    try {
      if (!defaultProfileId) { json(res, 400, { error: 'No active session' }); return; }
      const session = getSession(defaultProfileId);
      if (!session) { json(res, 400, { error: 'Session not found' }); return; }
      const path = await getVideoPath(session.page);
      json(res, 200, { path: path || null });
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  json(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  const clientId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const info: ClientInfo = { ws, clientId, profileId: null };
  clients.set(clientId, info);

  ws.send(JSON.stringify({ type: 'connected', clientId }));

  ws.on('message', async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    try {
      await handleMessage(clientId, msg, ws);
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    if (info.profileId) {
      closeSession(info.profileId).catch(() => {});
    }
    clients.delete(clientId);
  });
});

async function handleMessage(clientId: string, msg: any, ws: WebSocket) {
  const info = clients.get(clientId)!;

  switch (msg.type) {
    case 'launch': {
      const profileName = msg.profileName || 'Default';
      const userDataDir = msg.userDataDir || `./chrome-data/${profileName}`;
      const profile = createProfile(profileName, userDataDir);
      await launchSession(profile);
      info.profileId = profile.id;
      ws.send(JSON.stringify({ type: 'launched', profileId: profile.id }));
      break;
    }

    case 'execute': {
      if (!info.profileId) {
        ws.send(JSON.stringify({ type: 'error', message: 'No active session. Launch first.' }));
        return;
      }
      const commands: StepCommand[] = msg.commands || [];
      const results = [];
      for (const cmd of commands) {
        const result = await executeStep(info.profileId, cmd);
        results.push(result);
      }
      ws.send(JSON.stringify({ type: 'executed', results }));
      break;
    }

    case 'navigate': {
      if (!info.profileId) throw new Error('No active session');
      const result = await executeStep(info.profileId, { action: 'navigate', url: msg.url });
      ws.send(JSON.stringify({ type: 'step:result', ...result }));
      break;
    }

    case 'click': {
      if (!info.profileId) throw new Error('No active session');
      const result = await executeStep(info.profileId, { action: 'click', selector: msg.selector });
      ws.send(JSON.stringify({ type: 'step:result', ...result }));
      break;
    }

    case 'fill': {
      if (!info.profileId) throw new Error('No active session');
      const result = await executeStep(info.profileId, { action: 'fill', selector: msg.selector, value: msg.value });
      ws.send(JSON.stringify({ type: 'step:result', ...result }));
      break;
    }

    case 'screenshot': {
      if (!info.profileId) throw new Error('No active session');
      const result = await executeStep(info.profileId, { action: 'screenshot' });
      ws.send(JSON.stringify({ type: 'step:result', ...result }));
      break;
    }

    case 'verify': {
      if (!info.profileId) throw new Error('No active session');
      const result = await executeStep(info.profileId, { action: 'verify', text: msg.text });
      ws.send(JSON.stringify({ type: 'step:result', ...result }));
      break;
    }

    case 'close': {
      if (info.profileId) {
        await closeSession(info.profileId);
        info.profileId = null;
      }
      ws.send(JSON.stringify({ type: 'closed' }));
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown type: ${msg.type}` }));
  }
}

function gracefulShutdown(signal: string) {
  console.log(`[${signal}] Shutting down browser-agent...`);
  wss.clients.forEach((client) => client.close());
  httpServer.close(() => {
    console.log('browser-agent stopped');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));

export function startWSServer(): void {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`browser-agent WebSocket running on port ${PORT}`);
  });
}

// Exported for testing
export { httpServer, handleMessage, clients };

