# Session Context — qtest-runner (сохранено 01.06.2026)

> **Для нового AI-чата:** прочитай этот файл первым. Он содержит полный снимок состояния проекта.

## Что это за проект

qtest-runner — инструмент для записи браузерных тестов и генерации тест-кейсов Zephyr Scale. Записывает реальные действия пользователя в браузере, конвертирует в структурированные шаги на русском языке.

## Архитектура (9 пакетов, monorepo)

```
Web UI (8080) → API Gateway (3000) → Execution (3003) → Browser Agent (3005)
                                    → Recorder (3004)  → SQLite
                                    → Testcase (3001)  → SQLite
                                    → Step Library (3002) → SQLite
```

| Пакет | Порт | БД | Назначение |
|-------|------|----|------------|
| api-gateway | 3000 | — | BFF, маршрутизация |
| testcase-service | 3001 | testcases.db | CRUD, импорт Excel |
| step-library-service | 3002 | steplibrary.db | Переиспользуемые шаги |
| execution-service | 3003 | executions.db | Оркестрация шагов |
| recorder-service | 3004 | recordings.db | Запись действий, convertToSteps |
| browser-agent | 3005 | — | CDP, Playwright, inject-скрипты |
| web-ui | 8080 | — | React SPA (Vite) |
| chrome-extension | — | — | Manifest V3 |
| shared-types | — | — | TypeScript интерфейсы |

### Дополнительные серверы
| Сервис | Порт | Назначение |
|--------|------|------------|
| VitePress docs | 5173 | Документация (18 страниц) |
| stub-site | 3006 | Тестовая страница (advanced-test.html, captcha-test.html) |
| stub-site (cross-origin) | 9091 | Cross-origin iframe тесты |

## Текущий статус

- **205 unit-тестов** (59 action-parser + 19 ws-server + 51 executor + 76 convertToSteps)
- **ESLint: 0 ошибок**, 245 предупреждений (все `no-explicit-any`)
- **9 пакетов** собираются без ошибок
- **VitePress docs** — 18 страниц документации
- **Settings page** — 69 toggle'ов action types + drag-режим
- **MCP** — 2 сервера, 22 инструмента

## Action Types (77 уникальных)

Полная матрица: `qtest-runner/docs/action-types.md`

### Записываются (68 уникальных)
- Навигация: navigate, page_load, switchTab, listTabs
- Клики: click, dblclick, contextmenu, canvas_click, hover, focus
- Ввод: fill, select, check, keypress, ime_composition
- Drag: dragstart, dragend, drop, drag
- Формы: submit, file_upload
- Проверки: assertText, assertVisible, assertValue, assertChecked, assertUrl, waitForSelector, wait, verify
- Скриншоты: screenshot
- Клавиатура: clipboard, selection
- Прокрутка: scroll, wheel, resize
- Touch: touchstart, touchend, touchmove
- Медиа: media_play, media_pause, media_seeked, media_volume
- CSS: transition_start, transition_end, animation_start, animation_end
- Жизненный цикл: visibility_change, page_hide, page_show
- UI: dialog, dialog_element, details_toggle, popover_toggle
- DOM: element_appear, element_remove, attr_change, text_change, element_resize, element_intersect
- Сеть: request, response, request_failed
- Ошибки: js_error, unhandled_rejection, console
- Окружение: cookie_consent, jira_env, captcha_detected, user_switch

### Алиасы (не нужны toggle)
input→fill, dragTo→drag, setInputFiles→fileUpload, rightClick→contextmenu, press→keypress, switch_user→user_switch, touch→touchstart

## MCP-инструменты (22 инструмента)

Полная документация: `qtest-runner/docs/mcp.md`

### mcp-browser (12 инструментов)
browser_navigate, browser_click, browser_type, browser_press, browser_wait, browser_screenshot, browser_inspect, browser_get_html, browser_evaluate, browser_inject_and_inspect, browser_start_recording, browser_stop_recording, browser_get_recorded_actions

### mcp-qtest-debug (10 инструментов)
qtest_health, qtest_launch_browser, qtest_record_start, qtest_record_stop, qtest_get_actions, qtest_convert_steps, qtest_execute_step, qtest_check_db, qtest_test_course, qtest_test_course_verify

### Конфигурация
`~/.config/opencode/opencode.jsonc` — MCP-серверы запускаются opencode автоматически.

## API Endpoints

### Recorder Service (3004)
- `GET /health` — проверка здоровья
- `GET/POST /api/recordings` — список/создание сессий
- `POST /api/recordings/start` — старт записи
- `POST /api/recordings/:id/stop` — остановка
- `POST /api/recordings/:id/actions` — добавление действий
- `POST /api/recordings/:id/convert` — конвертация в шаги
- `GET/POST /api/composite-steps` — составные шаги
- `GET/PUT /api/user-switch/config` — настройки переключения
- `GET/PUT /api/settings` — настройки приложения (key-value)

### API Gateway (3000)
Все префиксы проксируются на соответствующие сервисы. Маршруты:
`/api/testcases`, `/api/folders`, `/api/import`, `/api/zephyr`, `/api/diff`, `/api/coverage`,
`/api/steps`, `/api/categories`, `/api/composite-steps`,
`/api/executions`, `/api/reports`,
`/api/recordings`, `/api/user-switch`, `/api/settings`,
`/api/record`, `/api/launch`, `/api/profiles`, `/api/agent`

## Web UI

### Страницы (7)
- QTest Runner — список тест-кейсов
- Импорт — импорт Excel/Zephyr
- Recorder — запись действий
- Sync — синхронизация с Zephyr
- Отчёты — статистика
- Настройки — 69 toggle'ов + drag-режим
- Docs — iframe с VitePress (localhost:5173)

### Темы (7)
light, dark, opencode, green, purple, ocean, sunset — сохраняются в localStorage

## Документация (VitePress, 18 страниц)

| Страница | Содержание |
|----------|-----------|
| index | Обзор проекта, архитектура |
| architecture | Микросервисы, порты, стек |
| usage | Запуск, импорт Excel, запись |
| flow | Полный пайплайн выполнения |
| action-types | Матрица 77 action types |
| mcp | MCP-инструменты (22), конфигурация, примеры |
| assertions | 5 типов проверок |
| composite-steps | Переиспользуемые шаги |
| web-ui | Темы (7), настройки, Docs iframe |
| testing | Тестирование на реальных сайтах |
| problems | Известные проблемы |
| status | Прогресс, завершённые итерации |
| loop-rules | Правила анти-циклов |
| changelog | История изменений |
| archive/* | refactor-plan, gap-analysis, expanded-plan, playwright-vs-qtestrunner, chat-history |

## Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `TestQA/README.md` | Главный вход для AI |
| `TestQA/ACTIVE_GOAL.md` | Текущее состояние сессии |
| `TestQA/SESSION_CONTEXT.md` | Этот файл |
| `qtest-runner/docs/` | VitePress документация (18 страниц) |
| `qtest-runner/docs/mcp.md` | MCP-инструменты для AI |
| `qtest-runner/docs/action-types.md` | Матрица 77 action types |
| `qtest-runner/eslint.config.mjs` | ESLint flat config |
| `qtest-runner/.prettierrc` | Prettier конфиг |
| `qtest-runner/.github/workflows/ci.yml` | CI/CD (lint, test, build, docs) |
| `qtest-runner/start.bat` | Запуск всех сервисов (8 сервисов) |
| `qtest-runner/packages/stub-site/` | Тестовая страница (3006/9091) |
| `opencode-manager/run.py` | Запуск opencode-manager (Python GUI) |

## Правила кода

1. **SQLite:** одинарные кавычки для строк, двойные для колонок. better-sqlite3 v11.
2. **Fastify v5:** объекты в ответах, не голые массивы.
3. **Chrome Extension:** `composedPath()` для Shadow DOM.
4. **Graceful shutdown:** SIGINT/SIGTERM/SIGBREAK на всех 6 сервисах.
5. **Mock:** `vi.hoisted()` + `vi.mock()` для тестов. In-memory SQLite.
6. **ESLint:** flat config, `no-empty` отключён для inject-скриптов.
7. **Settings:** key-value `app_settings` в `recordings.db`.

## Порядок чтения для нового чата

1. `TestQA/SESSION_CONTEXT.md` (этот файл)
2. `TestQA/README.md`
3. `TestQA/ACTIVE_GOAL.md`
4. `qtest-runner/docs/architecture.md`
5. `qtest-runner/docs/status.md`

## Быстрый старт

### 1. Установка зависимостей (однократно)
```powershell
cd Q:\User_Data\Desktop\TestQA\qtest-runner
npm install
```

### 2. Запуск всех сервисов (start.bat)
```cmd
cd Q:\User_Data\Desktop\TestQA\qtest-runner
start.bat
```
start.bat делает всё автоматически:
1. Убивает старые процессы на портах 3000-3005, 8080, 5173
2. Проверяет сборку (если нет dist — собирает)
3. Запускает 8 сервисов в отдельных окнах CMD
4. Ждёт нажатия любой клавиши для остановки всех сервисов

**После запуска:**
- Web UI: http://localhost:8080
- Документация: http://localhost:5173
- API Gateway: http://localhost:3000

### 3. Пошаговый запуск (PowerShell)
```powershell
cd Q:\User_Data\Desktop\TestQA\qtest-runner

# === СБОРКА ===
npx turbo run build

# === БЭКЕНД (6 сервисов) ===
Start-Process -WorkingDirectory "$pwd\packages\testcase-service" -FilePath "node" -ArgumentList "dist/index.js"
Start-Process -WorkingDirectory "$pwd\packages\step-library-service" -FilePath "node" -ArgumentList "dist/index.js"
Start-Process -WorkingDirectory "$pwd\packages\execution-service" -FilePath "node" -ArgumentList "dist/index.js"
Start-Process -WorkingDirectory "$pwd\packages\recorder-service" -FilePath "node" -ArgumentList "dist/index.js"
Start-Process -WorkingDirectory "$pwd\packages\browser-agent" -FilePath "node" -ArgumentList "dist/index.js"
Start-Process -WorkingDirectory "$pwd\packages\api-gateway" -FilePath "node" -ArgumentList "dist/index.js"

# === ФРОНТЕНД (React Vite dev-сервер) ===
Start-Process -WorkingDirectory "$pwd\packages\web-ui" -FilePath "npx.cmd" -ArgumentList "vite --port 8080 --host"

# === ДОКУМЕНТАЦИЯ (VitePress dev-сервер) ===
Start-Process -WorkingDirectory "$pwd" -FilePath "npx.cmd" -ArgumentList "vitepress dev docs --port 5173 --host"

# === ТЕСТОВАЯ СТРАНИЦА (для ручного тестирования записи) ===
Start-Process -WorkingDirectory "$pwd\packages\stub-site" -FilePath "node" -ArgumentList "server.js"
```

### 4. Запуск opencode-manager (Python GUI)
```powershell
cd Q:\User_Data\Desktop\opencode-manager
py -3 run.py
```
- Tkinter GUI для управления сессиями opencode
- Экспорт сессий в JSON (через SQLite, не через CLI)
- Импорт сессий с автоматическим бэкапом БД
- Очистка reasoning, удаление сообщений

### 5. Запуск MCP-серверов (автоматически)
MCP-серверы запускаются opencode автоматически при старте:
- `~/.config/opencode/opencode.jsonc` — конфигурация
- Требуют `dist/index.js` (сборка обязательна)
- Порты: browser (3005), qtest-debug (3004)

### 6. Проверка что всё работает
```powershell
# Проверить все порты
netstat -aon | findstr "LISTENING" | findstr ":3000 :3001 :3002 :3003 :3004 :3005 :3006 :8080 :5173"

# Проверить health-endpoints
curl http://localhost:3000/health          # API Gateway
curl http://localhost:3001/health          # Testcase Service
curl http://localhost:3004/health          # Recorder Service
curl http://localhost:3005/health          # Browser Agent

# Открыть в браузере
start http://localhost:8080                # Web UI
start http://localhost:5173                # Docs
start http://localhost:3006/advanced-test.html  # Тестовая страница
```

### 7. Остановка сервисов
```powershell
# Через taskkill по заголовкам окон
taskkill /fi "windowtitle eq qtest-*" /f

# Или по портам
netstat -aon | findstr ":3000 :3001 :3002 :3003 :3004 :3005 :8080 :5173"
# Найти PID и убить
taskkill /pid <PID> /f
```

### Таблица сервисов

| Сервис | Порт | БД | Запуск | Назначение |
|--------|------|----|--------|------------|
| api-gateway | 3000 | — | `node packages/api-gateway/dist/index.js` | BFF, маршрутизация |
| testcase-service | 3001 | testcases.db | `node packages/testcase-service/dist/index.js` | CRUD тест-кейсов |
| step-library-service | 3002 | steplibrary.db | `node packages/step-library-service/dist/index.js` | Переиспользуемые шаги |
| execution-service | 3003 | executions.db | `node packages/execution-service/dist/index.js` | Оркестрация шагов |
| recorder-service | 3004 | recordings.db | `node packages/recorder-service/dist/index.js` | Запись действий, convertToSteps |
| browser-agent | 3005 | — | `node packages/browser-agent/dist/index.js` | CDP, Playwright, inject-скрипты |
| Web UI | 8080 | — | `npx vite --port 8080 --host` (в packages/web-ui) | React SPA |
| VitePress docs | 5173 | — | `npx vitepress dev docs --port 5173 --host` | Документация (18 страниц) |
| stub-site | 3006 | — | `node packages/stub-site/server.js` | Тестовая страница для записи |
| stub-site (cross-origin) | 9091 | — | `node packages/stub-site/server.js` (второй инстанс) | Cross-origin iframe тесты |

> **Важно:** Запускать из корня `qtest-runner` (`cd Q:\User_Data\Desktop\TestQA\qtest-runner`).
> **Порты:** Web UI — 8080, Docs — 5173, stub-site — 3006/9091, Services — 3000-3005
> **MCP-серверы** (browser, qtest-debug) запускаются opencode автоматически из `opencode.jsonc`. Требуют `dist/index.js` (сборка обязательна).

## Известные проблемы

- Browser-agent (3005) и VitePress (5173) иногда падают — нужен ручной рестарт
- MCP-серверы (browser, qtest-debug) запускаются opencode автоматически, требуют `dist/index.js`
- opencode GUI (SolidJS) — баг `Cannot read properties of undefined (reading 'context')` в ProgressCircle (фикс в следующей версии opencode)
- opencode-manager export/import — работает через SQLite (не через CLI, т.к. команды `export`/`import` не существуют в opencode)
- stub-site (3006) нужно запускать отдельно: `node packages/stub-site/server.js`
