# Известные проблемы qtest-runner

## Проблема 1: INJECT_SCRIPT не работает через page.evaluate

**Симптом:** DOM-события (click, fill, select) НЕ записываются. Записываются только Playwright-level события (request, navigate, page_load, response).

**КОРЕННАЯ ПРИЧИНА:** Внутри INJECT_SCRIPT был polling-цикл (50 попыток × 100мс), который ждал `window.__recordAction`. Этот binding НИКОГДА не создавался — `exposeFunction('__recordAction')` отсутствовал. Polling молча умирал через 5 секунд, и `__setupRecorder()` (где находятся все обработчики событий — click, fill, overlay, shadow DOM) НИКОГДА не вызывался. Даже `console.debug`-канал (альтернативный) был внутри `__setupRecorder()`.

**Что пробовалось (было бесполезно, т.к. корневая причина — в логике скрипта, а не в методах инжекции):**
1. `page.evaluate(INJECT_SCRIPT)` — НЕ работает (SyntaxError: Unexpected string)
2. `page.addInitScript(INJECT_SCRIPT)` — не инжектится в текущую страницу (только future navigations)
3. Polling для `window.__recordAction` — не помогает
4. Оба метода вместе — НЕ работает
5. `console.debug` вместо `exposeFunction` — не помогает

**Ключевой инсайт:** Проблема была не в методе инжекции, а в том что скрипт молча умирал ожидая несуществующий binding. `addInitScript` и `addScriptTag` корректно инжектили скрипт, но его логика никогда не доходила до установки обработчиков.

**Что сделано (28.05.2026):**
1. ✅ Убран polling-цикл — `__setupRecorder()` вызывается сразу
2. ✅ Добавлен `page.exposeFunction('__recordAction', callback)` — прямой канал DOM→Node
3. ✅ `console.debug` остаётся как запасной канал (оба канала работают параллельно)
4. ✅ Добавлен CDP Runtime.evaluate как третий канал инжекции (резервный)
5. ✅ `exposeFunction` добавлен и для новых вкладок (onPageCreated)

---

## Проблема 2: execute-step не передаёт selector/url/key

**Симптом:** `POST /api/execute-step` с `{"action":"navigate","url":"..."}` — URL не передаётся в команду.

**Причина:** `parseStep()` не получает `body.url`, `body.selector`, `body.key` — эти поля не передаются.

**Статус:** ИСПРАВЛЕНО — добавлена передача body.url, body.selector, body.key в ws-server.ts.

---

## Проблема 3: PowerShell string interpolation

**Симптом:** `$pid` конфликтует с PowerShell PID. Строковые конкатенации ломаются.

**Причина:** PowerShell интерпретирует `$pid` как built-in переменную process ID.

**Решение:** Использовать другие имена переменных (`$profId`, `$sessId`).

---

## Проблема 4: Профиль не найден при record/start

**Симптом:** `400 Browser session not found` при запуске записи.

**Причина:** `profileId` переданный в record/start не совпадает с запущенным браузером (создаётся UUID при launch).

**Решение:** Всегда использовать `profileId` из ответа `/api/launch`.

---

## Гипотезы для решения Проблемы 1

### Гипотеза A: Добавить exposeFunction + убрать polling
Добавить `page.exposeFunction('__recordAction', callback)` и убрать polling-цикл из INJECT_SCRIPT, вызывать `__setupRecorder()` сразу.
**Статус:** ✅ РЕАЛИЗОВАНО (28.05.2026)

### Гипотеза B: Использовать addScriptTag
Вместо evaluate/addInitScript — создать `<script>` тег с src или inline content.
**Статус:** РАБОТАЕТ — оставлен как второй канал инжекции

### Гипотеза C: Использовать CDP напрямую
Через `page.context().newCDPSession(page)` — `Runtime.evaluate` с `awaitPromise: false`.
**Статус:** ✅ ДОБАВЛЕН как третий (резервный) канал инжекции

### Гипотеза D: Использовать page.route() для инжекта
Перехватить загрузку страницы и добавить скрипт в HTML response.
**Статус:** ЗАПАСНОЙ ВАРИАНТ — если три канала не сработают

### Гипотеза E: Упрощённый скрипт
Создать МИНИМАЛЬНЫЙ скрипт (только click + fill + input) без overlay, shadow DOM, HTTP interception.
**Статус:** НЕ ПОТРЕБОВАЛОСЬ — полный скрипт работает

### Гипотеза F: domtrace-playwright подход
Использовать `console.debug` для связи (как domtrace-playwright).
**Статус:** ✅ РАБОТАЕТ — оставлен как первый канал связи (всегда доступен)

### Гипотеза G: Playwright codegen подход
Изучить исходный код Playwright codegen.
**Статус:** ИЗУЧЕНО — Playwright использует приватное API `context.extendInjectedScript()`. Недоступно для внешнего использования.

## Текущий статус (29.05.2026, Iteration 8)

### Исправлено (29.05.2026)

| # | Проблема | Причина | Фикс |
|---|----------|---------|------|
| 12 | INJECT_SCRIPT SyntaxError: Missing catch after try | `try { __observer = new MutationObserver(...)` блок (recorder.ts:444) не имел `catch` или `finally`, вызывая parse-time SyntaxError и полный отказ скрипта | Добавлен `} catch(e) {}` после `__observer.observe(...)` (recorder.ts:531) |
| 13 | CAPTCHA детекция не срабатывает в browser-agent | `setTimeout(__checkCaptcha, 1500)` без try/catch — ошибка внутри `__checkCaptcha` молча глоталась; также не было try/catch для MutationObserver | Тело `__checkCaptcha` обёрнуто в try/catch; setTimeout обёрнут в function() с try/catch; MutationObserver registration обёрнут в try/catch |
| 14 | el.getAttribute is not a function (js_error) | `__getSelectorText()` вызывает `el.getAttribute()` на не-DOM-элементах (textNode, document) | Не критично — ошибки логируются через ERROR_TRACKER_HELPER и не блокируют выполнение. Инжект-скрипт работает, несмотря на эти предупреждения |

### Работает ✅
- Всё из Iteration 7 +
- **CAPTCHA детекция**: ReCaptcha v2, Turnstile, hCaptcha, generic — все 4 типа детектируются
- **Full pipeline**: captcha_detected → console.debug → page.on('console') → pushAction → flush → recorder-service → SQLite
- captcha-test.html (первая навигация): 6 captcha_detected
- Главная → captcha-test.html (вторая навигация): 27 total actions, 6 captcha_detected

### Требует верификации 🔄
- Shadow DOM на реальных Web Components (open mode)
- Cookie consent на реальных EU-сайтах
- Jira env на живой Jira инстанции
- CAPTCHA на реальных сайтах (ReCaptcha v3 не тестировалась)

### Что нужно сделать
1. **Приоритет 3:** Media events (play, pause, seeked)
2. **Приоритет 4:** Shadow DOM клики через inject script (на реальном сайте)

### Работает ✅
- Все из предыдущей версии +
- **Iframe bridge (executor level)**: `resolveFrame()` — 5 стратегий поиска iframe (имя, URL, селектор, итерация). Работает для same-origin и cross-origin.
- **Iframe injection (same-origin)**: `injectIntoFrame()` + `injectIntoAllFrames()` — инжект скрипта в iframe через addScriptTag + evaluate. Запуск при framenavigated + при старте.
- **Iframe postMessage bridge**: перехват `__record` в iframe, установка frameUrl/frameName/iframeAction, postMessage в top frame, обработка message listener с contentWindow matching.
- **Frame metadata в записи**: `frameName`, `frameUrl`, `frameSelector`, `iframeAction` — все 18 action types в executor.ts.
- **DB schema**: 13 extended колонок (input_type — iframe_action) через ALTER TABLE миграции.
- **E2E cross-origin iframe**: click + fill + select на порту 9091 — все 5 операций passed с frameName.

### Требует верификации 🔄
- Shadow DOM на реальных Web Components (open mode)
- Cookie consent на реальных EU-сайтах
- Jira env на живой Jira инстанции

### Найденные баги (исправлены 29.05.2026, Iteration 7)

| # | Проблема | Причина | Фикс |
|---|----------|---------|------|
| 7 | Frame metadata не передавался в ws-server | ParsedCommand не имел frameName/frameUrl/frameSelector | Добавлены поля в интерфейс + forwarding |
| 8 | DB INSERT: 34 values for 35 columns | VALUES содержал 34 `?` при 35 колонках | Добавлен 35-й `?` |
| 9 | Executor recordStep не включал frameName | Все `recordStep()` передавали только selector/value, без frameMeta | Добавлен `...frameMeta` во все recordStep |
| 10 | Inject script не инжектился в iframe | addInitScript + addScriptTag работают только для main frame | `injectIntoFrame()` на framenavigated + `injectIntoAllFrames()` при старте |
| 11 | Iframe action без frameName | __record в iframe не устанавливал frameUrl/frameName/iframeAction | Wrapper в iframe bridge: data.frameUrl = location.href и т.д. |

### Все E2E тесты пройдены (5/5 passed)
- Same-origin iframe: click #iframeBtn, fill #iframeInput
- Cross-origin iframe (localhost:9091): click #xoBtn, fill #xoInput, select #xoSelect=B

### Что нужно сделать
1. **Приоритет 2:** CAPTCHA детекция (ReCaptcha, Turnstile)
2. **Приоритет 3:** Media events (play, pause, seeked)
3. **Приоритет 4:** Shadow DOM клики через inject script (на реальном сайте)
