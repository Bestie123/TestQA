import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";
import { z } from "zod";

const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);

let browser: any = null;
let page: any = null;

async function connectCDP() {
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    const ctx = browser.contexts()[0];
    const pages = ctx?.pages() || [];
    page = pages.length > 0 ? pages[0] : null;
  } catch (e: any) {
    throw new Error(`CDP connect failed: ${e.message}. Start Chrome with --remote-debugging-port=${CDP_PORT}`);
  }
}

const server = new McpServer({ name: "chrome-devtools", version: "0.1.0" });

server.tool("cdp_navigate",
  "Navigate Chrome to URL",
  { url: z.string().describe("URL to navigate to") },
  async ({ url }) => {
    if (!page) await connectCDP();
    await page!.goto(url, { waitUntil: "domcontentloaded" });
    return { content: [{ type: "text", text: `Navigated to ${url}\nTitle: ${await page!.title()}` }] };
  }
);

server.tool("cdp_screenshot",
  "Take screenshot of current page",
  {},
  async () => {
    if (!page) await connectCDP();
    const buf = await page!.screenshot({ type: "png" });
    return { content: [{ type: "image", data: buf.toString("base64"), mimeType: "image/png" }] };
  }
);

server.tool("cdp_evaluate",
  "Run JavaScript in page context and return result",
  { code: z.string().describe("JavaScript code") },
  async ({ code }) => {
    if (!page) await connectCDP();
    const result = await page!.evaluate(code);
    return { content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
  }
);

server.tool("cdp_get_html",
  "Get full page HTML (or by selector)",
  { selector: z.string().optional().describe("CSS selector") },
  async ({ selector }) => {
    if (!page) await connectCDP();
    const html = await page!.evaluate((sel: string) => {
      if (sel) { const el = document.querySelector(sel); return el ? el.outerHTML : 'NOT FOUND'; }
      return document.documentElement.outerHTML;
    }, selector || '');
    return { content: [{ type: "text", text: html.slice(0, 100000) }] };
  }
);

server.tool("cdp_click",
  "Click element by selector",
  { selector: z.string().describe("CSS selector") },
  async ({ selector }) => {
    if (!page) await connectCDP();
    await page!.click(selector, { timeout: 10000 });
    return { content: [{ type: "text", text: `Clicked: ${selector}` }] };
  }
);

server.tool("cdp_get_text",
  "Get visible text from page or selector",
  { selector: z.string().optional().describe("CSS selector") },
  async ({ selector }) => {
    if (!page) await connectCDP();
    const text = await page!.evaluate((sel: string) => {
      if (sel) { const el = document.querySelector(sel); return el ? el.textContent || '' : 'NOT FOUND'; }
      return document.body?.innerText || '';
    }, selector || '');
    return { content: [{ type: "text", text: text.slice(0, 100000) }] };
  }
);

server.tool("cdp_network_requests",
  "Get captured network requests from the page (requires page reload after attach)",
  {},
  async () => {
    if (!page) await connectCDP();
    // Listen for network requests
    const requests: any[] = [];
    const onReq = (req: any) => requests.push({ url: req.url(), method: req.method(), type: req.resourceType(), headers: req.headers() });
    page!.on('request', onReq);
    await new Promise(r => setTimeout(r, 1000));
    page!.off('request', onReq);
    return { content: [{ type: "text", text: JSON.stringify(requests.slice(-20), null, 2) }] };
  }
);

server.tool("cdp_get_network_logs",
  "Get performance/network logs from Chrome DevTools",
  {},
  async () => {
    if (!page) await connectCDP();
    const logs: string[] = [];
    page!.on('console', (msg: any) => logs.push(`[${msg.type()}] ${msg.text()}`));
    await new Promise(r => setTimeout(r, 500));
    return { content: [{ type: "text", text: logs.slice(-30).join('\n') || 'No console logs captured' }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-chrome-devtools running (CDP port 9222)");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
