# Активная цель (сохранено 29.05.2026, Сессия #~46)

## Главная цель
Доработать qtest-runner до уровня Playwright (или лучше): запись взаимодействий пользователя с браузером для генерации тест-кейсов Zephyr Scale.

## Текущая подзадача
**Iteration 12-15 завершёны.** Exhaustive recording verification всех 17 INJECT_SCRIPT модулей (175 actions, 0 JS errors). Исправлены SQLite double-quote баг и press→keypress mapping.

## Статус

### ✅ Завершённые шаги
- **Iteration 1-5:** CAPTCHA, INJECT_SCRIPT архитектура, Shadow DOM, SPA навигация, Error Tracking
- **Iteration 6:** 11 INJECT_SCRIPT модулей (inject-helpers.ts), assertion engine, touch/wheel, animation, lifecycle, file upload
- **Iteration 7:** Iframe Bridge (same-origin + cross-origin postMessage)
- **Iteration 8:** CAPTCHA детекция (ReCaptcha v2, Turnstile, hCaptcha), фикс INJECT_SCRIPT SyntaxError
- **Iteration 9:** Скриншоты на каждом шаге, multi-tab (switchTab/listTabs), 8 MCP инструментов
- **Iteration 9.5:** 6 критических багов записи в БД (headers JSON.stringify, postJson reject, retry race condition и др.)
- **Iteration 10:** User Switch (Ctrl+Shift+U), Drag & Drop, programmatic API
- **Iteration 11:** Media Events, Popover API
- **Iteration 12:** Composite Steps — CRUD, expand endpoint, execution integration
- **Iteration 13:** IME Composition
- **Iteration 14:** ResizeObserver / IntersectionObserver monkey-patch
- **Iteration 15:** SQLite double-quote fix + exhaustive recording verification (175 actions, 17/17 modules) + press→keypress fix
- **Iteration 16:** Canvas click recording (x,y coordinates, full pipeline) + Video recording (Playwright recordVideo, save as <sid>.webm, download API) + Selection tracking (selectionchange, debounce 400ms, DB `selection_length/selection_text`)
- **Documentation:** AGENTS.md, ARCHITECTURE.md, STATUS.md, USAGE.md — обновлены (canvas + video + selection)

### 🔄 В процессе
- Ожидание новых задач от пользователя

### ⬜ Следующие шаги
1. Multilingual CAPTCHA — поддержка русского языка в сообщениях
2. (P2) Add `dblclick` action to executor
3. (P2) Add `rightClick` action to executor

## Принятые решения
- **Shadow DOM:** использовать `composedPath()` + `deepActiveElement()` вместо `e.target`
- **SPA навигация:** monkey-patch history API вместо setInterval polling
- **Object fields → JSON.stringify():** перед передачей в better-sqlite3 v11 .run()
- **postJson reject on non-2xx:** действия re-queue с retry вместо молчаливой потери
- **stopRecording retry:** 3 попытки с 1s задержкой
- **Executor race condition:** `sessionId` + `pendingRef` захватываются ДО `page.goto()`
- **Динамический SQL:** `vals.map(() => '?')` — гарантирует совпадение числа placeholder'ов
- **Архитектура MCP:** browser-agent (MCP) → recorder-service (REST) — разделение ответственности
- **INJECT_SCRIPT пассивные слушатели:** media/popover/drag только слушают, не симулируют
- **SQLite double-quote rule:** `""` = column identifier, `''` = string literal. Всегда использовать `''` для строк.
- **Fastify v5 object response:** массивы всегда оборачивать в объект (`{ categories: [...] }`), иначе 500.
- **press→keypress mapping:** parseStep() + ws-server fallback должны оба обрабатывать `action === 'press'`

## Заметки / вопросы
- 17 INJECT_SCRIPT модулей работают стабильно (включая CAPTCHA_DETECTOR)
- Всего 8 MCP инструментов
- Всего исправлено 17+ багов
- Exhaustive recording test: 175 actions → 139 steps, 0 JS errors
- Что делать дальше?
