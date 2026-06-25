Index: qtest-runner/_test_cdp.js
===================================================================
const { chromium } = require("playwright");

async function main() {
  console.log("Connecting...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  console.log("Connected!");

  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  console.log("Existing pages:", pages.length);
  
  for (const p of pages) {
    console.log("  Page:", p.url());
  }

  // Use existing page or create new
  let page = pages.length > 0 ? pages[0] : null;
  if (!page) {
    page = await ctx.newPage();
  }

  const title = await page.title();
  console.log("Current tab title:", title);
  console.log("Current URL:", page.url());
  
  await browser.close();
  console.log("Done!");
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
