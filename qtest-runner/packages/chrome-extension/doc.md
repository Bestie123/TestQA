# packages/chrome-extension/ — Chrome Extension (Manifest V3)

## Файлы

| Файл | Назначение |
|------|-----------|
| `src/manifest.json` | Manifest V3 — определение расширения |
| `src/content.ts` | Content script — запись действий + data-tp инжект |
| `src/background.ts` | Service Worker — WebSocket клиенты для browser-agent/recorder-service |
| `src/popup.ts` | Popup UI — управление записью |
| `src/indicator.css` | Стили индикатора записи |

## Архитектура

```
Chrome Extension (MV3)
  │
  ├─ content.ts ──→ Инжект на все страницы
  │    ├─ Запись действий (click/input/change/submit)
  │    ├─ getSelector() / getSelectorText()
  │    └─ TP_ID_GENERATOR (data-tp + data-tp-path)
  │
  ├─ background.ts ──→ Service Worker
  │    ├─ WebSocket → browser-agent (ws://localhost:3005)
  │    └─ WebSocket → recorder-service (ws://localhost:3004)
  │
  └─ popup.ts ──→ UI управления записью
```

## TP_ID_GENERATOR — Скрытая генерация ID

### Назначение
Параллельная реализация TP_ID_GENERATOR в content script для работы на сайтах (devjira, mailhog и др.) вне browser-agent.

### Формат ID

| Атрибут | Формат | Пример | Описание |
|---------|--------|--------|----------|
| `data-tp` | `{tagName}-{n}` | `button-1`, `input-3` | Порядковый номер в пределах типа |
| `data-tp-path` | `{xpath-lite}` | `body/0/div/3/button` | Укороченный xpath путь |

### Включение/выключение
- **Chrome Storage:** `chrome.storage.local.injectTp`
- **Синхронизация:** background.ts обрабатывает сообщение `setInjectTp`
- **Динамическое переключение:** `chrome.storage.onChanged` listener

### Источники анализа

- `packages/chrome-extension/src/content.ts:267-420` — TP_ID_GENERATOR + event listeners
- `packages/chrome-extension/src/background.ts:194-200` — обработчик setInjectTp
- `packages/web-ui/src/pages/SettingsPage.tsx:382-415` — UI checkbox

### Проблемы и решения

| # | Проблема | Причина | Решение |
|---|----------|---------|---------|
| 1 | TS7022: 'parent' implicitly has type 'any' | Циклическая ссылка `current = parent` | Переименовать в `parentEl` |

## Content Script — Запись действий

### События
| Событие | Обработчик | Описание |
|---------|-----------|----------|
| `click` | `handleClick` | Клик по элементу |
| `input` | `handleInput` | Ввод текста (debounce 500ms) |
| `change` | `handleChange` | Изменение значения |
| `submit` | `handleSubmit` | Отправка формы |

### Селекторы
- `getSelector(el)` — CSS селектор элемента
- `getSelectorText(el)` — селектор с текстом
- `getInteractiveParent(el)` — поиск интерактивного родителя

## Background Service Worker

### WebSocket подключения
| Сервис | URL | Назначение |
|--------|-----|-----------|
| browser-agent | `ws://localhost:3005` | Выполнение шагов |
| recorder-service | `ws://localhost:3004` | Сохранение действий |

### Сообщения

| Тип | Источник | Описание |
|-----|----------|----------|
| `startCapturing` | popup/web-ui | Начать запись |
| `stopCapturing` | popup/web-ui | Остановить запись |
| `setInjectTp` | SettingsPage | Вкл/выкл data-tp инжект |
| `recording:started` | recorder-service | Запись начата |
| `recording:stopped` | recorder-service | Запись остановлена |

## Manifest V3

```json
{
  "manifest_version": 3,
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["indicator.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

## Build

```powershell
cd qtest-runner/packages/chrome-extension
npm run build    # tsc + copy static files
```

## Связи

- **browser-agent** — WebSocket для выполнения шагов
- **recorder-service** — WebSocket для сохранения действий
- **web-ui** — SettingsPage управляет injectTp через background.ts
