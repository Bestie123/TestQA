# Playwright Codegen vs qtest-runner: Детальное сравнение

> Основано на актуальной версии Playwright 1.50+
> Запуск: `npx playwright codegen <url>`

---

## 1. Что Playwright Codegen умеет записывать

### 1.1. Клики (Click)

| Действие | Генерирует | Пример кода |
|----------|-----------|-------------|
| Обычный клик по кнопке | ✅ `locator.click()` | `page.getByRole('button', { name: 'Submit' }).click()` |
| Клик по ссылке | ✅ `locator.click()` | `page.getByRole('link', { name: 'Home' }).click()` |
| Клик по чекбоксу | ✅ `locator.check()` / `locator.uncheck()` | `page.getByLabel('I agree').check()` |
| Клик по радио-кнопке | ✅ `locator.check()` | `page.getByLabel('Option 1').check()` |
| Двойной клик | ✅ `locator.dblclick()` | `page.getByText('Item').dblclick()` |
| Правый клик | ✅ `locator.click({ button: 'right' })` | |
| Клик с модификаторами | ✅ `locator.click({ modifiers: ['Ctrl'] })` | Редко генерируется |

### 1.2. Ввод текста (Type / Fill)

| Действие | Генерирует | Пример |
|----------|-----------|--------|
| Ввод в текстовое поле | ✅ `locator.fill()` | `page.getByLabel('Email').fill('user@test.com')` |
| Постепенный ввод | ✅ `locator.type()` | Используется редко, обычно `fill()` |
| Нажатие Enter | ✅ `locator.press('Enter')` | |
| Нажатие Tab | ✅ `locator.press('Tab')` | |
| Нажатие Escape | ✅ `locator.press('Escape')` | |
| Комбинации (Ctrl+C) | ✅ `locator.press('Control+C')` | |

### 1.3. Выбор из списка (Select)

| Действие | Генерирует | Пример |
|----------|-----------|--------|
| `<select>` option | ✅ `locator.selectOption()` | `page.getByLabel('Country').selectOption('US')` |

### 1.4. Навигация (Navigation)

| Действие | Генерирует | Пример |
|----------|-----------|--------|
| Переход по URL | ✅ `page.goto()` | `await page.goto('https://example.com')` |
| Клик по ссылке → SPA | ✅ `page.waitForURL()` + `expect(page).toHaveURL()` | |
| Кнопка Назад | ✅ `page.goBack()` | |
| Кнопка Вперёд | ✅ `page.goForward()` | |
| Обновление страницы | ✅ `page.reload()` | |

### 1.5. Hover (Наведение)

| Действие | Генерирует | Пример |
|----------|-----------|--------|
| Наведение на элемент | ✅ `locator.hover()` | `page.getByText('Menu').hover()` |

### 1.6. Drag & Drop

| Действие | Генерирует | Пример |
|----------|-----------|--------|
| Перетаскивание | ✅ `locator.dragTo()` | `source.dragTo(target)` |

### 1.7. Скролл

| Действие | Генерирует | Пример |
|----------|-----------|--------|
| Скролл страницы | ❌ НЕ генерирует | Нужно добавить вручную |
| Скролл к элементу | ❌ НЕ генерирует | `locator.scrollIntoViewIfNeeded()` — руками |
| Скролл колёсиком (wheel) | ❌ НЕ генерирует | `page.mouse.wheel(0, 100)` — руками |

### 1.8. File Chooser (Файлы)

| Действие | Генерирует | Пример |
|----------|-----------|--------|
| Клик по `input[type=file]` | ✅ устанавливает FileChooser listener | `page.on('filechooser', ...)` |
| Выбор файла | ❌ НЕ генерирует автоматически | Нужно вставить `fileChooser.setFiles()` вручную |

### 1.9. Assertions (Проверки)

| Действие | Генерирует | Пример |
|----------|-----------|--------|
| Проверка URL после навигации | ✅ `expect(page).toHaveURL()` | Генерируется автоматически |
| Проверка заголовка | ❌ НЕ генерирует | `expect(page).toHaveTitle()` |
| Проверка текста | ❌ НЕ генерирует | `expect(locator).toHaveText()` |
| Проверка видимости | ❌ НЕ генерирует | `expect(locator).toBeVisible()` |
| Проверка disabled/checked | ❌ НЕ генерирует | |
| Проверка количества элементов | ❌ НЕ генерирует | `expect(locator).toHaveCount()` |

---

## 1.10. Новые возможности qtest-runner (Iteration 6, 28.05.2026)

| Действие | qtest-runner | Playwright CG | Пример |
|----------|--------------|---------------|--------|
| Touch (touchstart/touchend/touchmove) | ✅ | ❌ | `page.touchscreen.tap(x, y)` |
| Wheel (колёсико) | ✅ | ❌ | `page.mouse.wheel(deltaX, deltaY)` |
| Transition end/start | ✅ | ❌ | CSS transition capture |
| Animation end/start | ✅ | ❌ | CSS animation capture |
| Error tracking (onerror) | ✅ | ❌ | `js_error` action type |
| Cookie consent detect | ✅ | ❌ | OneTrust/CookieYes/Cookiebot |
| Jira/Zephyr env detect | ✅ | ❌ | AUI, Froala, plugin iframe'ы |
| Shadow DOM composedPath | ✅ | ✅ | `__deepEventTarget(event)` |
| SPA navigation monkey-patch | ✅ | ✅ | pushState/replaceState |
| AssertText/Value/Checked/Url | ✅ | 🔶 | assert* actions in executor |
| File upload capture | ✅ | ❌ | input[type=file] change |
| Details/Dialog toggle | ✅ | ❌ | `<details>` + `<dialog>` |
| Page lifecycle | ✅ | ❌ | visibilitychange, pagehide |
| Same-origin iframe recording | ✅ | ❌ | frame[name="..."] >> selector |
| iframe frame selector path | ✅ | ❌ | `__getFramePath(win)` recursive |
| Drag & drop recording (inject) | ✅ | ❌ | dragstart/dragend/drop |

**Вывод:** qtest-runner теперь опережает Playwright Codegen по 15+ фичам, связанным с записью сложных взаимодействий (touch, wheel, error tracking, cookie consent, Jira специфика). Playwright сохраняет преимущество в auto-waiting, генерации кода и селекторах getByRole.

## 2. Чего Playwright Codegen НЕ умеет

### 2.1. iframe

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| Same-origin iframe — запись кликов | ❌ | ❌ | Playwright: нужно вручную переключиться на frame |
| Cross-origin iframe — запись изнутри | ❌ | ❌ | Security restriction — невозможно из inject-скрипта |
| Генерация `frame.locator()` | ❌ | ❌ | Playwright умеет работать с iframe, но CG не генерирует |
| Обнаружение plugin iframe (Zephyr) | ❌ | ❌ | Никто не детектит |

**Важно:** Playwright сам умеет работать с iframe через `page.frame()` / `frame.locator()`, но **Codegen НЕ генерирует** код для iframe. Все действия внутри iframe записываются как обычные, но при воспроизведении не сработают.

### 2.2. Shadow DOM

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| Клик внутри open shadow root | ✅ | ✅ | Playwright проникает через shadow boundary |
| Клик внутри closed shadow root | ❌ | ❌ | Security restriction |
| Генерация правильного селектора через composedPath | ❌ | ❌ | Playwright использует свой селектор |
| Селектор `>>` для shadow piercing | ❌ | ❌ | Playwright умеет, но CG не генерирует |

**Важно:** Playwright на уровне API умеет работать с Shadow DOM (`page.locator('css=...').locator('internal:shadow=...')`), но **Codegen** не всегда генерирует корректный проход через shadow boundary.

### 2.3. Touch / Pointer / Wheel

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| touchstart/touchend/touchmove | ❌ | ❌ | CG не записывает мобильные жесты |
| swipe / pinch / rotate | ❌ | ❌ | Нужно писать вручную |
| wheel (колёсико мыши) | ❌ | ❌ | CG не реагирует на колесо |
| pointerdown/pointerup/pointermove | ❌ | ❌ | |
| Эмуляция мобильного устройства | ❌ | ❌ | Playwright умеет (device emulation), но CG не записывает жесты |

**Важно:** Playwright на уровне API умеет эмулировать touch/wheel:
```ts
await page.mouse.wheel(0, 100);
await page.touchscreen.tap(x, y);
```
Но **Codegen НЕ генерирует** эти вызовы.

### 2.4. Forms (детали)

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| input type="color" | ❌ | ❌ | CG не реагирует на выбор цвета |
| input type="range" | ❌ | ❌ | Слайдер не записывается |
| input type="date" | ✅ | ❌ | Записывает как fill() |
| input type="file" | 🔶 | ❌ | Создаёт listener, но не генерирует setFiles |
| contentEditable / rich text | ❌ | 🔶 | CG записывает как fill(), теряется форматирование |
| datalist (автодополнение) | ❌ | ❌ | |
| autofill (браузерное) | ❌ | ❌ | |

### 2.5. Media

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| play / pause видео | ❌ | ❌ | CG не записывает медиа-события |
| seek (перемотка) | ❌ | ❌ | |
| volume change | ❌ | ❌ | |
| fullscreen video | ❌ | ❌ | |

### 2.6. Drag & Drop (детали)

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| dragTo() генерация | ✅ | ✅ | |
| dragover/dragenter/dragleave | ❌ | ❌ | CG не записывает промежуточные события |
| File drag-and-drop | ❌ | ❌ | Перетаскивание файлов из ОС |

### 2.7. Error Tracking

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| window.onerror запись | ❌ | ❌ | CG не отслеживает JS-ошибки |
| unhandledrejection | ❌ | ❌ | |
| Page error listener (Playwright) | ❌ | ❌ | `page.on('pageerror')` — API есть, но CG не использует |

### 2.8. Cookie Consent / GDPR

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| Обнаружение cookie banner | ❌ | ❌ | Никто не детектит |
| Авто-акцепт | ❌ | ❌ | |

### 2.9. CAPTCHA

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| ReCaptcha обнаружение | ❌ | ❌ | |
| Turnstile (Cloudflare) обнаружение | ❌ | ❌ | Запись продолжается, но тест упадёт |

### 2.10. Dialog / Alert / Confirm / Prompt

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| alert | ✅ | ✅ | Playwright auto-dismiss по умолчанию |
| confirm | ✅ | ✅ | |
| prompt | ✅ | ✅ | |
| beforeunload | ❌ | ❌ | |
| `<dialog>` element | ❌ | ❌ | CG не записывает open/close |

### 2.11. Авто-генерация ожидаемого результата (Assertion)

| Возможность | Playwright CG | qtest-runner (нужно) | Комментарий |
|-------------|---------------|----------------------|-------------|
| URL после клика | ✅ | ❌ | CG генерирует `expect(page).toHaveURL()` |
| Текст элемента после действия | ❌ | ❌ | Не генерирует |
| Видимость элемента | ❌ | ❌ | |
| Состояние disabled/checked | ❌ | ❌ | |
| Скриншот после шага | ❌ | ❌ | |

### 2.12. Мульти-окна / Popup

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| window.open() popup | ✅ | ❌ | CG переключается на новую страницу |
| Несколько вкладок | ✅ | ✅ | |
| Обработка popup → page.waitForEvent | ✅ | ❌ | Генерирует `context.waitForEvent('page')` |

### 2.13. SPA / History API

| Возможность | Playwright CG | qtest-runner | Комментарий |
|-------------|---------------|--------------|-------------|
| pushState/popstate | ✅ | 🔶 | CG отслеживает через waitForURL |
| hashchange | ✅ | ❌ | |
| Мгновенное обнаружение | ✅ | ❌ (polling) | CG — мгновенно, qtest — через 300ms |

---

## 3. Сводная таблица: Playwright Codegen vs qtest-runner

| Категория | Что умеет Playwright CG | Чего у qtest-runner нет (но нужно) |
|-----------|------------------------|------------------------------------|
| **Селекторы** | getByRole, getByLabel, getByText, getByTestId, getByPlaceholder, CSS, XPath | composedPath() для Shadow DOM, iframe prefix, has-text() |
| **Ожидания (auto-wait)** | Встроенное ожидание готовности элемента | ❌ В qtest-runner нет wait-стратегий |
| **Retry** | Playwright сам retry'ит | ❌ В qtest-runner нет retry |
| **Assertions** | toHaveURL, toHaveTitle, toBeVisible, toHaveText | ❌ Нет генерации expect() по шагам |
| **iframe** | ❌ CG не генерирует frame.locator() | ❌ qtest тоже не умеет |
| **Shadow DOM** | ✅ Частично (open только) | ✅ composedPath() + deepActiveElement() + __getSmartSelector |
| **Touch/Wheel** | ❌ Не генерирует | ✅ touchstart/touchend/touchmove + wheel (deltaX/Y) |
| **Jira/Zephyr специфика** | ❌ Нет понимания AUI, Froala | ✅ AUI/Froala/Zephyr auto-detect |
| **Cookie Consent** | ❌ | ✅ OneTrust/CookieYes/Cookiebot detect |
| **CAPTCHA** | ❌ | ❌ |
| **Error tracking** | ❌ | ✅ window.onerror + unhandledrejection |
| **File upload** | 🔶 Только listener | ✅ input[type=file] change capture |
| **Froala rich text** | ❌ fill() теряет форматирование | ✅ Froala env detection |
| **Русские шаги** | ❌ Генерирует только код | ✅ Русские паттерны + ожидаемый результат |
| **Zephyr Scale экспорт** | ❌ | ✅ .docx генерация |
| **Auto-assertion** | 🔶 Только URL | ✅ assertText/Visible/Value/Checked/Url |
| **Multi-window** | ✅ | ✅ context.on('page') |
| **SPA navigation** | ✅ framenavigated | ✅ monkey-patch pushState/replaceState |
| **iframe recording** | ❌ | ✅ frame selector + frame path (same-origin) |
| **Animation/Transition** | ❌ | ✅ transitionend/animationend |
| **Page Lifecycle** | ❌ | ✅ visibilitychange/pagehide/pageshow |
| **Details/Dialog toggle** | ❌ | ✅ `<details>` toggle + `<dialog>` observer |
| **Assertions (executor)** | ❌ | ✅ assertText/assertVisible/assertValue/assertChecked/assertUrl |

---

## 4. Вывод

**Playwright Codegen — лучший среди готовых решений**, но он покрывает **~30-40%** из того, что нужно для полноценного тестирования Jira/Zephyr. После Iteration 6 qtest-runner закрыл разрыв в 15+ категориях (Shadow DOM, iframe, touch/wheel, error tracking, assertions, Jira/Zephyr env, SPA navigation).

Вот что Playwright Codegen **никогда не сможет** сделать (нужна кастомная разработка):

1. **Понять бизнес-логику Jira** (AUI dropdown, Froala Editor, transition screens, plugin iframe'ы)
2. **Сгенерировать ожидаемый результат** в терминах тест-кейса (не `expect(page).toHaveURL()`, а `"Отобразилась форма перехода"`)
3. **Создать русскоязычные шаги** ("Нажать кнопку «На согласование»")
4. **Экспортировать в Zephyr Scale** с правильным HTML-форматированием и ссылками на Jira issues
5. **Детектировать** CAPTCHA, cookie banners, сложные карусели
6. **Записывать** touch/gesture/wheel на мобильных версиях
7. **Отслеживать JS-ошибки** как часть тест-кейса (для баг-репортов)
8. **Генерировать полный баг-репорт** с STR/ER/AR/окружением

**Ключевое преимущество qtest-runner (после Iteration 6)** — он теперь не только заполняет пробелы в генерации тест-кейсов и баг-репортов для Zephyr Scale на русском языке, но и опережает Playwright Codegen в записи сложных взаимодействий: touch/wheel, error tracking, cookie consent, animation/transition, details/dialog, page lifecycle, Jira/Zephyr env auto-detection.
