import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const RECORDER_URL = "http://localhost:3004";
const AGENT_URL = "http://localhost:3005";
const GATEWAY_URL = "http://localhost:3000";

const server = new McpServer({
  name: "qtest-debug",
  version: "0.1.0",
});

// ══════════════════════════════════════════════════════════════
// Helper: HTTP fetch with error handling
// ══════════════════════════════════════════════════════════════
async function httpGet(url: string): Promise<any> {
  const resp = await fetch(url);
  return resp.json();
}

async function httpPost(url: string, body: any): Promise<any> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return resp.json();
}

async function httpCheck(url: string): Promise<{ ok: boolean; status: number; latency: number }> {
  const start = Date.now();
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: resp.ok, status: resp.status, latency: Date.now() - start };
  } catch (e: any) {
    return { ok: false, status: 0, latency: Date.now() - start };
  }
}

// ══════════════════════════════════════════════════════════════
// Tool: qtest_health — Check all services
// ══════════════════════════════════════════════════════════════
server.tool(
  "qtest_health",
  "Check health of all qtest-runner services (ports 3000-3005, 8080)",
  {},
  async () => {
    const services = [
      { name: "api-gateway", url: `${GATEWAY_URL}/health` },
      { name: "recorder-service", url: `${RECORDER_URL}/health` },
      { name: "browser-agent", url: `${AGENT_URL}/health` },
      { name: "web-ui", url: "http://localhost:8080" },
    ];

    const results = await Promise.all(services.map(async (s) => {
      const check = await httpCheck(s.url);
      return { ...s, ...check };
    }));

    const lines = results.map(r =>
      `${r.ok ? "✓" : "✗"} ${r.name.padEnd(20)} ${r.ok ? `OK (${r.status}, ${r.latency}ms)` : `DOWN (${r.status || 'unreachable'})`}`
    );
    const allOk = results.every(r => r.ok);

    return { content: [{ type: "text", text: `Service Health:\n${lines.join('\n')}\n\nOverall: ${allOk ? "ALL SERVICES UP" : "SOME SERVICES DOWN"}` }] };
  }
);

// ══════════════════════════════════════════════════════════════
// Tool: qtest_launch_browser — Launch browser via agent
// ══════════════════════════════════════════════════════════════
server.tool(
  "qtest_launch_browser",
  "Launch a browser instance via browser-agent for recording/testing",
  {
    profileName: z.string().optional().describe("Browser profile name (default: Auto)")
  },
  async ({ profileName }) => {
    try {
      const result = await httpPost(`${AGENT_URL}/api/launch`, {
        profileName: profileName || "Auto",
      });
      return { content: [{ type: "text", text: `Browser launched\n${JSON.stringify(result, null, 2)}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error launching browser: ${e.message}` }], isError: true };
    }
  }
);

// ══════════════════════════════════════════════════════════════
// Tool: qtest_record_start — Start recording (full cycle)
// ══════════════════════════════════════════════════════════════
server.tool(
  "qtest_record_start",
  "Start recording: create session in recorder-service + start in browser-agent",
  {
    name: z.string().optional().describe("Session name (default: Test-<timestamp>)"),
    profileId: z.string().optional().describe("Browser profile ID (default: from /api/launch)")
  },
  async ({ name, profileId }) => {
    try {
      const sessionName = name || `Test-${Date.now()}`;
      const pid = profileId || "Auto";

      // Step 1: Create session in recorder-service
      const session = await httpPost(`${RECORDER_URL}/api/recordings/start`, {
        name: sessionName,
        profileId: pid,
      });

      // Step 2: Start recording in browser-agent
      const agentResult = await httpPost(`${AGENT_URL}/api/record/start`, {
        profileId: pid,
        sessionId: session.id,
        recorderUrl: RECORDER_URL,
      });

      return { content: [{ type: "text", text: `Recording started\nSession ID: ${session.id}\nSession Name: ${sessionName}\nProfile: ${pid}\nAgent: ${JSON.stringify(agentResult)}\n\nUse session ID with qtest_record_stop, qtest_get_actions, qtest_convert_steps.` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error starting recording: ${e.message}` }], isError: true };
    }
  }
);

// ══════════════════════════════════════════════════════════════
// Tool: qtest_record_stop — Stop recording
// ══════════════════════════════════════════════════════════════
server.tool(
  "qtest_record_stop",
  "Stop recording session in both browser-agent and recorder-service",
  {
    sessionId: z.string().describe("Recording session ID")
  },
  async ({ sessionId }) => {
    try {
      const results: string[] = [];

      // Stop in browser-agent
      try {
        const agentResult = await httpPost(`${AGENT_URL}/api/record/stop`, { sessionId });
        results.push(`Browser agent: ${JSON.stringify(agentResult)}`);
      } catch (e: any) {
        results.push(`Browser agent error: ${e.message}`);
      }

      // Stop in recorder-service
      try {
        const session = await httpPost(`${RECORDER_URL}/api/recordings/${sessionId}/stop`, {});
        results.push(`Session: ${JSON.stringify(session)}`);
      } catch (e: any) {
        results.push(`Recorder error: ${e.message}`);
      }

      return { content: [{ type: "text", text: `Recording stopped: ${sessionId}\n${results.join('\n')}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ══════════════════════════════════════════════════════════════
// Tool: qtest_get_actions — Get recorded actions
// ══════════════════════════════════════════════════════════════
server.tool(
  "qtest_get_actions",
  "Get recorded actions from a session. Supports full dump, summary, or detailed test case format.",
  {
    sessionId: z.string().describe("Recording session ID"),
    format: z.enum(["full", "summary", "testcase"]).optional().describe("Output format")
  },
  async ({ sessionId, format }) => {
    try {
      const session = await httpGet(`${RECORDER_URL}/api/recordings/${sessionId}`);

      if (!session || !session.actions) {
        return { content: [{ type: "text", text: `Session not found: ${JSON.stringify(session)}` }], isError: true };
      }

      if (format === "testcase") {
        const testSteps = session.actions
          .filter((a: any) => !['focus', 'hover', 'scroll', 'resize', 'clipboard', 'console', 'element_remove', 'attr_change', 'text_change'].includes(a.actionType))
          .map((a: any, i: number) => {
            const step: any = {
              stepNumber: i + 1,
              action: '',
              actionType: a.actionType,
              selector: a.selector || '',
              selectorText: a.selectorText || '',
              testData: a.value || '',
              expectedResult: '',
              curl: null,
              httpMethod: a.method || '',
              httpStatus: a.status || 0,
              httpUrl: a.url || '',
              requestBody: a.postData || '',
              responseBody: (a.body || '').slice(0, 200),
            };

            switch (a.actionType) {
              case 'navigate':
                step.action = `Перейти по URL ${a.url || ''}`;
                step.expectedResult = `Страница загружена: ${a.pageTitle || a.url || ''}`;
                break;
              case 'click':
                step.action = `Нажать "${a.selectorText || ''}" [selector=${a.selector}]`;
                step.expectedResult = `Элемент активирован`;
                break;
              case 'fill':
                step.action = `Заполнить "${a.selectorText || ''}" = "${(a.value || '').slice(0, 50)}"`;
                step.expectedResult = `Поле заполнено`;
                break;
              case 'select':
                step.action = `Выбрать "${a.displayValue || a.value}" в "${a.selectorText || ''}"`;
                step.expectedResult = `Значение выбрано`;
                break;
              case 'keypress':
                step.action = `Нажать "${a.combo || a.value}"`;
                step.expectedResult = `Клавиша нажата`;
                break;
              case 'request':
                step.action = `${a.method} ${a.url || ''}`;
                step.curl = `curl -X ${a.method || 'GET'} ${a.url || ''}` + (a.postData ? ` -d '${a.postData}'` : '');
                step.expectedResult = `Запрос отправлен`;
                break;
              case 'response':
                step.action = `${a.method} ${a.url || ''} → ${a.status}`;
                step.expectedResult = a.status >= 200 && a.status < 300 ? `Успешный ответ` : `Ошибка: ${a.status}`;
                step.curl = `curl ${a.url || ''}`;
                break;
              case 'element_appear':
                step.action = `Появился <${a.value}> "${a.selectorText || ''}"`;
                step.expectedResult = `Элемент виден`;
                break;
              default:
                step.action = `${a.actionType}: ${a.selectorText || a.selector || a.value || ''}`;
                step.expectedResult = `Выполнено`;
            }
            return step;
          });
        return { content: [{ type: "text", text: `Test Case (${testSteps.length} steps):\n${JSON.stringify(testSteps, null, 2)}` }] };
      }

      if (format === "summary") {
        const lines = session.actions.map((a: any, i: number) => {
          const d = a.actionType === 'click' ? `"${a.selectorText}"` :
            a.actionType === 'fill' ? `"${a.selectorText}" = "${(a.value||'').slice(0,30)}"` :
            a.actionType === 'navigate' ? `${(a.url||'').slice(0,50)}` :
            a.actionType === 'response' ? `${a.status} ${(a.url||'').slice(0,50)}` :
            a.actionType === 'request' ? `${a.method} ${(a.url||'').slice(0,50)}` :
            a.value || '';
          return `${i+1}. [${a.actionType}] ${d}`;
        });
        return { content: [{ type: "text", text: `Session: ${session.name} (${session.status})\nActions: ${session.actions.length}\n\n${lines.join('\n')}` }] };
      }

      // Full
      return { content: [{ type: "text", text: JSON.stringify(session, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ══════════════════════════════════════════════════════════════
// Tool: qtest_convert_steps — Convert actions to test steps
// ══════════════════════════════════════════════════════════════
server.tool(
  "qtest_convert_steps",
  "Convert recorded actions to test steps (Russian format)",
  {
    sessionId: z.string().describe("Recording session ID")
  },
  async ({ sessionId }) => {
    try {
      const steps = await httpPost(`${RECORDER_URL}/api/recordings/${sessionId}/convert`, {});

      if (!Array.isArray(steps)) {
        return { content: [{ type: "text", text: `Conversion failed: ${JSON.stringify(steps)}` }], isError: true };
      }

      const lines = steps.map((s: any, i: number) =>
        `${i+1}. ${s.action}\n   Данные: ${s.testData || '(нет)'}\n   Ожидаемый результат: ${s.expectedResult}`
      );

      return { content: [{ type: "text", text: `Test Steps (${steps.length}):\n\n${lines.join('\n\n')}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ══════════════════════════════════════════════════════════════
// Tool: qtest_execute_step — Execute step via browser-agent
// ══════════════════════════════════════════════════════════════
server.tool(
  "qtest_execute_step",
  "Execute a browser step via browser-agent (navigate, click, fill, press, screenshot, verify)",
  {
    action: z.string().describe("Action type: navigate, click, fill, press, screenshot, verify, execute-step"),
    selector: z.string().optional().describe("CSS selector (for click/fill)"),
    value: z.string().optional().describe("Value (for fill) or URL (for navigate)"),
    url: z.string().optional().describe("URL (alternative to value for navigate)"),
    key: z.string().optional().describe("Key to press (for press action)"),
    text: z.string().optional().describe("Text to verify (for verify action)"),
    actionText: z.string().optional().describe("Natural language action (for execute-step)")
  },
  async ({ action, selector, value, url, key, text, actionText }) => {
    try {
      let body: any = {};

      switch (action) {
        case 'navigate':
          body = { action: 'navigate', url: url || value || '' };
          break;
        case 'click':
          body = { action: 'click', selector: selector || '' };
          break;
        case 'fill':
          body = { action: 'fill', selector: selector || '', value: value || '' };
          break;
        case 'press':
          body = { action: 'press', key: key || 'Enter' };
          break;
        case 'screenshot':
          body = { action: 'screenshot' };
          break;
        case 'verify':
          body = { action: 'verify', text: text || '' };
          break;
        case 'execute-step':
          body = { action: actionText || '', testData: value || '', expectedResult: '' };
          if (value) body.value = value;
          break;
        default:
          body = { action, selector, value: value || url || '' };
      }

      const result = await httpPost(`${AGENT_URL}/api/execute-step`, body);
      return { content: [{ type: "text", text: `Step executed: ${action}\n${JSON.stringify(result, null, 2)}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ══════════════════════════════════════════════════════════════
// Tool: qtest_check_db — Database diagnostics
// ══════════════════════════════════════════════════════════════
server.tool(
  "qtest_check_db",
  "Check recording sessions in database (diagnostics)",
  {
    limit: z.number().optional().describe("Max sessions to show (default: 10)")
  },
  async ({ limit }) => {
    try {
      const sessions = await httpGet(`${RECORDER_URL}/api/recordings`);
      const list = Array.isArray(sessions) ? sessions.slice(0, limit || 10) : [];

      if (list.length === 0) {
        return { content: [{ type: "text", text: "No recording sessions found." }] };
      }

      const lines = list.map((s: any) =>
        `${s.id.slice(0,8)} | ${s.status.padEnd(10)} | ${(s.actionCount||0).toString().padStart(4)} actions | ${s.name || 'unnamed'} | ${s.startedAt || ''}`
      );

      return { content: [{ type: "text", text: `Recording Sessions (${list.length}):\n\n${'ID'.padEnd(8)} | ${'STATUS'.padEnd(10)} | ${'ACTIONS'.padStart(7)} | NAME | STARTED\n${'-'.repeat(60)}\n${lines.join('\n')}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ══════════════════════════════════════════════════════════════
// Start server
// ══════════════════════════════════════════════════════════════
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("qtest-debug MCP server running on stdio");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
