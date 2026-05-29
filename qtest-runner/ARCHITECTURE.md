# QTest Runner — Архитектура проекта

## Общая архитектура (Microservices per Sam Newman)

```
┌──────────────────────────────────────────────────────────────┐
│                    Web UI (React)                            │
│           Dashboard · Editor · Reports · Settings            │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP REST
┌────────────────────────────┴─────────────────────────────────┐
│                   API Gateway (BFF)                          │
│          Routing · Aggregation · Auth · Rate Limit           │
└──┬──────────┬──────────┬──────────┬──────────┬───────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────────┐
│ TC   │ │ Execution│ │ Step     │ │Recorder│ │ Browser          │
│Service│ │ Service  │ │ Library  │ │Service │ │ Agent Service    │
│      │ │          │ │ Service  │ │        │ │ (Desktop Tray)   │
│DB    │ │ DB       │ │ DB       │ │ DB     │ │                  │
└──────┘ └──────────┘ └──────────┘ └────────┘ └────────┬─────────┘
                                                        │ WS / CDP
                                                        ▼
                                               ┌──────────────────┐
                                               │ Chrome Extension │
                                               │ (Action Panel)   │
                                               └──────────────────┘
```

## Микросервисы

| Сервис | Папка | БД | Порты | Ответственность |
|--------|-------|----|-------|-----------------|
| **testcase-service** | `packages/testcase-service/` | testcases.db | 3001 | CRUD, Excel import, Zephyr sync, version diff |
| **step-library-service** | `packages/step-library-service/` | steps.db | 3002 | Reusable actions, parameterized steps |
| **execution-service** | `packages/execution-service/` | execution.db | 3003 | State machine, step orchestration |
| **recorder-service** | `packages/recorder-service/` | recordings.db | 3004 | Capture actions, convert to scripts |
| **browser-agent** | `packages/browser-agent/` | — | 3005 | CDP, profiles, 1C integration |
| **api-gateway** | `packages/api-gateway/` | — | 3000 | BFF, routing, aggregation |
| **web-ui** | `packages/web-ui/` | — | 5173 | React/Vite frontend |
| **chrome-extension** | `packages/chrome-extension/` | — | — | Manifest V3, action panel |

## Принципы (Sam Newman)

1. **Bounded Context** — каждый сервис владеет своей доменной областью
2. **Decentralized Data** — своя БД у каждого сервиса, доступ только через API
3. **Independent Deployability** — независимое развертывание
4. **Failure Isolation** — изоляция сбоев (circuit breaker, retry)
5. **Smart Endpoints, Dumb Pipes** — бизнес-логика в сервисах, не в каналах
6. **Evolutionary Design** — возможность замены сервисов
7. **Technology Diversity** — при необходимости разные технологии
8. **Organize Around Business Capabilities** — группировка по бизнес-возможностям

## Технологии

- **Runtime:** Node.js 22 LTS
- **Язык:** TypeScript (strict mode)
- **HTTP:** Fastify (или Express) — лёгкий, быстрый
- **ORM:** Drizzle ORM (type-safe, легковесный)
- **БД:** SQLite (better-sqlite3), в будущем — PostgreSQL
- **Frontend:** React 18 + Vite + React Router + MUI
- **Bundler:** TurboRepo (монорепозиторий)
- **Browser Automation:** Playwright + Chrome DevTools Protocol (CDP)

## Статус реализации (27.05.2026)

### Iteration 1 — ✅ Завершено

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/shared-types` | ✅ | Базовые интерфейсы: ITestCase, ITestStep, ITestExecution, ILibraryStep |
| `packages/testcase-service` | ✅ | CRUD + Excel import + SQLite. Порты: 3001. Протестирован импорт 100 TC |
| `packages/step-library-service` | ✅ | 8 предустановленных шагов (login, logout, switch_user, click, fill, navigate, verify, screenshot) |
| `packages/api-gateway` | ✅ | BFF на Node.js http, прокси на TC и Step сервисы. Порт: 3000 |
| `packages/web-ui` | ✅ | React SPA (CDN, без сборки) на порту 8080 |
| `start.bat` | ✅ | Скрипт запуска всех сервисов одной командой |
| Импорт 100 TC из Excel | ✅ | 99 новых + 1 обновлённый, 0 ошибок |

### Iteration 2 — ✅ Завершено

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/execution-service` | ✅ | State machine (not_started → running → passed/failed), API с пошаговым выполнением |
| `packages/api-gateway` | ✅ | Прокси на execution-service (порт 3003) |
| `packages/web-ui` | ✅ | ExecutionPage — пошаговая панель выполнения, прогресс-бар, навигация по шагам |
| `start.bat` | ✅ | Добавлен execution-service в автозапуск |

### Iteration 3 — ✅ Завершено

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent` | ✅ | Desktop Agent: WebSocket сервер (порт 3005), Playwright CDP, Browser Manager, Executor, Multi-profile |
| `packages/chrome-extension` | ✅ | Manifest V3: background (WS client), popup UI, content script (индикатор шагов), indicator CSS |
| `packages/api-gateway` | ✅ | Прокси на browser-agent (`/api/agent/*`) |
| `start.bat` | ✅ | Добавлен browser-agent в автозапуск |

### Iteration 4 — ✅ Завершено

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/shared-types` | ✅ | Добавлены типы: IRecordedAction, IRecordingSession, ICompositeStep, IUserSwitchConfig, IUserProfile |
| `packages/recorder-service` | ✅ | Запись действий (click, input, navigate, select, submit), конвертация в шаги, Composite Steps API, User Switch config, WebSocket + HTTP |
| `packages/api-gateway` | ✅ | Прокси на recorder-service (`/api/recordings/*`, `/api/composite-steps/*`, `/api/user-switch/*`) |
| `packages/web-ui` | ✅ | RecorderPage — запись сессий, конвертация в шаги, просмотр результатов |
| `USAGE.md` | ✅ | Полная документация по всем итерациям 1-4 |
| `start.bat` | ✅ | Добавлен recorder-service в автозапуск |

### Iteration 5 — ✅ Завершено

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/testcase-service` | ✅ | Zephyr REST API клиент (zephyr-client.ts), Diff Engine (diff-engine.ts), Coverage API, новые маршруты `/api/zephyr/*`, `/api/diff/*`, `/api/coverage/*` |
| `packages/execution-service` | ✅ | Reports API: `/api/reports/summary`, `/api/reports/history`, `/api/reports/test-case/:key` |
| `packages/api-gateway` | ✅ | Прокси для `/api/zephyr/*`, `/api/diff/*`, `/api/coverage/*` → TC, `/api/reports/*` → Exec |
| `packages/web-ui` | ✅ | SyncPage (Zephyr sync, diff, coverage), ReportsPage (статистика, история, успешность) |
| `USAGE.md` | ✅ | Обновлена документация Iteration 5 |
| `start.bat` | ✅ | Обновлён заголовок |

### Iteration 1 — Foundation
- Монорепозиторий (turbo.json, workspaces)
- shared-types (базовые интерфейсы: ITestCase, ITestStep, IFolder)
- testcase-service (CRUD + Excel import + SQLite)
- step-library-service (базовые определения шагов)
- web-ui (React + список TC + просмотр деталей)
- api-gateway (базовый BFF с прокси)

### Iteration 2 — Execution Engine
- execution-service (state machine: pending → running → passed/failed)
- Интеграция TC Service + Step Library Service
- web-ui: панель выполнения (step-by-step, навигация по шагам)
- Скриншоты на каждом шаге

### Iteration 3 — Chrome Extension + Desktop Agent
- Chrome Extension (Manifest V3): панель действий, индикация шага
- Desktop Agent (Node.js tray): управление Chrome профилями
- WebSocket bridge: Extension ↔ Desktop Agent ↔ Backend
- Multi-profile: запуск нескольких сессий для разных пользователей

### Iteration 4 — Recorder + Complex Scenarios
- Recorder Service: запись кликов, вводов, навигации
- Конвертация записи в шаги тест-кейса
- User Switch: hotkey/action для смены пользователя
- Composite steps: вложенные шаги из библиотеки
- Multi-domain: поддержка нескольких табов/окон

### Iteration 5 — Zephyr Sync + Advanced
- Синхронизация с Zephyr Scale через REST API
- Сравнение Excel-экспорта с локальной БД (diff)
- Отчёты: статистика прохождений, история
- Coverate (Issues) — связь с Jira задачами

### Iteration 6 — Iframe Bridge (29.05.2026)
- Cross-origin iframe поддержка в executor: `resolveFrame()` с 5 стратегиями поиска
- Frame metadata в recordStep: `frameName`, `frameUrl`, `frameSelector`, `iframeAction`
- Инжект-скрипт в iframe: `injectIntoFrame()` + `injectIntoAllFrames()`
- Iframe bridge (postMessage): перехват `__record` в iframe + message listener в top frame
- DB schema: 13 новых колонок (`input_type` — `iframe_action`) через ALTER TABLE
- E2E: same-origin + cross-origin iframe (click, fill, select) — все 5 операций passed

---

## Глубина логирования

> **ВАЖНО:** Всё ниже — это ТРЕБОВАНИЕ к логированию. Каждый пункт ОБЯЗАН быть реализован.

### Уровень 1: Пользовательские действия (каждое)

| Поле | Описание | Пример |
|------|----------|--------|
| `actionType` | Тип действия | click, fill, select, keypress, check, submit, contextmenu, drag, hover, focus, scroll, resize, clipboard, canvas_click, selection |
| `selector` | CSS/Playwright селектор | `button >> text=Войти`, `#email`, `[data-testid='submit']` |
| `selectorText` | Текст/label элемента | `Войти`, `Email`, `На согласование` |
| `value` | Значение (введённое, выбранное) | `user@test.com`, `manager`, `Enter` |
| `combo` | Комбинация клавиш | `Ctrl+Shift+U`, `Ctrl+C` |
| `modifiers` | Модификаторы | `ctrl+shift`, `alt` |
| `inputType` | Тип input поля | `text`, `email`, `password`, `checkbox`, `radio`, `date` |
| `checked` | Состояние чекбокса | `true` / `false` |
| `optionIndex` | Индекс выбранной опции | `2` |
| `x`, `y` | Координаты (contextmenu, canvas_click) | `150`, `300` |
| `length` | Длина выделенного текста (selection) | `42` |
| `selectionText` | Выделенный текст (selection) | `Выделенный текст` |
| `scrollY`, `scrollMax` | Позиция прокрутки | `500`, `2000` |
| `shadowDom` | Из Shadow DOM | `true` / `false` |
| `displayValue` | Отображаемое значение select | `Менеджер` (при value=`manager`) |
| `url` | URL страницы | `https://example.com/login` |
| `pageTitle` | Заголовок страницы | `Вход в систему` |
| `timestamp` | Время действия (ISO) | `2026-05-28T13:00:00.000Z` |

### Уровень 2: HTTP запросы/ответы (каждый)

| Поле | Описание | Ограничение |
|------|----------|-------------|
| `method` | HTTP метод | GET, POST, PUT, DELETE, PATCH |
| `url` | Полный URL | — |
| `resourceType` | Тип ресурса | xhr, fetch, document, script, image |
| `postData` | Тело запроса | до 500 символов |
| `status` | HTTP статус-код | 200, 301, 404, 500 |
| `body` | Тело ответа | до 500 символов |
| `headers` | Заголовки (JSON) | до 200 символов/значение |
| `error` | Причина ошибки запроса | `net::ERR_CONNECTION_REFUSED` |

### Уровень 3: DOM-изменения (debounce 500ms)

| Тип | Что логируется | Когда |
|-----|---------------|-------|
| `element_appear` | selector, tag, role, путь в DOM | Новый видимый элемент (listbox, dialog, table, modal) |
| `element_remove` | selector, tag, путь в DOM | Элемент удалён из DOM |
| `attr_change` | selector, attrName, newValue, oldValue | Изменение атрибута (кроме class/style) |
| `text_change` | selector, новый текст | Изменение текстового узла |
| `navigate` | URL (SPA pushState) | Смена URL без перезагрузки |

### Уровень 4: Системные события

| Тип | Что логируется |
|-----|---------------|
| `dialog` | тип (alert/confirm/prompt), сообщение, результат |
| `console` | уровень (log/error/warn), сообщение (до 200 символов) |
| `page_load` | URL загруженной страницы |
| `framenavigated` | URL навигации фрейма |

### Уровень 5: Overlay UI (floating panel)

- **Позиция:** bottom-right, 420x280px
- **Цвета:** green=click, yellow=fill, cyan=navigate, red=error, magenta=check, blue=key, orange=ctxmenu, gray=info
- **Функции:** перетаскивание, сворачивание, счётчик событий (до 200)
- **Формат:** `<time> <TYPE> <detail>`

### Уровень 6: Консоль browser-agent

Каждое действие логируется в консоль browser-agent:
```
[recorder] pushAction click selector="button >> text=Submit" text="Submit" elem=BUTTON → pending=3 (session=abc12345)
[recorder] flush 3 actions → http://localhost:3004/api/recordings/abc12345/actions
[recorder]   → click: "Submit" [button >> text=Submit]
[recorder]   → fill: "Email" = "user@test.com"
[recorder]   → navigate: https://example.com/success
[recorder] flush OK (3 actions sent)
```

---

## Формат тест-кейсов (конвертация действий → шаги)

### Структура ConvertedStep

```typescript
interface ConvertedStep {
  // Основные поля
  action: string;           // Описание шага на русском
  testData: string;         // Тестовые данные
  expectedResult: string;   // Ожидаемый результат

  // Метаданные действия
  actionType: string;       // click, fill, navigate, ...
  selector: string;         // CSS/Playwright селектор
  selectorText: string;     // Текст элемента
  url: string;              // URL страницы
  pageTitle: string;        // Заголовок страницы
  timestamp: string;        // ISO timestamp

  // HTTP данные
  httpMethod: string;       // GET, POST, ...
  httpStatus: number;       // 200, 404, ...
  httpUrl: string;          // URL запроса
  requestBody: string;      // Тело запроса
  responseBody: string;     // Тело ответа
  curl: string;             // curl-команда для воспроизведения

  // Дополнительно
  combo: string;            // Комбинация клавиш
  displayValue: string;     // Отображаемое значение select
}
```

### Правила генерации шагов

| Действие | Формат action | testData | expectedResult |
|----------|--------------|----------|----------------|
| Navigate | `Перейти по URL <url>` | URL | `Страница загружена: "<title>"` |
| Click | `Нажать "<text>" [selector=<primary>]` | — | `Элемент активирован` |
| Canvas Click | `Нажать на canvas "<text>" по координатам (x, y)` | `{"x":<x>,"y":<y>}` | `Клик выполнен по указанным координатам` |
| Fill | `Заполнить "<label>" [selector=<s>] = "<value>"` | значение | `Поле заполнено` |
| Select | `Выбрать "<display>" в "<label>"` | value | `Значение выбрано` |
| Keypress Enter | `Нажать Enter на "<label>"` | — | `Действие выполнено` |
| Keypress Combo | `Нажать Ctrl+C на "<label>"` | — | `Действие выполнено` |
| Check | `Отметить/Снять "<label>" [type=checkbox]` | — | `Состояние: checked/unchecked` |
| HTTP Request | `HTTP POST <url>` | postData | `Запрос отправлен` |
| HTTP Response | `HTTP POST <url> → 200 OK` | body (до 200) | `Ответ получен` / `Ошибка: 404` |
| Element appear | `Появился <tag> "<role>" [selector=<s>]` | — | `Элемент виден` |
| Submit | `Отправить форму "<id>"` | — | `Форма отправлена` |
| Context menu | `Нажать правой кнопкой на "<text>" [x, y]` | — | `Меню открыто` |
| Dialog | `Диалог "<type>": "<message>"` | message | `Диалог обработан` |

### Пример curl-генерации

```
HTTP POST https://example.com/api/login → 200 OK
curl: curl -X POST "https://example.com/api/login" -H 'Content-Type: application/json' -d '{"email":"user@test.com","password":"***"}'
```

---

## Inject-модули (browser-agent)

### inject-helpers.ts (11 модулей, v2 — 28.05.2026) + 6 inline (recorder.ts)

| Модуль | Функция | Типы действий |
|--------|---------|---------------|
| `SHADOW_DOM_HELPER` | `__deepEventTarget(event)` через `composedPath()[0]` + `__deepActiveElement(root)` | click, fill внутри shadow root |
| `IFRAME_HELPER` | `__getFrameSelector(win)` + `__getFramePath(win)` — рекурсивный до root | frame[name="..."] >> selector |
| `SPA_NAV_HELPER` | monkey-patch `history.pushState()`/`replaceState()` + `popstate`/`hashchange` | navigate (spaMethod) |
| `ERROR_TRACKER_HELPER` | `window.addEventListener('error')` + `unhandledrejection` | js_error, unhandled_rejection |
| `ASSERTION_HELPER` | `__generateAssertion(actionType, data)` — URL/title/value/visible | assertText, assertValue, assertChecked |
| `JIRA_DETECTOR_HELPER` | Детекция AUI, Froala, Zephyr, plugin iframe'ы при старте | jira_env |
| `COOKIE_CONSENT_HELPER` | MutationObserver для OneTrust/CookieYes/Cookiebot/generic | cookie_consent |
| `TOUCH_WHEEL_HELPER` | touchstart/touchend/touchmove (x,y) + wheel (deltaX, deltaY) | touchstart, touchend, touchmove, wheel |
| `ANIMATION_HELPER` | transitionend/start + animationend/start (propertyName, elapsedTime) | transition_end, animation_end |
| `LIFECYCLE_HELPER` | visibilitychange + pagehide/pageshow + dialog observer + details toggle | visibility_change, dialog_element, details_toggle |
| `FILE_UPLOAD_HELPER` | `input[type="file"]` change event + file names capture | file_upload |

### Иерархия inject-скрипта в recorder.ts

```
INJECT_SCRIPT (template literal)
├── SHADOW_DOM_HELPER     — глобальные функции для composedPath
├── IFRAME_HELPER          — frame selector/path generators
├── SPA_NAV_HELPER         — history API monkey-patch
├── ERROR_TRACKER_HELPER   — error listeners
├── ASSERTION_HELPER       — assertion generator
├── JIRA_DETECTOR_HELPER   — env detector
├── COOKIE_CONSENT_HELPER  — cookie banner detector
├── TOUCH_WHEEL_HELPER     — touch/wheel handlers
├── ANIMATION_HELPER       — transition/animation handlers
├── LIFECYCLE_HELPER       — lifecycle/handlers
├── FILE_UPLOAD_HELPER     — file upload handler
├── __setupRecorder()      — основной setup
│   ├── Создание overlay (floating panel)
│   ├── Регистрация обработчиков (click, input, change, keydown, ...)
│   │   └── Все используют __deepEventTarget(event) вместо event.target
│   ├── MutationObserver (element_appear, attr_change, text_change)
│   └── cookie consent + jira env auto-detect
└── __setupRecorder() — вызов сразу (без polling)
```

## Архитектура записи (3 уровня)

```
┌─────────────────────────────────────────────────────────────┐
│                    Уровень 1: Playwright                     │
│  context.on('framenavigated'), page.on('load'),             │
│  context.on('page'), page.on('request'/'response'),         │
│  page.on('console'), page.on('dialog'), page.on('pageerror')│
│  recordVideo: { dir: 'videos', size: 1440x900 }             │
│    └── видео сохраняется при stopRecording как <sid>.webm   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                  Уровень 2: Browser Inject                  │
│  addInitScript + addScriptTag + CDP Runtime.evaluate        │
│  click(composedPath), input(500ms), change, keydown, focus, │
│  contextmenu, dragstart/dragend/drop, submit, scroll(800ms),│
│  mouseenter/mouseleave, resize, copy/paste,                 │
│  touchstart/touchend/touchmove, wheel,                      │
│  transitionend/start, animationend/start, visibilitychange, │
│  toggle(details), MutationObserver(500ms),                  │
│  cookie consent auto-detect, Jira env detector              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                Уровень 3: Executor Recording                 │
│  После execute-step: navigate, click, fill, select, check,  │
│  keypress, drag, scroll, wait, verify,                      │
│  hover, dragTo, wheel, touch, fileUpload, waitForSelector,  │
│  assertText, assertVisible, assertValue, assertChecked,     │
│  assertUrl                                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  pushAction  │
                    │  → recorder  │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │  flushActions │
                    │  (2s interval) │
                    └──────┬───────┘
                           │ POST
                    ┌──────┴───────┐
                    │ recorder-    │
                    │ service      │
                    │ → SQLite     │
                    │ → convertTo  │
                    │   Steps()    │
                    └──────────────┘
```

### Уровень 7: Iframe Bridge (cross-origin support) — 29.05.2026

```
┌──────────────────────────────────────────────────────────────────┐
│                    Коммуникация с iframe'ами                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Same-origin iframe:                                              │
│  ┌─────────────────────────────┐                                 │
│  │ addInitScript (все фреймы)  │ ← CDP Page.addScriptToEvaluate  │
│  │ + addScriptTag (каждый      │   OnNewDocument (все фреймы)    │
│  │   фрейм при framenavigated) │                                 │
│  └──────────────┬──────────────┘                                 │
│                  ▼                                                │
│  ┌─────────────────────────────┐                                 │
│  │  __record(data) в контексте  │  ← инжект-скрипт внутри iframe │
│  │  iframe:                     │                                 │
│  │   ├─ data.frameUrl = loc     │                                 │
│  │   ├─ data.frameName = name   │                                 │
│  │   ├─ data.iframeAction = true│                                 │
│  │   ├─ console.debug(...)      │ → page.on('console') + tagging │
│  │   └─ window.__recordAction() │ → exposeFunction + pushAction  │
│  └─────────────────────────────┘                                 │
│                                                                   │
│  Cross-origin iframe (executor-level, скрипт не инжектится):      │
│  ┌─────────────────────────────┐                                 │
│  │ resolveFrame(page, cmd)     │ ← 5 стратегий поиска фрейма     │
│  │   ├─ page.frame({name})     │                                 │
│  │   ├─ page.frame({url})      │                                 │
│  │   ├─ page.frame({selector}) │                                 │
│  │   ├─ итерация по именам     │                                 │
│  │   └─ итерация по URL        │                                 │
│  └──────────────┬──────────────┘                                 │
│                  ▼                                                │
│  ┌─────────────────────────────┐                                 │
│  │ frame.click/fill/select...  │ ← Playwright API (работает      │
│  │ recordStep() + frameMeta    │   для любых origin)             │
│  └─────────────────────────────┘                                 │
│                                                                   │
│  Frame metadata в записи (Session 2):                             │
│  ┌─────────────────────────────┐                                 │
│  │ frameName: string           │ ← имя/ID iframe                 │
│  │ frameUrl: string            │ ← src URL iframe                │
│  │ frameSelector: string       │ ← Playwright frame selector     │
│  │ iframeAction: boolean       │ ← true если действие в iframe   │
│  └─────────────────────────────┘                                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Composited frame path (postMessage bridge — legacy/fallback):**

```
1. Iframe → __record(data) → __origRecord(data) → console.debug
                            → window.parent.postMessage({__qtestAction, data})
2. Top frame → message listener → contentWindow matching
            → __record(data) с frameUrl/frameName/iframeAction
```

**DB schema (13 новых колонок в recorded_actions):**

| Колонка | Тип | Описание |
|---------|-----|----------|
| `input_type` | TEXT | Тип input (text, email, password...) |
| `checked` | INTEGER | Состояние чекбокса (0/1) |
| `option_index` | INTEGER | Индекс опции select |
| `x`, `y` | INTEGER | Координаты |
| `scroll_y`, `scroll_max` | INTEGER | Прокрутка |
| `shadow_dom` | INTEGER | Из Shadow DOM |
| `display_value` | TEXT | Отображаемое значение |
| `frame_name` | TEXT | Имя/ID iframe |
| `frame_url` | TEXT | URL iframe |
| `frame_selector` | TEXT | Селектор iframe |
| `iframe_action` | INTEGER | Флаг iframe действия |

## MCP-инструменты для отладки

### mcp-browser (расширенный)

| Инструмент | Описание |
|------------|----------|
| `browser_start_recording` | Начать запись (создание сессии + запуск) |
| `browser_stop_recording` | Остановить запись |
| `browser_get_recorded_actions` | Получить действия (full/summary/steps/testcase) |
| `browser_navigate` | Навигация |
| `browser_click` | Клик |
| `browser_type` | Ввод текста |
| `browser_press` | Нажатие клавиши |
| `browser_screenshot` | Скриншот |
| `browser_inspect` | Инспекция DOM |
| `browser_evaluate` | Выполнение JS |
| `browser_wait` | Ожидание |
| `browser_get_html` | Получение HTML |
| `browser_inject_and_inspect` | Инжекция + инспекция |

### mcp-qtest-debug (отладочный)

| Инструмент | Описание |
|------------|----------|
| `qtest_health` | Проверка здоровья всех сервисов |
| `qtest_launch_browser` | Запуск браузера |
| `qtest_record_start` | Старт записи (полный цикл) |
| `qtest_record_stop` | Остановка записи |
| `qtest_get_actions` | Получение действий (full/summary/testcase) |
| `qtest_convert_steps` | Конвертация в шаги |
| `qtest_execute_step` | Выполнение шага |
| `qtest_check_db` | Диагностика БД |
