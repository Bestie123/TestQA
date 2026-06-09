# packages/recorder-shared/ — Общие компоненты для системы записи

> Doc-ID: REC-SHARED-1 | Дата: 2026-06-09 | Связанные: [BROWSER-AGENT-1], [MCP-BROWSER-1]

## Файлы

| Файл | Назначение |
|------|-----------|
| `src/index.ts` | Главный экспорт — все типы, INJECT_SCRIPT, ActionQueue |
| `src/types.ts` | TypeScript интерфейсы: RecordedAction, RecordingSettings, StepMarker, ManualAction |
| `src/inject-helpers.ts` | DOM-хелперы (924 строки): Shadow DOM, iframe, SPA nav, error tracking, Jira detector, CAPTCHA, touch/wheel, animations, lifecycle, file upload, user switch, popover, media, IME, resize observer, TP_ID_GENERATOR |
| `src/inject-script.ts` | Composed INJECT_SCRIPT — полный набор DOM-событий + overlay + console (574+ строк) |
| `src/action-queue.ts` | ActionQueue — очередь programmatic actions с flush в recorder-service каждые 2 сек |
| `package.json` | Нет внешних зависимостей (только typescript) |
| `tsconfig.json` | ES2022, NodeNext, strict mode |

## Архитектура

```
recorder-shared
├── types.ts              ← RecordedAction, RecordingSettings
├── inject-helpers.ts     ← 924 строки DOM-хелперов (из browser-agent)
├── inject-script.ts      ← INJECT_SCRIPT = helpers + основной скрипт
├── action-queue.ts       ← ActionQueue + builders (click/fill/navigate/...)
└── index.ts              ← реэкспорт всего

Используется:
├── browser-agent/recorder.ts  ← импорт INJECT_SCRIPT (замена локальной копии)
└── mcp-browser/index.ts       ← импорт INJECT_SCRIPT + ActionQueue + builders
```

## INJECT_SCRIPT

Полный скрипт (1498 строк) инжектируется в страницу через `page.addInitScript()` + `page.addScriptTag()`.

### Структура INJECT_SCRIPT

```javascript
(function __qtestInject() {
  // 1. TP_ID_GENERATOR — генерация data-tp/data-tp-path (независимо от guard)
  ${TP_ID_GENERATOR}

  // 2. Guard — предотвращает повторную инъекцию
  if (window.__qtestRecorderInjected) return;

  // 3. Defer to DOMContentLoaded
  if (document.body === null) { ... }

  // 4. Helpers (из inject-helpers.ts):
  //    - Shadow DOM (composedPath, deepActiveElement, getInteractiveParent, getSmartSelector)
  //    - iframe traversal
  //    - SPA Navigation (pushState/replaceState/popstate/hashchange monkey-patch)
  //    - Error Tracking (onerror, unhandledrejection)
  //    - Assertion Engine (auto-generate expected results)
  //    - Jira/Zephyr Detector
  //    - Cookie Consent auto-detect
  //    - CAPTCHA detector (ReCaptcha, Turnstile, hCaptcha)
  //    - Touch/Wheel/Drag events
  //    - CSS Animation/Transition tracking
  //    - Page Lifecycle (visibilitychange, pagehide, pageshow)
  //    - File Upload handler
  //    - User Switch hotkey (Ctrl+Shift+U)
  //    - Popover API
  //    - Media Events (video/audio)
  //    - IME Composition (CJK)
  //    - ResizeObserver/IntersectionObserver monkey-patch

  // 5. __record() — core recording function
  //    Channel 1: console.debug("__QTEST_ACTION__" + JSON)
  //    Channel 2: window.__recordAction(data) (exposeFunction bridge)

  // 6. iframe bridge (postMessage for cross-origin)

  // 7. Log overlay (fixed bottom-right panel)

  // 8. DOM Event Listeners:
  //    - click, dblclick, input (debounced), change, focusin, keydown
  //    - contextmenu, submit
  //    - Console intercept (log/warn/error/info/debug)
  //    - Alert/Confirm/Prompt intercept

  // 9. Shadow DOM scanning

  // 10. Overlay creation
})();
```

### Два канала записи

| Канал | Механизм | Когда работает |
|-------|----------|----------------|
| `console.debug("__QTEST_ACTION__"...)` | Playwright `page.on('console')` | Всегда |
| `window.__recordAction(data)` | Playwright `page.exposeFunction()` | Если exposeFunction удался |

## ActionQueue

Очередь programmatic actions для mcp-browser.

```typescript
const queue = new ActionQueue("http://localhost:3004");
queue.start("session-id");
queue.push(buildClickAction("#my-button"));
queue.stop(); // flush + retries
```

### Flush mechanism

- Каждые 2 секунды: `POST /api/recordings/{sessionId}/actions`
- При остановке: 3 retry'а с интервалом 1 сек
- При ошибке: actions возвращаются в очередь

## Action Builders

| Builder | Тип | Поля |
|---------|-----|------|
| `buildClickAction(selector, text?)` | `click` | selector, selectorText |
| `buildFillAction(selector, value, type?)` | `fill` | selector, value, inputType |
| `buildKeypressAction(key, selector?)` | `keypress` | value, selector |
| `buildNavigateAction(url)` | `navigate` | url |
| `buildEvaluateAction(code, result?)` | `evaluate` | value (truncated), selectorText |
| `buildStepMarker(num, desc, expected?)` | `step_marker` | stepNumber, description, expectedResult |
| `buildManualAction(desc, type, sel?, exp?, act?, ss?)` | `manual_action` | description, actionType2, selector, expected, actual, screenshot |

## RecordingSettings

```typescript
interface RecordingSettings {
  recordNetwork: boolean;      // HTTP requests/responses (default: true)
  recordConsole: boolean;      // console.log/warn/error (default: true)
  recordHover: boolean;        // hover events (default: false)
  recordTransitions: boolean;  // CSS transitions (default: false)
  recordResize: boolean;       // resize events (default: false)
  recordScroll: boolean;       // scroll events (default: false)
  recordMutations: boolean;    // DOM mutations (default: true)
  recordProgrammatic: boolean; // MCP actions (default: true)
  recordNavigation: boolean;   // page navigations (default: true)
  recordDialogs: boolean;      // dialog/alert/confirm (default: true)
}
```

## RecordedAction

```typescript
interface RecordedAction {
  actionType: string;          // click, fill, navigate, keypress, evaluate, ...
  selector?: string;
  selectorText?: string;
  value?: string;
  url?: string;
  timestamp: string;
  source?: 'dom' | 'programmatic' | 'manual';
  stepNumber?: number;         // для step_marker
  description?: string;        // для step_marker/manual_action
  expectedResult?: string;     // для step_marker
  actionType2?: string;        // для manual_action
  expected?: string;           // для manual_action
  actual?: string;             // для manual_action
  screenshot?: string;         // base64 PNG для manual_action
}
```

## Сборка

```powershell
cd packages/recorder-shared
npm run build    # tsc → dist/
```

## Связи

- **browser-agent** — импортирует `INJECT_SCRIPT` (замена локальной копии в recorder.ts)
- **mcp-browser** — импортирует `INJECT_SCRIPT` + `ActionQueue` + builders
- **recorder-service** — получает actions через HTTP POST от ActionQueue

## Проблемы

| # | Проблема | Причина | Решение |
|---|----------|---------|---------|
| 1 | TP_ID_GENERATOR отсутствовал в первой версии | Упрощение при копировании | Добавлен в inject-script.ts перед guard |
| 2 | Импорт `./inject-helpers.js` ломался в NodeNext | Требуются .js расширения | Добавлены .js суффиксы ко всем imports |
| 3 | `buildManualAction` использовал поле `action` | Не существовало в RecordedAction | Переименовано в `description` |

## Источники анализа

- `browser-agent/src/recorder.ts:28-601` — оригинальный INJECT_SCRIPT
- `browser-agent/src/inject-helpers.ts:1-924` — все DOM-хелперы
- `browser-agent/src/recorder.ts:80-90` — __record() function
- `browser-agent/src/recorder.ts:796-803` — exposeFunction bridge
- `browser-agent/src/recorder.ts:1092` — flush timer (2 сек)
- `browser-agent/src/recorder.ts:1122-1129` — flush with retries
