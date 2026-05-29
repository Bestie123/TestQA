# Статус проекта qtest-runner — Май 2026

## Файлы для чтения перед началом

| Файл | Зачем |
|------|-------|
| `ARCHITECTURE.md` | Архитектура микросервисов, порты, стиль кода |
| `AGENTS.md` | Правила оформления тест-кейсов (Zephyr Scale + Jira) |
| `PROBLEMS.md` | Известные проблемы и гипотезы |
| `LOOP_RULES.md` | Правила защиты от зацикливания |

## Сервисы и порты

| Сервис | Порт | Статус |
|--------|------|--------|
| api-gateway | 3000 | ✅ |
| testcase-service | 3001 | ✅ |
| step-library-service | 3002 | ✅ |
| execution-service | 3003 | ✅ |
| recorder-service | 3004 | ✅ |
| browser-agent | 3005 | ✅ |
| web-ui | 8080 | ✅ |
| mcp-browser | stdio | ✅ |
| mcp-qtest-debug | stdio | ✅ (НОВЫЙ) |

## Что сделано

### 1. MCP инструменты (✅)
- `packages/mcp-browser/src/index.ts` — добавлены `browser_stop_recording`, `browser_get_recorded_actions` (4 формата: full/summary/steps/testcase)
- `packages/mcp-qtest-debug/` — новый MCP с 8 инструментами: `qtest_health`, `qtest_launch_browser`, `qtest_record_start`, `qtest_record_stop`, `qtest_get_actions`, `qtest_convert_steps`, `qtest_execute_step`, `qtest_check_db`
- Зарегистрирован в `C:\Users\misch\.config\opencode\opencode.jsonc`

### 2. Доработка convertToSteps (✅)
- `packages/recorder-service/src/db.ts` — новый интерфейс `ConvertedStep` с полями: selector, curl, httpMethod, httpStatus, requestBody, responseBody, displayValue, combo, timestamp, duration
- HTTP request/response теперь включаются в шаги с curl-командами

### 3. Расширенное логирование (✅)
- `packages/browser-agent/src/recorder.ts` — подробное логирование каждого действия: click, fill, select, navigate, HTTP request/response, DOM events
- `packages/recorder-service/src/server.ts` — логирование полученных действий
- Overlay UI — плавающее окно внизу справа на страницах

### 4. ARCHITECTURE.md (✅)
- Добавлен раздел "Глубина логирования" — 6 уровней
- Добавлен раздел "Формат тест-кейсов" — структура ConvertedStep
- Добавлен раздел "MCP-инструменты для отладки"

### 5. ws-server.ts (✅)
- Исправлена передача `body.url`, `body.selector`, `body.key` в execute-step

## 3 корневые проблемы INJECT_SCRIPT (исправлены 28.05.2026)

### Проблема 1: Старая БД без extended колонок
- **Симптом:** `flush OK (N actions sent)` — ложный успех, действия НЕ сохранялись
- **Причина:** В `recordings.db` не было колонок `method`, `resource_type`, `post_data`, `headers_json`, `status_code`, `response_body` — INSERT падал с 500, `postJson` глотал ошибку
- **Фикс:** Удалить старую БД, перезапустить — схема создаётся заново

### Проблема 2: better-sqlite3 v11.10.0 баг с 22 параметрами
- **Симптом:** `"Too few parameter values were provided"` при INSERT с 22 полями
- **Причина:** better-sqlite3 v11.10.0 не поддерживает `.prepare().run()` с >12 аргументов, когда часть undefined
- **Фикс:** Разделить INSERT на base (12 колонок) + `d.exec()` с экранированием для extended полей (`method`, `resource_type`, `post_data`, `headers_json`, `status_code`, `response_body`, `error`, `level`, `combo`, `modifiers`)
- **Файл:** `packages/recorder-service/src/db.ts` — функция `addActionsBulk`

### Проблема 3: INJECT_SCRIPT падает при addInitScript (document.body null)
- **Симптом:** DOM-события (click, fill, select) не записываются. Playwright-level события работают.
- **Причина 1:** `__createOverlay()` вызывался ДО регистрации event listener'ов. При `addInitScript` (до `DOMContentLoaded`) `document.body === null` → исключение → ВСЕ event listener'ы не регистрируются.
- **Причина 2:** `window.__qtestRecorderInjected = true` устанавливался ДО `__setupRecorder()`, поэтому повторная инжекция через `addScriptTag` (когда DOM готов) сразу выходила (флаг уже true).
- **Фикс:** 
  - Проверка `document.body === null` → defer to `DOMContentLoaded`
  - `window.__qtestRecorderInjected = true` перемещён внутрь `__setupRecorder()`
  - `__createOverlay()` убран из начала `__setupRecorder()` (overlay создаётся позже)
  - Named function `__qtestInject` вместо `arguments.callee` (strict-mode safe)
  - MutationObserver обёрнут в try-catch
- **Файл:** `packages/browser-agent/src/recorder.ts` — константа `INJECT_SCRIPT`

## Решение: Executor-level recording (дополнительно)

INJECT_SCRIPT ловит ТОЛЬКО ручные действия пользователя в браузере. Playwright-команды (`execute-step`) выполняются на уровне Node.js и НЕ генерируют DOM-события, которые может поймать инжект-скрипт.

**Решение:** `packages/browser-agent/src/executor.ts` — после каждого execute-step явно вызывается `pushAction()` в recorder.

Пример: после `page.click(selector)` → executor вызывает `pushAction(sessionId, { actionType: 'click', selector: '...' })`.

### Какие действия записываются:
| Action | Источник |
|--------|----------|
| request / response / page_load | Playwright-level (page.on) |
| navigate | Playwright-level (framenavigated) |
| console / error | Playwright-level (page.on console) |
| click / fill / select | Executor-level (executor.ts) |
| check / keypress / drag / scroll / wait / verify | Executor-level (executor.ts) |

## Как работает запись (итоговая архитектура)

```
User/Agent
  │
  ├─ execute-step (REST) ──► executor.ts ──► pushAction() ──► recorder
  │                               │
  │                               └─ Playwright page.click/fill/etc.
  │
  ├─ Браузер (ручные действия) ──► INJECT_SCRIPT ──► pushAction() ──► recorder
  │                                      │
  │                                      ├─ console.debug("__QTEST_ACTION__")
  │                                      └─ window.__recordAction(data)
  │
  └─ Playwright events ──► recorder.ts on('request'/on('framenavigated')
                           ──► pushAction() ──► recorder

recorder ──► flushActions() ──► POST /api/recordings/:id/actions
                                       │
                              recorder-service ──► SQLite (recordings.db)
                                       │
                              convertToSteps() ──► тест-кейсы
```

### Iteration 6 — ✅ Завершено (28.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent/src/inject-helpers.ts` | ✅ | Новый файл: 11 модулей (Shadow DOM composedPath, iframe, SPA nav, error tracking, assertions, Jira detector, cookie consent, touch/wheel, animation, lifecycle, file upload) |
| `packages/browser-agent/src/recorder.ts` | ✅ | Все handlers используют `__deepEventTarget(event)`, убран URL polling, +15 action types в formatActionDetail |
| `packages/browser-agent/src/executor.ts` | ✅ | Добавлены hover, dragTo, wheel, touch, fileUpload, waitForSelector, assert* (Text/Visible/Value/Checked/Url) |
| `packages/browser-agent/src/action-parser.ts` | ✅ | Русские паттерны для assert*, hover, drag, wheel, wait, file upload |
| `packages/recorder-service/src/db.ts` | ✅ | convertToSteps: +15 case'ов с русскими описаниями |
| `packages/stub-site/public/advanced-test.html` | ✅ | Тестовая страница: Shadow DOM, iframe, SPA, transitions, drag, dialog, details, file upload |
| `AGENTS.md` | ✅ | Добавлен "Best Practices: Playwright Recording" с 3-level архитектурой |

### Iteration 7 — ✅ Завершено (29.05.2026) — Iframe Bridge

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent/src/executor.ts` | ✅ | `resolveFrame()` — 5 стратегий поиска iframe. Все `recordStep()` включают `frameMeta` (frameName, frameUrl, frameSelector, iframeAction) |
| `packages/browser-agent/src/recorder.ts` | ✅ | `injectIntoFrame()` + `injectIntoAllFrames()` — инжект скрипта в iframe. Iframe bridge (postMessage) с frameName tagging. Frame tracking (buildFrameMap, onFrameNav) |
| `packages/browser-agent/src/ws-server.ts` | ✅ | Forwarding frame metadata (frameName, frameUrl, frameSelector) в execute-step |
| `packages/browser-agent/src/action-parser.ts` | ✅ | ParsedCommand: frameName, frameUrl, frameSelector |
| `packages/recorder-service/src/db.ts` | ✅ | DB schema: 13 extended колонок. ALTER TABLE миграции. 35-колоночный INSERT |
| `packages/recorder-service/src/server.ts` | ✅ | WS action handler: frame поля |
| `packages/browser-agent/src/browser-manager.ts` | ✅ | verifyText: Page → Page \| Frame |
| E2E: same-origin iframe | ✅ | click/fill в #first-frame → frameName=first-frame, iframeAction=True |
| E2E: cross-origin iframe | ✅ | click/fill/select в cross-frame (порт 9091) → все 3 операции passed |
| `ARCHITECTURE.md` | ✅ | Добавлен Iframe Bridge раздел (Уровень 7) + Iteration 6 |
| `STATUS.md` | ✅ | Текущий файл |

### Iteration 8 — ✅ Завершено (29.05.2026) — CAPTCHA Detection + Inject Script Fix

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent/src/inject-helpers.ts` | ✅ | CAPTCHA_DETECTOR_HELPER — детекция ReCaptcha v2 (.g-recaptcha), Turnstile (.cf-turnstile), hCaptcha (.h-captcha), generic (class/id keywords). `setTimeout(__checkCaptcha, 1500)` + MutationObserver для динамических CAPTCHA |
| `packages/browser-agent/src/recorder.ts` | ✅ | Исправлен SyntaxError: добавлен `} catch(e) {}` для `try { __observer = new MutationObserver(...)` блока (отсутствовал ~80 строк кода, что вызывало parse-time ошибку и полный отказ INJECT_SCRIPT) |
| `packages/browser-agent/src/inject-helpers.ts` | ✅ | Все вызовы CAPTCHA-детекции обёрнуты в try/catch: тело `__checkCaptcha()`, `setTimeout`, MutationObserver callback |
| CAPTCHA standalone test | ✅ | `captcha-verify-test.cjs` — Playwright навигация + evaluate CAPTCHA JS, находит `.h-captcha`, возвращает `{actionType:"captcha_detected", selector:"DIV.h-captcha"}` |
| CAPTCHA full pipeline | ✅ | 21+ actions, включая 4-6 `captcha_detected` (ReCaptcha v2, Turnstile, hCaptcha) на http://localhost:9090/ и http://localhost:9090/captcha-test.html |
| E2E: captcha-test.html (first nav) | ✅ | 6 captcha_detected actions (3 типа × 2 injection) |
| E2E: main → captcha (second nav) | ✅ | 27 total actions, 6 captcha_detected |

## Открытые задачи

### P0 — Критичные (все выполнены)
- [x] Решить проблему INJECT_SCRIPT — DOM-события должны записываться
- [x] Playwright-команды (execute-step) должны записываться в recorder
- [x] Shadow DOM composedPath() для прохода через shadow boundary
- [x] iframe детекция + frame selector path
- [x] SPA навигация (monkey-patch history API)
- [x] Error tracking (window.onerror + unhandledrejection)
- [x] Cross-origin iframe postMessage bridge + executor resolveFrame

### Iteration 9 — ✅ Завершено (29.05.2026) — Скриншоты + Multi-tab + MCP тестирование

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent/src/executor.ts` | ✅ | Скриншот на каждом executor-действии (navigate, click, fill, select и т.д.). `recordStep()` вызывается после `takeScreenshot()`, скриншот включён в данные. + `switchTab`, `listTabs` actions |
| `packages/browser-agent/src/browser-manager.ts` | ✅ | Multi-tab: `pages[]` tracking, `on('page')` listener, `switchToPage(indexOrUrl)`, `getPages()` |
| `packages/browser-agent/src/action-parser.ts` | ✅ | `switchTab`, `listTabs` patterns (EN + RU: "переключить вкладку", "список вкладок") |
| `packages/recorder-service/src/db.ts` | ✅ | `ConvertedStep.screenshot` поле добавлено |
| MCP: `qtest_health` | ✅ | Проверен — все сервисы с статусом |
| MCP: `qtest_launch_browser` | ✅ | Проверен — запуск/повторное использование браузера |
| MCP: `qtest_record_start/stop` | ✅ | Проверены — создание и остановка сессий |
| MCP: `qtest_get_actions` | ✅ | Проверен — получение действий (full/summary/steps/testcase форматы) |
| MCP: `qtest_convert_steps` | ✅ | Проверен — конвертация шагов с русскими описаниями |
| MCP: `qtest_execute_step` | ✅ | Проверен — выполнение шагов со скриншотом |
| MCP: `qtest_check_db` | ✅ | Проверен — просмотр БД |
| Real-site CAPTCHA детекция | ✅ | ReCaptcha v2 (recaptcha-demo.appspot.com) — ✅, Turnstile (clifford.io) — ✅, hCaptcha (democaptcha.com) — ✅ |

### Iteration 9.5 — ✅ Баги записи в БД (исправлены 29.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `headers: {}` в addAction | ✅ | `action.headers ?? '{}'` возвращал `{}` (объект) → better-sqlite3 v11 `"Too few parameter values"`. Фикс: `typeof === 'string' ? headers : JSON.stringify(headers)` |
| undefined-safe параметры | ✅ | Все 35 полей в `vals[]` обёрнуты в `??` (nullish coalescing) |
| postJson reject on 500 | ✅ | `postJson` теперь reject'ит на non-2xx → действия re-queue с retry |
| stopRecording retry | ✅ | 3 retry попытки перед окончательным удалением recording |
| executor race condition | ✅ | `sessionId` и `pendingRef` захватываются ДО `page.goto()` |
| E2E результат | ✅ | 36 actions в БД, 2 со скриншотами |

### Iteration 10 — ✅ User Switch + Drag & Drop (29.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent/src/inject-helpers.ts` — USER_SWITCH_HELPER | ✅ | keydown listener (Ctrl+Shift+U), циклический перебор профилей из localStorage, запись `user_switch` action |
| `packages/browser-agent/src/inject-helpers.ts` — Drag & Drop | ✅ | `dragstart`/`dragend`/`drop` listeners с отслеживанием источника (__dragSource), запись селекторов и координат |
| `packages/browser-agent/src/recorder.ts` | ✅ | `formatActionDetail`: `user_switch`, `dragstart`, `dragend`, `drop` cases |
| `packages/browser-agent/src/ws-server.ts` | ✅ | `POST /api/user-switch/switch` — programmatic триггер по sessionId или profileId |
| `packages/recorder-service/src/db.ts` | ✅ | `user_switch`, `dragstart`, `dragend`, `drop` cases в `convertToSteps` — русские описания |
| `packages/recorder-service/src/db.ts` | ✅ | `user_switch_config` таблица (hotkey, enabled, profiles_json) |
| Executor drag | ✅ | Playwright `locator.dragTo()` — `drag` и `dragTo` actions работают |
| E2E test | ✅ | 28 actions: navigate+ss, user_switch→Admin, click+ss, request/response lifecycle |

### P1 — Важные
- [x] Assertions (assertText, assertVisible, assertValue, assertChecked, assertUrl)
- [x] Touch / Wheel события
- [x] CSS Transition / Animation отслеживание
- [x] Cookie Consent авто-детекция (OneTrust, CookieYes, Cookiebot)
- [x] Jira/Zephyr окружение (AUI, Froala, plugin iframe'ы)
- [x] Page Lifecycle (visibilitychange, pagehide/pageshow)
- [x] File Upload (input[type=file] change)
- [x] HTML dialog / details toggle
- [x] CAPTCHA детекция (ReCaptcha v2, Turnstile, hCaptcha)
- [x] Доработать MCP инструменты (протестировать)
- [x] Добавить скриншоты на каждом шаге
- [x] Multi-tab поддержка (переключение вкладок)
- [x] User Switch (hotkey + API)
- [ ] Проверить E2E: ручные действия в браузере → запись в БД (INJECT_SCRIPT)

### Iteration 11 — ✅ Media Events + Popover API (29.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent/src/inject-helpers.ts` — MEDIA_EVENTS_HELPER | ✅ | `play`/`pause`/`seeked`/`volumechange` listeners на `<video>`/`<audio>`, запись селектора, src, currentTime/duration |
| `packages/browser-agent/src/recorder.ts` | ✅ | `formatActionDetail`: `media_play`, `media_pause`, `media_seeked`, `media_volume` cases |
| `packages/recorder-service/src/db.ts` | ✅ | 4 media cases в `convertToSteps` — русские описания (воспроизвести, пауза, перемотать, громкость) |
| E2E test media | ✅ | 4 media events (play/pause) при создании/удалении видео-элемента |
| `packages/browser-agent/src/inject-helpers.ts` — POPOVER_HELPER | ✅ | `beforetoggle`/`toggle` listeners на `[popover]` элементах, запись newState (open/closed) |
| `packages/browser-agent/src/recorder.ts` | ✅ | `formatActionDetail`: `popover_toggle` case |
| `packages/recorder-service/src/db.ts` | ✅ | `popover_toggle` case в `convertToSteps` — русское описание («открыт»/«закрыт») |

### Documentation (29.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `AGENTS.md` | ✅ | Добавлен раздел «Карта проекта (qtest-runner)»: Mermaid-диаграмма архитектуры, таблица 9 пакетов, ключевые файлы, команды, граф зависимостей |

### Iteration 12 — Composite Steps (29.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/step-library-service/src/index.ts` | ✅ | `composite_steps` + `composite_step_items` таблицы; CRUD: GET/POST/PUT/DELETE; expand endpoint с подстановкой `{{param}}` |
| `packages/step-library-service/src/index.ts` — seed | ✅ | 3 предустановленных composite step: «Авторизация в Jira» (4 шага), «Создание задачи» (4 шага), «Скриншот и проверка текста» (2 шага) |
| `packages/api-gateway/src/index.ts` | ✅ | `/api/composite-steps` исправлен с порта 3004 → 3002 |
| `packages/execution-service/src/index.ts` | ✅ | `POST /api/executions`: pre-fetch composite steps через `expand` endpoint; разворачивает в плоские step_results; auto-next скипает неразвёрнутые composite шаги |
| `packages/shared-types/src/types.ts` | ✅ | `ICompositeStep`, `ICompositeStepItem` (были, не менялись) |

### Iteration 13 — IME Composition (29.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent/src/inject-helpers.ts` — IME_COMPOSITION_HELPER | ✅ | `compositionstart`/`compositionupdate`/`compositionend` слушатели; запись `ime_composition` action с displayValue (финальный текст) |
| `packages/browser-agent/src/recorder.ts` | ✅ | `if (e.isComposing) return;` — input handler скипает промежуточные события IME; formatActionDetail: ime_composition case; импорт + инжект IME_COMPOSITION_HELPER |
| `packages/shared-types/src/types.ts` | ✅ | `'ime_composition'` добавлен в RecordedActionType |
| `packages/recorder-service/src/db.ts` | ✅ | convertToSteps: ime_composition case с русским описанием |

### Iteration 14 — ResizeObserver / IntersectionObserver (29.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `packages/browser-agent/src/inject-helpers.ts` — RESIZE_OBSERVER_HELPER | ✅ | Monkey-patch `window.ResizeObserver`: запись `element_resize` при изменении размеров (w:h, debounced). Monkey-patch `window.IntersectionObserver`: запись `element_intersect` при изменении видимости (visible/hidden + ratio%) |
| `packages/shared-types/src/types.ts` | ✅ | `'element_resize'`, `'element_intersect'` добавлены в RecordedActionType |
| `packages/browser-agent/src/recorder.ts` | ✅ | Импорт + инжект RESIZE_OBSERVER_HELPER; formatActionDetail cases |
| `packages/recorder-service/src/db.ts` | ✅ | convertToSteps: русские описания (изменил размер / стал видим/скрыт) |

### Iteration 15 — ✅ Exhaustive Verification + SQLite double-quote fix + press→keypress (29.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| SQLite double-quote fix | ✅ | `WHERE category != ""` → `WHERE category != ''` в step-library-service (SQLite: `""` = column identifier). Fastify v5 object response wrap |
| Exhaustive recording verification | ✅ | 17/17 INJECT_SCRIPT модулей подтверждены. 175 actions, 0 JS errors, 139 steps. Тестовая страница со всеми типами элементов (form, shadow DOM, iframe, drag, popover, details, dialog, video, file input) |
| press→keypress fix | ✅ | action-parser.ts: `if (a === 'keypress')` → `if (a === 'keypress' \|\| a === 'press')`. ws-server.ts: fallback для `body.action === 'press'` |

### Iteration 16 — ✅ Canvas Click Recording + Video Recording + Selection Tracking (30.05.2026)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| Canvas click INJECT_SCRIPT | ✅ | Уже был: `tag === 'canvas'` → `actionType:"canvas_click"` с `x:e.offsetX, y:e.offsetY` |
| Canvas click formatActionDetail | ✅ | `recorder.ts` — `canvas_click` case с координатами |
| Canvas click executor | ✅ | `executor.ts` — `click` handler использует `position: { x, y }` через `clickElementAt()` |
| Canvas click action-parser | ✅ | `canvas_click` action + русский паттерн "нажать на canvas ... по координатам (x, y)" |
| Canvas click ws-server | ✅ | `canvas_click` forwarding в fallback (selector + x, y) |
| Canvas click convertToSteps | ✅ | `db.ts` — шаг: "Нажать на canvas ... по координатам (x, y)" |
| Video recording launch | ✅ | `recordVideo: { dir: 'videos', size: 1440x900 }` в `launchPersistentContext` |
| Video recording save | ✅ | `stopRecording()` → `saveVideo(page, sessionId)` → `<sessionId>.webm` |
| Video recording API | ✅ | `GET /api/videos` (список), `GET /api/video/path` (текущий), `GET /api/video/download?file=...` |
| Video management | ✅ | `saveVideo()`, `getVideoPath()`, `listVideos()`, `deleteVideo()` в browser-manager |
| Selection tracking INJECT | ✅ | `selectionchange` listener (debounce 400ms) в INJECT_SCRIPT — запись `actionType:"selection"` с текстом, длиной, селектором |
| Selection tracking DB | ✅ | `selection_length`, `selection_text` колонки в recorded_actions. convertToSteps: "Выделить текст ..." |
| Selection tracking parser | ✅ | action-parser: русский паттерн "выделить текст ..." → verify |

### P2 — Желательные
- [x] User Switch, Media Events, Popover API, Drag & Drop, Composite Steps, IME Composition
- [x] ResizeObserver / IntersectionObserver
- [x] Canvas click recording
- [x] Video recording (playwright-screen-recorder)
- [x] Selection tracking
- [ ] Мультиязычные сообщения CAPTCHA (поддержка русского языка)

---

## Чеклист верификации (29.05.2026)

### Build & Compilation
- [x] `npm run build` — 0 ошибок (все 9 пакетов)
- [x] step-library-service — 0 tsc errors
- [x] browser-agent — 0 tsc errors (IME + ResizeObserver modules)
- [x] recorder-service — 0 tsc errors (convertToSteps cases)
- [x] shared-types — 0 tsc errors (new action types)
- [x] api-gateway — 0 tsc errors (route fix)

### Services Health
- [x] step-library-service (3002): `GET /health` → `ok`
- [x] recorder-service (3004): `GET /health` → `ok`
- [x] browser-agent (3005): `GET /health` → `ok`
- [x] api-gateway (3000): `GET /health` → `ok`

### Composite Steps — API
- [x] `GET /api/composite-steps` — 3 seed steps (comp-jira-login/comp-create-task/comp-screenshot-verify)
- [x] `POST /api/composite-steps` — создание нового (comp-test-create)
- [x] `DELETE /api/composite-steps/:id` — удаление (вернулось к 3)
- [x] `POST /api/composite-steps/:id/expand` — подстановка параметров:
  - `{{url}}` → `https://jira.example.com/login`
  - `{{username}}` → `testuser`
  - `{{password}}` → `pass123`
  - library_step_id resolve: `lib-fill-field` → `fill_field`, `lib-click-btn` → `click_button`

### Recording Pipeline (browser-agent → recorder-service)
- [x] Launch browser: profileId получен
- [x] Create session: sessionId получен, status=recording
- [x] Record start: ok=true
- [x] Navigate to `http://example.com`: status=passed, 22 actions recorded
- [x] Navigate to `http://localhost:9090/advanced-test.html`: passed, 22 actions total
- [x] Zero JS errors: `js_error` = 0, `unhandled_rejection` = 0
- [x] Module types present: navigate, request, response, request_failed, page_load, page_hide, page_show, visibility_change
- [x] convertToSteps: 26 steps generated from 22 actions

### MCP Tools (mcp-qtest-debug)
- [ ] qtest_health — проверен ранее в Iteration 9
- [ ] qtest_launch_browser — проверен ранее
- [ ] qtest_record_start/stop — проверены ранее
- [ ] qtest_get_actions — проверен ранее
- [ ] qtest_execute_step — проверен ранее
- [ ] qtest_convert_steps — проверен ранее

## Ключевые файлы для изменений

| Файл | Что менять |
|------|-----------|
| `packages/browser-agent/src/inject-helpers.ts` | НОВЫЙ — 11 модулей inject |
| `packages/browser-agent/src/recorder.ts` | INJECT_SCRIPT, инжект, логирование, pushAction |
| `packages/browser-agent/src/executor.ts` | Запись execute-step в recorder |
| `packages/browser-agent/src/ws-server.ts` | API endpoints |
| `packages/browser-agent/src/browser-manager.ts` | Управление браузером, exposeFunction |
| `packages/recorder-service/src/db.ts` | convertToSteps, БД (workaround INSERT) |
| `packages/recorder-service/src/server.ts` | HTTP routes |
| `packages/mcp-browser/src/index.ts` | MCP инструменты |
| `packages/mcp-qtest-debug/src/index.ts` | Debug MCP |
| `packages/stub-site/public/advanced-test.html` | НОВЫЙ — тестовая страница |
| `ARCHITECTURE.md` | Документация |
| `PROBLEMS.md` | Известные проблемы |
| `REFACTOR_PLAN.md` | НОВЫЙ — план рефакторинга (117 пунктов) |
