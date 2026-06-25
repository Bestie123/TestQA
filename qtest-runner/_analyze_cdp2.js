Index: qtest-runner/_analyze_cdp2.js
===================================================================
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const http = require("http");

const CDP_PORT = 9222;
const BASE_URL = "https://jira.ifellow.ru";
const PROJECT_ID = 10904;
const OUT_DIR = path.join(__dirname, "_zephyr_analysis");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function cdpHttpGet(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}${urlPath}`, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on("error", reject);
  });
}

function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const msg = JSON.stringify({ id, method, params });
    const handler = (data) => {
      const resp = JSON.parse(data.toString());
      if (resp.id === id) {
        ws.removeListener("message", handler);
        if (resp.error) reject(new Error(resp.error.message));
        else resolve(resp.result);
      }
    };
    ws.on("message", handler);
    ws.send(msg);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

async function saveFile(name, content) {
  fs.writeFileSync(path.join(OUT_DIR, name), typeof content === "string" ? content : JSON.stringify(content, null, 2), "utf-8");
  log(`Saved ${name}`);
}

async function connectToPage() {
  const targets = await cdpHttpGet("/json");
  // Filter to regular pages (not iframes, not chrome://, not devtools)
  const pages = targets.filter(t => 
    t.type === "page" && 
    !t.url.startsWith("chrome://") && 
    !t.url.startsWith("chrome-untrusted://") &&
    !t.url.startsWith("devtools://")
  );
  
  let target;
  if (pages.length > 0) {
    target = pages[0]; // Use first regular page
    log(`Using existing page: "${target.title}" - ${target.url}`);
  } else {
    // Create new page via browser WebSocket
    log("No regular page found, connecting to browser endpoint to create one...");
    const browserTargets = targets.filter(t => t.type === "browser");
    if (browserTargets.length > 0) {
      target = browserTargets[0];
    } else {
      // Fallback to any target
      target = targets[0];
    }
  }
  
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error("No suitable target found");
  }
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.on("open", async () => {
      log("WebSocket connected");
      
      // If we connected to browser endpoint, create a new page target
      if (target.type === "browser") {
        log("Connected to browser, creating new page...");
        const result = await cdpSend(ws, "Target.createTarget", { url: "about:blank" });
        log(`Created target: ${JSON.stringify(result)}`);
        ws.close();
        
        // Now connect to the new page
        await sleep(500);
        const newTargets = await cdpHttpGet("/json");
        const newPage = newTargets.find(t => t.id === result.targetId);
        if (newPage) {
          log(`Connecting to new page: ${newPage.title}`);
          const ws2 = new WebSocket(newPage.webSocketDebuggerUrl);
          ws2.on("open", () => { log("Connected to new page"); resolve(ws2); });
          ws2.on("error", reject);
        } else {
          reject(new Error("Could not find new page target"));
        }
      } else {
        resolve(ws);
      }
    });
    ws.on("error", reject);
    setTimeout(() => reject(new Error("WebSocket timeout")), 15000);
  });
}

async function screenshot(ws, name) {
  const result = await cdpSend(ws, "Page.captureScreenshot", { format: "png", fromSurface: true });
  const buf = Buffer.from(result.data, "base64");
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), buf);
  log(`Screenshot: ${name}.png`);
}

async function getText(ws) {
  const r = await cdpSend(ws, "Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
  return r.result.value || "";
}

async function evaluate(ws, expression) {
  const r = await cdpSend(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
}

async function getHTML(ws, selector) {
  const expr = selector
    ? `(function(){var e=document.querySelector('${selector.replace(/'/g, "\\'")}');return e?e.outerHTML:'NOT FOUND';})()`
    : "document.documentElement.outerHTML";
  const r = await cdpSend(ws, "Runtime.evaluate", { expression: expr, returnByValue: true });
  return r.result.value;
}

async function clickByText(ws, text) {
  return evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('button, a, [role="button"], [role="tab"], span, div');
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        if(el.textContent && el.textContent.trim() === '${text.replace(/'/g, "\\'")}' && el.offsetParent !== null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
          el.click();
          return {success: true, tag: el.tagName, cls: (el.className||"").slice(0,100)};
        }
      }
      return {success: false, searched: '${text}'};
    })()
  `);
}

async function main() {
  log("=== Zephyr Scale UI Analysis ===");
  
  const ws = await connectToPage();
  
  // Enable Page events
  await cdpSend(ws, "Page.enable");
  await cdpSend(ws, "Runtime.enable");
  
  // ===== PART 1: Test Cases Page =====
  log("\n--- PART 1: Test Cases Page ---");
  
  const testCasesUrl = `${BASE_URL}/secure/Tests.jspa#/v2/testCases?projectId=${PROJECT_ID}`;
  log(`Navigating to: ${testCasesUrl}`);
  await cdpSend(ws, "Page.navigate", { url: testCasesUrl });
  await sleep(6000);
  
  const title1 = await evaluate(ws, "document.title");
  const url1 = await evaluate(ws, "window.location.href");
  log(`Title: ${title1}`);
  log(`URL: ${url1}`);
  
  await screenshot(ws, "01_test_cases_initial");
  
  const bodyText = await getText(ws);
  log("=== Body text (first 4000 chars) ===");
  log(bodyText.slice(0, 4000));
  
  // All buttons
  const buttons = await evaluate(ws, `
    Array.from(document.querySelectorAll('button')).map(function(b,i){
      return {i:i, t:(b.textContent||"").trim().slice(0,80), c:(b.className||"").slice(0,80), id:b.id||"", v:b.offsetParent!==null};
    }).filter(function(b){return b.t.length>0 && b.v})
  `);
  log(`\nButtons (${(buttons||[]).length}):`);
  (buttons||[]).forEach(b => log(`  [${b.i}] '${b.t}'`));
  
  // All clickable items
  const clickables = await evaluate(ws, `
    Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"], [role="menuitem"]')).map(function(el){
      return {t:(el.textContent||"").trim().slice(0,100), tag:el.tagName, r:el.getAttribute("role")||"", h:el.href||"", c:(el.className||"").slice(0,100)};
    }).filter(function(el){return el.t.length>0})
  `);
  log(`\nClickables (${(clickables||[]).length}):`);
  (clickables||[]).forEach(el => log(`  <${el.tag}> '${el.t}' r=${el.r}`));
  
  // Try clicking "Фильтры"
  log('\nClicking "Фильтры"...');
  let r = await clickByText(ws, "Фильтры");
  log(`Result: ${JSON.stringify(r)}`);
  await sleep(2000);
  await screenshot(ws, "02_after_filter_click");
  
  // Check what changed
  let panels = await evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('*');
      var res = [];
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        if(el.offsetParent === null) continue;
        var t = (el.textContent||"").trim();
        var c = (el.className||"").toLowerCase();
        if(t.includes("Добавить критерий") || t.includes("Статус") || t.includes("Приоритет") || t.includes("Автор") || c.includes("filter") || c.includes("criteria")) {
          res.push({t:t.slice(0,150), tag:el.tagName, c:(el.className||"").slice(0,120), id:el.id||"", h:el.outerHTML.slice(0,400)});
        }
      }
      return res;
    })()
  `);
  log(`\nFilter-related visible elements:`);
  (panels||[]).forEach(p => log(`  '${p.t.slice(0,80)}' ${p.tag} id=${p.id}`));
  
  // If "Добавить критерий" appeared, click it
  if ((panels||[]).some(p => p.t === "Добавить критерий")) {
    log('\nClicking "Добавить критерий"...');
    r = await clickByText(ws, "Добавить критерий");
    log(`Result: ${JSON.stringify(r)}`);
    await sleep(1500);
    await screenshot(ws, "03_after_add_criterion");
    
    // Get the dropdown
    const dropdown = await evaluate(ws, `
      (function(){
        var selectors = ['[role="listbox"]','[role="menu"]','[role="dialog"]','[class*="dropdown"]','[class*="menu"]','[class*="popup"]','[class*="select"]','[class*="listbox"]'];
        for(var s=0; s<selectors.length; s++) {
          var els = document.querySelectorAll(selectors[s]);
          for(var i=0; i<els.length; i++) {
            if(els[i].offsetParent !== null) {
              return {sel:selectors[s], text:(els[i].textContent||"").trim().slice(0,800), html:els[i].outerHTML.slice(0,5000), cls:els[i].className};
            }
          }
        }
        return null;
      })()
    `);
    log(`\nDropdown after add criterion: ${JSON.stringify(dropdown, null, 2).slice(0,4000)}`);
    
    if (dropdown) await saveFile("criteria_dropdown.html", dropdown.html || dropdown.text);
  }
  
  // Save full HTML
  const html1 = await getHTML(ws);
  await saveFile("01_test_cases.html", html1);
  
  // ===== PART 2: Test Cycles Page =====
  log("\n--- PART 2: Test Cycles ---");
  
  const cyclesUrl = `${BASE_URL}/secure/Tests.jspa#/v2/testCycles?projectId=${PROJECT_ID}`;
  await cdpSend(ws, "Page.navigate", { url: cyclesUrl });
  await sleep(5000);
  await screenshot(ws, "04_test_cycles");
  
  const cyclesText = await getText(ws);
  log("Cycles body (first 2000):");
  log(cyclesText.slice(0, 2000));
  
  const cyclesHTML = await getHTML(ws);
  await saveFile("02_test_cycles.html", cyclesHTML);
  
  // Check filter on cycles
  r = await clickByText(ws, "Фильтры");
  log(`Cycles filter click: ${JSON.stringify(r)}`);
  await sleep(1500);
  await screenshot(ws, "05_cycles_filter");
  
  // ===== PART 3: Configuration tab =====
  log("\n--- PART 3: Configuration ---");
  
  const navItems = await evaluate(ws, `
    Array.from(document.querySelectorAll('a, button, [role="tab"]')).map(function(el){
      return {t:(el.textContent||"").trim().slice(0,60), tag:el.tagName, h:el.href||"", v:el.offsetParent!==null};
    }).filter(function(el){return el.t.length>0 && el.v})
  `);
  
  const uniqueTabs = [];
  const seen = new Set();
  (navItems||[]).forEach(n => { if (!seen.has(n.t)) { seen.add(n.t); uniqueTabs.push(n); } });
  log(`Nav items:`);
  uniqueTabs.forEach(n => log(`  '${n.t}' ${n.tag}`));
  
  // Try clicking "Конфигурация"
  const hasConfig = uniqueTabs.some(n => n.t === "Конфигурация");
  if (hasConfig) {
    log('\nClicking "Конфигурация"...');
    r = await clickByText(ws, "Конфигурация");
    log(`Result: ${JSON.stringify(r)}`);
    await sleep(3000);
    await screenshot(ws, "06_config_tab");
    const configText = await getText(ws);
    log("Config page (first 2000):");
    log(configText.slice(0, 2000));
    const configHTML = await getHTML(ws);
    await saveFile("03_config.html", configHTML);
  } else {
    log("No Config tab found");
  }
  
  // ===== PART 4: Sidebar =====
  log("\n--- PART 4: Sidebar ---");
  
  await cdpSend(ws, "Page.navigate", { url: testCasesUrl });
  await sleep(4000);
  await screenshot(ws, "07_sidebar");
  
  const layout = await evaluate(ws, `
    (function(){
      // Get the main page structure
      var body = document.body;
      var children = [];
      for(var i=0; i<Math.min(body.children.length, 10); i++) {
        var c = body.children[i];
        children.push({
          tag: c.tagName,
          id: c.id || "",
          cls: (c.className||"").slice(0,100),
          rect: c.getBoundingClientRect(),
          text: (c.textContent||"").trim().slice(0,100)
        });
      }
      return children;
    })()
  `);
  log(`Body direct children (${(layout||[]).length}):`);
  (layout||[]).forEach(l => log(`  <${l.tag}> id=${l.id} cls=${l.cls} [${Math.round(l.rect.x)},${Math.round(l.rect.y)} ${Math.round(l.rect.w)}x${Math.round(l.rect.h)}]`));
  
  // Look for any element with folder-like content on the left side
  const leftContent = await evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('*');
      var items = [];
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        if(el.offsetParent === null) continue;
        var r = el.getBoundingClientRect();
        if(r.x < 250 && r.width > 100 && r.height > 20) {
          var t = (el.textContent||"").trim();
          if(t.length > 2 && t.length < 200) {
            items.push({t:t.slice(0,100), tag:el.tagName, cls:(el.className||"").slice(0,80), rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.w),h:Math.round(r.h)}});
          }
        }
      }
      return items.slice(0,40);
    })()
  `);
  log(`\nLeft-side content (${(leftContent||[]).length}):`);
  (leftContent||[]).forEach(item => log(`  [${item.rect.x},${item.rect.y} ${item.rect.w}x${item.rect.h}] '${item.t.slice(0,80)}' ${item.tag} ${item.cls}`));
  
  // ===== PART 5: Settings URLs =====
  log("\n--- PART 5: Settings URLs ---");
  
  const settingsUrls = [
    `${BASE_URL}/secure/Tests.jspa#/v2/configuration?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/settings?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/apiTokens?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/admin?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/admin/ZephyrScaleConfiguration!default.jspa`,
    `${BASE_URL}/plugins/servlet/zephyr/configuration`
  ];
  
  for (const url of settingsUrls) {
    log(`Trying: ${url}`);
    try {
      await cdpSend(ws, "Page.navigate", { url });
      await sleep(3000);
      const body = await getText(ws);
      if (body.length > 100 && !body.toLowerCase().includes("page not found") && !body.includes("404")) {
        log(`  >>> FOUND: ${body.slice(0,300)}`);
        await screenshot(ws, "08_settings_page");
        const html = await getHTML(ws);
        await saveFile("04_settings.html", html);
        break;
      } else {
        log(`  No content: ${body.slice(0,200)}`);
      }
    } catch(e) {
      log(`  Error: ${e.message}`);
    }
  }
  
  ws.close();
  log("\n=== Complete! ===");
}

main().catch(e => {
  console.error("FATAL:", e.message, e.stack?.slice(0,500));
  process.exit(1);
});
