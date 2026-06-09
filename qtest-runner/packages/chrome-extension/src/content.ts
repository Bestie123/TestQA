function deepEventTarget(event: Event): Element | null {
  const path = event.composedPath();
  return path && path.length > 0 ? (path[0] as Element) : null;
}

let isCapturing = false;
let sessionId: string | null = null;
const filledValues = new Map<string, string>();

// On load, check if recording is already active (e.g. tab opened after recording started)
chrome.storage.local.get(['recording', 'sessionId'], (result) => {
  if (result.recording && result.sessionId) {
    isCapturing = true;
    sessionId = result.sessionId;
    showIndicator('QTest: Recording...');
  }
});

function getInteractiveParent(el: Element): Element {
  const interactive = ['button', 'a', 'input', 'select', 'textarea', 'label', '[role=button]', '[role=link]', '[role=checkbox]', '[role=radio]'];
  let current = el;
  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    if (interactive.includes(tag)) return current;
    if (current.getAttribute('role') === 'button') return current;
    if (current.hasAttribute('onclick')) return current;
    current = current.parentElement!;
  }
  return el;
}

function getSelector(el: Element): string {
  const target = getInteractiveParent(el);
  const root = target.getRootNode();
  if (root instanceof ShadowRoot) {
    const host = root.host;
    const localSel = target.id ? `#${target.id}` : target.tagName.toLowerCase();
    return `${getSelector(host)} >> ${localSel}`;
  }
  if (target.id) return `#${target.id}`;
  if (target.className && typeof target.className === 'string') {
    const cls = target.className.trim().split(/\s+/).slice(0, 2).join('.');
    if (cls) return `${target.tagName.toLowerCase()}.${cls}`;
  }
  return target.tagName.toLowerCase();
}

function getSelectorText(el: Element): string {
  const target = getInteractiveParent(el);
  const text = target.textContent?.trim().slice(0, 60);
  if (text) return text;
  const input = el as HTMLInputElement;
  if (input.placeholder) return input.placeholder;
  if (input.alt) return input.alt;
  if (input.title) return input.title;
  if (el instanceof HTMLAnchorElement && el.href) return el.href;
  return '';
}

function sendAction(data: any) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    chrome.runtime.sendMessage({ type: 'record:action', sessionId, ...data }).catch(() => {});
  }
}

function handleClick(e: MouseEvent) {
  if (!isCapturing) return;
  const el = deepEventTarget(e);
  if (!el) return;
  const tag = el.tagName.toLowerCase();
  if (tag === 'html' || tag === 'body') return;
  sendAction({
    actionType: 'click',
    selector: getSelector(el),
    selectorText: getSelectorText(el),
    url: location.href,
    pageTitle: document.title,
    timestamp: new Date().toISOString(),
  });
}

const inputTimers = new Map<string, ReturnType<typeof setTimeout>>();

function handleInput(e: Event) {
  if (!isCapturing) return;
  const el = deepEventTarget(e) as HTMLInputElement | HTMLTextAreaElement;
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
  const key = getSelector(el);
  const currentVal = el.value || '';
  // Debounce: wait 400ms after last keystroke before sending
  const existing = inputTimers.get(key);
  if (existing) clearTimeout(existing);
  inputTimers.set(key, setTimeout(() => {
    inputTimers.delete(key);
    const prevVal = filledValues.get(key) || '';
    if (currentVal !== prevVal) {
      filledValues.set(key, currentVal);
      if (currentVal) {
        sendAction({
          actionType: 'fill',
          selector: key,
          selectorText: getSelectorText(el),
          value: currentVal,
          url: location.href,
          pageTitle: document.title,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, 400));
}

function handleChange(e: Event) {
  if (!isCapturing) return;
  const el = deepEventTarget(e) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (!el) return;
  const tag = el.tagName.toLowerCase();

  if (tag === 'select') {
    sendAction({
      actionType: 'select',
      selector: getSelector(el),
      selectorText: getSelectorText(el),
      value: (el as HTMLSelectElement).value,
      url: location.href,
      pageTitle: document.title,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Backup: also fire fill on change (blur) in case debounce missed
  if (tag === 'input' || tag === 'textarea') {
    const existing = inputTimers.get(getSelector(el));
    if (existing) { clearTimeout(existing); inputTimers.delete(getSelector(el)); }
    const key = getSelector(el);
    const currentVal = el.value || '';
    const prevVal = filledValues.get(key) || '';
    if (currentVal !== prevVal) {
      filledValues.set(key, currentVal);
      if (currentVal) {
        sendAction({
          actionType: 'fill',
          selector: key,
          selectorText: getSelectorText(el),
          value: currentVal,
          url: location.href,
          pageTitle: document.title,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
}

function handleSubmit(e: SubmitEvent) {
  if (!isCapturing) return;
  const form = deepEventTarget(e) as HTMLFormElement;
  if (!form) return;
  sendAction({
    actionType: 'submit',
    selector: getSelector(form),
    selectorText: form.id || 'form',
    url: location.href,
    pageTitle: document.title,
    timestamp: new Date().toISOString(),
  });
}

function handleUrlChange() {
  if (!isCapturing) return;
  sendAction({
    actionType: 'navigate',
    selector: '',
    selectorText: location.href,
    url: location.href,
    pageTitle: document.title,
    timestamp: new Date().toISOString(),
  });
}

chrome.runtime.onMessage.addListener((msg: any) => {
  if (!msg || !msg.type) return;
  try {
    switch (msg.type) {
      case 'startCapturing':
        isCapturing = true;
        sessionId = msg.sessionId || null;
        if (sessionId) showIndicator('QTest: Recording...');
        break;
      case 'stopCapturing':
        isCapturing = false;
        sessionId = null;
        filledValues.clear();
        for (const [, t] of inputTimers) clearTimeout(t);
        inputTimers.clear();
        hideIndicator();
        break;
      case 'showIndicator':
        showIndicator(msg.text || 'QTest: выполнение шага...');
        break;
      case 'hideIndicator':
        hideIndicator();
        break;
      case 'highlight':
        highlightElement(msg.selector);
        break;
    }
  } catch (e) {
    // ignore
  }
});

// Listen for postMessage from Web UI RecorderPage
window.addEventListener('message', (event) => {
  if (event.data?.type === 'startRecording' && event.data?.sessionId) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({ type: 'startRecordingWithSession', sessionId: event.data.sessionId });
    }
  }
  if (event.data?.type === 'stopRecording') {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({ type: 'stopRecording' });
    }
    isCapturing = false;
    sessionId = null;
    filledValues.clear();
    for (const [, t] of inputTimers) clearTimeout(t);
    inputTimers.clear();
    hideIndicator();
  }
});

function showIndicator(text: string) {
  let container = document.getElementById('qtest-indicator');
  if (!container) {
    container = document.createElement('div');
    container.id = 'qtest-indicator';
    document.body.prepend(container);
  }
  container.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:#4caf50;display:inline-block;"></span> ${text}`;
  container.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
    background: #1976d2; color: white; padding: 8px 16px;
    font-family: system-ui, sans-serif; font-size: 14px;
    text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  `;
}

function hideIndicator() {
  const el = document.getElementById('qtest-indicator');
  if (el) el.remove();
}

function highlightElement(selector: string) {
  const el = document.querySelector(selector) as HTMLElement;
  if (!el) return;
  el.style.outline = '3px solid #f44336';
  el.style.outlineOffset = '2px';
  setTimeout(() => {
    el.style.outline = '';
    el.style.outlineOffset = '';
  }, 2000);
}

// Listen for navigation (SPA and regular)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    handleUrlChange();
  }
}).observe(document, { subtree: true, childList: true });

window.addEventListener('popstate', handleUrlChange);
window.addEventListener('hashchange', handleUrlChange);
document.addEventListener('click', handleClick, true);
document.addEventListener('input', handleInput, true);
document.addEventListener('change', handleChange, true);
document.addEventListener('submit', handleSubmit, true);
