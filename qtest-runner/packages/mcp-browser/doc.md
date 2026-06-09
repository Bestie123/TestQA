# packages/mcp-browser/ — MCP Browser (Playwright + Recording)

> Doc-ID: MCP-BROWSER-1 | Дата: 2026-06-09 | Связанные: [REC-SHARED-1], [BROWSER-AGENT-1]

## Файлы

| Файл | Назначение |
|------|-----------|
| `src/index.ts` | MCP server: Playwright tools + recording hooks + record_step/record_action |
| `package.json` | Зависимости: @modelcontextprotocol/sdk, playwright, recorder-shared, zod |

## Архитектура

```
mcp-browser (Playwright)
├── ensureBrowser()     → chromium.launch() — СВОЙ браузер (отдельный от browser-agent)
├── ensureRecording()   → page.addInitScript(INJECT_SCRIPT) + page.on('console')
├── recordProgrammatic() → queue.push(buildXxxAction()) → flush в recorder-service
│
├── browser_navigate    → page.goto() + recordProgrammatic(buildNavigateAction)
├── browser_click       → page.click() + recordProgrammatic(buildClickAction)
├── browser_type        → page.fill() + recordProgrammatic(buildFillAction)
├── browser_evaluate    → page.evaluate() + recordProgrammatic(buildEvaluateAction)
├── browser_press       → page.keyboard.press() + recordProgrammatic(buildKeypressAction)
├── browser_screenshot  → page.screenshot() (без записи)
├── browser_inspect     → page.evaluate(DOM inspection) (без записи)
├── browser_wait        → page.waitForSelector/setTimeout (без записи)
├── browser_get_html    → page.evaluate(outerHTML) (без записи)
│
├── record_step         → recordProgrammatic(buildStepMarker)
├── record_action       → page.evaluate(read selector) + recordProgrammatic(buildManualAction)
├── record_start        → new ActionQueue(url).start(id) + ensureRecording()
└── record_stop         → queue.stop() (flush with retries)
```

## Recording Flow

```
1. record_start(sessionId) → ActionQueue.start() + INJECT_SCRIPT injection
2. browser_click(selector) → page.click()
   ├── INJECT_SCRIPT ловит DOM click event → console.debug("__QTEST_ACTION__"...)
   ├── page.on('console') перехватывает → queue.push({source: "dom"})
   └── recordProgrammatic(buildClickAction(selector)) → queue.push({source: "programmatic"})
3. ActionQueue.flush() (каждые 2 сек) → POST recorder-service/api/recordings/{id}/actions
4. record_stop() → queue.stop() → final flush with retries
```

## Изменения (2026-06-09)

### Добавлены recording hooks

**Файл:** `src/index.ts`

```typescript
// Новые импорты
import { INJECT_SCRIPT, ActionQueue, buildClickAction, ... } from "recorder-shared";

// Состояние записи
let actionQueue: ActionQueue | null = null;
let recordingInjected = false;

// INJECT_SCRIPT injection
async function ensureRecording() {
  if (!page || recordingInjected) return;
  await page.addInitScript(INJECT_SCRIPT);
  await page.addScriptTag({ content: INJECT_SCRIPT });
  page.on("console", (msg) => {
    if (msg.text().startsWith("__QTEST_ACTION__") && actionQueue?.isActive()) {
      const action = JSON.parse(msg.text().slice("__QTEST_ACTION__".length));
      actionQueue.push({ ...action, source: "dom" });
    }
  });
  recordingInjected = true;
}

// Programmatic recording
function recordProgrammatic(action: any) {
  if (actionQueue?.isActive()) actionQueue.push(action);
}
```

### Новые MCP-tools

| Tool | Описание | Записывает |
|------|----------|------------|
| `record_step` | Пометка шага тест-кейса | `step_marker` action |
| `record_action` | Ручная проверка/наблюдение | `manual_action` + optional screenshot |
| `record_start` | Старт записи | ActionQueue.start() + INJECT_SCRIPT |
| `record_stop` | Остановка записи | ActionQueue.stop() |

**Пример record_action:**
```json
{
  "action": "Проверил статус ОПЛАЧЕН",
  "type": "verify",
  "selector": "#status-val",
  "expected": "ОПЛАЧЕН",
  "screenshot": true
}
```

## Сборка

```powershell
cd packages/mcp-browser
npm run build    # tsc → dist/index.js
```

## Связи

- **recorder-shared** — импортирует `INJECT_SCRIPT`, `ActionQueue`, builders
- **recorder-service** (port 3004) — получает actions через HTTP POST
- **browser-agent** (port 3005) — независимый (управляет своим Chromium)
- **@modelcontextprotocol/sdk** — MCP protocol implementation
- **playwright** — browser automation

## Проблемы

| # | Проблема | Причина | Решение |
|---|----------|---------|---------|
| 1 | mcp-browser запускал свой Chromium без recording hooks | Архитектурное разделение | Добавлен INJECT_SCRIPT injection + ActionQueue |
| 2 | zod не был в package.json | Транзитивная зависимость | Добавлен явно в dependencies |
| 3 | recorder-shared не находился при сборке | Не в workspaces | Добавлен в root package.json workspaces |
