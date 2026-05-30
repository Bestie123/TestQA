# Активная цель (сохранено 30.05.2026, Сессия #~49)

## Главная цель
Все 7 итераций по доработке qtest-runner выполнены. Документация консолидирована: VitePress-сайт с тёмной темой, 16 страниц, 205 тестов.

## Текущая подзадача
Ожидание новых задач от пользователя.

## Статус

### ✅ Завершённые итерации (30.05.2026)
1. **Iteration 0** — Реструктуризация AGENTS.md (правила → Test-cases&Bug-reports/)
2. **Iteration 1** — ImportPage, SyncPage (Excel через SheetJS), seed data `projectUrl`, CAPTCHA test-pages
3. **Iteration 2** — Chrome Extension (Shadow DOM: composedPath, shadow-aware getSelector; иконки)
4. **Iteration 3** — Graceful shutdown (6 сервисов: SIGINT/SIGTERM/SIGBREAK + 5s timeout)
5. **Iteration 4** — Cross-origin iframe test server (порт 9091)
6. **Iteration 5** — Unit-тесты (vitest, 205 тестов: 59+19+51+76)
7. **Iteration 6** — E2E Interactive Course MCP (qtest_test_course + qtest_test_course_verify)

### ✅ Консолидация документации (30.05.2026)
- **VitePress-сайт:** установлен vitepress v1.6.4, тёмная тема, сайдбар, поиск
- **16 страниц:** index, architecture, usage, flow, problems, loop-rules, status, assertions, testing, changelog + 5 archive pages
- **Каждая страница** содержит `> **Source:** filename.md` — привязка к исходному .md
- **Скрипты:** `npm run docs:dev`, `docs:build`, `docs:preview`
- **Удалён мусор:** `PROMPT.md`, дубль `ACTIVE_GOAL.md`
- **Архив перенесён:** `docs/archive/*` → `qtest-runner/docs/archive/`
- **Файлы переименованы:** в lowercase для чистых URL
- **Созданы новые:** `ASSERTIONS.md`, `TESTING.md`, `CHANGELOG.md`
- **Обновлён REFACTOR_PLAN.md:** P0-P2 ✅, 25/146 → ~140/146
- **Обновлён CONTEXT_RULES.md:** секция `## Documentation Reference`

### ✅ Реорганизация файловой структуры
- `Test-cases&Bug-reports/` → `Desktop/Test-cases&Bug-reports/`
- `zephyr-sort-extension/` → `Desktop/zephyr-sort-extension/`
- `AGENTS.md` → `docs/rules/AGENTS.md`
- `.md` из корня qtest-runner → `qtest-runner/docs/`
- .xlsx, .html → `docs/testcases/`
- .docx → `docs/reports/`
- Планы → `qtest-runner/docs/archive/`
- precondition.files, ~$*, битые файлы → `Desktop/Test-cases&Bug-reports/`

### 🔄 В процессе
(ожидание)

### ⬜ Возможные следующие шаги
- Zephyr Sync API (по необходимости)

## Принятые решения
- **VitePress:** выбран для документации — тёмная тема, поиск, сайдбар, .md как source of truth
- **Multi-page с атрибуцией:** каждая страница сайта указывает исходный .md (`> **Source:** filename.md`)
- **CONTEXT_RULES.md:** добавлена секция с инструкцией загружать docs-сайт через webfetch при старте сессии
- **Shadow DOM:** использовать `composedPath()` + `deepActiveElement()` вместо `e.target`
- **SPA навигация:** monkey-patch history API вместо setInterval polling
- **Object fields → JSON.stringify():** перед передачей в better-sqlite3 v11 .run()
- **postJson reject on non-2xx:** действия re-queue с retry вместо молчаливой потери
- **stopRecording retry:** 3 попытки с 1s задержкой
- **Executor race condition:** `sessionId` + `pendingRef` захватываются ДО `page.goto()`
- **SQLite double-quote rule:** `""` = column identifier, `''` = string literal
- **Mock better-sqlite3:** in-memory DB через vi.hoisted + vi.mock
- **Тестовые файлы:** исключены из tsc через `"exclude": ["src/__tests__"]`

## Заметки / вопросы
- 17 INJECT_SCRIPT модулей работают стабильно
- REFACTOR_PLAN.md: Video recording (P2) — единственный нереализованный пункт
- Для просмотра docs: `npm run docs:dev` в qtest-runner → порт 5173
