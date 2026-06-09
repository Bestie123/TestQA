# Активная цель (сохранено 05.06.2026 02:55)

## Главная цель
Завершить qtest-runner: E2E цепочка, тестовые прогоны (Test Cycles), полный Zephyr-стиль в Web UI.

## ТЕКУЩИЕ ПРОБЛЕМЫ ДЛЯ РЕШЕНИЯ

⚠️ **Все 10 проблем решены.** См. "Исправленные проблемы" ниже.

## MCP Servers (✅ РАБОТАЮТ)
- `chrome-devtools_cdp_*` — Chrome DevTools Protocol (встроенные в opencode)
- `zephyr-scale` — Zephyr Scale API (7 инструментов)
- `browser-devtools` — Chrome DevTools wrapper (10 инструментов)
- `regression-test` — Тестирование регрессий с логированием (5 инструментов)

**Проверка:** Chrome запущен с `--remote-debugging-port=9222`

## Новый функционал (✅ ДОБАВЛЕН)

### Regression-test MCP
- Инструменты: test_fullscreen, test_layout, test_load_time, get_logs, clear_logs
- Логирование всех действий в `regression-test.log`
- Просмотр логов через get_logs
- Очистка логов через clear_logs

### Исправленные проблемы
1. ✅ Регресс: сайт не на весь экран (sidebar missing display: flex)
2. ✅ Лимит 500 прогонов (реализована пагинация)
3. ✅ Лимит 100 тест-кейсов (реализована пагинация)
4. ✅ Счетчики в дереве папок для прогонов
5. ✅ Медленная загрузка (ленивая загрузка + локальная БД)
6. ✅ Настройки токенов/паролей/логинов (SettingsPage + "Проверить подключение")
7. ✅ Синхронизация отдельных элементов (кнопки 🔄 для папок/прогонов/TC)
8. ✅ Дата импорта (import_date с точностью до секунд)
9. ✅ Фильтры Zephyr-стиля (10 критериев для TC, 5 для Cycles, 2 для Plans)
10. ✅ Логирование (regression-test MCP: get_chrome_status, test_filter_panel)

## Промпт для новой сессии
1. `qtest-runner/mcp-servers/FINAL-PROMPT.md` — финальный промт
2. `qtest-runner/mcp-servers/ADVANCED-PROMPT.md` — продвинутый промт
3. `qtest-runner/mcp-servers/REGRESSION-FIX-PROMPT.md` — исправление регрессий

## Анализ реального Zephyr (✅ ПРОВЕДЁН)
Через Chrome DevTools проанализированы:
1. Фильтры Test Cases (10 критериев)
2. Структура Test Cycles (API endpoints)
3. Дерево папок (53KB)

**Документация:**
- `qtest-runner/mcp-servers/zephyr-filter-analysis.md`
- `qtest-runner/mcp-servers/zephyr-cycle-analysis.md`

## Промпт для новой сессии (прочитай этот файл ПЕРВЫМ!)
При старте новой сессии:
1. Прочитай `TestQA/README.md` — обзор проекта
2. Прочитай `TestQA/ACTIVE_GOAL.md` (этот файл) — цели и статус
3. Прочитай `TestQA/docs/reference/zephyr-ui-analysis.md` — полный анализ UI Zephyr Scale
4. Прочитай `TestQA/qtest-runner/docs/reference/jira-authentication.md` — Jira/Zephyr настройки

## Контекст: что сделано в предыдущей сессии

### Jira доступ
- **URL:** https://jira.ifellow.ru (Jira Server 8.20.13)
- **Zephyr Scale:** v9.23.0 (Kanoah Test Manager by SmartBear)
- **Текущий пользователь:** mihail.nikulenkov@ifellow.ru (Никуленков Михаил Михайлович)
- **Текущий проект:** IBPA2 (projectId=18400)
- **Аутентификация:** Keycloak SSO (corp.ifellow.ru) — браузерная сессия сохранена в `chrome-data/Auto/`
- **Креденшиалы:** `~/.qtest/credentials.json` (multi-profile dev+prod)

### Анализ UI через реальный браузер
Открыты через Chrome DevTools (CDP, порт 9222), проанализирован HTML:
1. `#/v2/testCases?projectId=18400` — страница TC
2. `#/v2/testCycles?projectId=10904` — страница прогонов (через data-testid="zscale-testcycle-library")

**Ключевые data-testid:**
- `status-lozenge`, `priority`, `key`, `name`, `major-version`, `last-execution-status`
- `folder-tree-container`, `folder-item-{id}`, `folder-name-with-count-{id}`
- `pagination`, `pagination-details`, `ktm-search-trigger`
- `zephyr-scale-project-selector`
- `zscale-testcase-library`, `zscale-testcycle-library`, `zscale-testplan-library`

### Рефакторинг SyncPage (DONE)
- Левая панель: дерево папок с chevron и счётчиками
- Навигация: вкладки Тест кейсы | Тестовые прогоны | Планы тестирования
- Таблица: checkbox, priority(П), key, version(B), name, status(Статус), R, actions
- Status lozenges: зелёный (Утверждено), оранжевый (Черновик), красный (Deprecated)
- Priority: цветные кружки 12px (Medium=#ffa900, Highest=красный, Low=зелёный)
- Фильтры: expandable панель (Статус/Приоритет/Автор/Папка)
- Пагинация: 100 строк/страница
- Select all checkbox

## Статус

### ✅ Завершённые шаги
1. **Phase 0-6** — все 6 фаз плана выполнены (MCP, API, Zephyr Sync, Web UI, Tests, Docs)
2. **Анализ Zephyr UI** — обе страницы (TC + Cycles) проанализированы в реальном браузере
3. **Zephyr UI doc** — создан `docs/reference/zephyr-ui-analysis.md` (Doc-ID: ZEPHYR-UI-1)
4. **SyncPage refactoring** — Zephyr-стиль: статусы, приоритеты, пагинация, фильтры, дерево папок
5. **Jira URL fix** — подтверждён: `#/testCase/{key}?projectId={id}` (НЕ `/browse/`)
6. **Bug fixes (03.06, полные):**
   - Bugs #1-16: fullscreen, папки, сортировка, resize, counts, SettingsPage, RecorderPage, ReportsPage, ErrorBoundary, Tab Switch, фильтр папок, sticky headers, Docs iframe, tabs Отчёты/Конфигурация, nav Выполнения
   - Status display: `STATUS_DISPLAY` map (Approved→Утверждено, Draft→Черновик, Deprecated→Устаревший), `STATUS_COLORS` с `statusColor()` helper
   - ExecutionPage: `executionId: string | null` + empty state
   - SettingsPage credentials: full CRUD для `~/.qtest/credentials.json`
   - TestCaseList: pagination 100/page + Zephyr diff button + natural sort by key (`naturalSortKey()`)
   - Folder click reload + highlight: `FolderTreeItem` сравнивает `path` с `filterFolder`
   - Backend API: `GET /api/credentials` + `PUT /api/credentials`
   - Всего: **24 бага исправлено**
7. **Git cleanup:** untrack `chrome-data/` (10K+ файлов), `*.db-shm/*.db-wal/*.db.bak` из git индекса
8. **Docs rename:** `ARCHITECTURE.md`→`architecture.md`, `STATUS.md`→`status.md` (lowercase для VitePress)
9. **CHANGELOG.md** обновлён
10. **mcp-chrome-devtools** пакет добавлен в репозиторий
11. **Commit & push** — `2e636d6 Bugfix session: 24 исправления + git cleanup`
12. **VitePress build** — `npm run docs:build` проходит успешно
13. **E2E цепочка Recorder → Zephyr** (03.06, коммит `349dcce`):
    - `zephyr-client.ts`: новая `createZephyrTestCase()` — POST `/rest/tests/latest/testcase`
    - `index.ts`: новый `POST /api/zephyr/publish` с fallback — Zephyr → локально
    - `api.ts`: `publishToZephyr()` функция
    - `RecorderPage.tsx`: синяя кнопка "Опубликовать в Zephyr"
    14. **Test Cycles filter panel + detail view** (03.06, коммиты `52f3300`, `006d81c`):
     - Click-through cycle → test cases with execution results (PASS/FAIL/SKIPPED/BLOCKED badges)
     - Status filter panel for cycles tab (auto-collected from loaded runs)
     - React.Fragment fix for tbody children
    14. **TestCaseDetail: projectId в URL** (03.06, коммит `bd2d120`):
    - Добавлен `project_id` в `TestCase` interface (`api.ts`)
    - Кнопка "Открыть в Zephyr" теперь включает `?projectId=`
15. **TestCaseDetail: статус-цвета** (03.06, коммит `8d2e21f`):
    - Добавлены `STATUS_DISPLAY` + `statusDisplay()` в TestCaseDetail
    - Русские варианты статусов в `STATUS_COLORS` (Утверждено, Черновик и т.д.)
    - Badge показывает русское название статуса
16. **Server-side pagination** (03.06, коммит `e6ca571`):
    - `GET /api/testcases`: добавлены `limit`/`offset`, возвращает `{ data, total }`
    - `fetchTestCases()` в api.ts: новый формат ответа
    - `TestCaseList.tsx`: пагинация через сервер (limit=100, offset=page*100)
17. **Анализ TC Detail в Zephyr** (03.06, коммит `43328e5`):
    - Реальный браузер: открыта страница TC IBPA-T3
    - Задокументирована полная структура: header, 7 табов, collapsible секции, типы полей
    - Froala feature flag OFF — редактор в read-only режиме
    - CSS селекторы для автоматизации
18. **Анализ вкладок Steps/Execution/History** (03.06):
    - Steps: 3 колонки (Шаг/Тестовые данные/Ожидаемый результат) через Froala rich-text
     - Execution: Table с 13 колонками (Ключ, Статус, Дата, Расчётное, Фактическое, Присвоен в, Выполняется по, Релизная версия, Итерация, Окружение, Тестовый прогон, Задачи, Т)
    - History: version timeline с фильтром сравнения версий
19. **Рефакторинг publish endpoint** (03.06, коммит `31df426`):
    - Извлечён `saveTestCaseLocally()` в `importer.ts` — переиспользуемый helper
    - Inline SQL + `require('crypto')` заменены на вызов helper'а
20. **TC Detail page — табы + execution** (03.06, коммит `52cfe79`):
    - 3 таба (Подробнее, Шаги, Выполнение) в стиле Zephyr
    - Details: 2-колоночный layout (поля слева, метаданные справа)
    - Execution: таблица выполнений с badge статуса, датой, прогрессом шагов
    - `fetchTestCaseExecutions()` в api.ts — через API Gateway → execution-service
21. **🚨 ВОССТАНОВЛЕНИЕ после поломки opencode-конфига** (04.06):
    - Диагностика БД: `mcp-opencode-db` MCP → `opencode.db` → сессия `ses_17795c709ffe2whWKALxn2QOXC` показала 922k токенов и битый последний message
    - Backup: `opencode.db` (192MB) → `opencode-backup-2026-06-04.db`
    - Удалён дублирующий плагин `TestQA/.opencode/plugins/auto-commit.js` (конфликт с `autocommit.js` — оба экспортировали `AutoCommit`, оба коммитили на каждый edit)
    - Переписан `TestQA/opencode.json` в opencode-формат: `mcpServers` → `mcp`, `command: "node"` + `args` → `command: ["node", "path"]` массив, убрано `cwd`
    - **ДОКУМЕНТАЦИЯ:** добавлена секция `## 🚨 КРИТИЧЕСКИЕ ПРАВИЛА: opencode.json и .opencode/plugins` в `docs/rules/AGENTS.md` (Doc-ID: `OPENCODE-CONFIG-1`) — чтобы НЕ ПОВТОРЯТЬ ошибку
22. **Фильтры SyncPage до Zephyr-стиля** (04.06):
    - 10 критериев фильтрации для Test Cases: Наименование, Статус, Приоритет, Тег, Дата создания, Расчётное время, Компонент, Владелец, Покрытие (Задачи), Покрытие (Страницы)
    - Правильные контроли: text input (name, tag), select (status, priority, owner, component), date range (createdDate), number range (estimatedTime, coverageIssues, coveragePages)
    - Клиентская фильтрация через `applyFilters()` — фильтрует `testCases` по всем активным критериям
    - Сбор опций фильтров из загруженных данных (status, priority, owner, component, tag)
    - Фильтры для Test Cycles: Статус, Наименование, Ключ, Дата создания
    - Фильтры для Test Plans: Статус, Наименование, Ключ
    - Пустой результат: сообщение «Ничего не найдено по заданным критериям»
    - Документация: `zephyr-filter-analysis.md` обновлён с полным описанием всех контролей

### ⬜ Следующие шаги
_Все 10 проблем решены._ Дальнейшее развитие:
1. **Новые фичи по запросу**

### 🔄 В процессе
- _Все основные задачи завершены_

### ✅ Завершённые шаги (продолжение)
23. **Анализ реального Zephyr UI** (04.06):
    - Test Cases: 11 папок, 10 критериев фильтрации (Наименование, Статус, Приоритет, Тег, Дата создания, Расчётное время, Компонент, Владелец, Покрытие (Задачи), Покрытие (Страницы))
    - Test Cycles: 64 папки, 5 критериев фильтрации (Версии, Итерации, Статус, Кому назначено, План тестирования)
    - Test Plans: 1 папка, 2 критерия фильтрации (Статус, Тег)
24. **Исправление переключения вкладок** (04.06):
    - Дерево папок теперь меняется при переключении вкладок (cases → folders, cycles → cycleFolders, plans → planFolders)
    - Добавлены `loadCycleFolders()` и `loadPlanFolders()` функции
    - Фильтр папок очищается при переключении вкладок
    - Автоматическая загрузка данных при переключении вкладок
25. **Обновление фильтров** (04.06):
    - Test Cycles: Версии, Итерации, Статус, Кому назначено, План тестирования (вместо старых критериев)
    - Test Plans: Статус, Тег (вместо Статус, Наименование, Ключ)
26. **Bugfix: "React is not defined"** (04.06):
    - Причина: `React.Fragment` использовался в renderTestCycles (строки 1194, 1276), но `React` не был импортирован
    - Решение: добавлен `import React, { useState, useRef, useEffect } from 'react'` в SyncPage.tsx:1
    - Vite build: успешен (2.33s)
    - Фильтрация по активным критериям для каждого типа
27. **Test Cycles UI → Zephyr-стиль** (04.06):
    - Таблица: 6 колонок (Чекбокс, Key, Наименование, Ход выполнения, Статус, Settings) — как в реальном Zephyr
    - Убраны лишние колонки: "Всего TC" и "Создан" (НЕТ в реальном Zephyr)
    - Ссылки: Key и Наименование ведут на `#/testPlayer/{key}` (не `#/testCase/`)
    - Тулбар: "+ Новая папка", 🔍, ⋯, "+ New Test Cycle" (зелёный), Редактировать, Прогон, Клонировать, Удалить (disabled), Поиск, Группировать, Фильтры
    - Sidebar: root "Все тестовые прогоны (N)" + папки
    - Прогресс-бар: SVG 100×6px, rx=3, цвета #3abb4b/#ffa900/#e34938
    - Пагинация: 40 строк/страница, навигация по страницам
    - Select all checkbox для выбора всех циклов
    - Сортировка по умолчанию: Наименование (▲)
    - STATUS_DISPLAY: добавлены "Выполнен", "Не выполнен", "Выполняется"
    - STATUS_COLORS: добавлены цвета для новых статусов
    - Документация: `mcp-servers/zephyr-cycle-analysis.md` (Doc-ID: ZEPHYR-CYC-1)
28. **Test Cycles API optimization** (04.06):
    - API endpoint: `/rest/tests/latest/testrun/search` → `/rest/tests/1.0/testrun/search` с параметрами `fields`, `query`, `maxResults`, `startAt`, `archived`
    - `ZephyrTestRun` interface расширен: `folderId`, `iterationId`, `projectVersionId`, `environmentId`, `plannedStartDate`, `plannedEndDate`, `executionTime`, `estimatedTime`, `issueCount`, `testResultStatuses`, `owner`, `updatedOn`, `updatedBy`
    - `TestRun` interface в api.ts обновлён аналогично
    - Progress bar теперь использует `testResultStatuses` (pass+fail+skipped+blocked) / (total) вместо totalExecuted/totalTestCases
    - Folder filtering: `addFolderCounts` теперь совпадает по `folderId` (не только по `folder.path`)
    - Добавлены `findFolderById()` и `findFolderByPath()` helper'ы для навигации по дереву
    - Toolbar cycles: индикатор активной папки (📁 имя папки ×), счётчик прогонов
    - Build: 9/9 packages successful, 289/289 tests pass
29. **Sync tab performance optimization** (04.06):
    - In-memory cache (TTL 5 min) для всех GET-запросов к Zephyr API
    - `fetchFolderTreeFromApi()` — прямой запрос `/rest/tests/1.0/project/{id}/foldertree/{type}` вместо извлечения из TC
    - Parallel loading: `Promise.all([folders, testCases])` вместо последовательных запросов
    - CSS spinner при загрузке данных
    - Cache-clearing endpoint: `POST /api/zephyr/cache/clear`
    - Кэш автоматически очищается после sync операций
    - Build: 9/9 packages, 289/289 tests
30. **Local/Remote mode toggle for Sync** (04.06):
    - Data mode toggle: "Локальная БД" / "Zephyr (online)" в навигационных вкладках
    - Local DB tables: `test_runs` (25 колонок), `test_plans` (10 колонок) в testcases.db
    - Local API endpoints: `GET /api/local/testruns`, `GET /api/local/testplans`
    - Sync endpoints: `POST /api/local/sync/testruns`, `POST /api/local/sync/testplans`
    - `loadTestCases()` переключается между `/api/testcases` (local) и `/api/zephyr/testcases` (remote)
    - `loadTestRuns()` переключается между `/api/local/testruns` (local) и fetchZephyrTestRuns (remote)
    - `loadTestPlans()` переключается между `/api/local/testplans` (local) и fetchZephyrTestPlans (remote)
    - Кнопка "Синхронизировать в локальную БД" в секции синхронизации
    - Build: 9/9 packages, 289/289 tests
31. **Полная загрузка данных + кэширование + исправление лимитов** (04.06):
    - **Исправлен регресс:** zPage получил `height: '100%', width: '100%'` для корректного отображения на весь экран
    - **Убран лимит 500 прогонов:** `fetchTestRuns()` теперь загружает ВСЕ прогоны через постраничную пагинацию (500/страница, цикл пока `startAt < total`)
    - **Убран лимит 100 тест-кейсов:** `queryZephyrTestCases()` поддерживает `maxPages=0` (безлимит, до 999 страниц = ~200k TC)
    - **Полная загрузка при старте:** начальная загрузка TC теперь использует `maxPages=0` вместо `maxPages=1`
    - **Клиентское кэширование:** `fetchWithCache()` с TTL 5 мин для всех API-запросов в браузере
    - **Инвалидация кэша:** `invalidateCache()` вызывается после sync операций
    - **Дерево папок:** `loadCycleFolders` и `loadPlanFolders` загружаются с `maxPages=0` для полного дерева
    - **Счетчики в дереве папок:** работают корректно得益于 `addFolderCounts()` с полными данными
    - Build: 9/9 packages, 289/289 tests
32. **Импорт даты с точностью до секунд** (04.06):
    - Добавлено поле `import_date` в таблицу `test_cases` (миграция через ALTER TABLE)
    - `importTestCases()` теперь сохраняет `import_date` при каждом импорте
    - `saveTestCaseLocally()` также сохраняет `import_date`
    - Формат: ISO timestamp (2026-06-04T12:30:45.000Z)
    - Build: 9/9 packages, 289/289 tests
33. **Настройки: тест подключения для каждого профиля** (04.06):
    - Добавлена кнопка "Проверить подключение" для каждого профиля Jira/Zephyr
    - Индикация статуса: ✓ (успех) / ✗ (ошибка)
    - Автоматическое переключение профиля для теста и восстановление
    - Build: 9/9 packages, 289/289 tests
34. **Синхронизация отдельных элементов** (04.06):
    - Кнопка 🔄 для каждой папки в дереве папок (cases/cycles/plans)
    - Кнопка 🔄 для каждого тест-прогона в таблице
    - Кнопка 🔄 для каждого тест-кейса в таблице
    - Функции `syncFolder()`, `syncTestRun()`, `syncTestCase()`
    - Build: 9/9 packages, 289/289 tests
35. **Regression-test MCP: расширенное логирование** (04.06):
    - Добавлен инструмент `get_chrome_status` — статус Chrome CDP и список вкладок
    - Добавлен инструмент `test_filter_panel` — тестирование панели фильтров
    - Добавлена функция `getChromeTabs()` — получение списка вкладок через CDP
    - Все действия логируются в `regression-test.log`
    - Build: 9/9 packages, 289/289 tests
36. **UI сравнение с реальным Zephyr** (04.06):
    - Открыт реальный Zephyr через Chrome DevTools (CDP, порт 9222)
    - Проанализированы страницы: Test Cases (6021 TC), Test Cycles (1581), Test Plans, Reports
    - Исправлены отличия:
      - **Корневой счётчик**: "Все тест кейсы(6021)" / "Все тестовые прогоны(1581)" / "Все планы тестирования" — без пробела перед скобкой
      - **Тулбар Test Cases**: "Новый тест кейс" (зелёный), "Архивировать", "Клонировать", "Еще", "Фильтры"
      - **Тулбар Test Cycles**: "New Test Cycle" (зелёный), "Редактировать", "Прогон", "Клонировать", "Удалить", "Группировать", "Фильтры"
      - **Тулбар Test Plans**: "Новый план тестирования" (зелёный), "Удалить", "Клонировать", "Фильтры"
      - **Пагинация**: формат "1 - 100из 6021" (тире, пробел, без пробела перед "из")
      - **Поиск**: placeholder "Поиск" (без "по имени или ключу...")
      - **Скролл страниц**: показ "…Skipped pages from X to Y…Z"
    - Build: 9/9 packages, 289/289 tests
37. **Исправлены критические баги пагинации** (04.06):
    - **Баг 1: queryZephyrTestCases** — Zephyr API возвращает макс. 100/страница (не 200)
      - Причина: `pageSize=200`, проверка `items.length < pageSize` → 100 < 200 → цикл останавливался после 1 страницы
      - Решение: `pageSize=100`, проверка `startAt >= totalFromApi`
      - Результат: 100-300 TC → **7404 TC** (все)
    - **Баг 2: fetchTestRuns** — `encodeURIComponent` ломал запрос к v1.0 API
      - Причина: `encodeURIComponent` превращал `+` (пробел) в `%2B` → API возвращал 400 Bad Request
      - Решение: `encodeURIComponent(query).replace(/%20/g, '+')` — правильное кодирование
      - Результат: 500 (ошибка) → **1581 прогон** (все)
    - **Баг 3: API timeout** — `AbortSignal.timeout(30000)` слишком короткий для больших объёмов
      - Решение: увеличен до 120000ms (2 мин) для paginated запросов
    - Build: 9/9 packages, 289/289 tests
38. **Оптимизация скорости загрузки** (04.06):
    - **Проблема:** Zephyr API: 100 items = 10-13 сек. Загрузка всех 7404 TC = 74 страницы × 13 сек = **16 минут**
    - **Решение:** загружаем только первую страницу (100 TC) по умолчанию, как реальный Zephyr
    - **Реализация:**
      - `useEffect` загружает `maxPages=1` (первые 100 TC, ~13 сек)
      - Кнопка "Загрузить все" для полной загрузки (`maxPages=0`)
      - `loadTestRuns()` загружает все прогоны (500/страница, ~1.5 сек на страницу)
    - **Сравнение скоростей:**
      - Реальный Zephyr: мгновенно (кэширует на сервере)
      - Наша страница: ~13 сек (первая страница) вместо 16 минут
    - Build: 9/9 packages, 289/289 tests
30. **Local/Remote mode toggle for Sync** (04.06):
    - Data mode toggle: "Локальная БД" / "Zephyr (online)" в навигационных вкладках
    - Local DB tables: `test_runs` (25 колонок), `test_plans` (10 колонок) в testcases.db
    - Local API endpoints: `GET /api/local/testruns`, `GET /api/local/testplans`
    - Sync endpoints: `POST /api/local/sync/testruns`, `POST /api/local/sync/testplans`
    - `loadTestCases()` переключается между `/api/testcases` (local) и `/api/zephyr/testcases` (remote)
    - `loadTestRuns()` переключается между `/api/local/testruns` (local) и fetchZephyrTestRuns (remote)
    - `loadTestPlans()` переключается между `/api/local/testplans` (local) и `/api/zephyr/testplans` (remote)
    - Кнопка "Синхронизировать в локальную БД" в секции синхронизации
    - Build: 9/9 packages, 289/289 tests
31. **Полная загрузка данных + кэширование + исправление лимитов** (04.06):
    - **Исправлен регресс:** zPage получил `height: '100%', width: '100%'` для корректного отображения на весь экран
    - **Убран лимит 500 прогонов:** `fetchTestRuns()` теперь загружает ВСЕ прогоны через постраничную пагинацию (500/страница, цикл пока `startAt < total`)
    - **Убран лимит 100 тест-кейсов:** `queryZephyrTestCases()` поддерживает `maxPages=0` (безлимит, до 999 страниц = ~200k TC)
    - **Полная загрузка при старте:** начальная загрузка TC теперь использует `maxPages=0` вместо `maxPages=1`
    - **Клиентское кэширование:** `fetchWithCache()` с TTL 5 мин для всех API-запросов в браузере
    - **Инвалидация кэша:** `invalidateCache()` вызывается после sync операций
    - **Дерево папок:** `loadCycleFolders` и `loadPlanFolders` загружаются с `maxPages=0` для полного дерева
    - **Счетчики в дереве папок:** работают корректно得益于 `addFolderCounts()` с полными данными
    - Build: 9/9 packages, 289/289 tests

39. **Bugfix: projectKey filter broken in local DB** (05.06):
    - Причина: `GET /api/local/testcases?projectKey=IBPA` использовал `project_id = ?` со значением 'IBPA', но в БД хранится числовой project_id '10904'
    - Решение: `key LIKE ?` с `${q.projectKey}-%` — корректная фильтрация по префиксу ключа
    - Результат: 0 → 6022 IBPA TC (project_id=10904)
40. **Bugfix: POST endpoints reject requests without body** (05.06):
    - Причина: Fastify v4 требует body для POST-запросов. Пустой POST без body → 400, без Content-Type → 415
    - Решение: 6 эндпоинтов без body конвертированы в GET:
      - `POST /api/zephyr/sync` → `GET /api/zephyr/sync`
      - `POST /api/zephyr/test-connection` → `GET /api/zephyr/test-connection`
      - `POST /api/zephyr/cache/clear` → `GET /api/zephyr/cache/clear`
      - `POST /api/local/sync/testcases` → `GET /api/local/sync/testcases`
      - `POST /api/local/sync/testruns` → `GET /api/local/sync/testruns`
      - `POST /api/local/sync/testplans` → `GET /api/local/sync/testplans`
    - UI обновлён: `{ method: 'POST' }` → `{ method: 'GET' }` в SyncPage.tsx
41. **Sync 7405 TC completed** (05.06):
    - Первый полный sync из Zephyr: 7405 TC за 408 сек (6.8 мин)
    - Локальная БД: 6022 IBPA + 724 GMSOL = 6746 TC
    - Build: 9/9 packages, 289/289 tests

## Архитектурные решения
- SyncPage использует `fetch()` напрямую Zephyr API (через testcase-service прокси), а не локальную БД
- Все стили inline (нет CSS файлов, как и в остальном проекте)
- data-testid атрибуты соответствуют Zephyr Scale для future-proof тестирования
- Pagination — клиентская (100 rows/page), фильтрация — клиентская (applyFilters на фронтенде)
- Fullscreen: page wrapper в `App.tsx` — `display:flex; flex-direction:column` чтобы страницы с `flex:1` заполняли доступную высоту
- Folder highlight: `activePath` передаётся напрямую в `FolderTreeItem`, каждый узел сам сравнивает свой `path` с `filterFolder`
- Status display: `STATUS_DISPLAY` map нормализует сырые статусы Zephyr API (Approved/Draft/Deprecated) к русским отображаемым именам; `statusDisplay()` используется в фильтрах, ячейках таблицы и отчётах
- Chrome-data, `*.db-shm/*.db-wal/*.db.bak` — untracked из git, `.gitignore` блокирует повторное отслеживание
- Docs имена: lowercase (VitePress требует точного соответствия)
- Publish endpoint: fallback-стратегия — сначала Zephyr API, потом локальное сохранение в любом случае. При ошибке Zephyr возвращается warning + 200 (не 500). Это обеспечивает E2E непрерывность в офлайн-режиме
- `createZephyrTestCase()` вызывается с `projectKey` (если не передан — из конфига), priority/convertedSteps передаются как Zephyr-объекты с `{ name: value }`
- Server-side pagination: LIMIT/OFFSET в SQL, возврат `{ data, total }`. COUNT-запрос для total — отдельный запрос (без `SQL_CALC_FOUND_ROWS`, не поддерживается SQLite)
- Формат ответа `{ data, total }` вместо голого массива — breaking change, но только 1 потребитель (TestCaseList)
- Фильтрация TC: клиентская через `applyFilters()` — Zephyr API не поддерживает серверную фильтрацию (все params игнорируются). Фильтры применяются к загруженным данным на фронтенде
- Filter criteria: 10 критериев с правильными контролами (text/select/date-range/number-range), добавляются по одному через dropdown «Добавить критерий»
- Filter state: `activeCriteria[]` (список активных полей), `filterValues{}` (значения), `filterOptions{}` (доступные опции из данных)
- **Per-tab folder trees**: каждая вкладка (cases/cycles/plans) имеет своё дерево папок (`folders`, `cycleFolders`, `planFolders`), загружается при переключении вкладки
- **Per-tab filter criteria**: Test Cases — 10 критериев, Test Cycles — 5 (Версии, Итерации, Статус, Кому назначено, План тестирования), Test Plans — 2 (Статус, Тег)
- **Auto-load on tab switch**: useEffect очищает `filterFolder` и загружает данные для активной вкладки
- **Zephyr API v1.0**: fetchTestRuns использует `/rest/tests/1.0/testrun/search` с `fields` параметром для получения всех полей (folderId, testResultStatuses, etc.)
- **Folder matching by ID**: addFolderCounts и фильтрация циклов совпадают по `folderId`, а не по строковому `path`
- **Progress from testResultStatuses**: progress bar рассчитывается из `testResultStatuses.pass/fail/skipped/blocked/unexecuted` вместо простого `totalExecuted/totalTestCases`
- **API caching**: In-memory cache с TTL 5 мин для всех GET-запросов к Zephyr API. Кэш очищается при sync операциях
- **Client-side caching**: `fetchWithCache()` в SyncPage.tsx — кэширует ответы API в браузере (TTL 5 мин). Инвалидируется при sync операциях через `invalidateCache()`
- **Unlimited pagination**: `maxPages=0` означает загрузку всех страниц (до 999 = ~200k записей). Используется для TC, test runs и folder trees
- **Parallel loading**: `Promise.all([folders, testCases])` загружает папки и данные одновременно
- **Import date precision**: поле `import_date` в `test_cases` хранит ISO timestamp с точностью до секунд (2026-06-04T12:30:45.000Z). Заполняется при каждом импорте/синхронизации
- **Individual sync**: кнопки 🔄 для папок, прогонов и тест-кейсов. Вызывают `syncFolder()`, `syncTestRun()`, `syncTestCase()` соответственно
- **Profile connection test**: кнопка "Проверить подключение" для каждого профиля Jira/Zephyr в SettingsPage. Использует `testZephyrConnection()` API
- **Zephyr API pagination limit**: Zephyr REST API возвращает макс. 100 элементов на страницу (независимо от `maxResults`). Нужно использовать `pageSize=100` и цикл `while (startAt < total)`
- **v1.0 API query encoding**: endpoint `/rest/tests/1.0/testrun/search` использует form encoding для `query` параметра — пробелы кодируются как `+`, а не `%20`. Использовать `encodeURIComponent(query).replace(/%20/g, '+')`
- **API timeout для paginated запросов**: `AbortSignal.timeout(120000)` (2 мин) для paginated запросов к Zephyr API, так как каждый запрос занимает 5-15 сек
- **Ленивая загрузка по умолчанию**: Zephyr UI загружает только первую страницу (100 TC) мгновенно, а не все 7404. Кнопка "Загрузить все" для полной загрузки. Это соответствует поведению реального Zephyr

## Как работает Sync (загрузка из реального Zephyr)

### Источник данных
- **Jira Server**: `https://jira.ifellow.ru` (v8.20.13)
- **Zephyr Scale**: v9.23.0 (Kanoah Test Manager)
- **Проект**: IBPA2 (projectId=18400) / IBPA (projectId=10904)
- **Аутентификация**: Bearer token из `~/.qtest/credentials.json`

### API endpoints (что вызывается)

| Вкладка | Endpoint | Описание |
|---------|----------|----------|
| Test Cases | `GET /rest/tests/latest/testcase/search?projectKey=IBPA&maxResults=200&startAt=0` | Постранично (200 TC/страница) |
| Test Cases (папки) | `GET /rest/tests/1.0/project/{id}/foldertree/testcase` | Дерево папок TC |
| Test Cycles | `GET /rest/tests/1.0/testrun/search?fields=...&query=...&maxResults=500` | Все прогоны проекта |
| Test Cycles (папки) | `GET /rest/tests/1.0/project/{id}/foldertree/testrun` | Дерево папок прогонов |
| Test Plans | `GET /rest/tests/latest/testplan/search?projectKey=IBPA` | Все планы |
| Test Plans (папки) | `GET /rest/tests/1.0/project/{id}/foldertree/testplan` | Дерево папок планов |
| Projects | `GET /rest/api/latest/project` | Список всех проектов Jira |

### Поток данных

```
Web UI (localhost:8080)
  → API Gateway (port 3000)
    → testcase-service (port 3001)
      → Zephyr API (jira.ifellow.ru)
        → ответ → кэш (5 мин) → Web UI
```

### Кэширование
- Все GET-запросы кэшируются на 5 минут в памяти testcase-service
- При sync операциях (syncAll, syncTestRun) кэш очищается
- POST `/api/zephyr/cache/clear` — ручная очистка кэша

### Как загрузить данные
1. **Test Cases**: открой вкладку "Тест кейсы" → автоматическая загрузка 200 TC + папок
2. **Test Cycles**: открой вкладку "Тестовые прогоны" → автоматическая загрузка всех прогонов + папок
3. **Test Plans**: открой вкладку "Планы тестирования" → автоматическая загрузка всех планов
4. **Полная sync**: кнопка "Синхронизировать все TC" → загружает ВСЕ TC из Zephyr в локальную БД

## Сессия: Kiro-подобный Tool Panel для opencode Desktop

### Главная цель
Создать `@opencode-ai/tool-panel` — пакет с UI и контекстными провайдерами для управления Specs, Hooks, Steering, MCP, Skills. Архитектура на основе анализа kiro.dev/docs (13+ страниц).

### ✅ Создано
1. **Платформенные типы** (`src/platform/types.ts`): `Spec`, `Hook`, `SteeringFile`, `MCPServer`, `Skill`, `ToolPanelPlatform` с полными IPC-контрактами
2. **Контекстные провайдеры** (5 шт): `ToolPanelProvider`, `SpecsProvider`, `HooksProvider`, `SteeringProvider`, `MCPProvider`, `SkillsProvider` — каждый с реактивным store (createStore) и методами CRUD
3. **ToolRailItem** (`src/components/ToolRailItem.tsx`): иконка `providers` в тултипе "Tools"
4. **ToolPanel** (`src/components/ToolPanel.tsx`): таб-контейнер (Specs/Hooks/Steering/MCP/Skills) с переключением через `activeTab`
5. **5 секций** (с карточками для каждого элемента):
   - `SpecsSection` — список Spec с тегами, edit/delete
   - `HooksSection` — чекбоксы enable, badge trigger, кнопка Run (arrow-right)
   - `SteeringSection` — карточки файлов с Edit/Refine
   - `MCPSection` — индикатор статуса (цветной кружок), transport badge, Restart
   - `SkillsSection` — version badge, View source
6. **EmptyState** — переиспользуемый компонент пустого состояния с иконкой, заголовком, описанием, action
7. **Экспорты** (`src/index.ts`): все провайдеры, компоненты, типы

### 🔧 Исправления типов
- `Spec`, `Hook`, `SteeringFile`, `MCPServer`, `Skill` дополнены полями `id`, `description`, `tags`, `version`, `source` и т.д.
- `ToolPanelPlatform` дополнен методами `edit()`, `openSource()`
- Все импорты типов в компонентах更正ны (из `platform/types`, а не из контекстов)
- `tsgo --noEmit` — чисто

### 📐 Ключевые решения
- **Иконки**: `providers` для тулза, `arrow-right` для Run, `reset` для Restart, `circle-check/color` для статуса MCP
- **Стилизация**: все inline class'ы в стиле codebase (`text-14-medium`, `bg-surface-base`, `rounded-lg`, etc.)
- **Store паттерн**: `createStore` + context + accessor-функции (`specs()`, `hooks()` и т.д.) + обёртки `create()/edit()/remove()` поверх platform IPC

### ✅ Интеграция в @opencode-ai/app (завершено)
1. **context/tool-panel.tsx** — `ToolPanelConfig` интерфейс + `ToolPanelConfigProvider` + `useToolPanelConfig()`
2. **app.tsx** — `AppInterface` получила `toolPanel?: { RailItem, Panel, Provider }` prop; дерево обёрнуто в `ToolPanelConfigProvider` + `tp.Provider`
3. **sidebar-shell.tsx** — новый проп `toolRailItem?: JSX.Element`, рендерится в нижней части rail'а (над Settings)
4. **layout.tsx** — потребляет `useToolPanelConfig()`, `toolPanelOpen` сигнал, условный рендер ToolPanel в sidebar panel вместо списка сессий
5. **Typecheck**: `@opencode-ai/app` + `@opencode-ai/tool-panel` — чисто (pre-existing custom-elements.d.ts ошибка не связана)

### ✅ Desktop IPC (завершено)
1. **preload/types.ts** — добавлены `ToolPanelSpec`, `ToolPanelHook`, `ToolPanelSteeringFile`, `ToolPanelMCPServer`, `ToolPanelSkill`, `ToolPanelAPI`, `ElectronAPI.toolPanel`
2. **main/ipc.ts** — 30 IPC каналов (`tool-panel:specs:*`, `tool-panel:hooks:*`, `tool-panel:steering:*`, `tool-panel:mcp:*`, `tool-panel:skills:*`) с electron-store persistence
3. **preload/index.ts** — `toolPanelAPI` объект с привязкой всех каналов через `ipcRenderer.invoke()`
4. **renderer/index.tsx** — `createToolPanelPlatform()` bridge (IPC ↔ ToolPanelPlatform), `ToolPanelProvider` обёртка, `toolPanel` prop в `AppInterface`

### ✅ Steering/Skills на файловой системе
1. **Steering** — `~/.opencode/steering/{id}.json`: `list()` сканирует директорию, `create()` пишет JSON, `delete()` unlink
2. **Skills** — `~/.opencode/skills/{id}.json`: `importFromGitHub/Local` создаёт manifest, `delete()` unlink, `openSource()` → `shell.openExternal()`
3. **ToolRailItem** — исправлен: теперь dumb-компонент (принимает `onClick`/`active` props), Layout управляет состоянием без дублирования

### ✅ Диалоги создания/редактирования
1. **FormDialog** — переиспользуемый модальный оверлей (Escape/overlay click close)
2. **SpecDialog** — имя, тип (feature/bugfix/quickplan), описание, теги
3. **HookDialog** — имя, событие, триггер, действие, команда, enabled
4. **SteeringDialog** — имя, описание, scope, inclusion, content (monospace textarea, 600px)
5. **MCPDialog** — имя, transport, command/args или url, env vars (560px)
6. **ImportDialog** — одно поле ввода + кнопка Import
7. Все 5 секций обновлены: create/edit через диалоги, сигналы `dialogOpen` + `editingItem`

### ✅ i18n интеграция
1. `tool-panel/src/i18n/{en,ru}.ts` — `export const dict` (как ui)
2. `app/src/context/language.tsx` — base включает `tpEn`, `ru` loader включает tool-panel, `RawDictionary` объединяет ключи
3. Импорт: `import { dict as tpEn } from "@opencode-ai/tool-panel/i18n/en"`
4. Пуш: `4549f0b` → `Bestie123/opencodedev dev`

### ✅ MCP restart через sidecar API
1. **Server**: `POST /mcp/:name/restart` endpoint (disconnect + connect) в `groups/mcp.ts` + `handlers/mcp.ts`
2. **Desktop IPC**: `getSidecarUrl` в Deps + `tool-panel:mcp:restart` вызывает sidecar API с Basic auth
3. **index.ts**: sidecarUrl/username/password сохраняются из `serverReady` deferred
4. **Test**: mock handler добавлен в `httpapi-mcp-oauth.test.ts`
5. Пуш: `e72270b` → `Bestie123/opencodedev dev`

### ⬜ Следующие шаги
1. `Edit` handler'ы в IPC (сейчас заглушки — открыть файл в редакторе)
2. Использовать i18n ключи в section компонентах (сейчас хардкод)
3. Переключить tool-panel:mcp:add/remove/list на sidecar API (сейчас electron-store)

## Заметки / вопросы
- Test Cycles API: ✅ ИСПРАВЛЕНО — теперь использует `/rest/tests/1.0/testrun/search` с полным набором полей
- Sync tab: ✅ ОПТИМИЗИРОВАН — кэш 5 мин, parallel loading, прямой folder API
- Zephyr Scale не поддерживает серверную фильтрацию — все filter params игнорируются API
- **🚨 Zephyr API limitation:** search endpoint `/rest/tests/latest/testrun/search` возвращает ТОЛЬКО `{id, key, name, projectId}`. Статус, прогресс, количество TC — НЕ входят в ответ. Для полных данных нужно использовать `/rest/tests/latest/testcase/search?cycleKey={key}` или individual lookups
- Приоритеты в Zephyr: хранятся как имена (Medium/High/Low) + CSS цвета
- Статусы в Zephyr: хранятся как русские/английские названия + CSS цвета lozenge
- `git rm --cached` с 10K+ файлами требует 180s timeout; на Windows лучше увеличить таймаут
- `git reset HEAD` с 10K+ изменений тоже таймаутится — для разделения коммитов удобнее добавлять только нужные файлы через `git add`
- **🚨 НИКОГДА не использовать VS Code формат в opencode.json** (`mcpServers`, `command: "string"`, `args`, `cwd`) — opencode игнорирует ВСЁ, ломаются все MCP-серверы, проект становится неработоспособным. Эталон — `docs/rules/AGENTS.md` → секция OPENCODE-CONFIG-1
- **🚨 НИКОГДА не создавать два плагина в `.opencode/plugins/` с одинаковым export name** — race condition на git commit, TUI зависает. Должен быть ОДИН файл
- При правке opencode.json — сначала `Copy-Item opencode.db opencode-backup-YYYY-MM-DD.db`
