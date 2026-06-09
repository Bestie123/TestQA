# Промт-шаблон для работы с qtest-runner

## Использование
Скопируй этот промт и вставь в новую сессию opencode для продолжения работы.

---

## Промт для новой сессии

```
Читай файлы ПЕРВЫМ:
1. TestQA/README.md — обзор проекта
2. TestQA/ACTIVE_GOAL.md — текущая цель и статус
3. TestQA/docs/rules/AGENTS.md — правила работы (ОБЯЗАТЕЛЬНО)

## Контекст проекта
- Проект: qtest-runner (E2E тестирование с Zephyr Scale)
- Jira: https://jira.ifellow.ru (Jira Server 8.20.13)
- Zephyr Scale: v9.23.0
- Проект: IBPA2 (projectId=18400)
- Браузер: Chrome с CDP на порту 9222
- MCP: chrome-devtools_cdp_*, zephyr-scale, browser-devtools

## Текущая задача
[ВСТАВЬ СЮДА КОНКРЕТНУЮ ЗАДАЧУ]

## Требования
1. ВСЕГДА проверяй реальный Zephyr через Chrome DevTools перед изменением UI
2. Используй точные CSS-селекторы (не угадывай)
3. Тестируй изменения в реальном браузере
4. Документируй проблемы и решения в mcp-servers/PROBLEMS.md

## Доступные инструменты
- chrome-devtools_cdp_navigate — навигация
- chrome-devtools_cdp_evaluate — выполнение JS
- chrome-devtools_cdp_click — клик по элементу
- chrome-devtools_cdp_get_html — получение HTML
- chrome-devtools_cdp_screenshot — скриншот
- zephyr-scale — Zephyr API (списки TC, циклов, планов)

## CSS-селекторы Zephyr (сохранены)
- Фильтр-панель: [data-testid="zephyr-scale-grid-filter-section"]
- Кнопка "Фильтры": button.expand-filters-button
- Кнопка "Добавить критерий": button.css-48ccbj
- Dropdown критериев: div.css-7uwa0r
- Поиск в dropdown: input[placeholder="Поиск..."]

## Формат ответа
- Кратко: что сделано, что дальше
- Тесты: npm test (должны проходить 289/289)
- Сборка: npm run build (должна быть успешной)
```

---

## Примеры задач

### Пример 1: Исправление фильтра
```
Исправь фильтр "Статус" на странице Test Cycles:
1. Открой реальный Zephyr: chrome-devtools_cdp_navigate → https://jira.ifellow.ru/secure/Tests.jspa#/v2/testCycles?projectId=10904
2. Проанализируй структуру фильтра через chrome-devtools_cdp_evaluate
3. Сравни с нашим SyncPage
4. Внеси исправления
5. Проверь в реальном браузере
```

### Пример 2: Новый компонент
```
Создай компонент TestPlanDetail:
1. Проанализируй реальный Zephyr: https://jira.ifellow.ru/secure/Tests.jspa#/v2/testPlans?projectId=10904
2. Определи структуру DOM
3. Создай компонент в SyncPage
4. Добавь в вкладку "Планы тестирования"
5. Протестируй
```

### Пример 3: Отладка MCP
```
MCP сервер browser-devtools не грузится:
1. Проверь opencode.json (формат "mcp", не "mcpServers")
2. Проверь пути к серверам
3. Запусти verify.js
4. Исправь ошибки
5. Перезапусти opencode
```

---

## Чеклист перед коммитом
- [ ] Все 289 тестов проходят
- [ ] Сборка успешна (npm run build)
- [ ] UI проверен в реальном браузере
- [ ] CSS-селекторы совпадают с реальным Zephyr
- [ ] Документация обновлена
