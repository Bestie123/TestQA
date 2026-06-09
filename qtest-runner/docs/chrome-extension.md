---
title: Chrome Extension
---

# Chrome Extension (Execution Panel)

> **Source:** `chrome-extension.md`

## Назначение

Chrome Extension подключается к browser-agent через WebSocket и позволяет:
- Управлять записью/выполнением тестов прямо из браузера
- Видеть индикатор записи на странице
- Запускать браузер, выполнять шаги (navigate, click, fill, screenshot, verify)
- Получать статус выполнения в реальном времени

## Архитектура

```
Popup UI (action) ──→ background.js (service worker)
                             │
                             ▼
                     WebSocket :3005
                             │
                             ▼
                    browser-agent (ws-server)
                             │
                             ▼
                    Playwright browser
```

## Компоненты

| Файл | Назначение |
|------|-----------|
| `manifest.json` | Manifest v3, permissions (activeTab, storage, scripting), host_permissions (<all_urls>) |
| `background.js` | Service worker, WebSocket клиент к ws://localhost:3005, автопереподключение |
| `content.ts` | Content script, индикатор записи, Shadow DOM-совместимый сборщик селекторов |
| `popup.html` | UI для управления (открывается по клику на иконку) |

## WebSocket протокол

**Исходящие (popup → background → browser-agent):**

| Тип | Параметры | Описание |
|-----|-----------|----------|
| `launch` | profileName, userDataDir | Запуск браузера |
| `navigate` | url | Перейти по URL |
| `click` | selector | Кликнуть по селектору |
| `fill` | selector, value | Заполнить поле |
| `screenshot` | — | Сделать скриншот |
| `verify` | text | Проверить текст на странице |
| `close` | — | Закрыть браузер |

**Входящие (browser-agent → background → popup):**

| Тип | Параметры | Описание |
|-----|-----------|----------|
| `connected` | clientId | Подключение установлено |
| `launched` | profileId | Браузер запущен |
| `executed` | results | Шаг выполнен |
| `step:result` | status, screenshot, error | Результат шага |
| `closed` | — | Браузер закрыт |
| `error` | message | Ошибка |

## Обработка Shadow DOM

Content script использует `composedPath()` вместо `e.target` для корректной работы внутри Web Components:

```typescript
function deepEventTarget(event: Event): Element | null {
  const path = event.composedPath();
  return path && path.length > 0 ? (path[0] as Element) : null;
}
```

getSelector() детектирует ShadowRoot и строит compound селекторы: `host-selector >> .inner-class`.

## Сборка

```bash
cd packages/chrome-extension
npm run build  # → dist/
```

## Установка в Chrome

1. Открыть `chrome://extensions`
2. Включить «Режим разработчика»
3. «Загрузить распакованное расширение» → выбрать `packages/chrome-extension/`
