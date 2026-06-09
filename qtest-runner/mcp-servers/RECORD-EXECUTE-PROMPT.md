# Промпт: Запись + Выполнение тест-кейса

> Doc-ID: RECORD-EXECUTE-4 | Дата: 2026-06-08 | Связанные: [RECORD-EXECUTE-1], [ZEPHYR-API-1]

---

## Цель
Выполнить тест-кейс из Zephyr Scale на тестовом стенде, записать действия, создать JSON-схему интерфейса и сравнить результаты.

## Инфраструктура

### Тестовые стенды
| Стенд | URL | Токен | Назначение |
|-------|-----|-------|------------|
| **prod** | `https://jira.ifellow.ru` | `PROD-TOKEN-REMOVED` | **Чтение** тест-кейсов, API-запросы |
| **dev** | `https://devjira.ifellow.ru` | `DEV-TOKEN-REMOVED` | **Выполнение** тестов, браузер |

### Разделение стендов
```
┌─────────────────────────────────────────────────────────────┐
│  PROD (jira.ifellow.ru)          DEV (devjira.ifellow.ru)  │
│  ─────────────────────           ────────────────────────   │
│  • Чтение тест-кейсов           • Выполнение тестов        │
│  • Поиск по ключу                • Браузер + DevTools       │
│  • Получение шагов               • Ввод данных              │
│  • API-запросы (read-only)       • Клик, навигация          │
│  • НЕЛЬЗЯ менять данные          • Запись действий          │
└─────────────────────────────────────────────────────────────┘
```

### Сервисы (port 3000-3005 + 8080)
| Сервис | Порт | Health-check | API |
|--------|------|--------------|-----|
| api-gateway | 3000 | `GET /health` | BFF, маршрутизация |
| testcase-service | 3001 | `GET /health` | CRUD, Zephyr sync |
| step-library | 3002 | `GET /health` | Переиспользуемые шаги |
| execution-service | 3003 | `GET /health` | `POST /api/executions`, `GET /api/executions/{id}/results` |
| recorder-service | 3004 | `GET /health` | `POST /api/recordings/start`, `/stop`, `/convert` |
| browser-agent | 3005 | `GET /health` | `POST /api/launch`, `POST /api/execute-step` |
| web-ui | 8080 | — | React SPA |

### Chrome DevTools
```powershell
# Запуск Chrome с CDP
Start-Process "chrome.exe" "--remote-debugging-port=9222", "--user-data-dir=$env:USERPROFILE\.chrome-devtools"
# Проверка
Invoke-WebRequest "http://localhost:9222/json" -UseBasicParsing
```

### Документация проекта
При непонятных моментах — **сначала читай документацию**:
| Файл | Что найдёшь |
|------|-------------|
| `docs/reference/zephyr-scale-api.md` | ATM API endpoints, форматы, особенности |
| `docs/reference/zephyr-ui-analysis.md` | DOM-структура Zephyr Scale |
| `DOC_NAV.md` | Навигатор по всей документации |
| `README.md` | Архитектура, порты, команды |
| `ACTIVE_GOAL.md` | Текущий статус проекта |
| `results/ui-schema-devjira.json` | **JSON-схема интерфейса devjira** (создаётся по мере исследования) |

---

## Инструкция

Пользователь даёт ссылку на тест-кейс (URL или ключ `IBPA-T1234`).
Выполни **8 шагов** последовательно:

---

### Шаг 0: Подготовка и валидация

```powershell
# 0.1 Проверь все сервисы
@("http://localhost:3000/health","http://localhost:3003/health",
  "http://localhost:3004/health","http://localhost:3005/health") | % {
    try { (Invoke-WebRequest $_ -TimeoutSec 3).Content } catch { "FAIL: $_" }
}

# 0.2 Проверь Chrome CDP
(Invoke-WebRequest "http://localhost:9222/json" -UseBasicParsing).Content | ConvertFrom-Json | Select id,title,url

# 0.3 Определи стенд из URL тест-кейса
# devjira.ifellow.ru → dev token (выполнение)
# jira.ifellow.ru → prod token (только чтение)
```

Если сервисы не отвечают — запусти `start.bat` в `qtest-runner/`.

---

### Шаг 1: Получение тест-кейса (с PROD)

**Важно:** Тест-кейсы читаем с **PROD** (jira.ifellow.ru), выполняем на **DEV** (devjira.ifellow.ru).

```powershell
# 1.1 Извлеки ключ из URL
# Формат: https://{host}/secure/Tests.jspa#/testCase/{numericId}?projectId={projectId}
# numericId ≠ key! Нужно найти key через search

# 1.2 Получи тест-кейс с PROD через ATM API
$headers = @{ "Authorization" = "Bearer PROD-TOKEN-REMOVED"; "Content-Type" = "application/json" }
$query = 'key = "IBPA-T2100"'
$url = "https://jira.ifellow.ru/rest/atm/1.0/testcase/search?query=$([System.Uri]::EscapeDataString($query))&maxResults=1&fields=key,name,status,lastTestResultStatus,priority,folder,precondition,objective,testScript"
$tc = Invoke-RestMethod -Uri $url -Headers $headers

# 1.3 Сохрани в файл
$tc | ConvertTo-Json -Depth 10 | Out-File "testcase-IBPA-T2100.json"
```

**Важно:**
- ATM API: `/rest/atm/1.0/testcase/search` (не `/rest/tests/latest/`)
- URL содержит numericId, API работает со string key (`IBPA-T2100`)
- Кодировка Cyrillic: используй `-OutFile` + `[System.IO.File]::ReadAllText(..., UTF8)`
- Если API не отвечает — смотри `docs/reference/zephyr-scale-api.md`
- **numericId ≠ key!** В URL `#/testCase/2089` — numericId=2089, а ключ может быть `IBPA-T2100`
- **Всегда сохраняй** JSON-схему в `results/ui-schema-devjira.json` по мере исследования

---

### Шаг 2: Запуск записи

**Инструменты для работы с браузером:**
- `browser_browser_*` — основной (через browser-agent, port 3005)
- `browser_browser_navigate` — стабильная навигация
- `browser_browser_click` — клик по элементу
- `browser_browser_type` — ввод текста
- `browser_browser_press` — нажатие клавиши (Enter, ArrowDown, Escape)
- `browser_browser_evaluate` — выполнение JavaScript
- `browser_browser_screenshot` — скриншот
- `browser_browser_inspect` — inspect DOM элементов
- `browser_browser_wait` — ожидание (ms или selector)

**НЕ ИСПОЛЬЗОВАТЬ:**
- `chrome-devtools_*` — только для отладки, нестабильный
- `browser-devtools_*` — требует WebSocket, часто падает

```powershell
# 2.1 Запусти браузер через browser-agent
$body = @{ profileName = "Auto"; userDataDir = "./chrome-data/Auto"; recordVideo = $true } | ConvertTo-Json
$launch = Invoke-RestMethod -Uri "http://localhost:3005/api/launch" -Method Post -ContentType "application/json" -Body $body
$profileId = $launch.profileId

# 2.2 Начни запись через recorder-service
$rec = Invoke-RestMethod -Uri "http://localhost:3004/api/recordings/start" -Method Post -ContentType "application/json" -Body '{"profileId":"auto"}'
$sessionId = $rec.id

# 2.3 Свяжи запись с браузером
$body = @{ profileId = $profileId; sessionId = $sessionId; recorderUrl = "http://localhost:3004" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3005/api/record/start" -Method Post -ContentType "application/json" -Body $body
```

Сохрани: `$profileId`, `$sessionId`.

---

### Шаг 3: Навигация к тест-кейсу (на DEV)

**Важно:** Открываем страницу на **DEV-стенде** для выполнения!

#### 3.0 Если нужен другой пользователь (impersonation):
```
1. Убедись что ты под админом (Никуленков Михаил Михайлович)
2. Перейти на ScriptRunner SwitchUser:
   /plugins/servlet/scriptrunner/admin/builtin/add/com.onresolve.scriptrunner.canned.jira.admin.SwitchUser
3. Кликнуть на .sr-rs__placeholder → ввести фамилию → ArrowDown + Enter → Run
4. Дождаться "Switched to {Name} ({username})"
5. Проверить impersonation через выпадающее меню (#header-details-user-fullname)
```

#### 3.1 Вернуться к админу:
```
1. Кликнуть на #header-details-user-fullname (иконка профиля)
2. Найти #switch-user-back-link-id ("Switch Back to Admin")
3. Кликнуть
```

```powershell
# 3.1 Открой страницу тест-кейса на DEV
$tcUrl = "https://devjira.ifellow.ru/secure/Tests.jspa#/testCase/2089?projectId=10904"
$body = @{ action = "navigate"; url = $tcUrl } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3005/api/execute-step" -Method Post -ContentType "application/json" -Body $body

# 3.2 Жди загрузки
Start-Sleep -Seconds 5

# 3.3 Скриншот
$body = @{ action = "screenshot" } | ConvertTo-Json
$screenshot = Invoke-RestMethod -Uri "http://localhost:3005/api/execute-step" -Method Post -ContentType "application/json" -Body $body
```

---

### Шаг 4: Выполнение шагов + JSON-лог

Для **КАЖДОГО** шага из `testScript.steps`:

1. **Выполни** через `POST /api/execute-step`
2. **Запиши** в actions_log
3. **Сделай скриншот** после ключевых действий
4. **Создай JSON-схему** найденных элементов

#### Формат JSON-лога:

```json
{
  "testCaseKey": "IBPA-T2100",
  "testCaseSource": "jira.ifellow.ru (PROD)",
  "testExecution": "devjira.ifellow.ru (DEV)",
  "profileId": "0ab02d36-...",
  "sessionId": "81e20ba2-...",
  "startedAt": "2026-06-08T05:17:52Z",
  "actions_log": [
    {
      "step": 1,
      "action": "navigate",
      "url": "https://devjira.ifellow.ru/secure/Tests.jspa#/testCase/2089?projectId=10904",
      "description": "Открыть тест-кейс IBPA-T2100 на DEV",
      "timestamp": "2026-06-08T05:18:00Z"
    },
    {
      "step": 2,
      "action": "wait",
      "ms": 5000,
      "description": "Ждать загрузки страницы"
    },
    {
      "step": 3,
      "action": "click",
      "selector": "[data-testid='tab-steps']",
      "description": "Перейти на вкладку Steps",
      "screenshot": "step3.png"
    }
  ]
}
```

| Поле | Обязательно | Описание |
|------|:-----------:|----------|
| `step` | ✅ | Порядковый номер |
| `action` | ✅ | `navigate`, `click`, `fill`, `select`, `wait`, `press`, `screenshot`, `evaluate` |
| `selector` | ✅* | CSS-селектор (*не нужен для navigate/wait/screenshot*) |
| `value` | 🔶 | Значение для fill/select |
| `url` | 🔶 | URL для navigate |
| `ms` | 🔶 | Задержка для wait |
| `key` | 🔶 | Клавиша для press (Enter, Tab) |
| `description` | ✅ | Описание на русском |
| `timestamp` | ✅ | ISO8601 |
| `screenshot` | 🔶 | Имя файла скриншота |
| `error` | 🔶 | Ошибка, если элемент не найден |

#### Правила записи:
1. После `click` — пауза 500-1000ms
2. После `navigate` — пауза 3-5с
3. **Никогда не угадывай селекторы** — проверяй через `evaluate` или `inspect_dom`
4. Если элемент не найден — запиши `error` и попробуй альтернативу
5. Скриншот после каждого ключевого шага
6. **При непонятных моментах** — читай документацию проекта (см. таблицу в начале)

#### Параллельно: JSON-схема интерфейса

По мере исследования страницы **создавай и обновляй** JSON-схему в файле `results/ui-schema-devjira.json`.

**Обязательно документируй:**
1. Все страницы с их URL-паттернами
2. Все интерактивные элементы (кнопки, поля, ссылки)
3. Workflow для каждой операции (переключение пользователей, создание задач и т.д.)
4. Известные ограничения (React Select, права доступа)
5. Связи между страницами

**Формат файла:**
```json
{
  "ui_schema": {
    "pages": {
      "page_name": {
        "url_pattern": "/path/to/page",
        "stand": "devjira.ifellow.ru",
        "description": "Описание страницы",
        "elements": [...],
        "workflow_xxx": [...]
      }
    }
  }
}
```

```json
{
  "ui_schema": {
    "page": "Zephyr Scale - Test Case Detail",
    "url_pattern": "#/testCase/{numericId}?projectId={projectId}",
    "stand": "devjira.ifellow.ru",
    "elements": [
      {
        "selector": "[data-testid='testcase-key']",
        "type": "text",
        "description": "Ключ тест-кейса (IBPA-T2100)"
      },
      {
        "selector": "[data-testid='testcase-name']",
        "type": "text",
        "description": "Название тест-кейса"
      },
      {
        "selector": "[data-testid='status-lozenge']",
        "type": "badge",
        "description": "Статус (Approved/Draft/Deprecated)",
        "values": ["Approved", "Draft", "Deprecated"]
      },
      {
        "selector": "[data-testid='tab-steps']",
        "type": "tab",
        "description": "Вкладка Steps"
      },
      {
        "selector": "button[data-testid='execute-btn']",
        "type": "button",
        "description": "Кнопка Выполнить"
      }
    ]
  }
}
```

---

### Шаг 5: Остановка записи

```powershell
# 5.1 Останови запись
Invoke-RestMethod -Uri "http://localhost:3004/api/recordings/$sessionId/stop" -Method Post

# 5.2 Проверь результат
$recording = Invoke-RestMethod -Uri "http://localhost:3004/api/recordings/$sessionId"
Write-Host "Actions recorded: $($recording.actions.Count)"
if ($recording.actions.Count -eq 0) { throw "No actions recorded!" }
```

---

### Шаг 6: Конвертация

```powershell
$converted = Invoke-RestMethod -Uri "http://localhost:3004/api/recordings/$sessionId/convert"
$converted | ConvertTo-Json -Depth 5 | Out-File "converted-steps.json"
Write-Host "Steps generated: $($converted.steps.Count)"
```

---

### Шаг 7: Автовыполнение + сверка

```powershell
# 7.1 Запусти автовыполнение
$execBody = @{
    testCaseId = "converted-$sessionId"
    steps = $converted.steps
} | ConvertTo-Json -Depth 5
$exec = Invoke-RestMethod -Uri "http://localhost:3003/api/executions" -Method Post -ContentType "application/json" -Body $execBody
$executionId = $exec.executionId

# 7.2 Получи результаты
$results = Invoke-RestMethod -Uri "http://localhost:3003/api/executions/$executionId/results"

# 7.3 Сравни и создай отчёт
```

---

### Шаг 8: Сохрани результаты

```powershell
# 8.1 JSON-лог действий
$actionsLog | ConvertTo-Json -Depth 10 | Out-File "results/actions-log-IBPA-T2100.json"

# 8.2 JSON-схема интерфейса
$uiSchema | ConvertTo-Json -Depth 10 | Out-File "results/ui-schema-IBPA-T2100.json"

# 8.3 Отчёт сравнения
$report | Out-File "results/report-IBPA-T2100.md"
```

#### Формат отчёта:

```markdown
## Отчёт: Запись vs Автовыполнение

**Тест-кейс:** IBPA-T2100
**Источник:** jira.ifellow.ru (PROD)
**Выполнение:** devjira.ifellow.ru (DEV)
**Дата:** 2026-06-08

### Результаты

| # | Действие | Ожидание | Факт | Статус |
|---|----------|----------|------|:------:|
| 1 | navigate → .../testCase/2089 | Страница загружена | ✅ loaded | OK |
| 2 | click → [data-testid='tab-steps'] | Вкладка активна | ✅ active | OK |
| 3 | fill → #input = "value" | Значение введено | ✅ filled | OK |
| 4 | click → #submit-btn | Форма отправлена | ❌ not found | FAIL |

### Статистика
- Всего: 4
- Успешно: 3
- Ошибки: 1
- Успех: **75%**

### Проблемы
| Шаг | Проблема | Решение |
|-----|----------|---------|
| 4 | Селектор `#submit-btn` не найден | Изменился CSS class, нужен `[data-testid='submit']` |
```

---

## Формат финального ответа

```
## Результат выполнения

### 0. Подготовка
- Стенд выполнения: devjira.ifellow.ru
- Источник тест-кейсов: jira.ifellow.ru (PROD)
- Сервисы: ✅ все отвечают
- Chrome CDP: ✅ подключён

### 1. Тест-кейс (с PROD)
- Ключ: IBPA-T2100
- Название: ...
- Статус: Approved
- Шагов: 10

### 2. Запись
- Session ID: 81e20ba2-...
- Profile ID: 0ab02d36-...
- Действий записано: N

### 3. JSON-лог действий
[полный JSON]

### 4. JSON-схема интерфейса
[ui_schema]

### 5. Конвертация
- Шагов сгенерировано: N

### 6. Автовыполнение
- Execution ID: exec-XXXX
- Результат: N/M passed

### 7. Сравнение
[таблица]

### 8. Проблемы
[список]

### 9. Следующий шаг
[рекомендация]
```

---

## Чек-лист перед началом

```powershell
# Быстрая проверка всех зависимостей
@(
  @{ Name="API Gateway"; Url="http://localhost:3000/health" },
  @{ Name="Execution";   Url="http://localhost:3003/health" },
  @{ Name="Recorder";    Url="http://localhost:3004/health" },
  @{ Name="Browser Agent";Url="http://localhost:3005/health" },
  @{ Name="Chrome CDP";  Url="http://localhost:9222/json" }
) | % {
  try {
    $r = Invoke-WebRequest $_.Url -TimeoutSec 3
    "✅ $($_.Name)"
  } catch {
    "❌ $($_.Name) — $($_.Exception.Message)"
  }
}
```

---

## Критические правила

1. **Тест-кейсы читаем с PROD** (jira.ifellow.ru) — это источник истины
2. **Тесты выполняем на DEV** (devjira.ifellow.ru) — тестовый стенд
3. **ATM API = `/rest/atm/1.0/`** (не `/rest/tests/latest/`)
4. **URL numericId ≠ API key** — всегда ищи key через search
5. **Кодировка** — Cyrillic ломается в PowerShell; используй `-OutFile` + UTF8
6. **Никогда не угадывай селекторы** — проверяй через DOM-исследование
7. **Скриншоты** — после каждого ключевого шага
8. **JSON-схема** — создавай по мере исследования UI, сохраняй в `results/ui-schema-devjira.json`
9. **При непонятном** — сначала читай документацию (`DOC_NAV.md`)
10. **Все токены временные** — после сессии отозвать
11. **Impersonation** — всегда проверяй выпадающее меню пользователя (#header-details-user-fullname) для переключения
12. **Используй `browser_browser_*`** — НЕ `chrome-devtools_*` (нестабильный)

---

## Известные проблемы и решения (сессия 2026-06-08)

### Проблема 1: numericId в URL ≠ API key

**Симптом:** URL `#/testCase/2089` — numericId 2089. Ключ тест-кейса `IBPA-T2100`, а НЕ `IBPA-T2089`.

**Причина:** NumericId в URL Zephyr Scale — это внутренний ID, не ключ. Разные сущности.

**Решение:**
```
1. Всегда извлекай numericId из URL
2. Ищи ключ через ATM API search по numericId или projectId
3. НИКОГДА не предполагай что numericId = ключ
4. Пример: numericId=2089 → key=IBPA-T2100 (НЕ IBPA-T2089!)
```

### Проблема 2: Impersonation — переключение пользователей

**Симптом:** ScriptRunner и Cprime SwitchUser требуют права админа. Если текущий пользователь не админ — страница показывает логин.

**Два инструмента переключения:**

| Инструмент | URL | Кнопка | Требует админа |
|------------|-----|--------|:--------------:|
| ScriptRunner | `/plugins/servlet/scriptrunner/admin/builtin/add/com.onresolve.scriptrunner.canned.jira.admin.SwitchUser` | Run | ✅ |
| Cprime | `/plugins/servlet/cprime/admin/configuration?route=%2Ftools%2Fswuser` | Switch | ✅ |

**Как переключаться (правильный порядок):**
```
1. Будучи админом (Никуленков Михаил Михайлович) → перейти на SwitchUser страницу
2. Ввести фамилию → выбрать пользователя → нажать Run/Switch
3. Дождаться сообщения "Switched to {Name} ({username})"
4. ПРОВЕРИТЬ что impersonation активен (баннер в шапке)
```

**Как вернуться к админу:**
```
1. Кликнуть на #header-details-user-fullname (иконка профиля в шапке)
2. В выпадающем меню найти #switch-user-back-link-id ("Switch Back to Admin")
3. Кликнуть — вернётся к дефолтному пользователю
```

**ВАЖНО:** Impersonation баннер ("You are temporarily impersonating...") может НЕ отображаться в `innerText`. Всегда проверяй выпадающее меню пользователя!

### Проблема 3: React Select компоненты

**Симптом:** Стандартный `click` + `type` не работает для полей с автодополнением.

**Решение:**
```javascript
// 1. Сначала кликнуть на placeholder
document.querySelector('.sr-rs__placeholder').click();

// 2. Ввести текст через browser_browser_type
await browser_browser_type('#react-select-2-input', 'Зубарев');

// 3. Выбрать из списка через клавиатуру
await browser_browser_press('ArrowDown');
await browser_browser_press('Enter');

// 4. Нажать кнопку действия (Run/Switch)
document.querySelector('button.Run или .Switch').click();
```

### Проблема 4: Страница не загружается полностью

**Симптом:** Title показывает `- iFellow Jira`, `#summary-val` не найден, `pageTextLength < 500`.

**Причина:** Задача недоступна текущему пользователю или не существует.

**Решение:**
```
1. Проверь текст страницы: "Просмотр этой задачи невозможен"
2. Если да — у пользователя нет прав на эту задачу
3. Попробуй другую задачу из того же проекта
4. Или вернись к админу и найди доступные задачи через JQL
```

### Проблема 5: Сессия теряется frequently

**Симптом:** После нескольких навигаций страница показывает форму логина.

**Решение:**
```
1. После потери сессии — перейти на Dashboard.jspa
2. Если видишь "Добро пожаловать в iFellow Jira" — нужна авторизация
3. Пользователь должен авторизоваться вручную
4. После авторизации — заново переключить пользователя если нужно
```

### Проблема 6: Два браузера

**Симптом:** browser_browser_* и chrome-devtools_* используют разные подключения.

**Два типа инструментов:**

| Тип | Использует | Когда использовать |
|-----|-----------|-------------------|
| `browser_browser_*` | browser-agent (port 3005) | Основной — для всех действий |
| `chrome-devtools_*` | Chrome CDP (port 9222) | Только для отладки |
| `browser-devtools_*` | browser-agent WebSocket | Для inspect/evaluate |

**Важно:** `browser_browser_navigate` работает стабильнее чем `chrome-devtools_cdp_navigate`.

### Проблема 7: Impersonated пользователь не видит задачи

**Симптом:** Зубарев (nikulenkovm) назначен на FIN-10231, но не может её открыть.

**Причина:** На devjira не настроены права доступа для impersonated пользователей.

**Решение:**
```
1. Проверь права через JQL search от имени админа
2. Найди задачи где impersonated пользователь — assignee
3. Попробуй открыть эти задачи
4. Если не помогло — задача недоступна, ищи другую
```

---

## JSON-схема выпадающего меню пользователя (обязательно к созданию)

```json
{
  "user_dropdown_menu": {
    "trigger": "#header-details-user-fullname",
    "items": [
      {"selector": "#view_profile", "text": "Профиль"},
      {"selector": "#a11y-personal-settings-link", "text": "Специальные возможности"},
      {"selector": "#upm-requests-link", "text": "Магазин Atlassian"},
      {"selector": "#jnd-config-web-item-link", "text": "Digest Email"},
      {"selector": "#set_my_jira_home_default", "text": "Рабочий стол", "type": "radio"},
      {"selector": "#switch-user-back-link-id", "text": "Switch Back to Admin", "important": true},
      {"selector": "#log_out", "text": "Выйти"}
    ]
  }
}
```

---

## Порядок чтения URL для тест-кейсов

```
1. Извлечь numericId из URL: #/testCase/{numericId}?projectId={projectId}
2. Найти ключ через ATM API: query = 'id = {numericId}' или по projectId
3. Получить тест-кейс по ключу: query = 'key = "{key}"'
4. Сохранить в файл: testcase-{key}.json
```

