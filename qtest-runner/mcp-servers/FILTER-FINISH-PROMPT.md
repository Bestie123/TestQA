# Промт: Доделать фильтры SyncPage

## Скопируй и вставь в новую сессию opencode:

```
# КОНТЕКСТ

Читай файлы ПЕРВЫМ:
1. TestQA/README.md — обзор проекта
2. TestQA/ACTIVE_GOAL.md — текущая цель
3. TestQA/docs/rules/AGENTS.md — правила (ОБЯЗАТЕЛЬНО)

## ЗАДАЧА: Доделать фильтры SyncPage до полного соответствия реальному Zephyr

## ТЕКУЩЕЕ СОСТОЯНИЕ
- SyncPage.tsx: фильтры работают частично
- Есть "Добавить критерий" dropdown с поиском
- Есть 10 критериев (Наименование, Статус, Приоритет и т.д.)
- НЕТ: правильных контролей для каждого критерия
- НЕТ: фильтрации данных по выбранным критериям

## ЧТО НУЖНО СДЕЛАТЬ

### Шаг 1: Анализ реального Zephyr
1. Открой Chrome: chrome-devtools_cdp_navigate → https://jira.ifellow.ru/secure/Tests.jspa#/v2/testCases?projectId=10904
2. Нажми "Фильтры" → "Добавить критерий"
3. Выбери каждый критерий и посмотри какой kontrol появляется
4. Сохрани CSS-селекторы в mcp-servers/zephyr-filter-analysis.md

### Шаг 2: Исправить контроли для каждого критерия
Текущий код в SyncPage.tsx (строки 629-660):
- status → select (✅ работает)
- priority → select (✅ работает)
- owner → select (✅ работает)
- name → text input (⚠️ нужно: поиск по подстроке)
- tag → text input (⚠️ нужно: поиск по подстроке)
- component → select (⚠️ нужно: загрузка списка компонентов)
- createdDate → date range (⚠️ нужно: 2 date picker)
- estimatedTime → number range (⚠️ нужно: 2 number input)
- coverageIssues → number range (⚠️ нужно: 2 number input)
- coveragePages → number range (⚠️ нужно: 2 number input)

### Шаг 3: Добавить фильтрацию данных
В функции loadTestCases (строка 292) нужно:
1. Отправлять параметры фильтров на сервер
2. Сервер должен фильтровать данные
3. Обновлять таблицу с отфильтрованными данными

### Шаг 4: Добавить фильтры для Test Cycles и Test Plans
В функциях renderTestCycles и renderTestPlans:
1. Добавить те же критерии что и для Test Cases
2. Адаптировать контроли под специфику циклов/планов

## CSS-СЕЛЕКТОРЫ (СОХРАНЕНИ)
- Фильтр-панель: [data-testid="zephyr-scale-grid-filter-section"]
- Кнопка "Фильтры": button.expand-filters-button
- Кнопка "Добавить критерий": button.css-48ccbj
- Dropdown: div.css-7uwa0r
- Поиск: input[placeholder="Поиск..."]
- Опция: div.zephyr-scale-styled-pop-select__option

## ФОРМАТ ОТВЕТА
После каждого шага:
1. Что сделано
2. Какие CSS-селекторы использованы
3. Как проверить в браузере
4. Статус: ✅/⚠️/❌

## ЧЕКЛИСТ ГОТОВНОСТИ
- [ ] Все 10 критериев имеют правильные контроли
- [ ] Фильтрация работает для Test Cases
- [ ] Фильтры работают для Test Cycles
- [ ] Фильтры работают для Test Plans
- [ ] UI совпадает с реальным Zephyr
- [ ] Все 289 тестов проходят
- [ ] Сборка успешна
```

---

## Краткая версия (для быстрого запуска):

```
Доделай фильтры SyncPage:
1. Открой реальный Zephyr через Chrome DevTools
2. Проанализируй каждый из 10 критериев
3. Исправь контроли в SyncPage.tsx
4. Добавь фильтрацию данных
5. Протестируй в браузере
6. Проверь: npm test && npm run build

CSS-селекторы: button.expand-filters-button, button.css-48ccbj, div.css-7uwa0r
```
