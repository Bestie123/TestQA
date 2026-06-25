# Полный каталог связей и зависимостей

## Межсервисные HTTP-вызовы

| # | Откуда | Куда | Протокол | Данные |
|---|--------|------|----------|--------|
| 1 | User | web-ui:8080 | HTTP | Страницы |
| 2 | web-ui | api-gateway:3000 | REST | `/api/*` |
| 3 | api-gateway | testcase-service:3001 | HTTP | 6 prefix: testcases, folders, import, zephyr, diff, coverage |
| 4 | api-gateway | step-library:3002 | HTTP | 4 prefix: steps, categories, composite-steps, composite-categories |
| 5 | api-gateway | execution-service:3003 | HTTP | 2 prefix: executions, reports |
| 6 | api-gateway | recorder-service:3004 | HTTP | 3 prefix: recordings, user-switch, settings |
| 7 | api-gateway | browser-agent:3005 | HTTP | 8 prefix: record, launch, profiles, agent, execute-step, videos, video, debug |

## Прямые межсервисные вызовы (без gateway)

| # | Откуда | Куда | Протокол | URL | Когда |
|---|--------|------|----------|-----|-------|
| 8 | execution-service | testcase-service:3001 | HTTP GET | `/api/testcases/:key` | Создание execution |
| 9 | execution-service | step-library:3002 | HTTP POST | `/api/composite-steps/:id/expand` | Создание execution (composite steps) |
| 10 | execution-service | browser-agent:3005 | HTTP POST | `/api/launch` | Auto-next (ensure session) |
| 11 | execution-service | browser-agent:3005 | HTTP POST | `/api/execute-step` | Auto-next (выполнение шага) |

## Внешние API

| # | Откуда | Куда | Протокол | Эндпоинты |
|---|--------|------|----------|-----------|
| 12 | testcase-service | Zephyr Scale API | REST + Bearer | GET /testcase/search, GET /testrun/search, GET /testplan/search, GET /foldertree, POST /testcase, GET /serverInfo, GET /project |

## WebSocket-подключения

| # | Клиент | Сервер | Протокол | Сообщения |
|---|--------|--------|----------|-----------|
| 13 | Chrome Extension | recorder-service:3004 | WS | `record:start`, `record:stop`, `record:action`, `record:convert` |
| 14 | Chrome Extension | browser-agent:3005 | WS | `launch`, `execute`, `navigate`, `click`, `fill`, `close` |

## Inject Script → Node.js каналы

| # | Источник | Канал | Назначение |
|---|----------|-------|-----------|
| 15 | Inject Script | `console.debug(__QTEST_ACTION__)` | recorder-service:3004 |
| 16 | Inject Script | `page.exposeFunction(__recordAction)` | recorder-service:3004 |
| 17 | Inject Script | `postMessage({__qtestAction})` | recorder-service:3004 (iframe) |

## Browser Agent → Recorder (HTTP)

| # | Откуда | Куда | Протокол | Данные |
|---|--------|------|----------|--------|
| 18 | browser-agent recorder.ts | recorder-service:3004 | HTTP POST | `/api/recordings/:id/actions` (batch каждые 2 сек) |

## Browser Agent → Playwright (CDP)

| # | Откуда | Куда | Протокол | Данные |
|---|--------|------|----------|--------|
| 19 | browser-agent CDPListener | Playwright page | CDP | Network.enable, requestWillBeSent, responseReceived, loadingFailed |
| 20 | browser-agent executor | Playwright page | Playwright API | goto, click, fill, screenshot, keyboard, mouse, touch |

## Циклы обратной связи

| Цикл | Описание |
|------|----------|
| **Execution Loop** | web-ui → `auto-next` → execution-service → browser-agent → Playwright → результат → execution-service → web-ui |
| **Recording Loop** | DOM event → inject script → console.debug → recorder-service → SQLite |
| **CDP Recording Loop** | CDP event → cdp-listener → pushAction → HTTP POST → recorder-service → SQLite |
| **Zephyr Sync Loop** | web-ui → sync → testcase-service → Zephyr API → testcase-service → SQLite → web-ui |
| **Composite Expand Loop** | execution-service → step-library → expand → execution-service → insert steps → execute |
| **Health Check Loop** | web-ui → `GET /api/health` каждые 15 сек → индикатор (green/red/orange) |

## Граф зависимостей (包)

```
@qtest/web-ui
├── api-gateway (:3000)
│   ├── testcase-service (:3001)
│   │   └── Zephyr Scale API (external)
│   ├── step-library-service (:3002)
│   ├── execution-service (:3003)
│   │   ├── testcase-service (:3001)
│   │   ├── step-library-service (:3002)
│   │   └── browser-agent (:3005)
│   ├── recorder-service (:3004)
│   └── browser-agent (:3005)
│       └── Playwright (Chromium)
├── @qtest/shared-types
└── xlsx (client-side Excel parsing)
```

## Gateway Route Matching (порядок)

```
/api/testcases      → :3001
/api/folders        → :3001
/api/import         → :3001
/api/zephyr         → :3001
/api/diff           → :3001
/api/coverage       → :3001
/api/steps          → :3002
/api/categories     → :3002
/api/composite-steps      → :3002
/api/composite-categories → :3002
/api/executions     → :3003
/api/reports        → :3003
/api/recordings     → :3004
/api/user-switch    → :3004
/api/settings       → :3004
/api/record         → :3005  ⚠️ match BEFORE /api/recordings
/api/launch         → :3005
/api/profiles       → :3005
/api/agent          → :3005  (stripPrefix: true)
/api/execute-step   → :3005
/api/videos         → :3005
/api/video          → :3005
/api/debug          → :3005
```

> ⚠️ Порядок важен: `/api/record` matching before `/api/recordings` (first-match wins).
