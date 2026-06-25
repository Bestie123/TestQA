Index: qtest-runner/packages/mcp-supervisor/doc.md
===================================================================
# packages/mcp-supervisor/ — MCP Health Supervisor

> Doc-ID: MCP-SUPERVISOR-1 | Дата: 2026-06-07 | Связанные: [PLANNED-FEATURES-1], [STATUS-1]

## Назначение

Фоновый процесс (daemon) для мониторинга и автоматического восстановления MCP-серверов. Решает проблему постоянных падений MCP, когда AI теряет доступ к инструментам.

## Файлы

| Файл | Назначение |
|------|-----------|
| `src/index.ts` | Entry point, запуск Fastify сервера |
| `src/supervisor.ts` | Core логика: health check, restart, API routes |
| `src/config.ts` | Загрузка конфигурации из config.json |
| `src/logger.ts` | Логирование в файл + console |
| `src/types.ts` | TypeScript интерфейсы |
| `config.json` | Конфигурация серверов для мониторинга |
| `package.json` | Зависимости пакета |
| `tsconfig.json` | TypeScript конфигурация |

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Supervisor (port 3007)            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Health Check │  │   Restart   │  │   Logger    │     │
│  │ (10 sec)     │  │   Manager   │  │   & Alerts  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│  ┌──────▼──────────────▼────────────────▼──────┐       │
│  │              Process Registry                │       │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│       │
│  │  │chrome- │ │zephyr- │ │browser-│ │qtest-  ││       │
│  │  │devtools│ │scale   │ │devtools│ │debug   ││       │
│  │  └────────┘ └────────┘ └────────┘ └────────┘│       │
│  └─────────────────────────────────────────────┘       │
│         │                                               │
│  ┌──────▼──────────────────────────────────────┐       │
│  │           WebSocket /ws/mcp-status           │       │
│  │         (live updates для Web UI)            │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

## Форматы данных

### MCPStatusResponse (GET /api/mcp/status)

```json
{
  "servers": [
    {
      "name": "chrome-devtools",
      "status": "running",
      "pid": 12345,
      "uptime": 3600000,
      "restartCount": 2,
      "lastHealthCheck": "2026-06-07T10:30:00Z",
      "lastError": null,
      "tools": []
    }
  ],
  "summary": {
    "total": 6,
    "running": 4,
    "stopped": 0,
    "error": 2
  }
}
```

### ServerStatus (тип)

```typescript
type ServerStatus = 'running' | 'stopped' | 'error' | 'restarting';
```

### RestartRecord

```json
{
  "serverName": "chrome-devtools",
  "timestamp": "2026-06-07T10:25:00Z",
  "reason": "Process exited with code 1",
  "success": true,
  "attempt": 1
}
```

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/mcp/status` | Статус всех серверов |
| GET | `/api/mcp/status/:name` | Статус одного сервера + логи |
| POST | `/api/mcp/restart/:name` | Принудительный restart |
| POST | `/api/mcp/stop/:name` | Остановить сервер |
| GET | `/api/mcp/logs/:name` | Последние 100 строк логов |
| GET | `/api/mcp/history` | История restart'ов (50 записей) |
| WS | `/ws/mcp-status` | Live-обновления статуса |

## Конфигурация (config.json)

```json
{
  "checkIntervalMs": 10000,
  "maxRetries": 5,
  "baseDelayMs": 1000,
  "maxDelayMs": 30000,
  "logRetentionDays": 7,
  "alertOnFailure": true,
  "servers": [
    {
      "name": "chrome-devtools",
      "command": "node",
      "args": ["packages/mcp-chrome-devtools/dist/index.js"],
      "healthTool": "cdp_list_tabs",
      "timeoutMs": 5000
    }
  ]
}
```

## Restart Strategy

Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (максимум)

```
Попытка 1: задержка 1000ms
Попытка 2: задержка 2000ms
Попытка 3: задержка 4000ms
Попытка 4: задержка 8000ms
Попытка 5: задержка 16000ms
После 5 неудач: статус → error
```

## Проблемы

| # | Проблема | Причина | Решение |
|---|----------|---------|---------|
| 1 | MCP-серверы падают, AI теряет инструменты | Процесс завершается/зависает | Health check + auto-restart |
| 2 | Нет visibility в статус MCP | Нет UI/логирования | API + WebSocket + launchpad интеграция |

## Интеграция

### С launchpad.py

- Добавлен в `SERVICES` (порт 3007)
- Кнопка "🔄 MCP Status" в тулбаре
- Health tab показывает MCP-серверы
- `_show_mcp_status()` — диалог со статусом

### С start.bat

```batch
start "qtest-supervisor:3007" cmd /c "title qtest-supervisor:3007 && cd /d %~dp0packages\mcp-supervisor && node dist\index.js"
```

### С Web UI (планируется)

- `McpStatusPage.tsx` — dashboard с таблицей серверов
- WebSocket `/ws/mcp-status` для live-обновлений

## Сборка

```powershell
cd packages/mcp-supervisor
npm install
npm run build    # tsc → dist/
npm run dev      # tsx dev mode
```

## Запуск

```powershell
# Через start.bat (автоматически)
start.bat

# Или вручную
cd packages/mcp-supervisor
node dist/index.js

# Проверка API
curl http://localhost:3007/api/mcp/status
```

## Логи

Логи пишутся в `logs/mcp-supervisor.log`:

```
[2026-06-07T14:35:30.959Z] [INFO] 🚀 MCP Health Supervisor starting...
[2026-06-07T14:35:31.057Z] [INFO] ✅ chrome-devtools started (PID: 3116)
[2026-06-07T14:35:34.135Z] [INFO] 📡 HTTP server listening on port 3007
[2026-06-07T14:35:34.154Z] [WARN] ⚠️ chrome-devtools exited: exit code 1
[2026-06-07T14:35:34.160Z] [INFO] 🔄 Restart attempt 1/5 for chrome-devtools (delay: 1000ms)
```

## Связи

- **Зависит от:** Нет (автономный процесс)
- **Используется:** launchpad.py, start.bat, (планируется) Web UI
- **Мониторит:** chrome-devtools, zephyr-scale, browser-devtools, regression-test, opencode-db, qtest-debug
