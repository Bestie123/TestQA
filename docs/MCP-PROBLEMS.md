# Проблемы и решения: MCP-сервер для wiki.ifellow.ru и jira.ifellow.ru

## Проблема #1: Zephyr Scale API недоступен

### Симптом
При обращении к `/rest/tests/latest/projects` возвращается **404 Not Found**.
При обращении к `/rest/zephyr/latest/projects` возвращается **302 Redirect** на страницу логина.

### Причина
Плагин Zephyr Scale (`com.kanoah.test-manager`) использует **собственный механизм авторизации**, отличный от стандартного Jira REST API. PAT-токен (Personal Access Token) Jira **не передаётся** в запросах к Zephyr Scale API — плагин требует либо:
- Cookie-based сессию (как в браузере)
- Либо особый API-ключ Zephyr Scale (отдельный от Jira PAT)

### Решение
**Обойти Zephyr Scale API**, используя стандартный Jira REST API (`/rest/api/2/`):
- Тест-кейсы Zephyr Scale — это обычные Jira Issues с типом `"Тест кейс"`
- Можно искать через JQL: `project=IBPA AND summary~"текст" AND issuetype="Тест кейс"`
- Детали получить через `/rest/api/2/issue/{key}`

### Код
```javascript
// ❌ Не работает (404/302)
/rest/tests/latest/testcases?projectKey=IBPA&search=доходы
/rest/zephyr/latest/testcases?projectKey=IBPA

// ✅ Работает
/rest/api/2/search?jql=project=IBPA AND summary~"доходы" AND issuetype="Тест кейс"
/rest/api/2/issue/IBPA-T3772?fields=summary,status,description
```

---

## Проблема #2: Confluence Wiki API требует аутентификации

### Симптом
При обращении к `https://wiki.ifellow.ru/rest/api/content` возвращается **401 Unauthorized** или **302 Redirect** на страницу логина.

### Причина
Wiki-сервер (Confluence) требует отдельную аутентификацию. PAT-токен Jira **не подходит** для Confluence.

### Решение
Пока нет API-доступа — **использовать CDP (Chrome DevTools Protocol)** для чтения страниц wiki через авторизованный браузер.

### Код
```javascript
// Через CDP (работает)
chrome-devtools_cdp_navigate → https://wiki.ifellow.ru/pages/viewpage.action?pageId=32971587
chrome-devtools_cdp_get_text → [содержимое страницы]
```

---

## Проблема #3: Лимитация Jira API — нет вложенности тест-кейсов

### Симптом
Zephyr Scale хранит тест-кейсы в **папках** (дерево), но Jira REST API не отдаёт информацию о папках Zephyr.

### Решение
Получать папку из **метаданных Issue** через поле `components` или искать по пути в `labels`. либо просто возвращать URL на Zephyr UI.

---

## Проблема #4: Разные проекты IBPA vs IBPA2

### Симптом
Проект **IBPA** — это основной проект с тест-кейсами Zephyr Scale (проект "Автоматизация iFellow").
Проект **IBPA2** — это проект "Автоматизация iFellow 2.0" (BI-отчёты, DWH).

Тест-кейсы про "Прогнозы и счета" находятся в **IBPA**, а не в IBPA2.

### Решение
При поиске **всегда указывать projectKey=IBPA** для тест-кейсов по бизнес-процессам (Прогнозы, Счета, Договоры).

---

## Проблема #5: Статус "Устаревший" в Zephyr Scale

### Симптом
Некоторые тест-кейсы имеют статус **"Устаревший"** (Deprecated), но API не отдаёт этот статус в фильтрах.

### Решение
При поиске **фильтровать результаты** по статусу на клиенте.

---

## Итоговая архитектура MCP-сервера

```
┌─────────────────────────────────────────────────────┐
│                  MCP-сервер wiki-search              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  wiki_search ───► Confluence REST API (401/302)     │
│                   └──► CDP fallback (браузер)       │
│                                                     │
│  zephyr_search ─► Jira REST API /rest/api/2/search  │
│                   (JQL: issuetype="Тест кейс")      │
│                                                     │
│  zephyr_get_case ► Jira REST API /rest/api/2/issue  │
│                                                     │
│  jira_search ───► Jira REST API /rest/api/2/search  │
│                   (любые типы задач)                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Источники

| Источник | URL | Доступ |
|---|---|---|
| Wiki (Confluence) | https://wiki.ifellow.ru | Через браузер (CDP) |
| Jira REST API | https://jira.ifellow.ru/rest/api/2/ | PAT-токен ✅ |
| Zephyr Scale API | /rest/tests/latest/ | ❌ 404/302 |
| Zephyr Scale UI | https://jira.ifellow.ru/secure/Tests.jspa | Через браузер (CDP) |
