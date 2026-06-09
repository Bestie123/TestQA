# ПОЛНЫЙ ПРОМТ: Исправление регресса и оптимизация Test Cycles

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

### Проверка тестов
```bash
# Запусти все тесты
node verify.js

# Проверь конкретный тест
node -e "
const { spawn } = require('child_process');
const server = spawn('node', ['regression-test.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
server.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}) + '\n');
server.stdout.on('data', d => console.log(d.toString()));
"
```

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
- **regression-test** — Тестирование регрессий (СОЗДАТЬ!)

## СОЗДАНИЕ MCP ДЛЯ ТЕСТИРОВАНИЯ РЕГРЕССИЙ

### Шаг 1: Создай regression-test MCP сервер
Файл: `qtest-runner/mcp-servers/regression-test.js`

```javascript
#!/usr/bin/env node
const http = require('http');
const CDP_PORT = 9222;
const CDP_HOST = '127.0.0.1';

async function checkChromeCDP() {
  return new Promise((resolve) => {
    const req = http.get(`http://${CDP_HOST}:${CDP_PORT}/json/version`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ running: true, ...JSON.parse(data) }); }
        catch { resolve({ running: false }); }
      });
    });
    req.on('error', () => resolve({ running: false }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ running: false }); });
  });
}

const tools = [
  {
    name: 'test_fullscreen',
    description: 'Test if site is displayed in full screen',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
  },
  {
    name: 'test_layout',
    description: 'Test layout elements',
    inputSchema: { type: 'object', properties: { url: { type: 'string' }, selectors: { type: 'array', items: { type: 'string' } } }, required: ['url'] },
  },
  {
    name: 'test_load_time',
    description: 'Test page load time',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
  },
];

async function handleToolCall(name, args) {
  const chrome = await checkChromeCDP();
  if (!chrome.running) return { error: 'Chrome CDP not running. Run: node chrome-launcher.js' };
  
  switch (name) {
    case 'test_fullscreen': return { chrome: true, url: args.url, status: 'Use chrome-devtools_cdp_evaluate to check' };
    case 'test_layout': return { chrome: true, url: args.url, selectors: args.selectors || [] };
    case 'test_load_time': return { chrome: true, url: args.url };
    default: return { error: `Unknown tool: ${name}` };
  }
}

let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (line.trim()) { try { handleMessage(JSON.parse(line)); } catch {} }
  }
});

function sendResponse(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function sendError(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }

async function handleMessage(msg) {
  if (msg.method === 'initialize') {
    sendResponse(msg.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'regression-test-mcp', version: '1.0.0' } });
  } else if (msg.method === 'tools/list') {
    sendResponse(msg.id, { tools });
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;
    try {
      const result = await handleToolCall(name, args || {});
      sendResponse(msg.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
    } catch (e) { sendError(msg.id, -32000, e.message); }
  }
}
```

### Шаг 2: Добавь в opencode.json
```json
{
  "mcp": {
    "regression-test": {
      "type": "local",
      "command": ["node", "Q:\\User_Data\\Desktop\\TestQA\\qtest-runner\\mcp-servers\\regression-test.js"],
      "enabled": true
    }
  }
}
```

### Шаг 3: Используй MCP для тестирования регресса
```bash
# Проверь Chrome CDP
node chrome-launcher.js --check

# Запусти MCP тесты
node verify.js

# Проверь в браузере
# Открой http://localhost:8080
# Используй chrome-devtools_cdp_evaluate для проверки layout
```

## ОБНАРУЖЕННЫЕ ПРОБЛЕМЫ

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

**Код для реализации:**
```typescript
// SettingsPage.tsx - новые секции настроек
interface JiraConfig {
  name: string;
  host: string;
  token: string;
  login: string;
  password: string;
  type: 'prod' | 'dev';
}

// Добавить в настройки:
// 1. Боевой Jira (prod)
// 2. Dev Jira (dev)
// 3. Токены доступа
// 4. Логины и пароли
// 5. Тестовые запросы
```

### Проблема 7: Нет синхронизации отдельных папок/прогонов/кейсов
**Причина:** Нет механизма синхронизации отдельных элементов
**Решение:** Добавить синхронизацию с указанием даты

**Что нужно сделать:**
1. Добавить кнопку "Синхронизировать" для каждой папки
2. Добавить кнопку "Синхронизировать" для каждого прогона
3. Добавить кнопку "Синхронизировать" для каждого тест-кейса
4. Сохранять дату последней синхронизации
5. Показывать дату синхронизации в UI

**Код для реализации:**
```typescript
// Добавить в БД таблицу sync_history
interface SyncHistory {
  id: string;
  entityType: 'folder' | 'cycle' | 'testCase';
  entityId: string;
  lastSyncDate: string; // ISO timestamp
  syncStatus: 'success' | 'error';
  errorMessage?: string;
}

// API endpoints:
// POST /api/sync/entity - синхронизация отдельного элемента
// GET /api/sync/history - история синхронизации
// GET /api/sync/history/:entityType/:entityId - история для конкретного элемента
```

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

## РАБОЧИЙ ПРОЦЕСС

### Шаг 1: Создание MCP для тестирования регрессий
1. Создай файл `qtest-runner/mcp-servers/regression-test.js`
2. Добавь инструменты: test_fullscreen, test_layout, test_load_time
3. Добавь в opencode.json
4. Проверь работу: node verify.js

### Шаг 2: Исправление регресса (Сайт не на весь экран)
1. Проверь стили sidebar в SyncPage.tsx
2. Добавь `display: 'flex', flexDirection: 'column'` в стили sidebar
3. Проверь в браузере

### Шаг 2: Исправление лимита 500 прогонов
1. Проверь `fetchTestRuns` в zephyr-client.ts
2. Реализуй пагинацию для загрузки всех данных
3. Проверь количество загруженных прогонов

### Шаг 3: Исправление лимита 100 тест-кейсов
1. Проверь `loadTestCases` в SyncPage.tsx
2. Реализуй пагинацию для загрузки всех данных
3. Проверь количество загруженных тест-кейсов

### Шаг 4: Добавление счетчиков в дерево папок
1. Проверь `loadCycleFolders` в SyncPage.tsx
2. Загружай дерево папок с `maxPages=0`
3. Добавь счетчики для каждой папки

### Шаг 5: Оптимизация загрузки
1. Добавь кэширование API запросов
2. Реализуй懒惰ную загрузку
3. Оптимизируй рендеринг

### Шаг 6: Рефакторинг настроек
1. Добавь настройки для боевого Jira и devJira
2. Добавь поля для логинов и паролей
3. Интегрируй с MCP инструментами
4. Добавь тестовые запросы для проверки

### Шаг 7: Синхронизация с датой
1. Добавь синхронизацию отдельных папок
2. Добавь синхронизацию отдельных прогонов
3. Добавь синхронизацию отдельных тест-кейсов
4. Сохраняй дату последней синхронизации
5. Показывай дату синхронизации в UI

### Шаг 8: Дата импорта
1. Добавь поле import_date в БД
2. Сохраняй дату импорта с точностью до секунд
3. Показывай дату импорта в UI

### Шаг 9: Тестирование
1. Проверь в браузере
2. Сравни с реальным Zephyr
3. Проверь скорость загрузки
4. Проверь: npm test && npm run build

### Шаг 10: Документация
1. Обнови PROBLEMS.md
2. Обнови ACTIVE_GOAL.md
3. Обнови zephyr-cycle-analysis.md

## ЧЕКЛИСТ ГОТОВНОСТИ

### MCP
- [ ] regression-test MCP создан
- [ ] Добавлен в opencode.json
- [ ] Проверен через verify.js
- [ ] Инструменты работают

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

## ФОРМАТ ОТВЕТА

### При успехе:
```
✅ Задача выполнена
- Что сделано: [кратко]
- Файлы изменены: [список]
- Проблемы исправлены: [список]
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
Исправление регресса и оптимизация Test Cycles:

1. Регресс:
   - Добавь display: flex в стили sidebar
   - Проверь в браузере

2. Лимиты данных:
   - Реализуй пагинацию для прогонов (>500)
   - Реализуй пагинацию для тест-кейсов (>100)
   - Загружай все данные с maxPages=0

3. Дерево папок:
   - Загружай дерево папок для прогонов
   - Добавь счетчики для каждой папки

4. Оптимизация:
   - Добавь кэширование
   - Реализуй懒惰ную загрузку
   - Оптимизируй рендеринг

5. Тестирование:
   - Проверь в браузере
   - Сравни с реальным Zephyr
   - Проверь: npm test && npm run build

6. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
```
