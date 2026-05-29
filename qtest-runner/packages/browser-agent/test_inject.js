const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const content = fs.readFileSync(__dirname + '/dist/recorder.js', 'utf8');
  const match = content.match(/INJECT_SCRIPT = `([\s\S]*?)`;/);
  const script = match[1];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.evaluate(script);
    console.log('FULL SCRIPT: OK');
  } catch(e) {
    console.log('FULL SCRIPT FAILED:', e.message.split('\n')[0]);
    // Binary search for the problematic section
    const lines = script.split('\n');
    let lo = 0, hi = lines.length;
    while (hi - lo > 5) {
      const mid = Math.floor((lo + hi) / 2);
      const chunk = lines.slice(lo, mid).join('\n');
      try {
        await page.evaluate(chunk);
        lo = mid;
      } catch(e2) {
        hi = mid;
      }
    }
    console.log('Problem between lines', lo, '-', hi);
    console.log('Context:');
    for (let i = Math.max(0, lo-2); i < Math.min(lines.length, hi+3); i++) {
      console.log('  ' + (i+1) + ': ' + lines[i]);
    }
  }

  await browser.close();
}

main().catch(e => console.error(e.message));
