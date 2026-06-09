# Анализ страницы Test Cycles в реальном Zephyr

## Дата анализа: 2026-06-04

## API Endpoints

### 1. Основной поиск тестовых прогонов
```
GET /rest/tests/1.0/testrun/search
Parameters:
- fields: id,key,name,folderId,iterationId,projectVersionId,environmentId,userKeys,environmentIds,plannedStartDate,plannedEndDate,executionTime,estimatedTime,testResultStatuses,testCaseCount,issueCount,status(id,name,i18nKey,color),customFieldValues,createdOn,createdBy,updatedOn,updatedBy,owner
- query: testRun.projectId+IN+(10904)+ORDER+BY+testRun.name+ASC
- maxResults: 40
- startAt: 0
- archived: false
Response: 3619 bytes, 295ms
```

### 2. Дерево папок тестовых прогонов
```
GET /rest/tests/1.0/project/10904/foldertree/testrun
Response: 53913 bytes (53KB!), 98ms
Содержит все папки для организации тестовых прогонов
```

### 3. Статусы результатов тестов
```
GET /rest/tests/1.0/project/10904/testresultstatus
Response: 573 bytes, 122ms
Содержит: PASS, FAIL, SKIPPED, BLOCKED, UNEXECUTED
```

### 4. Тест-кейсы в прогоне
```
GET /rest/tests/latest/testcase/search?maxResults=1&projectKey=IBPA&cycleKey=IBPA-C223
Response: 4243 bytes, 213ms
```

## Структура таблицы Test Cycles

| Колонка | CSS класс | Описание |
|---------|-----------|----------|
| Чекбокс | css-sf02ri e1ndmrt01 | Выбор строки |
| Key | css-cexjsx extpjnt0 | Ключ прогона (IBPA-C223) |
| Наименование | large css-cexjsx extpjnt0 | Название прогона |
| Ход выполнения | css-cexjsx extpjnt0 | Прогресс-бар (100%) |
| Статус | css-cexjsx extpjnt0 | Статус (Выполнен) |
| Действия | css-cexjsx extpjnt0 | Кнопки действий |

## Структура данных тест-прогона

```json
{
  "id": 12345,
  "key": "IBPA-C223",
  "name": "CRM - изменение процесса согласования КП",
  "folderId": 100,
  "iterationId": null,
  "projectVersionId": null,
  "environmentId": null,
  "status": {
    "id": 1,
    "name": "Выполнен",
    "i18nKey": "executed",
    "color": "#3abb4b"
  },
  "testCaseCount": 25,
  "issueCount": 0,
  "createdOn": "2026-01-15T10:30:00.000Z",
  "createdBy": "user1",
  "updatedOn": "2026-01-20T15:45:00.000Z",
  "updatedBy": "user1",
  "owner": "user1",
  "plannedStartDate": "2026-01-15T00:00:00.000Z",
  "plannedEndDate": "2026-01-20T23:59:59.000Z",
  "executionTime": 3600,
  "estimatedTime": 7200,
  "testResultStatuses": {
    "pass": 20,
    "fail": 3,
    "skipped": 1,
    "blocked": 1,
    "unexecuted": 0
  }
}
```

## Структура данных testresultstatus

```json
{
  "statuses": [
    {"id": 1, "name": "Pass", "color": "#3abb4b"},
    {"id": 2, "name": "Fail", "color": "#dc3545"},
    {"id": 3, "name": "Skipped", "color": "#ffa900"},
    {"id": 4, "name": "Blocked", "color": "#6a1b9a"},
    {"id": 5, "name": "Unexecuted", "color": "#97a0af"}
  ]
}
```

## Сравнение с нашим SyncPage

### Реальный Zephyr vs Наш SyncPage

| Аспект | Реальный Zephyr | Наш SyncPage | Статус |
|--------|-----------------|--------------|--------|
| Дерево папок | 53KB, полное дерево | Дерево для прогонов (cycleFolders) | ✅ ОК |
| Загрузка данных | Пагинация (40 записей) | Пагинация на клиенте (40/страница) | ✅ ОК |
| API endpoint | `/rest/tests/1.0/testrun/search` | `/rest/tests/1.0/testrun/search` (исправлено) | ✅ ОК |
| Поля данных | folderId, testResultStatuses, etc. | Расширенный ZephyrTestRun interface | ✅ ОК |
| Колонки | 6 колонок | 6 колонок | ✅ ОК |
| Статусы | Цветные badge | Цветные badge | ✅ ОК |
| Прогресс-бар | Есть (из testResultStatuses) | Есть (из testResultStatuses) | ✅ ОК |
| Фильтры | Версии, Итерации, Статус, Кому, План | 5 критериев | ✅ ОК |
| Расширение строк | Клик → детализация | Клик → детализация | ✅ ОК |
| Фильтрация по папкам | folderId совпадение | folderId совпадение | ✅ ОК |

### Критические проблемы

1. **Дерево папок**: В реальном Zephyr есть дерево папок для тестовых прогонов (53KB). У нас его нет.

2. **Загрузка данных**: В реальном Zephyr используется пагинация (40 записей за раз). У нас загружаются все данные сразу.

3. **API endpoint**: В реальном Zephyr используется `/rest/tests/1.0/testrun/search` с параметрами. У нас используется другой endpoint.

4. **Поля данных**: В реальном Zephyr есть много полей: folderId, iterationId, projectVersionId, environmentId, userKeys, environmentIds, plannedStartDate, plannedEndDate, executionTime, estimatedTime, testResultStatuses.

### Рекомендации (выполнено)

1. **✅ Добавить дерево папок**: Загружается `/rest/tests/1.0/project/{projectId}/foldertree/testrun` и отображается в левой панели.

2. **✅ Оптимизировать загрузку**: Пагинация на клиенте (40 записей за страницу) с навигацией.

3. **✅ Использовать правильный API**: `/rest/tests/1.0/testrun/search` с параметрами fields, query, maxResults, startAt.

4. **✅ Добавить все поля**: folderId, iterationId, projectVersionId, testResultStatuses, plannedStartDate, plannedEndDate, executionTime, estimatedTime, issueCount, owner.

5. **✅ Кэшировать дерево папок**: Дерево загружается один раз при переключении вкладки.

6. **✅ Ленивая загрузка**: Тест-кейсы в прогоне загружаются только при раскрытии строки (handleCycleClick).
