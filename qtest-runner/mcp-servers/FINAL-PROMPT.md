# ФИНАЛЬНЫЙ ПРОМТ ДЛЯ НОВОЙ СЕССИИ

## Скопируй и вставь в новую сессию opencode:

```
# КОНТЕКСТ И ПРАВИЛА

Читай файлы ПЕРВЫМ (обязательно):
1. TestQA/README.md — обзор проекта
2. TestQA/ACTIVE_GOAL.md — текущая цель и статус
3. TestQA/docs/rules/AGENTS.md — правила работы (ОБЯЗАТЕЛЬНО)
4. qtest-runner/mcp-servers/ADVANCED-PROMPT.md — полный промт с самовосстановлением
5. qtest-runner/mcp-servers/zephyr-cycle-analysis.md — анализ реального Zephyr
6. qtest-runner/mcp-servers/REGRESSION-FIX-PROMPT.md — исправление регрессий

## ТЕКУЩИЕ ПРОБЛЕМЫ ДЛЯ РЕШЕНИЯ

### Проблема 1: Регресс — сайт не на весь экран
**Симптомы:** При переключении на вкладку "Тестовые прогоны" сайт отображается не на весь экран
**Причина:** В стилях `sidebar` отсутствует `display: flex` и `flexDirection: column`
**Решение:** Добавить `display: 'flex', flexDirection: 'column'` в стили sidebar в SyncPage.tsx

### Проблема 2: Показывает 500 прогонов вместо всех
**Симптомы:** На странице "Тестовые прогоны" отображается только 500 записей
**Причина:** `fetchTestRuns` в zephyr-client.ts использует `maxResults=500`
**Решение:** Реализовать пагинацию для загрузки всех данных

### Проблема 3: Показывает 100 тест-кейсов вместо всех
**Симптомы:** На странице "Тест кейсы" отображается только 100 записей
**Причина:** `loadTestCases` в SyncPage.tsx использует `maxPages=1`
**Решение:** Реализовать пагинацию для загрузки всех данных

### Проблема 4: Нет счетчиков в дереве папок для прогонов
**Симптомы:** В дереве папок на вкладке "Тестовые прогоны" нет счетчиков
**Причина:** Дерево папок не загружается для прогонов
**Решение:** Загружать дерево папок с `maxPages=0` и добавлять счетчики

### Проблема 5: Медленная загрузка
**Симптомы:** Данные загружаются медленно, нет кэширования
**Причина:** Загрузка всех данных за один запрос, нет кэширования
**Решение:** Реализовать懒惰ную загрузку и кэширование

### Проблема 6: Нет настроек для токенов/паролей/логинов
**Симптомы:** SettingsPage не интегрирован с MCP инструментами
**Причина:** Отсутствуют настройки для боевого Jira и devJira
**Решение:** Рефакторинг настроек для интеграции с MCP

### Проблема 7: Нет синхронизации отдельных папок/прогонов/кейсов
**Симптомы:** Нет механизма синхронизации отдельных элементов
**Причина:** Отсутствует функционал синхронизации с датой
**Решение:** Добавить синхронизацию с указанием даты

### Проблема 8: Нет даты импорта с точностью до секунд
**Симптомы:** Дата импорта не сохраняется
**Причина:** Текущая дата импорта не сохраняется в БД
**Решение:** Сохранять дату импорта с точностью до секунд

### Проблема 9: Фильтры не соответствуют реальному Zephyr
**Симптомы:** Фильтры в SyncPage отличаются от реального Zephyr
**Причина:** Используется неполный набор критериев
**Решение:** Добавить все 10 критериев из реального Zephyr

### Проблема 10: Нет логирования действий
**Симптомы:** Невозможно отследить действия в regression-test MCP
**Причина:** Отсутствует логирование
**Решение:** Добавить логирование всех действий в regression-test.js

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

### Правило #4: Тестирование регрессий
При изменении UI:
1. Создай regression-test MCP если его нет
2. Запиши текущее состояние (еталон)
3. После изменений проверь на регрессии
4. Если есть регрессии — исправь
5. Обнови эталон в MCP

При добавлении нового функционала:
1. Добавь тест в regression-test MCP
2. Проверь что тест работает
3. Запиши эталонное поведение

При удалении функционала:
1. Удали тест из regression-test MCP
2. Проверь что другие тесты работают
3. Обнови документацию

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
- regression-test — Тестирование регрессий с логированием

## CSS-СЕЛЕКТОРЫ ZEPHYR (СОХРАНЕНЫ)

### Test Cases страница
- Фильтр-панель: [data-testid="zephyr-scale-grid-filter-section"]
- Кнопка "Фильтры": button.expand-filters-button
- Кнопка "Добавить критерий": button.css-48ccbj
- Dropdown: div.css-7uwa0r
- Поиск: input[placeholder="Поиск..."]
- Опция: div.zephyr-scale-styled-pop-select__option

### Test Cycles страница
- Таблица: table
- Строка таблицы: tbody tr
- Чекбокс: input[type="checkbox"]
- Badge статуса: span с цветом
- Прогресс-бар: div с процентами

### Test Plans страница
- Таблица: table
- Строка таблицы: tbody tr

## API ENDPOINTS ZEPHYR (ПРОАНАЛИЗИРОВАНЫ)

### 1. Основной поиск тестовых прогонов
```
GET /rest/tests/1.0/testrun/search
Parameters:
- fields: id,key,name,folderId,iterationId,projectVersionId,environmentId,plannedStartDate,plannedEndDate,executionTime,estimatedTime,testResultStatuses,testCaseCount,issueCount,status(id,name,i18nKey,color),customFieldValues,createdOn,createdBy,updatedOn,updatedBy,owner
- query: testRun.projectId+IN+({projectId})+ORDER+BY+testRun.name+ASC
- maxResults: 500
- startAt: 0
- archived: false
```

### 2. Дерево папок тестовых прогонов
```
GET /rest/tests/1.0/project/{projectId}/foldertree/testrun
Response: 53913 bytes (53KB)
```

### 3. Статусы результатов тестов
```
GET /rest/tests/1.0/project/{projectId}/testresultstatus
Response: 573 bytes
```

### 4. Тест-кейсы в прогоне
```
GET /rest/tests/latest/testcase/search?maxResults=1&projectKey={projectKey}&cycleKey={cycleKey}
Response: 4243 bytes
```

## СТРУКТУРА ДАННЫХ ТЕСТ-ПРОГОНА

```json
{
  "id": 12345,
  "key": "IBPA-C223",
  "name": "CRM - изменение процесса согласования КП",
  "folderId": 100,
  "status": {
    "id": 1,
    "name": "Выполнен",
    "i18nKey": "executed",
    "color": "#3abb4b"
  },
  "testCaseCount": 25,
  "issueCount": 0,
  "createdOn": "2026-01-15T10:30:00.000Z",
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

## ИСПОЛЬЗОВАНИЕ REGRESSION-TEST MCP

### Добавление нового теста
```javascript
// В regression-test.js добавь новый инструмент
{
  name: 'test_new_feature',
  description: 'Test new feature',
  inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
}
```

### Удаление теста
```javascript
// В regression-test.js удали инструмент из массива tools
// Удали соответствующую функцию handleToolCall
```

### Просмотр логов
```bash
node -e "
const { spawn } = require('child_process');
const server = spawn('node', ['regression-test.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
server.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_logs',arguments:{limit:10}}}) + '\n');
server.stdout.on('data', d => console.log(d.toString()));
"
```

### Очистка логов
```bash
node -e "
const { spawn } = require('child_process');
const server = spawn('node', ['regression-test.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
server.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'clear_logs',arguments:{}}}) + '\n');
server.stdout.on('data', d => console.log(d.toString()));
"
```

## РАБОЧИЙ ПРОЦЕСС

### Шаг 1: Создание MCP для тестирования регрессий
1. Создай файл `qtest-runner/mcp-servers/regression-test.js`
2. Добавь инструменты: test_fullscreen, test_layout, test_load_time, get_logs, clear_logs
3. Добавь в opencode.json
4. Проверь работу: node verify.js

### Шаг 2: Исправление регресса (Сайт не на весь экран)
1. Проверь стили sidebar в SyncPage.tsx
2. Добавь `display: 'flex', flexDirection: 'column'` в стили sidebar
3. Проверь в браузере

### Шаг 3: Исправление лимита 500 прогонов
1. Проверь `fetchTestRuns` в zephyr-client.ts
2. Реализуй пагинацию для загрузки всех данных
3. Проверь количество загруженных прогонов

### Шаг 4: Исправление лимита 100 тест-кейсов
1. Проверь `loadTestCases` в SyncPage.tsx
2. Реализуй пагинацию для загрузки всех данных
3. Проверь количество загруженных тест-кейсов

### Шаг 5: Добавление счетчиков в дерево папок
1. Проверь `loadCycleFolders` в SyncPage.tsx
2. Загружай дерево папок с `maxPages=0`
3. Добавь счетчики для каждой папки

### Шаг 6: Оптимизация загрузки
1. Добавь кэширование API запросов
2. Реализуй懒惰ную загрузку
3. Оптимизируй рендеринг

### Шаг 7: Рефакторинг настроек
1. Добавь настройки для боевого Jira и devJira
2. Добавь поля для логинов и паролей
3. Интегрируй с MCP инструментами
4. Добавь тестовые запросы для проверки

### Шаг 8: Синхронизация с датой
1. Добавь синхронизацию отдельных папок
2. Добавь синхронизацию отдельных прогонов
3. Добавь синхронизацию отдельных тест-кейсов
4. Сохраняй дату последней синхронизации
5. Показывай дату синхронизации в UI

### Шаг 9: Дата импорта
1. Добавь поле import_date в БД
2. Сохраняй дату импорта с точностью до секунд
3. Показывай дату импорта в UI

### Шаг 10: Диагностика
1. Проверь Chrome CDP: node chrome-launcher.js --check
2. Проверь MCP: node verify.js
3. Проверь логи: node -e "..."

### Шаг 11: Анализ
1. Открой реальный Zephyr через Chrome DevTools
2. Проанализируй структуру DOM
3. Сохрани CSS-селекторы в mcp-servers/zephyr-filter-analysis.md

### Шаг 12: Реализация
1. Внеси изменения в код
2. Проверь сборку: npm run build
3. Проверь тесты: npm test

### Шаг 13: Тестирование
1. Проверь в браузере
2. Сравни с реальным Zephyr
3. Проверь скорость загрузки
4. Проверь: npm test && npm run build
5. Проверь регрессии

### Шаг 14: Документация
1. Обнови PROBLEMS.md
2. Обнови ACTIVE_GOAL.md
3. Обнови zephyr-cycle-analysis.md
4. Закоммить изменения

## ПРИМЕРЫ ЗАДАЧ

### Пример 1: Исправление фильтра
```
Исправь фильтр "Статус" на странице Test Cycles:

1. Анализ:
   - Открой: chrome-devtools_cdp_navigate → https://jira.ifellow.ru/secure/Tests.jspa#/v2/testCycles?projectId=10904
   - Найди фильтр: chrome-devtools_cdp_evaluate → document.querySelector('[data-testid="zephyr-scale-grid-filter-section"]')
   - Сохрани селекторы

2. Реализация:
   - Измени SyncPage.tsx
   - Добавь новый критерий

3. Тестирование:
   - Проверь в браузере
   - Сравни с реальным Zephyr

4. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
```

### Пример 2: Отладка MCP
```
MCP сервер browser-devtools не грузится:

1. Диагностика:
   - Проверь opencode.json: Get-Content opencode.json | ConvertFrom-Json
   - Проверь формат: должен быть "mcp", не "mcpServers"
   - Проверь пути: Test-Path "path/to/server.js"

2. Исправление:
   - Исправь opencode.json
   - Перезапусти opencode
   - Проверь: node verify.js

3. Тестирование:
   - Проверь инструменты: chrome-devtools_cdp_list_tabs
   - Проверь навигацию: chrome-devtools_cdp_navigate

4. Документация:
   - Запиши проблему в PROBLEMS.md
   - Запиши решение
```

### Пример 3: Новый компонент
```
Создай компонент TestPlanDetail:

1. Анализ:
   - Открой: https://jira.ifellow.ru/secure/Tests.jspa#/v2/testPlans?projectId=10904
   - Проанализируй структуру: chrome-devtools_cdp_evaluate
   - Сохрани CSS-селекторы

2. Реализация:
   - Создай компонент в SyncPage.tsx
   - Добавь в вкладку "Планы тестирования"
   - Добавь стили

3. Тестирование:
   - Проверь в браузере
   - Сравни с реальным Zephyr

4. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
```

## ЧЕКЛИСТ ПЕРЕД КОММИТОМ

- [ ] Все 289 тестов проходят
- [ ] Сборка успешна (npm run build)
- [ ] UI проверен в реальном браузере
- [ ] CSS-селекторы совпадают с реальным Zephyr
- [ ] Документация обновлена
- [ ] ACTIVE_GOAL.md обновлён
- [ ] PROBLEMS.md обновлён (если были проблемы)

## ОБНАРУЖЕННЫЕ ПРОБЛЕМЫ И ИХ РЕШЕНИЯ

### Проблема 1: Сайт не на весь экран (РЕГРЕСС)
**Причина:** В стилях `sidebar` отсутствует `display: flex` и `flexDirection: column`
**Решение:** Добавить `display: 'flex', flexDirection: 'column'` в стили sidebar

**Код для исправления:**
```tsx
// SyncPage.tsx, строка 99
sidebar: {
  minWidth: 160, background: '#fff', borderRight: '1px solid #dfe1e6',
  overflowY: 'auto' as const, padding: '8px 0', position: 'relative' as const,
  display: 'flex', flexDirection: 'column' as const,
},
```

### Проблема 2: Показывает 500 прогонов вместо всех
**Причина:** `fetchTestRuns` использует `maxResults=500`
**Решение:** Реализовать пагинацию для загрузки всех данных

**Код для исправления:**
```typescript
// zephyr-client.ts, строка 448
export async function fetchTestRuns(projectKey?: string): Promise<ZephyrTestRun[]> {
  const pk = projectKey || config.projectKey;
  const fields = 'id,key,name,folderId,iterationId,projectVersionId,environmentId,plannedStartDate,plannedEndDate,executionTime,estimatedTime,testResultStatuses,testCaseCount,issueCount,status(id,name,i18nKey,color),createdOn,createdBy,updatedOn,updatedBy,owner';
  const query = `testRun.projectId+IN+(${await getProjectId(pk)})+ORDER+BY+testRun.name+ASC`;
  
  // Пагинация: загружаем все данные
  let allRuns: any[] = [];
  let startAt = 0;
  const pageSize = 500;
  let hasMore = true;
  
  while (hasMore) {
    const response = await apiRequest(
      `/rest/tests/1.0/testrun/search?fields=${encodeURIComponent(fields)}&query=${encodeURIComponent(query)}&maxResults=${pageSize}&startAt=${startAt}&archived=false`
    );
    const results = response?.results || [];
    allRuns = allRuns.concat(results);
    startAt += pageSize;
    hasMore = results.length === pageSize;
  }
  
  return allRuns.filter((r: any) => r?.key?.startsWith(pk)).map((r: any) => ({
    id: r.id,
    key: r.key,
    // ... остальные поля
  }));
}
```

### Проблема 3: Показывает 100 тест-кейсов вместо всех
**Причина:** `loadTestCases` использует `maxPages=1`
**Решение:** Реализовать пагинацию для загрузки всех данных

**Код для исправления:**
```typescript
// SyncPage.tsx, строка 382
async function loadTestCases(p?: number) {
  setLoading(true);
  setStatus('Загрузка TC из Zephyr...');
  try {
    const params = new URLSearchParams({ projectKey: selectedProject });
    if (filterFolder) params.set('folder', filterFolder);
    if (filterValues.status) params.set('status', filterValues.status);
    if (filterValues.priority) params.set('priority', filterValues.priority);
    if (filterValues.owner) params.set('owner', filterValues.owner);
    if (searchText) params.set('search', searchText);
    
    // Загружаем все данные с пагинацией
    params.set('maxPages', '0'); // 0 = все страницы
    
    const res = await fetch(`${api}/zephyr/testcases?${params}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setTestCases(data);
      setFilteredCount(data.length);
      // ... остальная логика
    }
  } catch (e: any) { setStatus(`Ошибка: ${e.message}`); }
  setLoading(false);
}
```

### Проблема 4: Нет счетчиков в дереве папок для прогонов
**Причина:** Дерево папок не загружается для прогонов
**Решение:** Загружать дерево папок и добавлять счетчики

**Код для исправления:**
```typescript
// SyncPage.tsx, строка 521
async function loadCycleFolders() {
  if (!selectedProject) return;
  try {
    const res = await fetch(`${api}/zephyr/folders?projectKey=${selectedProject}&type=cycles&maxPages=0`); // 0 = все
    const data = await res.json();
    if (Array.isArray(data)) {
      setCycleFolders(addFolderCounts(data, testRuns));
    }
  } catch { /* silent */ }
}
```

### Проблема 5: Медленная загрузка
**Причина:** Загрузка всех данных за один запрос
**Решение:** Реализовать懒惰ную загрузку и кэширование

**Код для оптимизации:**
```typescript
// Добавить кэширование
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

async function fetchWithCache(url: string): Promise<any> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}
```

### Проблема 6: Нет настроек для токенов/паролей/логинов
**Причина:** SettingsPage не интегрирован с MCP инструментами
**Решение:** Рефакторинг настроек для интеграции с MCP

**Что нужно сделать:**
1. Добавить настройки для боевого Jira и devJira
2. Добавить поля для логинов и паролей
3. Интегрировать с MCP инструментами (zephyr-scale, browser-devtools)
4. Добавить тестовые запросы для проверки

### Проблема 7: Нет синхронизации отдельных папок/прогонов/кейсов
**Причина:** Нет механизма синхронизации отдельных элементов
**Решение:** Добавить синхронизацию с указанием даты

**Что нужно сделать:**
1. Добавить кнопку "Синхронизировать" для каждой папки
2. Добавить кнопку "Синхронизировать" для каждого прогона
3. Добавить кнопку "Синхронизировать" для каждого тест-кейса
4. Сохранять дату последней синхронизации
5. Показывать дату синхронизации в UI

### Проблема 8: Нет даты импорта с точностью до секунд
**Причина:** Текущая дата импорта не сохраняется
**Решение:** Сохранять дату импорта с точностью до секунд

**Код для реализации:**
```typescript
// Добавить в БД поле import_date
interface TestCase {
  // ... существующие поля
  import_date: string; // ISO timestamp с точностью до секунд
}

// При импорте:
const importDate = new Date().toISOString(); // "2026-06-04T12:30:45.123Z"
```

## ФОРМАТ ОТВЕТА

### При успехе:
```
✅ Задача выполнена
- Что сделано: [кратко]
- Файлы изменены: [список]
- CSS-селекторы: [список]
- Тесты: 289/289 проходят
- Сборка: успешна
- Логи: [ссылка на логи]
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

## ЧЕКЛИСТ ГОТОВНОСТИ

### MCP
- [ ] regression-test MCP создан
- [ ] Добавлен в opencode.json
- [ ] Проверен через verify.js
- [ ] Инструменты работают
- [ ] Логирование работает

### Регресс
- [ ] Сайт отображается на весь экран
- [ ] Sidebar корректно отображается
- [ ] Нет визуальных проблем

### Данные
- [ ] Загружаются все тест-прогоны (>500)
- [ ] Загружаются все тест-кейсы (>100)
- [ ] Дерево папок загружается полностью
- [ ] Счетчики в дереве папок работают

### Производительность
- [ ] Кэширование работает
- [ ]懒惰ная загрузка работает
- [ ] Скорость загрузки < 3 секунд
- [ ] Нет утечек памяти

### Функционал
- [ ] Фильтры работают
- [ ] Поиск работает
- [ ] Расширение строк работает
- [ ] Пагинация работает

### Настройки
- [ ] Настройки боевого Jira
- [ ] Настройки devJira
- [ ] Токены доступа
- [ ] Логины и пароли
- [ ] Тестовые запросы
- [ ] Интеграция с MCP

### Синхронизация
- [ ] Синхронизация отдельных папок
- [ ] Синхронизация отдельных прогонов
- [ ] Синхронизация отдельных тест-кейсов
- [ ] Дата последней синхронизации
- [ ] Отображение даты в UI

### Импорт
- [ ] Дата импорта с точностью до секунд
- [ ] Отображение даты импорта
- [ ] Сохранение в БД

### Документация
- [ ] PROBLEMS.md обновлён
- [ ] ACTIVE_GOAL.md обновлён
- [ ] zephyr-cycle-analysis.md обновлён

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
- Регрессии: mcp-servers/regression-test.js
```

---

## КРАТКАЯ ВЕРСИЯ (для быстрого запуска):

```
Задача: [опиши задачу]

1. Диагностика:
   - Проверь Chrome CDP: node chrome-launcher.js --check
   - Проверь MCP: node verify.js
   - Проверь логи: node -e "..."

2. Анализ:
   - Открой реальный Zephyr через Chrome DevTools
   - Проанализируй структуру DOM
   - Сохрани CSS-селекторы

3. Реализация:
   - Внеси изменения в код
   - Проверь сборку: npm run build
   - Проверь тесты: npm test

4. Тестирование:
   - Проверь в браузере
   - Сравни с реальным Zephyr
   - Проверь регрессии

5. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
   - Обнови zephyr-cycle-analysis.md
```
