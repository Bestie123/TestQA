---
title: API Reference
---

# API Reference

> **Source:** `api-reference.md`

## Порты сервисов

| Сервис | Порт | Назначение |
|--------|------|------------|
| api-gateway | 3000 | Единая точка входа (BFF) |
| testcase-service | 3001 | Тест-кейсы, Zephyr Sync |
| step-library-service | 3002 | Шаги библиотеки, Composite steps |
| execution-service | 3003 | Выполнения, отчёты |
| recorder-service | 3004 | Сессии записи, настройки |
| browser-agent | 3005 | Браузер, запись, видео |
| stub-site | 3006, 9091 | Статические тестовые страницы |
| web-ui | 8080 | Vite dev server |
| docs (VitePress) | 5173 | Документация |

## api-gateway (3000)

Все внешние запросы идут через `api-gateway`. Он проксирует к соответствующим микросервисам.

```bash
curl http://localhost:3000/api/testcases
# → прокси на testcase-service:3001
```

| Endpoint | Метод | Прокси на | Описание |
|----------|-------|-----------|----------|
| `/health` | GET | — | Health check |
| `/api/testcases/*` | * | 3001 | Тест-кейсы |
| `/api/folders/*` | * | 3001 | Папки |
| `/api/import` | POST | 3001 | Импорт Excel |
| `/api/zephyr/*` | * | 3001 | Zephyr Sync |
| `/api/diff/*` | * | 3001 | Сравнение |
| `/api/coverage/*` | * | 3001 | Покрытие issues |
| `/api/steps/*` | * | 3002 | Шаги |
| `/api/categories/*` | * | 3002 | Категории |
| `/api/composite-steps/*` | * | 3002 | Composite steps |
| `/api/composite-categories/*` | * | 3002 | Категории composite |
| `/api/executions/*` | * | 3003 | Выполнения |
| `/api/reports/*` | * | 3003 | Отчёты |
| `/api/recordings/*` | * | 3004 | Сессии |
| `/api/settings/*` | * | 3004 | Настройки |
| `/api/user-switch/*` | * | 3004 | Переключение |
| `/api/record/*` | * | 3005 | Запись |
| `/api/launch` | POST | 3005 | Запуск браузера |
| `/api/profiles/*` | * | 3005 | Профили |
| `/api/execute-step` | POST | 3005 | Выполнить шаг |
| `/api/videos/*` | * | 3005 | Видео |
| `/api/debug/*` | * | 3005 | Отладка |
| `/api/agent/*` | * | 3005 | Прямой доступ (strip prefix) |

## testcase-service (3001)

### Health
```bash
curl localhost:3001/health
# → {"status":"ok","service":"testcase-service"}
```

### Test cases
```bash
# Список (с фильтрацией + пагинация)
curl "localhost:3001/api/testcases?folder=Auth&search=login&limit=100&offset=0"
# → { data: TestCase[], total: number }

# Получить по ключу
curl localhost:3001/api/testcases/TC-123
# → { key: "TC-123", name: "...", steps: [...] }

# Создать
curl -X POST localhost:3001/api/testcases \
  -H "Content-Type: application/json" \
  -d '{"key":"TC-NEW","name":"New test","folder":"Auth","steps":[{"action":"navigate","testData":"https://example.com","expectedResult":"Page loaded"}]}'
# → 201 { id, key, name, steps, ... }

# Опубликовать записанные шаги в Zephyr
curl -X POST localhost:3001/api/zephyr/publish \
  -H "Content-Type: application/json" \
  -d '{"name":"New TC","steps":[{"action":"navigate","testData":"","expectedResult":"loaded"}],"folder":"/Smoke"}'
# → { key, name, status, zephyrKey?, zephyrError?, warning? }
```

| Endpoint | Метод | Тело запроса | Ответ |
|----------|-------|-------------|-------|
| `/health` | GET | — | `{ status, service }` |
| `/api/testcases` | GET | query: `folder?`, `search?`, `limit?`, `offset?` | `{ data: TestCase[], total }` |
| `/api/testcases/:key` | GET | — | `TestCase` / 404 |
| `/api/testcases` | POST | `{ key, name, folder?, steps[] }` | 201 `TestCase` / 409 |
| `/api/folders` | GET | — | `string[]` |
| `/api/import` | POST | `{ rows: string[][] }` | `{ imported, updated, skipped, errors }` |
| `/api/zephyr/config` | GET | — | `{ baseUrl, projectKey }` |
| `/api/zephyr/config` | PUT | `{ baseUrl?, projectKey?, apiToken? }` | обновлённый config |
| `/api/zephyr/sync` | POST | — | `{ fetched, imported, updated, errors }` |
| `/api/zephyr/sync/testrun` | POST | `{ testRunKey }` | `{ fetched, imported, errors }` |
| `/api/zephyr/test-connection` | POST | — | `{ ok, version?, message }` |
| `/api/zephyr/projects` | GET | — | `[{ key, name }]` |
| `/api/zephyr/testruns` | GET | — | `TestRun[]` |
| `/api/zephyr/testruns/:key/testcases` | GET | — | `{ data, total }` |
| `/api/zephyr/testplans` | GET | query: `projectKey?` | `TestPlan[]` |
| `/api/zephyr/folders` | GET | query: `projectKey?`, `maxPages?` | `FolderNode[]` |
| `/api/zephyr/testcases` | GET | query: `folder?`, `status?`, `priority?`, `owner?`, `search?`, `projectKey?`, `maxPages?` | `TestCase[]` |
| `/api/zephyr/publish` | POST | `{ name, steps[], folder?, priority?, precondition?, objective?, labels? }` | `{ key, name, status, zephyrKey?, warning? }` |
| `/api/zephyr/debug-response` | GET | — | `{ raw }` |
| `/api/credentials` | GET | — | `{ profiles, default, zephyr, _path }` |
| `/api/credentials` | PUT | `{ profiles?, default?, zephyr? }` | `{ ok }` |
| `/api/diff/excel` | POST | `{ rows: string[][] }` | `DiffResult[]` |
| `/api/coverage` | GET | — | `Record<issueKey, TestCase[]>` |
| `/api/coverage/:issueKey` | GET | — | `TestCase[]` |

## step-library-service (3002)

```bash
# Шаги
curl localhost:3002/api/steps
# → [{ id, name, description, category, action, parameters }]

# Composite steps
curl localhost:3002/api/composite-steps?category=Auth

# Expand с подстановкой
curl -X POST localhost:3002/api/composite-steps/comp-jira-login/expand \
  -H "Content-Type: application/json" \
  -d '{"bindings":{"url":"https://jira.com","username":"admin","password":"pass"}}'
# → { id, name, expanded: [{ action, selector, value, url, text }] }

# Composite categories
curl localhost:3002/api/composite-categories
# → { categories: ["Авторизация", "Задачи", "Проверки"] }
```

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/health` | GET | Health |
| `/api/steps` | GET | Список шагов библиотеки (с параметрами) |
| `/api/steps/:id` | GET | Шаг по ID / 404 |
| `/api/categories` | GET | Категории шагов |
| `/api/composite-steps` | GET | Список (query: `category?`) |
| `/api/composite-steps/:id` | GET | По ID / 404 |
| `/api/composite-steps` | POST | Создать |
| `/api/composite-steps/:id` | PUT | Обновить (частично) |
| `/api/composite-steps/:id` | DELETE | Удалить |
| `/api/composite-steps/:id/expand` | POST | Развернуть с bindings |
| `/api/composite-categories` | GET | Категории composite steps |

## execution-service (3003)

```bash
# Создать выполнение
curl -X POST localhost:3003/api/executions \
  -H "Content-Type: application/json" \
  -d '{"testCaseKey":"TC-123"}'
# → 201 { id, status: "running", steps: [...] }

# Запустить выполнение
curl -X POST localhost:3003/api/executions/<id>/start

# Авто-выполнение следующего шага
curl -X POST localhost:3003/api/executions/<id>/auto-next

# Обновить статус шага
curl -X PATCH localhost:3003/api/executions/<id>/steps/0 \
  -H "Content-Type: application/json" \
  -d '{"status":"passed","screenshot":"base64...","notes":"OK"}'

# Отчёты
curl localhost:3003/api/reports/summary
# → { total, byStatus: { passed, failed }, byTestCase, avgDurationSeconds }
```

| Endpoint | Метод | Тело | Ответ |
|----------|-------|------|-------|
| `/health` | GET | — | `{ status, service }` |
| `/api/executions` | POST | `{ testCaseKey }` | 201 `Execution` |
| `/api/executions` | GET | — | `Execution[]` |
| `/api/executions/:id` | GET | — | `Execution` / 404 |
| `/api/executions/:id/start` | POST | — | `Execution` |
| `/api/executions/:id/auto-next` | POST | — | `{ execution, agentCommands?, agentResults? }` |
| `/api/executions/:id/steps/:index` | PATCH | `{ status, screenshot?, notes? }` | `Execution` |
| `/api/executions/:id/steps/:index/screenshot` | POST | `{ screenshot }` | `{ ok }` |
| `/api/reports/summary` | GET | — | `{ total, byStatus, byTestCase, avgDurationSeconds }` |
| `/api/reports/history` | GET | — | `Record<date, Record<status, count>>` |
| `/api/reports/test-case/:key` | GET | — | `Execution[]` |

## recorder-service (3004)

```bash
# Создать сессию записи
curl -X POST localhost:3004/api/recordings/start \
  -H "Content-Type: application/json" \
  -d '{"name":"Test session","profileId":"auto"}'
# → { id, name, status: "recording", ... }

# Остановить
curl -X POST localhost:3004/api/recordings/<id>/stop

# Получить действия
curl localhost:3004/api/recordings/<id>
# → { id, name, status, actions: [{ actionType, selector, value, url, timestamp }] }

# Конвертировать в шаги
curl -X POST localhost:3004/api/recordings/<id>/convert
# → [{ action, testData, expectedResult }]
```

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/health` | GET | Health |
| `/api/recordings` | GET | Список сессий |
| `/api/recordings/start` | POST | Создать и начать запись |
| `/api/recordings/:id` | GET | Сессия с действиями |
| `/api/recordings/:id/stop` | POST | Остановить запись |
| `/api/recordings/:id/convert` | POST | Конвертировать в шаги |
| `/api/recordings/:id/actions` | POST | Добавить действия (используется browser-agent) |
| `/api/settings` | GET | Все настройки |
| `/api/settings` | PUT | Обновить настройки |
| `/api/settings/:key` | GET | Получить настройку |
| `/api/settings/:key` | PUT | Обновить настройку |

## browser-agent (3005)

```bash
# Запустить браузер (без видео)
curl -X POST localhost:3005/api/launch \
  -H "Content-Type: application/json" \
  -d '{"profileName":"Test","recordVideo":false}'
# → { profileId }

# Выполнить шаг
curl -X POST localhost:3005/api/execute-step \
  -H "Content-Type: application/json" \
  -d '{"action":"navigate","url":"https://example.com"}'
# → { commands: [...], results: [...] }

# Запись
curl -X POST localhost:3005/api/record/start \
  -H "Content-Type: application/json" \
  -d '{"profileId":"...","sessionId":"...","recorderUrl":"http://localhost:3004"}'

# Видео
curl localhost:3005/api/videos
curl "localhost:3005/api/video/download?file=<sessionId>.webm"
```

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/health` | GET | Health (also via WS) |
| `/api/launch` | POST | Запустить браузер (body: `{ profileName?, userDataDir?, recordVideo? }`) |
| `/api/profiles` | GET | Список профилей |
| `/api/record/start` | POST | Начать запись |
| `/api/record/stop` | POST | Остановить запись |
| `/api/execute-step` | POST | Выполнить шаг |
| `/api/videos` | GET | Список видео |
| `/api/video/path` | GET | Путь к текущему видео |
| `/api/video/download` | GET | Скачать видео (`?file=<name>`) |
| `/api/debug/recordings` | GET | Состояние записей |
| `/api/user-switch/switch` | POST | Переключить пользователя |

## Статус-коды

| Код | Значение |
|-----|----------|
| `200` | OK |
| `201` | Created |
| `204` | No Content (OPTIONS) |
| `400` | Bad Request (missing required fields) |
| `404` | Not Found |
| `409` | Conflict (duplicate key) |
| `500` | Internal Server Error |
| `502` | Bad Gateway (upstream service unavailable) |
