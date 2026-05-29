import http from 'http';
import { Page, Frame } from 'playwright';
import { getSession } from './browser-manager';
import {
  SHADOW_DOM_HELPER, IFRAME_HELPER, SPA_NAV_HELPER, ERROR_TRACKER_HELPER,
  ASSERTION_HELPER, JIRA_DETECTOR_HELPER,
  COOKIE_CONSENT_HELPER,
  TOUCH_WHEEL_HELPER, ANIMATION_HELPER, LIFECYCLE_HELPER,
  CAPTCHA_DETECTOR_HELPER,
  FILE_UPLOAD_HELPER, USER_SWITCH_HELPER, POPOVER_HELPER, MEDIA_EVENTS_HELPER,
  IME_COMPOSITION_HELPER,
} from './inject-helpers';

interface Recording {
  profileId: string;
  sessionId: string;
  pendingActions: any[];
  flushTimer: ReturnType<typeof setInterval> | null;
  recorderUrl: string;
  listeners: (() => void)[];
}

const recordings = new Map<string, Recording>();

// ══════════════════════════════════════════════════════════════
// INJECT_SCRIPT — полный набор DOM-событий + overlay + console
// ══════════════════════════════════════════════════════════════
const INJECT_SCRIPT = `(function __qtestInject() {
  if (window.__qtestRecorderInjected) return;

  // Defer to DOMContentLoaded if body not ready yet (addInitScript runs before DOM)
  if (document.body === null) {
    document.addEventListener('DOMContentLoaded', __qtestInject);
    return;
  }

  window.__qtestRecorderInjected = true;
  try { __setupRecorder(); } catch(e) {}

  function __setupRecorder() {

  var __filledValues = {};
  var __inputTimers = {};
  var __observer = null;
  var __logEntries = [];
  var __MAX_LOG_ENTRIES = 200;

  // ── Helper: get text from element ──
  function __getText(el) {
    if (!el) return "";
    var text = "";
    if (el.textContent) text = el.textContent.trim().slice(0, 80);
    if (!text && el.innerText) text = el.innerText.trim().slice(0, 80);
    return text;
  }

  function __getAriaLabel(el) {
    if (!el) return "";
    return el.getAttribute("aria-label") || el.getAttribute("aria-describedby") || el.getAttribute("title") || "";
  }

${SHADOW_DOM_HELPER}
  ${IFRAME_HELPER}
  ${SPA_NAV_HELPER}
  ${ERROR_TRACKER_HELPER}
  ${ASSERTION_HELPER}
  ${JIRA_DETECTOR_HELPER}
  ${COOKIE_CONSENT_HELPER}
  ${CAPTCHA_DETECTOR_HELPER}
  ${TOUCH_WHEEL_HELPER}
  ${ANIMATION_HELPER}
  ${LIFECYCLE_HELPER}
  ${FILE_UPLOAD_HELPER}
  ${USER_SWITCH_HELPER}
  ${POPOVER_HELPER}
  ${MEDIA_EVENTS_HELPER}
  ${IME_COMPOSITION_HELPER}

  // ── Record action ──
  function __record(data) {
    data.url = location.href;
    data.pageTitle = document.title;
    data.timestamp = new Date().toISOString();
    data.tabId = window.__qtestTabId || "";
    // Channel 1: console.debug (always available, caught by page.on('console'))
    try { console.debug("__QTEST_ACTION__" + JSON.stringify(data)); } catch(e) {}
    // Channel 2: window.__recordAction (if exposed via exposeFunction)
    try { if (window.__recordAction) window.__recordAction(data); } catch(e) {}
  }

  // ── iframe bridge (postMessage for cross-origin iframes) ──
  (function() {
    if (window !== window.top) {
      var __origRecord = __record;
      var __frameName = window.name || '';
      __record = function(data) {
        data.frameUrl = location.href;
        data.frameName = __frameName;
        data.iframeAction = true;
        __origRecord(data);
        try { window.parent.postMessage({__qtestAction: true, data: data, frameUrl: location.href}, '*'); } catch(e) {}
      };
    } else {
      window.addEventListener('message', function(event) {
        try {
          if (!event.data || !event.data.__qtestAction) return;
          var actionData = event.data.data;
          for (var fi = 0; fi < document.querySelectorAll('iframe').length; fi++) {
            try {
              var ifr = document.querySelectorAll('iframe')[fi];
              if (ifr.contentWindow === event.source) {
                actionData.frameUrl = event.data.frameUrl || '';
                actionData.frameName = ifr.name || ifr.id || '';
                actionData.iframeAction = true;
                __record(actionData);
                break;
              }
            } catch(e) {}
          }
        } catch(e) {}
      }, true);
    }
  })();

  // ── Overlay UI ──
  function __createOverlay() {
    if (document.getElementById("qtest-log-overlay")) return;
    var overlay = document.createElement("div");
    overlay.id = "qtest-log-overlay";
    overlay.style.cssText = "position:fixed;bottom:0;right:0;width:420px;max-height:280px;background:rgba(0,0,0,0.88);color:#0f0;font-family:monospace;font-size:11px;z-index:2147483647;overflow:hidden;border-top-left-radius:8px;box-shadow:0 -2px 12px rgba(0,0,0,0.5);display:flex;flex-direction:column;";
    var header = document.createElement("div");
    header.style.cssText = "padding:4px 8px;background:#1a1a2e;color:#e94560;font-weight:bold;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;";
    header.innerHTML = '<span>QTest Recorder Log</span><span id="qtest-log-count" style="color:#888;font-size:10px;">0</span>';
    var body = document.createElement("div");
    body.id = "qtest-log-body";
    body.style.cssText = "overflow-y:auto;flex:1;padding:2px 4px;";
    overlay.appendChild(header);
    overlay.appendChild(body);
    document.body.appendChild(overlay);

    // Drag support
    var isDragging = false, startX, startY, startLeft, startBottom;
    header.onmousedown = function(e) {
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      var rect = overlay.getBoundingClientRect();
      startLeft = rect.left; startBottom = window.innerHeight - rect.bottom;
      e.preventDefault();
    };
    document.onmousemove = function(e) {
      if (!isDragging) return;
      overlay.style.right = "auto";
      overlay.style.left = (startLeft + e.clientX - startX) + "px";
      overlay.style.bottom = (startBottom + startY - e.clientY) + "px";
    };
    document.onmouseup = function() { isDragging = false; };

    // Minimize toggle
    header.onclick = function(e) {
      if (e.target === header) {
        body.style.display = body.style.display === "none" ? "block" : "none";
      }
    };
  }

  function __addLogToOverlay(type, text, color) {
    var body = document.getElementById("qtest-log-body");
    if (!body) return;
    var entry = document.createElement("div");
    entry.style.cssText = "padding:1px 2px;border-bottom:1px solid #222;white-space:pre-wrap;word-break:break-all;line-height:1.3;";
    var time = new Date().toLocaleTimeString("ru-RU", {hour12:false});
    var typeLabel = type.toUpperCase().padEnd(7);
    entry.innerHTML = '<span style="color:#666">' + time + '</span> <span style="color:' + (color||'#0f0') + '">' + typeLabel + '</span> ' + text;
    body.appendChild(entry);
    body.scrollTop = body.scrollHeight;

    __logEntries.push({type:type, text:text, time:time});
    if (__logEntries.length > __MAX_LOG_ENTRIES) {
      __logEntries.shift();
      if (body.firstChild) body.removeChild(body.firstChild);
    }
    var counter = document.getElementById("qtest-log-count");
    if (counter) counter.textContent = __logEntries.length;
  }

  // ══════════════════════════════════════════════════════════════
  // USER ACTIONS
  // ══════════════════════════════════════════════════════════════

  // ===== Click =====
  document.addEventListener("click", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    var tag = el.tagName.toLowerCase();
    if (tag === "html" || tag === "body") return;
    var sel = __getSelector(el);
    var txt = __getSelectorText(el);
    __record({actionType:"click", selector:sel, selectorText:txt, value:el.tagName, modifiers: (e.ctrlKey?"ctrl+":"") + (e.shiftKey?"shift+":"") + (e.altKey?"alt+":"")});
    __addLogToOverlay("click", sel + " " + txt, "#0f0");
  }, true);

  // ===== DblClick =====
  document.addEventListener("dblclick", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    var tag = el.tagName.toLowerCase();
    if (tag === "html" || tag === "body") return;
    var sel = __getSelector(el);
    var txt = __getSelectorText(el);
    __record({actionType:"dblclick", selector:sel, selectorText:txt, value:el.tagName});
    __addLogToOverlay("dblclick", sel + " " + txt, "#0f0");
  }, true);

  // ===== Input (debounced) — captures typing =====
  document.addEventListener("input", function(e) {
    if (e.isComposing) return; // Skip intermediate IME composition input
    var el = __deepEventTarget(e); if (!el) return;
    var tag = el.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea" && !el.isContentEditable) return;
    var key = __getSelector(el);
    var val = el.value || el.textContent || "";
    if (__inputTimers[key]) clearTimeout(__inputTimers[key]);
    __inputTimers[key] = setTimeout(function() {
      delete __inputTimers[key];
      var prev = __filledValues[key] || "";
      if (val !== prev) {
        __filledValues[key] = val;
        if (val) {
          __record({actionType:"fill", selector:key, selectorText:__getSelectorText(el), value:val, inputType: el.type||""});
          __addLogToOverlay("fill", key + " = " + val.slice(0,60), "#ff0");
        }
      }
    }, 500);
  }, true);

  // ===== Change — select, checkbox, radio, date, etc =====
  document.addEventListener("change", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    var tag = el.tagName.toLowerCase();
    if (tag === "select") {
      var optText = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value;
      __record({actionType:"select", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.value||"", displayValue:optText, optionIndex:el.selectedIndex});
      __addLogToOverlay("select", __getSelector(el) + " = " + optText, "#0ff");
      return;
    }
    if (tag === "input") {
      var type = (el.getAttribute("type")||"").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        __record({actionType:"check", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.checked?"checked":"unchecked", inputType:type, checked:el.checked});
        __addLogToOverlay("check", __getSelector(el) + " = " + (el.checked?"checked":"unchecked"), "#f0f");
        return;
      }
      if (type === "date" || type === "number" || type === "range") {
        __record({actionType:"fill", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.value||"", inputType:type});
        __addLogToOverlay("fill", __getSelector(el) + " = " + el.value, "#ff0");
        return;
      }
    }
    if (tag === "input" || tag === "textarea") {
      var key = __getSelector(el);
      if (__inputTimers[key]) { clearTimeout(__inputTimers[key]); delete __inputTimers[key]; }
      var val = el.value || "";
      var prev = __filledValues[key] || "";
      if (val !== prev) {
        __filledValues[key] = val;
        if (val) {
          __record({actionType:"fill", selector:key, selectorText:__getSelectorText(el), value:val});
          __addLogToOverlay("fill", key + " = " + val.slice(0,60), "#ff0");
        }
      }
    }
  }, true);

  // ===== Focus (track active element) =====
  document.addEventListener("focusin", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    var tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "html" || tag === "body" || tag === "head") return;
    var sel = __getSelector(el);
    __record({actionType:"focus", selector:sel, selectorText:__getSelectorText(el), value:tag, tagName:tag, role:(typeof el.getAttribute === 'function' ? el.getAttribute("role") : "")||""});
    __addLogToOverlay("focus", sel, "#888");
  }, true);

  // ===== Keyboard — all keys =====
  document.addEventListener("keydown", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    var key = e.key;
    var mods = [];
    if (e.ctrlKey) mods.push("ctrl");
    if (e.shiftKey) mods.push("shift");
    if (e.altKey) mods.push("alt");
    if (e.metaKey) mods.push("meta");
    var combo = mods.length ? mods.join("+") + "+" + key : key;
    // Record all non-trivial keys
    if (key === "Enter" || key === "Tab" || key === "Escape" || key === "Backspace" || key === "Delete" ||
        key === "ArrowDown" || key === "ArrowUp" || key === "ArrowLeft" || key === "ArrowRight" ||
        key === "Home" || key === "End" || key === "PageUp" || key === "PageDown" ||
        (mods.length > 0 && key.length === 1)) {
      __record({actionType:"keypress", selector:__getSelector(el), selectorText:__getSelectorText(el), value:key, combo:combo, ctrlKey:e.ctrlKey, shiftKey:e.shiftKey, altKey:e.altKey});
      __addLogToOverlay("key", combo, "#0af");
    }
  }, true);

  // ===== Context menu (right-click) =====
  document.addEventListener("contextmenu", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    __record({actionType:"contextmenu", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"", x:e.clientX, y:e.clientY});
    __addLogToOverlay("ctxmenu", __getSelector(el), "#f80");
  }, true);

  // ===== Drag & Drop =====
  document.addEventListener("dragstart", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    __record({actionType:"dragstart", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName});
  }, true);
  document.addEventListener("dragend", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    __record({actionType:"dragend", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName});
  }, true);
  document.addEventListener("drop", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    __record({actionType:"drop", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName});
  }, true);

  // ===== Form submit =====
  document.addEventListener("submit", function(e) {
    var form = e.target; if (!form) return;
    var fields = [];
    var inputs = form.querySelectorAll("input,select,textarea");
    for (var i = 0; i < Math.min(inputs.length, 10); i++) {
      var inp = inputs[i];
      fields.push(inp.name + "=" + (inp.value||"").slice(0,30));
    }
    __record({actionType:"submit", selector:__getSelector(form), selectorText:form.id||form.action||"form", value:fields.join("&")});
    __addLogToOverlay("submit", __getSelector(form) + " [" + fields.length + " fields]", "#f0f");
  }, true);

  // ===== Mouseenter/Mouseleave (hover tracking) =====
  document.addEventListener("mouseenter", function(e) {
    var el = __deepEventTarget(e); if (!el) return;
    var tag = el.tagName ? el.tagName.toLowerCase() : "";
    var roleCheck = (typeof el.getAttribute === 'function' ? el.getAttribute("role") : "");
    if (tag === "button" || tag === "a" || tag === "li" || tag === "td" || tag === "tr" || roleCheck) {
      __record({actionType:"hover", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"enter"});
    }
  }, true);
  document.addEventListener("mouseleave", function(e) {
    var el = e.target; if (!el) return;
    var tag = el.tagName ? el.tagName.toLowerCase() : "";
    var roleCheck = (typeof el.getAttribute === 'function' ? el.getAttribute("role") : "");
    if (tag === "button" || tag === "a" || tag === "li" || tag === "td" || tag === "tr" || roleCheck) {
      __record({actionType:"hover", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"leave"});
    }
  }, true);

  // ===== Scroll (debounced) =====
  var __scrollTimer = null;
  window.addEventListener("scroll", function() {
    if (__scrollTimer) return;
    __scrollTimer = setTimeout(function() {
      __scrollTimer = null;
      var pct = Math.round((window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)) * 100);
      __record({actionType:"scroll", selector:"", selectorText:"page", value:pct + "%", scrollY:window.scrollY, scrollMax:document.body.scrollHeight - window.innerHeight});
    }, 800);
  }, true);

  // ===== Window resize =====
  var __resizeTimer = null;
  window.addEventListener("resize", function() {
    if (__resizeTimer) return;
    __resizeTimer = setTimeout(function() {
      __resizeTimer = null;
      __record({actionType:"resize", selector:"", selectorText:"window", value:window.innerWidth + "x" + window.innerHeight});
    }, 500);
  }, true);

  // ===== Clipboard events =====
  document.addEventListener("copy", function(e) {
    var el = e.target; if (!el) return;
    __record({actionType:"clipboard", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"copy"});
  }, true);
  document.addEventListener("paste", function(e) {
    var el = e.target; if (!el) return;
    __record({actionType:"clipboard", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"paste"});
  }, true);

  // ===== Console.log interception =====
  var __origLog = console.log;
  var __origError = console.error;
  var __origWarn = console.warn;
  console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    var msg = args.map(function(a) { return typeof a === "object" ? JSON.stringify(a).slice(0,200) : String(a); }).join(" ");
    __addLogToOverlay("console", msg.slice(0,150), "#888");
    __origLog.apply(console, arguments);
  };
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    var msg = args.map(function(a) { return typeof a === "object" ? JSON.stringify(a).slice(0,200) : String(a); }).join(" ");
    __addLogToOverlay("error", msg.slice(0,150), "#f00");
    __origError.apply(console, arguments);
  };
  console.warn = function() {
    var args = Array.prototype.slice.call(arguments);
    var msg = args.map(function(a) { return typeof a === "object" ? JSON.stringify(a).slice(0,200) : String(a); }).join(" ");
    __addLogToOverlay("warn", msg.slice(0,150), "#ff0");
    __origWarn.apply(console, arguments);
  };

  // ===== Alert/Confirm/Prompt interception =====
  var __origAlert = window.alert;
  window.alert = function(msg) {
    __record({actionType:"dialog", selector:"", selectorText:"alert", value:String(msg)});
    __addLogToOverlay("alert", String(msg).slice(0,100), "#f80");
    return __origAlert.call(window, msg);
  };
  var __origConfirm = window.confirm;
  window.confirm = function(msg) {
    var result = __origConfirm.call(window, msg);
    __record({actionType:"dialog", selector:"", selectorText:"confirm", value:String(msg), result:String(result)});
    __addLogToOverlay("confirm", String(msg).slice(0,100) + " → " + result, "#f80");
    return result;
  };

  // ══════════════════════════════════════════════════════════════
  // DOM MUTATION MONITORING
  // ══════════════════════════════════════════════════════════════

  var __mutTimer = null;
  var __shadowRoots = new Set();
  var __attachedRoots = new Set();

  function __scanShadowRoots(root) {
    if (!root || !root.querySelectorAll) return;
    var els = root.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.shadowRoot) {
        if (!__shadowRoots.has(el.shadowRoot)) {
          __shadowRoots.add(el.shadowRoot);
          __attachToRoot(el.shadowRoot);
          __scanShadowRoots(el.shadowRoot);
        }
      }
    }
  }

  try { __observer = new MutationObserver(function(mutations) {
    if (__mutTimer) return;
    __mutTimer = setTimeout(function() {
      __mutTimer = null;

      var domEvents = [];

      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];

        if (m.type === "childList") {
          // Added nodes
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node.nodeType !== 1) continue;
            __scanShadowRoots(node);
            var el = node;
            var sel = el.id ? "#" + el.id : __getSmartSelector(el);
            var vis = el.offsetParent !== null || (el.style && el.style.display !== "none");
            if (!vis) continue;
            var tag = el.tagName ? el.tagName.toLowerCase() : "";
            var role = el.getAttribute ? el.getAttribute("role") : "";

            // Track new interactive/visible elements
            if (role === "listbox" || role === "menu" || role === "dialog" || role === "option" ||
                role === "tooltip" || role === "alert" || role === "status" ||
                tag === "select" || tag === "dialog" || tag === "table" ||
                tag === "nav" || tag === "aside" || tag === "modal") {
              domEvents.push({actionType:"element_appear", selector:sel, selectorText:__getSelectorText(el), value:tag, role:role, path:__getNodePath(el)});
              __addLogToOverlay("appear", sel + " <" + tag + ">", "#8f0");
            }
          }

          // Removed nodes
          for (var j2 = 0; j2 < m.removedNodes.length; j2++) {
            var rnode = m.removedNodes[j2];
            if (rnode.nodeType !== 1) continue;
            var rel = rnode;
            var rsel = rel.id ? "#" + rel.id : __getSmartSelector(rel);
            var rtag = rel.tagName ? rel.tagName.toLowerCase() : "";
            domEvents.push({actionType:"element_remove", selector:rsel, selectorText:__getSelectorText(rel), value:rtag, path:__getNodePath(rel)});
            __addLogToOverlay("remove", rsel + " <" + rtag + ">", "#f44");
          }
        }

        if (m.type === "attributes") {
          var attrEl = m.target;
          if (!attrEl || attrEl.nodeType !== 1) continue;
          var attrName = m.attributeName;
          var attrVal = attrEl.getAttribute ? attrEl.getAttribute(attrName) : "";
          // Skip noisy attributes
          if (attrName === "class" || attrName === "style" || attrName === "data-reactid" ||
              attrName === "aria-hidden" || attrName === "tabindex") continue;
          var asel = attrEl.id ? "#" + attrEl.id : __getSmartSelector(attrEl);
          domEvents.push({actionType:"attr_change", selector:asel, selectorText:attrName, value:(attrVal||"").slice(0,100), oldValue:(m.oldValue||"").slice(0,100)});
          __addLogToOverlay("attr", asel + " ." + attrName + " = " + (attrVal||"").slice(0,60), "#aa0");
        }

        // CharacterData (text node changes)
        if (m.type === "characterData") {
          var charEl = m.target.parentElement;
          if (charEl) {
            var csel = __getSmartSelector(charEl);
            var newText = m.target.data ? m.target.data.slice(0, 100) : "";
            domEvents.push({actionType:"text_change", selector:csel, selectorText:__getSelectorText(charEl), value:newText});
            __addLogToOverlay("text", csel + " → " + newText.slice(0,60), "#aaa");
          }
        }
      }

      // Batch record DOM events (max 5 per cycle to avoid flood)
      for (var d = 0; d < Math.min(domEvents.length, 5); d++) {
        __record(domEvents[d]);
      }
      if (domEvents.length > 5) {
        __addLogToOverlay("dom", "..." + (domEvents.length - 5) + " more DOM events suppressed", "#666");
      }
    }, 500);
  });
  __observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true
  });
  } catch(e) {}

  // ══════════════════════════════════════════════════════════════
  // SHADOW DOM
  // ══════════════════════════════════════════════════════════════
  function __attachToRoot(root) {
    if (__attachedRoots.has(root)) return;
    __attachedRoots.add(root);
    root.addEventListener("click", function(e) {
      var el = __deepEventTarget(e); if (!el) return;
      var tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (tag === "html" || tag === "body") return;
      __record({actionType:"click", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName, shadowDom:true});
    }, true);
    root.addEventListener("input", function(e) {
      var el = __deepEventTarget(e); if (!el) return;
      var tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (tag !== "input" && tag !== "textarea" && !el.isContentEditable) return;
      var key = __getSelector(el);
      var val = el.value || el.textContent || "";
      if (__inputTimers[key]) clearTimeout(__inputTimers[key]);
      __inputTimers[key] = setTimeout(function() {
        delete __inputTimers[key];
        var prev = __filledValues[key] || "";
        if (val !== prev) {
          __filledValues[key] = val;
          if (val) __record({actionType:"fill", selector:key, selectorText:__getSelectorText(el), value:val, shadowDom:true});
        }
      }, 500);
    }, true);
    root.addEventListener("change", function(e) {
      var el = __deepEventTarget(e); if (!el) return;
      var tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (tag === "select") {
        var optText = el.options && el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value;
        __record({actionType:"select", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.value||"", displayValue:optText, shadowDom:true});
        return;
      }
      if (tag === "input") {
        var type = (el.getAttribute("type")||"").toLowerCase();
        if (type === "checkbox" || type === "radio") {
          __record({actionType:"check", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.checked?"checked":"unchecked", shadowDom:true});
          return;
        }
      }
    }, true);
    root.addEventListener("keydown", function(e) {
      var el = __deepEventTarget(e); if (!el) return;
      var key = e.key;
      if (key === "Enter" || key === "Tab" || key === "Escape" || key === "Backspace" || key === "Delete") {
        __record({actionType:"keypress", selector:__getSelector(el), selectorText:__getSelectorText(el), value:key, shadowDom:true});
      }
    }, true);
  }

  // Scan existing DOM for shadow roots
  __scanShadowRoots(document);
  __attachToRoot(document);

  __addLogToOverlay("init", "QTest Recorder injected ✓", "#0f0");
  } // end __setupRecorder
})();`;

// ══════════════════════════════════════════════════════════════
// OVERLAY INJECT (minimal, for pages where full script is heavy)
// ══════════════════════════════════════════════════════════════
const OVERLAY_SCRIPT = `(function() {
  if (document.getElementById("qtest-log-overlay")) return;
  var overlay = document.createElement("div");
  overlay.id = "qtest-log-overlay";
  overlay.style.cssText = "position:fixed;bottom:0;right:0;width:350px;height:150px;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:11px;z-index:2147483647;overflow-y:auto;border-top-left-radius:8px;box-shadow:0 -2px 10px rgba(0,0,0,0.4);padding:4px;";
  overlay.innerHTML = '<div style="color:#e94560;font-weight:bold;padding:2px;border-bottom:1px solid #333;">QTest Recorder Active</div><div id="qtest-log-entries"></div>';
  document.body.appendChild(overlay);
})();`;

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
          reject(new Error(`HTTP ${res.statusCode}: ${chunks.slice(0,200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export function pushAction(sessionId: string, action: any) {
  const rec = recordings.get(sessionId);
  if (rec) {
    rec.pendingActions.push(action);
    const detail = formatActionDetail(action);
    console.log(`[recorder] pushAction ${action.actionType} ${detail} → pending=${rec.pendingActions.length} (session=${sessionId.slice(0,8)})`);
  } else {
    console.log(`[recorder] pushAction DROPPED — no recording for session=${sessionId.slice(0,8)}  mapSize=${recordings.size}`);
  }
}

function formatActionDetail(action: any): string {
  switch (action.actionType) {
    case 'click': return `selector="${action.selector}" text="${(action.selectorText||'').slice(0,50)}" elem=${action.value||''}`;
    case 'dblclick': return `selector="${action.selector}" text="${(action.selectorText||'').slice(0,50)}"`;
    case 'fill': return `selector="${action.selector}" value="${(action.value||'').slice(0,50)}" type=${action.inputType||''}`;
    case 'select': return `selector="${action.selector}" value="${action.value}" display="${action.displayValue||''}" idx=${action.optionIndex||''}`;
    case 'navigate': return `url="${(action.selectorText||action.url||'').slice(0,100)}" spa=${action.spaMethod||''}`;
    case 'keypress': return `key="${action.value}" combo="${action.combo||action.value}"`;
    case 'check': return `selector="${action.selector}" type=${action.inputType||''} checked=${action.checked}`;
    case 'page_load': return `url="${(action.url||'').slice(0,100)}"`;
    case 'scroll': return `position="${action.value}" scrollY=${action.scrollY||''}`;
    case 'element_appear': return `selector="${action.selector}" tag="${action.value}" role=${action.role||''}`;
    case 'element_remove': return `selector="${action.selector}" tag="${action.value}"`;
    case 'attr_change': return `selector="${action.selector}" attr="${action.selectorText}" value="${(action.value||'').slice(0,40)}"`;
    case 'text_change': return `selector="${action.selector}" value="${(action.value||'').slice(0,40)}"`;
    case 'focus': return `selector="${action.selector}" tag=${action.tagName||''} role=${action.role||''}`;
    case 'hover': return `selector="${action.selector}" event=${action.value}`;
    case 'contextmenu': return `selector="${action.selector}" x=${action.x} y=${action.y}`;
    case 'dialog': return `type=${action.selectorText} value="${(action.value||'').slice(0,60)}" result=${action.result||''}`;
    case 'clipboard': return `selector="${action.selector}" action=${action.value}`;
    case 'resize': return `size=${action.value}`;
    case 'response': return `url="${(action.url||'').slice(0,80)}" status=${action.status} method=${action.method||''}`;
    case 'request': return `url="${(action.url||'').slice(0,80)}" method=${action.method} type=${action.resourceType||''}`;
    case 'console': return `level=${action.level} msg="${(action.value||'').slice(0,60)}"`;
    case 'js_error': return `msg="${(action.value||'').slice(0,80)}"`;
    case 'unhandled_rejection': return `msg="${(action.value||'').slice(0,80)}"`;
    case 'cookie_consent': return `vendor="${(action.value||'').slice(0,60)}"`;
    case 'touchstart': return `selector="${action.selector}" x=${action.x} y=${action.y}`;
    case 'touchend': return `x=${action.x} y=${action.y}`;
    case 'touchmove': return `pos="${action.value}"`;
    case 'dragstart': return `from="${action.selector}" ${action.value}`;
    case 'dragend': return `pos=${action.value}`;
    case 'drop': return `to="${action.selector}" ${action.value}`;
    case 'wheel': return `delta="${action.value}"`;
    case 'transition_end': return `prop="${action.selectorText}" ${action.value}`;
    case 'animation_end': return `name="${action.selectorText}" ${action.value}`;
    case 'visibility_change': return `state=${action.value}`;
    case 'file_upload': return `files="${action.value}" count=${action.fileCount}`;
    case 'jira_env': return `env="${(action.value||'').slice(0,100)}"`;
    case 'captcha_detected': return `type="${(action.selectorText||'')}" ${(action.value||'')}`;
    case 'user_switch': return `from="${(action.selectorText||'')}" to="${(action.value||'')}"`;
    case 'popover_toggle': return `${(action.value||'')} [${action.selector}]`;
    case 'media_play': return `${(action.value||'')} [${action.selector}]`;
    case 'media_pause': return `${(action.value||'')} [${action.selector}]`;
    case 'media_seeked': return `${(action.value||'')} [${action.selector}]`;
    case 'media_volume': return `${(action.value||'')} [${action.selector}]`;
    case 'dialog_element': return `state=${action.value}`;
    case 'details_toggle': return `state=${action.value}`;
    case 'ime_composition': return `${(action.value||'').slice(0,60)} [${action.selector}] inputType=${action.inputType||''} displayValue=${(action.displayValue||'').slice(0,30)}`;
    default: return '';
  }
}

export async function startRecording(profileId: string, sessionId: string, recorderUrl: string): Promise<void> {
  const session = getSession(profileId);
  if (!session) throw new Error('No active browser session');

  console.log(`[recorder] startRecording session=${sessionId.slice(0,8)} profile=${profileId.slice(0,8)} recorderUrl=${recorderUrl}`);

  // Clean up any old recording for this profileId (stale session reuse)
  for (const [sid, rec] of recordings) {
    if (rec.profileId === profileId && sid !== sessionId) {
      if (rec.flushTimer) clearInterval(rec.flushTimer);
      for (const remove of rec.listeners) try { remove(); } catch {}
      recordings.delete(sid);
    }
  }

  const page: Page = session.page;
  const context = page.context();
  const listeners: (() => void)[] = [];

  // ══════════════════════════════════════════════════════════════
  // FRAME TRACKING — map frame URL → frame selector for cross-origin
  // ══════════════════════════════════════════════════════════════
  function buildFrameMap(): Map<string, { name: string, url: string, selector: string }> {
    const map = new Map<string, { name: string, url: string, selector: string }>();
    function walk(f: Frame, path: string[]) {
      const name = f.name();
      const url = f.url();
      const sel = path.length > 0 ? path.join(' >> ') : '';
      if (url && url !== 'about:blank') map.set(url, { name, url, selector: sel });
      for (const child of f.childFrames()) walk(child, [...path, `frame[src="${child.url()}"]`]);
    }
    walk(page.mainFrame(), []);
    return map;
  }
  let frameMap = buildFrameMap();

  function isMainFrame(url: string): boolean {
    try { return url === page.url(); } catch { return false; }
  }

  function updateFrameMap(): void {
    try { frameMap = buildFrameMap(); } catch {}
  }

  // ── Track frame updates ──
  async function injectIntoFrame(frame: Frame, label: string) {
    try {
      try {
        await frame.addScriptTag({ content: INJECT_SCRIPT });
        console.log('recorder frame[' + label + '] addScriptTag OK');
      } catch {}
      try {
        await frame.evaluate(INJECT_SCRIPT);
        console.log('recorder frame[' + label + '] evaluate OK');
      } catch {}
    } catch {}
  }

  async function injectIntoAllFrames(targetPage: Page) {
    for (const f of targetPage.frames()) {
      if (f === targetPage.mainFrame()) continue;
      const url = f.url();
      const name = f.name();
      if (!url || url === 'about:blank') continue;
      const label = (name || 'unnamed') + ' (' + url.slice(0, 60) + ')';
      await injectIntoFrame(f, label);
    }
  }

  const onFrameNav = (frame: Frame) => {
    try {
      if (!frame) return;
      const url = frame.url();
      if (!url || url === 'about:blank') return;
      updateFrameMap();
      const name = frame.name();
      const label = (name || 'unnamed') + ' (' + url.slice(0, 60) + ')';
      injectIntoFrame(frame, label);
    } catch {}
  };
  page.on('framenavigated', onFrameNav);
  listeners.push(() => page.off('framenavigated', onFrameNav as any));

  // ══════════════════════════════════════════════════════════════
  // EXPOSE FUNCTION — direct DOM→Node communication channel
  // ══════════════════════════════════════════════════════════════
  try {
    await page.exposeFunction('__recordAction', (action: any) => {
      action.sessionId = sessionId;
      pushAction(sessionId, action);
    });
    console.log(`[recorder] exposeFunction __recordAction OK`);
  } catch (e: any) {
    console.log(`[recorder] exposeFunction FAILED: ${e.message.split('\n')[0]}`);
  }

  // ══════════════════════════════════════════════════════════════
  // PLAYWRIGHT-LEVEL EVENTS
  // ══════════════════════════════════════════════════════════════

  // ── framenavigated (real page loads) ──
  let lastNavigatedUrl = '';
  const onFrameNavigated = (frame: any) => {
    try {
      console.log(`[recorder] onFrameNavigated CALLED frame=${frame ? 'exists' : 'null'}`);
      if (!frame || frame !== page.mainFrame()) {
        console.log(`[recorder] onFrameNavigated SKIP — not mainFrame`);
        return;
      }
      const frameUrl = frame.url();
      console.log(`[recorder] onFrameNavigated url=${frameUrl} lastUrl=${lastNavigatedUrl}`);
      if (!frameUrl || frameUrl === 'about:blank') {
        console.log(`[recorder] onFrameNavigated SKIP — blank url`);
        return;
      }
      if (frameUrl === lastNavigatedUrl) {
        console.log(`[recorder] onFrameNavigated SKIP — dedup`);
        return;
      }
      lastNavigatedUrl = frameUrl;
      console.log(`[recorder] framenavigated → ${frameUrl.slice(0,100)}`);
      pushAction(sessionId, {
        actionType: 'navigate', selector: '', selectorText: frameUrl, value: '',
        url: frameUrl, pageTitle: '', timestamp: new Date().toISOString(),
      });
      // Reinject scripts on each navigation (belt and suspenders)
      page.evaluate(INJECT_SCRIPT).catch(() => {});
      page.addScriptTag({ content: INJECT_SCRIPT }).catch(() => {});
    } catch (e: any) {
      console.log(`[recorder] onFrameNavigated ERROR: ${e?.message}`);
    }
  };
  page.on('framenavigated', onFrameNavigated);
  listeners.push(() => page.off('framenavigated', onFrameNavigated));

  // ── page load ──
  let lastLoadUrl = '';
  const onPageLoad = () => {
    try {
      const url = page.url();
      if (url === lastLoadUrl) return;
      lastLoadUrl = url;
      console.log(`[recorder] page_load → ${url.slice(0,100)}`);
      pushAction(sessionId, {
        actionType: 'page_load', selector: '', selectorText: url, value: url,
        url, pageTitle: '', timestamp: new Date().toISOString(),
      });
    } catch {}
  };
  page.on('load', onPageLoad);
  listeners.push(() => page.off('load', onPageLoad));

  // ══════════════════════════════════════════════════════════════
  // HTTP REQUEST/RESPONSE INTERCEPTION
  // ══════════════════════════════════════════════════════════════

  // ── Request ──
  const onRequest = (request: any) => {
    try {
      if (request.resourceType() === 'image' || request.resourceType() === 'media' ||
          request.resourceType() === 'font' || request.resourceType() === 'stylesheet') return;
      const url = request.url();
      const method = request.method();
      const resourceType = request.resourceType();
      let postData = '';
      try { postData = request.postData() || ''; } catch {}
      console.log(`[recorder] request → ${method} ${url.slice(0,80)} type=${resourceType}`);
      pushAction(sessionId, {
        actionType: 'request',
        selector: '', selectorText: url, value: '',
        url, method, resourceType,
        postData: postData.slice(0, 500),
        headers: {},
        timestamp: new Date().toISOString(),
      });
    } catch {}
  };
  page.on('request', onRequest);
  listeners.push(() => page.off('request', onRequest));

  // ── Response (with body capture for API calls) ──
  const onResponse = (response: any) => {
    (async () => {
      try {
        const url = response.url();
        const status = response.status();
        const method = response.request().method();
        const resourceType = response.request().resourceType();

        // Skip static assets
        if (resourceType === 'image' || resourceType === 'media' ||
            resourceType === 'font' || resourceType === 'stylesheet') return;

        const headers: Record<string, string> = {};
        try {
          const respHeaders = response.headers();
          for (const [k, v] of Object.entries(respHeaders)) {
            headers[k] = String(v).slice(0, 200);
          }
        } catch {}

        // Try to capture response body for API calls
        let body = '';
        try {
          const contentType = headers['content-type'] || '';
          if (contentType.includes('json') || contentType.includes('text') || contentType.includes('xml')) {
            const buf = await response.body();
            body = buf.toString('utf-8').slice(0, 500);
          }
        } catch {}

        console.log(`[recorder] response → ${status} ${method} ${url.slice(0,80)} body=${body.length}chars`);
        pushAction(sessionId, {
          actionType: 'response',
          selector: '', selectorText: url, value: '',
          url, status, method, resourceType,
          body, headers,
          timestamp: new Date().toISOString(),
        });
      } catch {}
    })();
  };
  page.on('response', onResponse);
  listeners.push(() => page.off('response', onResponse));

  // ── Request failed ──
  const onRequestFailed = (request: any) => {
    try {
      const url = request.url();
      const method = request.method();
      const failure = request.failure();
      console.log(`[recorder] request_failed → ${method} ${url.slice(0,80)} reason=${failure?.errorText||'unknown'}`);
      pushAction(sessionId, {
        actionType: 'request_failed',
        selector: '', selectorText: url, value: '',
        url, method, error: failure?.errorText || 'unknown',
        timestamp: new Date().toISOString(),
      });
    } catch {}
  };
  page.on('requestfailed', onRequestFailed);
  listeners.push(() => page.off('requestfailed', onRequestFailed));

  // ── Console messages from page — intercept __QTEST_ACTION__ for DOM events ──
  const onConsole = (msg: any) => {
    try {
      const text = msg.text();
      // Check if this is a recorded action from our injected script
      if (text.startsWith('__QTEST_ACTION__')) {
        try {
          const actionData = JSON.parse(text.slice('__QTEST_ACTION__'.length));
          actionData.sessionId = sessionId;
          // Tag with frame info for cross-origin iframe detection
          try {
            const frameUrl = msg.location ? msg.location().url : '';
            const isMain = isMainFrame(frameUrl);
            const inMap = frameMap.has(frameUrl);
            console.log(`[recorder] console msg from url=${frameUrl} isMain=${isMain} inMap=${inMap} type=${actionData.actionType}`);
            if (frameUrl && !isMain && inMap) {
              const frameInfo = frameMap.get(frameUrl)!;
              actionData.frameUrl = frameUrl;
              actionData.frameName = frameInfo.name;
              actionData.frameSelector = frameInfo.selector;
            } else if (frameUrl && !isMain && !inMap) {
              console.log(`[recorder] frame NOT in map! Known frames: ${Array.from(frameMap.keys()).join(', ')}`);
            }
          } catch (e: any) {
            console.log(`[recorder] frame tagging error: ${e.message}`);
          }
          pushAction(sessionId, actionData);
        } catch (e: any) {
          console.log(`[recorder] JSON parse error: ${e.message}`);
        }
        return;
      }
      // Regular console messages
      const type = msg.type();
      if (type === 'log' && text.includes('[QTest]')) return; // skip our own
      pushAction(sessionId, {
        actionType: 'console',
        selector: '', selectorText: '', value: text.slice(0, 200),
        level: type, url: page.url(),
        timestamp: new Date().toISOString(),
      });
    } catch {}
  };
  page.on('console', onConsole);
  listeners.push(() => page.off('console', onConsole));

  // ── Dialog (alert, confirm, prompt) ──
  const onDialog = (dialog: any) => {
    try {
      console.log(`[recorder] dialog → type=${dialog.type()} message=${dialog.message().slice(0,60)}`);
      pushAction(sessionId, {
        actionType: 'dialog',
        selector: '', selectorText: dialog.type(), value: dialog.message().slice(0, 200),
        url: page.url(),
        timestamp: new Date().toISOString(),
      });
    } catch {}
  };
  page.on('dialog', onDialog);
  listeners.push(() => page.off('dialog', onDialog));

  // ══════════════════════════════════════════════════════════════
  // INJECT DOM SCRIPT
  // ══════════════════════════════════════════════════════════════

  // Inject into current page + re-inject on every navigation
  // Uses console.debug for communication (same as Playwright codegen)
  async function injectScript(targetPage: Page, label: string) {
    try {
      // addInitScript — runs BEFORE page scripts on every navigation
      try {
        await targetPage.addInitScript(INJECT_SCRIPT);
        console.log(`[recorder] ${label} addInitScript OK`);
      } catch (e: any) {
        console.log(`[recorder] ${label} addInitScript FAILED: ${e.message.split('\n')[0]}`);
      }
      // For CURRENT page that's already loaded — inject via addScriptTag
      try {
        await targetPage.addScriptTag({ content: INJECT_SCRIPT });
        console.log(`[recorder] ${label} addScriptTag OK`);
      } catch (e: any) {
        console.log(`[recorder] ${label} addScriptTag FAILED: ${e.message.split('\n')[0]}`);
      }
      // 3. CDP Runtime.evaluate — SKIPPED (interferes with Playwright framenavigated events)
      // try {
      //   const cdpSession = await targetPage.context().newCDPSession(targetPage);
      //   await cdpSession.send('Runtime.evaluate', {
      //     expression: INJECT_SCRIPT,
      //     awaitPromise: false,
      //   });
      //   console.log(`[recorder] ${label} CDP evaluate OK`);
      // } catch (e: any) {
      //   console.log(`[recorder] ${label} CDP evaluate FAILED: ${e.message.split('\n')[0]}`);
      // }
    } catch (e: any) {
      console.log(`[recorder] ${label} inject FAILED: ${e.message.split('\n')[0]}`);
    }
  }

  // Inject via addInitScript — runs on every navigation before page scripts
  try {
    await page.addInitScript(INJECT_SCRIPT);
    console.log(`[recorder] addInitScript OK`);
  } catch (e: any) {
    console.log(`[recorder] addInitScript FAILED: ${e.message.split('\n')[0]}`);
  }
  // Inject into current page (about:blank) — safe to ignore if fails
  try {
    await page.addScriptTag({ content: INJECT_SCRIPT }).catch(() => {});
  } catch {}

  // ── Handle new tabs ──
  const onPageCreated = async (newPage: Page) => {
    const newUrl = newPage.url();
    console.log(`[recorder] new tab opened → ${newUrl.slice(0,100)}`);
    // Expose function for the new tab
    try {
      await newPage.exposeFunction('__recordAction', (action: any) => {
        action.sessionId = sessionId;
        pushAction(sessionId, action);
      });
      console.log(`[recorder] new-tab exposeFunction OK`);
    } catch (e: any) {
      console.log(`[recorder] new-tab exposeFunction FAILED: ${e.message.split('\n')[0]}`);
    }
    await injectScript(newPage, 'new-tab');
    await injectIntoAllFrames(newPage);
    // Attach HTTP interception to new tab
    newPage.on('request', onRequest);
    newPage.on('response', onResponse);
    newPage.on('requestfailed', onRequestFailed);
    newPage.on('console', onConsole);
    newPage.on('dialog', onDialog);
  };
  context.on('page', onPageCreated);
  listeners.push(() => context.off('page', onPageCreated));

  // Start periodic flush

  // Start periodic flush
  const flushTimer = setInterval(() => flushActions(sessionId), 2000);

  recordings.set(sessionId, { profileId, sessionId, pendingActions: [], flushTimer, recorderUrl, listeners });
  console.log(`[recorder] recording started — session=${sessionId.slice(0,8)} profile=${profileId.slice(0,8)}`);
}

export async function stopRecording(sessionId: string): Promise<void> {
  const rec = recordings.get(sessionId);
  if (!rec) { console.log(`[recorder] stopRecording — no recording for ${sessionId.slice(0,8)}`); return; }

  console.log(`[recorder] stopRecording session=${sessionId.slice(0,8)} pending=${rec.pendingActions.length}`);
  if (rec.flushTimer) clearInterval(rec.flushTimer);

  for (const remove of rec.listeners) {
    try { remove(); } catch {}
  }

  // Final flush with retries
  for (let attempt = 0; attempt < 3; attempt++) {
    await flushActions(sessionId);
    const recAfter = recordings.get(sessionId);
    if (!recAfter || recAfter.pendingActions.length === 0) break;
    console.log(`[recorder] final flush retry ${attempt + 1}/3 — ${recAfter.pendingActions.length} actions remain`);
    await new Promise(r => setTimeout(r, 1000));
  }
  recordings.delete(sessionId);
  console.log(`[recorder] recording stopped — session=${sessionId.slice(0,8)}`);
}

async function flushActions(sessionId: string): Promise<void> {
  const rec = recordings.get(sessionId);
  if (!rec || rec.pendingActions.length === 0) return;

  const batch = rec.pendingActions.splice(0);
  if (batch.length === 0) return;

  const url = `${rec.recorderUrl}/api/recordings/${sessionId}/actions`;
  console.log(`[recorder] flush ${batch.length} actions → ${url}`);
  for (const action of batch) {
    console.log(`[recorder]   → ${formatActionDetail(action)}`);
  }
  try {
    await postJson(url, { actions: batch });
    console.log(`[recorder] flush OK (${batch.length} actions sent)`);
  } catch (err: any) {
    console.log(`[recorder] flush FAILED: ${err.message} — re-queuing ${batch.length} actions`);
    rec.pendingActions.unshift(...batch);
  }
}

export function isRecording(sessionId: string): boolean {
  return recordings.has(sessionId);
}

export function listRecordings(): string[] {
  return Array.from(recordings.keys());
}

export function getRecordingsDebug(): any {
  const result: any[] = [];
  for (const [sid, rec] of recordings) {
    result.push({
      sessionId: sid,
      profileId: rec.profileId,
      recorderUrl: rec.recorderUrl,
      pendingActions: rec.pendingActions.length,
      hasFlushTimer: !!rec.flushTimer,
      listenersCount: rec.listeners.length,
    });
  }
  return { recordings: result, size: recordings.size };
}

/** Find recording session ID for a given profile ID */
export function getSessionIdForProfile(profileId: string): string | undefined {
  console.log(`[recorder] getSessionIdForProfile profile=${profileId.slice(0,8)} recordings=${recordings.size} keys=${Array.from(recordings.keys()).map(k=>k.slice(0,8))}`);
  for (const [sid, rec] of recordings) {
    if (rec.profileId === profileId) {
      console.log(`[recorder] getSessionIdForProfile FOUND sid=${sid.slice(0,8)}`);
      return sid;
    }
  }
  console.log(`[recorder] getSessionIdForProfile NOT FOUND`);
  return undefined;
}

/** Get direct reference to pendingActions array for a given sessionId.
 *  Returns undefined if the recording has been cleaned up. */
export function getPendingActions(sessionId: string): any[] | undefined {
  const rec = recordings.get(sessionId);
  return rec ? rec.pendingActions : undefined;
}
