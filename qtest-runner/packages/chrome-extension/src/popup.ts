const $ = (id: string) => document.getElementById(id)!;

// Connection
$('btnConnect')!.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'connect' });
  if (res?.ok) updateUI();
});

$('btnDisconnect')!.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'disconnect' });
  if (res?.ok) updateUI();
});

// Browser
$('btnLaunch')!.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'launch' });
  if (res?.ok) {
    $('browserStatus')!.textContent = 'Browser running';
    $('btnLaunch')!.setAttribute('disabled', 'true');
    $('btnClose')!.removeAttribute('disabled');
  }
});

$('btnClose')!.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'close' });
  if (res?.ok) {
    $('browserStatus')!.textContent = 'Not running';
    $('btnLaunch')!.removeAttribute('disabled');
    $('btnClose')!.setAttribute('disabled', 'true');
  }
});

// Recording
$('btnStartRecord')!.addEventListener('click', async () => {
  $('recordStatus')!.textContent = 'Connecting to recorder...';
  const res = await chrome.runtime.sendMessage({ type: 'startRecording', name: 'Manual Recording' });
  if (res?.ok) {
    $('btnStartRecord')!.setAttribute('disabled', 'true');
    $('btnStopRecord')!.removeAttribute('disabled');
    $('recordStatus')!.textContent = 'Recording...';
  } else {
    $('recordStatus')!.textContent = 'Failed to start recording';
  }
});

$('btnStopRecord')!.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'stopRecording' });
  if (res?.ok) {
    $('btnStartRecord')!.removeAttribute('disabled');
    $('btnStopRecord')!.setAttribute('disabled', 'true');
    $('recordStatus')!.textContent = 'Recording stopped';
  }
});

async function updateUI() {
  const status = await chrome.runtime.sendMessage({ type: 'getStatus' });
  const dot = $('statusDot')!;
  if (status?.connected) {
    dot.className = 'status-dot connected';
    $('connectionStatus')!.textContent = 'Connected to agent';
    $('btnConnect')!.setAttribute('disabled', 'true');
    $('btnDisconnect')!.removeAttribute('disabled');
  } else {
    dot.className = 'status-dot disconnected';
    $('connectionStatus')!.textContent = 'Disconnected';
    $('btnConnect')!.removeAttribute('disabled');
    $('btnDisconnect')!.setAttribute('disabled', 'true');
  }
  if (status?.clientId) {
    $('clientId')!.textContent = status.clientId.slice(-8);
  }
  if (status?.recording) {
    $('recordStatus')!.textContent = 'Recording...';
    $('btnStartRecord')!.setAttribute('disabled', 'true');
    $('btnStopRecord')!.removeAttribute('disabled');
  }
}

chrome.storage.local.get(['wsConnected', 'clientId', 'lastStepResult', 'recording'], (data) => {
  if (data.wsConnected) updateUI();
  if (data.clientId) $('clientId')!.textContent = data.clientId.slice(-8);
  if (data.recording) {
    $('recordStatus')!.textContent = 'Recording...';
    $('btnStartRecord')!.setAttribute('disabled', 'true');
    $('btnStopRecord')!.removeAttribute('disabled');
  }
  if (data.lastStepResult) {
    $('stepSection')!.style.display = 'block';
    $('stepInfo')!.textContent = JSON.stringify(data.lastStepResult);
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.wsConnected) updateUI();
  if (changes.recording) {
    if (changes.recording.newValue) {
      $('recordStatus')!.textContent = 'Recording...';
      $('btnStartRecord')!.setAttribute('disabled', 'true');
      $('btnStopRecord')!.removeAttribute('disabled');
    } else {
      $('recordStatus')!.textContent = 'Recording stopped';
      $('btnStartRecord')!.removeAttribute('disabled');
      $('btnStopRecord')!.setAttribute('disabled', 'true');
    }
  }
  if (changes.lastStepResult) {
    $('stepSection')!.style.display = 'block';
    $('stepInfo')!.textContent = JSON.stringify(changes.lastStepResult.newValue);
  }
});

updateUI();
