# QTest Runner — Руководство по использованию

## Содержание
1. [Способы запуска](#способы-запуска)
2. [Архитектура](#архитектура)
3. [Быстрый старт](#быстрый-старт)
4. [Iteration 1 — Просмотр и импорт тест-кейсов](#iteration-1--просмотр-и-импорт-тест-кейсов)
5. [Iteration 2 — Выполнение тест-кейсов](#iteration-2--выполнение-тест-кейсов)
6. [Iteration 3 — Chrome Extension + Desktop Agent](#iteration-3--chrome-extension--desktop-agent)
7. [Iteration 4 — Recorder + Сложные сценарии](#iteration-4--recorder--сложные-сценарии)
8. [Iteration 5 — Zephyr Sync + Отчёты + Coverage](#iteration-5--zephyr-sync--отчёты--coverage)

---

## Способы запуска

### Способ 1 — Двойной клик на `start.bat` (CMD)

Дважды кликнуть `start.bat` в корне проекта. Batch-файл:
1. Собирает все 7 пакетов (`npm run build`)
2. Запускает 7 сервисов в отдельных окнах CMD
3. Ждёт нажатия любой клавиши для остановки всех сервисов

> **Важно:** При первом запуске выполните `npm install` в корне проекта.

### Способ 2 — PowerShell (пошагово)

```powershell
cd Q:\User_Data\Desktop\TestQA\qtest-runner

# Сборка
foreach ($pkg in @('shared-types','testcase-service','step-library-service','execution-service','api-gateway','browser-agent','recorder-service')) {
  Push-Location "packages\$pkg"; npm run build; Pop-Location
}

# Запуск сервисов
foreach ($pkg in @('testcase-service','step-library-service','execution-service','recorder-service','browser-agent','api-gateway')) {
  Start-Process -WorkingDirectory "Q:\User_Data\Desktop\TestQA\qtest-runner\packages\$pkg" -FilePath "node" -ArgumentList "dist/index.js"
}

# Web UI (Vite dev server)
Start-Process -WorkingDirectory "Q:\User_Data\Desktop\TestQA\qtest-runner\packages\web-ui" -FilePath "npx.cmd" -ArgumentList "vite --port 8080 --host"
```

### Способ 3 — Ручной запуск (для отладки)

```bash
# Терминал 1: testcase-service
cd packages\testcase-service
npm run build
npm run start

# Терминал 2: step-library-service
cd packages\step-library-service
npm run build
npm run start

# ... и т.д. для остальных сервисов
```

Каждый сервис запускается в отдельном терминале. Полезно для отладки — видно логи каждого сервиса.

---

## Архитектура

```
Web UI (React) ──► API Gateway (3000) ──► testcase-service (3001)
                                          ├── step-library-service (3002)
                                          ├── execution-service (3003)
                                          ├── recorder-service (3004)
                                          └── browser-agent (3005) ◄── WebSocket
                                                                        └── Chrome Extension
```

Все сервисы запускаются одной командой `start.bat`.

---

## Быстрый старт

```bash
# 1. Установить зависимости (из корня проекта)
npm install

# 2. Запустить все сервисы (двойным кликом на start.bat или через cmd)
start.bat

# 3. Открыть Web UI
http://localhost:8080

# Если порт 8080 занят — Vite выберет другой (например, 8081).
# Смотрите вывод консоли для актуального адреса.

# 4. Для Chrome Extension — загрузить распакованное расширение:
#    chrome://extensions → Загрузить распакованное → packages/chrome-extension/dist
```

> **Для PowerShell:** используйте `.\start.bat` вместо `start.bat` (или см. раздел «Способы запуска»).

---

## Iteration 1 — Просмотр и импорт тест-кейсов

### Запуск
```bash
start.bat
# Сервисы: testcase-service (3001), step-library-service (3002), api-gateway (3000), web-ui (8080)
```

### Web UI: Страница тест-кейсов
- **Список тест-кейсов** — таблица с Key, Name, Priority, Status, Steps, Coverage
- **Поиск** — по названию или ключу
- **Фильтр по папке** — выпадающий список всех папок
- **Детали тест-кейса** — клик по строке открывает: предусловия, цель, пошаговые инструкции

### Импорт Excel (Zephyr Scale Export)
1. Перейти на страницу «Импорт»
2. Выбрать `.xlsx` файл (формат Zephyr Scale — 18 колонок)
3. Нажать «Импортировать»

Формат файла: стандартный Excel-экспорт из Zephyr Scale.
Колонки: Key, Name, Status, Precondition, Objective, Folder, Priority, Component, Labels,
Owner, Estimated Time, Coverage Issues, Coverage Pages и 3 колонки шагов (Step, Test Data, Expected Result).

### API endpoints
```
GET  /api/testcases         — список тест-кейсов (?folder=&search=)
GET  /api/testcases/:key    — детали тест-кейса
GET  /api/folders           — список папок
POST /api/import            — импорт Excel (rows: string[][])
```

---

## Iteration 2 — Выполнение тест-кейсов

### Запуск
```bash
start.bat
# Добавлен execution-service (3003)
```

### Пошаговое выполнение
1. Открыть тест-кейс в Web UI
2. Нажать «▶ Выполнить»
3. Откроется **ExecutionPage**:

   **Элементы панели:**
   - **Прогресс-бар** — сколько шагов пройдено
   - **Список шагов (слева)** — статус каждого шага (цветовой индикатор)
   - **Карточка текущего шага (справа)** — действие, тестовые данные, ожидаемый результат
   - **Кнопки управления:**
     - ✓ Пройден — переходит к следующему шагу
     - ✗ Провален — завершает выполнение со статусом failed
     - → Пропущен — пропускает шаг
     - ⊘ Заблокирован — блокирует выполнение

4. После последнего шага — финальный статус (passed / failed)

### API endpoints
```
POST   /api/executions                  — создать выполнение ({ testCaseKey })
POST   /api/executions/:id/start        — начать выполнение
GET    /api/executions                  — список всех выполнений
GET    /api/executions/:id              — детали выполнения
PATCH  /api/executions/:id/steps/:index — обновить статус шага ({ status, screenshot?, notes? })
POST   /api/executions/:id/steps/:index/screenshot — загрузить скриншот
```

### State machine
```
not_started ──► running ──► passed
                   │
                   ├──► failed
                   ├──► blocked
                   └──► (продолжается, пока есть шаги)
```

---

## Iteration 3 — Chrome Extension + Desktop Agent

### Запуск
```bash
start.bat
# Добавлен browser-agent (3005) — WebSocket сервер
```

### Установка Chrome Extension
1. Открыть `chrome://extensions`
2. Включить «Режим разработчика»
3. «Загрузить распакованное расширение»
4. Выбрать папку `packages/chrome-extension/dist`

### Использование
1. **Popup расширения** — клик на иконку QTest Runner в панели инструментов

   **Вкладка «Подключение»:**
   - `Подключиться к агенту` — устанавливает WebSocket соединение с browser-agent
   - Статус: зелёный/красный индикатор

   **Вкладка «Браузер»:**
   - `Запустить браузер` — Desktop Agent открывает Chrome через Playwright
   - `Закрыть браузер` — завершает сессию

   **Вкладка «Текущий шаг»:**
   - Отображает информацию о выполняемом шаге (приходит из execution-service)

2. **Content Script (на веб-страницах):**
   - Синяя полоса сверху страницы — индикатор активного выполнения
   - Автоматическая смена статуса при прохождении шагов
   - Подсветка элементов при навигации

### WebSocket протокол
```
Extension → Agent:
  { type: 'launch', profileName?: string }
  { type: 'navigate', url: string }
  { type: 'click', selector: string }
  { type: 'fill', selector: string, value: string }
  { type: 'verify', text: string }
  { type: 'screenshot' }
  { type: 'close' }

Agent → Extension:
  { type: 'connected', clientId: string }
  { type: 'launched', profileId: string }
  { type: 'step:result', status: 'passed'|'failed', screenshot?: string }
  { type: 'error', message: string }
  { type: 'closed' }
```

### Multi-profile
Desktop Agent поддерживает несколько Chrome профилей.
Профили хранятся в `./chrome-data/<profileName>/` и управляются через Profile Manager API:
```
GET /api/profiles — список профилей
```

---

## Iteration 4 — Recorder + Сложные сценарии

### Запуск
```bash
start.bat
# Добавлен recorder-service (3004)
```

### Recorder Service
Сервис записи действий пользователя в браузере. Подключается к browser-agent через WebSocket и
перехватывает события: клики, ввод текста, навигацию, скролл.

**Запись сессии:**
1. Открыть Recorder в Web UI
2. Нажать «Начать запись»
3. Выполнять действия в браузере (управляемом через Desktop Agent)
4. Нажать «Остановить запись»
5. Система конвертирует записанные действия в шаги тест-кейса

**Конвертация в шаги:**
| Действие | Результат |
|----------|-----------|
| Клик по кнопке «Создать» | Шаг: Нажать «Создать» |
| Ввод текста в поле «Имя» | Шаг: Заполнить поле «Имя» → значение |
| Навигация на новый URL | Шаг: Перейти по URL |
| Выбор из выпадающего списка | Шаг: Выбрать значение из списка «...» |
| Отправка формы | Шаг: Отправить форму |

### User Switch (горячая клавиша)
Горячая клавиша для смены пользователя во время выполнения теста:
- По умолчанию: `Ctrl+Shift+U` (Windows) / `Cmd+Shift+U` (Mac)
- При срабатывании: текущая сессия сохраняется, открывается окно логина другого пользователя
- Шаги после переключения выполняются от имени нового пользователя

### Composite Steps
Вложенные шаги — группировка нескольких шагов из Step Library в один композитный шаг.

**Пример:**
```yaml
CompositeStep: "Авторизация в Jira"
  Steps:
    - navigate: "https://jira.ifellow.ru/login"
    - fill: { selector: "#username", value: "{{username}}" }
    - click: "Войти"
    - fill: { selector: "#password", value: "{{password}}" }
    - click: "Войти"
```

Используется в execution-service как один шаг, но внутри разворачивается в последовательность.

### Multi-domain
Поддержка нескольких табов/окон браузера в рамках одного теста:
- Переключение между табами
- Выполнение шагов в разных доменах
- Передача данных между табами (через контекст выполнения)

### API endpoints
```
POST   /api/recordings/start              — начать запись
POST   /api/recordings/stop               — остановить запись
GET    /api/recordings/:id                — получить запись
POST   /api/recordings/:id/convert        — конвертировать в шаги тест-кейса
POST   /api/composite-steps               — создать композитный шаг
GET    /api/composite-steps               — список композитных шагов
PUT    /api/user-switch/config            — настройка User Switch
```

---

## Iteration 5 — Zephyr Sync + Отчёты + Coverage

### Запуск
```bash
start.bat
# Все 7 сервисов
```

### Zephyr Sync
Синхронизация тест-кейсов с Zephyr Scale через REST API.

**Страница Sync в Web UI:**
- **Синхронизация с Zephyr** — загружает тест-кейсы из Zephyr Scale API
- **Diff: Excel vs Local** — загрузить Excel-файл и сравнить с локальной БД
- **Coverage (Jira Issues)** — показывает связи тест-кейсов с Jira задачами

**Настройка подключения:**
```
ZEPHYR_BASE_URL    — https://jira.ifellow.ru
ZEPHYR_PROJECT_KEY — IBPA
ZEPHYR_API_TOKEN   — токен для доступа к API
```

### Diff Engine
Сравнение Excel-экспорта Zephyr Scale с локальной базой данных.

**Что проверяется:**
- Название (name), статус, предусловия, цель
- Папка, приоритет, компонент, метки
- Coverage (Issues)
- Количество шагов

**Результаты:**
- Зелёный: только локально (есть в БД, нет в Excel)
- Синий: только в Excel (есть в Excel, нет в БД)
- Список различий по полям: старое значение → новое значение

### Отчёты (Reports Page)
Статистика выполнений тест-кейсов.

**Карточки:**
- **Всего выполнений** — количество запусков
- **Пройдено** — успешные выполнения
- **Провалено** — неуспешные выполнения
- **Средняя длительность** — среднее время выполнения (сек)

**Таблицы:**
- **Статистика по тест-кейсам** — каждый ТС, количество запусков, успешность %
- **История по дням** — сколько пройдено/провалено/заблокировано за каждый день

### Coverage (Jira Issues)
Связь тест-кейсов с Jira задачами через поле `coverage_issues`.

**В Web UI:**
- Показать все связи: Jira Issue → список тест-кейсов
- Фильтр по конкретной задаче

### API endpoints
```
POST   /api/zephyr/sync          — синхронизация с Zephyr
GET    /api/zephyr/config        — настройки Zephyr
PUT    /api/zephyr/config        — обновить настройки
POST   /api/diff/excel           — сравнить Excel с локальной БД
GET    /api/coverage             — все связи Issues → TC
GET    /api/coverage/:issueKey   — связи по конкретной задаче
GET    /api/reports/summary      — сводная статистика
GET    /api/reports/history      — история по дням
GET    /api/reports/test-case/:key — история по ТС
```
