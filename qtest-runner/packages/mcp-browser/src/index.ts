import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { z } from "zod";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

async function ensureBrowser() {
  if (browser && browser.isConnected()) return;
  browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
}

const server = new McpServer({
  name: "qtest-browser",
  version: "0.1.0",
});

// ===== Tool: navigate =====
server.tool(
  "browser_navigate",
  "Navigate browser to a URL",
  { url: z.string().describe("URL to navigate to") },
  async ({ url }) => {
    await ensureBrowser();
    try {
      await page!.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return { content: [{ type: "text", text: `Navigated to ${url}\nTitle: ${await page!.title()}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: screenshot =====
server.tool(
  "browser_screenshot",
  "Take a screenshot of the current page",
  {},
  async () => {
    await ensureBrowser();
    try {
      const buf = await page!.screenshot({ type: "png", fullPage: false });
      return { content: [{ type: "image", data: buf.toString("base64"), mimeType: "image/png" }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: click =====
server.tool(
  "browser_click",
  "Click an element by CSS selector or text",
  { selector: z.string().describe("CSS selector or text= selector") },
  async ({ selector }) => {
    await ensureBrowser();
    try {
      await page!.click(selector, { timeout: 10000 });
      return { content: [{ type: "text", text: `Clicked: ${selector}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: type =====
server.tool(
  "browser_type",
  "Type text into an input field",
  {
    selector: z.string().describe("CSS selector of the input"),
    text: z.string().describe("Text to type"),
  },
  async ({ selector, text }) => {
    await ensureBrowser();
    try {
      await page!.fill(selector, text, { timeout: 10000 });
      return { content: [{ type: "text", text: `Typed "${text}" into ${selector}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: evaluate =====
server.tool(
  "browser_evaluate",
  "Run JavaScript in the page context",
  { code: z.string().describe("JavaScript code to evaluate") },
  async ({ code }) => {
    await ensureBrowser();
    try {
      const result = await page!.evaluate(code);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: inspect =====
server.tool(
  "browser_inspect",
  "Inspect page DOM: find shadow roots, interactive elements, inputs, buttons",
  { selector: z.string().optional().describe("Optional CSS scope selector") },
  async ({ selector }) => {
    await ensureBrowser();
    try {
      const info = await page!.evaluate((sel) => {
        const root = sel ? document.querySelector(sel) : document;
        if (!root) return { error: `Selector "${sel}" not found` };

        const result: any = {
          title: document.title,
          url: location.href,
          interactiveElements: [],
          inputs: [],
          shadowRoots: [],
          forms: [],
        };

        // Find all interactive elements
        const interactive = root.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [contenteditable="true"]');
        interactive.forEach((el, i) => {
          if (i >= 50) return;
          const tag = el.tagName.toLowerCase();
          const text = (el.textContent || "").trim().slice(0, 60);
          const id = el.id || "";
          const name = (el as any).name || "";
          const type = el.getAttribute("type") || "";
          const role = el.getAttribute("role") || "";
          const placeholder = (el as any).placeholder || "";
          const ariaLabel = el.getAttribute("aria-label") || "";
          const testId = el.getAttribute("data-testid") || el.getAttribute("data-cy") || "";
          result.interactiveElements.push({ tag, text, id, name, type, role, placeholder, ariaLabel, testId });
        });

        // Find inputs with current values
        const inputs = root.querySelectorAll('input, textarea, [contenteditable="true"]');
        inputs.forEach((el, i) => {
          if (i >= 30) return;
          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute("type") || "text";
          const name = (el as any).name || "";
          const value = (el as any).value || el.textContent || "";
          const placeholder = (el as any).placeholder || "";
          result.inputs.push({ tag, type, name, value: value.slice(0, 100), placeholder });
        });

        // Find shadow roots
        const allEls = root.querySelectorAll("*");
        allEls.forEach((el) => {
          if (el.shadowRoot) {
            const tag = el.tagName.toLowerCase();
            const id = el.id || "";
            const shadowChildren = el.shadowRoot.querySelectorAll("*").length;
            result.shadowRoots.push({ tag, id, shadowChildren });
          }
        });

        // Find forms
        const forms = root.querySelectorAll("form");
        forms.forEach((form, i) => {
          if (i >= 10) return;
          const id = form.id || "";
          const action = form.action || "";
          const method = form.method || "";
          const fields = form.querySelectorAll("input, select, textarea").length;
          result.forms.push({ id, action, method, fields });
        });

        return result;
      }, selector || null);
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: start_recording =====
server.tool(
  "browser_start_recording",
  "Start recording user actions in the browser. Returns session ID for use with stop_recording and get_recorded_actions.",
  { sessionId: z.string().optional().describe("Recording session ID (auto-generated if empty)") },
  async ({ sessionId }) => {
    await ensureBrowser();
    try {
      const sid = sessionId || `mcp-${Date.now()}`;
      // Create session in recorder-service
      const resp = await fetch("http://localhost:3004/api/recordings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `MCP-${sid}`, profileId: "mcp" }),
      });
      const session = await resp.json() as any;

      // Start recording in browser-agent
      const agentResp = await fetch("http://localhost:3005/api/record/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: "mcp",
          sessionId: session.id,
          recorderUrl: "http://localhost:3004",
        }),
      });
      const agentResult = await agentResp.json() as any;
      return { content: [{ type: "text", text: `Recording started\nSession ID: ${session.id}\nSession Name: ${session.name}\nAgent: ${JSON.stringify(agentResult)}\n\nUse this sessionId with browser_stop_recording and browser_get_recorded_actions.` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: stop_recording =====
server.tool(
  "browser_stop_recording",
  "Stop recording user actions in the browser. Use get_recorded_actions after to retrieve captured data.",
  { sessionId: z.string().describe("Recording session ID from browser_start_recording") },
  async ({ sessionId }) => {
    try {
      const results: string[] = [];

      // Stop recording in browser-agent
      try {
        const agentResp = await fetch("http://localhost:3005/api/record/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const agentResult = await agentResp.json() as any;
        results.push(`Browser agent: ${JSON.stringify(agentResult)}`);
      } catch (e: any) {
        results.push(`Browser agent stop failed: ${e.message}`);
      }

      // Stop session in recorder-service
      try {
        const resp = await fetch(`http://localhost:3004/api/recordings/${sessionId}/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const session = await resp.json() as any;
        results.push(`Recorder service: ${JSON.stringify(session)}`);
      } catch (e: any) {
        results.push(`Recorder service stop failed: ${e.message}`);
      }

      return { content: [{ type: "text", text: `Recording stopped: ${sessionId}\n${results.join('\n')}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: get_recorded_actions =====
server.tool(
  "browser_get_recorded_actions",
  "Get recorded actions from a recording session. Supports full dump, summary, converted test steps, or detailed test case format.",
  {
    sessionId: z.string().describe("Recording session ID from browser_start_recording"),
    format: z.enum(["full", "summary", "steps", "testcase"]).optional().describe("Output format: full=all data, summary=condensed, steps=converted to Russian test steps, testcase=detailed with selectors/curl/HTTP")
  },
  async ({ sessionId, format }) => {
    try {
      const fmt = format || "summary";

      if (fmt === "steps") {
        // Convert to test steps
        const resp = await fetch(`http://localhost:3004/api/recordings/${sessionId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const steps = await resp.json() as any;
        const lines = (Array.isArray(steps) ? steps : []).map((s: any, i: number) =>
          `${i+1}. ${s.action}\n   Данные: ${s.testData || '(нет)'}\n   Результат: ${s.expectedResult}`
        );
        return { content: [{ type: "text", text: `Test Steps (${lines.length}):\n\n${lines.join('\n\n')}` }] };
      }

      // Get full session with actions
      const resp = await fetch(`http://localhost:3004/api/recordings/${sessionId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const session = await resp.json() as any;

      if (!session || !session.actions) {
        return { content: [{ type: "text", text: `Session not found or no actions.\nResponse: ${JSON.stringify(session)}` }], isError: true };
      }

      if (fmt === "testcase") {
        // Detailed test case format with selectors, curl, HTTP
        const testSteps = session.actions
          .filter((a: any) => !['focus', 'hover', 'scroll', 'resize', 'clipboard', 'console', 'element_remove', 'attr_change', 'text_change'].includes(a.actionType))
          .map((a: any, i: number) => {
            const step: any = {
              stepNumber: i + 1,
              action: '',
              actionType: a.actionType,
              selectors: { primary: a.selector || '', alternatives: [], path: '' },
              testData: a.value || '',
              expectedResult: '',
              curl: null,
              httpRequests: [],
              url: a.url || '',
              pageTitle: a.pageTitle || '',
              timestamp: a.timestamp || '',
            };

            switch (a.actionType) {
              case 'navigate':
                step.action = `Перейти по URL ${a.url || a.selectorText || ''}`;
                step.expectedResult = `Страница загружена`;
                break;
              case 'page_load':
                step.action = `Страница загружена: ${a.url || ''}`;
                step.expectedResult = `Страница отображается`;
                break;
              case 'click':
                step.action = `Нажать элемент "${a.selectorText || ''}" [selector=${a.selector}]`;
                step.expectedResult = `Элемент активирован`;
                break;
              case 'dblclick':
                step.action = `Дважды нажать элемент "${a.selectorText || ''}" [selector=${a.selector}]`;
                step.expectedResult = `Элемент активирован`;
                break;
              case 'fill':
                step.action = `Заполнить поле "${a.selectorText || ''}" значением "${(a.value || '').slice(0, 60)}"`;
                step.testData = a.value || '';
                step.expectedResult = `Поле содержит введённое значение`;
                break;
              case 'select':
                step.action = `Выбрать "${a.displayValue || a.value}" из списка "${a.selectorText || ''}"`;
                step.expectedResult = `Значение выбрано`;
                break;
              case 'keypress':
                step.action = `Нажать клавишу "${a.combo || a.value}" на элементе "${a.selectorText || ''}"`;
                step.expectedResult = `Действие выполнено`;
                break;
              case 'check':
                step.action = `${a.value === 'checked' ? 'Отметить' : 'Снять отметку'} "${a.selectorText || ''}" [type=${a.inputType || ''}]`;
                step.expectedResult = `Состояние: ${a.value}`;
                break;
              case 'submit':
                step.action = `Отправить форму "${a.selectorText || a.selector || ''}"`;
                step.expectedResult = `Форма отправлена`;
                break;
              case 'contextmenu':
                step.action = `Нажать правой кнопкой на "${a.selectorText || ''}" [x=${a.x}, y=${a.y}]`;
                step.expectedResult = `Контекстное меню открыто`;
                break;
              case 'request':
                step.action = `HTTP ${a.method} ${a.url || ''}`;
                step.testData = a.postData || '';
                step.curl = `curl -X ${a.method || 'GET'} ${a.url || ''}` + (a.postData ? ` -d '${a.postData}'` : '');
                step.expectedResult = `Запрос отправлен`;
                break;
              case 'response':
                step.action = `HTTP ${a.method} ${a.url || ''} → ${a.status || ''}`;
                step.testData = (a.body || '').slice(0, 200);
                step.expectedResult = `Статус: ${a.status || 'unknown'}`;
                if (a.body) {
                  step.curl = `curl ${a.url || ''}`;
                }
                break;
              case 'request_failed':
                step.action = `HTTP ${a.method || 'GET'} ${a.url || ''} → ОШИБКА`;
                step.expectedResult = `Ошибка: ${a.error || 'unknown'}`;
                break;
              case 'element_appear':
                step.action = `Появился элемент <${a.value || ''}> "${a.selectorText || ''}" [selector=${a.selector}]`;
                step.expectedResult = `Элемент виден на странице`;
                break;
              case 'dialog':
                step.action = `Диалог "${a.selectorText || ''}": "${(a.value || '').slice(0, 60)}"`;
                step.expectedResult = `Диалог обработан`;
                break;
              default:
                step.action = `${a.actionType}: ${a.selectorText || a.selector || a.value || ''}`;
                step.expectedResult = `Выполнено`;
            }
            return step;
          });
        return { content: [{ type: "text", text: `Test Case (${testSteps.length} steps):\n\n${JSON.stringify(testSteps, null, 2)}` }] };
      }

      if (fmt === "summary") {
        const summary = session.actions.map((a: any, i: number) => {
          const detail = a.actionType === 'click' ? `"${a.selectorText}" [${a.selector}]` :
            a.actionType === 'fill' ? `"${a.selectorText}" = "${(a.value||'').slice(0,40)}"` :
            a.actionType === 'select' ? `"${a.selectorText}" = ${a.value}` :
            a.actionType === 'navigate' ? `${(a.url||'').slice(0,60)}` :
            a.actionType === 'response' ? `${a.status} ${a.method} ${(a.url||'').slice(0,60)}` :
            a.actionType === 'request' ? `${a.method} ${(a.url||'').slice(0,60)}` :
            a.actionType === 'keypress' ? `${a.combo || a.value}` :
            a.actionType === 'element_appear' ? `<${a.value}> "${a.selectorText}"` :
            a.value || '';
          return `${String(i+1).padStart(3)}. [${a.actionType}] ${detail}`;
        });
        return { content: [{ type: "text", text: `Session: ${session.name} (${session.status})\nProfile: ${session.profileId}\nActions: ${session.actions.length}\nStarted: ${session.startedAt}\nStopped: ${session.stoppedAt || 'N/A'}\n\n${summary.join('\n')}` }] };
      }

      // Full format
      return { content: [{ type: "text", text: JSON.stringify(session, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: inject_and_inspect =====
server.tool(
  "browser_inject_and_inspect",
  "Inject recording script into current page, then inspect DOM structure for debugging",
  {},
  async () => {
    await ensureBrowser();
    try {
      const result = await page!.evaluate(() => {
        const info: any = {
          url: location.href,
          title: document.title,
          shadowRoots: [],
          inputs: [],
          buttons: [],
          customElements: [],
        };

        // Walk all elements
        const allEls = document.querySelectorAll("*");
        allEls.forEach((el) => {
          // Shadow roots
          if (el.shadowRoot) {
            const children = el.shadowRoot.querySelectorAll("*").length;
            const inputs = el.shadowRoot.querySelectorAll("input, textarea").length;
            info.shadowRoots.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || "",
              children,
              inputs,
              innerHTML: el.shadowRoot.innerHTML.slice(0, 500),
            });
          }
        });

        // Inputs
        document.querySelectorAll("input, textarea, [contenteditable='true']").forEach((el, i) => {
          if (i >= 30) return;
          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute("type") || "text";
          const name = (el as any).name || "";
          const placeholder = (el as any).placeholder || "";
          const ariaLabel = el.getAttribute("aria-label") || "";
          const testId = el.getAttribute("data-testid") || "";
          const value = (el as any).value || "";
          info.inputs.push({ tag, type, name, placeholder, ariaLabel, testId, value: value.slice(0, 100) });
        });

        // Buttons
        document.querySelectorAll("button, [role='button'], a[href]").forEach((el, i) => {
          if (i >= 30) return;
          const tag = el.tagName.toLowerCase();
          const text = (el.textContent || "").trim().slice(0, 60);
          const id = el.id || "";
          const ariaLabel = el.getAttribute("aria-label") || "";
          const testId = el.getAttribute("data-testid") || "";
          info.buttons.push({ tag, text, id, ariaLabel, testId });
        });

        return info;
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: press =====
server.tool(
  "browser_press",
  "Press a keyboard key",
  { key: z.string().describe("Key to press (Enter, Tab, Escape, etc.)") },
  async ({ key }) => {
    await ensureBrowser();
    try {
      await page!.keyboard.press(key);
      return { content: [{ type: "text", text: `Pressed: ${key}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: wait =====
server.tool(
  "browser_wait",
  "Wait for a specified time or for a selector",
  {
    ms: z.number().optional().describe("Milliseconds to wait"),
    selector: z.string().optional().describe("Wait for this selector to appear"),
  },
  async ({ ms, selector }) => {
    await ensureBrowser();
    try {
      if (selector) {
        await page!.waitForSelector(selector, { timeout: 10000 });
        return { content: [{ type: "text", text: `Selector appeared: ${selector}` }] };
      }
      if (ms) {
        await new Promise((r) => setTimeout(r, ms));
        return { content: [{ type: "text", text: `Waited ${ms}ms` }] };
      }
      return { content: [{ type: "text", text: "Nothing to wait for" }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Tool: get_page_content =====
server.tool(
  "browser_get_html",
  "Get page HTML (or a section by selector)",
  { selector: z.string().optional().describe("CSS selector to get HTML from") },
  async ({ selector }) => {
    await ensureBrowser();
    try {
      const html = await page!.evaluate((sel) => {
        if (sel) {
          const el = document.querySelector(sel);
          return el ? el.outerHTML.slice(0, 10000) : `Selector "${sel}" not found`;
        }
        return document.documentElement.outerHTML.slice(0, 10000);
      }, selector || null);
      return { content: [{ type: "text", text: html }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ===== Start server =====
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Browser server running on stdio");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
