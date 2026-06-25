Index: qtest-runner/_analyze_cdp.js
===================================================================
// Direct CDP analysis script - uses raw WebSocket to Chrome DevTools Protocol
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const http = require("http");

const CDP_PORT = 9222;
const BASE_URL = "https://jira.ifellow.ru";
const PROJECT_ID = 10904;
const OUT_DIR = path.join(__dirname, "_zephyr_analysis");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Helper: GET JSON from CDP
function cdpHttpGet(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}${urlPath}`, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on("error", reject);
  });
}

// Helper: Send CDP command via WebSocket
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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`);
}

async function saveFile(name, content) {
  fs.writeFileSync(path.join(OUT_DIR, name), typeof content === "string" ? content : JSON.stringify(content, null, 2), "utf-8");
  log(`Saved ${name}`);
}

async function connectToPage(url) {
  // Get all targets
  const targets = await cdpHttpGet("/json");
  log(`Found ${targets.length} targets`);
  
  // Look for existing page with this URL or create new
  let target = targets.find(t => t.url === url || t.url.startsWith(url.split("?")[0]));
  
  if (!target) {
    // Create a new page by connecting to browser endpoint and calling Target.createTarget
    log("No existing page found, need to create one...");
    // For now, let's just use the first available page that might work
    target = targets[0]; // Use the first regular page
  }
  
  log(`Using target: ${target.title} - ${target.url}`);
  
  // Connect to the page's WebSocket
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.on("open", async () => {
      log("WebSocket connected to page");
      resolve(ws);
    });
    ws.on("error", reject);
    setTimeout(() => reject(new Error("WebSocket connection timeout")), 15000);
  });
}

async function screenshot(ws, name) {
  const result = await cdpSend(ws, "Page.captureScreenshot", { format: "png", fromSurface: true });
  const buf = Buffer.from(result.data, "base64");
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), buf);
  log(`Screenshot: ${name}.png`);
}

async function getText(ws) {
  const result = await cdpSend(ws, "Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true
  });
  return result.result.value || "";
}

async function evaluate(ws, expression) {
  const result = await cdpSend(ws, "Runtime.evaluate", {
    expression,
    returnByValue: true
  });
  return result.result.value;
}

async function getHTML(ws, selector) {
  const expr = selector 
    ? `(function(){var e=document.querySelector('${selector.replace(/'/g, "\\'")}');return e?e.outerHTML:'NOT FOUND';})()`
    : "document.documentElement.outerHTML";
  const result = await cdpSend(ws, "Runtime.evaluate", {
    expression: expr,
    returnByValue: true
  });
  return result.result.value;
}

async function click(ws, text) {
  return evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('button, a, [role="button"], [role="tab"], span, div');
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        if(el.textContent && el.textContent.trim() === '${text.replace(/'/g, "\\'")}' && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    })()
  `);
}

async function clickCss(ws, selector) {
  return evaluate(ws, `
    (function(){
      var el = document.querySelector('${selector.replace(/'/g, "\\'")}');
      if(el) { el.click(); return true; }
      return false;
    })()
  `);
}

async function findAllButtons(ws) {
  return evaluate(ws, `
    (function(){
      var buttons = document.querySelectorAll('button');
      return Array.from(buttons).map(function(b,i){
        return {index:i, text:(b.textContent||"").trim().slice(0,100), cls:(b.className||"").slice(0,100), id:b.id||"", visible:b.offsetParent!==null};
      }).filter(function(b){return b.text.length>0 && b.visible});
    })()
  `);
}

async function findAllClickable(ws) {
  return evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('button, a, [role="button"], [role="tab"], [role="menuitem"]');
      return Array.from(all).map(function(el){
        return {
          tag: el.tagName,
          text: (el.textContent||"").trim().slice(0,120),
          cls: (el.className||"").slice(0,150),
          id: el.id||"",
          role: el.getAttribute("role")||"",
          href: el.href||"",
          visible: el.offsetParent!==null
        };
      }).filter(function(el){return el.text.length>0 && el.visible});
    })()
  `);
}

async function main() {
  log("=== Zephyr Scale UI Analysis ===");
  
  const ws = await connectToPage();
  
  // ======================
  // PART 1: Test Cases Page
  // ======================
  log("\n--- PART 1: Test Cases Page ---");
  
  // Navigate to test cases page
  const testCasesUrl = `${BASE_URL}/secure/Tests.jspa#/v2/testCases?projectId=${PROJECT_ID}`;
  log(`Navigating to: ${testCasesUrl}`);
  
  await cdpSend(ws, "Page.enable");
  await cdpSend(ws, "Page.navigate", { url: testCasesUrl });
  // Wait for page to load
  await sleep(5000);
  
  // Check current URL
  const currentUrl = await evaluate(ws, "window.location.href");
  log(`Current URL: ${currentUrl}`);
  
  const pageTitle = await evaluate(ws, "document.title");
  log(`Page title: ${pageTitle}`);
  
  await screenshot(ws, "01_test_cases_initial");
  
  // Get all visible text
  const text = await getText(ws);
  log("=== Page body text (first 3000 chars) ===");
  log(text.slice(0, 3000));
  
  // Get all buttons
  const buttons = await findAllButtons(ws);
  log(`\n=== All buttons (${buttons.length}) ===`);
  buttons.forEach(b => log(`  [${b.index}] '${b.text}' cls=${b.cls}`));
  
  // Get all clickable elements
  const clickables = await findAllClickable(ws);
  log(`\n=== All clickable elements (${clickables.length}) ===`);
  clickables.forEach(el => log(`  <${el.tag}> '${el.text}' role=${el.role} href=${(el.href||"").slice(0,80)}`));
  
  // Look for filter-specific elements
  const filterEls = await evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('*');
      var results = [];
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        var text = (el.textContent||"").trim();
        if((text === "Фильтры" || text === "Добавить критерий" || text.includes("Сохраненный фильтр")) && el.offsetParent !== null) {
          results.push({tag: el.tagName, text: text, cls: el.className, id: el.id, html: el.outerHTML.slice(0,500)});
        }
      }
      return results;
    })()
  `);
  log(`\n=== Filter-related elements ===`);
  log(JSON.stringify(filterEls, null, 2));
  
  // Click "Фильтры" button
  log("\nClicking 'Фильтры'...");
  const clicked = await click(ws, "Фильтры");
  log(`Clicked: ${clicked}`);
  await sleep(2000);
  await screenshot(ws, "02_after_filter_click");
  
  // Get HTML of filter panel area
  const filterHTML = await evaluate(ws, `
    (function(){
      var selectors = [
        '[class*="filter"]','[class*="Filter"]',
        '[class*="sidebar"]','[class*="Sidebar"]',
        '[class*="panel"]','[class*="Panel"]',
        '[class*="drawer"]','[class*="Drawer"]'
      ];
      for(var s=0; s<selectors.length; s++) {
        var el = document.querySelector(selectors[s]);
        if(el && el.offsetParent !== null) return {sel: selectors[s], html: el.outerHTML.slice(0,20000)};
      }
      return null;
    })()
  `);
  
  if (filterHTML) {
    log(`Filter panel found with selector: ${filterHTML.sel}`);
    await saveFile("filter_panel.html", filterHTML.html);
    log("Filter panel HTML (first 3000):");
    log(filterHTML.html.slice(0, 3000));
  } else {
    log("Filter panel not found by class selectors");
    
    // Let's look more broadly for what changed after clicking
    const afterClickHTML = await getHTML(ws);
    await saveFile("after_filter_click_full.html", afterClickHTML);
    log("Saved full HTML after filter click");
  }
  
  // Check if "Добавить критерий" is now visible
  const addCriterionBtn = await evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('*');
      for(var i=0; i<all.length; i++) {
        var t = (all[i].textContent||"").trim();
        if(t === "Добавить критерий" && all[i].offsetParent !== null) {
          return {html: all[i].outerHTML.slice(0,1000), tag: all[i].tagName, cls: all[i].className};
        }
      }
      return null;
    })()
  `);
  log(`\n"Добавить критерий" button: ${JSON.stringify(addCriterionBtn)}`);
  
  if (addCriterionBtn) {
    // Click it
    log("Clicking 'Добавить критерий'...");
    const clicked2 = await click(ws, "Добавить критерий");
    log(`Clicked: ${clicked2}`);
    await sleep(1500);
    await screenshot(ws, "03_after_add_criterion");
    
    // Now look for the criteria dropdown
    const criteriaDropdown = await evaluate(ws, `
      (function(){
        var selectors = [
          '[role="listbox"]','[role="menu"]','[role="dialog"]',
          '[class*="dropdown"]','[class*="Dropdown"]',
          '[class*="menu"]','[class*="Menu"]',
          '[class*="popup"]','[class*="Popup"]',
          '[class*="select"]','[class*="Select"]',
          '[class*="option"]','[class*="Option"]',
          '[class*="listbox"]','[class*="Listbox"]'
        ];
        for(var s=0; s<selectors.length; s++) {
          var els = document.querySelectorAll(selectors[s]);
          if(els.length > 0) {
            var items = [];
            for(var i=0; i<els.length; i++) {
              var el = els[i];
              if(el.offsetParent !== null) {
                items.push({
                  text: (el.textContent||"").trim().slice(0,500),
                  html: el.outerHTML.slice(0,2000),
                  cls: el.className
                });
              }
            }
            if(items.length > 0) return {selector: selectors[s], items: items};
          }
        }
        
        // Search for any visible menu-like element
        var all = document.querySelectorAll('div, ul');
        var visible = [];
        for(var i=0; i<all.length; i++) {
          var d = all[i];
          if(d.offsetParent !== null && d.children.length > 0 && d.children.length < 30) {
            var text = (d.textContent||"").trim();
            if(text.length > 0 && text.length < 500 && (text.includes("Статус") || text.includes("Приоритет") || text.includes("Автор") || text.includes("Тип"))) {
              visible.push({text: text.slice(0,300), cls: d.className, tag: d.tagName, html: d.outerHTML.slice(0,1000)});
            }
          }
        }
        return {potentials: visible};
      })()
    `);
    log(`\n=== Criteria dropdown ===`);
    log(JSON.stringify(criteriaDropdown, null, 2).slice(0, 5000));
  }
  
  // Save full page HTML
  const fullHTML1 = await getHTML(ws);
  await saveFile("01_test_cases_full.html", fullHTML1);
  
  // ======================
  // PART 2: Test Cycles Page
  // ======================
  log("\n--- PART 2: Test Cycles Page ---");
  
  const cyclesUrl = `${BASE_URL}/secure/Tests.jspa#/v2/testCycles?projectId=${PROJECT_ID}`;
  log(`Navigating to: ${cyclesUrl}`);
  await cdpSend(ws, "Page.navigate", { url: cyclesUrl });
  await sleep(5000);
  await screenshot(ws, "04_test_cycles_initial");
  
  const cyclesText = await getText(ws);
  log("=== Cycles page (first 2000 chars) ===");
  log(cyclesText.slice(0, 2000));
  
  // Check for filter button on cycles page
  const cyclesFilter = await evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('*');
      for(var i=0; i<all.length; i++) {
        var t = (all[i].textContent||"").trim();
        if(t === "Фильтры" && all[i].offsetParent !== null) {
          return {tag: all[i].tagName, text: t, cls: all[i].className};
        }
      }
      return null;
    })()
  `);
  log(`Cycles filter button: ${JSON.stringify(cyclesFilter)}`);
  
  if (cyclesFilter) {
    await click(ws, "Фильтры");
    await sleep(1500);
    await screenshot(ws, "05_cycles_after_filter");
    log("Clicked filter on cycles page");
  }
  
  // Save cycles page HTML
  const cyclesHTML = await getHTML(ws);
  await saveFile("02_test_cycles_full.html", cyclesHTML);
  
  // ======================
  // PART 3: Navigation tabs / Configuration
  // ======================
  log("\n--- PART 3: Navigation Tabs ---");
  
  // Look for the tab bar / navigation
  const navTabs = await evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('a, button, [role="tab"], [role="navigation"] a');
      var tabs = [];
      var seen = new Set();
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        var text = (el.textContent||"").trim();
        if(text.length > 0 && text.length < 50 && el.offsetParent !== null && !seen.has(text)) {
          seen.add(text);
          tabs.push({tag: el.tagName, text: text, cls: (el.className||"").slice(0,150), href: el.href||"", role: el.getAttribute("role")||""});
        }
      }
      return tabs;
    })()
  `);
  log(`\n=== Navigation tabs (${navTabs.length}) ===`);
  navTabs.forEach(t => log(`  '${t.text}' tag=${t.tag} href=${(t.href||"").slice(0,100)}`));
  
  // Look specifically for "Конфигурация" tab
  const configTab = navTabs.find(t => 
    t.text === "Конфигурация" || t.text === "Configuration" || 
    t.text.toLowerCase().includes("конфиг") || t.text.toLowerCase().includes("настройк")
  );
  
  if (configTab) {
    log(`\nFound config tab: "${configTab.text}"`);
    await click(ws, configTab.text);
    await sleep(3000);
    await screenshot(ws, "06_config_tab");
    
    const configText = await getText(ws);
    log("=== Config page text (first 2000 chars) ===");
    log(configText.slice(0, 2000));
    
    const configHTML = await getHTML(ws);
    await saveFile("03_config_page.html", configHTML);
  } else {
    log("\nNo Config tab found in navigation. Trying direct navigation...");
    
    // Try to find "Конфигурация" anywhere visible
    const configAnywhere = await evaluate(ws, `
      (function(){
        var all = document.querySelectorAll('*');
        for(var i=0; i<all.length; i++) {
          var t = (all[i].textContent||"").trim();
          if(t === "Конфигурация" && all[i].offsetParent !== null) {
            return {tag: all[i].tagName, text: t, cls: all[i].className, html: all[i].outerHTML.slice(0,600)};
          }
        }
        return null;
      })()
    `);
    log(`Config element search: ${JSON.stringify(configAnywhere)}`);
  }
  
  // ======================
  // PART 4: Sidebar / Folder Tree
  // ======================
  log("\n--- PART 4: Sidebar / Folder Tree ---");
  
  // Navigate back to test cases
  await cdpSend(ws, "Page.navigate", { url: testCasesUrl });
  await sleep(4000);
  await screenshot(ws, "07_sidebar_initial");
  
  // Look for sidebar elements
  const sidebarEls = await evaluate(ws, `
    (function(){
      var results = {};
      var selectors = [
        'aside','nav','[class*="sidebar"]','[class*="Sidebar"]',
        '[class*="folder"]','[class*="Folder"]',
        '[class*="tree"]','[class*="Tree"]',
        '[class*="navigation"]','[class*="Navigation"]',
        '[class*="panel-left"]','[class*="panelLeft"]',
        '[class*="left-panel"]','[class*="leftPanel"]'
      ];
      for(var s=0; s<selectors.length; s++) {
        var els = document.querySelectorAll(selectors[s]);
        if(els.length > 0) {
          var el = els[0];
          results[selectors[s]] = {
            count: els.length,
            visible: el.offsetParent !== null,
            tag: el.tagName,
            cls: (el.className||"").slice(0,200),
            rect: el.offsetParent !== null ? el.getBoundingClientRect() : null,
            text: (el.textContent||"").trim().slice(0,300)
          };
        }
      }
      return results;
    })()
  `);
  log("\n=== Sidebar elements ===");
  log(JSON.stringify(sidebarEls, null, 2).slice(0, 3000));
  
  // Look for folder tree structure
  const folderTree = await evaluate(ws, `
    (function(){
      // Try to find tree/folder structure by looking at the layout
      var all = document.querySelectorAll('*');
      var folders = [];
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        var cls = el.className || "";
        var text = (el.textContent||"").trim();
        if(text.length > 0 && text.length < 100 && el.offsetParent !== null) {
          // Look for elements that might be part of a tree
          var style = window.getComputedStyle(el);
          var isList = style.display === "flex" || style.display === "block";
          if(isList && text.match(/^[A-ZА-Я]/) && el.children.length <= 3) {
            var parent = el.parentElement;
            if(parent && parent.children.length > 2 && parent.children.length < 30) {
              folders.push({
                text: text.slice(0,80),
                tag: el.tagName,
                cls: cls.slice(0,100),
                parentTag: parent.tagName,
                siblings: parent.children.length,
                rect: el.getBoundingClientRect()
              });
            }
          }
        }
      }
      return folders.slice(0,30);
    })()
  `);
  log(`\n=== Potential folder tree items (${folderTree.length}) ===`);
  folderTree.forEach(f => log(`  '${f.text}' tag=${f.tag} siblings=${f.siblings} rect=${JSON.stringify(f.rect)}`));
  
  // ======================
  // PART 5: Direct settings URL exploration
  // ======================
  log("\n--- PART 5: Settings URL exploration ---");
  
  const settingsUrls = [
    `${BASE_URL}/secure/Tests.jspa#/v2/configuration?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/settings?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/apiTokens?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/admin?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/admin/ZephyrScaleConfiguration!default.jspa`,
    `${BASE_URL}/plugins/servlet/zephyr/configuration`,
    `${BASE_URL}/secure/ZephyrScaleSetup!default.jspa`
  ];
  
  for (const url of settingsUrls) {
    log(`Trying: ${url}`);
    try {
      await cdpSend(ws, "Page.navigate", { url });
      await sleep(3000);
      const body = await getText(ws);
      const first500 = body.slice(0, 500);
      log(`  Response: ${first500}`);
      
      if (body.length > 100 && !body.toLowerCase().includes("page not found") && !body.includes("404")) {
        log(`  >>> FOUND CONTENT!`);
        await screenshot(ws, `08_settings_screenshot`);
        const html = await getHTML(ws);
        await saveFile("04_settings_page.html", html);
        break;
      }
    } catch(e) {
      log(`  Error: ${e.message}`);
    }
  }
  
  // ======================
  // PART 6: Detailed filter analysis (try clicking on saved filter)
  // ======================
  log("\n--- PART 6: Detailed filter interaction ---");
  
  // Navigate to test cases again
  await cdpSend(ws, "Page.navigate", { url: testCasesUrl });
  await sleep(4000);
  
  // Look for the filter area more carefully - maybe it's a dropdown/select
  const allInteractive = await evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('*');
      var items = [];
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        if(el.offsetParent === null) continue;
        var text = (el.textContent||"").trim();
        var cls = el.className || "";
        
        // Match various filter-related texts
        if(text.match(/^(Фильтры|Добавить критерий|Сохраненный фильтр|Все тест-кейсы|Статус|Приоритет|Автор|Тип|Компонент|Исправлено в версии|Связан с|Создан|Обновлен)/) || 
           cls.toLowerCase().includes("filter") || 
           cls.toLowerCase().includes("criteria") ||
           el.getAttribute("data-testid") === "filter") {
          items.push({
            text: text.slice(0,100),
            tag: el.tagName,
            cls: cls.slice(0,150),
            id: el.id || "",
            role: el.getAttribute("role") || "",
            tabIndex: el.getAttribute("tabindex") || "",
            html: el.outerHTML.slice(0,400)
          });
        }
      }
      return items;
    })()
  `);
  log(`\n=== All interactive filter elements ===`);
  log(JSON.stringify(allInteractive, null, 2));
  
  // Try clicking "Фильтры" with the exact text
  log("\nTrying to click 'Фильтры' by exact text...");
  const clickResult = await evaluate(ws, `
    (function(){
      var all = document.querySelectorAll('*');
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        if((el.textContent||"").trim() === "Фильтры" && el.offsetParent !== null) {
          console.log("Found Фильтры element:", el.tagName, el.className);
          el.click();
          return {success: true, tag: el.tagName, cls: el.className, html: el.outerHTML.slice(0,500)};
        }
      }
      return {success: false};
    })()
  `);
  log(`Click result: ${JSON.stringify(clickResult)}`);
  await sleep(2000);
  
  // After clicking filter, look at the page state again  
  const afterFilter = await evaluate(ws, `
    (function(){
      // Look for any visible panels or expanded sections
      var all = document.querySelectorAll('*');
      var panels = [];
      for(var i=0; i<all.length; i++) {
        var el = all[i];
        if(el.offsetParent === null) continue;
        var text = (el.textContent||"").trim();
        var cls = el.className.toLowerCase();
        
        if(cls.includes("filter") || cls.includes("panel") || cls.includes("drawer") || 
           cls.includes("sidebar") || cls.includes("expanded") || cls.includes("open") ||
           cls.includes("visible") || text.includes("Статус") || text.includes("Приоритет") ||
           text.includes("Автор")) {
          var rect = el.getBoundingClientRect();
          panels.push({
            text: text.slice(0,150),
            tag: el.tagName,
            cls: el.className.slice(0,150),
            rect: {x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height)}
          });
        }
      }
      return panels.slice(0,30);
    })()
  `);
  log(`\n=== After filter - visible panels/sections (${afterFilter.length}) ===`);
  afterFilter.forEach(p => log(`  '${p.text.slice(0,80)}' [${p.rect.x},${p.rect.y} ${p.rect.w}x${p.rect.h}] ${p.cls.slice(0,80)}`));
  
  await screenshot(ws, "09_after_filter_detailed");
  
  // Close WebSocket
  ws.close();
  log("\n=== Analysis complete! ===");
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
