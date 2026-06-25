const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // Load the actual INJECT_SCRIPT from the dist file
  const distPath = path.join(__dirname, 'dist', 'recorder.js');
  const distSrc = require('fs').readFileSync(distPath, 'utf8');

  // Evaluate the dist file to get INJECT_SCRIPT
  // The dist file exports functions that reference INJECT_SCRIPT
  // We need to extract it differently:
  // Require the module and get the script
  const recorder = require('./dist/recorder.js');

  // The recorder module has internal references to INJECT_SCRIPT
  // Let's check what's exported
  console.log("Module exports:", Object.keys(recorder));

  // Try to get the inject script source - the recorder module
  // might expose functions that log it. Let's try a different approach.
  let injectScript = '';
  
  // Extract the template literal from dist file
  const injStart = distSrc.indexOf('const INJECT_SCRIPT');
  const injEnd = distSrc.indexOf('`;', injStart + 10000);
  // The template literal starts at the backtick after `= `
  const btStart = distSrc.indexOf('`', injStart);
  const rawTemplate = distSrc.substring(btStart + 1, injEnd);

  // Get the inject-helpers module values
  const helpers = require('./dist/inject-helpers.js');
  console.log("Helpers exports:", Object.keys(helpers));
  console.log("CAPTCHA_DETECTOR_HELPER length:", helpers.CAPTCHA_DETECTOR_HELPER?.length);
  console.log("SHADOW_DOM_HELPER length:", helpers.SHADOW_DOM_HELPER?.length);
  
  // Reconstruct INJECT_SCRIPT by substituting template values
  injectScript = distSrc.substring(btStart + 1, injEnd);
  // Manually substitute known helpers
  if (helpers.SHADOW_DOM_HELPER) injectScript = injectScript.replace('${inject_helpers_1.SHADOW_DOM_HELPER}', helpers.SHADOW_DOM_HELPER);
  if (helpers.IFRAME_HELPER) injectScript = injectScript.replace('${inject_helpers_1.IFRAME_HELPER}', helpers.IFRAME_HELPER);
  if (helpers.SPA_NAV_HELPER) injectScript = injectScript.replace('${inject_helpers_1.SPA_NAV_HELPER}', helpers.SPA_NAV_HELPER);
  if (helpers.ERROR_TRACKER_HELPER) injectScript = injectScript.replace('${inject_helpers_1.ERROR_TRACKER_HELPER}', helpers.ERROR_TRACKER_HELPER);
  if (helpers.ASSERTION_HELPER) injectScript = injectScript.replace('${inject_helpers_1.ASSERTION_HELPER}', helpers.ASSERTION_HELPER);
  if (helpers.JIRA_DETECTOR_HELPER) injectScript = injectScript.replace('${inject_helpers_1.JIRA_DETECTOR_HELPER}', helpers.JIRA_DETECTOR_HELPER);
  if (helpers.COOKIE_CONSENT_HELPER) injectScript = injectScript.replace('${inject_helpers_1.COOKIE_CONSENT_HELPER}', helpers.COOKIE_CONSENT_HELPER);
  if (helpers.CAPTCHA_DETECTOR_HELPER) injectScript = injectScript.replace('${inject_helpers_1.CAPTCHA_DETECTOR_HELPER}', helpers.CAPTCHA_DETECTOR_HELPER);
  if (helpers.TOUCH_WHEEL_HELPER) injectScript = injectScript.replace('${inject_helpers_1.TOUCH_WHEEL_HELPER}', helpers.TOUCH_WHEEL_HELPER);
  if (helpers.ANIMATION_HELPER) injectScript = injectScript.replace('${inject_helpers_1.ANIMATION_HELPER}', helpers.ANIMATION_HELPER);
  if (helpers.LIFECYCLE_HELPER) injectScript = injectScript.replace('${inject_helpers_1.LIFECYCLE_HELPER}', helpers.LIFECYCLE_HELPER);
  if (helpers.FILE_UPLOAD_HELPER) injectScript = injectScript.replace('${inject_helpers_1.FILE_UPLOAD_HELPER}', helpers.FILE_UPLOAD_HELPER);

  // Verify eval result
  console.log("\nAfter substitution:");
  console.log("  Contains __getSmartSelector:", injectScript.includes('__getSmartSelector'));
  console.log("  Contains __checkCaptcha:", injectScript.includes('__checkCaptcha'));
  console.log("  Contains captcha_detected:", injectScript.includes('captcha_detected'));
  console.log("  Contains inject_helpers_:", injectScript.includes('inject_helpers_'));
  console.log("  Contains ${:", injectScript.includes('${'));
  
  // Check for unresolved templates
  const unresolved = injectScript.match(/\$\{[^}]+\}/g);
  if (unresolved && unresolved.length > 0) {
    console.log("\n  UNRESOLVED templates:", unresolved.join(', '));
  } else {
    console.log("\n  All templates resolved!");
  }

  // Launch browser and test
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  let recordedActions = [];
  
  // Set up the console listener (same as in recorder.ts)
  page.on('console', async msg => {
    const text = msg.text();
    if (text.startsWith('__QTEST_ACTION__')) {
      try {
        const action = JSON.parse(text.substring(16));
        recordedActions.push(action);
        console.log(`[ACT] ${action.actionType}: ${action.value || action.selector || ''}`);
      } catch(e) {
        console.log(`[PARSE ERROR] ${text.substring(0, 100)}`);
      }
    }
  });
  
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log(`[NAV] ${frame.url()}`);
    }
  });
  
  page.on('load', () => {
    console.log(`[LOAD] ${page.url()}`);
  });
  
  // Register __recordAction
  await page.exposeFunction('__recordAction', (data) => {
    recordedActions.push(data);
    console.log(`[ACT-expose] ${data.actionType}: ${data.value || data.selector || ''}`);
  });
  
  // Add init script with the SUBSTITUTED inject script
  await page.addInitScript(injectScript);
  
  // Navigate to the test page
  console.log("\nNavigating...");
  await page.goto('http://localhost:9090/', { waitUntil: 'networkidle' });
  
  // Wait for CAPTCHA detection timeout (1.5s + buffer)
  await page.waitForTimeout(3000);
  
  console.log(`\nRecorded ${recordedActions.length} actions:`);
  recordedActions.forEach(a => {
    console.log(`  [${a.actionType}] ${JSON.stringify(a).substring(0, 120)}`);
  });
  
  // Also check if inject script was installed
  const injectedFlag = await page.evaluate(() => window.__qtestRecorderInjected);
  const setupDone = await page.evaluate(() => window.__qtestSetupDone);
  console.log(`\nInject flag: ${injectedFlag}`);
  
  // Check CAPTCHA elements directly
  const captchaCheck = await page.evaluate(() => {
    return {
      recaptcha: document.querySelectorAll('.g-recaptcha').length,
      turnstile: document.querySelectorAll('.cf-turnstile').length,
      hcaptcha: document.querySelectorAll('.h-captcha').length
    };
  });
  console.log('CAPTCHA elements on page:', captchaCheck);
  
  await page.waitForTimeout(1000);
  await browser.close();
})().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
