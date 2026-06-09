# ПОЛНЫЙ РАСШИРЕННЫЙ ПРОМТ: Полная доработка вкладки "Тестовые прогоны"

## Скопируй и вставь в новую сессию opencode:

```
# КОНТЕКСТ И ПРАВИЛА

Читай файлы ПЕРВЫМ (обязательно):
1. TestQA/README.md — обзор проекта
2. TestQA/ACTIVE_GOAL.md — текущая цель и статус
3. TestQA/docs/rules/AGENTS.md — правила работы (ОБЯЗАТЕЛЬНО)
4. qtest-runner/mcp-servers/ADVANCED-PROMPT.md — полный промт с самовосстановлением

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

## ЦЕЛЬ: Сделать вкладку "Тестовые прогоны" идентичной реальному Zephyr

## ЭТАП 1: АНАЛИЗ РЕАЛЬНОГО ZEPHYR

### Шаг 1.1: Открыть страницу Test Cycles
1. Запусти Chrome: node chrome-launcher.js
2. Открой: chrome-devtools_cdp_navigate → https://jira.ifellow.ru/secure/Tests.jspa#/v2/testCycles?projectId=10904
3. Сделай скриншот: chrome-devtools_cdp_screenshot

### Шаг 1.2: Проанализировать структуру страницы
Выполни JS для анализа:
```javascript
// Анализ верхней навигации
(() => {
  const navTabs = document.querySelectorAll('[class*="navTab"]');
  return Array.from(navTabs).map(t => ({
    text: t.textContent,
    active: t.classList.contains('navTabActive'),
    class: t.className,
  }));
})()

// Анализ工具栏
(() => {
  const toolbar = document.querySelector('[class*="toolbar"]');
  if (!toolbar) return 'Toolbar not found';
  const buttons = toolbar.querySelectorAll('button');
  return Array.from(buttons).map(b => ({
    text: b.textContent,
    class: b.className,
    disabled: b.disabled,
  }));
})()

// Анализ таблицы
(() => {
  const table = document.querySelector('table');
  if (!table) return 'Table not found';
  const headers = table.querySelectorAll('th');
  return Array.from(headers).map(h => ({
    text: h.textContent,
    class: h.className,
    width: h.style.width,
  }));
})()

// Анализ строки таблицы
(() => {
  const rows = document.querySelectorAll('table tbody tr');
  if (rows.length === 0) return 'No rows';
  const firstRow = rows[0];
  const cells = firstRow.querySelectorAll('td');
  return Array.from(cells).map(c => ({
    text: c.textContent.substring(0, 50),
    class: c.className,
    hasCheckbox: c.querySelector('input[type="checkbox"]') !== null,
    hasBadge: c.querySelector('[class*="badge"]') !== null,
    hasProgress: c.querySelector('[class*="progress"]') !== null,
  }));
})()
```

### Шаг 1.3: Сохрани результаты
Запиши в mcp-servers/zephyr-cycle-analysis.md:
- Навигация (вкладки)
-工具栏 (кнопки)
- Колонки таблицы
- Структура строки
- Фильтры
- Пагинация

## ЭТАП 2: ИСПРАВЛЕНИЕ ОШИБКИ "React is not defined"

### Шаг 2.1: Найди источник ошибки
1. Проверь консоль браузера: chrome-devtools_cdp_evaluate → console.errors
2. Найди файл: SyncPage.tsx
3. Проверь импорты в начале файла

### Шаг 2.2: Исправь импорт React
```tsx
// В начале SyncPage.tsx
import React from 'react';
```

### Шаг 2.3: Проверь конфигурацию
```json
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

### Шаг 2.4: Перезапусти dev-сервер
```bash
cd qtest-runner/packages/web-ui
npm run dev
```

## ЭТАП 3: ИСПРАВЛЕНИЕ НАВИГАЦИИ

### Шаг 3.1: Анализ навигации Zephyr
В реальном Zephyr навигация работает так:
1. Клик на вкладку → подсветка активной
2. Содержимое меняется
3. Дерево папок адаптируется
4. Фильтры адаптируются

### Шаг 3.2: Исправь навигацию в SyncPage
Код: SyncPage.tsx, строки 454-470

Текущий код:
```tsx
<div style={activeTab === 'cases' ? styles.navTabActive : styles.navTab}
     onClick={() => setActiveTab('cases')}>
  Тест кейсы
</div>
```

Исправленный код:
```tsx
<div style={activeTab === 'cases' ? styles.navTabActive : styles.navTab}
     onClick={() => {
       setActiveTab('cases');
       // Загрузить данные для Test Cases
       loadTestCases();
     }}>
  Тест кейсы
</div>
```

### Шаг 3.3: Добавь автоматическую загрузку
```tsx
useEffect(() => {
  if (activeTab === 'cases') loadTestCases();
  if (activeTab === 'cycles') loadTestRuns();
  if (activeTab === 'plans') loadTestPlans();
}, [activeTab]);
```

## ЭТАП 4: ИСПРАВЛЕНИЕ ТАБЛИЦЫ

### Шаг 4.1: Анализ таблицы Zephyr
В реальном Zephyr таблица Test Cycles содержит:
1. Чекбокс (выбор всех)
2. Наименование (кликабельное)
3. Ход выполнения (прогресс-бар)
4. Статус (badge)
5. Всего TC (число)
6. Создан (дата)

### Шаг 4.2: Исправь колонки таблицы
Код: SyncPage.tsx, renderTestCycles (строка 818)

Текущий код:
```tsx
<th style={styles.th}>Ключ</th>
<th style={styles.th}>Наименование</th>
<th style={styles.th}>Статус</th>
```

Исправленный код:
```tsx
<th style={{ ...styles.th, width: 30 }}>
  <input type="checkbox" style={styles.checkbox} />
</th>
<th style={styles.th}>Наименование</th>
<th style={{ ...styles.th, width: 200 }}>Ход выполнения</th>
<th style={{ ...styles.th, width: 120 }}>Статус</th>
<th style={{ ...styles.th, width: 80 }}>Всего TC</th>
<th style={{ ...styles.th, width: 150 }}>Создан</th>
```

### Шаг 4.3: Исправь строку таблицы
Код: SyncPage.tsx, renderTestCycles (строка 822)

Добавь:
1. Чекбокс для выбора
2. Прогресс-бар для хода выполнения
3. Badge для статуса
4. Форматирование даты

## ЭТАП 5: ИСПРАВЛЕНИЕ ФИЛЬТРОВ

### Шаг 5.1: Анализ фильтров Zephyr
В реальном Zephyr фильтры Test Cycles:
1. Статус (dropdown)
2. Дата начала (date range)
3. Дата окончания (date range)

### Шаг 5.2: Исправь фильтры
Код: SyncPage.tsx, CYC_CRITERIA (строка 44)

Текущий код:
```tsx
const CYC_CRITERIA = [
  { field: 'cycStatus', label: 'Статус' },
] as const;
```

Исправленный код:
```tsx
const CYC_CRITERIA = [
  { field: 'cycStatus', label: 'Статус' },
  { field: 'startDate', label: 'Дата начала' },
  { field: 'endDate', label: 'Дата окончания' },
] as const;
```

### Шаг 5.3: Добавь контроли для новых фильтров
```tsx
{field === 'startDate' && (
  <input type="date" value={filterValues.startDate || ''}
    onChange={e => setFilterValues(p => ({ ...p, startDate: e.target.value }))}
    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }} />
)}
{field === 'endDate' && (
  <input type="date" value={filterValues.endDate || ''}
    onChange={e => setFilterValues(p => ({ ...p, endDate: e.target.value }))}
    style={{ padding: '4px 6px', fontSize: 13, border: '1px solid #dfe1e6', borderRadius: 3 }} />
)}
```

## ЭТАП 6: ИСПРАВЛЕНИЕ ДЕРЕВА ПАПОК

### Шаг 6.1: Анализ дерева папок Zephyr
В реальном Zephyr:
- Test Cases: дерево папок видно
- Test Cycles: дерево папок скрыто или показывает папки циклов
- Test Plans: дерево папок скрыто или показывает папки планов

### Шаг 6.2: Исправь дерево папок
Код: SyncPage.tsx, строка 485

Текущий код:
```tsx
{folders.length > 0 && folders.map(f => (
  <FolderTreeItem key={f.id} node={f} depth={0}
    activePath={filterFolder}
    onSelect={path => setFilterFolder(filterFolder === path ? '' : path)} />
))}
```

Исправленный код:
```tsx
{activeTab === 'cases' && folders.length > 0 && folders.map(f => (
  <FolderTreeItem key={f.id} node={f} depth={0}
    activePath={filterFolder}
    onSelect={path => setFilterFolder(filterFolder === path ? '' : path)} />
))}
{activeTab === 'cycles' && (
  <div style={{ padding: '16px', fontSize: 12, color: '#97a0af' }}>
    Папки прогонов
  </div>
)}
{activeTab === 'plans' && (
  <div style={{ padding: '16px', fontSize: 12, color: '#97a0af' }}>
    Папки планов
  </div>
)}
```

## ЭТАП 7: ИСПРАВЛЕНИЕ工具栏

### Шаг 7.1: Анализ工具栏 Zephyr
В реальном Zephyр工具栏 Test Cycles:
1. Поиск
2. Загрузить прогоны
3. Фильтры
4. Счётчик (X прогонов)

### Шаг 7.2: Исправь工具栏
Код: SyncPage.tsx, renderTestCycles (строка 819)

Текущий код:
```tsx
<div style={styles.toolbar}>
  <input style={styles.searchInput} placeholder="Поиск..." />
  <button style={styles.btn(true)}>Загрузить</button>
</div>
```

Исправленный код:
```tsx
<div style={styles.toolbar}>
  <input style={styles.searchInput} placeholder="Поиск по ключу или названию..."
    value={cycSearch} onChange={e => setCycSearch(e.target.value)} />
  <button style={styles.btn(true)} onClick={loadTestRuns} disabled={loading}>
    {loading ? 'Загрузка...' : 'Загрузить прогоны'}
  </button>
  <button style={{
    ...styles.btn(), background: cycShowFilterMenu ? '#ebf2ff' : '#fff',
    borderColor: cycShowFilterMenu ? '#0052cc' : '#dfe1e6',
    color: cycShowFilterMenu ? '#0052cc' : '#42526e',
  }} onClick={() => setCycShowFilterMenu(!cycShowFilterMenu)}>
    Фильтры {cycShowFilterMenu ? '▲' : '▼'}
  </button>
  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#97a0af' }}>
    {testRuns.length} прогонов · {filtered.length} показано
  </span>
</div>
```

## ЭТАП 8: ИСПРАВЛЕНИЕ РАСШИРЕНИЯ СТРОК

### Шаг 8.1: Анализ расширения строк Zephyr
В реальном Zephyr:
1. Клик на строку → раскрывается детализация
2. Показываются тест-кейсы прогона
3. Каждый TC показывает статус выполнения

### Шаг 8.2: Исправь расширение строк
Код: SyncPage.tsx, renderTestCycles (строка 826)

Проверь что handleCycleClick работает:
```tsx
async function handleCycleClick(runKey: string) {
  if (selectedCycleKey === runKey) {
    setSelectedCycleKey(null);
    setCycleTestCases([]);
    return;
  }
  setSelectedCycleKey(runKey);
  setCycleLoading(true);
  setCycleTestCases([]);
  const res = await fetchZephyrTestRunTestCases(api, runKey);
  setCycleTestCases(res.data || []);
  setCycleLoading(false);
}
```

### Шаг 8.3: Проверь отображение детализации
```tsx
{expanded && (
  <tr key={`${run.key}-detail`}>
    <td colSpan={6} style={{ padding: 0, background: '#fafbfc' }}>
      {cycleLoading ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#97a0af' }}>
          Загрузка...
        </div>
      ) : cycleTestCases.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#97a0af' }}>
          Нет тест-кейсов в прогоне
        </div>
      ) : (
        <div style={{ padding: '8px 16px 16px' }}>
          {/* Таблица тест-кейсов */}
        </div>
      )}
    </td>
  </tr>
)}
```

## ЭТАП 9: ТЕСТИРОВАНИЕ

### Шаг 9.1: Тестирование в браузере
1. Открой http://localhost:8080
2. Переключи на вкладку "Тестовые прогоны"
3. Проверь:
   - Навигация работает
   - Таблица отображается
   - Фильтры работают
   - Расширение строк работает
   - Нет ошибок в консоли

### Шаг 9.2: Сравнение с реальным Zephyr
1. Открой реальный Zephyr
2. Сравни:
   - Структуру таблицы
   - Колонки
   - Фильтры
   - Расширение строк
   - Пагинацию

### Шаг 9.3: Тестирование функционала
1. Поиск: введи текст → проверь фильтрацию
2. Фильтры: добавь критерий → проверь фильтрацию
3. Расширение: кликни на строку → проверь детализацию
4. Пагинация: переключи страницы → проверь загрузку

## ЭТАП 10: ДОКУМЕНТАЦИЯ

### Шаг 10.1: Обнови PROBLEMS.md
Запиши:
- Проблему "React is not defined"
- Решение (импорт React)
- Другие проблемы и решения

### Шаг 10.2: Обнови ACTIVE_GOAL.md
Запиши:
- Что сделано
- Какие файлы изменены
- Статус задачи

### Шаг 10.3: Обнови zephyr-cycle-analysis.md
Запиши:
- CSS-селекторы
- Структуру страницы
- Колонки таблицы
- Фильтры

## ЧЕКЛИСТ ГОТОВНОСТИ

### Навигация
- [ ] Вкладки переключаются без ошибок
- [ ] Активная вкладка подсвечивается
- [ ] Данные загружаются автоматически

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

### Дерево папок
- [ ] Дерево адаптируется под вкладку
- [ ] Папки кликабельны
- [ ] Подсветка работает

### Расширение строк
- [ ] Строки раскрываются
- [ ] Детализация загружается
- [ ] Тест-кейсы отображаются
- [ ] Статусы выполнения отображаются

### Общее
- [ ] Все 289 тестов проходят
- [ ] Сборка успешна (npm run build)
- [ ] Нет ошибок в консоли
- [ ] UI совпадает с реальным Zephyr
- [ ] Документация обновлена

## ФОРМАТ ОТВЕТА

### При успехе:
```
✅ Задача выполнена
- Что сделано: [кратко]
- Файлы изменены: [список]
- CSS-селекторы: [список]
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
- Промт: mcp-servers/ADVANCED-PROMPT.md
- Отладка: mcp-servers/debug-toolkit.js
```

---

## КРАТКАЯ ВЕРСИЯ (для быстрого запуска):

```
Полная доработка вкладки "Тестовые прогоны":

1. Анализ:
   - Открой реальный Zephyr
   - Проанализируй структуру
   - Сохрани CSS-селекторы

2. Исправление:
   - Ошибка "React is not defined"
   - Навигация между вкладками
   - Колонки таблицы
   - Фильтры
   - Дерево папок
   - Расширение строк
   -工具栏

3. Тестирование:
   - Проверь в браузере
   - Сравни с реальным Zephyr
   - Проверь: npm test && npm run build

4. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
   - Обнови zephyr-cycle-analysis.md
```
