// QTest Runner — Background Service Worker
// Maintains WebSocket connection to Desktop Agent (browser-agent)

const WS_URL = 'ws://localhost:3005';
const RECONNECT_DELAY = 3000;

let ws = null;
let clientId = null;
let reconnectTimer = null;
let isConnected = false;

// Store current execution state
let state = {
  status: 'idle',
  testCaseKey: null,
  executionId: null,
  currentStep: null,
  totalSteps: 0,
  stepResults: [],
};

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      isConnected = true;
      notifyClients({ type: 'connection', connected: true });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('[QTest] Invalid message:', e);
      }
    };

    ws.onclose = () => {
      isConnected = false;
      notifyClients({ type: 'connection', connected: false });
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  } catch (e) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'connected':
      clientId = msg.clientId;
      notifyClients({ type: 'connected', clientId });
      break;

    case 'launched':
      notifyClients({ type: 'launched', profileId: msg.profileId });
      break;

    case 'executed':
      notifyClients({ type: 'executed', results: msg.results });
      break;

    case 'step:result':
      notifyClients({ type: 'step:result', status: msg.status, screenshot: msg.screenshot, error: msg.error });
      break;

    case 'closed':
      notifyClients({ type: 'closed' });
      break;

    case 'error':
      notifyClients({ type: 'error', message: msg.message });
      break;
  }
}

function notifyClients(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'getState':
      sendResponse({ connected: isConnected, clientId, state });
      break;

    case 'launch':
      send({ type: 'launch', profileName: msg.profileName, userDataDir: msg.userDataDir });
      sendResponse({ ok: true });
      break;

    case 'navigate':
      send({ type: 'navigate', url: msg.url });
      sendResponse({ ok: true });
      break;

    case 'click':
      send({ type: 'click', selector: msg.selector });
      sendResponse({ ok: true });
      break;

    case 'fill':
      send({ type: 'fill', selector: msg.selector, value: msg.value });
      sendResponse({ ok: true });
      break;

    case 'screenshot':
      send({ type: 'screenshot' });
      sendResponse({ ok: true });
      break;

    case 'verify':
      send({ type: 'verify', text: msg.text });
      sendResponse({ ok: true });
      break;

    case 'close':
      send({ type: 'close' });
      sendResponse({ ok: true });
      break;

    case 'setState':
      if (msg.state) Object.assign(state, msg.state);
      sendResponse({ ok: true });
      break;
  }
  return true;
});

// Connect on install/startup
chrome.runtime.onStartup.addListener(() => connect());
chrome.runtime.onInstalled.addListener(() => connect());
connect();
