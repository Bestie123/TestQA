# Активная цель (сохранено 30.05.2026, Сессия #~47)

## Главная цель
Все 7 итераций по доработке qtest-runner выполнены. Проект реорганизован — вынесены независимые проекты, очищен корень, структурирована документация.

## Текущая подзадача
Ожидание новых задач от пользователя.

## Статус

### ✅ Завершённые итерации (30.05.2026)
1. **Iteration 0** — Реструктуризация AGENTS.md (правила → Test-cases&Bug-reports/)
2. **Iteration 1** — ImportPage, SyncPage (Excel через SheetJS), seed data `projectUrl`, CAPTCHA test-pages
3. **Iteration 2** — Chrome Extension (Shadow DOM: composedPath, shadow-aware getSelector; иконки)
4. **Iteration 3** — Graceful shutdown (6 сервисов: SIGINT/SIGTERM/SIGBREAK + 5s timeout)
5. **Iteration 4** — Cross-origin iframe test server (порт 9091)
6. **Iteration 5** — Unit-тесты (vitest, 57 тестов для action-parser)
7. **Iteration 6** — E2E Interactive Course MCP (qtest_test_course + qtest_test_course_verify)

### ✅ Реорганизация файловой структуры
- `Test-cases&Bug-reports/` → `Desktop/Test-cases&Bug-reports/`
- `zephyr-sort-extension/` → `Desktop/zephyr-sort-extension/`
- `AGENTS.md` → `docs/rules/AGENTS.md`
- `.md` из корня qtest-runner → `qtest-runner/docs/`
- .xlsx, .html → `docs/testcases/`
- .docx → `docs/reports/`
- Планы (REFACTOR_PLAN, GAP_ANALYSIS, PLAYWRIGHT_VS_QTESTRUNNER, EXPANDED_PLAN) → `docs/archive/`
- precondition.files, ~$*, битые файлы → `Desktop/Test-cases&Bug-reports/`
- Zephyr ресурсные папки → `docs/testcases/`
- zephyr-sort-extension.7z → `docs/archive/`

### 🔄 В процессе
(ожидание)

### ⬜ Возможные следующие шаги
- Unit-тесты convertToSteps (recorder-service)
- Unit-тесты executor.ts (browser-agent)
- Unit-тесты ws-server.ts (selector forwarding)
- Фикс 4 багов action-parser (English паттерны, assertText regex)
- Zephyr Sync API (по необходимости)

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
- 17 INJECT_SCRIPT модулей работают стабильно
- EXPANDED_PLAN.md в `.opencode/plans/` — общий план на все итерации
- Архитектурные решения по проектированию сохраняются здесь для перекрёстных сессий
