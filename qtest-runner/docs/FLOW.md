# QTest Runner — Полный поток выполнения (Execution Flow)

## Как работает выполнение тест-кейса

```
Web UI ──HTTP──► API Gateway ──HTTP──► Execution Service ──HTTP──► TC Service
                   │                       │
                   │                  (загружает тест-кейс
                   │                   и его шаги)
                   │                       │
                   ▼                       ▼
              Desktop Agent ──WebSocket──► Chrome Extension
              (Playwright/CDP)            (индикатор на странице)
```

### Пошагово:

**1. Пользователь нажимает «▶ Выполнить» в Web UI**
- Web UI → POST `/api/executions` → API Gateway → Execution Service (порт 3003)
- Execution Service загружает тест-кейс из TC Service (порт 3001)
- Создаёт запись в БД executions.db со статусом `running`
- Создаёт записи для каждого шага со статусом `running`
- Возвращает объект Execution с ID

**2. Открывается ExecutionPage**
- Web UI показывает ExecutionPage с executionId
- ExecutionPage загружает `/api/executions/:id` каждую секунду (опрос)
- Видит статус `running`, первый шаг со статусом `running`

**3. Пользователь нажимает кнопку статуса шага**
- Например: «✓ Пройден»
- Web UI → PATCH `/api/executions/:id/steps/:index` → Execution Service
- Execution Service:
  - Обновляет статус шага на `passed`
  - Автоматически переводит следующий шаг в `running`
  - Если все шаги пройдены → execution status = `passed`
  - Если есть failed → execution status = `failed`

**4. ExecutionPage обновляется**
- Показывает новый статус шага
- Авто-скролл к следующему шагу
- Прогресс-бар обновляется

---

## Как работает Chrome Extension + Desktop Agent

```
Chrome Extension ──WebSocket──► Desktop Agent (browser-agent)
(popup + content)               (порт 3005, Playwright CDP)
                                      │
                                      ▼
                                 Chrome Browser
                                 (управляемый через CDP)
```

### Extension НЕ управляет выполнением ТС

**Важно:** Chrome Extension — это **вспомогательный инструмент**, а не основной способ выполнения.

Расширение:
- Показывает **статус подключения** к Desktop Agent (зелёный/красный индикатор)
- Позволяет **запустить браузер** через Playwright (для тестирования)
- **Индикатор шага** — синяя полоса сверху страницы, если выполнение активно
- **Подсветка элементов** при кликах/навигации

### Что нужно для работы расширения

```bash
# 1. Установить браузеры для Playwright (ОБЯЗАТЕЛЬНО!)
cd packages\browser-agent
npx playwright install chromium

# 2. Запустить все сервисы
start.bat

# 3. Загрузить расширение в Chrome
chrome://extensions → Загрузить распакованное → packages\chrome-extension\dist

# 4. В расширении:
#    - Нажать «Подключиться к агенту» (статус станет зелёным)
#    - Нажать «Запустить браузер» (откроется окно Chrome)
#    - Браузером можно пользоваться для ручного тестирования
```

### Как расширение связано с выполнением

**Текущий статус:** расширение получает статус выполнения из execution-service через Desktop Agent, но **автоматическое выполнение шагов через расширение ещё не реализовано**.

В будущем (следующие итерации):
- Расширение будет получать команды: «нажми кнопку X», «заполни поле Y»
- Desktop Agent будет выполнять шаги через CDP автоматически
- Extension будет только показывать индикатор

**Сейчас выполнение происходит так:**
1. Открыть Web UI (http://localhost:8080)
2. Найти тест-кейс
3. Нажать «▶ Выполнить»
4. Нажимать кнопки «✓ Пройден / ✗ Провален» для каждого шага вручную

---

## Диагностика проблем

### «Ошибка создания выполнения»

```bash
# 1. Проверить, что все сервисы запущены
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3003/health

# 2. Проверить, что тест-кейсы импортированы
curl http://localhost:3001/api/testcases | head -c 200

# 3. Проверить execution-service напрямую
curl -X POST http://localhost:3003/api/executions -H "Content-Type: application/json" -d "{\"testCaseKey\":\"IBPA-T1\"}"
```

### Chrome Extension не подключается

```bash
# 1. Проверить, что browser-agent запущен
curl http://localhost:3005/health

# 2. Проверить, что WebSocket доступен
# В консоли расширения (F12):
# > new WebSocket('ws://localhost:3005')
# Должен открыться (readyState = 1)

# 3. Перезагрузить расширение
chrome://extensions → значок обновления
```

### «Нажать «Запустить браузер» — ничего не происходит»

```bash
# 1. Установить Playwright браузеры
cd packages\browser-agent
npx playwright install chromium

# 2. Проверить консоль browser-agent (окно qtest-agent)
# Там должно быть:
#   browser-agent starting...
#   NOTE: If Chrome fails to launch, run: npx playwright install chromium
#   browser-agent WebSocket running on port 3005

# 3. Если ошибка — браузеры не установлены
```

### Vite warning: Invalid input options (jsx)

Это предупреждение совместимости Vite 8 + React 19. **Не влияет на работу.**
Можно игнорировать. Для исправления:
```bash
npm install @vitejs/plugin-react@latest --legacy-peer-deps
```

---

## Структура проекта (кратко)

```
packages/
  shared-types/         # Интерфейсы TypeScript
  testcase-service/     # порт 3001 — CRUD, Excel, Zephyr sync
  step-library-service/ # порт 3002 — библиотека шагов
  execution-service/    # порт 3003 — выполнение ТС
  recorder-service/     # порт 3004 — запись действий
  browser-agent/        # порт 3005 (WS) — Playwright, CDP
  chrome-extension/     # Manifest V3 — popup, индикатор
  api-gateway/          # порт 3000 — BFF, прокси
  web-ui/               # порт 5173/8080 — React SPA
```
