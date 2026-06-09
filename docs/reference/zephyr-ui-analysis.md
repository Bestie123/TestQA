> Doc-ID: ZEPHYR-UI-1 | Дата: 03.06.2026 (обновлено) | Связанные: [DB-SELECTOR-1], [API-GATEWAY-1]

# Zephyr Scale UI Analysis (v9.23.0)

## Источник
Реальный браузер (Chrome DevTools, CDP) на `https://jira.ifellow.ru/secure/Tests.jspa`
- Jira Server 8.20.13
- Zephyr Scale (Kanoah Test Manager) 9.23.0
- Аутентификация: Keycloak SSO (corp.ifellow.ru)
- Пользователь: mihail.nikulenkov@ifellow.ru

## Meta-теги страницы
```html
<meta name="ajs-remote-user" content="mihail.nikulenkov@ifellow.ru">
<meta name="ajs-remote-user-fullname" content="Никуленков Михаил Михайлович">
<meta name="ajs-base-url" content="https://jira.ifellow.ru">
<meta name="atm-current-project-id" content="18400">
<meta name="atm-current-project-key" content="IBPA2">
```

## Общая структура

### HTML layout
```
#page
├── #header (Jira header: nav, search, user menu)
├── #main (Zephyr SPA app)
│   └── #zephyrScale-v2-testLibrary
│       ├── .css-5l8x0h (nav tabs row)
│       │   ├── Тест кейсы [data-testid="zscale-testcase-library"]
│       │   ├── Тестовые прогоны [data-testid="zscale-testcycle-library"]
│       │   ├── Планы тестирования [data-testid="zscale-testplan-library"]
│       │   ├── Отчёты [data-testid="zscale-reports"]
│       │   └── Конфигурация [data-testid="zscale-configuration"]
│       ├── .css-1iftbzb (content area)
│       │   ├── .css-76fm9s (left sidebar — folder tree)
│       │   │   ├── .ktm-folder-tree-item (selected: isSelected class)
│       │   │   └── [data-testid="folder-tree-container"]
│       │   ├── .css-auw1yh (main toolbar + table)
│       │   │   ├── search input (#zephyr-scale-grid-search)
│       │   │   ├── action buttons
│       │   │   ├── filter panel (expandable)
│       │   │   └── table.aui
│       │   └── .css-nkexmw (right sidebar — details panel)
```

### Размеры (TC page, projectId=18400)
| Элемент | Ширина | Высота | X | Y |
|---------|--------|--------|---|---|
| App контейнер | 990px | 882+px | 0 | 0 |
| Левая панель (folders) | 238px | 726px | 12 | 144 |
| Таблица | 908px | 3633+px | 262 | 189 |

## Страница Test Cases (`#/v2/testCases?projectId=10904`)

### Навигационные вкладки
| data-testid | Текст (RU) | Английский |
|-------------|-----------|-----------|
| zscale-testcase-library | **Тест кейсы** | Test Cases |
| zscale-testcycle-library | Тестовые прогоны | Test Cycles |
| zscale-testplan-library | Планы тестирования | Test Plans |
| zscale-reports | Отчёты | Reports |
| zscale-configuration | Конфигурация | Configuration |

### Левая панель: Дерево папок
- **data-testid**: `folder-tree-container`, `folder-tree-top-level`
- **Классы**: `ktm-folder-tree-item`, `isSelected` (текущая), folder item IDs
- **Каждый элемент** содержит:
  - data-testid: `folder-item-{id}`
  - data-testid: `folder-name-with-count-{id}` (имя + количество)
  - data-testid: `rotating-chevron` (свёрнуто/развёрнуто)
- **Примеры**:
  - "All test cases(173)" — корень
  - "Портал отпусков(18)"
  - "Регресс(39)"
  - "DWH(52)"
  - "Кейсы по релизным задачам BI (2025 год)(42)"
  - "Кейсы по релизным задачам BI (2026 год)(20)"
- **Кнопки**: "Новая папка" + dropdown (data-testid: `ktm-create-new-folder`, `ktm-folder-tree-dropdown-button`)

### Правая панель: Таблица TC

**Колонки:**
| # | Заголовок | data-testid | Тип | Ширина |
|---|-----------|-------------|-----|--------|
| 0 | checkbox | — | выбор строк | ~30px |
| 1 | П | `priority` | приоритет (цветной кружок) | ~30px |
| 2 | Ключ | `key` | ссылка на TC | auto |
| 3 | B | `major-version` | версия | auto |
| 4 | Наименование | `name` | название TC (класс `large`) | auto |
| 5 | Статус | `status-lozenge` | цветной badge | auto |
| 6 | R | `last-execution-status` | результат выполнения | auto |
| 7 | — | — | кнопка действий | ~30px |

**Пагинация:**
- 100 строк на страницу
- data-testid: `pagination`, `pagination-details`
- Текст: "1 - 100 of 17312"
- Кнопки: номера страниц, предыдущая/следующая

**Поиск:**
- input ID: `zephyr-scale-grid-search`
- placeholder: "Поиск..."
- data-testid: `ktm-search-trigger`

**Кнопки действий:**
| Текст | Действие |
|-------|----------|
| Новый тест кейс | создать TC |
| Архивировать | archive selected |
| Клонировать | clone selected |
| Еще | dropdown (more actions) |
| Фильтры | toggle filter panel |

### Фильтры (expandable panel)
- Кнопка: `expand-filters-button`, текст "Фильтры"
- При раскрытии показывает react-select компоненты
- Фильтры включают: статус, приоритет, owner, component, labels

### Элементы UI

#### Status Lozenge
```html
<div data-testid="status-lozenge" class="css-zjik7">
  <span class="css-1k1zfb1" style="background-color: rgb(58, 187, 75); max-width: 100%;">
    <span class="css-1mbo33i" style="color: white; max-width: calc(100% - 16px);">Утверждено</span>
  </span>
</div>
```

**Цвета статусов:**
| Статус (RU) | Статус (EN) | Цвет | CSS |
|------------|------------|------|-----|
| Утверждено | Approved | Зелёный | `rgb(58, 187, 75)` |
| Черновик | Draft | Оранжевый | `rgb(240, 173, 78)` |
| Устарел | Deprecated | Красный | (предположительно) |

#### Priority Icon
```html
<span data-testid="priority" role="img" aria-label="Нормальный" 
      class="css-1wits42" style="--icon-primary-color: #ffa900; --icon-secondary-color: #ffa900;">
```
- 16x16px, цветной (через CSS variable)
- **Цвета приоритетов:** Highest=красный, High=оранж, Medium=#ffa900, Low=зелёный, Lowest=серый

## Страница Test Cycles (`#/v2/testCycles?projectId=10904`)

### Таблица циклов
| Заголовок | Описание | data-testid |
|-----------|----------|-------------|
| checkbox | выбор | — |
| Key | ключ цикла | — |
| Наименование | название | — |
| Ход выполнения | прогресс (проценты) | — |
| Статус | текст статуса | — |
| — | actions | — |

### Примеры данных:
- "Все тестовые прогоны(1581)" — 1581 цикл в папке
- "Регресс(229)", "ELMA 365(63)", "Орион(89)"
- Текущий: "IBPA-C1636 — Регресс проекта 'Прогнозы и счета (FIN)'... — 66% — В РАБОТЕ"

### Кнопки циклов
| Текст | Действие |
|-------|----------|
| New Test Cycle | создать цикл |
| Редактировать | edit cycle |
| Прогон | run |
| Клонировать | clone |
| Удалить | delete |
| Группировать | toggle grouping |
| Фильтры | toggle filters |

## Рекомендации по рефакторингу Web UI

### 1. Layout
- Фиксированная левая панель (240px)
- Основной контент (flex: 1)
- Навигационные табы сверху (5 вкладок)
- Панель фильтров — expandable, появляется под toolbar

### 2. Статусы (Status Lozenge)
- Использовать цветные span с border-radius (pill/lozenge)
- Белый текст на цветном фоне
- `data-testid="status-lozenge"`
- Цвета захардкодить (Zephyr не использует CSS классы, только inline styles)

### 3. Приоритеты
- 16px цветные кружки
- через CSS переменную `--icon-primary-color`
- aria-label с названием приоритета

### 4. Таблица
- Как Zephyr: `table.aui` (Atlassian UI стиль)
- Чекбоксы слева
- Приоритет как вторая колонка (иконка "П")
- Ключ TC как ссылка
- Версия (B) — числовое значение
- Имя — класс `large` для первой колонки названия
- Статус — lozenge
- R — последний результат выполнения
- Действия — иконка/кнопка

### 5. Пагинация
- data-testid: `pagination`, `pagination-details`
- "1 - 100 of 17312"
- 100 строк на страницу

### 6. Дерево папок
- data-testid: `folder-tree-container`
- Каждый элемент: `folder-item-{id}`, `folder-name-with-count-{id}`
- Счётчик TC в скобках
- Chevron для свёрнутых/развёрнутых

## Технические детали

### API эндпоинты (из наблюдения)
- `GET /rest/tests/latest/testcase/search?projectId={id}&maxResults={n}&startAt={n}` — поиск TC
- `GET /rest/tests/latest/testrun/search?projectId={id}` — поиск циклов
- `GET /rest/tests/latest/testcase/{key}` — один TC
- `GET /rest/tests/latest/folder?projectId={id}` — структура папок
- WebSockets для live-обновлений

### React-компоненты (из classNames)
- styled-components (classNames: `css-*`)
- react-beautiful-dnd (drag & drop)
- react-select (фильтры)
- emotion (CSS-in-JS)
- data-testid для тестирования

## TC Detail Page (03.06.2026)

### URL
`https://jira.ifellow.ru/secure/Tests.jspa#/testCase/{key}?projectId={id}`

### Key HTML Structure
```html
<div class="ktm-test-case-view">
  <floating-header>
    <header class="aui-page-header">
      <!-- Project avatar, breadcrumb, title, buttons -->
    </header>
    <aui-navigation horizontal>
      <ul class="aui-nav">
        <!-- 7 tabs -->
      </ul>
    </aui-navigation>
  </floating-header>

  <!-- Details tab content (ng-include) -->
  <ng-include src="'/singleViews/testCaseView/testCaseDetails/testCaseDetails.html'">

    <!-- Collapsible sections -->
    <div class="ktm-collapsable-section">
      <div class="ktm-collapsable-section-header">
        <!-- chevron icon + title -->
      </div>
      <div class="ktm-collapsable-section-content">
        <!-- section fields -->
      </div>
    </div>
  </ng-include>
</div>
```

### Header
- **Breadcrumb:** Project Name → Тест кейсы → TC Key (Version)
- **Title:** TC name (`h1.ktm-header-title`)
- **Buttons:** Назад (`.aui-button-link`) | Сохранить (`.aui-button-primary.ktm-save-button`) | Новая версия | Version dropdown (`1.0`)
- Floating header on scroll (`ktm-detached-header`)

### Tabs (order as in DOM)
1. **Подробнее** (DETAILS) — active by default
2. **Шаги** (SCRIPT)
3. **Выполнение** (TEST_RESULTS)
4. **Отслеживание** (TRACEABILITY)
5. **Вложения** (ATTACHMENTS)
6. **Комментарии** (COMMENTS)
7. **History** (CHANGE_HISTORY)

Tab implementation: `<li ng-class="{'aui-nav-selected': isActive}" on-select="currentPanel.name = 'DETAILS'">` → panel content via `<ng-include ng-show="currentPanel.name === 'DETAILS'" src="'/singleViews/testCaseView/testCaseDetails/testCaseDetails.html'">`

### Details Tab (collapsible sections)
Each section: `<div class="ktm-collapsable-section" init-expanded="true" name="...">`

#### 1. Наименование (Name)
- Field: `<input type="text" class="ktm-transparent-field" ng-model="testCase.name">`
- Required (`<span class="aui-icon icon-required">`)
- Max 255 chars

#### 2. Задача тест кейса (Objective)
- Rich text editor `<rich-text id="rte-objective" ng-model="testCase.objective">`
- Feature flag `v2.testCaseView.froalaEnabled` is OFF → renders as read-only HTML via `<span read-only-rich-text>`
- Editor activates on focus (Froala-based editor via `ng-focus="setActive(true)"`)

#### 3. Предварительные действия (Precondition)
- Rich text editor `<rich-text id="rte-precondition" ng-model="testCase.precondition">`
- Same froala/read-only pattern as objective

#### 4. Подробнее (Details) — field groups
| Поле | DOM | Тип |
|------|-----|-----|
| Статус | `<select-box ng-model="testCase.status" items="testCaseStatuses">` | Dropdown w/ i18n |
| Приоритет | `<select-box ng-model="testCase.priority" items="testCasePriorities">` | Dropdown w/ color icon |
| Компонент | `<select-box ng-model="testCase.component" items="projectComponents">` | Dropdown |
| Владелец | `<user-picker ng-model="testCase.owner">` | User picker |
| Расчётное время | `<input name="estimatedTime" time-formatter>` | Text (hh:mm) |
| Папка | `<select-box ng-model="testCase.folder" items="testCaseFolderOptions">` | Folder tree dropdown |
| Теги | `<tags-input ng-model="testCase.labels">` | Tag input w/ autocomplete |

### Steps Tab (Шаги / SCRIPT)

Contains TC fields + step table:

#### Upper section — TC metadata (same as Details tab reading):
- Left: Наименование (input), Задача тест кейса (rich text `#rte-objective`), Предварительные действия (rich text `#rte-precondition`)
- Right sidebar: Статус, Приоритет, Компонент, Владелец, Расчётное время, Папка, Теги

#### Step table (`.ktm-testscript-steps`)
Each step (`div.ktm-testscript-step`) has:

| Компонент | DOM | Описание |
|-----------|-----|----------|
| Drag handle | `.ktm-testscript-step-handle` | Reorder grip |
| Step index | `.ktm-testscript-step-index .ktm-index-number` | 1-based index |
| Action buttons | `.ktm-testscript-step-action-buttons` | Удалить, Вложить файлы, Клонировать, Добавить общий шаг, Добавить шаг |

**Three columns per step:**

| Колонка | ID шаблона | Тип |
|---------|-----------|-----|
| Шаг (Step) | `#rte-step-description-{n}` | Rich text (Froala) |
| Тестовые данные (Test Data) | `#rte-step-test-data-{n}` | Rich text (Froala) |
| Ожидаемый результат (Expected Result) | `#rte-step-expected-result-{n}` | Rich text (Froala) |

Each column: `<span class="ktm-testscript-step-label">` header + `<rich-text>` editor.
Below steps: custom fields list (`.ktm-testscript-step-custom-fields`) + attachments (`.ktm-step-attachments`).

### Execution Tab (Выполнение / TEST_RESULTS)

Table of historical executions for this TC:

| Колонка | Пример |
|---------|--------|
| Ключ | `IBPA-E23233` |
| Статус | ПРОЙДЕН / НЕ ЗАПУСКАЛСЯ |
| Дата | `27/09/2024 14:26` |
| Расчётное | `-` |
| Фактическое | `00:08:31` |
| Присвоен в | Шустова Елена Федоровна |
| Выполняется по | Юшин Павел Сергеевич |
| Релизная версия | `-` |
| Итерация | *(empty)* |
| Окружение | `-` |
| Тестовый прогон | `IBPA-C1259` (ссылка на Test Run key) |
| Задачи | `0` |
| Т | *(checkbox-like indicator)* |

Each row links to a specific test run (`IBPA-Cxxx`). Statuses match cycle-level execution statuses (PASS/FAIL/SKIPPED/BLOCKED — translated to Russian).

### History Tab

```
1.0 - Создан <user> <date> | Последнее обновление <user> <date>
```

- Version timeline with author, date, and change details
- "Сравнение версий" toggle to diff two versions
- "Выбрать все версии" checkbox for bulk version comparison

### Key Selectors for Automation
- `.ktm-test-case-view` — root TC detail container
- `.ktm-floating-header` — floating header with breadcrumb + tabs
- `.ktm-collapsable-section` — collapsible field groups
- `.ktm-transparent-field` — borderless input fields
- `.ktm-select-box-field` — custom select dropdowns
- `.ktm-richtext` — rich text editor containers
- `.ktm-editor-html-viewer` — read-only rich text display
- `#rte-objective` — objective rich text editor
- `#rte-precondition` — precondition rich text editor
- `select-box[ng-model="testCase.status"]` — status selector
- `select-box[ng-model="testCase.priority"]` — priority selector
- `tags-input[ng-model="testCase.labels"]` — labels input

### Browser User Agent
На момент анализа: `Mozilla/5.0 ... Chrome/...` (Chrome DevTools protocol)
