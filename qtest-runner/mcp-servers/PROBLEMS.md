# MCP Servers — Проблемы и решения

## Статус: ✅ Все проблемы решены

### Решённые проблемы:

1. **MCP инструменты не загружались** → Добавлены в opencode.json в формате `"mcp"` (не `"mcpServers"`)
2. **Chrome DevTools соединение обрывалось** → Создан `chrome-launcher.js` для consistent запуска
3. **HTML страницы обрезался** → Используем `chrome-devtools_cdp_evaluate` с точными CSS-селекторами
4. **Нет инструмента для анализа DOM** → Создан `browser-devtools` MCP сервер
5. **Zephyr API требовал авторизацию** → Используем `~/.qtest/credentials.json`
6. **Нет инструмента для сравнения страниц** → Используем комбинацию `evaluate` + `get_html`
7. **Debug toolkit неправильно искал файлы** → Исправлены пути в `debug-toolkit.js`
8. **Сайт не на весь экран (регресс)** → Добавлены `height: '100%', width: '100%'` в zPage стили (SyncPage.tsx)
9. **Лимит 500 прогонов** → `fetchTestRuns()` теперь загружает ВСЕ прогоны через постраничную пагинацию
10. **Лимит 100 тест-кейсов** → `queryZephyrTestCases()` поддерживает `maxPages=0` (безлимит)
11. **Медленная загрузка** → Добавлено клиентское кэширование `fetchWithCache()` с TTL 5 мин

### Созданные инструменты:

- `chrome-launcher.js` — запуск Chrome с CDP
- `test-mcp.js` — тестирование MCP серверов
- `verify.js` — быстрая проверка всех серверов
- `debug-toolkit.js` — полная диагностика MCP
- `zephyr-filter-analysis.md` — анализ фильтров реального Zephyr
- `ADVANCED-PROMPT.md` — продвинутый промт с самовосстановлением
- `WORKFLOW.md` — рабочий процесс решения проблем

### Ключевые находки:

Реальные фильтры Zephyr Scale:
1. Кнопка "Фильтры" → раскрывает панель
2. Кнопка "Добавить критерий" → dropdown с поиском
3. **10 критериев:** Наименование, Статус, Приоритет, Тег, Дата создания, Расчётное время, Компонент, Владелец, Покрытие (Задачи), Покрытие (Страницы)
4. Каждый активный критерий отображается инлайн с контролом и кнопкой удаления

### CSS-селекторы (сохранены):

- Фильтр-панель: `[data-testid="zephyr-scale-grid-filter-section"]`
- Кнопка "Фильтры": `button.expand-filters-button`
- Кнопка "Добавить критерий": `button.css-48ccbj`
- Dropdown: `div.css-7uwa0r`
- Поиск: `input[placeholder="Поиск..."]`
- Опция: `div.zephyr-scale-styled-pop-select__option`
- Заголовок группы: `div.zephyr-scale-styled-pop-select__group-heading`

### Статус инструментов:

- ✅ Chrome CDP запущен
- ✅ opencode.json в правильном формате
- ✅ MCP серверы найдены
- ✅ Зависимости установлены
- ✅ Все проверки пройдены

## Правила тестирования регрессий

### При добавлении нового функционала:
1. Добавь тест в `regression-test.js`
2. Проверь что тест работает
3. Запиши эталонное поведение
4. Обнови документацию

### При удалении функционала:
1. Удали тест из `regression-test.js`
2. Проверь что другие тесты работают
3. Обнови документацию

### При изменении UI:
1. Запиши текущее состояние (еталон)
2. После изменений проверь на регрессии
3. Если есть регрессии — исправь
4. Обнови эталон в MCP

## Логирование в regression-test MCP

### Что логируется:
- Все вызовы инструментов
- Все ответы сервера
- Все ошибки
- Время выполнения
- Параметры запросов

### Формат логов:
```json
{
  "timestamp": "2026-06-04T12:08:25.965Z",
  "action": "tool_call",
  "name": "test_fullscreen",
  "args": { "url": "http://localhost:8080" }
}
```

### Просмотр логов:
```bash
# Через MCP инструмент get_logs
node -e "
const { spawn } = require('child_process');
const server = spawn('node', ['regression-test.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
server.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_logs',arguments:{limit:10}}}) + '\n');
server.stdout.on('data', d => console.log(d.toString()));
"
```

### Очистка логов:
```bash
# Через MCP инструмент clear_logs
node -e "
const { spawn } = require('child_process');
const server = spawn('node', ['regression-test.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
server.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'clear_logs',arguments:{}}}) + '\n');
server.stdout.on('data', d => console.log(d.toString()));
"
```

---

## Инструменты для диагностики

### chrome-launcher.js
Запуск Chrome с CDP:
```bash
node chrome-launcher.js
```

### test-mcp.js
Тестирование MCP серверов:
```bash
node test-mcp.js browser-devtools
node test-mcp.js zephyr-scale
```

### inspect-page.js
Быстрый анализ страницы:
```bash
node inspect-page.js "https://jira.ifellow.ru/secure/Tests.jspa#/v2/testCases?projectId=10904"
```
