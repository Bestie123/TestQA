# Продвинутый промт-шаблон с самовосстановлением

## Использование
Скопируй этот промт для работы с qtest-runner. Включает инструкции по самовосстановлению при сбоях.

---

## ПРОМТ ДЛЯ НОВОЙ СЕССИИ

```
# КОНТЕКСТ И ПРАВИЛА

Читай файлы ПЕРВЫМ (обязательно):
1. TestQA/README.md — обзор проекта
2. TestQA/ACTIVE_GOAL.md — текущая цель и статус
3. TestQA/docs/rules/AGENTS.md — правила работы (ОБЯЗАТЕЛЬНО)

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

### Zephyr Scale MCP
- zephyr-list-projects — список проектов
- zephyr-list-testcases — список тест-кейсов
- zephyr-list-cycles — список прогонов
- zephyr-list-plans — список планов

### Browser DevTools MCP
- browser-navigate — навигация
- browser-evaluate — выполнение JS
- browser-click — клик
- browser-get-html — получение HTML
- browser-list-tabs — список вкладок

## CSS-СЕЛЕКТОРЫ ZEPHYR (СОХРАНЕНЫ)

### Test Cases страница
- Фильтр-панель: [data-testid="zephyr-scale-grid-filter-section"]
- Кнопка "Фильтры": button.expand-filters-button
- Кнопка "Добавить критерий": button.css-48ccbj
- Dropdown: div.css-7uwa0r
- Поиск: input[placeholder="Поиск..."]
- Опция: div.zephyr-scale-styled-pop-select__option
- Заголовок группы: div.zephyr-scale-styled-pop-select__group-heading

### Test Cycles страница
- Таблица: [data-testid="zephyr-scale-grid-table"]
- Строка: [data-testid="zephyr-scale-grid-row"]

### Test Plans страница
- Таблица: [data-testid="zephyr-scale-grid-table"]

## РАБОЧИЙ ПРОЦЕСС

### Шаг 1: Анализ
1. Открой реальный Zephyr через Chrome DevTools
2. Проанализируй структуру DOM
3. Сохрани CSS-селекторы в mcp-servers/zephyr-filter-analysis.md

### Шаг 2: Реализация
1. Внеси изменения в код
2. Проверь сборку: npm run build
3. Проверь тесты: npm test

### Шаг 3: Тестирование
1. Открой наш UI в браузере
2. Сравни с реальным Zephyr
3. Проверь все критерии фильтров

### Шаг 4: Документация
1. Обнови mcp-servers/PROBLEMS.md
2. Обнови ACTIVE_GOAL.md
3. Закоммить изменения

## ФОРМАТ ОТВЕТА

### При успехе:
```
✅ Задача выполнена
- Что сделано: [кратко]
- Тесты: 289/289 проходят
- Сборка: успешна
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
   - Проверь все критерии

4. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
   - Закоммить
```

## ЧЕКЛИСТ ПЕРЕД КОММИТОМ

- [ ] Все 289 тестов проходят
- [ ] Сборка успешна (npm run build)
- [ ] UI проверен в реальном браузере
- [ ] CSS-селекторы совпадают с реальным Zephyr
- [ ] Документация обновлена
- [ ] ACTIVE_GOAL.md обновлён
- [ ] PROBLEMS.md обновлён (если были проблемы)
```

---

## ДОПОЛНИТЕЛЬНЫЕ ИНСТРУМЕНТЫ

### MCP Debugging Toolkit
Создай файл `mcp-servers/debug-toolkit.js`:

```javascript
#!/usr/bin/env node
/**
 * MCP Debugging Toolkit
 * Инструменты для отладки MCP серверов
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Проверка Chrome CDP
function checkChromeCDP() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
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

// Проверка opencode.json
function checkOpenCodeConfig() {
  const configPath = path.join(process.cwd(), 'opencode.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const hasMcp = !!config.mcp;
    const hasMcpServers = !!config.mcpServers;
    const correctFormat = hasMcp && !hasMcpServers;
    
    return {
      exists: true,
      correctFormat,
      hasMcp,
      hasMcpServers,
      servers: hasMcp ? Object.keys(config.mcp) : [],
    };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

// Проверка MCP серверов
function checkMCPServers() {
  const servers = [
    { name: 'browser-devtools', path: 'mcp-servers/browser-devtools/server.js' },
    { name: 'zephyr-scale', path: 'mcp-servers/zephyr-scale/server.js' },
  ];
  
  return servers.map(server => ({
    name: server.name,
    exists: fs.existsSync(server.path),
    path: server.path,
  }));
}

// Запуск отладки
async function debug() {
  console.log('═══ MCP Debugging Toolkit ═══\n');
  
  // Проверка Chrome CDP
  console.log('1. Проверка Chrome CDP...');
  const chrome = await checkChromeCDP();
  if (chrome.running) {
    console.log('   ✅ Chrome CDP запущен');
    console.log(`   Browser: ${chrome.Browser}`);
  } else {
    console.log('   ❌ Chrome CDP не запущен');
    console.log('   Решение: node chrome-launcher.js');
  }
  
  // Проверка opencode.json
  console.log('\n2. Проверка opencode.json...');
  const config = checkOpenCodeConfig();
  if (config.exists) {
    if (config.correctFormat) {
      console.log('   ✅ opencode.json в правильном формате');
      console.log(`   Серверы: ${config.servers.join(', ')}`);
    } else {
      console.log('   ❌ opencode.json в неправильном формате');
      console.log('   Решение: использовать формат "mcp", не "mcpServers"');
    }
  } else {
    console.log('   ❌ opencode.json не найден');
  }
  
  // Проверка MCP серверов
  console.log('\n3. Проверка MCP серверов...');
  const servers = checkMCPServers();
  servers.forEach(server => {
    if (server.exists) {
      console.log(`   ✅ ${server.name} найден`);
    } else {
      console.log(`   ❌ ${server.name} не найден`);
    }
  });
  
  console.log('\n═══ Рекомендации ═══');
  if (!chrome.running) {
    console.log('1. Запусти Chrome: node chrome-launcher.js');
  }
  if (!config.correctFormat) {
    console.log('2. Исправь opencode.json: используй формат "mcp"');
  }
  if (servers.some(s => !s.exists)) {
    console.log('3. Проверь пути к MCP серверам');
  }
}

debug().catch(console.error);
```

### Problem-Solving Workflow
Создай файл `mcp-servers/WORKFLOW.md`:

```markdown
# Рабочий процесс решения проблем

## Алгоритм решения проблем

### Шаг 1: Диагностика
1. Определи проблему
2. Найди ошибку
3. Проверь инструменты
4. Проверь настройки

### Шаг 2: Поиск решения
1. Проверь mcp-servers/PROBLEMS.md
2. Проверь документацию
3. Поищи решение в интернете
4. Создай решение

### Шаг 3: Реализация
1. Внеси изменения
2. Протестируй
3. Проверь побочные эффекты

### Шаг 4: Документация
1. Запиши проблему
2. Запиши решение
3. Обнови документацию

## Типичные проблемы и решения

### Проблема: MCP сервер не грузится
**Симптомы:** Инструмент недупатсупен
**Решение:**
1. Проверь opencode.json (формат "mcp")
2. Проверь пути к серверам
3. Перезапусти opencode
4. Проверь: node verify.js

### Проблема: Chrome CDP не работает
**Симптомы:** ECONNREFUSED 127.0.0.1:9222
**Решение:**
1. Запусти Chrome: node chrome-launcher.js
2. Проверь: node chrome-launcher.js --check
3. Если не работает: node chrome-launcher.js --kill

### Проблема: HTML обрезается
**Симптомы:** Не видно нужные элементы
**Решение:**
1. Используй chrome-devtools_cdp_evaluate
2. Используй точные CSS-селекторы
3. Разбивай на маленькие запросы

### Проблема: Zephyr API недоступен
**Симптомы:** 401 Unauthorized
**Решение:**
1. Проверь credentials: ~/.qtest/credentials.json
2. Проверь токен
3. Проверь сеть

## Инструменты для отладки

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

### test-mcp.js
```bash
node test-mcp.js browser-devtools    # Тест browser MCP
node test-mcp.js zephyr-scale        # Тест Zephyr MCP
node test-mcp.js all                 # Тест всех
```

## Контакты

- Документация: mcp-servers/README.md
- Проблемы: mcp-servers/PROBLEMS.md
- CSS-селекторы: mcp-servers/zephyr-filter-analysis.md
- Промт: mcp-servers/ADVANCED-PROMPT.md
```

---

## ИСПОЛЬЗОВАНИЕ

### Для обычных задач:
1. Скопируй промт из ADVANCED-PROMPT.md
2. Вставь в новую сессию opencode
3. Замени `[ЗАДАЧА]` на свою задачу

### При проблемах:
1. Проверь mcp-servers/PROBLEMS.md
2. Запусти debug-toolkit.js
3. Следуй алгоритму решения проблем

### Для отладки MCP:
1. Запусти node verify.js
2. Проверь opencode.json
3. Проверь Chrome CDP
4. Исправь проблемы
