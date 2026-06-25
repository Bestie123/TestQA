import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PORT = 9225;
const URL = 'https://devjira.ifellow.ru/secure/Tests.jspa#/testCase/IBPA-T6124?projectId=10904';

async function main() {
  console.log(`Connecting to Chrome CDP on port ${PORT}...`);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const ctx = browser.contexts()[0];
  const pages = ctx?.pages() || [];
  const page = pages.length > 0 ? pages[0] : null;
  
  if (!page) {
    console.log('No page found, creating new tab...');
    const newPage = await ctx.newPage();
    await navigateAndCapture(newPage);
  } else {
    await navigateAndCapture(page);
  }
  
  await browser.close();
}

async function navigateAndCapture(page) {
  const requests = [];
  const responses = [];
  
  page.on('request', req => {
    if (req.url().includes('devjira.ifellow.ru')) {
      requests.push({
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        postData: req.postData(),
      });
    }
  });
  
  page.on('response', async res => {
    if (res.url().includes('devjira.ifellow.ru')) {
      let body = '';
      try { body = await res.text(); } catch {}
      responses.push({
        url: res.url(),
        status: res.status(),
        body: body.slice(0, 2000),
      });
    }
  });

  console.log('Navigating to Zephyr page...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  
  console.log(`\nCaptured ${requests.length} requests, ${responses.length} responses\n`);
  
  // Save results
  const result = { requests, responses };
  fs.writeFileSync(
    path.resolve('zephyr-api-capture.json'),
    JSON.stringify(result, null, 2)
  );
  console.log('Saved to zephyr-api-capture.json');
  
  // Print summary
  console.log('\n=== REQUESTS ===');
  for (const r of requests) {
    console.log(`  ${r.method} ${r.url.replace('https://devjira.ifellow.ru', '')}`);
  }
  
  console.log('\n=== RESPONSES ===');
  for (const r of responses) {
    const short = r.url.replace('https://devjira.ifellow.ru', '');
    console.log(`  ${r.status} ${short} (${r.body.length} bytes)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
