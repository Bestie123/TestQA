# Активная цель (сохранено 29.05.2026, Сессия #~45)

## Главная цель
Доработать qtest-runner до уровня Playwright (или лучше): запись взаимодействий пользователя с браузером для генерации тест-кейсов Zephyr Scale.

## Текущая подзадача
**Iteration 12 завершён.** Composite Steps реализованы полностью: CRUD, expand, execution integration. Документация добавлена в AGENTS.md.

## Статус

### ✅ Завершённые шаги
- **Iteration 1-5:** CAPTCHA, INJECT_SCRIPT архитектура, Shadow DOM, SPA навигация, Error Tracking
- **Iteration 6:** 11 INJECT_SCRIPT модулей (inject-helpers.ts), assertion engine, touch/wheel, animation, lifecycle, file upload
- **Iteration 7:** Iframe Bridge (same-origin + cross-origin postMessage)
- **Iteration 8:** CAPTCHA детекция (ReCaptcha v2, Turnstile, hCaptcha), фикс INJECT_SCRIPT SyntaxError
- **Iteration 9:** Скриншоты на каждом шаге, multi-tab (switchTab/listTabs), 8 MCP инструментов
- **Iteration 9.5:** 6 критических багов записи в БД (headers JSON.stringify, postJson reject, retry race condition и др.)
- **Iteration 10:** User Switch (Ctrl+Shift+U), Drag & Drop (dragstart/dragend/drop listeners), programmatic API
- **Iteration 11:** Media Events (play/pause/seeked/volumechange), Popover API (beforetoggle/toggle)
- **Iteration 12:** Composite Steps — CRUD, expand endpoint ({{param}} substitution), execution-service integration
- **Iteration 13:** IME Composition — compositionstart/compositionend/input skip для CJK ввода
- **Iteration 14:** ResizeObserver / IntersectionObserver — monkey-patch для отслеживания размеров и видимости элементов
- **Documentation:** AGENTS.md обновлён — карта проекта + Composite Steps

### 🔄 В процессе
- Определение следующих задач

### ⬜ Следующие шаги
1. Canvas click recording с координатами
2. Video recording (playwright-screen-recorder)
3. Selection tracking
4. Multilingual CAPTCHA — поддержка русского языка в сообщениях

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

## Заметки / вопросы
- 15 INJECT_SCRIPT модулей работают стабильно: SHADOW_DOM, IFRAME, SPA_NAV, ERROR_TRACKER, ASSERTION, JIRA_DETECTOR, COOKIE_CONSENT, CAPTCHA_DETECTOR, TOUCH_WHEEL (+drag), ANIMATION, LIFECYCLE, FILE_UPLOAD, USER_SWITCH, MEDIA_EVENTS, POPOVER
- Всего 8 MCP инструментов: health, launch_browser, record_start/stop, get_actions, convert_steps, execute_step, check_db
- Всего исправлено 15+ багов
- Лучшая запись: 36 actions в БД (2 со скриншотами)
- Что делать с Composite Steps? step-library-service почти пустой
