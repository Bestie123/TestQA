# packages/browser-agent/ — Browser Agent (CDP, Recorder, Executor)

> Doc-ID: BROWSER-AGENT-1 | Дата: 2026-06-09 | Связанные: [REC-SHARED-1], [MCP-BROWSER-1]

## Файлы

| Файл | Назначение |
|------|-----------|
| `src/recorder.ts` | Запись действий: INJECT_SCRIPT injection, page.on listeners, flush в recorder-service |
| `src/executor.ts` | Исполнение шагов: navigate, click, fill, select, keypress, drag, scroll, verify, screenshot |
| `src/browser-manager.ts` | Управление браузером: launchSession, navigate, clickElement, takeScreenshot |
| `src/ws-server.ts` | HTTP+WS сервер: /api/launch, /api/record/start, /api/record/stop, /api/execute-step |
| `src/cdp-listener.ts` | CDP Event Listener: request, response, failure, websocket events |
| `src/inject-helpers.ts` | DOM-хелперы (924 строки): Shadow DOM, iframe, SPA nav, error tracking, Jira detector и т.д. |
| `src/action-parser.ts` | Парсер действий:自然语言 → StepCommand конвертация |
| `package.json` | Зависимости: playwright, ws, uuid, recorder-shared |

## Архитектура

```
ws-server.ts (port 3005)
  ├── /api/launch          → browser-manager.ts → chromium.launchPersistentContext()
  ├── /api/record/start    → recorder.ts → startRecording() → inject INJECT_SCRIPT
  ├── /api/record/stop     → recorder.ts → stopRecording() → final flush
  ├── /api/execute-step    → executor.ts → executeStep() → page.click/fill/...
  └── /api/page            → browser-manager.ts → getSession()

recorder.ts
  ├── INJECT_SCRIPT (из recorder-shared) → page.addInitScript() + page.addScriptTag()
  ├── page.on('console') → ловит __QTEST_ACTION__ от INJECT_SCRIPT
  ├── page.on('framenavigated') → навигации
  ├── page.on('request/response') → HTTP
  ├── LOCAL_INJECT_SCRIPT (backup) → локальная копия на случай проблем с recorder-shared
  └── pendingActions[] → flush (2 сек) → POST recorder-service

executor.ts
  ├── executeStep() → page.click/fill/select/press/...
  ├── recordStep() → запись programmatic actions в pendingActions[]
  └── getPendingActions() → ссылка на recorder.ts pending queue
```

## Изменения (2026-06-09)

### Импорт INJECT_SCRIPT из recorder-shared

**Файл:** `src/recorder.ts:5`

```typescript
// Было:
import { SHADOW_DOM_HELPER, IFRAME_HELPER, ... } from './inject-helpers';
const INJECT_SCRIPT = `(function __qtestInject() { ... })`;

// Стало:
import { INJECT_SCRIPT } from 'recorder-shared';
import { SHADOW_DOM_HELPER, ... TP_ID_GENERATOR } from './inject-helpers';
import { CDPListener, CDPListenerOptions } from './cdp-listener';

// Локальная копия сохранена как LOCAL_INJECT_SCRIPT (backup)
const LOCAL_INJECT_SCRIPT = `(function __qtestInject() { ... })`;
```

**Источники анализа:**
- `src/recorder.ts:4-14` — оригинальные импорты (TP_ID_GENERATOR, CDPListener)
- `src/recorder.ts:28-30` — INJECT_SCRIPT начинается с `${TP_ID_GENERATOR}` перед guard
- `recorder-shared/src/inject-script.ts:19-20` — INJECT_SCRIPT в recorder-shared

**Проблемы:**
| # | Проблема | Причина | Решение |
|---|----------|---------|---------|
| 1 | TP_ID_GENERATOR отсутствовал в recorder-shared | Упрощение при копировании | Добавлен в inject-script.ts:12 перед guard |
| 2 | CDPListener импорт потерян | Неполное редактирование | Восстановлен из git, добавлен обратно |
| 3 | TS2307: Cannot find module 'recorder-shared' | recorder-shared не в workspaces | Добавлен в root package.json workspaces |

**Команды:**
```powershell
cd qtest-runner
npm install                    # workspace linking
cd packages/browser-agent
npm run build                  # tsc → dist/recorder.js
```

## Сборка

```powershell
cd packages/browser-agent
npm run build    # tsc → dist/
```

## Связи

- **recorder-shared** — импортирует `INJECT_SCRIPT` (полная копия, 1498 строк)
- **inject-helpers.ts** — локальная копия (924 строки), используется для `LOCAL_INJECT_SCRIPT` backup
- **recorder-service** — получает actions через HTTP POST (flush каждые 2 сек)
- **browser-manager** — управляет Chromium session (launch, navigate, screenshot)
