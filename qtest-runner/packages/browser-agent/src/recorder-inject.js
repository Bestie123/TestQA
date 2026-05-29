// This script is injected into every page via Playwright
(function() {
  var filledValues = {};
  var inputTimers = {};
  var lastUrl = location.href;

  function getInteractiveParent(el) {
    var interactive = ["button","a","input","select","textarea","label"];
    var cur = el;
    while (cur && cur !== document.body) {
      var t = cur.tagName.toLowerCase();
      if (interactive.indexOf(t) >= 0) return cur;
      if (cur.getAttribute("role") === "button" || cur.getAttribute("role") === "link") return cur;
      if (cur.hasAttribute("onclick")) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function getSelector(el) {
    var t = getInteractiveParent(el);
    if (t.id) return "#" + t.id;
    if (t.className && typeof t.className === "string") {
      var cls = t.className.trim().split(/\s+/).slice(0,2).join(".");
      if (cls) return t.tagName.toLowerCase() + "." + cls;
    }
    return t.tagName.toLowerCase();
  }

  function getSelectorText(el) {
    var t = getInteractiveParent(el);
    var text = (t.textContent || "").trim().slice(0, 60);
    if (text) return text;
    if (t.placeholder) return t.placeholder;
    if (t.alt) return t.alt;
    if (t.title) return t.title;
    if (t.href) return t.href;
    return "";
  }

  function record(data) {
    data.url = location.href;
    data.pageTitle = document.title;
    data.timestamp = new Date().toISOString();
    if (window.__recordAction) window.__recordAction(data);
  }

  document.addEventListener("click", function(e) {
    var el = e.target;
    if (!el) return;
    var tag = el.tagName.toLowerCase();
    if (tag === "html" || tag === "body") return;
    record({actionType:"click",selector:getSelector(el),selectorText:getSelectorText(el),value:""});
  }, true);

  document.addEventListener("input", function(e) {
    var el = e.target;
    if (!el) return;
    var tag = el.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea") return;
    var key = getSelector(el);
    var val = el.value || "";
    if (inputTimers[key]) clearTimeout(inputTimers[key]);
    inputTimers[key] = setTimeout(function() {
      delete inputTimers[key];
      var prev = filledValues[key] || "";
      if (val !== prev) {
        filledValues[key] = val;
        if (val) record({actionType:"fill",selector:key,selectorText:getSelectorText(el),value:val});
      }
    }, 400);
  }, true);

  document.addEventListener("change", function(e) {
    var el = e.target;
    if (!el) return;
    var tag = el.tagName.toLowerCase();
    if (tag === "select") {
      record({actionType:"select",selector:getSelector(el),selectorText:getSelectorText(el),value:el.value||""});
      return;
    }
    if (tag === "input" || tag === "textarea") {
      var key = getSelector(el);
      if (inputTimers[key]) { clearTimeout(inputTimers[key]); delete inputTimers[key]; }
      var val = el.value || "";
      var prev = filledValues[key] || "";
      if (val !== prev) {
        filledValues[key] = val;
        if (val) record({actionType:"fill",selector:key,selectorText:getSelectorText(el),value:val});
      }
    }
  }, true);

  document.addEventListener("dragend", function(e) {
    var el = e.target;
    if (!el) return;
    record({actionType:"drag",selector:getSelector(el),selectorText:getSelectorText(el),value:""});
  }, true);

  document.addEventListener("submit", function(e) {
    var form = e.target;
    if (!form) return;
    record({actionType:"submit",selector:getSelector(form),selectorText:form.id||"form",value:""});
  }, true);

  setInterval(function() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      record({actionType:"navigate",selector:"",selectorText:location.href,value:""});
    }
  }, 500);
})();
