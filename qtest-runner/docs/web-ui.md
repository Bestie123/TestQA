---
title: Web UI
---

# QTest Runner — Web UI

> **Source:** `web-ui.md`

## Обзор

React SPA на порту **8080** (через api-gateway). Собирается Vite, все страницы — SPA-роутинг через состояние `page` в `App.tsx`. Интерфейс состоит из 8 вкладок-страниц:

| Страница | Компонент | Назначение |
|----------|-----------|------------|
| Список кейсов | `TestCaseList` | Просмотр, фильтрация, поиск TC (серверная пагинация) |
| Детали | `TestCaseDetail` | 3 таба: Подробнее/Шаги/Выполнение, execution history, Zephyr-стиль |
| Импорт | `ImportPage` | Импорт Excel в БД |
| Recorder | `RecorderPage` | Запись сессий браузера + "Опубликовать в Zephyr" |
| Sync | `SyncPage` | 5 вкладок: Тест кейсы/Тестовые прогоны/Планы/Отчёты/Конфигурация; фильтры, дерево папок, пагинация |
| Отчёты | `ReportsPage` | Статистика, история, успешность |
| Настройки | `SettingsPage` | Тема, типы действий, drag mode |
| Docs | iframe → localhost:5173 | Документация VitePress |

---

## Система тем

7 тем оформления, переключаемых через `<select>` в правой части навбара. Выбор сохраняется в `localStorage('theme')`, по умолчанию — `dark`.

### Список тем

| ID | Название | Emoji | Фон (`--bg`) | Акцент (`--accent`) |
|----|----------|-------|-------------|-------------------|
| `light` | Светлая | ☀️ | `#f5f5f5` | `#1976d2` (синий) |
| `dark` | Тёмная | 🌙 | `#0f0f23` | `#4dabf7` (голубой) |
| `opencode` | OpenCode | ⚫ | `#0a0a0a` | `#fab283` (оранжевый) |
| `green` | Хакерская | 💚 | `#0a1f0a` | `#4caf50` (зелёный) |
| `purple` | Фиолетовая | 💜 | `#1a0a2e` | `#ab47bc` (фиолетовый) |
| `ocean` | Океан | 🌊 | `#0a1a2e` | `#0288d1` (голубой) |
| `sunset` | Закат | 🌅 | `#1a0f0a` | `#ff7043` (оранжевый) |

### CSS Variables

Темы реализованы через CSS-переменные в `index.html`:

```css
[data-theme="opencode"] {
  --bg: #0a0a0a;
  --bg-card: #1a1a1a;
  --bg-input: #141414;
  --bg-nav: #1a1a1a;
  --bg-hover: #252525;
  --bg-active: #2a2a2a;
  --text: #eeeeee;
  --text-muted: #808080;
  --text-nav: #aaaaaa;
  --border: #2a2a2a;
  --border-light: #222222;
  --accent: #fab283;
  --accent-hover: #f5a742;
  --shadow: rgba(0,0,0,0.4);
}
```

Всего 13 переменных: 7 фоновых, 3 текстовых, 2 граничных, 1 тень.

### Принцип работы

```typescript
// App.tsx
const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}, [theme]);
```

- Атрибут `data-theme` выставляется на `<html>` при загрузке и каждом изменении
- Все стили компонентов используют `var(--bg)`, `var(--text)`, `var(--accent)` и т.д.
- Новая тема применяется мгновенно, без перезагрузки страницы
- Персистентность: тема сохраняется между сессиями

---

## Страница настроек (`/settings`)

Компонент `SettingsPage.tsx` — 2 основных блока настроек:

### 1. Режим Drag & Drop

Два режима записи перетаскиваний:

| Режим | Шагов | Описание |
|-------|-------|----------|
| **Простой** (simple) | 3 | `dragstart` + `drop` + `dragend` |
| **Умный** (smart) | 1 | "Перетащить X в Y" |

### 2. Логирование действий

69 тогглов для включения/выключения записи каждого типа действий. Сгруппированы по 18 категориям:

| Категория | Типов | Примеры |
|-----------|-------|---------|
| Навигация | 4 | navigate, page_load, switchTab, listTabs |
| Клики | 6 | click, dblclick, contextmenu, canvas_click, hover, focus |
| Ввод | 5 | fill, select, check, keypress, ime_composition |
| Drag & Drop | 4 | dragstart, dragend, drop, drag |
| Формы и файлы | 2 | submit, file_upload |
| Проверки (Assertions) | 8 | assertText, assertVisible, assertValue, assertChecked, assertUrl, waitForSelector, wait, verify |
| Скриншоты | 1 | screenshot |
| Клавиатура и буфер | 2 | clipboard, selection |
| Прокрутка и размер | 3 | scroll, wheel, resize |
| Touch | 3 | touchstart, touchend, touchmove |
| Медиа | 4 | media_play, media_pause, media_seeked, media_volume |
| CSS Анимации | 4 | transition_start, transition_end, animation_start, animation_end |
| Жизненный цикл | 3 | visibility_change, page_hide, page_show |
| UI Элементы | 4 | dialog, dialog_element, details_toggle, popover_toggle |
| DOM Мутации | 6 | element_appear, element_remove, attr_change, text_change, element_resize, element_intersect |
| Сеть | 3 | request, response, request_failed |
| Ошибки | 3 | js_error, unhandled_rejection, console |
| Окружение | 4 | cookie_consent, jira_env, captcha_detected, user_switch |

**Кнопки:** "Включить все" / "Выключить все" — для всей страницы и для каждой категории. Сохранение через кнопку "Сохранить настройки" (sticky bottom).

### API настроек

```typescript
GET  /api/settings          — получить все настройки (ключ → значение)
GET  /api/settings/:key     — получить конкретную настройку
PUT  /api/settings          — сохранить все настройки ({ settings: {...} })
PUT  /api/settings/:key     — сохранить конкретную настройку
```

Хранятся в SQLite, таблица `app_settings`:

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Роутинг: `api-gateway` проксирует `/api/settings*` → `recorder-service:3004`.

---

## Docs iframe

Вкладка "Docs" открывает VitePress-сайт документации в iframe:

```tsx
{page === 'docs' && (
  <iframe
    src="http://localhost:5173"
    style={{ width: '100%', height: 'calc(100vh - 50px)', border: 'none' }}
    title="Documentation"
  />
)}
```

- URL: `http://localhost:5173` (VitePress dev-сервер)
- Размер: `100vw` × `calc(100vh - 50px)` (полный экран минус навбар)
- Без рамки (`border: none`)
- Страницы документации открываются внутри iframe без перезагрузки web-ui

---

## API функции (frontend)

Файл `src/api.ts` экспортирует TypeScript-функции для всех эндпоинтов:

| Функция | Endpoint | Описание |
|---------|----------|----------|
| `fetchTestCases` | `GET /api/testcases` | Список TC (с фильтрами, `{ data, total }`) |
| `fetchTestCase` | `GET /api/testcases/:key` | Детали TC |
| `fetchTestCaseExecutions` | `GET /api/reports/test-case/:key` | Выполнения TC |
| `fetchFolders` | `GET /api/folders` | Список папок |
| `createExecution` | `POST /api/executions` | Создать выполнение |
| `startExecution` | `POST /api/executions/:id/start` | Запустить выполнение |
| `fetchExecution` | `GET /api/executions/:id` | Статус выполнения |
| `fetchExecutions` | `GET /api/executions` | Все выполнения |
| `updateStepStatus` | `PATCH /api/executions/:id/steps/:idx` | Обновить шаг |
| `autoNextStep` | `POST /api/executions/:id/auto-next` | Автоматический переход |
| `startRecording` | `POST /api/recordings/start` | Начать запись |
| `stopRecording` | `POST /api/recordings/:id/stop` | Остановить запись |
| `fetchRecording` | `GET /api/recordings/:id` | Получить сессию |
| `fetchRecordings` | `GET /api/recordings` | Все сессии |
| `convertRecording` | `POST /api/recordings/:id/convert` | Конвертировать в шаги |
| `syncFromZephyr` | `POST /api/zephyr/sync` | Синхронизация Zephyr |
| `syncFromZephyrTestRun` | `POST /api/zephyr/sync/testrun` | Синхронизация прогона |
| `fetchZephyrTestRuns` | `GET /api/zephyr/testruns` | Все тестовые прогоны |
| `fetchZephyrTestRunTestCases` | `GET /api/zephyr/testruns/:key/testcases` | TC в прогоне |
| `fetchZephyrTestPlans` | `GET /api/zephyr/testplans` | Тест-планы |
| `fetchZephyrProjects` | `GET /api/zephyr/projects` | Проекты Zephyr |
| `diffExcel` | `POST /api/diff/excel` | Сравнение Excel |
| `importExcel` | `POST /api/import` | Импорт Excel |
| `createTestCase` | `POST /api/testcases` | Создать TC |
| `fetchCoverage` | `GET /api/coverage` | Покрытие Issues→TC |
| `fetchReportSummary` | `GET /api/reports/summary` | Сводка отчётов |
| `fetchReportHistory` | `GET /api/reports/history` | История отчётов |
| `publishToZephyr` | `POST /api/zephyr/publish` | Опубликовать в Zephyr |
| `testZephyrConnection` | `POST /api/zephyr/test-connection` | Проверка подключения |
| `fetchCredentials` | `GET /api/credentials` | Креденшиалы |
| `saveCredentials` | `PUT /api/credentials` | Сохранить креденшиалы |
| `getSettings` | `GET /api/settings` | Настройки |
| `setSettingsBulk` | `PUT /api/settings` | Сохранить настройки |
| `launchBrowser` | `POST /api/launch` | Запустить браузер |
| `startBrowserRecording` | `POST /api/record/start` | Начать запись в агенте |
| `stopBrowserRecording` | `POST /api/record/stop` | Остановить запись в агенте |

---

## Навигация

Навбар (компонент `<nav>` в `App.tsx`) содержит:

```
QTest Runner | Импорт | Recorder | Sync | Выполнения | Отчёты | Настройки | Docs | [●] | [▼ тема]
```

- Ссылки меняют состояние `page`, которое рендерит соответствующий компонент
- `selectedKey` отображается как хлебная крошка (`/ TC-123`)
- Справа — **health dot** (🟢 сервисы работают, 🔴 не отвечают, 🟠 проверка) + `<select>` выбора темы
- Активная страница подсвечивается классом `.active`
- Health dot опрашивает `GET /api/health` каждые 15 секунд
