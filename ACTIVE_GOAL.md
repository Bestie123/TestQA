# Активная цель (сохранено 30.05.2026, Сессия #~47)

## Главная цель
Завершить все запланированные итерации по доработке qtest-runner: критичные фиксы, Chrome Extension, инфраструктура, тесты, E2E Course.
Подробный план: `.opencode/plans/EXPANDED_PLAN.md`

## Текущая подзадача
**Iteration 0 (✅ завершена):** Реструктуризация AGENTS.md — правила оформления перенесены в `Test-cases&Bug-reports/`, бэклог создан.
**→ Iteration 1:** Исправить ImportPage, SyncPage, seed data, CAPTCHA path.

## Статус

### ✅ Завершённые шаги (до Iteration 0)
- **Iteration 1-16:** Все предыдущие итерации по разработке qtest-runner (CAPTCHA, INJECT_SCRIPT, Shadow DOM, SPA, Composite Steps, Canvas, Video, Selection, DblClick/RightClick и т.д.)

### ✅ Iteration 0 — Реструктуризация
- `Test-cases&Bug-reports/RULES.md` — все правила оформления тест-кейсов и баг-репортов
- `Test-cases&Bug-reports/BACKLOG.md` — отложенные фичи с причинами
- AGENTS.md — очищен (оставлены только auto-continue, микросервисная архитектура, карта проекта, best practices, composite steps)
- `.opencode/plans/EXPANDED_PLAN.md` — детальный план всех итераций

### 🔄 В процессе
- Iteration 1: ImportPage, SyncPage, seed data, CAPTCHA test-pages

### ⬜ Следующие шаги
- Iteration 2: Chrome Extension (Shadow DOM + icons)
- Iteration 3: Graceful shutdown (6 сервисов)
- Iteration 4: Cross-origin iframe test server
- Iteration 5: Unit-тесты (vitest)
- Iteration 6: E2E Interactive Course (MCP)

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
