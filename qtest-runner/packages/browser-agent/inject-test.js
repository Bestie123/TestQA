const { chromium } = require('playwright');
(async () => {
  const path = require('path');
  const profileDir = path.join(__dirname, '.inject-test-profile2');
  const ctx = await chromium.launchPersistentContext(profileDir, { headless: true });
  const pages = ctx.pages();
  const page = pages[0];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('__QTEST_') || text.includes('__PAGE_INIT__')) {
      console.log(`[CAPTURED] type=${msg.type()} text=${text.slice(0, 120)}`);
    }
  });

  console.log('page.addInitScript...');
  await page.addInitScript(`(function() {
    console.debug('__PAGE_INIT__runs');
    window.__injectedByPageInit = true;
  })()`);
  console.log('addInitScript OK');

  console.log('Navigating...');
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('--- after goto ---');
  await new Promise(r => setTimeout(r, 1000));

  const injected1 = await page.evaluate(() => window.__injectedByPageInit);
  console.log('__injectedByPageInit:', injected1);

  await ctx.close();
  console.log('DONE');
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
