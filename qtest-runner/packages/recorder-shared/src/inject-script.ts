// ══════════════════════════════════════════════════════════════
// INJECT_SCRIPT — полный набор DOM-событий + overlay + console
// Композиция из helper'ов (924 строки) + основной скрипт
//
// Источник: browser-agent/src/recorder.ts:28-601
// Helpers: browser-agent/src/inject-helpers.ts (924 строки)
// ══════════════════════════════════════════════════════════════

import {
  SHADOW_DOM_HELPER, IFRAME_HELPER, SPA_NAV_HELPER, ERROR_TRACKER_HELPER,
  ASSERTION_HELPER, JIRA_DETECTOR_HELPER,
  COOKIE_CONSENT_HELPER,
  TOUCH_WHEEL_HELPER, ANIMATION_HELPER, LIFECYCLE_HELPER,
  CAPTCHA_DETECTOR_HELPER,
  FILE_UPLOAD_HELPER, USER_SWITCH_HELPER, POPOVER_HELPER, MEDIA_EVENTS_HELPER,
  IME_COMPOSITION_HELPER, RESIZE_OBSERVER_HELPER,
  TP_ID_GENERATOR,
} from './inject-helpers';

export const INJECT_SCRIPT = `(function __qtestInject() {
  // TP_ID_GENERATOR runs INDEPENDENTLY of recording guard
  // (data-tp IDs should persist even if recording is already active)
  ${TP_ID_GENERATOR}

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
  ${RESIZE_OBSERVER_HELPER}

  // ── Record action ──
  function __record(data) {
    data.url = location.href;
    data.pageTitle = document.title;
    data.timestamp = new Date().toISOString();
    data.tabId = window.__qtestTabId || "";
    // Channel 1: оригинальный console.debug (без monkey-patch)
    // Используем __origConsole.debug чтобы избежать рекурсии — console перехвачен ниже
    try {
      if (typeof __origConsole !== 'undefined' && __origConsole.debug) {
        __origConsole.debug("__QTEST_ACTION__" + JSON.stringify(data));
      } else {
        console.debug("__QTEST_ACTION__" + JSON.stringify(data));
      }
    } catch(e) {}
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
      };
    }
  })();

  // ── Log overlay ──
  function __addLogToOverlay(type, msg, color) {
    var entry = {type: type, msg: msg, color: color, time: new Date().toLocaleTimeString()};
    __logEntries.push(entry);
    if (__logEntries.length > __MAX_LOG_ENTRIES) __logEntries.shift();
    var el = document.getElementById("qtest-log-entries");
    if (el) {
      var div = document.createElement("div");
      div.style.cssText = "padding:1px 4px;border-bottom:1px solid #222;font-size:10px;";
      div.innerHTML = '<span style="color:' + color + '">[' + type + ']</span> ' + msg;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
    }
  }

  // ── Overlay ──
  function __createOverlay() {
    if (document.getElementById("qtest-log-overlay")) return;
    var overlay = document.createElement("div");
    overlay.id = "qtest-log-overlay";
    overlay.style.cssText = "position:fixed;bottom:0;right:0;width:350px;height:150px;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:11px;z-index:2147483647;overflow-y:auto;border-top-left-radius:8px;box-shadow:0 -2px 10px rgba(0,0,0,0.4);padding:4px;";
    overlay.innerHTML = '<div style="color:#e94560;font-weight:bold;padding:2px;border-bottom:1px solid #333;">QTest Recorder Active</div><div id="qtest-log-entries"></div>';
    document.body.appendChild(overlay);
  }
  __createOverlay();

  // ── Click ──
  document.addEventListener("click", function(event) {
    var el = __deepEventTarget(event);
    if (!el || el === document.body || el === document.documentElement) return;
    var target = __getInteractiveParent(el);
    __record({
      actionType: "click",
      selector: __getSelector(target),
      selectorText: __getSelectorText(target),
      value: target.tagName || ""
    });
    __addLogToOverlay("click", __getSelector(target), "#0f0");
  }, true);

  // ── Dblclick ──
  document.addEventListener("dblclick", function(event) {
    var el = __deepEventTarget(event);
    if (!el || el === document.body || el === document.documentElement) return;
    var target = __getInteractiveParent(el);
    __record({
      actionType: "dblclick",
      selector: __getSelector(target),
      selectorText: __getSelectorText(target),
      value: target.tagName || ""
    });
  }, true);

  // ── Input (typing, debounced) ──
  document.addEventListener("input", function(event) {
    var el = event.target;
    if (!el) return;
    var key = __getSelector(el);
    if (__inputTimers[key]) clearTimeout(__inputTimers[key]);
    __inputTimers[key] = setTimeout(function() {
      var val = el.value || "";
      if (__filledValues[key] === val) return;
      __filledValues[key] = val;
      __record({
        actionType: "fill",
        selector: __getSelector(el),
        selectorText: __getSelectorText(el),
        value: val,
        inputType: el.type || "text"
      });
      __addLogToOverlay("fill", __getSelector(el) + " = " + val.slice(0, 40), "#ff0");
    }, 500);
  }, true);

  // ── Change (select, checkbox, radio) ──
  document.addEventListener("change", function(event) {
    var el = event.target;
    if (!el) return;
    var tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "select") {
      __record({
        actionType: "select",
        selector: __getSelector(el),
        selectorText: __getSelectorText(el),
        value: el.value || "",
        displayValue: el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : "",
        optionIndex: el.selectedIndex
      });
    } else if (el.type === "checkbox" || el.type === "radio") {
      __record({
        actionType: "check",
        selector: __getSelector(el),
        selectorText: __getSelectorText(el),
        checked: el.checked,
        inputType: el.type
      });
    } else {
      // Other change events (date, color, etc.)
      __record({
        actionType: "fill",
        selector: __getSelector(el),
        selectorText: __getSelectorText(el),
        value: el.value || "",
        inputType: el.type || "text"
      });
    }
  }, true);

  // ── Focus ──
  document.addEventListener("focusin", function(event) {
    var el = event.target;
    if (!el || el === document.body || el === document.documentElement) return;
    var tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select" || el.contentEditable === "true") {
      __record({
        actionType: "focus",
        selector: __getSelector(el),
        selectorText: __getSelectorText(el),
        value: el.value || "",
        tagName: tag,
        role: el.getAttribute("role") || ""
      });
    }
  }, true);

  // ── Keypress ──
  document.addEventListener("keydown", function(event) {
    var el = event.target;
    var key = event.key;
    if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return;
    var combo = "";
    if (event.ctrlKey) combo += "Ctrl+";
    if (event.shiftKey) combo += "Shift+";
    if (event.altKey) combo += "Alt+";
    if (event.metaKey) combo += "Meta+";
    combo += key;
    __record({
      actionType: "keypress",
      selector: __getSelector(el),
      selectorText: __getSelectorText(el),
      value: key,
      combo: combo
    });
    __addLogToOverlay("key", combo, "#0ff");
  }, true);

  // ── Context menu ──
  document.addEventListener("contextmenu", function(event) {
    var el = __deepEventTarget(event);
    if (!el || el === document.body || el === document.documentElement) return;
    __record({
      actionType: "contextmenu",
      selector: __getSelector(el),
      selectorText: __getSelectorText(el),
      value: el.tagName || ""
    });
  }, true);

  // ── Submit ──
  document.addEventListener("submit", function(event) {
    var el = event.target;
    __record({
      actionType: "submit",
      selector: __getSelector(el),
      selectorText: el.action || ""
    });
    __addLogToOverlay("form", "submit: " + __getSelector(el), "#f0f");
  }, true);

  // ── Console intercept ──
  var __origConsole = {};
  ["log", "warn", "error", "info", "debug"].forEach(function(level) {
    if (console[level]) {
      __origConsole[level] = console[level];
      console[level] = function() {
        var args = Array.prototype.slice.call(arguments);
        var msg = args.map(function(a) {
          if (typeof a === "string") return a;
          try { return JSON.stringify(a); } catch(e) { return String(a); }
        }).join(" ");
        __record({
          actionType: "console",
          selector: "",
          selectorText: level,
          value: msg.slice(0, 200)
        });
        return __origConsole[level].apply(console, arguments);
      };
    }
  });

  // ── Alert / Confirm / Prompt intercept ──
  window.alert = function(msg) {
    __record({actionType: "dialog", selector: "", selectorText: "alert", value: String(msg).slice(0, 200)});
    __addLogToOverlay("dialog", "alert: " + String(msg).slice(0, 60), "#f80");
  };
  window.confirm = function(msg) {
    __record({actionType: "dialog", selector: "", selectorText: "confirm", value: String(msg).slice(0, 200)});
    __addLogToOverlay("dialog", "confirm: " + String(msg).slice(0, 60), "#f80");
    return true;
  };
  window.prompt = function(msg, def) {
    __record({actionType: "dialog", selector: "", selectorText: "prompt", value: String(msg).slice(0, 200)});
    __addLogToOverlay("dialog", "prompt: " + String(msg).slice(0, 60), "#f80");
    return def || "";
  };

  // ── Shadow DOM scanning ──
  function __scanShadowRoots(root) {
    if (!root || !root.querySelectorAll) return;
    var all = root.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        __attachToRoot(all[i].shadowRoot);
        __scanShadowRoots(all[i].shadowRoot);
      }
    }
  }

  function __attachToRoot(root) {
    if (!root) return;
    root.addEventListener("click", function(event) {
      var el = __deepEventTarget(event);
      if (!el) return;
      __record({actionType:"click", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName || "", shadowDom:true});
    }, true);

    root.addEventListener("input", function(event) {
      var el = event.target;
      if (!el) return;
      var key = __getSelector(el);
      if (__inputTimers[key]) clearTimeout(__inputTimers[key]);
      __inputTimers[key] = setTimeout(function() {
        __record({actionType:"fill", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.value || "", inputType:el.type || "text", shadowDom:true});
      }, 500);
    }, true);

    root.addEventListener("change", function(event) {
      var el = event.target;
      if (!el) return;
      __record({actionType:"fill", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.value || "", inputType:el.type || "text", shadowDom:true});
    }, true);

    root.addEventListener("keydown", function(event) {
      var el = event.target;
      var key = event.key;
      if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return;
      __record({actionType:"keypress", selector:__getSelector(el), selectorText:__getSelectorText(el), value:key, shadowDom:true});
    }, true);
  }

  // Scan existing DOM for shadow roots
  __scanShadowRoots(document);
  __attachToRoot(document);

  __addLogToOverlay("init", "QTest Recorder injected ✓", "#0f0");
  } // end __setupRecorder
})();`;
