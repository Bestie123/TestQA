# GAP-анализ: Запись взаимодействия пользователя с браузером

> Проект: qtest-runner (browser-agent + recorder-service)
> Цель: запись действий пользователя для генерации тест-кейсов Zephyr Scale
> Дата: 2026-05-28
> Источник данных по Playwright: https://github.com/microsoft/playwright (packages/injected/src/recorder/recorder.ts, packages/playwright-core/src/server/recorder.ts)

---

## Условные обозначения

| Статус | QR (qtest-runner) | PW (Playwright Codegen) |
|--------|-------------------|------------------------|
| ✅ | Реализовано | Реализовано |
| 🔶 | Частично | Частично |
| ❌ | Не реализовано | Не реализовано |
| 🟡 | — | Есть на уровне API, но CG не генерирует |

---

## Раздел 1. Прямые действия пользователя

### 1. Базовые взаимодействия (User Actions)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 1.1 | click (левый клик) | ✅ | ✅ | P0 | QR: модификаторы есть. PW: через PerformAction |
| 1.2 | dblclick (двойной клик) | ✅ | ✅ | P1 | QR: есть. PW: clickCount=2 |
| 1.3 | contextmenu (правый клик) | ✅ | 🔶 | P1 | QR: есть с x/y. PW: только в JsonRecordActionTool |
| 1.4 | mousedown / mouseup | ❌ | ❌ | P2 | Оба: не генерируют отдельных действий |
| 1.5 | mousemove | ❌ | 🔶 | P2 | PW: используется для hover highlight, но не action |
| 1.6 | mouseover / mouseout | ❌ | ❌ | P2 | Оба: не записываются |
| 1.7 | fill (ввод текста) | ✅ | ✅ | P0 | QR: дебаунс 500ms. PW: через input event |
| 1.8 | select (выбор из списка) | ✅ | ✅ | P0 | |
| 1.9 | check / uncheck (чекбокс, радио) | ✅ | ✅ | P0 | QR: отдельный тип. PW: через click/keydown |
| 1.10 | focus / blur | 🔶 | ❌ | P1 | QR: focusin есть, blur нет. PW: focus без генерации action |
| 1.11 | keydown / keyup | 🔶 | 🔶 | P0 | QR: keydown, нет keyup. PW: keydown → press, keyup consumed |
| 1.12 | submit (отправка формы) | ✅ | ❌ | P0 | PW: форма отправляется через click на кнопке |
| 1.13 | reset (сброс формы) | ❌ | ❌ | P2 | |
| 1.14 | scroll (прокрутка) | ✅ | ❌ | P0 | QR: дебаунс 800ms. PW: consumed, без генерации action |
| 1.15 | resize (изменение окна) | ✅ | ❌ | P1 | PW: не подписан |
| 1.16 | hover (наведение) | ✅ | ❌ | P1 | PW: только из контекстного меню, не авто-запись |

---

### 2. Touch / Pointer / Wheel

| # | Событие | QR | PW | Приоритет | Примечание |
|------|---------|-----|-----|-----------|------------|
| 2.1 | touchstart | ✅ | ❌ | P0 | QR: реализовано (28.05.2026) |
| 2.2 | touchend | ✅ | ❌ | P0 | QR: реализовано (x, y coordinates) |
| 2.3 | touchmove | ✅ | ❌ | P0 | QR: реализовано |
| 2.4 | touchcancel | ❌ | ❌ | P2 | |
| 2.5 | pointerdown | ❌ | 🔶 | P1 | PW: подписан, consumed, без генерации action |
| 2.6 | pointerup | ❌ | 🔶 | P1 | PW: подписан, consumed, без генерации action |
| 2.7 | pointermove | ❌ | ❌ | P2 | |
| 2.8 | pointercancel | ❌ | ❌ | P2 | |
| 2.9 | wheel (колёсико) | ✅ | ❌ | P0 | QR: реализовано (deltaX/deltaY) |
| 2.10 | gesture (pinch, rotate) | ❌ | ❌ | P2 | |

---

### 3. Drag & Drop

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 3.1 | dragstart | ✅ | ❌ | P1 | PW: подписан, consumed, без генерации action |
| 3.2 | dragend | ✅ | ❌ | P1 | QR: есть |
| 3.3 | drop | ✅ | ❌ | P1 | QR: есть. PW: нет dragTo() авто-записи |
| 3.4 | dragover | ❌ | ❌ | P2 | |
| 3.5 | dragenter | ❌ | ❌ | P2 | |
| 3.6 | dragleave | ❌ | ❌ | P2 | |
| 3.7 | File drag-and-drop | ❌ | ❌ | P1 | |

---

### 4. iframe

| # | Событие | QR | PW | Приоритет | Примечание |
|------|---------|-----|-----|-----------|------------|
| 4.1 | Same-origin iframe — события | ✅ | ✅ | P0 | QR: __getFrameSelector + __getFramePath (реализовано 28.05.2026) |
| 4.2 | Cross-origin iframe — postMessage bridge | ❌ | ❌ | P0 | Security: недоступно для inject-скрипта |
| 4.3 | iframe load / error | ❌ | 🔶 | P1 | PW: только main frame navigation |
| 4.4 | Nested iframes | ✅ | ✅ | P1 | QR: рекурсивный __getFramePath до корневого окна |

---

### 5. Shadow DOM (Web Components)

| # | Событие | QR | PW | Приоритет | Примечание |
|------|---------|-----|-----|-----------|------------|
| 5.1 | Shadow root сканирование | ✅ | ✅ | P0 | Оба: MutationObserver |
| 5.2 | Events внутри shadow root | ✅ | ✅ | P0 | QR: __deepEventTarget(event) через composedPath() |
| 5.3 | composedPath() для селекторов | ✅ | ✅ | P0 | QR: __deepEventTarget + __deepActiveElement (реализовано 28.05.2026) |
| 5.4 | `<slot>` change events | ❌ | ❌ | P1 | Оба: не реализовано |
| 5.5 | Declarative Shadow DOM | ❌ | ✅ | P1 | PW: не требует специальной обработки |

---

### 6. SPA Навигация (History API)

| # | Событие | QR | PW | Приоритет | Примечание |
|------|---------|-----|-----|-----------|------------|
| 6.1 | URL polling (setInterval) | ❌ | ❌ | P1 | QR: удалён (заменён на monkey-patch) |
| 6.2 | history.pushState() monkey-patch | ✅ | ✅ | P0 | QR: SPA_NAV_HELPER (реализовано 28.05.2026) |
| 6.3 | history.replaceState() monkey-patch | ✅ | ✅ | P0 | QR: SPA_NAV_HELPER |
| 6.4 | popstate (кнопки Назад/Вперёд) | ✅ | ✅ | P0 | QR: addEventListener('popstate') |
| 6.5 | hashchange (якоря) | ✅ | ✅ | P0 | QR: addEventListener('hashchange') |

---

### 7. Формы (детали)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 7.1 | submit | ✅ | ❌ | P0 | PW: не подписан |
| 7.2 | reset | ❌ | ❌ | P2 | |
| 7.3 | invalid (валидация) | ❌ | ❌ | P1 | |
| 7.4 | input type="file" (загрузка файла) | ✅ | 🔶 | P0 | QR: FILE_UPLOAD_HELPER (change event + file names) |
| 7.5 | input type="color" | ❌ | ❌ | P2 | PW: mouse events игнорируются |
| 7.6 | input type="range" (слайдер) | ❌ | ✅ | P2 | PW: через fill + input event |
| 7.7 | input type="date/datetime-local" | ❌ | ❌ | P1 | PW: mouse events игнорируются |
| 7.8 | `<datalist>` автодополнение | ❌ | ❌ | P2 | |
| 7.9 | autofill / autocomplete | ❌ | ❌ | P1 | |
| 7.10 | contentEditable (rich text) | 🔶 | ✅ | P0 | PW: через fill + innerText. QR: захват есть |

---

### 8. Multi-window / Popup

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 8.1 | window.open() interception | ❌ | ✅ | P0 | PW: popup signal |
| 8.2 | context.on('page') (Playwright) | ✅ | ✅ | P0 | |
| 8.3 | opener reference | ❌ | ❌ | P1 | |
| 8.4 | beforeunload (уход со страницы) | ❌ | ✅ | P1 | PW: dialog signal |
| 8.5 | window.close() | ❌ | ✅ | P2 | PW: closePage action |

---

### 9. Media (Video / Audio)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 9.1 | play | ❌ | ❌ | P1 | |
| 9.2 | pause | ❌ | ❌ | P1 | |
| 9.3 | seeked (перемотка) | ❌ | ❌ | P1 | |
| 9.4 | volumechange | ❌ | ❌ | P2 | |
| 9.5 | ended | ❌ | ❌ | P1 | |
| 9.6 | fullscreenchange (видео) | ❌ | ❌ | P1 | |
| 9.7 | loadedmetadata / loadeddata | ❌ | ❌ | P2 | |
| 9.8 | error (медиа не загрузилось) | ❌ | ❌ | P2 | |

---

### 10. Карусель / Слайдер

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 10.1 | transitionend — анимация завершена | ✅ | ❌ | P0 | QR: ANIMATION_HELPER (propertyName, elapsedTime) |
| 10.2 | animationend — CSS-анимация завершена | ✅ | ❌ | P0 | QR: ANIMATION_HELPER (animationName, elapsedTime) |
| 10.3 | Active slide index | ❌ | ❌ | P1 | |
| 10.4 | slide.bs.carousel (Bootstrap) | ❌ | ❌ | P1 | |
| 10.5 | swiped-left/swiped-right (Swiper.js) | ❌ | ❌ | P1 | |

---

### 11. Clipboard / Буфер обмена

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 11.1 | copy | ✅ | ❌ | P1 | PW: явно игнорируется |
| 11.2 | paste | ✅ | ❌ | P1 | PW: Ctrl+V явно исключён из keydown |
| 11.3 | cut | ❌ | ❌ | P2 | |

---

### 12. Selection / Выделение текста

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 12.1 | selectionchange | ❌ | ❌ | P2 | |
| 12.2 | selectstart / selectend | ❌ | ❌ | P2 | |

---

### 13. Fullscreen / Viewport

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 13.1 | fullscreenchange | ❌ | ❌ | P1 | |
| 13.2 | fullscreenerror | ❌ | ❌ | P2 | |
| 13.3 | orientationchange (portrait/landscape) | ❌ | ❌ | P2 | |

---

### 14. `<details>` / `<summary>`

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 14.1 | toggle (открытие/закрытие) | ✅ | ❌ | P1 | QR: LIFECYCLE_HELPER (toggle на details) |
| 14.2 | open attribute change | ✅ | ❌ | P1 | QR: LIFECYCLE_HELPER (MutationObserver) |

---

### 15. Composition Events (IME — CJK)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 15.1 | compositionstart | ❌ | ❌ | P2 | PW: IME key events игнорируются |
| 15.2 | compositionupdate | ❌ | ❌ | P2 | |
| 15.3 | compositionend | ❌ | ❌ | P2 | |

---

### 16. Dialog Element (HTML native)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 16.1 | `<dialog>` open/close | ✅ | ❌ | P1 | QR: LIFECYCLE_HELPER (MutationObserver на open) |
| 16.2 | cancel (Escape) | ❌ | ❌ | P1 | |
| 16.3 | close | ❌ | ❌ | P1 | |

---

### 17. Alert / Confirm / Prompt

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 17.1 | alert | ✅ | ✅ | P0 | PW: dialog signal |
| 17.2 | confirm | ✅ | ✅ | P0 | |
| 17.3 | prompt | ❌ | ✅ | P1 | PW: dialog signal |
| 17.4 | page.on('dialog') (Playwright) | ✅ | ✅ | P0 | |

---

### 18. Popover API

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 18.1 | togglepopover | ❌ | ❌ | P1 | |
| 18.2 | beforetoggle | ❌ | ❌ | P2 | |
| 18.3 | hidePopover / showPopover | ❌ | ❌ | P2 | |

---

### 19. EditContext / Rich Text

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 19.1 | EditContext (textupdate) | ❌ | ❌ | P2 | |
| 19.2 | beforeinput (insertText, formatContent) | ❌ | ❌ | P2 | |

---

## Раздел 2. Реакция браузера на действия пользователя

### 20. Error Tracking (ошибки JS)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 20.1 | window.onerror | ✅ | ❌ | P0 | QR: ERROR_TRACKER_HELPER (реализовано 28.05.2026) |
| 20.2 | unhandledrejection (Promise) | ✅ | ❌ | P0 | QR: ERROR_TRACKER_HELPER (с stack trace) |
| 20.3 | Resource load error (404) | ✅ | ❌ | P1 | QR: PerformanceObserver для resource errors |
| 20.4 | Stack trace capture | ✅ | ❌ | P1 | QR: Error.stack + event.error.stack |

---

### 21. DOM Mutation (изменения в DOM)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 21.1 | childList (элемент появился/исчез) | ✅ | ❌ | P0 | PW: только для отслеживания hoveredElement |
| 21.2 | attributes (атрибуты) | ✅ | ❌ | P0 | |
| 21.3 | characterData (текст) | ✅ | ❌ | P0 | |
| 21.4 | ResizeObserver (изменение размера) | ❌ | ❌ | P1 | |
| 21.5 | IntersectionObserver (видимость) | ❌ | ❌ | P0 | |

---

### 22. CSS / Animation (браузерная анимация)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 22.1 | transitionstart | ✅ | ❌ | P1 | QR: ANIMATION_HELPER |
| 22.2 | transitionend | ✅ | ❌ | P0 | QR: ANIMATION_HELPER |
| 22.3 | transitioncancel | ❌ | ❌ | P2 | |
| 22.4 | animationstart | ✅ | ❌ | P1 | QR: ANIMATION_HELPER |
| 22.5 | animationend | ✅ | ❌ | P0 | QR: ANIMATION_HELPER |
| 22.6 | animationcancel / animationiteration | ❌ | ❌ | P2 | |

---

### 23. Page Lifecycle

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 23.1 | visibilitychange | ✅ | ❌ | P1 | QR: LIFECYCLE_HELPER (visible/hidden) |
| 23.2 | freeze / resume | ❌ | ❌ | P1 | |
| 23.3 | pagehide / pageshow (bfcache) | ✅ | ❌ | P1 | QR: LIFECYCLE_HELPER |

---

### 24. Navigation API (современная SPA-навигация)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 24.1 | navigation.navigate() interception | ❌ | ❌ | P1 | PW: не реализовано (использует framenavigated) |
| 24.2 | navigate event | ❌ | ❌ | P1 | |
| 24.3 | navigatesuccess / navigateerror | ❌ | ❌ | P2 | |
| 24.4 | currententrychange | ❌ | ❌ | P2 | |

---

## Раздел 3. Специфика целевой платформы (Jira / Zephyr Scale)

### 25. Jira / Zephyr Scale — специфичные элементы

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 25.1 | Jira issue page DOM (key, status, fields) | ✅ | ❌ | P0 | QR: JIRA_DETECTOR_HELPER — env info |
| 25.2 | Froala Editor (Jira rich-text) | ✅ | ❌ | P0 | QR: Froala v4.1.4 детекция |
| 25.3 | Jira transition screen (поля перехода) | ✅ | ❌ | P0 | QR: Детекция transition screen |
| 25.4 | Jira auto-complete (users, projects, keys) | ✅ | ❌ | P0 | QR: Детекция auto-complete |
| 25.5 | Jira Agile board (drag карточек) | ❌ | ❌ | P1 | |
| 25.6 | Zephyr Scale DOM (test case, test cycle) | ✅ | ❌ | P0 | QR: Zephyr детекция |
| 25.7 | Jira Plugin iframes (Zephyr, Structure, Insight) | ✅ | ❌ | P0 | QR: Plugin iframe детекция |
| 25.8 | AUI (Atlassian UI) — dropdowns, dialogs, flags | ✅ | ❌ | P0 | QR: AUI детекция |
| 25.9 | Jira workflow transition properties | ❌ | ❌ | P1 | |

---

### 26. CAPTCHA / Бот-детекция (блокировщики записи)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 26.1 | ReCaptcha (g-recaptcha) | ❌ | ❌ | P0 | |
| 26.2 | hCaptcha | ❌ | ❌ | P0 | |
| 26.3 | Turnstile (Cloudflare) | ❌ | ❌ | P0 | |
| 26.4 | CAPTCHA iframe по src-паттерну | ❌ | ❌ | P1 | |

---

### 27. Cookie Consent / GDPR (баннеры согласия)

| # | Событие | QR | PW | Приоритет | Примечание |
|---|---------|-----|-----|-----------|------------|
| 27.1 | Cookie banner DOM-детекция | ✅ | ❌ | P0 | QR: COOKIE_CONSENT_HELPER — querySelector |
| 27.2 | OneTrust / CookieYes / Cookiebot | ✅ | ❌ | P1 | QR: OneTrust (#onetrust-banner-sdk), CookieYes (.cky-consent-container), Cookiebot (#cookiebanner) |
| 27.3 | Авто-акцепт cookie | ❌ | ❌ | P1 | |
| 27.4 | Cookie bar dismiss (Accept / Reject / Settings) | ❌ | ❌ | P1 | |

---

## Раздел 4. Assertions (PW имеет, qtest-runner — нет)

### 28. Assertions (встроенные действия PW Codegen)

| # | Тип assert | QR | PW | Приоритет | Примечание |
|---|-----------|-----|-----|-----------|------------|
| 28.1 | assertText — проверка текста элемента | ✅ | ✅ | P0 | QR: assertText (action-parser + executor + convertToSteps) |
| 28.2 | assertValue — проверка значения поля | ✅ | ✅ | P0 | QR: assertValue (locator.inputValue()) |
| 28.3 | assertChecked — чекбокс checked/unchecked | ✅ | ✅ | P0 | QR: assertChecked (locator.isChecked()) |
| 28.4 | assertVisible — видимость элемента | ✅ | ✅ | P0 | QR: assertVisible (locator.waitForSelector + isVisible) |
| 28.5 | assertSnapshot — aria snapshot | ❌ | 🔶 | P1 | PW: записывается, не исполняется |
| 28.6 | assert URL (toHaveURL) | ✅ | ✅ | P0 | QR: assertUrl (page.url()) |

---

## Сводка

| Раздел | Всего | QR ✅ | QR 🔶 | QR ❌ | PW ✅ | PW 🔶 | PW ❌ |
|--------|-------|-------|--------|--------|-------|--------|--------|
| 1. Базовые взаимодействия | 16 | 10 | 2 | 4 | 8 | 3 | 5 |
| 2. Touch / Pointer / Wheel | 10 | 4 | 0 | 6 | 0 | 2 | 8 |
| 3. Drag & Drop | 7 | 3 | 0 | 4 | 0 | 0 | 7 |
| 4. iframe | 4 | 2 | 1 | 1 | 2 | 1 | 1 |
| 5. Shadow DOM | 5 | 3 | 1 | 1 | 4 | 0 | 1 |
| 6. SPA Навигация | 5 | 4 | 0 | 1 | 5 | 0 | 0 |
| 7. Формы (детали) | 10 | 2 | 1 | 7 | 2 | 1 | 7 |
| 8. Multi-window / Popup | 5 | 1 | 0 | 4 | 4 | 0 | 1 |
| 9. Media (Video / Audio) | 8 | 0 | 0 | 8 | 0 | 0 | 8 |
| 10. Карусель / Слайдер | 5 | 2 | 0 | 3 | 0 | 0 | 5 |
| 11. Clipboard | 3 | 2 | 0 | 1 | 0 | 0 | 3 |
| 12. Selection | 2 | 0 | 0 | 2 | 0 | 0 | 2 |
| 13. Fullscreen / Viewport | 3 | 0 | 0 | 3 | 0 | 0 | 3 |
| 14. Details / Summary | 2 | 2 | 0 | 0 | 0 | 0 | 2 |
| 15. Composition (IME) | 3 | 0 | 0 | 3 | 0 | 0 | 3 |
| 16. Dialog Element | 3 | 1 | 0 | 2 | 0 | 0 | 3 |
| 17. Alert / Confirm / Prompt | 4 | 3 | 0 | 1 | 4 | 0 | 0 |
| 18. Popover API | 3 | 0 | 0 | 3 | 0 | 0 | 3 |
| 19. EditContext / Rich Text | 2 | 0 | 0 | 2 | 0 | 0 | 2 |
| 20. Error Tracking | 4 | 4 | 0 | 0 | 0 | 0 | 4 |
| 21. DOM Mutation | 5 | 3 | 0 | 2 | 0 | 0 | 5 |
| 22. CSS / Animation | 6 | 4 | 0 | 2 | 0 | 0 | 6 |
| 23. Page Lifecycle | 3 | 2 | 0 | 1 | 0 | 0 | 3 |
| 24. Navigation API | 4 | 0 | 0 | 4 | 0 | 0 | 4 |
| 25. Jira / Zephyr Scale | 9 | 7 | 0 | 2 | 0 | 0 | 9 |
| 26. CAPTCHA / Bot Detection | 4 | 0 | 0 | 4 | 0 | 0 | 4 |
| 27. Cookie Consent / GDPR | 4 | 2 | 0 | 2 | 0 | 0 | 4 |
| 28. Assertions (PW) | 6 | 5 | 0 | 1 | 5 | 1 | 0 |
| **ИТОГО** | **146** | **64** | **5** | **77** | **34** | **8** | **104** |

---

## Ключевые выводы

### Что Playwright Codegen умеет лучше qtest-runner (источник: исходный код PW)

| Возможность | Детали |
|------------|--------|
| **iframe** | Рекурсивный frame selector path + generateFrameSelector() |
| **Shadow DOM** | composedPath() + deepActiveElement() для прохода через shadow boundary |
| **Селeкторы** | getByRole, getByLabel, getByText, getByTestId — иерархия приоритетов |
| **PerformAction** | Клики/нажатия исполняются через Playwright API (надёжно) |
| **Navigation** | framenavigated signal без polling |
| **Assertions** | assertText, assertValue, assertChecked, assertVisible |
| **Auto-wait** | Встроенный механизм ожидания готовности элемента |
| **Canvas clicks** | Запись offsetX/Y для кликов по canvas |

### Что qtest-runner делает, чего нет в Playwright Codegen

| Возможность | Детали |
|------------|--------|
| **DOM Mutation запись** | element_appear, element_remove, attr_change, text_change |
| **Scroll запись** | scrollY + процент прокрутки |
| **Resize запись** | изменение размера окна |
| **Clipboard** | copy/paste события |
| **Hover** | mouseenter/mouseleave для интерактивных элементов |
| **Submit** | захват отправки формы |

### Что НЕ реализовано ни в одном

| Категория | Что именно |
|-----------|-----------|
| **Jira/Zephyr специфика** | AUI, Froala Editor, transition screens, agile board drag |
| **Error Tracking** | window.onerror, unhandledrejection |
| **Touch/Wheel** | touchstart/touchend, wheel (колёсико) |
| **Cookie Consent/GDPR** | OneTrust, CookieYes авто-акцепт |
| **CAPTCHA** | ReCaptcha/Turnstile детекция |
| **CSS Animation** | transitionend, animationend |
| **Carousel** | slide.bs.carousel, swiped-left/right |
| **Media events** | play, pause, seeked |
| **ResizeObserver/IntersectionObserver** | видимость и размер элементов |
| **Page Lifecycle** | visibilitychange, freeze/resume |
| **IME Composition** | CJK ввод |

---

## Приоритет для qtest-runner

| # | Что | QR | PW | Причина |
|---|-----|-----|-----|---------|
| 1 | **Jira/Zephyr специфика** (AUI, Froala, transition, plugin iframe'ы) | ❌ | ❌ | Без этого qtest-runner бесполезен для целевой платформы |
| 2 | **iframe cross-origin** — postMessage bridge | ❌ | ❌ | Jira плагины — всегда в iframe (Zephyr, Structure, Insight) |
| 3 | **Cookie Consent / GDPR** | ❌ | ❌ | EU-инстансы Jira блокируют запись |
| 4 | **Assertions** (генерация ожидаемого результата) | ❌ | ✅ | У PW есть — нужно заимствовать подход |
| 5 | **Error Tracking** (onerror + unhandledrejection) | ❌ | ❌ | Для баг-репортов критично |
| 6 | **Froala Editor** (rich text Jira) | ❌ | ❌ | Основной редактор в Jira/Zephyr |
| 7 | **Shadow DOM composedPath()** | ❌ | ✅ | У PW есть — скопировать подход |
| 8 | **Animation/Transition end** | ❌ | ❌ | Jira переходы анимированы |
| 9 | **Touch / Wheel** | ❌ | ❌ | Мобильная версия Jira |
| 10 | **iframe селектор** (frame >> element) | ❌ | ✅ | У PW есть — скопировать формат |
