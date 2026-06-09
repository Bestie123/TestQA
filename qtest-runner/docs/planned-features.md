# Планируемые фичи: Интеграция Electron Debug MCP в qtest-runner

> Doc-ID: PLANNED-FEATURES-1 | Дата: 2026-06-05 | Связанные: [ELECTRON-DEBUG-1], [MCP-1], [ARCHITECTURE-1]

## Содержание

1. [Event Stream Viewer](#1-event-stream-viewer)
2. [CDP в browser-agent](#2-cdp-в-browser-agent)
3. [Persistent Browser Session](#3-persistent-browser-session)
4. [Action Replay Editor](#4-action-replay-editor)
5. [DOM Inspector](#5-dom-inspector)

---

## 1. Event Stream Viewer

Живая таблица событий браузера (console, network, DOM, errors) в Web UI.

### Проблема

Сейчас recorder захватывает события в фоне, сохраняет в SQLite. Чтобы увидеть что происходит — нужно остановить запись и открыть другую страницу. Нет возможности мониторить в реальном времени.

### Что нужно реализовать

**Новая страница:** `packages/web-ui/src/pages/EventStreamPage.tsx`

**Маршрут:** `/events` — добавить в NavBar/Sidebar

### UI

```
┌─────────────────────────────────────────────────────────────┐
│ [● Start Capture] [■ Stop]  Duration: [5000ms] ────────── │
│                                                             │
│ ┌─ Console ──┬─ Network ──┬─ DOM ───┬─ Errors ─┬─ All ──┐ │
│ │                                                         │ │
│ │ filter: [..............] [log] [warn] [error]           │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ 14:32:01.123  LOG     User clicked button #login    │ │ │
│ │ │ 14:32:01.456  WARN    Deprecated API call           │ │ │
│ │ │ 14:32:02.001  ERROR   Cannot read 'x' of undefined  │ │ │
│ │ │ 14:32:02.500  LOG     API response received         │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                         [Export JSON]   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Вкладки:**
- **Console** — console.log/warn/error. Фильтры: по уровню (log/warn/error), по тексту
- **Network** — запросы/ответы. Колонки: URL, Method, Status, Duration, Type. Разворачивается → headers + body (preview)
- **DOM** — мутации: добавление/удаление/изменение элементов. Фильтр по nodeName
- **Errors** — только uncaught exceptions с полным stack trace
- **All** — всё вместе в хронологическом порядке

### Backend API

```
POST /api/events/capture
Body: {
  "types": ["console", "network", "dom", "error", "all"],
  "durationMs": 5000,
  "url": "http://localhost:3000"  // optional, target page
}
Response: {
  "eventCount": 42,
  "events": [
    {
      "type": "console",
      "method": "log",
      "args": "User clicked button #login",
      "timestamp": 1746545521123,
      "source": "console-api"
    },
    {
      "type": "network",
      "event": "responseReceived",
      "url": "https://api.example.com/data",
      "status": 200,
      "method": "GET",
      "mimeType": "application/json",
      "requestId": "req_123",
      "duration": 234
    },
    {
      "type": "dom",
      "event": "childNodeInserted",
      "parentNodeId": 42,
      "node": { "nodeType": 1, "nodeName": "DIV" }
    },
    {
      "type": "error",
      "event": "exceptionThrown",
      "text": "TypeError: Cannot read properties of undefined",
      "lineNumber": 42,
      "url": "http://localhost:3000/app.js"
    }
  ]
}
```

### Где реализовать

| Компонент | Файл | Что сделать |
|-----------|------|-------------|
| Страница | `packages/web-ui/src/pages/EventStreamPage.tsx` | Создать новый React компонент |
| Маршрут | `packages/web-ui/src/App.tsx` | Добавить `/events` route |
| NavBar | `packages/web-ui/src/components/NavBar.tsx` | Добавить кнопку "Events" |
| API endpoint | `packages/api-gateway/src/index.ts` | Прокси `POST /api/events/capture` |
| Backend | Новый или расширить `recorder-service` | CDP capture через `mcp-chrome-devtools` |
| WS реального времени | `packages/recorder-service/src/server.ts` | Добавить WebSocket `/ws/events` для live-стриминга (опционально) |

### Integration с existing MCP

`mcp-chrome-devtools` уже имеет CDP-подключение. Нужно добавить метод:
```
cdp_listen({types, durationMs}) → events[]
```

Либо вызвать CDP напрямую:
```
cdpCall('Runtime.enable') → слушать Runtime.consoleAPICalled
cdpCall('Network.enable') → слушать Network.*
cdpCall('DOM.enable') → слушать DOM.*
```

### Данные для тестирования

```json
// Пример ответа console capture
{
  "eventCount": 10,
  "events": [
    {"type":"console","method":"log","args":"Page loaded","timestamp":1746545521000},
    {"type":"console","method":"error","args":"Failed to fetch /api/data","timestamp":1746545521500},
    {"type":"network","event":"requestWillBeSent","url":"http://localhost:3000/api/data","method":"GET","timestamp":1746545521600},
    {"type":"network","event":"responseReceived","url":"http://localhost:3000/api/data","status":200,"timestamp":1746545521800}
  ]
}
```

---

## 2. CDP в browser-agent

Добавить в browser-agent опциональную CDP-подписку для полного перехвата network response bodies.

### Проблема

Сейчас browser-agent использует Playwright page events:
- `page.on('request')` — перехватывает URL, method, headers
- `page.on('response')` — перехватывает URL, status, headers

**Чего не хватает:**
- **Response body** — Playwright не даёт читать тело ответа в page.on('response') (только через `await response.body()` который может не сработать)
- **Request post data** — для POST/PUT запросов тело запроса
- **Timing** — точная длительность запроса
- **WebSocket frames** — не перехватываются

### Решение

Добавить CDP-канал параллельно с Playwright:

```
Playwright
  page.on('request') ────→ recorder (headers, URL, method)
  page.on('response') ───→ recorder (status, headers)
  
CDP (через CDPSession)
  Network.requestWillBeSent ──→ recorder (URL, method, headers, postData)
  Network.responseReceived ───→ recorder (status, headers, mimeType, timing)
  Network.loadingFailed ──────→ recorder (errorText)
  Network.webSocketCreated ───→ recorder (WebSocket URL)
```

### CDP против Playwright

| Характеристика | Playwright | CDP |
|---------------|-----------|-----|
| Request URL | ✅ | ✅ |
| Method | ✅ | ✅ |
| Headers | ✅ | ✅ |
| **Post data** | ❌ | ✅ (postData) |
| **Response body** | ❌ (только async) | ✅ (через Network.getResponseBody) |
| **Timing** | ❌ | ✅ (wallTime, timing) |
| WebSocket | ❌ | ✅ |
| Cookie | ❌ | ✅ |
| Security details | ❌ | ✅ |

### Реализация

**Файл:** `packages/browser-agent/src/cdp-listener.ts` (новый)

```typescript
// cdp-listener.ts
import { CDPSession } from 'playwright';

export interface CDPEvent {
  type: 'request' | 'response' | 'failure' | 'websocket';
  url: string;
  method?: string;
  status?: number;
  headers?: Record<string, string>;
  postData?: string;
  body?: string;
  errorText?: string;
  timestamp: number;
  duration?: number;
}

export class CDPListener {
  private session: CDPSession | null = null;
  private events: CDPEvent[] = [];
  private pending = new Map<string, number>();  // requestId → startTime
  
  async attach(page: Page) {
    this.session = await page.context().newCDPSession(page);
    
    await this.session.send('Network.enable', {
      maxTotalBufferSize: 10000000,
      maxResourceBufferSize: 5000000,
    });
    
    this.session.on('Network.requestWillBeSent', (params) => {
      this.pending.set(params.requestId, Date.now());
      this.events.push({
        type: 'request',
        url: params.request.url,
        method: params.request.method,
        headers: params.request.headers,
        postData: params.request.postData,
        timestamp: params.timestamp || Date.now(),
      });
    });
    
    this.session.on('Network.responseReceived', async (params) => {
      const startTime = this.pending.get(params.requestId);
      // Get response body
      let body: string | undefined;
      try {
        const result = await this.session!.send('Network.getResponseBody', {
          requestId: params.requestId,
        });
        body = result.body;
      } catch {}
      
      this.events.push({
        type: 'response',
        url: params.response.url,
        status: params.response.status,
        headers: params.response.headers,
        body: body?.substring(0, 10000),  // limit body size
        timestamp: params.timestamp || Date.now(),
        duration: startTime ? Date.now() - startTime : undefined,
      });
    });
    
    this.session.on('Network.loadingFailed', (params) => {
      this.events.push({
        type: 'failure',
        url: params.url,
        errorText: params.errorText,
        timestamp: Date.now(),
      });
    });
  }
  
  getEvents(): CDPEvent[] { return this.events; }
  clear(): void { this.events = []; }
  
  async detach() {
    if (this.session) {
      await this.session.detach().catch(() => {});
      this.session = null;
    }
  }
}
```

### Интеграция с recorder

В `packages/browser-agent/src/recorder.ts`:
1. Создать `CDPListener` при старте записи
2. CDP события записываются в `pendingActions[]` наряду с DOM-событиями
3. Дополнительные поля в `IRecordedAction`:
   ```typescript
   interface IRecordedAction {
     // ... existing fields
     postData?: string;    // из CDP Network.requestWillBeSent
     responseBody?: string; // из CDP Network.getResponseBody
     duration?: number;    // из CDP timing
     cdpSource?: boolean;  // true если из CDP
   }
   ```

### Когда включать CDP

Добавить опцию в `POST /api/recordings/start`:
```json
{
  "options": {
    "cdpCapture": true,         // включает CDP listener
    "captureResponseBodies": true,  // включает getResponseBody
    "maxBodySize": 10000        // макс размер тела (байт)
  }
}
```

---

## 3. Persistent Browser Session

Держать один browser instance на всё время работы browser-agent вместо создания нового на каждый MCP вызов.

### Проблема

Сейчас каждый MCP вызов:
```
browser_navigate → launch browser → navigate → close browser (1-2 секунды)
browser_click → launch browser → click → close browser (1-2 секунды)
```

**Потери:** 70% времени уходит на launch/close браузера. Нет состояния между вызовами.

### Решение

Держать в browser-agent один Playwright browser + context + page в памяти:

```typescript
// browser-manager.ts
class PersistentSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private lastUsed: number = 0;
  private readonly idleTimeout: number = 300000;  // 5 min
  
  async getPage(): Promise<Page> {
    if (this.page && Date.now() - this.lastUsed < this.idleTimeout) {
      this.lastUsed = Date.now();
      return this.page;
    }
    // Закрыть старый
    await this.close();
    // Создать новый
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    this.lastUsed = Date.now();
    return this.page;
  }
  
  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}
```

### API изменения

```
POST /api/browser/connect → { sessionId: "..." }  // создать/получить сессию
POST /api/browser/disconnect → { ok: true }        // явно закрыть сессию
GET /api/browser/status → { active: true, pageCount: 1, uptime: 3600 }
```

MCP инструменты:
```
browser_get_session → { sessionId, page, uptime }
browser_close_session → закрывает сессию
```

### Timeout auto-close

Если сессия не используется >5 минут — browser закрывается автоматически. При следующем запросе создаётся новый.

### Lifecycle

```
Запрос 1: browser_navigate → getPage() → создаёт browser → навигирует
Запрос 2: browser_click → getPage() → использует ТОТ ЖЕ browser → кликает
Запрос 3: browser_navigate → getPage() → тот же browser → навигирует
... 5 минут бездействия ...
→ browser.close() автоматически
Запрос 4: browser_click → getPage() → создаёт НОВЫЙ browser
```

---

## 4. Action Replay Editor

Визуальный редактор JSON-сценариев с возможностью выполнять их в реальном браузере.

### Проблема

Сейчас сценарии можно только через MCP/CLI. Нет UI для:
- Создания и редактирования шагов
- Просмотра результатов выполнения
- Сохранения и повторного использования сценариев

### Что нужно реализовать

**Новая страница:** `packages/web-ui/src/pages/ReplayPage.tsx`

**Маршрут:** `/replay`

### Формат сценария

```json
{
  "name": "Проверка логина",
  "description": "Проверяет что форма логина работает",
  "stopOnFailure": true,
  "timeoutMs": 30000,
  "steps": [
    {
      "id": "step-1",
      "action": "navigate",
      "url": "https://example.com/login",
      "description": "Открыть страницу логина"
    },
    {
      "id": "step-2",
      "action": "wait",
      "ms": 1000,
      "description": "Ждать загрузки страницы"
    },
    {
      "id": "step-3",
      "action": "type",
      "selector": "#username",
      "value": "admin",
      "description": "Ввести имя пользователя"
    },
    {
      "id": "step-4",
      "action": "type",
      "selector": "#password",
      "value": "pass123",
      "description": "Ввести пароль"
    },
    {
      "id": "step-5",
      "action": "click",
      "selector": "#login-btn",
      "description": "Нажать кнопку входа"
    },
    {
      "id": "step-6",
      "action": "wait",
      "ms": 2000,
      "description": "Ждать редиректа"
    },
    {
      "id": "step-7",
      "action": "assert_text",
      "selector": ".welcome",
      "contains": "Welcome, admin",
      "description": "Проверить успешный вход"
    },
    {
      "id": "step-8",
      "action": "screenshot",
      "name": "after-login",
      "description": "Скриншот результата"
    }
  ]
}
```

### UI

```
┌─────────────────────────────────────────────────────────────┐
│ Replay Scenarios                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [My Scenarios] [Import] [Export]                         │ │
│ │                                                         │ │
│ │ ┌─── Saved Scenarios ────────────────────────────────┐  │ │
│ │ │ ○ Check Login (3 steps)                            │  │ │
│ │ │ ○ Create Task (5 steps)                            │  │ │
│ │ │ ● Проверка логина (8 steps)  ← active             │  │ │
│ │ │ ○ Full Regression (42 steps)                       │  │ │
│ │ └────────────────────────────────────────────────────┘  │ │
│ │                                                         │ │
│ │ [▶ Run] [■ Stop]  Status: ● Ready                      │ │
│ │                                                         │ │
│ │ ┌─── Steps ─────────────────────────────────────────┐  │ │
│ │ │ # │ Action     │ Target/Value         │ Status    │  │ │
│ │ │ 1 │ navigate   │ https://example.com  │ ✅ passed │  │ │
│ │ │ 2 │ wait       │ 1000ms               │ ✅ passed │  │ │
│ │ │ 3 │ type       │ #username = "admin"  │ ✅ passed │  │ │
│ │ │ 4 │ type       │ #password = "pass123"│ ✅ passed │  │ │
│ │ │ 5 │ click      │ #login-btn           │ ✅ passed │  │ │
│ │ │ 6 │ wait       │ 2000ms               │ ✅ passed │  │ │
│ │ │ 7 │ assert_text│ .welcome.contains    │ ❌ FAILED │  │ │
│ │ │   │            │ "Welcome, admin"     │           │  │ │
│ │ │   │            │ actual: "Welcome,"   │           │  │ │
│ │ │ 8 │ screenshot │ after-login.png      │ ⏸ skipped │  │ │
│ │ └────────────────────────────────────────────────────┘  │ │
│ │                                                         │ │
│ │ === Step Detail: assert_text ===                         │ │
│ │ Expected: .welcome to contain "Welcome, admin"          │ │
│ │ Actual:   "Welcome, guest"                              │ │
│ │ Screenshot: [🖼]                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Backend API

```
POST /api/replay/run
Body: {
  "scenario": { "name": "...", "steps": [...] },
  "url": "http://localhost:3000"  // optional
}
Response: {
  "ok": false,
  "total": 8,
  "failed": 1,
  "results": [
    { "step": 0, "action": "navigate", "ok": true },
    { "step": 1, "action": "wait", "ok": true },
    ...
    { "step": 6, "action": "assert_text", "ok": false,
      "expected": "Welcome, admin",
      "actual": "Welcome, guest",
      "selector": ".welcome" },
    { "step": 7, "action": "screenshot", "ok": true,
      "data": "base64..." }
  ]
}

CRUD:
GET    /api/replay/scenarios          → список сценариев
POST   /api/replay/scenarios          → создать сценарий
GET    /api/replay/scenarios/:id      → получить сценарий
PUT    /api/replay/scenarios/:id      → обновить сценарий
DELETE /api/replay/scenarios/:id      → удалить сценарий
```

### Где хранить сценарии

В SQLite `recordings.db`:
```sql
CREATE TABLE replay_scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  scenario_json TEXT NOT NULL,  -- full JSON
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE replay_results (
  id TEXT PRIMARY KEY,
  scenario_id TEXT,
  ok INTEGER,
  total_steps INTEGER,
  failed_steps INTEGER,
  results_json TEXT,  -- full results
  ran_at INTEGER,
  FOREIGN KEY (scenario_id) REFERENCES replay_scenarios(id)
);
```

### Integration с execution-service

Использовать существующий `executor.ts` из `execution-service`:
- `executeStep(step, page)` — выполняет один шаг на странице
- `executeScenario(scenario, page)` — выполняет весь сценарий

### Actions для Replay Editor

| Action | Параметры | Описание |
|--------|-----------|----------|
| `navigate` | `url` | Перейти по URL |
| `click` | `selector` | Кликнуть по селектору |
| `type` | `selector, value` | Ввести текст |
| `select` | `selector, value` | Выбрать option |
| `wait` | `ms` | Пауза |
| `assert_text` | `selector, contains/matches` | Проверить текст |
| `assert_visible` | `selector` | Проверить видимость |
| `assert_url` | `contains/matches` | Проверить URL |
| `screenshot` | `name` | Скриншот |
| `evaluate` | `expression` | JS код |
| `hover` | `selector` | Навести мышь |

---

## 5. DOM Inspector

Просмотр всех `data-tp` / `data-testid` на текущей странице.

### Проблема

Чтобы узнать какие data-атрибуты есть на странице — нужно открыть DevTools → Elements и искать вручную. Нет быстрого способа получить полную карту элементов.

### Что нужно реализовать

**Компонент:** `packages/web-ui/src/components/DOMInspector.tsx` (встраивается в ReplayPage и RecorderPage как панель)

**Не отдельная страница, а панель в других страницах.**

### UI

```
┌─── DOM Inspector ─────────────────────────────────────┐
│ 🔍 [search...]                     [Refresh] [Copy]   │
│                                                        │
│ data-tp        │ Tag    │ Text (first 50 chars)       │
│────────────────────────────────────────────────────────│
│ el-1           │ DIV    │ ""                           │
│ el-2           │ NAV    │ "Main Navigation"            │
│ el-3           │ BUTTON │ "Click Me"                   │
│ el-4           │ INPUT   │ ""                          │
│ ...                                                     │
│                                                        │
│ Selected: el-3 (BUTTON)                                │
│ Selector: button[data-tp="el-3"]                       │
│ Text: "Click Me"                                       │
│ Classes: btn btn-primary                               │
│ ID: (none)                                             │
│ [Copy Selector] [Highlight in Page]                    │
└────────────────────────────────────────────────────────┘
```

### API

```
POST /api/dom/inspect
Body: { "url": "http://localhost:3000" }
Response: {
  "elementCount": 42,
  "elements": [
    { "tp": "el-1", "tag": "DIV", "text": "", "classes": "", "id": "" },
    { "tp": "el-2", "tag": "NAV", "text": "Main Navigation", "classes": "navbar", "id": "main-nav" },
    { "tp": "el-3", "tag": "BUTTON", "text": "Click Me", "classes": "btn btn-primary", "id": "" }
  ]
}

POST /api/dom/highlight
Body: { "selector": "button[data-tp=\"el-3\"]" }
Response: { "ok": true }
// Визуально подсвечивает элемент на странице (рамка/мигание)
```

### Integration с data-tp injector

DOM Inspector **зависит** от runtime data-tp injector. Если на странице нет `data-tp` — он вызывается автоматически через CDP:

```
POST /api/dom/inject-tp
Body: { "url": "http://localhost:3000" }
Response: { "ok": true, "elementCount": 42 }
```

### Где используется

1. **Replay Editor** — при редактировании шага click/type показывает список data-tp для выбора селектора
2. **Recorder Page** — показывает map DOM после записи
3. **Отладка** — быстрое понимание структуры страницы без DevTools

---

## Приоритеты реализации

| # | Фича | Зависит от | Оценка |
|---|------|-----------|--------|
| 1 | Event Stream Viewer | CDP в browser-agent | 2-3 дня |
| 2 | CDP в browser-agent | — | 1-2 дня |
| 3 | Persistent Session | — | 1 день |
| 4 | Action Replay Editor | Persistent Session | 3-4 дня |
| 5 | DOM Inspector | data-tp injector | 1-2 дня |

**Рекомендуемый порядок:** 2 → 1 → 3 → 4 → 5
