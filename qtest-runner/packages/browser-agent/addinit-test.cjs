const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Add init script BEFORE navigation (like browser-agent does)
  await page.addInitScript(`
    (function() {
      window.__testInitRan = true;
      window.__testTimestamp = Date.now();
    })();
  `);
  
  // Expose function (like browser-agent does)
  await page.exposeFunction('__recordAction', (data) => {
    console.log('exposed function called:', JSON.stringify(data));
  });
  
  page.on('framenavigated', (frame) => {
    console.log('framenavigated:', frame.url(), 'isMain=' + (frame === page.mainFrame()));
  });
  page.on('load', () => {
    console.log('load:', page.url());
  });
  
  console.log('\n--- First navigate to captcha-test.html ---');
  try {
    await page.goto('http://localhost:9090/captcha-test.html', { waitUntil: 'networkidle', timeout: 5000 });
    console.log('goto OK, url=', page.url());
    const initRan = await page.evaluate(() => window.__testInitRan);
    console.log('init script ran:', initRan);
  } catch (e) { console.log('FAILED:', e.message.slice(0,120)); }
  
  console.log('\n--- Second navigate to / ---');
  try {
    await page.goto('http://localhost:9090/', { waitUntil: 'networkidle', timeout: 5000 });
    console.log('goto OK, url=', page.url());
  } catch (e) { console.log('FAILED:', e.message.slice(0,120)); }
  
  await browser.close();
})();
