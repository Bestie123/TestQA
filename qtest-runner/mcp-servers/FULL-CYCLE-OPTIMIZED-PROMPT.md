# ПОЛНЫЙ РАСШИРЕННЫЙ ПРОМТ: Оптимизация и исправление вкладки "Тестовые прогоны"

## Скопируй и вставь в новую сессию opencode:

```
# КОНТЕКСТ И ПРАВИЛА

Читай файлы ПЕРВЫМ (обязательно):
1. TestQA/README.md — обзор проекта
2. TestQA/ACTIVE_GOAL.md — текущая цель и статус
3. TestQA/docs/rules/AGENTS.md — правила работы (ОБЯЗАТЕЛЬНО)
4. qtest-runner/mcp-servers/ADVANCED-PROMPT.md — полный промт с самовосстановлением
5. qtest-runner/mcp-servers/zephyr-cycle-analysis.md — анализ реального Zephyr

## КРИТИЧЕСКИЕ ПРАВИЛА

### Правило #1: Никогда не угадывай
- ВСЕГДА проверяй реальный Zephyr через Chrome DevTools
- Если инструмент не работает — ЧИНИ его, а не угадывай
- Если не можешь проанализировать — ЧЕСТНО скажи, что инструмент недоступен

### Правило #2: Самовосстановление
При сбое инструмента:
1. Проверь ошибку
2. Найди причину в mcp-servers/PROBLEMS.md
3. Исправь инструмент
4. Протестируй
5. Продолжай задачу

### Правило #3: Документируй
- Каждую проблему записывай в mcp-servers/PROBLEMS.md
- Каждое решение записывай с CSS-селекторами и кодом
- Обновляй ACTIVE_GOAL.md после каждого шага

## ДОСТУПНЫЕ ИНСТРУМЕНТЫ

### Chrome DevTools (встроенные в opencode)
- chrome-devtools_cdp_navigate — навигация
- chrome-devtools_cdp_evaluate — выполнение JS
- chrome-devtools_cdp_click — клик по элементу
- chrome-devtools_cdp_get_html — получение HTML
- chrome-devtools_cdp_screenshot — скриншот

### MCP серверы
- browser-devtools — Chrome DevTools Protocol
- zephyr-scale — Zephyr Scale API

## API ENDPOINTS ZEPHYR (ПРОАНАЛИЗИРОВАНЫ)

### 1. Основной поиск тестовых прогонов
```
GET /rest/tests/1.0/testrun/search
Parameters:
- fields: id,key,name,folderId,iterationId,projectVersionId,environmentId,userKeys,environmentIds,plannedStartDate,plannedEndDate,executionTime,estimatedTime,testResultStatuses,testCaseCount,issueCount,status(id,name,i18nKey,color),customFieldValues,createdOn,createdBy,updatedOn,updatedBy,owner
- query: testRun.projectId+IN+({projectId})+ORDER+BY+testRun.name+ASC
- maxResults: 40
- startAt: 0
- archived: false
Response: 3619 bytes, 295ms
```

### 2. Дерево папок тестовых прогонов
```
GET /rest/tests/1.0/project/{projectId}/foldertree/testrun
Response: 53913 bytes (53KB), 98ms
Содержит все папки для организации тестовых прогонов
```

### 3. Статусы результатов тестов
```
GET /rest/tests/1.0/project/{projectId}/testresultstatus
Response: 573 bytes, 122ms
Содержит: PASS, FAIL, SKIPPED, BLOCKED, UNEXECUTED
```

### 4. Тест-кейсы в прогоне
```
GET /rest/tests/latest/testcase/search?maxResults=1&projectKey={projectKey}&cycleKey={cycleKey}
Response: 4243 bytes, 213ms
```

## СТРУКТУРА ДАННЫХ ТЕСТ-ПРОГОНА

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

## CSS-СЕЛЕКТОРЫ ZEPHYR (СОХРАНЕНЫ)

### Test Cycles страница
- Фильтр-панель: [data-testid="zephyr-scale-grid-filter-section"]
- Кнопка "Фильтры": button.expand-filters-button
- Кнопка "Добавить критерий": button.css-48ccbj
- Dropdown: div.css-7uwa0r
- Поиск: input[placeholder="Поиск..."]
- Таблица: table
- Строка таблицы: tbody tr
- Чекбокс: input[type="checkbox"]
- Badge статуса: span с цветом
- Прогресс-бар: div с процентами

## РАБОЧИЙ ПРОЦЕСС

### Шаг 1: Анализ текущего состояния
1. Проверь текущий код SyncPage.tsx
2. Определи что работает, а что нет
3. Сравни с реальным Zephyr

### Шаг 2: Исправление ошибки "React is not defined"
1. Проверь импорт React в SyncPage.tsx
2. Добавь `import React from 'react'` если нужно
3. Проверь конфигурацию Vite

### Шаг 3: Добавление дерева папок для прогонов
1. Создай эндпоинт для загрузки дерева папок
2. Реализуй загрузку `/rest/tests/1.0/project/{projectId}/foldertree/testrun`
3. Отобрази дерево в левой панели для вкладки "Тестовые прогоны"
4. Добавь фильтрацию по папкам

### Шаг 4: Оптимизация загрузки данных
1. Реализуй пагинацию (40 записей за раз)
2. Добавь懒惰ную загрузку (ленивая загрузка)
3. Кэшируй дерево папок (53KB)
4. Оптимизируй API запросы

### Шаг 5: Исправление API endpoint
1. Используй `/rest/tests/1.0/testrun/search` вместо текущего
2. Добавь параметры fields, query, maxResults, startAt
3. Реализуй пагинацию на клиенте

### Шаг 6: Добавление всех полей данных
1. Загружай все поля: folderId, iterationId, projectVersionId, environmentId, userKeys, environmentIds, plannedStartDate, plannedEndDate, executionTime, estimatedTime, testResultStatuses
2. Отображай дополнительные поля в таблице
3. Добавь фильтрацию по дополнительным полям

### Шаг 7: Исправление колонок таблицы
1. Реализуй колонки: Чекбокс, Key, Наименование, Ход выполнения, Статус, Действия
2. Добавь прогресс-бар для хода выполнения
3. Добавь badge для статуса
4. Добавь форматирование дат

### Шаг 8: Исправление фильтров
1. Реализуй фильтры: Статус, Версия, Итерация, Назначен, Тест-план
2. Добавь dropdown для статуса
3. Добавь text input для других полей
4. Реализуй фильтрацию на клиенте

### Шаг 9: Исправление расширения строк
1. Реализуй клик по строке для раскрытия
2. Загружай тест-кейсы в прогоне только при раскрытии
3. Отображай детализацию: тест-кейсы, статусы выполнения
4. Добавь прогресс-бар для каждого тест-кейса

### Шаг 10: Тестирование и оптимизация
1. Проверь скорость загрузки
2. Проверь работу фильтров
3. Проверь работу пагинации
4. Проверь работу дерева папок
5. Проверь работу расширения строк

## ЧЕКЛИСТ ГОТОВНОСТИ

### Основное
- [ ] Ошибка "React is not defined" исправлена
- [ ] Все вкладки переключаются без ошибок
- [ ] Test Cases работает
- [ ] Test Cycles работает
- [ ] Test Plans работает

### Дерево папок
- [ ] Дерево папок загружается для тестовых прогонов
- [ ] Дерево папок отображается в левой панели
- [ ] Фильтрация по папкам работает
- [ ] Дерево папок кэшируется

### Загрузка данных
- [ ] Пагинация работает (40 записей за раз)
- [ ]懒惰ная загрузка работает
- [ ] Кэширование работает
- [ ] Скорость загрузки приемлемая

### API
- [ ] Используется правильный endpoint
- [ ] Все поля загружаются
- [ ] Параметры передаются правильно
- [ ] Ошибки обрабатываются

### Таблица
- [ ] Колонки соответствуют Zephyr
- [ ] Чекбоксы работают
- [ ] Прогресс-бар отображается
- [ ] Badge статуса отображается
- [ ] Даты форматируются

### Фильтры
- [ ] Фильтры добавляются
- [ ] Фильтры удаляются
- [ ] Фильтрация работает
- [ ] Поиск работает

### Расширение строк
- [ ] Строки раскрываются
- [ ] Детализация загружается
- [ ] Тест-кейсы отображаются
- [ ] Статусы выполнения отображаются

### Производительность
- [ ] Время загрузки < 2 секунд
- [ ] Память не утекает
- [ ] Нет лишних перерисовок
- [ ] Оптимизация рендеринга

### Документация
- [ ] PROBLEMS.md обновлён
- [ ] ACTIVE_GOAL.md обновлён
- [ ] zephyr-cycle-analysis.md обновлён
- [ ] CSS-селекторы сохранены

## ФОРМАТ ОТВЕТА

### При успехе:
```
✅ Задача выполнена
- Что сделано: [кратко]
- Файлы изменены: [список]
- API endpoints: [список]
- CSS-селекторы: [список]
- Тесты: 289/289 проходят
- Сборка: успешна
- Скорость загрузки: [время]
- Следующий шаг: [что делать дальше]
```

### При проблеме:
```
❌ Проблема: [описание]
- Инструмент: [какой не работает]
- Ошибка: [текст ошибки]
- Решение: [что делаю]
- Статус: [в процессе/решено]
```

## ДОПОЛНИТЕЛЬНЫЕ ИНСТРУМЕНТЫ

### chrome-launcher.js
```bash
node chrome-launcher.js              # Запуск Chrome
node chrome-launcher.js --check      # Проверка CDP
node chrome-launcher.js --kill       # Остановка Chrome
```

### verify.js
```bash
node verify.js                       # Проверка всех MCP серверов
```

### debug-toolkit.js
```bash
node debug-toolkit.js                # Полная диагностика
```

## КОНТАКТЫ

- Документация: mcp-servers/README.md
- Проблемы: mcp-servers/PROBLEMS.md
- CSS-селекторы: mcp-servers/zephyr-filter-analysis.md
- Анализ прогонов: mcp-servers/zephyr-cycle-analysis.md
- Промт: mcp-servers/ADVANCED-PROMPT.md
- Отладка: mcp-servers/debug-toolkit.js
```

---

## КРАТКАЯ ВЕРСИЯ (для быстрого запуска):

```
Оптимизация и исправление вкладки "Тестовые прогоны":

1. Анализ:
   - Проверь текущий код SyncPage.tsx
   - Сравни с реальным Zephyr
   - Определи проблемы

2. Исправление:
   - Ошибка "React is not defined"
   - Дерево папок для прогонов
   - Пагинация (40 записей за раз)
   - API endpoint (/rest/tests/1.0/testrun/search)
   - Все поля данных
   - Колонки таблицы
   - Фильтры
   - Расширение строк

3. Оптимизация:
   -懒惰ная загрузка
   - Кэширование дерева папок
   - Оптимизация API запросов
   - Оптимизация рендеринга

4. Тестирование:
   - Проверь в браузере
   - Сравни с реальным Zephyr
   - Проверь: npm test && npm run build

5. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
   - Обнови zephyr-cycle-analysis.md
```
