Index: qtest-runner/_analyze_zephyr_ui.js
===================================================================
// Comprehensive Zephyr Scale UI Analysis Script
// Connects to Chrome DevTools on port 9222 and analyzes the Zephyr Scale pages

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CDP_PORT = 9222;
const BASE_URL = 'https://jira.ifellow.ru';
const PROJECT_ID = 10904;

const OUT_DIR = path.join(__dirname, '_zephyr_analysis');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function saveHtml(filename, html) {
  fs.writeFileSync(path.join(OUT_DIR, filename), html, 'utf-8');
  log(`Saved ${filename} (${html.length} chars)`);
}

async function screenshot(page, name) {
  const buf = await page.screenshot({ type: 'png', fullPage: false });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), buf);
  log(`Screenshot saved: ${name}.png`);
}

async function run() {
  log('Connecting to Chrome via CDP...');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  log('Connected!');

  const ctx = browser.contexts()[0];
  let page = ctx?.pages()?.[0];

  if (!page) {
    page = await ctx.newPage();
  }

  // Set a large viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  // ==============================
  // PART 1: Test Cases Page - Filter System
  // ==============================
  log('\n=== PART 1: Test Cases Page ===');
  
  // 1. Navigate to test cases page
  const testCasesUrl = `${BASE_URL}/secure/Tests.jspa#/v2/testCases?projectId=${PROJECT_ID}`;
  log(`Navigating to: ${testCasesUrl}`);
  await page.goto(testCasesUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);
  
  // Get page title and URL
  const title1 = await page.title();
  const url1 = page.url();
  log(`Page title: ${title1}`);
  log(`Current URL: ${url1}`);
  
  // Screenshot of initial page
  await screenshot(page, '01_test_cases_initial');
  
  // Get all visible text
  const bodyText = await page.evaluate(() => document.body.innerText);
  log('=== Page body text ===');
  log(bodyText.slice(0, 5000));

  // 2. Find and click the filter button
  log('\n--- Searching for filter button ---');
  
  const filterButtons = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="button"], a');
    const results = [];
    buttons.forEach((b, i) => {
      const text = b.textContent.trim().toLowerCase();
      if (text.includes('фильтр') || text.includes('filter') || text.includes('добавить') || text.includes('критерий')) {
        results.push({
          index: i,
          tag: b.tagName,
          text: b.textContent.trim().slice(0, 100),
          class: b.className?.slice(0, 200),
          id: b.id,
          rect: b.getBoundingClientRect() ? `${b.getBoundingClientRect().x},${b.getBoundingClientRect().y}` : 'N/A'
        });
      }
    });
    return results;
  });
  
  log(`Filter-related buttons found: ${filterButtons.length}`);
  filterButtons.forEach(b => log(JSON.stringify(b, null, 2)));

  // Get more comprehensive button listing
  const allButtons = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    return Array.from(buttons).map((b, i) => ({
      index: i,
      text: b.textContent.trim().slice(0, 100) || '(icon)',
      innerHTML: b.innerHTML.slice(0, 200),
      class: b.className?.slice(0, 200),
      id: b.id || '(none)'
    }));
  });
  log(`\nAll buttons (${allButtons.length}):`);
  allButtons.forEach(b => log(`  [${b.index}] '${b.text}' class=${b.class?.slice(0,100)} id=${b.id}`));

  // Get the main layout structure
  const layoutStructure = await page.evaluate(() => {
    const el = document.querySelector('#zephyr-app') || document.querySelector('#ak-main-content') || document.querySelector('[class*="zephyr"]');
    return el ? el.outerHTML.slice(0, 10000) : 'NOT FOUND';
  });
  log('\n=== Layout structure ===');
  log(layoutStructure.slice(0, 3000));

  // Try to find the filter panel
  const filterPanelHTML = await page.evaluate(() => {
    const selectors = [
      '[class*="filter"]', '[class*="Filter"]', 
      '[class*="criteria"]', '[class*="Criteria"]',
      '[class*="search"]', '[class*="Search"]',
      '[data-testid*="filter"]',
      '[aria-label*="фильтр"]', '[aria-label*="Filter"]'
    ];
    const results = {};
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results[sel] = els.length;
      }
    }
    return JSON.stringify(results, null, 2);
  });
  log('\n=== Filter-related elements ===');
  log(filterPanelHTML);

  // Close all modals/popups first
  await page.keyboard.press('Escape');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(500);

  // Try to click the most likely filter button
  const filterBtnFound = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.textContent?.trim() === 'Фильтры' && el.offsetParent !== null) {
        return { tag: el.tagName, text: el.textContent.trim(), class: el.className, id: el.id };
      }
    }
    return null;
  });
  log(`\nФильтры button element: ${JSON.stringify(filterBtnFound)}`);

  // Click "Фильтры" if found
  if (filterBtnFound) {
    await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.textContent?.trim() === 'Фильтры' && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    });
    await sleep(1500);
    await screenshot(page, '02_after_filter_click');
    log('Clicked "Фильтры" button');
  }

  // Get HTML after filter click
  const filterAreaHTML = await page.evaluate(() => {
    const selectors = [
      '[class*="filter"]', '[class*="Filter"]', 
      '[class*="sidebar"]', '[class*="Sidebar"]',
      '[class*="panel"]', '[class*="Panel"]',
      '[class*="drawer"]', '[class*="Drawer"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        return { selector: sel, html: el.outerHTML.slice(0, 15000) };
      }
    }
    return null;
  });
  
  if (filterAreaHTML) {
    log(`\nFilter area HTML (${filterAreaHTML.selector}):`);
    log(filterAreaHTML.html.slice(0, 5000));
    await saveHtml('filter_panel.html', filterAreaHTML.html);
  }

  // Try to click "Добавить критерий" (Add criterion)
  await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if ((text === 'Добавить критерий' || text === 'Add criterion') && el.offsetParent !== null) {
        el.click();
        return true;
      }
    }
    return false;
  });
  await sleep(1000);
  await screenshot(page, '03_after_add_criterion');

  // Get dropdown content
  const dropdownHTML = await page.evaluate(() => {
    const selectors = [
      '[role="listbox"]', '[role="menu"]', '[role="dialog"]',
      '[class*="dropdown"]', '[class*="Dropdown"]',
      '[class*="menu"]', '[class*="Menu"]',
      '[class*="popup"]', '[class*="Popup"]',
      '[class*="select"]', '[class*="Select"]',
      '[class*="option"]', '[class*="Option"]',
      '[class*="listbox"]', '[class*="Listbox"]'
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        return {
          selector: sel,
          count: els.length,
          html: Array.from(els).map(el => ({
            text: el.textContent.trim().slice(0, 500),
            html: el.outerHTML.slice(0, 2000),
            classes: el.className
          }))
        };
      }
    }
    
    const allDivs = document.querySelectorAll('div');
    const visibleElements = Array.from(allDivs).filter(d => {
      const style = window.getComputedStyle(d);
      return d.offsetParent !== null && 
             style.display !== 'none' && 
             style.visibility !== 'hidden' &&
             !['', '0px'].includes(d.offsetWidth + '') &&
             d.children.length > 0 &&
             d.children.length < 30;
    });
    
    return {
      visible: true,
      total: allDivs.length,
      visibleCount: visibleElements.length,
      recent: visibleElements.slice(-10).map(d => ({
        text: d.textContent.trim().slice(0, 300),
        classes: d.className,
        tag: d.tagName
      }))
    };
  });
  
  log('\n=== Dropdown/menu HTML ===');
  log(JSON.stringify(dropdownHTML, null, 2).slice(0, 8000));

  // Get the full HTML of the page for analysis
  const fullHTML = await page.evaluate(() => document.documentElement.outerHTML);
  await saveHtml('01_test_cases_full.html', fullHTML);

  // ==============================
  // PART 2: Test Cycles Page
  // ==============================
  log('\n=== PART 2: Test Cycles Page ===');
  
  const cyclesUrl = `${BASE_URL}/secure/Tests.jspa#/v2/testCycles?projectId=${PROJECT_ID}`;
  log(`Navigating to: ${cyclesUrl}`);
  await page.goto(cyclesUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);
  
  await screenshot(page, '04_test_cycles_initial');
  
  const cyclesBodyText = await page.evaluate(() => document.body.innerText);
  log('=== Cycles page body text ===');
  log(cyclesBodyText.slice(0, 3000));

  const cyclesFullHTML = await page.evaluate(() => document.documentElement.outerHTML);
  await saveHtml('02_test_cycles_full.html', cyclesFullHTML);

  const cyclesFilterBtn = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text === 'Фильтры' && el.offsetParent !== null) {
        return { tag: el.tagName, text: el.textContent.trim(), class: el.className, id: el.id, rect: el.getBoundingClientRect() };
      }
    }
    return null;
  });
  log(`\nCycles "Фильтры" button: ${JSON.stringify(cyclesFilterBtn)}`);

  if (cyclesFilterBtn) {
    await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.textContent?.trim() === 'Фильтры' && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    });
    await sleep(1500);
    await screenshot(page, '05_cycles_after_filter');
    log('Clicked "Фильтры" on cycles page');
  }

  // ==============================
  // PART 3: Settings / Configuration Tab
  // ==============================
  log('\n=== PART 3: Settings / Configuration ===');
  
  const tabButtons = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, a, [role="tab"]');
    return Array.from(buttons).map(b => ({
      text: b.textContent.trim().slice(0, 100),
      href: b.href || '',
      class: b.className?.slice(0, 200),
      role: b.getAttribute('role') || ''
    })).filter(b => b.text.length > 0);
  });
  log(`\nAll tab/button texts on cycles page:`);
  tabButtons.forEach(b => log(`  '${b.text}' href=${b.href?.slice(0,100) || '-'} role=${b.role}`));

  const configBtn = tabButtons.find(b => 
    b.text.toLowerCase().includes('конфиг') || 
    b.text.toLowerCase().includes('настройк') ||
    b.text.toLowerCase().includes('setting') ||
    b.text.toLowerCase().includes('config')
  );
  
  if (configBtn) {
    log(`\nFound config tab: ${configBtn.text}`);
    await page.evaluate((text) => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.textContent?.trim() === text && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    }, configBtn.text);
    await sleep(3000);
    await screenshot(page, '06_config_tab');
    
    const configText = await page.evaluate(() => document.body.innerText);
    log('=== Config page body text ===');
    log(configText.slice(0, 3000));
    
    const configHTML = await page.evaluate(() => document.documentElement.outerHTML);
    await saveHtml('03_config_page.html', configHTML);
  } else {
    log('\nNo config tab found in buttons. Looking more broadly...');
    
    const configLink = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const text = el.textContent?.trim() || '';
        if ((text === 'Конфигурация' || text === 'Configuration' || text === 'Настройки') && el.offsetParent !== null) {
          return { tag: el.tagName, text, class: el.className, href: el.href || '' };
        }
      }
      return null;
    });
    log(`Config link search: ${JSON.stringify(configLink)}`);
    
    if (configLink) {
      await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const text = el.textContent?.trim() || '';
          if ((text === 'Конфигурация' || text === 'Configuration' || text === 'Настройки') && el.offsetParent !== null) {
            el.click();
            return true;
          }
        }
        return false;
      });
      await sleep(3000);
      await screenshot(page, '07_config_page');
    }
  }

  // ==============================
  // PART 4: Sidebar / Folder tree
  // ==============================
  log('\n=== PART 4: Sidebar / Folder Tree ===');
  
  await page.goto(testCasesUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);
  await screenshot(page, '08_sidebar_initial');

  const sidebarInfo = await page.evaluate(() => {
    const selectors = [
      '[class*="sidebar"]', '[class*="Sidebar"]',
      '[class*="folder"]', '[class*="Folder"]',
      '[class*="tree"]', '[class*="Tree"]',
      '[class*="navigation"]', '[class*="Navigation"]',
      '[class*="nav"]', '[class*="Nav"]',
      'nav', 'aside',
      '[class*="folder-tree"]', '[class*="folderTree"]',
      '[class*="treeview"]', '[class*="TreeView"]',
      '[class*="explorer"]', '[class*="Explorer"]',
      '[class*="panel-left"]', '[class*="panelLeft"]',
      '[class*="left-panel"]', '[class*="leftPanel"]'
    ];
    
    const results = {};
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        const el = els[0];
        results[sel] = {
          count: els.length,
          visible: el.offsetParent !== null,
          tag: el.tagName,
          classes: el.className,
          firstChild: el.children[0]?.tagName || '',
          text: el.textContent.trim().slice(0, 500),
          childCount: el.children.length,
          rect: el.getBoundingClientRect()
        };
      }
    }
    return results;
  });
  
  log('\n=== Sidebar/folder tree elements ===');
  log(JSON.stringify(sidebarInfo, null, 2).slice(0, 5000));

  const folderElements = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    const folders = [];
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      const cls = el.className || '';
      if ((text.includes('папк') || cls.toLowerCase().includes('folder') || cls.includes('TreeNode')) && el.offsetParent !== null) {
        folders.push({
          tag: el.tagName,
          text: text.slice(0, 200),
          classes: cls.slice(0, 200),
          childCount: el.children.length
        });
      }
    }
    return folders.slice(0, 20);
  });
  log(`\nFolder-like elements:`);
  folderElements.forEach(f => log(JSON.stringify(f)));

  const sidebarHTML = await page.evaluate(() => {
    const elements = document.querySelectorAll('aside, [class*="sidebar"], [class*="Sidebar"], [class*="panel-left"], [class*="leftPanel"]');
    for (const el of elements) {
      if (el.offsetParent !== null && el.textContent.trim().length > 50) {
        return { tag: el.tagName, class: el.className, html: el.outerHTML.slice(0, 15000) };
      }
    }
    return null;
  });
  
  if (sidebarHTML) {
    log(`\nSidebar HTML (${sidebarHTML.tag}.${sidebarHTML.class}):`);
    log(sidebarHTML.html.slice(0, 5000));
    await saveHtml('sidebar.html', sidebarHTML.html);
  }

  // ==============================
  // PART 5: Direct navigation to settings
  // ==============================
  log('\n=== PART 5: Direct navigation to settings ===');
  
  const possibleUrls = [
    `${BASE_URL}/secure/Tests.jspa#/v2/configuration?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/settings?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/admin?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/apiTokens?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/Tests.jspa#/v2/config?projectId=${PROJECT_ID}`,
    `${BASE_URL}/secure/admin/ZephyrConfiguration!default.jspa`,
    `${BASE_URL}/secure/ZephyrConfiguration!default.jspa`
  ];
  
  for (const tryUrl of possibleUrls) {
    log(`Trying URL: ${tryUrl}`);
    try {
      await page.goto(tryUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);
      const body = await page.evaluate(() => document.body.innerText);
      log(`  Body (first 500): ${body.slice(0, 500)}`);
      if (body.length > 100 && !body.includes('page not found') && !body.includes('Page Not Found') && !body.includes('404')) {
        log(`  >>> FOUND CONTENT at ${tryUrl}`);
        await screenshot(page, `09_settings_${(tryUrl.split('#').pop() || 'unknown').split('?')[0]}`);
        const html = await page.evaluate(() => document.documentElement.outerHTML);
        await saveHtml(`settings_${(tryUrl.split('#').pop() || 'unknown').split('?')[0]}.html`, html);
        break;
      }
    } catch (e) {
      log(`  Error: ${e.message}`);
    }
  }

  // ==============================
  // PART 6: Detailed DOM exploration
  // ==============================
  log('\n=== PART 6: Detailed DOM Exploration ===');
  
  await page.goto(testCasesUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(2000);
  
  const appStructure = await page.evaluate(() => {
    function getStructure(el, depth = 0) {
      if (depth > 5 || !el || el.children.length === 0) return null;
      const result = {
        tag: el.tagName,
        class: (el.className || '').slice(0, 100),
        id: el.id || '',
        text: (el.textContent || '').trim().slice(0, 100),
        children: []
      };
      for (let i = 0; i < Math.min(el.children.length, 10); i++) {
        const child = getStructure(el.children[i], depth + 1);
        if (child) result.children.push(child);
      }
      return result;
    }
    
    const appRoot = document.querySelector('#zephyr-app') || 
                    document.querySelector('#ak-main-content') || 
                    document.querySelector('#root') ||
                    document.querySelector('#app') ||
                    document.querySelector('[data-testid]') ||
                    document.querySelector('[class*="zephyr"]');
    if (appRoot) return getStructure(appRoot);
    return getStructure(document.body);
  });
  
  log('=== App structure ===');
  log(JSON.stringify(appStructure, null, 2).slice(0, 10000));
  await saveHtml('app_structure.json', JSON.stringify(appStructure, null, 2));

  const clickableElements = await page.evaluate(() => {
    const clickables = document.querySelectorAll('button, a, [role="button"], [role="tab"], [role="menuitem"], [onclick]');
    return Array.from(clickables).map(el => ({
      tag: el.tagName,
      text: el.textContent.trim().slice(0, 150),
      class: (el.className || '').slice(0, 200),
      id: el.id || '',
      role: el.getAttribute('role') || '',
      href: el.href || '',
      visible: el.offsetParent !== null,
      rect: el.offsetParent !== null ? `${Math.round(el.getBoundingClientRect().x)},${Math.round(el.getBoundingClientRect().y)} - ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}` : 'hidden'
    })).filter(el => el.visible && el.text.length > 0);
  });
  
  log(`\n=== All visible clickable elements (${clickableElements.length}) ===`);
  clickableElements.forEach(el => log(`  <${el.tag}> '${el.text}' [${el.rect}] role=${el.role} class=${(el.class || '').slice(0,80)}`));

  await browser.close();
  log('\n=== Analysis complete! ===');
  log(`Output directory: ${OUT_DIR}`);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
