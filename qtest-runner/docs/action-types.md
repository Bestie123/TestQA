---
title: Action Types Reference
---

# Справочник Action Types

> **Source:** `action-types.md`

Полный список всех 77 action types в qtest-runner. Каждый тип указывает откуда записывается, создаёт ли шаг в convertToSteps, и есть ли в action-parser.

## Легенда

| Колонка | Описание |
|---------|----------|
| **Запись** | Где логируется: inject (браузер), recorder (Playwright), executor (команды) |
| **Steps** | Создаёт ли шаг в convertToSteps |
| **Parser** | Есть ли в action-parser (для воспроизведения) |

---

## Пользовательские действия

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 1 | `click` | inject + recorder | ✅ | ✅ | Левый клик по элементу |
| 2 | `dblclick` | inject | ✅ | ✅ | Двойной клик |
| 3 | `contextmenu` | inject | ✅ | ✅ | Правый клик (контекстное меню) |
| 4 | `canvas_click` | recorder | ✅ | ✅ | Клик по canvas с координатами (x, y) |
| 5 | `fill` | inject + recorder | ✅ | ✅ | Ввод текста в поле |
| 6 | `input` | — | ✅ (grouped) | — | Legacy тип, объединён с fill |
| 7 | `select` | inject + recorder | ✅ | ✅ | Выбор из выпадающего списка |
| 8 | `check` | inject + recorder | ✅ | ✅ | Переключение чекбокса/радио |
| 9 | `keypress` | inject + recorder | ✅ | ✅ | Нажатие клавиши (Enter, Tab, Escape и т.д.) |
| 10 | `submit` | inject | ✅ | — | Отправка формы |
| 11 | `hover` | inject | ✅ | ✅ | Наведение мыши (mouseenter/leave) |
| 12 | `focus` | inject | ✅ (no-op) | — | Фокус на элементе |
| 13 | `contextmenu` | inject | ✅ | ✅ | Правый клик |

## Drag & Drop

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 14 | `dragstart` | inject | ✅ | — | Начало перетаскивания (захват) |
| 15 | `dragend` | inject | ✅ (no-op) | — | Конец перетаскивания |
| 16 | `drop` | inject | ✅ | ✅ | Отпускание элемента на цели |
| 17 | `drag` | executor | ✅ | ✅ | Playwright dragTo команда |
| 18 | `dragTo` | executor | — | ✅ | Алиас для drag |

## Навигация

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 19 | `navigate` | inject + recorder | ✅ | ✅ | Навигация (pushState, popstate, hashchange) |
| 20 | `page_load` | recorder | ✅ | — | Загрузка страницы (full load) |
| 21 | `switchTab` | executor | ✅ | ✅ | Переключение вкладки браузера |
| 22 | `listTabs` | executor | ✅ | ✅ | Получение списка вкладок |

## Формы и файлы

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 23 | `file_upload` | inject | ✅ | — | Выбор файла для загрузки |
| 24 | `fileUpload` | executor | — | ✅ | Playwright setInputFiles команда |
| 25 | `setInputFiles` | executor | — | ✅ | Алиас для fileUpload |

## Проверки (Assertions)

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 26 | `assertText` | executor | ✅ | ✅ | Проверка текста элемента |
| 27 | `assertVisible` | executor | ✅ | ✅ | Проверка видимости элемента |
| 28 | `assertValue` | executor | ✅ | ✅ | Проверка значения поля ввода |
| 29 | `assertChecked` | executor | ✅ | ✅ | Проверка состояния чекбокса |
| 30 | `assertUrl` | executor | ✅ | ✅ | Проверка URL страницы |
| 31 | `verify` | executor | — | ✅ | Проверка текста (альтернатива assertText) |
| 32 | `waitForSelector` | executor | ✅ | ✅ | Ожидание появления элемента |
| 33 | `wait` | executor | ✅ | ✅ | Ожидание указанного времени |

## Скриншоты

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 34 | `screenshot` | executor | ✅ | ✅ | Скриншот страницы |

## Клавиатура и буфер

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 35 | `clipboard` | inject | ✅ (no-op) | — | Копирование/вставка (copy/paste) |
| 36 | `selection` | recorder | ✅ | — | Выделение текста |
| 37 | `ime_composition` | inject | ✅ | — | Ввод через IME (CJK символы) |

## Прокрутка и размер

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 38 | `scroll` | inject | ✅ | ✅ | Прокрутка страницы |
| 39 | `wheel` | inject | ✅ | ✅ | Прокрутка колёсиком мыши |
| 40 | `resize` | inject | ✅ (no-op) | — | Изменение размера окна |

## Touch

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 41 | `touchstart` | inject | ✅ | — | Касание экрана |
| 42 | `touchend` | inject | ✅ (no-op) | — | Конец касания |
| 43 | `touchmove` | inject | ✅ | — | Свайп по экрану |
| 44 | `touch` | executor | — | ✅ | Playwright touch команда |

## Медиа

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 45 | `media_play` | inject | ✅ | — | Воспроизведение видео/аудио |
| 46 | `media_pause` | inject | ✅ | — | Пауза медиа |
| 47 | `media_seeked` | inject | ✅ | — | Перемотка медиа |
| 48 | `media_volume` | inject | ✅ | — | Изменение громкости |

## CSS Анимации

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 49 | `transition_start` | inject | ✅ | — | Начало CSS transition |
| 50 | `transition_end` | inject | ✅ | — | Завершение CSS transition |
| 51 | `animation_start` | inject | ✅ | — | Начало CSS анимации |
| 52 | `animation_end` | inject | ✅ | — | Завершение CSS анимации |

## Жизненный цикл страницы

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 53 | `visibility_change` | inject | ✅ | — | Смена видимости вкладки |
| 54 | `page_hide` | inject | ✅ | — | Страница скрыта (bfcache) |
| 55 | `page_show` | inject | ✅ | — | Страница восстановлена из кэша |

## UI Элементы

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 56 | `dialog` | recorder | ✅ | — | Браузерный диалог (alert/confirm) |
| 57 | `dialog_element` | inject | ✅ | — | HTML `<dialog>` элемент |
| 58 | `details_toggle` | inject | ✅ | — | `<details>` развёрнут/свёрнут |
| 59 | `popover_toggle` | inject | ✅ | — | Popover API элемент |

## DOM Мутации

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 60 | `element_appear` | recorder | ✅ | — | Новый элемент появился в DOM |
| 61 | `element_remove` | recorder | ✅ (no-op) | — | Элемент удалён из DOM |
| 62 | `attr_change` | recorder | ✅ (no-op) | — | Атрибут элемента изменился |
| 63 | `text_change` | recorder | ✅ (no-op) | — | Текст элемента изменился |
| 64 | `element_resize` | inject | ✅ | — | Элемент изменил размер (ResizeObserver) |
| 65 | `element_intersect` | inject | ✅ | — | Элемент стал видим/скрыт (IntersectionObserver) |

## Сеть

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 66 | `request` | recorder | ✅ | — | HTTP запрос |
| 67 | `response` | recorder | ✅ | — | HTTP ответ |
| 68 | `request_failed` | recorder | ✅ | — | HTTP запрос не удался |

## Ошибки

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 69 | `js_error` | inject | ✅ | — | JavaScript ошибка |
| 70 | `unhandled_rejection` | inject | ✅ | — | Необработанный Promise rejection |
| 71 | `console` | recorder | ✅ | — | Сообщение из консоли браузера |

## Окружение

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 72 | `cookie_consent` | inject | ✅ | — | Обнаружен Cookie Consent баннер |
| 73 | `jira_env` | inject | ✅ (no-op) | — | Обнаружено окружение Jira/Zephyr |
| 74 | `captcha_detected` | inject | ✅ | — | Обнаружена CAPTCHA |
| 75 | `user_switch` | inject | ✅ | — | Переключение пользователя (Ctrl+Shift+U) |
| 76 | `switch_user` | — | ✅ (dead code) | — | Устаревшее имя (заменено на user_switch) |

## Мышь (не записываются)

| # | Action Type | Запись | Steps | Parser | Описание |
|---|-------------|--------|-------|--------|----------|
| 77 | `press` | — | — | ✅ | Алиас для keypress в parser |

---

## Статистика

| Метрика | Количество |
|---------|-----------|
| Всего уникальных action types | **77** |
| Записываются браузером | **59** |
| Создают шаги в convertToSteps | **70** |
| Есть в action-parser | **27** |
| Есть в shared-types | **77** (обновлено) |
| Не записываются (executor/parser only) | **18** |

## Группировка для настроек

Для страницы «Настройки» action types сгруппированы по категориям:

| Категория | Типы | Количество |
|-----------|------|-----------|
| Навигация | navigate, page_load, switchTab, listTabs | 4 |
| Клики | click, dblclick, contextmenu, canvas_click, hover | 5 |
| Ввод | fill, select, check, keypress, ime_composition | 5 |
| Drag & Drop | dragstart, dragend, drop, drag | 4 |
| Формы | submit, file_upload | 2 |
| Проверки | assertText, assertVisible, assertValue, assertChecked, assertUrl, waitForSelector, wait, verify | 8 |
| Скриншоты | screenshot | 1 |
| Клавиатура | clipboard, selection | 2 |
| Прокрутка | scroll, wheel, resize | 3 |
| Touch | touchstart, touchend, touchmove | 3 |
| Медиа | media_play, media_pause, media_seeked, media_volume | 4 |
| CSS Анимации | transition_start, transition_end, animation_start, animation_end | 4 |
| Жизненный цикл | visibility_change, page_hide, page_show | 3 |
| UI Элементы | dialog, dialog_element, details_toggle, popover_toggle | 4 |
| DOM Мутации | element_appear, element_remove, attr_change, text_change, element_resize, element_intersect | 6 |
| Сеть | request, response, request_failed | 3 |
| Ошибки | js_error, unhandled_rejection, console | 3 |
| Окружение | cookie_consent, jira_env, captcha_detected, user_switch | 4 |
| **ИТОГО** | | **70** |

Plus 1 drag-режим (простой/умный) = **71 настройка**.
