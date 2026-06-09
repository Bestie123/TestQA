---
title: MCP Tools
---

# MCP-инструменты для AI-ассистентов

> **Source:** `mcp.md`

Model Context Protocol (MCP) — протокол для подключения инструментов к AI-ассистентам. qtest-runner предоставляет **3 MCP-сервера** с **30 инструментами** для управления браузером, записью, тестами и отладкой SPA.

## Архитектура

```
AI Assistant (opencode)
  ├── mcp-browser (stdio) ──► Browser Agent (3005)
  ├── mcp-qtest-debug (stdio) ──► Recorder (3004)
  │                              └──► API Gateway (3000)
  └── mcp-chrome-devtools (stdio) ──► Chrome (CDP :9222)
```

## Конфигурация

MCP-серверы настроены в `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "mcp": {
    "browser": { "type": "local", "command": ["node", "packages/mcp-browser/dist/index.js"], "enabled": true },
    "qtest-debug": { "type": "local", "command": ["node", "packages/mcp-qtest-debug/dist/index.js"], "enabled": true },
    "chrome-devtools": { "type": "local", "command": ["node", "packages/mcp-chrome-devtools/dist/index.js"], "enabled": true }
  }
}
```

**Важно:** Dist-файлы должны быть собраны: `npm run build` (или `npx turbo run build`).
MCP-серверы запускаются **автоматически** opencode при старте чата. Не требуют launchpad.

---

## MCP Сервер 1: mcp-browser (12 инструментов)

Управление браузером через Playwright. Автоматически запускается opencode.

| Инструмент | Описание | Параметры |
|------------|----------|-----------|
| `browser_navigate` | Переход на URL | `url: string` |
| `browser_screenshot` | Скриншот страницы | — |
| `browser_click` | Клик по элементу | `selector: string` |
| `browser_type` | Ввод текста | `selector: string, text: string` |
| `browser_evaluate` | Выполнить JS | `code: string` |
| `browser_inspect` | Inspect DOM | `selector?: string` |
| `browser_start_recording` | Начать запись | `sessionId?: string` |
| `browser_stop_recording` | Остановить запись | `sessionId: string` |
| `browser_get_recorded_actions` | Получить действия | `sessionId, format` |
| `browser_press` | Нажатие клавиши | `key: string` |
| `browser_wait` | Ожидание | `ms: number` или `selector: string` |
| `browser_get_html` | Получить HTML | `selector?: string` |

---

## MCP Сервер 2: mcp-qtest-debug (10 инструментов)

Отладка, запись и управление тестами через API Gateway.

| Инструмент | Описание | Параметры |
|------------|----------|-----------|
| `qtest_health` | Проверка всех сервисов | — |
| `qtest_launch_browser` | Запуск браузера (без видео) | `profileName?: string, recordVideo?: boolean` |
| `qtest_record_start` | Старт записи | `name?: string, profileId?: string` |
| `qtest_record_stop` | Остановка записи | `sessionId: string` |
| `qtest_get_actions` | Получить действия | `sessionId, format` |
| `qtest_convert_steps` | Конвертация в шаги | `sessionId: string` |
| `qtest_execute_step` | Выполнить шаг | `action, selector?, value?, url?` |
| `qtest_check_db` | Просмотр БД | `limit?: number` |
| `qtest_test_course` | Интерактивный курс | `courseName, recordVideo?` |
| `qtest_test_course_verify` | Проверить курс | `sessionId, courseName` |

---

## MCP Сервер 3: mcp-chrome-devtools (8 инструментов) — NEW

Подключается к уже запущенному Chrome через Chrome DevTools Protocol (CDP).
Позволяет анализировать SPA-страницы (React/Angular), перехватывать сетевые запросы, выполнять JS в контексте страницы.

**Требование:** Chrome должен быть запущен с флагом `--remote-debugging-port=9222`

```bat
start-chrome-devtools.bat
```

Или вручную:
```
"C:\Program Files\Google\Chrome Dev\Application\chrome.exe" --remote-debugging-port=9222
```

| Инструмент | Описание | Параметры |
|-----------|----------|-----------|
| `cdp_navigate` | Переход по URL | `url: string` |
| `cdp_screenshot` | Скриншот страницы | — |
| `cdp_evaluate` | Выполнить JS | `code: string` |
| `cdp_get_html` | Получить HTML | `selector?: string` |
| `cdp_click` | Клик по элементу | `selector: string` |
| `cdp_get_text` | Получить текст | `selector?: string` |
| `cdp_list_tabs` | Список открытых вкладок | — |
| `cdp_get_api_calls` | Перехватить XHR/fetch | — |

### Сценарий: анализ SPA (например Zephyr Scale)

```
1. Запустить Chrome с remote debugging
2. Залогиниться в Jira вручную
3. Использовать MCP:
   cdp_navigate { "url": "https://jira.ifellow.ru/secure/Tests.jspa" }
   cdp_get_api_calls    # посмотреть какие API вызываются
   cdp_get_text         # прочитать содержимое страницы
   cdp_evaluate { "code": "JSON.stringify(window.__INITIAL_STATE__)" }
```

---

## Интеграция с AI-ассистентами

### OpenCode (рекомендуется)

OpenCode автоматически запускает MCP-серверы при старте чата.
Все 30 инструментов доступны сразу.

### Claude Desktop

```json
{
  "mcpServers": {
    "browser": { "command": "node", "args": ["path/to/mcp-browser/dist/index.js"] },
    "qtest-debug": { "command": "node", "args": ["path/to/mcp-qtest-debug/dist/index.js"] },
    "chrome-devtools": { "command": "node", "args": ["path/to/mcp-chrome-devtools/dist/index.js"] }
  }
}
```

### Другие MCP-клиенты

Любой MCP-клиент может подключиться через stdio:
```
node <путь-к-dist/index.js>
```

## Таймауты

Все HTTP-запросы MCP-инструментов имеют таймаут **15 секунд**.
Исключение: `qtest_health` — 5 секунд.

## Диагностика

### MCP не запускается
1. `npm run build` — собрать dist/
2. `~/.config/opencode/opencode.jsonc` — проверить пути
3. Перезапустить opencode
