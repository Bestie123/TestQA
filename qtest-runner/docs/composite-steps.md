---
title: Composite Steps
---

# Composite Steps (step-library-service)

> **Source:** `composite-steps.md`

## Что такое Composite Step

Composite Step — последовательность шагов, объединённая в один переиспользуемый блок. Например, «Авторизация в Jira» = [navigate → fill username → fill password → click login]. Composite steps могут содержать параметры (`{{paramName}}`), которые подставляются при разворачивании.

## Архитектура

```
Test Case Step (action='composite', testData='comp-jira-login')
  │
  ├─ POST /api/composite-steps/comp-jira-login/expand
  │     { bindings: { url, username, password } }
  │
  └─ Результат: [{ action:'navigate', value:'https://...' },
                  { action:'fill', selector:'#username', value:'admin' },
                  { action:'fill', selector:'#password', value:'pass123' },
                  { action:'click', selector:'#login-button' }]
```

## Поток выполнения (execution-service)

1. `POST /api/executions` с testCaseKey
2. Для каждого шага с `action === 'composite'`:
   - Извлекается `compositeId` из `testData` (например, `comp-jira-login`)
   - Извлекаются `bindings` из `expectedResult` (JSON: `{ bindings: { ... } }`)
   - Вызывается `POST /api/composite-steps/:id/expand` с bindings
   - Развёрнутые шаги вставляются в `step_results` вместо одного composite
3. При `auto-next` composite шаги (если остались неразвёрнутыми) пропускаются

## API endpoints (step-library-service, порт 3002)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/composite-steps` | GET | Список всех composite steps (с items). Опциональный query: `?category=...` |
| `/api/composite-steps/:id` | GET | Получить один composite step с items |
| `/api/composite-steps` | POST | Создать новый composite step. Body: `{ name, description?, category?, parameters?, steps[] }` |
| `/api/composite-steps/:id` | PUT | Обновить composite step (partial update). Body: `{ name?, description?, category?, parameters?, steps? }` |
| `/api/composite-steps/:id` | DELETE | Удалить composite step (каскадно удаляет items) |
| `/api/composite-steps/:id/expand` | POST | Развернуть в плоские шаги. Body: `{ bindings: { paramName: value } }` |
| `/api/composite-categories` | GET | Список уникальных категорий composite steps |

## Формат composite step

```json
{
  "id": "comp-jira-login",
  "name": "Авторизация в Jira",
  "description": "Вход в Jira: открыть страницу логина, ввести логин/пароль, нажать Войти",
  "category": "Авторизация",
  "parameters": [
    { "name": "url", "label": "URL Jira", "type": "url", "required": true },
    { "name": "username", "label": "Логин", "type": "string", "required": true },
    { "name": "password", "label": "Пароль", "type": "string", "required": true }
  ],
  "steps": [
    { "action": "navigate", "url": "{{url}}", "text": "Открыть страницу логина Jira" },
    { "libraryStepId": "lib-fill-field", "selector": "#username", "value": "{{username}}" },
    { "libraryStepId": "lib-fill-field", "selector": "#password", "value": "{{password}}" },
    { "libraryStepId": "lib-click-btn", "selector": "#login-button" }
  ]
}
```

## Формат expand response

```json
{
  "id": "comp-jira-login",
  "name": "Авторизация в Jira",
  "expanded": [
    { "index": 0, "action": "navigate", "selector": "", "value": "", "url": "https://jira.example.com/login", "text": "Открыть страницу логина Jira" },
    { "index": 1, "action": "fill", "selector": "#username", "value": "admin", "url": "", "text": "Ввести текст в указанное поле" },
    { "index": 2, "action": "fill", "selector": "#password", "value": "pass123", "url": "", "text": "Ввести текст в указанное поле" },
    { "index": 3, "action": "click", "selector": "#login-button", "value": "", "url": "", "text": "Нажать на кнопку с указанным текстом" }
  ]
}
```

## Зависимости composite steps в execution

```
TC[testcase-service] → GET /api/testcases/:key → EXC[execution-service :3003]
EXC → POST expand → SL[step-library-service :3002]
EXC → POST execute-step → BA[browser-agent :3005]
```

## DB схема (steps.db)

```sql
CREATE TABLE composite_steps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  parameters_json TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE composite_step_items (
  id TEXT PRIMARY KEY,
  composite_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  library_step_id TEXT,
  action TEXT NOT NULL,
  selector TEXT DEFAULT '',
  value TEXT DEFAULT '',
  url TEXT DEFAULT '',
  text TEXT DEFAULT '',
  parameter_bindings_json TEXT DEFAULT '{}',
  FOREIGN KEY (composite_id) REFERENCES composite_steps(id) ON DELETE CASCADE
);
```

## Seed данные

При старте step-library-service создаются 3 composite step:

| ID | Название | Шагов | Параметры |
|----|----------|-------|-----------|
| `comp-jira-login` | Авторизация в Jira | 4 | url, username, password |
| `comp-create-task` | Создание задачи в Jira | 4 | project, summary, description |
| `comp-screenshot-verify` | Скриншот и проверка текста | 2 | text |

## Правила

1. **{{param}} подстановка** — любое поле (action, selector, value, url, text) может содержать `{{paramName}}`, который заменяется значением из bindings при expand
2. **libraryStepId** — опциональная ссылка на `library_steps`; если action пустой — берётся из library step; если text пустой — берётся description из library step
3. **parameters** — массив `IStepParameter[]` (name, label, type, required, defaultValue) — только для документации/UI, не влияет на expand
4. **Bindings из expectedResult** — при создании execution bindings передаются через `expectedResult: { "bindings": { "url": "...", "username": "...", "password": "..." } }`
5. **execution-service pre-fetch** — все composite steps разворачиваются ДО транзакции, т.к. HTTP вызовы не могут быть внутри synchronous better-sqlite3 transaction
