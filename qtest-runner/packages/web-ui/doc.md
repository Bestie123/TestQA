# packages/web-ui/ — Settings Page (Browser Agent)

## Файлы

| Файл | Назначение |
|------|-----------|
| `src/pages/SettingsPage.tsx` | Страница настроек (action types, drag mode, browser agent, credentials) |
| `src/api.ts` | API функции для бэкенда |

## API функции (`api.ts`)

```typescript
getVideoDir(agentApi: string): Promise<{ videoDir: string }>
setVideoDir(agentApi: string, dir: string): Promise<{ ok: boolean; videoDir: string }>
getCdpCapture(agentApi: string): Promise<{ cdpCapture: boolean }>
setCdpCapture(agentApi: string, enabled: boolean): Promise<{ ok: boolean; cdpCapture: boolean }>
getInjectTp(api: string): Promise<{ injectTp: boolean }>
setInjectTp(api: string, enabled: boolean): Promise<{ ok: boolean; injectTp: boolean }>
```

## UI секция "Настройки браузера"

Добавлена в SettingsPage между "Drag Mode" и "Логирование действий":

1. **Папка для видео** — input + кнопка "Обзор..." → FolderPicker modal
   - FolderPicker: навигация по директориям, выбор папки
   - Сохраняется в recorder-service `/api/settings` (app_settings table)

2. **CDP Capture** — checkbox
   - Сохраняется в recorder-service `/api/settings`
   - При включении увеличивает объём записи (HTTP bodies)

3. **Inject data-tp IDs** — checkbox
   - Добавляет `data-tp` и `data-tp-path` на все элементы
   - Для инструментов автоматизации (нейросети, AI-ассистенты)
   - Сайт не видит эти атрибуты (data-* не влияют на CSS/JS)
   - Сохраняется в recorder-service `/api/settings` (app_settings table)

## FolderPicker Modal

- Навигация: клик по папке → переход внутрь
- Кнопка "↑ Назад" → переход к родительской папке
- Кнопка "Выбрать эту папку" → установка пути
- Отображает текущий путь monospace шрифтом
- Скроллируемый список подпапок

## Проблемы

| # | Проблема | Причина | Решение |
|---|----------|---------|---------|
| 1 | agentApi URL мог быть неверным | `api` содержит `/api` суффикс | Убрано — теперь используем recorder-service напрямую |
| 2 | CDP checkbox не сохранялся | `process.env` не persistent | Сохранение в recorder-service `app_settings` table |

## Build

```powershell
cd qtest-runner
npm run build    # Vite build включён
```

## Связи

- **recorder-service** — хранит настройки в `app_settings` таблице
- **browser-agent** — получает `injectTp` опцию через `/api/record/start`
- **chrome-extension** — синхронизирует `injectTp` через background.ts
