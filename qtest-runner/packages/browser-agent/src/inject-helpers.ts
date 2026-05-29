// ─────────────────────────────────────────────────────────────
// INJECT_SCRIPT helpers — генерируются как части inject-скрипта
// Все функции будут скомпонованы в INJECT_SCRIPT в recorder.ts
// ─────────────────────────────────────────────────────────────

/** composedPath() + deepActiveElement для Shadow DOM */
export const SHADOW_DOM_HELPER = `
// ── Shadow DOM: composedPath + deepActiveElement ──
function __deepEventTarget(event) {
  if (event.composedPath) {
    var path = event.composedPath();
    for (var i = 0; i < path.length; i++) {
      if (path[i].nodeType === 1) return path[i];
    }
  }
  return event.target;
}

function __deepActiveElement(root) {
  if (!root) root = document;
  var el = root.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

function __getInteractiveParent(el) {
  var interactive = ["button","a","input","select","textarea","label","option","summary","details"];
  var cur = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    var t = cur.tagName ? cur.tagName.toLowerCase() : "";
    if (t === "svg" || t === "img" || t === "path" || t === "circle" || t === "g" || t === "use") {
      cur = cur.parentElement; continue;
    }
    if (interactive.indexOf(t) >= 0) return cur;
    var role = cur.getAttribute ? cur.getAttribute("role") : null;
    if (role === "button" || role === "link" || role === "tab" || role === "menuitem" || role === "option" || role === "combobox" || role === "listbox") return cur;
    if (cur.hasAttribute && cur.hasAttribute("onclick")) return cur;
    if (t === "x-pw-action-item") return cur;
    cur = cur.parentElement;
  }
  return el;
}

// ── Smart selector builder (улучшенный) ──
function __getSmartSelector(el) {
  if (!el) return "";
  var t = el;
  // data-testid / data-cy / data-qa / data-test
  var testId = t.getAttribute("data-testid") || t.getAttribute("data-cy") || t.getAttribute("data-qa") || t.getAttribute("data-test");
  if (testId) return '[data-testid="' + testId + '"]';
  // ID (не UUID)
  if (t.id && !t.id.match(/^[a-f0-9-]{8,}$/i) && t.id.length < 50) return "#" + CSS.escape(t.id);
  // name
  if (t.name) return t.tagName.toLowerCase() + '[name="' + CSS.escape(t.name) + '"]';
  // aria-label
  var aria = t.getAttribute("aria-label");
  if (aria) return '[aria-label="' + aria.slice(0, 40).replace(/"/g, '\\"') + '"]';
  // placeholder
  if (t.placeholder) return t.tagName.toLowerCase() + '[placeholder="' + t.placeholder.slice(0, 40).replace(/"/g, '\\"') + '"]';
  // role + text
  var role = t.getAttribute("role");
  if (role) {
    var rt = __getText(t);
    if (rt) return '[role="' + role + '"] >> text=' + rt.slice(0, 40);
    return '[role="' + role + '"]';
  }
  // button / a / label by text
  var tag = t.tagName.toLowerCase();
  if (tag === "button" || tag === "a") {
    var bt = __getText(t);
    if (bt) return tag + " >> text=" + bt.slice(0, 40);
  }
  if (tag === "label") {
    var lt = __getText(t);
    if (lt) return "label >> text=" + lt.slice(0, 40);
  }
  // CSS class (первые 2 класса)
  if (t.className && typeof t.className === "string") {
    var cls = t.className.trim().split(/\\s+/).slice(0, 2).join(".");
    if (cls && cls.length < 60) return tag + "." + CSS.escape(cls).replace(/\\\\./g, ".");
  }
  // nth-child
  var parent = t.parentElement;
  if (parent) {
    var idx = 0;
    var siblings = parent.children;
    for (var i = 0; i < siblings.length; i++) {
      if (siblings[i] === t) { idx = i; break; }
    }
    return tag + ":nth-child(" + (idx + 1) + ")";
  }
  return tag;
}

function __getSelector(el) {
  var target = __getInteractiveParent(el);
  return __getSmartSelector(target);
}

function __getSelectorText(el) {
  var target = __getInteractiveParent(el);
  var text = __getText(target);
  if (text) return text;
  var aria = __getAriaLabel(target);
  if (aria) return aria;
  if (target.placeholder) return target.placeholder;
  if (target.alt) return target.alt;
  if (target.title) return target.title;
  if (target.href) return target.href;
  if (target.name) return target.name;
  return "";
}

function __getNodePath(el) {
  if (!el || el === document.body) return "body";
  var path = [];
  var cur = el;
  while (cur && cur !== document.body) {
    var tag = cur.tagName ? cur.tagName.toLowerCase() : "?";
    if (cur.id) { path.unshift(tag + "#" + cur.id); break; }
    var parent = cur.parentElement;
    if (parent) {
      var idx = 0;
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i] === cur) { idx = i + 1; break; }
      }
      path.unshift(tag + ":nth(" + idx + ")");
    } else {
      path.unshift(tag);
    }
    cur = cur.parentElement;
  }
  return path.join(" > ");
}
`;

/** iframe traversal */
export const IFRAME_HELPER = `
// ── iframe traversal ──
function __getFrameSelector(frameWin) {
  try {
    for (var i = 0; i < window.frames.length; i++) {
      if (window.frames[i] === frameWin) {
        var frameEl = window.frames[i].frameElement;
        if (!frameEl) return "iframe:nth(" + (i+1) + ")";
        var sel = __getSmartSelector(frameEl);
        if (frameEl.name) return 'iframe[name="' + CSS.escape(frameEl.name) + '"]';
        if (frameEl.id) return "#" + CSS.escape(frameEl.id);
        return sel || "iframe:nth(" + (i+1) + ")";
      }
    }
  } catch(e) {}
  return "";
}

function __getFramePath(win) {
  var path = [];
  var cur = win;
  while (cur && cur !== window) {
    try {
      var frameSel = __getFrameSelector(cur);
      if (frameSel) path.unshift(frameSel);
    } catch(e) { path.unshift("iframe[cross-origin]"); break; }
    try { cur = cur.parent; } catch(e) { break; }
  }
  return path.join(" >> ");
}
`;

/** SPA Navigation: pushState/replaceState monkey-patch */
export const SPA_NAV_HELPER = `
// ── SPA Navigation monkey-patch ──
(function() {
  var __origPushState = history.pushState;
  var __origReplaceState = history.replaceState;
  var __lastSpaUrl = location.href;

  history.pushState = function(state, title, url) {
    var result = __origPushState.apply(this, arguments);
    if (url && String(url) !== __lastSpaUrl) {
      var oldUrl = __lastSpaUrl;
      __lastSpaUrl = String(url);
      __record({actionType:"navigate", selector:"", selectorText:String(url), value:oldUrl, spaMethod:"pushState"});
      __addLogToOverlay("spa", String(url), "#0ff");
    }
    return result;
  };

  history.replaceState = function(state, title, url) {
    var result = __origReplaceState.apply(this, arguments);
    if (url && String(url) !== __lastSpaUrl) {
      var oldUrl = __lastSpaUrl;
      __lastSpaUrl = String(url);
      __record({actionType:"navigate", selector:"", selectorText:String(url), value:oldUrl, spaMethod:"replaceState"});
      __addLogToOverlay("spa", String(url), "#0ff");
    }
    return result;
  };

  window.addEventListener("popstate", function(e) {
    var newUrl = location.href;
    if (newUrl !== __lastSpaUrl) {
      var oldUrl = __lastSpaUrl;
      __lastSpaUrl = newUrl;
      __record({actionType:"navigate", selector:"", selectorText:newUrl, value:oldUrl, spaMethod:"popstate"});
      __addLogToOverlay("spa", newUrl, "#0ff");
    }
  });

  window.addEventListener("hashchange", function(e) {
    var newUrl = location.href;
    if (newUrl !== __lastSpaUrl) {
      __lastSpaUrl = newUrl;
      __record({actionType:"navigate", selector:"", selectorText:newUrl, value:e.oldURL || "", spaMethod:"hashchange"});
      __addLogToOverlay("spa", newUrl, "#0ff");
    }
  });
})();
`;

/** Error Tracking: onerror + unhandledrejection */
export const ERROR_TRACKER_HELPER = `
// ── Error Tracking ──
(function() {
  window.addEventListener("error", function(e) {
    var detail = {
      message: e.message || "",
      filename: e.filename || "",
      lineno: e.lineno || 0,
      colno: e.colno || 0,
      stack: (e.error && e.error.stack) ? e.error.stack.slice(0, 500) : ""
    };
    __record({actionType:"js_error", selector:"", selectorText:"window", value:JSON.stringify(detail)});
    __addLogToOverlay("error", "JS: " + (e.message || "").slice(0, 80), "#f00");
  }, true);

  window.addEventListener("unhandledrejection", function(e) {
    var reason = e.reason || {};
    var msg = reason.message || String(reason) || "";
    var stack = reason.stack || "";
    var detail = {message: msg.slice(0, 200), stack: stack.slice(0, 500)};
    __record({actionType:"unhandled_rejection", selector:"", selectorText:"promise", value:JSON.stringify(detail)});
    __addLogToOverlay("error", "Promise: " + msg.slice(0, 80), "#f00");
  }, true);

  // Intercept resource load errors (404 for scripts/styles/images)
  try {
    var __resObserver = new PerformanceObserver(function(list) {
      var entries = list.getEntries();
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.entryType === "resource" && e.initiatorType !== "xmlhttprequest" && e.initiatorType !== "fetch") {
          // Resource loaded successfully - no error
        }
      }
    });
    __resObserver.observe({entryTypes: ["resource"]});
  } catch(e) {}
})();
`;

/** Assertion Engine: генерирует ожидаемый результат после каждого действия */
export const ASSERTION_HELPER = `
// ── Assertion Engine ──
// Генерирует "ожидаемый результат" на основе контекста после действия
var __assertUrlBefore = location.href;
var __assertTitleBefore = document.title;

function __generateAssertion(actionType, data) {
  switch (actionType) {
    case "navigate":
      return {type: "url", expected: "Страница загружена: \\"" + (document.title || "") + "\\"", actual: location.href};
    case "click":
      // Check if URL changed after click
      if (location.href !== __assertUrlBefore) {
        var result = {type: "navigation", expected: "Произошёл переход на страницу", actual: location.href};
        __assertUrlBefore = location.href;
        return result;
      }
      // Check if new element appeared
      return {type: "element_state", expected: "Элемент активирован", actual: "Клик выполнен"};
    case "fill":
    case "input":
      return {type: "value", expected: "Поле содержит значение: \\"" + (data.value || "").slice(0, 60) + "\\"", actual: (data.value || "").slice(0, 60)};
    case "select":
      return {type: "value", expected: "Значение \\"" + (data.value || "") + "\\" выбрано", actual: data.value || ""};
    case "check":
      return {type: "state", expected: "Чекбокс " + (data.checked ? "отмечен" : "снят"), actual: data.checked ? "checked" : "unchecked"};
    case "submit":
      var submitResult = {type: "form_submit", expected: "Форма отправлена", actual: "Отправлено"};
      __assertUrlBefore = location.href;
      return submitResult;
    default:
      return {type: "generic", expected: "Действие выполнено", actual: actionType};
  }
}
`;

/** Jira/Zephyr специфичные детекторы */
export const JIRA_DETECTOR_HELPER = `
// ── Jira / Zephyr специфичные детекторы ──
function __detectJiraEnvironment() {
  var info = {isJira: false, isZephyr: false, isAui: false, isFroala: false, pluginIframes: []};

  // Jira detection
  if (location.hostname.indexOf("jira") >= 0 || location.hostname.indexOf("atlassian") >= 0) {
    info.isJira = true;
  }
  if (document.querySelector("#jira")) info.isJira = true;
  if (document.querySelector(".aui-page-panel")) { info.isJira = true; info.isAui = true; }

  // AUI specific elements
  if (document.querySelector(".aui-select, .aui-select2, aui-select, .aui-dropdown2")) info.isAui = true;
  if (document.querySelector("[data-aui-dropdown-container]")) info.isAui = true;

  // Froala Editor
  if (document.querySelector(".fr-box, .fr-element, [class*='fr-'], #fr-logs")) {
    info.isFroala = true;
  }
  // Froala in iframe
  var allIframes = document.querySelectorAll("iframe");
  for (var fi = 0; fi < allIframes.length; fi++) {
    try {
      var fDoc = allIframes[fi].contentDocument;
      if (fDoc && fDoc.querySelector(".fr-box, .fr-element")) { info.isFroala = true; break; }
    } catch(e) {}
  }

  // Plugin iframes (Zephyr, Structure, Insight)
  for (var pi = 0; pi < allIframes.length; pi++) {
    var src = allIframes[pi].src || "";
    if (src.indexOf("zephyr") >= 0 || src.indexOf("testcase") >= 0) {
      info.isZephyr = true;
      info.pluginIframes.push({type:"zephyr", src: src.slice(0, 100)});
    }
    if (src.indexOf("structure") >= 0) info.pluginIframes.push({type:"structure", src: src.slice(0, 100)});
    if (src.indexOf("insight") >= 0 || src.indexOf("object-schema") >= 0) info.pluginIframes.push({type:"insight", src: src.slice(0, 100)});
  }

  // Jira auto-complete (users, projects, keys)
  if (document.querySelector("#quickSearchInput, .quick-search, [data-aui-autocomplete]")) info.isJira = true;

  // Jira transition screen
  if (document.querySelector("#issue-workflow-transition, .workflow-transition, [data-transition-name]")) info.isJira = true;

  return info;
}

// Запись информации о Jira-окружении при старте
var __jiraEnv = __detectJiraEnvironment();
if (__jiraEnv.isJira || __jiraEnv.isZephyr) {
  __record({actionType:"jira_env", selector:"", selectorText:"detected", value:JSON.stringify(__jiraEnv)});
}
`;

/** Cookie Consent авто-детекция */
export const COOKIE_CONSENT_HELPER = `
// ── Cookie Consent / GDPR авто-детекция ──
var __cookieConsentDetected = false;
var __cookieConsentSelectors = [
  // OneTrust
  ".ot-sdk-container, #onetrust-banner-sdk, .ot-floating-banner, .ot-pc-footer",
  // CookieYes
  ".cky-consent-container, .cky-banner-element, #cookie-law-info-bar",
  // Cookiebot
  "#cookiebanner, #cookie-law, .CybotCookiebotDialog",
  // Generic
  ".cookie-banner, .cookie-consent, .cookies-banner, .cookie-notice, .cookie-bar, .cc-banner, .eu-cookie, .gdpr-cookie, [aria-label*='cookie' i], [class*='cookie' i]",
  // CMP
  "#cmpwrapper, .cmp-wrapper, .cmpbox, #cmpbox",
  // TrustArc
  "#trustarc-banner, .trustarc-banner, .truste-banner",
  // Cookie information
  ".cookie-disclosure, .cookie-info, .cookie-message, .js-cookie-consent"
];

function __checkCookieConsent() {
  for (var cci = 0; cci < __cookieConsentSelectors.length; cci++) {
    var found = document.querySelectorAll(__cookieConsentSelectors[cci]);
    for (var ccj = 0; ccj < found.length; ccj++) {
      var el = found[ccj];
      if (el.offsetParent !== null) {
        // Find accept/dismiss button
        var btn = el.querySelector("button, a, [role='button'], .accept, .btn-primary, .agree, .allow, [data-action='accept'], .cky-btn-accept, #onetrust-accept-btn-handler");
        __record({actionType:"cookie_consent", selector:__getSmartSelector(el), selectorText:"cookie_banner", value:JSON.stringify({vendor: "detected", hasButton: !!btn}), bannerText: (el.textContent || "").slice(0, 100)});
        __addLogToOverlay("cookie", "Cookie banner detected", "#f80");
        __cookieConsentDetected = true;
        return;
      }
    }
  }
}

// Check after page load
setTimeout(__checkCookieConsent, 1000);

// MutationObserver callback — check when DOM changes
var __cookieObs = new MutationObserver(function() {
  if (!__cookieConsentDetected) {
    setTimeout(__checkCookieConsent, 500);
  }
});
__cookieObs.observe(document.body || document.documentElement, {childList: true, subtree: true});
`;

/** Touch / Wheel события */
export const TOUCH_WHEEL_HELPER = `
// ── Touch events ──
document.addEventListener("touchstart", function(e) {
  var el = __deepEventTarget(e);
  if (!el || el === document.body || el === document.documentElement) return;
  var touch = e.touches && e.touches[0];
  __record({actionType:"touchstart", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName, x:(touch ? touch.clientX : 0), y:(touch ? touch.clientY : 0)});
  __addLogToOverlay("touch", "touchstart " + __getSelector(el), "#f0f");
}, true);

document.addEventListener("touchend", function(e) {
  var el = __deepEventTarget(e);
  if (!el || el === document.body || el === document.documentElement) return;
  var touch = e.changedTouches && e.changedTouches[0];
  __record({actionType:"touchend", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName, x:(touch ? touch.clientX : 0), y:(touch ? touch.clientY : 0)});
}, true);

document.addEventListener("touchmove", function(e) {
  var el = __deepEventTarget(e);
  if (!el) return;
  var touch = e.touches && e.touches[0];
  if (touch) {
    __record({actionType:"touchmove", selector:"", selectorText:"swipe", value:"x:" + Math.round(touch.clientX) + " y:" + Math.round(touch.clientY), x:touch.clientX, y:touch.clientY});
  }
}, true);

// ── Wheel (mouse scroll wheel) ──
document.addEventListener("wheel", function(e) {
  var el = __deepEventTarget(e);
  __record({actionType:"wheel", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"deltaX:" + Math.round(e.deltaX) + " deltaY:" + Math.round(e.deltaY) + " deltaZ:" + Math.round(e.deltaZ), deltaX:e.deltaX, deltaY:e.deltaY, deltaZ:e.deltaZ});
  __addLogToOverlay("wheel", "deltaY=" + Math.round(e.deltaY), "#fa0");
}, {passive: true, capture: true});

// ── Drag & Drop ──
var __dragSource = null;
var __dragSourceSelector = "";
var __dragSourceText = "";

document.addEventListener("dragstart", function(e) {
  var el = __deepEventTarget(e);
  if (!el) return;
  __dragSource = el;
  __dragSourceSelector = __getSelector(el);
  __dragSourceText = __getSelectorText(el);
  __record({actionType:"dragstart", selector:__dragSourceSelector, selectorText:__dragSourceText, value:el.tagName, x:e.clientX, y:e.clientY});
  __addLogToOverlay("drag", "Drag start: " + __dragSourceSelector, "#08f");
}, true);

document.addEventListener("dragend", function(e) {
  __dragSource = null;
  __dragSourceSelector = "";
  __dragSourceText = "";
  __record({actionType:"dragend", selector:"", selectorText:"", value:"x:" + e.clientX + " y:" + e.clientY, x:e.clientX, y:e.clientY});
}, true);

document.addEventListener("drop", function(e) {
  var target = __deepEventTarget(e);
  if (!target) return;
  __record({actionType:"drop", selector:__getSelector(target), selectorText:__getSelectorText(target), value:"from:" + __dragSourceSelector + " to:" + __getSelector(target), x:e.clientX, y:e.clientY});
  __addLogToOverlay("drag", "Drop on: " + __getSelector(target), "#08f");
}, true);
`;

/** CSS Animation tracking */
export const ANIMATION_HELPER = `
// ── CSS Animation / Transition tracking ──
document.addEventListener("transitionend", function(e) {
  var el = __deepEventTarget(e);
  if (!el) return;
  __record({actionType:"transition_end", selector:__getSelector(el), selectorText:e.propertyName || "", value:"duration:" + (e.elapsedTime || 0).toFixed(2) + "s"});
  __addLogToOverlay("anim", "transition: " + (e.propertyName || ""), "#0f0");
}, true);

document.addEventListener("animationend", function(e) {
  var el = __deepEventTarget(e);
  if (!el) return;
  __record({actionType:"animation_end", selector:__getSelector(el), selectorText:e.animationName || "", value:"duration:" + (e.elapsedTime || 0).toFixed(2) + "s"});
  __addLogToOverlay("anim", "animation: " + (e.animationName || ""), "#0f0");
}, true);

document.addEventListener("transitionstart", function(e) {
  var el = __deepEventTarget(e);
  if (!el) return;
  __record({actionType:"transition_start", selector:__getSelector(el), selectorText:e.propertyName || "", value:"duration:" + (e.elapsedTime || 0).toFixed(2) + "s"});
}, true);

document.addEventListener("animationstart", function(e) {
  var el = __deepEventTarget(e);
  if (!el) return;
  __record({actionType:"animation_start", selector:__getSelector(el), selectorText:e.animationName || "", value:"duration:" + (e.elapsedTime || 0).toFixed(2) + "s"});
}, true);
`;

/** Page Lifecycle events */
export const LIFECYCLE_HELPER = `
// ── Page Lifecycle ──
document.addEventListener("visibilitychange", function() {
  __record({actionType:"visibility_change", selector:"", selectorText:"page", value:document.hidden ? "hidden" : "visible", hidden:document.hidden});
}, true);

window.addEventListener("pagehide", function(e) {
  __record({actionType:"page_hide", selector:"", selectorText:"page", value:"persisted:" + e.persisted});
}, true);

window.addEventListener("pageshow", function(e) {
  __record({actionType:"page_show", selector:"", selectorText:"page", value:"persisted:" + e.persisted});
}, true);

// ── Dialog Element (HTML native) ──
document.addEventListener("toggle", function(e) {
  var el = e.target;
  if (el && el.tagName && el.tagName.toLowerCase() === "details") {
    __record({actionType:"details_toggle", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.open ? "open" : "closed"});
  }
}, true);

// MutationObserver for dialog open/close
var __dialogObserver = new MutationObserver(function(mutations) {
  for (var i = 0; i < mutations.length; i++) {
    var m = mutations[i];
    if (m.type === "attributes" && m.attributeName === "open") {
      var el = m.target;
      if (el && el.tagName && el.tagName.toLowerCase() === "dialog") {
        __record({actionType:"dialog_element", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.open ? "open" : "closed"});
        __addLogToOverlay("modal", (el.open ? "open" : "close") + " <dialog>", "#f0f");
      }
    }
  }
});
if (document.body) {
  __dialogObserver.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ["open"]});
}
`;

/** CAPTCHA detector */
export const CAPTCHA_DETECTOR_HELPER = `
// ── CAPTCHA детекция (ReCaptcha, Turnstile, hCaptcha) ──
var __captchaDetected = false;

function __checkCaptcha() {
  try {
  // 1. ReCaptcha v2 widget
  var recaptcha = document.querySelectorAll('.g-recaptcha, div[class*="recaptcha"], iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha.google"]');
  for (var rci = 0; rci < recaptcha.length; rci++) {
    __record({actionType:"captcha_detected", selector:__getSmartSelector(recaptcha[rci]), selectorText:"recaptcha_v2", value:"ReCaptcha v2 detected"});
    __addLogToOverlay("captcha", "ReCaptcha v2 detected", "#f44");
    __captchaDetected = true;
  }

  // 2. Turnstile (Cloudflare)
  var turnstile = document.querySelectorAll('.cf-turnstile, div[class*="turnstile"], iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]');
  for (var tsi = 0; tsi < turnstile.length; tsi++) {
    __record({actionType:"captcha_detected", selector:__getSmartSelector(turnstile[tsi]), selectorText:"turnstile", value:"Turnstile (Cloudflare) detected"});
    __addLogToOverlay("captcha", "Turnstile detected", "#f44");
    __captchaDetected = true;
  }

  // 3. hCaptcha
  var hcaptcha = document.querySelectorAll('.h-captcha, iframe[src*="hcaptcha.com"], div[data-hcaptcha]');
  for (var hci = 0; hci < hcaptcha.length; hci++) {
    __record({actionType:"captcha_detected", selector:__getSmartSelector(hcaptcha[hci]), selectorText:"hcaptcha", value:"hCaptcha detected"});
    __addLogToOverlay("captcha", "hCaptcha detected", "#f44");
    __captchaDetected = true;
  }

  // 4. Generic CAPTCHA keywords in attributes/classes
  if (!__captchaDetected) {
    var generic = document.querySelectorAll('[class*="captcha" i], [id*="captcha" i], [class*="captch" i], iframe[src*="captcha"], img[src*="captcha"]');
    for (var gi = 0; gi < generic.length; gi++) {
      __record({actionType:"captcha_detected", selector:__getSmartSelector(generic[gi]), selectorText:"generic_captcha", value:"Generic CAPTCHA detected"});
      __addLogToOverlay("captcha", "Generic CAPTCHA detected", "#f44");
      __captchaDetected = true;
      break;
    }
  }
  } catch(e) {}
}

// Check after page load
setTimeout(function() { try { __checkCaptcha(); } catch(e) {} }, 1500);

// MutationObserver for dynamically loaded CAPTCHAs
try {
var __captchaObs = new MutationObserver(function() {
  if (!__captchaDetected) {
    setTimeout(function() { try { __checkCaptcha(); } catch(e) {} }, 500);
  }
});
__captchaObs.observe(document.body || document.documentElement, {childList: true, subtree: true});
} catch(e) {}
`;

/** File upload handler */
export const FILE_UPLOAD_HELPER = `
// ── File Upload ──
document.addEventListener("change", function(e) {
  var el = e.target;
  if (!el || el.tagName !== "INPUT") return;
  if (el.type === "file") {
    var files = [];
    for (var fi = 0; fi < (el.files || []).length && fi < 5; fi++) {
      files.push(el.files[fi].name);
    }
    __record({actionType:"file_upload", selector:__getSelector(el), selectorText:__getSelectorText(el), value:files.join(", "), fileCount: (el.files || []).length});
    __addLogToOverlay("file", "Upload: " + files.join(", "), "#8f0");
  }
}, true);
`;

export const USER_SWITCH_HELPER = `
// ── User Switch Hotkey (Ctrl+Shift+U) ──
document.addEventListener("keydown", function(e) {
  if (e.ctrlKey && e.shiftKey && (e.key === "u" || e.key === "U")) {
    e.preventDefault();
    var profiles = [];
    try {
      profiles = JSON.parse(localStorage.getItem("__qtest_user_profiles") || "[]");
    } catch(e) {}
    var currentIdx = 0;
    var currentLabel = localStorage.getItem("__qtest_current_user") || "";
    if (currentLabel && profiles.length > 0) {
      for (var pi = 0; pi < profiles.length; pi++) {
        if (profiles[pi].label === currentLabel) { currentIdx = pi; break; }
      }
    }
    var nextIdx = (currentIdx + 1) % (profiles.length || 1);
    var nextLabel = profiles.length > 0 ? (profiles[nextIdx].label || "User " + (nextIdx + 1)) : "User " + (nextIdx + 1);
    localStorage.setItem("__qtest_current_user", nextLabel);
    __record({actionType:"user_switch", value:nextLabel, selectorText:currentLabel || "none", selector:"", url:location.href});
    __addLogToOverlay("switch", "User: " + currentLabel + " → " + nextLabel, "#f80");
  }
}, true);
`;

export const POPOVER_HELPER = `
// ── Popover API (togglepopover, beforetoggle) ──
document.addEventListener("beforetoggle", function(e) {
  var el = e.target;
  if (!el || !el.hasAttribute || !el.hasAttribute("popover")) return;
  var newState = e.newState || "";
  __record({actionType:"popover_toggle", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"beforetoggle → " + newState + " popover=" + el.getAttribute("popover"), url:location.href});
  __addLogToOverlay("popover", "Popover: " + newState, "#fa0");
}, true);

document.addEventListener("toggle", function(e) {
  var el = e.target;
  if (!el || !el.hasAttribute || !el.hasAttribute("popover")) return;
  var newState = e.newState || "";
  if (!newState) return;
  __record({actionType:"popover_toggle", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"toggle → " + newState + " popover=" + el.getAttribute("popover"), url:location.href});
  __addLogToOverlay("popover", "Popover: " + newState, "#fa0");
}, true);
`;

export const MEDIA_EVENTS_HELPER = `
// ── Media Events (video/audio) ──
document.addEventListener("play", function(e) {
  var el = e.target;
  if (!el || !(el.tagName === "VIDEO" || el.tagName === "AUDIO")) return;
  __record({actionType:"media_play", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName + " " + (el.src || "").slice(0,80), url:location.href});
  __addLogToOverlay("media", "Play: " + (el.src || "").slice(0,40), "#2a2");
}, true);

document.addEventListener("pause", function(e) {
  var el = e.target;
  if (!el || !(el.tagName === "VIDEO" || el.tagName === "AUDIO")) return;
  __record({actionType:"media_pause", selector:__getSelector(el), selectorText:__getSelectorText(el), value:el.tagName + " " + (el.src || "").slice(0,80), url:location.href});
  __addLogToOverlay("media", "Pause: " + (el.src || "").slice(0,40), "#a22");
}, true);

document.addEventListener("seeked", function(e) {
  var el = e.target;
  if (!el || !(el.tagName === "VIDEO" || el.tagName === "AUDIO")) return;
  __record({actionType:"media_seeked", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"currentTime=" + Math.round(el.currentTime) + " duration=" + Math.round(el.duration), url:location.href});
  __addLogToOverlay("media", "Seek: " + Math.round(el.currentTime) + "s", "#a2a");
}, true);

document.addEventListener("volumechange", function(e) {
  var el = e.target;
  if (!el || !(el.tagName === "VIDEO" || el.tagName === "AUDIO")) return;
  __record({actionType:"media_volume", selector:__getSelector(el), selectorText:__getSelectorText(el), value:"volume=" + Math.round(el.volume * 100) + "% muted=" + el.muted, url:location.href});
}, true);
`;
