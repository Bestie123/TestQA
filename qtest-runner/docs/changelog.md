---
title: Changelog
source: changelog.md
---

# Changelog

> **Source:** `changelog.md`

All notable changes to qtest-runner.

## 2026-06-05 — Fix: POST→GET endpoints, projectKey filter, sync completion

- **Bugfix: projectKey filter broken** — `GET /api/local/testcases?projectKey=IBPA` использовал `project_id = 'IBPA'` (сравнение с числовым ID проекта '10904'). Исправлено: `key LIKE 'IBPA-%'` — корректно возвращает 6022 TC проекта IBPA
- **Bugfix: POST endpoints reject requests without body** — Fastify v4 требует body для POST-запросов. Пустой POST возвращал 400/415. Исправлено: 6 эндпоинтов без body конвертированы в GET:
  - `/api/zephyr/sync`, `/api/zephyr/test-connection`, `/api/zephyr/cache/clear`
  - `/api/local/sync/testcases`, `/api/local/sync/testruns`, `/api/local/sync/testplans`
- **UI SyncPage**: обновлены вызовы `fetch(..., { method: 'POST' })` → `{ method: 'GET' }`
- **Sync completion**: первый полный sync 7405 TC завершён за 408 сек (6.8 мин). Локальная БД: 6022 IBPA + 724 GMSOL = 6746 TC
- **Итого:** 289 тестов (8/8 файлов), 9/9 пакетов

## 2026-06-04 — Fix: полная загрузка данных + UI сравнение с реальным Zephyr

- **Критический баг: queryZephyrTestCases** — Zephyr API возвращает макс. 100 элементов на страницу (независимо от `maxResults`). Цикл пагинации останавливался после 1 страницы из-за проверки `items.length < pageSize` (100 < 200). Исправлено: `pageSize=100`, проверка `startAt >= totalFromApi`. Результат: 100-300 TC → **7404 TC** (все)
- **Критический баг: fetchTestRuns** — `encodeURIComponent` превращал `+` (пробел) в `%2B`, API v1.0 возвращал 400 Bad Request. Исправлено: `.replace(/%20/g, '+')`. Результат: ошибка 500 → **1581 прогон** (все)
- **API timeout**: увеличен до 120000ms (2 мин) для paginated запросов к Zephyr API
- **UI сравнение с реальным Zephyr** через Chrome DevTools (CDP):
  - Корневой счётчик: "Все тест кейсы(6021)" / "Все тестовые прогоны(1581)" — без пробела перед скобкой
  - Тулбары: "Новый тест кейс", "New Test Cycle", "Новый план тестирования" — как в реальном Zephyr
  - Пагинация: формат "1 - 100из 6021"
  - Поиск: placeholder "Поиск"
- **Regression-test MCP**: добавлены инструменты `get_chrome_status`, `test_filter_panel`
- **SettingsPage**: кнопка "Проверить подключение" для каждого профиля Jira/Zephyr
- **SyncPage**: кнопки 🔄 для папок, прогонов и тест-кейсов
- **Import date**: поле `import_date` в `test_cases` (ISO timestamp, точность до секунд)
- **Ленивая загрузка по умолчанию:** Zephyr API: 100 items = 10-13 сек. Загрузка всех 7404 TC = 16 минут. Решение: загружаем только первую страницу (100 TC) по умолчанию, как реальный Zephyr. Кнопка "Загрузить все" для полной загрузки.
- **Итого:** 289 тестов (8/8 файлов), 9/9 пакетов

## 2026-06-03 — Fix: Zephyr-style filters, folder tree visibility, credentials dedup

- **Zephyr-style filter panel**: переделан на "Добавить критерий" (Статус/Приоритет/Автор выбираются по одному, как в реальном Zephyr)
- **Дерево папок**: теперь видно на всех вкладках (а не только в Тест кейсы), как в реальном Zephyr
- **Credentials**: убрано дублирование из вкладки Конфигурация SyncPage (теперь только в SettingsPage)
- **Правило opencode**: добавлено в CONTEXT_RULES.md обязательное требование проверять реальный Zephyr перед любыми UI-изменениями + Zephyr UI Conventions

## 2026-06-03 — E2E publish + Test Cycles Detail + TC Detail tabs

- **E2E Recorder → Zephyr:** `createZephyrTestCase()` в zephyr-client.ts; `POST /api/zephyr/publish` с fallback-стратегией; кнопка "Опубликовать в Zephyr" на RecorderPage
- **Test Cycles detail view:** click-through cycle rows → inline test case execution results (PASS/FAIL/SKIPPED/BLOCKED badges); бэкенд `GET /api/zephyr/testruns/:key/testcases`
- **Test Cycles filter panel:** Status filter для cycles tab (авто-сбор статусов из загруженных прогонов)
- **TC Detail tabs:** 3 таба (Подробнее/Шаги/Выполнение) в Zephyr-стиле; lazy-loaded execution history из execution-service
- **Publish refactoring:** `saveTestCaseLocally()` helper в importer.ts; inline SQL заменён
- **Анализ TC Detail через браузер:** Steps (3 колонки через Froala), Execution (13 колонок), History (version timeline) — задокументировано в zephyr-ui-analysis.md
- **Прочее:** server-side pagination, status colors, projectId в URL, React.Fragment fix
- **Итого:** 10 коммитов, 289 тестов (8/8 файлов), 9/9 пакетов

## 2026-06-03 — Багфикс-сессия: все 19+ багов исправлены

- **Bug #13:** SyncPage — удалён дублирующийся `<select>` папок из filter panel
- **Bug #15:** Docs iframe — `import.meta.env.VITE_DOCS_URL` с fallback 5174
- **Bug #8:** RecorderPage — try/catch на все 4 async-обработчика
- **Bug #9:** ReportsPage — добавлен `error` state
- **SettingsPage:** секция credentials — GET/PUT `/api/credentials` + UI с профилями
- **Nav «Выполнения»:** исправлен `setPage('list')` → `setPage('execution')`, добавлен empty state
- **Статусы в фильтрах:** добавлен `STATUS_DISPLAY` маппинг (Approved→Утверждено, Draft→Черновик, Deprecated/Устарел→Устаревший)
- **docs:** файлы переименованы в lowercase (ARСHITECTURE.md→architecture.md и т.д.)
- **Итого:** 24 бага исправлено, 289 тестов (8/8 файлов)

- **Пагинация TC:** `maxPages=50` (до 10000 TC), снят лимит 500
- **Прогоны (Test Runs):** статус прогона, кол-во TC, Pass/Fail, даты
- **Тесты zephyr-client:** 10 новых тестов (buildFolderPath, ZephyrConfig, credentials)
- **Кнопка «Открыть в Jira»:** ссылка на `browse/{key}` для каждого TC в SyncPage
- **Итого:** 289 тестов (8/8 файлов)
- **chrome-devtools MCP:** установлен, работает через корневой node_modules
- **ACTIVE_GOAL.md:** контекст сессии сохранён для следующей сессии

## 2026-06-02 — Chrome DevTools MCP + docs overhaul

- **Новый MCP сервер:** `mcp-chrome-devtools` (8 инструментов, CDP-подключение к Chrome)
- **start-chrome-devtools.bat** — лаунчер Chrome с remote debugging
- **docs/mcp.md** — переписан: 3 сервера, 30 инструментов, архитектура, примеры
- **docs/architecture.md** — обновлён: +mcp-chrome-devtools
- **opencode.jsonc** — зарегистрирован chrome-devtools MCP
- **mcp-browser и mcp-qtest-debug** — оба присутствуют, не удалены

## 2026-06-02 — Zephyr Scale API найден: работающий REST endpoint

- **Найден правильный REST API:** `GET /rest/tests/latest/testcase/search?projectKey=IBPA` → **200** (не 500, не 302)
- **Проблема решена:** старый endpoint `/rest/zephyr/latest/` возвращал 302, `/rest/tests/latest/testcase` возвращал 500
- **Пагинация:** 100 TC за раз, автоматический перебор всех страниц (~7331 TC в IBPA)
- **Данные:** key, name, status, precondition, steps, folder, priority, coverageIssues
- **`POST /api/zephyr/sync`** — реально импортирует TC из Jira в локальную БД
- **docs:** обновлён jira-authentication.md с примером ответа API

## 2026-06-02 — Multi-profile credentials + Jira prod

- **~/.qtest/credentials.json** — поддержка нескольких профилей (dev + prod) с разными хостами/токенами
- **zephyr-client:** `loadCredentials()` читает профиль `zephyr` (production Jira)
- **zephyr-client:** переведён с `http` на `fetch` для HTTPS-запросов к Jira
- **docs/reference/jira-authentication.md:** обновлён под dual-Jira (devjira + jira)

## 2026-06-02 — Phase 6: Minor fixes + Web UI improvements

- **Drag dupes fixed:** удалены дублирующиеся switch-case блоки dragstart/dragend/drop в `convertToSteps()`
- **Selection conversion added:** новая обработка `actionType: 'selection'` в `convertToSteps()` (выводит «Выделить текст ... [длина=N]»)
- **Все 279 тестов проходят** (7/7 файлов, 0 failures)
- **Web UI:** health dot indicator в навбаре, ссылка «Выполнения», `testZephyrConnection()` и `fetchHealth()` в `api.ts`
- **zephyr-client:** `testConnection()` через `/rest/api/latest/serverInfo` (требует `fetch` вместо `http` для HTTPS)

## 2026-06-02 — Phase 5: Documentation VitePress

- **74 новых теста:** api-gateway (35 routing), step-library-service (27 CRUD), execution-service (12 DB)
- **tsconfig:** добавлен `exclude: ["src/__tests__"]` в 3 пакета
- **Итого:** 279 тестов (6/7 файлов проходят)
- **Новые правила CONTEXT_RULES.md:** Architecture Documentation — документировать при каждом изменении кода; фиксировать структуру в `docs/reference/`; обновлять VitePress сайт (npm run docs:build)

## 2026-06-02 — Phase 3: API Gateway missing routes

- **Phase 3 завершена:** добавлены 4 недостающих маршрута в API Gateway: `/api/execute-step`, `/api/videos`, `/api/video/*`, `/api/debug/*` → browser-agent; `/api/composite-categories` → step-library-service
- **docs/api-reference.md полностью обновлён** — все 23 маршрута API Gateway сгруппированы по сервисам
- **docs/reference/jira-authentication.md** — добавлена карта структуры Jira (верхнее меню, профиль, плагины, группы, REST API)

## 2026-06-02 — Phase 1 & 2: Config Loader + Zephyr Sync

- **Phase 1 (Config Loader):** `zephyr-client.ts` — `loadCredentials()` читает `~/.qtest/credentials.json` (приоритет: файл → env vars → defaults)
- **Phase 2 (Zephyr Sync):** `syncFromZephyr()` — реальный импорт TC через `importTestCases()`, добавлен `testConnection()`, эндпоинт `POST /api/zephyr/test-connection`
- **Документация:** `docs/reference/jira-authentication.md` (Doc-ID: JIRA-AUTH-1)

## 2026-06-02 — Phase 0: Jira Research + PAT + Config

- **Phase 0 завершена:** исследован `devjira.ifellow.ru` — Jira Server 8.20.13
- **PAT (Personal Access Token)** — создан и сохранён в `~/.qtest/credentials.json`
- **Документация:** создан `docs/reference/jira-authentication.md` (Doc-ID: JIRA-AUTH-1)
- **Продолжение:** Phase 1 — Config Loader, Phase 2 — Zephyr Sync API

- **recordVideo опционален:** `launchSession()` принимает `{ recordVideo }` (по умолч. `true`). Параметр проброшен в `POST /api/launch`, WebSocket `launch`, `qtest_launch_browser`, `qtest_test_course`
- **Таймауты MCP:** во все fetch-вызовы `mcp-browser` (6 шт.) и `mcp-qtest-debug` (httpGet/httpPost) добавлен `AbortSignal.timeout(15000)`. Ранее без таймаута — зависший сервис блокировал AI-ассистента
- **Launchpad:** `_check_ports` вынесен в поток (блокировал UI до 9s каждые 5s), логи батчатся по 20 строк, `_stop_all`/`_restart_all` в потоках

## 2026-05-30 — Iteration 5b: convertToSteps Unit Tests

- **Added** 76 unit tests for `convertToSteps()` in recorder-service (`db.ts`)
- **Added** `"exclude": ["src/__tests__"]` to recorder-service `tsconfig.json`
- **Total** 205 unit tests (59 action-parser + 19 ws-server + 51 executor + 76 convertToSteps)

## 2026-05-30 — Iteration 5a: executor + ws-server Tests

- **Added** 51 unit tests for `executor.ts` (all action types, error handling, frame resolution)
- **Added** 19 unit tests for `ws-server.ts` (HTTP endpoints, WebSocket routing)
- **Fixed** ws-server exported `httpServer`, `handleMessage`, `clients` for testability
- **Fixed** browser-agent tsconfig: added `"exclude": ["src/__tests__"]`
- **Fixed** 5 action-parser bugs:
  - English "right click" pattern added to rightClick regex
  - English "navigate to / go to" + Russian "страницу / страница" added to URL regex
  - English "switch tab / select tab / change tab" — fixed regex order (was matched as listTabs)
  - Russian "открыть страницу URL" — extended URL regex
  - assertText regex ordering — "проверить что" moved to first alternation position
- **Total** 129 unit tests (59 + 19 + 51)

## 2026-05-30 — File Reorganization

- `Test-cases&Bug-reports/` moved out of TestQA to `Desktop/`
- `zephyr-sort-extension/` moved out of TestQA to `Desktop/`
- `docs/` structure created at TestQA root: `rules/`, `testcases/`, `reports/`, `archive/`
- `.md` files from qtest-runner root moved to `qtest-runner/docs/`
- Loose files (.xlsx → testcases/, .docx → reports/, plan files → archive/)
- Garbled/temp files moved to `Test-cases&Bug-reports/`

## 2026-05-30 — Critical Fixes

- **ImportPage.tsx**: Client-side Excel parsing via SheetJS (`xlsx`) instead of broken server upload
- **SyncPage.tsx**: Client-side Excel parsing + diff display
- **Step Library Service**: Seed parameter `project` → `projectUrl`
- **Chrome Extension**: Shadow DOM support via `composedPath()`, `getSelector()` shadow-aware
- **Chrome Extension manifest**: Icon paths fixed to `icons/icon16.png`
- **Graceful shutdown**: SIGINT/SIGTERM/SIGBREAK on all 6 services (5s force timeout)
- **Cross-origin iframe test server**: Port 9091

## 2026-05-28 — Iterations 0-6 Complete

- **Iteration 0**: AGENTS.md restructured, project map
- **Iteration 1**: ImportPage + SyncPage Excel fixes, seed data, CAPTCHA test pages
- **Iteration 2**: Chrome Extension Shadow DOM, composedPath, icons
- **Iteration 3**: Graceful shutdown for all 6 services
- **Iteration 4**: Cross-origin iframe test server
- **Iteration 5**: Vitest setup, 59 action-parser tests
- **Iteration 6**: E2E Interactive Course MCP tools

## 2026-05-27 — Project Initialization

- 8 microservices created
- INJECT_SCRIPT recording system
- MCP tools for browser debugging
- Core recording pipeline: inject → store → convert → execute
