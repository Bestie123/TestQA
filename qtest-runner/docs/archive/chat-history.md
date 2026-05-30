---
title: Chat History
---

# Полная копия истории чата — qtest-runner

> **Source:** `archive/CHAT_HISTORY.md`

## Дата: 27-28 мая 2026

---

## Начало: Что было сделано до этого чата

### Архитектура проекта (7 микросервисов + web-ui)
```
packages/
├── api-gateway/          # порт 3000 — reverse proxy
├── testcase-service/     # порт 3001 — CRUD тест-кейсов
├── step-library-service/ # порт 3002 — библиотека шагов
├── execution-service/    # порт 3003 — выполнение тестов
├── recorder-service/     # порт 3004 — запись действий + БД
├── browser-agent/        # порт 3005 — Playwright + CDP
├── chrome-extension/     # расширение для Chrome
├── web-ui/               # React SPA (Vite, порт 8080)
└── stub-site/            # порт 3006 — тестовый сайт-заглушка
```

### Что уже было создано
- Полная архитектура микросервисов
- action-parser.ts — парсинг тест-кейсов в команды Playwright
- execution-service — автовыполнение шагов через browser-agent
- browser-agent — CDP-based запись + воспроизведение
- Web UI — страницы TestCaseList, ExecutionPage, RecorderPage, ReportsPage, SyncPage, DiffPage, CompositeStepsPage
- Chrome Extension — popup + content script
- Zephyr Scale интеграция (синхронизация, импорт Excel)

---

## Текущая сессия: Исправление записи действий

### Проблема 1: Запись не ловила действия пользователя

**Суть:** Пользователь нажимал "Начать запись", взаимодействовал с браузером, но действия не записывались.

**Причина:** Inject-скрипт использовал `setInterval` для polling URL — ненадёжно, не ловит `reload()`, не ловит `pushState()`.

**Решение:** Dual-layer recording:
- Playwright-level: `page.on('framenavigated')`, `page.on('load')`, `page.on('response')`
- Browser inject: DOM events (click, input, change, keydown, drag, submit, scroll)
- URL polling в inject script для SPA навигации

### Проблема 2: `recorderUrl` содержал двойной `/api`

**Суть:** Web UI передавал `window.location.origin + '/api'` как `recorderUrl`, а flush добавлял ещё `/api/recordings/...`. Получалось `http://localhost:3000/api/api/recordings/...`.

**Решение:** Изменено на `window.location.origin` (без `/api`).

### Проблема 3: `page.exposeFunction` падал при повторном вызове

**Суть:** При переиспользовании профиля `exposeFunction('__recordAction')` выбрасывал "already registered".

**Решение:** Обёрнуто в try-catch.

### Проблема 4: Stale sessions — браузер закрыт, но `defaultProfileId` остался

**Суть:** Если браузер убит, а `defaultProfileId` остался, `/api/launch` возвращал `alreadyRunning: true` с мёртвым профилем. Потом `record/start` падал с "browserContext closed".

**Решение:** В `/api/launch` добавлена проверка `page.evaluate('1+1')` перед возвратом `alreadyRunning`. Если контекст мёртв — запускается новый браузер.

### Проблема 5: action-parser генерировал дублирующие команды

**Суть:** При `action=click` (англ.) русский regex не матчился, потом `testData` добавлял клик, потом дефолт добавлял ЕЩЁ клик с `text=click`.

**Решение:** Добавлены прямые типы в action-parser (click/fill/select/navigate/check/keypress) — возвращаются сразу без дублирования.

### Проблема 6: Executor не знал про `select`, `check`, `keypress`, `wait`

**Суть:** action-parser генерировал `action: 'select'`, но executor не обрабатывал этот тип.

**Решение:** Добавлены case'ы в executor.ts.

### Проблема 7: `body.value` не пробрасывался в команды

**Суть:** Тест передавал `{ value: 'admin' }`, но action-parser использовал `expectedResult` как value.

**Решение:** В ws-server.ts добавлен проброс `body.value` в команды fill/select.

---

## Тестирование на стаб-сайте

### Создан стаб-сайт (`packages/stub-site/`)
- **server.js** — Node.js HTTP-сервер на порту 3006
- **public/index.html** — SPA с 5 страницами:
  - `/` — Главная с 3 вкладками
  - `/login` — Форма авторизации (username, password, email, select role, checkbox)
  - `/form` — Форма данных (search, textarea, select, radio, date, range, number)
  - `/drag` — Drag & Drop
  - `/result` — Лог действий

### Результаты теста (`test-stub-interaction.js`)
```
=== RECORDED ACTIONS: 52 ===

navigate: 9     — все переходы между страницами
page_load: 1    — загрузка страниц
focus: 12       — фокус на всех полях ввода
fill: 12        — admin, secret123, admin@test.com, Playwright, Иван Иванов, etc.
click: 11       — вкладки, кнопки, ссылки, навигация
select: 2       — роль=Admin, категория=Bug
check: 3        — remember, agree, radio priority
submit: 2       — login-form, data-form

=== VERIFICATION ===
PASS click: 11 >= 5
PASS fill: 12 >= 5
PASS select: 2 >= 2
PASS check: 3 >= 3
PASS navigate: 9 >= 3
PASS submit: 2 >= 1
PASS focus: 12 >= 3
FAIL keypress: 0 < 1  (Enter не тестировался в этом прогоне)

RESULT: 7 passed, 1 failed
```

---

## Исправленные файлы

### `packages/browser-agent/src/recorder.ts`
- Dual-layer: Playwright `framenavigated`/`load`/`response` + inject script
- Inject script: click, input (debounce 400ms), change (select/checkbox/radio), keydown (Enter/Tab/Escape), dragstart/dragend/drop, submit, scroll, focus
- URL polling для SPA навигации (pushState)
- `sessionId` для lookup вместо `profileId` (без коллизий)
- Очистка stale recordings при новом `startRecording`

### `packages/browser-agent/src/action-parser.ts`
- Прямые типы: click, fill, select, navigate, check, keypress, wait, screenshot
- Русские паттерны: "Нажать", "Заполнить", "Выбрать", "Перейти по URL"
- Нет дублирования команд

### `packages/browser-agent/src/executor.ts`
- Добавлены: select (page.selectOption), check (click), keypress (keyboard.press), wait (setTimeout)

### `packages/browser-agent/src/ws-server.ts`
- `/api/launch` — stale session detection через `page.evaluate('1+1')`
- `/api/record/start` — проверка контекста жив перед стартом
- `/api/execute-step` — проброс `body.value` в команды

### `packages/recorder-service/src/db.ts`
- `convertToSteps()` — добавлены case'ы: page_load, keypress, check, scroll, drag
- Дедупликация navigate (одинаковый URL)

### `packages/web-ui/src/pages/RecorderPage.tsx`
- `recorderUrl` = `window.location.origin` (без `/api`)
- `profileName` = `session.id` (уникальный профиль)

### `packages/web-ui/src/api.ts`
- Исправлены дублирующиеся объявления функций

### `AGENTS.md`
- Добавлен раздел "Best Practices: Playwright Recording"

---

## Текущее состояние сервисов

| Сервис | Порт | Статус |
|--------|------|--------|
| api-gateway | 3000 | OK |
| testcase-service | 3001 | OK |
| step-library-service | 3002 | OK |
| execution-service | 3003 | OK |
| recorder-service | 3004 | OK |
| browser-agent | 3005 | OK |
| stub-site | 3006 | OK |
| web-ui (Vite) | 8080 | OK |

---

## Что осталось доделать

1. **keypress (Enter)** — inject script ловит, но тест не проверял
2. **Drag & Drop** — inject ловит dragstart/dragend/drop, но_executor не выполняет drag команды
3. **Scroll** — inject ловит, но нет action-parser паттерна
4. **Новые вкладки** — `context.on('page')` для перехвата новых табов
5. **Video recording** — Playwright поддерживает video trace
6. **Скриншоты при ошибках** — автоматический screenshot при failed step
7. **Chrome Extension** — интеграция с existing test cases
8. **Composite steps** — переиспользование общих шагов
9. **User switch** — переключение пользователей во время записи
10. **Очистка БД** — удаление старых recording sessions

---

## Сессия 2: 28 мая 2026 — Shadow DOM, iframe, SPA, assertions, error tracking, touch/wheel, animation, lifecycle

### Создан `inject-helpers.ts` (11 модулей)

| Модуль | Функция | Типы действий |
|--------|---------|---------------|
| `SHADOW_DOM_HELPER` | composedPath() + deepActiveElement() | click, fill внутри shadow root |
| `IFRAME_HELPER` | Рекурсивный frame selector path | frame[name="..."] >> selector |
| `SPA_NAV_HELPER` | monkey-patch pushState/replaceState + popstate/hashchange | navigate (spaMethod) |
| `ERROR_TRACKER_HELPER` | window.onerror + unhandledrejection | js_error, unhandled_rejection |
| `ASSERTION_HELPER` | Генерация ожидаемого результата | assertText, assertValue, assertChecked |
| `JIRA_DETECTOR_HELPER` | Детекция AUI, Froala, Zephyr, plugin iframe'ы | jira_env (informational) |
| `COOKIE_CONSENT_HELPER` | OneTrust, CookieYes, Cookiebot, generic | cookie_consent |
| `TOUCH_WHEEL_HELPER` | touchstart/touchend/touchmove + wheel | touchstart, touchend, touchmove, wheel |
| `ANIMATION_HELPER` | transitionend/start + animationend/start | transition_end, animation_end |
| `LIFECYCLE_HELPER` | visibilitychange + pagehide/pageshow + dialog + details | visibility_change, dialog_element, details_toggle |
| `FILE_UPLOAD_HELPER` | input type="file" change | file_upload |

### Обновлён `recorder.ts`
- Все 11 модулей встроены через `${SHADOW_DOM_HELPER}`
- Все event handlers используют `__deepEventTarget(event)` (composedPath)
- Удалён URL polling — заменён на SPA_NAV_HELPER monkey-patch
- `formatActionDetail()`: +15 новых case'ов

### Обновлён `executor.ts`
- hover, dragTo, wheel, touch, fileUpload, waitForSelector
- assertText, assertVisible, assertValue, assertChecked, assertUrl

### Обновлён `action-parser.ts`
- Русские паттерны: "проверить текст/наличие/видимость", "навести", "перетащить", "прокрутить колёсиком", "дождаться", "загрузить файл"

### Обновлён `db.ts` convertToSteps()
- +15 новых case'ов с русскими описаниями шагов

### Создан `advanced-test.html`
- 9 секций: Shadow DOM, iframe, SPA, transitions/animations, drag & drop, modal/dialog/toast, details/file upload, keyboard/tracking

### Обновлён `AGENTS.md`
- Добавлен "Best Practices: Playwright Recording (browser-agent)":
  - 3-уровневая архитектура (mermaid)
  - Таблица всех 11 inject-модулей
  - Playwright-level события (framenavigated, load, request, response, console, dialog, pageerror)
  - Browser inject события (click/composedPath, input, change, keydown, touch, wheel, transition, animation, lifecycle)
  - Executor recording (navigate, click, fill, assert*, hover, dragTo, wheel, touch)
  - Shadow DOM / iframe / SPA Nav / Error Tracking / Cookie Consent / Assertion Engine секции
  - Checklist добавления нового типа действия (7 шагов)
  - 12 best practices

### Создан `REFACTOR_PLAN.md`
- 117 пунктов в 4 итерациях (Iteration 6-9)

### Компиляция: ✅ 0 errors (241 files, 23.21s)

### Что осталось (текущая сессия)
- [ ] Обновить ARCHITECTURE.md (inject-helpers модули, новые action types)
- [ ] Обновить STATUS.md (Iteration 6/7 milestones)
- [ ] Обновить GAP_ANALYSIS.md (отметить реализованные пункты)
- [ ] Обновить PLAYWRIGHT_VS_QTESTRUNNER.md
- [x] Обновить PROBLEMS.md
- [x] Протестировать E2E через browser-agent + advanced-test.html

### Баги, найденные при E2E тестировании (исправлены)

| # | Проблема | Причина | Фикс |
|---|----------|---------|------|
| 1 | `assertText` → click | `parseStep` сравнивал с `'assertText'` (mixed case), но `a` была `'asserttext'` (toLowerCase()) | Все сравнения в lowercase |
| 2 | `hover` → click | Та же lowercasing проблема | + |
| 3 | `drag` возвращал пустые команды | `body.value` не передавался как `testData` в `parseStep()` | В `ws-server.ts`: `parseStep(action, body.testData || body.value, expectedResult)` |
| 4 | `body.selector` перезаписывал `cmd.selector` из parseStep | Forwards код не проверял, есть ли уже selector | Добавлен `&& !cmd.selector` |
| 5 | `fill` ломал CSS селекторы (Unsupported token "@") | parseStep для fill устанавливал `selector=td`, где td = value, не selector | Убраны selector из fill/select/click/check в parseStep — selector приходит от body.selector |
| 6 | `assertValue` — value не совпадал | То же самое — selector перезаписывался | + |
| 7 | `drag` — target пустой | parseStep устанавливал `selector: td`, value пустой → `body.selector` не перезаписывал | parseStep больше не устанавливает selector для drag |

### Итоговый тест: все 9 action types проходят

| Action | SEL | VAL | Статус |
|--------|-----|-----|--------|
| fill | #textInput | Hello World | ✅ passed |
| click | #btnClick | — | ✅ passed |
| select | #selectBox | option2 | ✅ passed |
| assertText | h1 | Advanced Interactive Test Page | ✅ passed |
| assertValue | #emailInput | test@test.com | ✅ passed |
| hover | #btnClick | — | ✅ passed |
| drag | #drag1 | #dropZone | ✅ passed |
| wheel | — | deltaY=200 | ✅ passed |
| waitForSelector | h1 | — | ✅ passed |

### Дополнительные баги, найденные после теста

| # | Проблема | Причина | Фикс |
|---|----------|---------|------|
| 8 | convertToSteps не имел case для `drag` (executor-level) и `waitForSelector` | Были только `dragstart`/`dragend` (inject-level) | Добавлены case'ы |
| 9 | Дублирующийся `case 'hover':` и `case 'wheel':` в convertToSteps | Один с `break;` (пустой), второй нормальный — dead code | Удалены дубликаты |
| 10 | entry point recorder-service: запускал `dist/server.js` не `dist/index.js` | server.js экспортирует, index.js вызывает | Запускать `dist/index.js` |
| 11 | E2E: 15 actions записаны, convertToSteps генерирует 8 типов шагов | Все executor-level action types корректно конвертятся | ✅ PASS |

### Итог E2E recording test
- **Actions recorded**: 15 (navigate, click×2, fill, select, hover, wheel, drag, assertText, waitForSelector + Playwright-level events)
- **Actions types in convert**: assertText, click, drag, fill, hover, select, waitForSelector, wheel (8 types)
- **All pass**: ✅
