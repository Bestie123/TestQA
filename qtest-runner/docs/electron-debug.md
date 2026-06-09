# Отладка Electron Desktop через MCP

> Doc-ID: ELECTRON-DEBUG-1 | Дата: 2026-06-05 | Связанные: [MCP-1], [ARCHITECTURE-1]

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                   opencode CLI (нейросеть)                   │
│  Вызывает MCP инструменты → анализирует результат →        │
│  → принимает решение → повторяет                           │
└──────────┬──────────────────────────────────────┬──────────┘
           │ stdin/stdout                          │
           ▼                                       ▼
┌─────────────────────┐              ┌──────────────────────────┐
│  mcp-electron-diag  │              │  mcp-electron-session    │
│  (stateless, 11ツ)   │              │  (stateful, 16ツ)        │
│                     │              │                          │
│  Каждый вызов =     │              │  Одна WS на сессию       │
│  новое WS           │              │  + Action Replay         │
│                     │              │  + Event Stream          │
└──────────┬──────────┘              └───────────┬──────────────┘
           │ WebSocket CDP                       │
           ▼                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Electron Desktop App                       │
│  packages/desktop → electron-vite dev → BrowserWindow       │
│  --remote-debugging-port=9322                               │
└─────────────────────────────────────────────────────────────┘
```

## Три MCP сервера

| Сервер | Пакет | Инструментов | Тип |
|--------|-------|-------------|-----|
| `tool-panel-test` | `mcp-tool-panel` | 7 | Чтение `~/.kiro/` напрямую |
| `electron-diag` | `mcp-electron-diagnostics` | 11 | Stateless CDP |
| `electron-session` | `mcp-electron-session` | 16 | **Stateful CDP** |

## mcp-electron-session (рекомендуемый)

Сохраняет WebSocket-соединение между вызовами. В 5-10x быстрее stateless версии.

### Инструменты

#### Подключение
| Инструмент | Описание |
|-----------|----------|
| `electron_connect` | Подключиться к CDP, открыть WS |
| `electron_disconnect` | Закрыть WS, очистить состояние |
| `electron_status` | Статус сессии (страница, listeners, recording) |

#### Базовые операции (через одно WS)
| Инструмент | Описание |
|-----------|----------|
| `electron_evaluate` | Выполнить JS |
| `electron_screenshot` | Скриншот (base64 PNG) |
| `electron_get_dom` | DOM страницы или по селектору |
| `electron_click` | Клик по селектору |
| `electron_get_text` | Текст элемента |
| `electron_count_elements` | Подсчёт по селектору |
| `electron_wait_for` | Ждать условие |

#### Action Replay
| Инструмент | Описание |
|-----------|----------|
| `electron_replay` | Выполнить JSON-сценарий |
| `electron_replay_start` | Начать запись действий |
| `electron_replay_stop` | Остановить, вернуть сценарий |
| `electron_replay_assert` | Проверить условие |

#### Event Stream
| Инструмент | Описание |
|-----------|----------|
| `electron_listen` | Подписаться на события (console/network/dom/error) |
| `electron_listen_network` | Быстрый захват сети |
| `electron_listen_console` | Быстрый захват console.log |

### Формат сценария Replay

```json
{
  "name": "Проверка tool-panel",
  "stopOnFailure": true,
  "steps": [
    {"action": "wait", "ms": 1000},
    {"action": "evaluate", "expression": "window.api.toolPanel.specs.list()", "store": "specs"},
    {"action": "assert", "expression": "store.specs.length >= 3", "message": "≥3 specs"},
    {"action": "click", "selector": "[data-tp*='SteeringTab']"},
    {"action": "wait", "ms": 500},
    {"action": "screenshot", "name": "steering-tab"},
    {"action": "get_text", "selector": ".steering-list", "store": "steeringText"},
    {"action": "assert_text", "selector": "body", "contains": "api-standards"}
  ]
}
```

Поддерживаемые actions: `wait`, `evaluate`, `assert`, `assert_text`, `click`, `type`, `screenshot`, `get_text`, `navigate`.

Переменные: `store.varName` доступны в `assert` выражениях.

### Event Stream

```json
// Консоль
{"types": ["console"], "durationMs": 5000}

// Сеть  
{"types": ["network"], "durationMs": 3000}

// Всё вместе
{"types": ["all"], "durationMs": 2000}
```

## Запуск

```powershell
# 1. Убить старые процессы
Get-Process -Name "electron","OpenCode*" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Очистить кэш
cd packages\desktop
rm -r -force out\renderer

# 3. Запустить с CDP
npx electron-vite dev -- --remote-debugging-port=9322

# 4. В другом окне — использовать MCP
# Через stdio:
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"electron_connect","arguments":{}}}' | bun run packages/mcp-electron-session/src/index.ts
```

## Интеграция с открытым кодом

Все 3 MCP сервера зарегистрированы в `opencode.json` и доступны как tools:

```json
{
  "mcp": {
    "tool-panel-test": { "type": "local", "command": ["bun", "run", "packages/mcp-tool-panel/src/index.ts"] },
    "electron-diag": { "type": "local", "command": ["bun", "run", "packages/mcp-electron-diagnostics/src/index.ts"] },
    "electron-session": { "type": "local", "command": ["bun", "run", "packages/mcp-electron-session/src/index.ts"] }
  }
}
```

## Связанные документы

- [Архитектура QTest Runner](ARCHITECTURE.md) — общая архитектура микросервисов
- [MCP серверы](mcp.md) — документация всех MCP серверов
- [ELECTRON_DEV_AUTOPILOT.md] — полный playbook для нейросети
