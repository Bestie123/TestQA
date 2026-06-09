---
title: Jira Authentication & Structure (Jira Server)
---

# Аутентификация и структура Jira для Zephyr Sync

> Doc-ID: JIRA-AUTH-1 | Дата: 02.06.2026 | Связанные: [ARCH-1]

## Инстансы Jira

| Инстанс | URL | Назначение |
|---------|-----|------------|
| **Dev** | `https://devjira.ifellow.ru` | Ручное тестирование тест-кейсов |
| **Prod** | `https://jira.ifellow.ru` | Zephyr Scale — TC, тестовые прогоны, синхронизация |

## Аутентификация

Для каждого инстанса — отдельный Personal Access Token (PAT).

### Где создать

Профиль пользователя → вкладка **«Персональные токены доступа»** → «Создать токен».
URL: `https://<instance>/secure/ViewProfile.jspa`

### Хранение (credentials.json)

Файл `~/.qtest/credentials.json` поддерживает несколько профилей:

```json
{
  "profiles": {
    "dev": {
      "host": "https://devjira.ifellow.ru",
      "token": "<DEV_PAT>",
      "user": "devuser@ifellow.ru",
      "type": "pat"
    },
    "prod": {
      "host": "https://jira.ifellow.ru",
      "token": "<PROD_PAT>",
      "user": "produser@ifellow.ru",
      "type": "pat"
    }
  },
  "default": "dev",
  "zephyr": "prod"
}
```

- `default` — профиль по умолчанию (для dev-доступа)
- `zephyr` — профиль для Zephyr Sync (загрузка TC, интеграция с прогонами)
- Для новой учётки — просто заполни `user`, `token` и обнови `zephyr`

## Структура страниц devjira.ifellow.ru

### Верхнее меню (основные разделы)

| Пункт | URL / Назначение |
|-------|-----------------|
| **Рабочий стол** | `/secure/Dashboard.jspa` |
| **Проекты** | `/browse/<PROJECT>` — просмотр проектов |
| **Задачи** | `/issues/` — поиск и просмотр задач |
| **Структура** | Плагин Structure |
| **Plans** | Advanced Roadmaps for Jira |
| **Календарь** | Плагин календаря |
| **WorklogPRO** | Учёт рабочего времени (табели, отчёты) |
| **Insight** | CMDB / Asset Management (объекты, схемы) |
| **Создать** | `/secure/CreateIssue.jspa` — создание задачи |
| **Поиск** | `/secure/QuickSearch.jspa` — быстрый поиск |

### Профиль пользователя

| Страница | URL | Назначение |
|----------|-----|------------|
| **Профиль** | `/secure/ViewProfile.jspa` | Сводка, аватар, контакты |
| **Персональные токены доступа** | `/secure/ViewProfile.jspa` (вкладка) | PAT management |
| **Настройки** | `/secure/UpdateUserPrefs.jspa` | Язык, часовой пояс, уведомления |

### Администрирование

- Доступно пользователю `mihail.nikulenkov@ifellow.ru` (права: Управление пользователем)

### Плагины (установлены)

- **WorklogPRO** — табели учёта рабочего времени
- **Structure** — иерархическая структура задач
- **Advanced Roadmaps** — планирование релизов
- **Insight (Asset Management)** — CMDB, объекты, схемы
- **Calendar** — календарь

### REST API

- **Jira API:** `https://devjira.ifellow.ru/rest/api/latest/`
- **Zephyr Scale API:** `https://devjira.ifellow.ru/rest/zephyr/latest/`
- **Аутентификация:** `Authorization: Bearer <PAT_TOKEN>`

## Zephyr Scale API

- **Web UI:** `https://jira.ifellow.ru/secure/Tests.jspa` — ✅ работает
- **REST API (search):** `/rest/tests/latest/testcase/search?projectKey=IBPA` → ✅ **200** (работает!)
- **REST API (устаревший):** `/rest/tests/latest/testcase?projectKey=IBPA` → ⚠️ 500
- **REST API (zephyr legacy):** `/rest/zephyr/latest/` → ❌ 302

### Пример ответа

```
GET /rest/tests/latest/testcase/search?projectKey=IBPA&maxResults=2
Authorization: Bearer <PAT>
```

```json
{
  "results": [{
    "key": "IBPA-T3",
    "name": "(SMOKE) Проверка создания Доходного договора",
    "status": { "name": "Approved" },
    "precondition": "Открыта тестовая Jira...",
    "folder": { "name": "Создание Договора", "parent": {...} },
    "priority": { "name": "Normal" },
    "testScript": { "steps": [{ "description": "Нажать...", "testData": "", "expectedResult": "..." }] },
    "owner": "JIRAUSER18603"
  }],
  "total": 7331,
  "startAt": 0,
  "maxResults": 2
}
```

### Фильтрация и отбор тест-кейсов

Zephyr Scale API `/rest/tests/latest/testcase/search` **не фильтрует на сервере** — все параметры (`folderId`, `status`, `name`, `priority`, `textSearch` и т.д.) игнорируются. SPA-интерфейс Zephyr Scale загружает ВСЕ TC проекта и фильтрует их **клиентски** в браузере.

#### Доступные фильтры в Zephyr Scale UI (клиентские)

| Фильтр | Где применяется | Статус в нашей реализации |
|--------|----------------|--------------------------|
| **Папка (Folder tree)** | Боковая панель, выбор папки из дерева | ⏳ После синхронизации — клиентская фильтрация по полю `folder.name` |
| **Наименование (Name)** | Поисковая строка | ⏳ Клиентский поиск по `name` |
| **Статус (Status)** | Выпадающий список статусов | ⏳ Клиентский фильтр по `status.name` |
| **Приоритет (Priority)** | Выпадающий список приоритетов | ⏳ Клиентский фильтр по `priority.name` |
| **Дата создания (Created on)** | Датапикер | ⏳ Клиентский фильтр по `createdOn` |
| **Дата обновления (Updated on)** | Датапикер | ⏳ Клиентский фильтр по `updatedOn` |
| **Теги (Labels)** | Поле ввода тегов | ⏳ Клиентский фильтр по `labels` |
| **Автор (Owner)** | Поиск пользователя | ⏳ Клиентский фильтр по `owner` |
| **Прогон (Test Run)** | Выбор из списка | ✅ Уже реализовано (`POST /api/zephyr/sync/testrun`) |

#### Почему API игнорирует параметры фильтрации

| Параметр | HTTP статус | Результат |
|----------|-----------|-----------|
| `?folderId=6` | 200 | ⚠️ total = 7331 (все TC, фильтр проигнорирован) |
| `?textSearch=SMOKE` | 200 | ⚠️ total = 7331 (все TC) |
| `?status=Approved` | 200 | ⚠️ total = 7331 |
| `?priority=Normal` | 200 | ⚠️ total = 7331 |
| `?createdAfter=2024-01-01` | 200 | ⚠️ total = 7331 |
| `?folderId=99999` | 200 | ⚠️ total = 7331 (даже несуществующая папка) |

**Вывод:** Zephyr Scale (SmartBear TM) для Jira Server не поддерживает server-side фильтрацию TC. Фильтрация возможна только после загрузки всех TC с пагинацией и фильтрации на клиенте.

#### Как реализована фильтрация в Web UI

1. `POST /api/zephyr/sync` — загружает все TC проекта (с пагинацией) и сохраняет в локальную БД
2. `POST /api/zephyr/sync/testrun` — загружает TC из конкретного тестового прогона
3. Клиентская фильтрация по папке/статусу/названию — на стороне браузера после загрузки данных

| Эндпоинт | Параметры | Результат |
|----------|-----------|-----------|
| `GET /rest/tests/latest/testcase/search` | `projectKey`, `maxResults`, `startAt` | Пагинированный список TC |
| `GET /rest/tests/latest/testrun/search` | `projectKey`, `maxResults` | Список тестовых прогонов |
| `GET /rest/tests/latest/testplan/search` | `maxResults` | Список тест-планов |
| `GET /rest/api/latest/project` | — | Список проектов Jira |
| `GET /rest/api/latest/serverInfo` | — | Информация о Jira (версия) |

## Jira REST API

- **Базовый URL:** `https://devjira.ifellow.ru/rest/api/latest/`
- **Аутентификация:** `Authorization: Bearer <PAT_TOKEN>`

## Пользователь

- **Логин:** `mihail.nikulenkov@ifellow.ru`
- **Имя:** Никуленков Михаил Михайлович
- **Права:** Администрирование (Управление пользователем)
- **Группы:** All Staff, Elma365, jira-servicedesk-users, JiraDevTeam, Project

## Принятые решения

1. PAT как основной метод аутентификации (безопаснее Basic Auth)
2. Credentials хранятся в `~/.qtest/credentials.json` (не в репозитории)
3. Приоритет загрузки: конфиг-файл → env vars → defaults
