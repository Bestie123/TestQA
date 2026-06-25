const { chromium } = require('playwright');
const fs = require('fs');

// Load INJECT_SCRIPT from recorder.ts
const recorderSrc = fs.readFileSync(__dirname + '/src/recorder.ts', 'utf8');
const injectMatch = recorderSrc.match(/const INJECT_SCRIPT = `([\s\S]*?)`;/);
const INJECT_SCRIPT = injectMatch ? injectMatch[1] : '';

// Extract helpers from inject-helpers.ts  
const helperSrc = fs.readFileSync(__dirname + '/src/inject-helpers.ts', 'utf8');
const helperNames = [
  'SHADOW_DOM_HELPER','IFRAME_HELPER','SPA_NAV_HELPER','ERROR_TRACKER_HELPER',
  'ASSERTION_HELPER','JIRA_DETECTOR_HELPER','COOKIE_CONSENT_HELPER','CAPTCHA_DETECTOR_HELPER',
  'TOUCH_WHEEL_HELPER','ANIMATION_HELPER','LIFECYCLE_HELPER','FILE_UPLOAD_HELPER'
];

// Replace template placeholders with empty strings (simplified)
let resolvedScript = INJECT_SCRIPT;
for (const name of helperNames) {
  resolvedScript = resolvedScript.replace('${' + name + '}', '');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // EXACTLY like browser-agent's startRecording
  await page.addInitScript(resolvedScript);
  await page.exposeFunction('__recordAction', (data) => {
    console.log('EXPOSED __recordAction:', JSON.stringify(data));
  });
  
  page.on('framenavigated', (frame) => {
    console.log('framenavigated:', frame.url(), 'isMain=' + (frame === page.mainFrame()));
  });
  page.on('load', () => {
    console.log('load:', page.url());
  });
  page.on('domcontentloaded', () => {
    console.log('domcontentloaded:', page.url());
  });
  
  console.log('\n--- Navigate to captcha-test.html ---');
  await page.goto('http://localhost:9090/captcha-test.html', { waitUntil: 'load', timeout: 5000 });
  console.log('goto OK, url=', page.url());
  
  // Check if init script ran
  const injectRan = await page.evaluate(() => {
    return { injected: !!window.__qtestRecorderInjected, record: typeof window.__recordAction };
  });
  console.log('Inject script state:', JSON.stringify(injectRan));
  
  console.log('\n--- Navigate to / ---');
  await page.goto('http://localhost:9090/', { waitUntil: 'load', timeout: 5000 });
  console.log('goto OK, url=', page.url());
  
  const injectRan2 = await page.evaluate(() => {
    return { injected: !!window.__qtestRecorderInjected, record: typeof window.__recordAction };
  });
  console.log('After nav2 inject state:', JSON.stringify(injectRan2));
  
  await browser.close();
})();
