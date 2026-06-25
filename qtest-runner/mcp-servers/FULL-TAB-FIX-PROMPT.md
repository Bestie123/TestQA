# ПОЛНЫЙ ПРОМТ: Исправление переключения вкладок SyncPage

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

## CSS-СЕЛЕКТОРЫ ZEPHYR (СОХРАНЕНЫ)

### Test Cases страница
- Фильтр-панель: [data-testid="zephyr-scale-grid-filter-section"]
- Кнопка "Фильтры": button.expand-filters-button
- Кнопка "Добавить критерий": button.css-48ccbj
- Dropdown: div.css-7uwa0r
- Поиск: input[placeholder="Поиск..."]
- Опция: div.zephyr-scale-styled-pop-select__option

### Test Cycles страница
- Таблица: [data-testid="zephyr-scale-grid-table"]
- Строка: [data-testid="zephyr-scale-grid-row"]

### Test Plans страница
- Таблица: [data-testid="zephyr-scale-grid-table"]

## ЗАДАЧА: Исправить переключение между вкладками

### Текущие проблемы:
1. Дерево папок НЕ меняется при переключении вкладок
2. Фильтры НЕ адаптируются под тип данных
3. Данные НЕ загружаются автоматически
4. Нет визуального отличия между вкладками
5. Колонки таблицы НЕ соответствуют Zephyr

## РАБОЧИЙ ПРОЦЕСС

### Шаг 1: Анализ реального Zephyr
1. Открой Test Cases: chrome-devtools_cdp_navigate → https://jira.ifellow.ru/secure/Tests.jspa#/v2/testCases?projectId=10904
2. Проанализируй: дерево папок, фильтры, колонки,工具栏
3. Сохрани CSS-селекторы в mcp-servers/zephyr-tab-analysis.md
4. Повтори для Test Cycles и Test Plans

### Шаг 2: Исправить дерево папок
- Test Cases: показывать папки с тест-кейсами
- Test Cycles: показывать папки с циклами (или скрыть дерево)
- Test Plans: показывать папки с планами (или скрыть дерево)

Код: SyncPage.tsx, строка 485-494

### Шаг 3: Исправить фильтры
- Test Cases: Статус, Приоритет, Владелец, Компонент, Тег
- Test Cycles: Статус, Дата начала, Дата окончания
- Test Plans: Статус, Дата создания

Код: SyncPage.tsx, FILTER_CRITERIA (строка 38)

### Шаг 4: Исправить загрузку данных
- При клике на вкладку → автоматическая загрузка
- Показать индикатор загрузки
- Обновить таблицу

Код: SyncPage.tsx, useEffect для activeTab (строка 335)

### Шаг 5: Исправить колонки таблицы
- Test Cases: Чекбокс, П, Ключ, B, Наименование, Статус, R, I
- Test Cycles: Ключ, Наименование, Ход выполнения, Статус, Всего TC, Создан
- Test Plans: Ключ, Наименование, Статус

Код: SyncPage.tsx, renderTestCases/renderTestCycles/renderTestPlans

### Шаг 6: Исправить工具栏
- Test Cases: Поиск, Загрузить TC, Синхронизировать, Фильтры
- Test Cycles: Поиск, Загрузить прогоны, Фильтры
- Test Plans: Поиск, Загрузить планы

Код: SyncPage.tsx, функции render*

## ФОРМАТ ОТВЕТА

### При успехе:
```
✅ Задача выполнена
- Что сделано: [кратко]
- Файлы изменены: [список]
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

## ЧЕКЛИСТ ГОТОВНОСТИ

- [ ] Дерево папок меняется при переключении вкладок
- [ ] Фильтры адаптируются под тип данных
- [ ] Данные загружаются автоматически
- [ ] Колонки таблицы соответствуют Zephyr
- [ ]工具栏 соответствует Zephyr
- [ ] UI совпадает с реальным Zephyr
- [ ] Все 289 тестов проходят
- [ ] Сборка успешна (npm run build)
- [ ] Документация обновлена
- [ ] ACTIVE_GOAL.md обновлён

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
Исправь переключение вкладок SyncPage:

1. Анализ:
   - Открой реальный Zephyr для каждой вкладки
   - Сравни дерево папок, фильтры, колонки
   - Сохрани CSS-селекторы

2. Исправление:
   - Дерево папок (адаптивное)
   - Фильтры (разные для каждой вкладки)
   - Загрузка данных (автоматическая)
   - Колонки таблицы
   -工具栏

3. Тестирование:
   - Проверь в браузере
   - Сравни с реальным Zephyr
   - Проверь: npm test && npm run build

4. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
```
