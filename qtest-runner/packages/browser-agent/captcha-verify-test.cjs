const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:9090/captcha-test.html', { waitUntil: 'domcontentloaded' });
  
  const script = `
    (function() {
      var __captchaDetected = false;
      function __record(data) { window.__lastCaptchaData = data; }
      function __addLogToOverlay(type, text, color) { window.__lastCaptchaLog = {type, text, color}; }
      function __getSmartSelector(el) { return el ? (el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ').filter(Boolean).join('.') : '')) : ''; }
      
      var recaptcha = document.querySelectorAll('.g-recaptcha');
      if (recaptcha.length > 0) {
        __record({actionType:'captcha_detected', selector:__getSmartSelector(recaptcha[0]), selectorText:'recaptcha_v2', value:'ReCaptcha v2 detected'});
        window.__captchaDetected = true;
      }
      
      var turnstile = document.querySelectorAll('.cf-turnstile');
      if (turnstile.length > 0) {
        __record({actionType:'captcha_detected', selector:__getSmartSelector(turnstile[0]), selectorText:'turnstile', value:'Turnstile detected'});
        window.__captchaDetected = true;
      }
      
      var hcaptcha = document.querySelectorAll('.h-captcha');
      if (hcaptcha.length > 0) {
        __record({actionType:'captcha_detected', selector:__getSmartSelector(hcaptcha[0]), selectorText:'hcaptcha', value:'hCaptcha detected'});
        window.__captchaDetected = true;
      }
      
      window.__captchaResult = window.__lastCaptchaData;
    })();
  `;
  
  await page.evaluate(script);
  await new Promise(r => setTimeout(r, 100));
  
  const result = await page.evaluate(() => window.__captchaResult);
  const detected = await page.evaluate(() => window.__captchaDetected);
  
  console.log('CAPTCHA detected:', detected);
  console.log('CAPTCHA result:', JSON.stringify(result));
  
  await browser.close();
})();
