// QTest Runner — Background Service Worker (Manifest V3)
// WebSocket client for browser-agent + recorder-service

let agentWs: WebSocket | null = null;
let recorderWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let recorderReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let clientId: string | null = null;
let currentSessionId: string | null = null;
let pendingActions: any[] = [];

const AGENT_WS = 'ws://localhost:3005';
const RECORDER_WS = 'ws://localhost:3004';

function connectAgent() {
  if (agentWs?.readyState === WebSocket.OPEN || agentWs?.readyState === WebSocket.CONNECTING) return;
  try {
    agentWs = new WebSocket(AGENT_WS);
  } catch {
    scheduleReconnect();
    return;
  }
  agentWs.onopen = () => {
    chrome.storage.local.set({ wsConnected: true, clientId });
  };
  agentWs.onmessage = (event) => {
    let msg: any;
    try { msg = JSON.parse(event.data); } catch { return; }
    switch (msg.type) {
      case 'connected':
        clientId = msg.clientId;
        chrome.storage.local.set({ clientId: msg.clientId });
        break;
      case 'step:result':
        chrome.storage.local.set({ lastStepResult: msg });
        break;
      case 'error':
        chrome.storage.local.set({ lastError: msg.message });
        break;
    }
    chrome.runtime.sendMessage(msg).catch(() => {});
  };
  agentWs.onclose = () => {
    agentWs = null;
    chrome.storage.local.set({ wsConnected: false });
    scheduleReconnect();
  };
  agentWs.onerror = () => agentWs?.close();
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectAgent, 3000);
}

function sendToAgent(msg: any) {
  if (agentWs?.readyState === WebSocket.OPEN) {
    agentWs.send(JSON.stringify(msg));
  }
}

function connectRecorder() {
  if (recorderWs?.readyState === WebSocket.OPEN || recorderWs?.readyState === WebSocket.CONNECTING) return;
  try {
    recorderWs = new WebSocket(RECORDER_WS);
  } catch { scheduleRecorderReconnect(); return; }
  recorderWs.onopen = () => {
    // Flush any pending actions that arrived before WS was ready
    if (pendingActions.length > 0) {
      for (const a of pendingActions) {
        recorderWs!.send(JSON.stringify(a));
      }
      pendingActions = [];
    }
  };
  recorderWs.onmessage = (event) => {
    let msg: any;
    try { msg = JSON.parse(event.data); } catch { return; }
    chrome.runtime.sendMessage(msg).catch(() => {});
  };
  recorderWs.onclose = () => {
    recorderWs = null;
    if (currentSessionId) scheduleRecorderReconnect();
  };
  recorderWs.onerror = () => recorderWs?.close();
}

function scheduleRecorderReconnect() {
  if (recorderReconnectTimer) clearTimeout(recorderReconnectTimer);
  recorderReconnectTimer = setTimeout(connectRecorder, 2000);
}

function sendToRecorder(msg: any) {
  if (recorderWs?.readyState === WebSocket.OPEN) {
    recorderWs.send(JSON.stringify(msg));
  }
}

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  switch (msg.type) {
    case 'connect':
      connectAgent();
      sendResponse({ ok: true });
      break;

    case 'disconnect':
      if (agentWs) { agentWs.close(); agentWs = null; }
      chrome.storage.local.set({ wsConnected: false });
      sendResponse({ ok: true });
      break;

    case 'launch':
    case 'navigate':
    case 'click':
    case 'fill':
    case 'verify':
    case 'screenshot':
    case 'execute':
    case 'close':
      sendToAgent(msg);
      sendResponse({ ok: true });
      break;

    case 'getStatus':
      sendResponse({
        connected: agentWs?.readyState === WebSocket.OPEN,
        clientId,
        recording: currentSessionId !== null,
        sessionId: currentSessionId,
      });
      break;

    // ── Recording ──
    case 'startRecording':
      connectRecorder();
      setTimeout(() => {
        sendToRecorder({ type: 'record:start', name: msg.name || 'Recorded', profileId: msg.profileId || '' });
      }, 500);
      sendResponse({ ok: true });
      break;

    // Start recording with an existing session (created via HTTP from Web UI)
    case 'startRecordingWithSession':
      currentSessionId = msg.sessionId;
      connectRecorder();
      chrome.storage.local.set({ recording: true, sessionId: msg.sessionId });
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id!, { type: 'startCapturing', sessionId: msg.sessionId }).catch(() => {});
        }
      });
      sendResponse({ ok: true });
      break;

    case 'stopRecording':
      if (currentSessionId) {
        sendToRecorder({ type: 'record:stop', sessionId: currentSessionId });
        chrome.tabs.query({}, (tabs) => {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id!, { type: 'stopCapturing' }).catch(() => {});
          }
        });
        currentSessionId = null;
        chrome.storage.local.set({ recording: false, sessionId: null });
      }
      sendResponse({ ok: true });
      break;

    // Forward captured action from content script to recorder-service
    case 'record:action':
      if (currentSessionId) {
        if (recorderWs?.readyState === WebSocket.OPEN) {
          sendToRecorder(msg);
        } else {
          if (!recorderWs || recorderWs.readyState === WebSocket.CLOSED) connectRecorder();
          pendingActions.push(msg);
        }
      }
      sendResponse({ ok: true });
      break;

    // Listen for recording:started from recorder-service
    case 'recording:started':
      currentSessionId = msg.sessionId;
      chrome.storage.local.set({ recording: true, sessionId: msg.sessionId });
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id!, { type: 'startCapturing', sessionId: msg.sessionId }).catch(() => {});
        }
      });
      sendResponse({ ok: true });
      break;

    case 'recording:stopped':
      currentSessionId = null;
      chrome.storage.local.set({ recording: false, sessionId: null });
      sendResponse({ ok: true });
      break;
  }
});

chrome.runtime.onInstalled.addListener(() => connectAgent());
chrome.runtime.onStartup.addListener(() => connectAgent());
