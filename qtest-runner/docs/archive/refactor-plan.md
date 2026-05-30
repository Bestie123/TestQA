# План рефакторинга qtest-runner — до уровня Playwright+

> **Source:** `archive/REFACTOR_PLAN.md`
> **Цель:** Довести проект до уровня Playwright Codegen или выше по всем 146 пунктам GAP-анализа
> **Метод:** Итеративные улучшения с верификацией на интерактивных сайтах
> **Принцип:** Сначала простые решения, потом сложные. Не зацикливаться.
>
> **Статус на 30.05.2026:** Все P0-P2 пункты реализованы (закрыты итерациями 6-9).
> Обновлённая документация: см. [vitepress-сайт](/).

## Сводка текущего состояния

| Метрика | Значение |
|---------|----------|
| Реализовано (✅) | ~140 / 146 |
| Частично (🔶) | 0 / 146 |
| Не реализовано (❌) | ~6 / 146 |
| Сервисов | 8 |
| MCP инструментов | 12 (mcp-browser + mcp-qtest-debug) |
| Inject-скрипт | ~700+ строк, 3 канала инжекции |

## Приоритеты (по Impact)

### P0 — Критичные для Jira/Zephyr тестирования
- [x] iframe: same-origin + cross-origin postMessage bridge
- [x] Shadow DOM: composedPath() для корректных селекторов
- [x] SPA Navigation: monkey-patch pushState/replaceState/popstate
- [x] Assertion Engine: генерация ожидаемого результата (assertText, assertVisible, assertValue, assertChecked, assertUrl)
- [x] Error Tracking: window.onerror + unhandledrejection
- [x] Jira/Zephyr специфика: AUI, Froala, transition screens, plugin iframe'ы
- [x] Cookie Consent авто-детекция

### P1 — Важные
- [x] touch/wheel события
- [x] CSS Animation tracking (transitionend/animationend)
- [x] File upload (input type="file")
- [x] Multi-window (window.open interception)
- [x] contentEditable rich text
- [x] `<dialog>` element tracking
- [x] Page lifecycle (visibilitychange)
- [x] Assertions: assertText, assertValue, assertChecked, assertVisible

### P2 — Желательные
- [x] Popover API
- [x] IME Composition
- [x] ResizeObserver / IntersectionObserver
- [x] Canvas click recording
- [ ] Video recording (playwright-screen-recorder) — _не реализовано_
- [x] Selection tracking

## Чеклист реализации

### Iteration 6 — Core Recording Improvements

#### 6.1 iframe Support
- [x] **6.1.1** Same-origin iframe: рекурсивный обход frames в inject-скрипте
- [x] **6.1.2** Cross-origin iframe: postMessage bridge
- [x] **6.1.3** Генерация frame-селекторов (frame[name="..."] >> selector)
- [x] **6.1.4** Nested iframes: рекурсивный frame selector path
- [x] **6.1.5** Тестирование на Jira/Zephyr plugin iframe'ах

#### 6.2 Shadow DOM composedPath()
- [x] **6.2.1** Замена event.target на event.composedPath()[0]
- [x] **6.2.2** deepActiveElement() для focus
- [x] **6.2.3** Slot piercing для селекторов
- [x] **6.2.4** Тестирование на Web Components сайтах

#### 6.3 SPA Navigation Monkey-patch
- [x] **6.3.1** history.pushState monkey-patch
- [x] **6.3.2** history.replaceState monkey-patch
- [x] **6.3.3** popstate event listener
- [x] **6.3.4** hashchange event listener
- [x] **6.3.5** Удаление URL polling (замена на мгновенные события)

#### 6.4 Error Tracking
- [x] **6.4.1** window.onerror — глобальные JS ошибки
- [x] **6.4.2** unhandledrejection — Promise ошибки
- [x] **6.4.3** Resource load error (404 для скриптов/стилей)
- [x] **6.4.4** Stack trace capture
- [x] **6.4.5** Playwright-level: page.on('pageerror')

#### 6.5 Assertion Engine
- [x] **6.5.1** assertText — проверка текста элемента
- [x] **6.5.2** assertValue — проверка значения поля
- [x] **6.5.3** assertChecked — чекбокс checked/unchecked
- [x] **6.5.4** assertVisible — видимость элемента
- [x] **6.5.5** assertURL — проверка URL после навигации
- [x] **6.5.6** Генерация русского описания для каждого assert

#### 6.6 Jira/Zephyr Specific Detectors
- [x] **6.6.1** AUI dropdown детекция (aui-select, aui-dropdown2)
- [x] **6.6.2** Froala Editor детекция (contenteditable + froala)
- [x] **6.6.3** Jira transition screen детекция
- [x] **6.6.4** Zephyr Scale iframe детекция
- [x] **6.6.5** Jira auto-complete (users, projects, keys)
- [x] **6.6.6** Jira Agile board drag детекция

#### 6.7 Cookie Consent Auto-detect
- [x] **6.7.1** OneTrust детекция (.ot-sdk-container)
- [x] **6.7.2** CookieYes детекция (.cky-consent-container)
- [x] **6.7.3** Cookiebot детекция (#cookiebanner)
- [x] **6.7.4** Generic cookie banner детекция
- [x] **6.7.5** Auto-accept действие

### Iteration 7 — Advanced Interactions

#### 7.1 Touch / Wheel
- [x] **7.1.1** touchstart / touchend события
- [x] **7.1.2** touchmove запись (swipe, pinch)
- [x] **7.1.3** wheel (колёсико мыши) с deltaX/deltaY
- [x] **7.1.4** Тестирование на мобильной версии Jira

#### 7.2 CSS Animation Tracking
- [x] **7.2.1** transitionend — CSS transition завершена
- [x] **7.2.2** animationend — CSS animation завершена
- [x] **7.2.3** transitionstart / animationstart
- [x] **7.2.4** Тестирование на Jira переходах (анимированы)

#### 7.3 File Upload
- [x] **7.3.1** input type="file" change event
- [x] **7.3.2** File name capture
- [x] **7.3.3** Playwright fileChooser listener

#### 7.4 Multi-window / Popup
- [x] **7.4.1** window.open() monkey-patch
- [x] **7.4.2** context.on('page') — уже есть
- [x] **7.4.3** beforeunload dialog
- [x] **7.4.4** window.close() tracking

#### 7.5 contentEditable / Rich Text
- [x] **7.5.1** Froala Editor: insertHTML, format
- [x] **7.5.2** contentEditable: innerText capture
- [x] **7.5.3** beforeinput event (insertText, formatContent)

#### 7.6 `<dialog>` Element
- [x] **7.6.1** dialog open/close tracking
- [x] **7.6.2** cancel (Escape) tracking
- [x] **7.6.3** close event

#### 7.7 Page Lifecycle
- [x] **7.7.1** visibilitychange (вкладка скрыта/показана)
- [x] **7.7.2** pagehide / pageshow (bfcache)
- [x] **7.7.3** freeze / resume

### Iteration 8 — Infrastructure & Refactoring

#### 8.1 Auto-wait стратегии
- [x] **8.1.1** Playwright auto-wait: waitForSelector перед click/fill
- [x] **8.1.2** Retry логика: повтор при StaleElementReferenceError
- [x] **8.1.3** Timeout конфигурация
- [x] **8.1.4** Smart polling: IntersectionObserver-based ожидание

#### 8.2 Executor Improvements
- [x] **8.2.1** Новые типы: hover, dragTo, fileChooser, wheel, touch
- [x] **8.2.2** Assertion execution: verifyText → toHaveText
- [x] **8.2.3** Multi-tab execution
- [x] **8.2.4** Скриншоты при каждом шаге

#### 8.3 MCP Tools Improvements
- [x] **8.3.1** Новые инструменты для assert
- [x] **8.3.2** iframe-aware inspect
- [x] **8.3.3** Multi-session management

#### 8.4 Action Parser Improvements
- [x] **8.4.1** Новые русские паттерны (проверить, убедиться, дождаться)
- [x] **8.4.2** Assertion парсинг
- [x] **8.4.3** Комбинированные команды

#### 8.5 convertToSteps Improvements
- [x] **8.5.1** Assertion шаги
- [x] **8.5.2** iframe шаги
- [x] **8.5.3** Error шаги
- [x] **8.5.4** Touch/wheel шаги

### Iteration 9 — Testing & Verification

#### 9.1 Тестовые сайты
- [x] **9.1.1** iframe тестовый сайт (same-origin + cross-origin)
- [x] **9.1.2** Shadow DOM тестовый сайт (Web Components)
- [x] **9.1.3** SPA тестовый сайт (React Router)
- [x] **9.1.4** Carousel тестовый сайт (Swiper.js)
- [x] **9.1.5** Jira/Zephyr эмулятор (AUI, Froala)

#### 9.2 E2E тесты
- [x] **9.2.1** Запись на iframe сайтах
- [x] **9.2.2** Запись на Shadow DOM сайтах
- [x] **9.2.3** Запись SPA навигации
- [x] **9.2.4** Assertion верификация
- [x] **9.2.5** Error tracking верификация

## Структура файлов после рефакторинга

```
packages/browser-agent/src/
  recorder.ts           # INJECT_SCRIPT + Playwright-level recording
  recorder-helpers.ts   # Вспомогательные функции (селекторы, сериализация)
  iframe-handler.ts     # iframe рекурсивный обход
  shadow-dom-handler.ts # Shadow DOM composedPath + deepActiveElement
  spa-navigator.ts      # pushState/replaceState monkey-patch
  error-tracker.ts      # onerror + unhandledrejection
  assertion-engine.ts   # Генерация ожидаемого результата
  jira-detector.ts      # Jira/Zephyr специфичные детекторы
  cookie-consent.ts     # Cookie banner авто-детекция
  executor.ts           # Выполнение шагов (остаётся)
  action-parser.ts      # Парсинг шагов (остаётся)
  browser-manager.ts    # Управление браузером (остаётся)
  ws-server.ts          # WebSocket сервер (остаётся)
```

## Поток верификации

```
1. Изменить код → 2. npm run build (проверить компиляцию)
3. start.bat (перезапустить сервисы) → 4. Записать действия на тестовом сайте
5. Проверить БД (qtest_check_db) → 6. Проверить шаги (qtest_get_actions testcase)
7. Если ОК → фиксация. Если НЕТ → откат + новая попытка (макс 3)
```

## Документация после рефакторинга

> Все пункты выполнены 30.05.2026. Документация консолидирована в VitePress-сайт (`qtest-runner/docs/`).

### Обновлено:
- [x] ARCHITECTURE.md — обновлено (новые модули, порты)
- [x] AGENTS.md — перекрёстные ссылки на VitePress-сайт
- [x] USAGE.md — обновлено (новые функции)
- [x] GAP_ANALYSIS.md — статусы обновлены
- [x] STATUS.md — Iteration 6, 7, 8, 9

### Создано:
- [x] TESTING.md — руководство по тестированию
- [x] ASSERTIONS.md — как работают assertion'ы
