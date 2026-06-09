# РАСШИРЕННЫЙ ПРОМТ: Исправление ошибки "React is not defined"

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

## ОШИБКА: "React is not defined"

### Описание:
При переключении на вкладку "Тестовые прогоны" возникает ошибка:
```
React is not defined
```

### Причины:
1. Отсутствует импорт React в файле
2. React используется в JSX, но не импортирован
3. Проблема с конфигурацией сборки
4. Конфликт версий React

## РАБОЧИЙ ПРОЦЕСС

### Шаг 1: Диагностика
1. Проверь консоль браузера: chrome-devtools_cdp_evaluate → console.errors
2. Найди файл с ошибкой: проверь stack trace
3. Определи строку с ошибкой

### Шаг 2: Анализ кода
1. Найди файл: qtest-runner/packages/web-ui/src/pages/SyncPage.tsx
2. Проверь импорты в начале файла
3. Найди строку с ошибкой

### Шаг 3: Исправление
Вариант 1: Добавь импорт React
```tsx
import React from 'react';
```

Вариант 2: Импортируй конкретные компоненты
```tsx
import { useState, useEffect } from 'react';
```

Вариант 3: Проверь конфигурацию Vite
```js
// vite.config.ts
export default defineConfig({
  plugins: [react()],
})
```

### Шаг 4: Тестирование
1. Перезапусти dev-сервер: npm run dev
2. Открой браузер: http://localhost:8080
3. Переключи вкладки
4. Проверь консоль на ошибки

### Шаг 5: Документация
1. Запиши проблему в mcp-servers/PROBLEMS.md
2. Запиши решение
3. Обнови ACTIVE_GOAL.md

## ТИПИЧНЫЕ РЕШЕНИЯ

### Решение 1: Импорт React
```tsx
// В начале файла SyncPage.tsx
import React from 'react';
```

### Решение 2: Проверь JSX конфигурацию
```json
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

### Решение 3: Проверь package.json
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

### Решение 4: Переустанови зависимости
```bash
cd qtest-runner/packages/web-ui
rm -rf node_modules
npm install
```

## ФОРМАТ ОТВЕТА

### При успехе:
```
✅ Ошибка исправлена
- Причина: [что было не так]
- Решение: [что сделал]
- Файл: [какой файл изменён]
- Строка: [какая строка]
- Тесты: 289/289 проходят
- Сборка: успешна
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

- [ ] Ошибка "React is not defined" исправлена
- [ ] Все вкладки переключаются без ошибок
- [ ] Test Cases работает
- [ ] Test Cycles работает
- [ ] Test Plans работает
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
Исправь ошибку "React is not defined" в SyncPage:

1. Диагностика:
   - Проверь консоль браузера
   - Найди файл с ошибкой
   - Определи строку

2. Исправление:
   - Добавь import React from 'react'
   - Или проверь конфигурацию Vite
   - Или переустанови зависимости

3. Тестирование:
   - Перезапусти dev-сервер
   - Проверь все вкладки
   - Проверь: npm test && npm run build

4. Документация:
   - Обнови PROBLEMS.md
   - Обнови ACTIVE_GOAL.md
```
