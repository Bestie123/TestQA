import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";
import { z } from "zod";

const DEFAULT_PORT = parseInt(process.env.CDP_PORT || '9222', 10);

let browser: any = null;
let page: any = null;
let currentPort: number = DEFAULT_PORT;

async function connectCDP(port: number) {
  if (browser && currentPort === port && page) return;
  try {
    if (browser) { try { await browser.close(); } catch {} browser = null; page = null; }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const ctx = browser.contexts()[0];
    const pages = ctx?.pages() || [];
    page = pages.length > 0 ? pages[0] : null;
    currentPort = port;
  } catch (e: any) {
    throw new Error(`CDP connect failed on port ${port}: ${e.message}. Start Chrome with --remote-debugging-port=${port}`);
  }
}

const portSchema = z.number().int().min(1024).max(65535).optional().describe("Chrome DevTools port (default from CDP_PORT env or 9222)");
const server = new McpServer({ name: "chrome-devtools", version: "0.2.0" });

server.tool("cdp_navigate",
  "Navigate Chrome to URL",
  { url: z.string().describe("URL to navigate to"), port: portSchema },
  async ({ url, port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    await page!.goto(url, { waitUntil: "domcontentloaded" });
    return { content: [{ type: "text", text: `Navigated to ${url} (port ${p})\nTitle: ${await page!.title()}` }] };
  }
);

server.tool("cdp_screenshot",
  "Take screenshot of current page",
  { port: portSchema },
  async ({ port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    const buf = await page!.screenshot({ type: "png" });
    return { content: [{ type: "image", data: buf.toString("base64"), mimeType: "image/png" }] };
  }
);

server.tool("cdp_evaluate",
  "Run JavaScript in page context and return result",
  { code: z.string().describe("JavaScript code"), port: portSchema },
  async ({ code, port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    const result = await page!.evaluate(code);
    return { content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
  }
);

server.tool("cdp_get_html",
  "Get full page HTML (or by selector)",
  { selector: z.string().optional().describe("CSS selector"), port: portSchema },
  async ({ selector, port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    const html = await page!.evaluate((sel: string) => {
      if (sel) { const el = document.querySelector(sel); return el ? el.outerHTML : 'NOT FOUND'; }
      return document.documentElement.outerHTML;
    }, selector || '');
    return { content: [{ type: "text", text: html.slice(0, 100000) }] };
  }
);

server.tool("cdp_click",
  "Click element by selector",
  { selector: z.string().describe("CSS selector"), port: portSchema },
  async ({ selector, port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    await page!.click(selector, { timeout: 10000 });
    return { content: [{ type: "text", text: `Clicked: ${selector} (port ${p})` }] };
  }
);

server.tool("cdp_type",
  "Type text into input/textarea on the page",
  { selector: z.string().describe("CSS selector of input/textarea"), text: z.string().describe("Text to type"), port: portSchema },
  async ({ selector, text, port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    await page!.fill(selector, text);
    return { content: [{ type: "text", text: `Typed into ${selector} (port ${p})` }] };
  }
);

server.tool("cdp_press_key",
  "Press a keyboard key",
  { key: z.string().describe("Key to press (Enter, Tab, Escape, etc.)"), selector: z.string().optional().describe("CSS selector to focus first"), port: portSchema },
  async ({ key, selector, port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    if (selector) await page!.click(selector);
    await page!.keyboard.press(key);
    return { content: [{ type: "text", text: `Pressed ${key} (port ${p})` }] };
  }
);

server.tool("cdp_get_text",
  "Get visible text from page or selector",
  { selector: z.string().optional().describe("CSS selector"), port: portSchema },
  async ({ selector, port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    const text = await page!.evaluate((sel: string) => {
      if (sel) { const el = document.querySelector(sel); return el ? el.textContent || '' : 'NOT FOUND'; }
      return document.body?.innerText || '';
    }, selector || '');
    return { content: [{ type: "text", text: text.slice(0, 100000) }] };
  }
);

server.tool("cdp_network_requests",
  "Get captured network requests from the page (requires page reload after attach)",
  { port: portSchema },
  async ({ port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
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
  { port: portSchema },
  async ({ port }) => {
    const p = port || DEFAULT_PORT;
    await connectCDP(p);
    const logs: string[] = [];
    page!.on('console', (msg: any) => logs.push(`[${msg.type()}] ${msg.text()}`));
    await new Promise(r => setTimeout(r, 500));
    return { content: [{ type: "text", text: logs.slice(-30).join('\n') || 'No console logs captured' }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`mcp-chrome-devtools running (default CDP port ${DEFAULT_PORT})`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
