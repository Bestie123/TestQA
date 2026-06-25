> Doc-ID: ZEPHYR-API-1 | Дата: 07.06.2026 | Связанные: [ZEPHYR-UI-1]

# Zephyr Scale REST API (v1) — Справочник эндпоинтов

## Источник
Тестирование выполнено на `https://jira.ifellow.ru` (Jira Server 8.20.13, Zephyr Scale 9.23.0)
- Аутентификация: cookie-based (Jira session) или Bearer token
- Проект: IBPA (6500+ тест-кейсов), IBPA2 (173 тест-кейса)

## Базовый URL
```
https://jira.ifellow.ru/rest/atm/1.0/
```

## Аутентификация

### Cookie-based (рекомендуется для content scripts)
```http
Cookie: JSESSIONID=...; seraph.rememberme.cookie=...; atlassian.xsrf.token=...
```
- Автоматически подставляется браузером при запросах на тот же домен
- Не требует токена
- **Ограничение:** content script на том же домене всегда шлёт cookies, `credentials: 'omit'` не работает

### Bearer token (для внешних запросов)
```http
Authorization: Bearer <token>
```
- Токен: Base64-encoded строка
- Получить: Jira → Профиль → Personal Access Tokens → Create token
- **Важно:** `credentials: 'omit'` работает только в контексте расширения (popup), не в content script

## Рабочие эндпоинты

### 1. Поиск тест-кейсов
```
GET /rest/atm/1.0/testcase/search?query=<JQL>&maxResults=<N>&fields=<fields>
```

**Параметры:**
| Параметр | Описание | Пример |
|----------|----------|--------|
| `query` | JQL-подобный запрос | `key = "IBPA-T3"` |
| `maxResults` | Максимум результатов | `500` |
| `fields` | Список полей через запятую | `key,name,status,lastTestResultStatus` |
| `startAt` | Смещение (пагинация) | `500` |

**Примеры запросов:**
```powershell
# По ключу
curl.exe -s "https://jira.ifellow.ru/rest/atm/1.0/testcase/search?query=key%20%3D%20%22IBPA-T3%22&maxResults=1&fields=key,name,status"

# По проекту
curl.exe -s "https://jira.ifellow.ru/rest/atm/1.0/testcase/search?query=projectKey%20%3D%20%22IBPA%22&maxResults=5&fields=key,name,status,lastTestResultStatus,priority,folder"

# Batch по ключам (IN)
curl.exe -s "https://jira.ifellow.ru/rest/atm/1.0/testcase/search?query=key%20IN%20(%22IBPA-T3%22%2C%22IBPA-T4%22)&maxResults=2&fields=key,name,status"
```

**Ответ:**
```json
[
  {
    "key": "IBPA-T3",
    "name": "(SMOKE) Проверка создания Доходного договора",
    "status": "Автоматизирован",
    "lastTestResultStatus": "Pass",
    "priority": "Normal",
    "folder": "/Регресс/Проект \"Договоры (AGR)\"/ДОГОВОРЫ",
    "owner": "JIRAUSER18603",
    "createdOn": "2021-12-22T11:05:38.461Z",
    "updatedOn": "2024-11-22T06:28:59.388Z",
    "projectKey": "IBPA"
  }
]
```

**Доступные поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| `key` | string | Уникальный ключ (`IBPA-T3`) |
| `name` | string | Название тест-кейса |
| `status` | string | Статус тест-кейса |
| `lastTestResultStatus` | string | Результат последнего прогона |
| `priority` | string | Приоритет |
| `folder` | string | Путь к папке |
| `owner` | string | Владелец (Jira user key) |
| `createdOn` | ISO8601 | Дата создания |
| `updatedOn` | ISO8601 | Дата обновления |
| `projectKey` | string | Ключ проекта |
| `issueLinks` | array | Связанные Jira-задачи |
| `objective` | string | Цель тест-кейса |
| `precondition` | string | Предусловие (HTML) |
| `createdBy` | string | Автор |
| `majorVersion` | number | Мажорная версия |
| `latestVersion` | boolean | Последняя версия |

**Синтаксис запросов (JQL-like):**
| Оператор | Пример | Описание |
|----------|--------|----------|
| `=` | `key = "IBPA-T3"` | Равенство |
| `IN` | `key IN ("IBPA-T3","IBPA-T4")` | Множественное значение |
| `projectKey =` | `projectKey = "IBPA"` | По проекту |

**Ограничения:**
- `maxResults` максимум 500 за запрос
- `projectKey IS NOT EMPTY` — **НЕ работает** (возвращает 400)
- Пагинация через `startAt` (0, 500, 1000, ...)

---

### 2. Получение тест-кейса по ключу
```
GET /rest/atm/1.0/testcase/{key}
```

**Пример:**
```powershell
curl.exe -s "https://jira.ifellow.ru/rest/atm/1.0/testcase/IBPA-T3"
```

**Ответ:** Полный объект тест-кейса со всеми полями, включая `testScript` (шаги).

---

### 3. Получение тест-прогона по ключу
```
GET /rest/atm/1.0/testrun/{key}
```

**Пример:**
```powershell
curl.exe -s "https://jira.ifellow.ru/rest/atm/1.0/testrun/IBPA-C1636"
```

**Ответ:**
```json
{
  "key": "IBPA-C1636",
  "name": "Регресс проекта \"Прогнозы и счета (FIN)\"",
  "projectKey": "IBPA",
  "owner": "JIRAUSER61700",
  "testCaseCount": 176,
  "items": [
    {
      "testCaseKey": "IBPA-T2851",
      "status": "Pass",
      "executedBy": "JIRAUSER61700",
      "executionDate": "2026-05-27T08:15:30.276Z",
      "actualStartDate": "2026-05-27T08:10:32.206Z",
      "actualEndDate": "2026-05-27T08:15:30.276Z",
      "id": 29391
    }
  ]
}
```

**Поля items:**
| Поле | Описание |
|------|----------|
| `testCaseKey` | Ключ тест-кейса |
| `status` | Результат выполнения (Pass/Fail/Blocked/Not Executed) |
| `executedBy` | Кто выполнил |
| `executionDate` | Дата выполнения |
| `actualStartDate` | Фактическое начало |
| `actualEndDate` | Фактическое окончание |
| `assignedTo` | Назначен |

---

### 4. Поиск тест-прогонов
```
GET /rest/atm/1.0/testrun/search?query=<JQL>&maxResults=<N>&fields=<fields>
```

**Пример:**
```powershell
curl.exe -s "https://jira.ifellow.ru/rest/atm/1.0/testrun/search?query=projectKey%20%3D%20%22IBPA%22&maxResults=5&fields=key,name,owner,createdOn,testCaseCount"
```

**Ответ:**
```json
[
  {
    "key": "IBPA-C1641",
    "name": "Регресс проекта \"Прогнозы и счета (FIN)\" по типу проекта \"ПОСТАВКА\"",
    "owner": "JIRAUSER61700",
    "createdOn": "2026-06-05T10:00:00.000Z",
    "testCaseCount": 36
  }
]
```

---

## Нерабочие эндпоинты

| Endpoint | Статус | Причина |
|----------|--------|---------|
| `GET /rest/atm/1.0/testcycle/*` | 404 | Не реализован в Server v1 |
| `GET /rest/atm/1.0/testcycle/search` | 404 | Не реализован в Server v1 |
| `GET /rest/atm/1.0/testexecution/*` | 404 | Не реализован в Server v1 |
| `GET /rest/atm/1.0/statuses` | 404 | Не реализован в Server v1 |
| `GET /rest/atm/1.0/statuses?type=TEST_CASE` | 404 | Не реализован в Server v1 |
| `GET /rest/atm/1.0/project` | 500 | Не реализован |
| `GET /rest/atm/1.0/project/{key}` | 404 | Не реализован |
| `GET /rest/atm/1.0/folder` | 500 | Не реализован |
| `GET /rest/atm/1.0/environments` | 200 | Пустой ответ |
| `GET /rest/atm/1.0/testplan` | 500 | Не реализован |
| `GET /rest/atm/1.0/reference-data/statuses` | 404 | Не реализован |
| `GET /rest/atm/1.0/testcase?testCaseIds=3,4` | 500 | Не поддерживает batch по ID |

---

## Статусы тест-кейсов

### Системные (JavaDoc: `TestCaseStatusModel`)
| Статус | Метод проверки |
|--------|---------------|
| `Approved` | `isApproved()` |
| `Draft` | `isDraft()` |
| `Deprecated` | `isDeprecated()` |

### Кастомные (найдены в проекте IBPA)
| Статус | Описание |
|--------|----------|
| `Автоматизирован` | Автоматизированные тесты |
| `Готов к автоматизации` | Готовы к автоматизации |
| `Требует автоматизации` | Требуют автоматизации |

### Результаты прогона (JavaDoc: `TestExecutionStatusModel`)
| Результат | Метод проверки |
|-----------|---------------|
| `Pass` | `isPass()` |
| `Fail` | `isFail()` |
| `Blocked` | `isBlocked()` |
| `In Progress` | `isInProgress()` |
| `Not Executed` | `isNotExecuted()` |

---

## Особенности и ограничения

### 1. Пагинация
- `maxResults` максимум 500
- Используй `startAt` для получения следующих страниц:
  - Страница 1: `startAt=0&maxResults=500`
  - Страница 2: `startAt=500&maxResults=500`
  - Страница 3: `startAt=1000&maxResults=500`

### 2. Batch-запросы
- `key IN (...)` работает для батчей до ~50 ключов
- Для больших проектов (6500+ TC) — загружать только видимые на странице

### 3. Формат ключей
- Ключи вида `IBPA-T3` (проект + номер)
- URL содержит числовой ID (`/testCase/1218`), не строковый ключ
- API работает со строковыми ключами

### 4. Кеширование
- Рекомендуется кешировать результаты по ключу тест-кейса
- Кеш действителен до перезагрузки страницы
- При смене группировки — кеш сохраняется

### 5. CORS
- Content script на том же домене — CORS не блокирует
- Popup расширения — нужен `host_permissions` для домена Jira
- `credentials: 'omit'` работает только в контексте расширения

### 6. Тест-прогон (testrun)
- Содержит `items` с результатами выполнения
- Каждый item имеет `testCaseKey`, `status`, `executedBy`, даты
- Используется для отображения результатов в Test Player

---

## Примеры использования

### Загрузка статусов для видимых тест-кейсов
```javascript
// 1. Извлечь ключи из DOM
var keys = ['IBPA-T2851', 'IBPA-T2865', 'IBPA-T2929'];

// 2. Batch-запрос
var query = 'key IN (' + keys.map(k => '"' + k + '"').join(',') + ')';
var url = '/rest/atm/1.0/testcase/search?query=' + encodeURIComponent(query) 
  + '&maxResults=' + keys.length 
  + '&fields=key,name,status,lastTestResultStatus,priority,folder';

// 3. Кеширование по ключу
fetch(url).then(r => r.json()).then(cases => {
  cases.forEach(tc => {
    keyCache[tc.key] = {
      name: tc.name,
      status: tc.status,
      lastResult: tc.lastTestResultStatus,
      priority: tc.priority,
      folder: tc.folder
    };
  });
});
```

### Получение результатов тест-прогона
```javascript
fetch('/rest/atm/1.0/testrun/IBPA-C1636')
  .then(r => r.json())
  .then(run => {
    console.log(run.name); // "Регресс проекта..."
    console.log(run.testCaseCount); // 176
    run.items.forEach(item => {
      console.log(item.testCaseKey, item.status); // "IBPA-T2851" "Pass"
    });
  });
```
