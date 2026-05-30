---
title: Expanded Plan
---

# Expanded Plan — TestQA

> **Source:** `archive/EXPANDED_PLAN.md`

Дата составления: 30.05.2026
Статус: утверждён

---

## Iteration 0: Реструктуризация AGENTS.md

### Цель
Отделить правила оформления тест-кейсов/баг-репортов (не относятся к qtest-runner) от технической документации проекта.

### Шаг 0.1: Создать папку `Test-cases&Bug-reports/`

Создать директорию в корне проекта со структурой:
```
Test-cases&Bug-reports/
  RULES.md           — все правила оформления и генерации
  BACKLOG.md          — отложенные фичи с пояснениями
```

### Шаг 0.2: Создать `Test-cases&Bug-reports/RULES.md`

Перенести из AGENTS.md следующие секции:
1. **Строки 14-72:** Общие правила + Формат тест-кейса + Froala Editor + Запрещено
2. **Строки 74-146:** Формат баг-репорта + Обязательные поля + Примеры оценки
3. **Строки 148-206:** Структура тест-кейсов (Zephyr Scale Excel Export, 18 колонок, Multi-row, типичные папки IBPA)
4. **Строки 350-360:** Процесс генерации .docx

### Шаг 0.3: Создать `Test-cases&Bug-reports/BACKLOG.md`

Содержимое — 4 отложенные фичи с причинами:
1. **.docx генерация** — не требуется (Excel/Zephyr API вместо Word)
2. **CDP канал** — закомментирован, два канала достаточно
3. **Zephyr Sync** — заглушка, замена ручной выгрузкой Excel
4. **Linting** — низкий приоритет, TS компилятор достаточно ловит ошибки

### Шаг 0.4: Очистить AGENTS.md

Удалить строки 14-206 и 350-360. Оставить:
- Строки 1-12: заголовок + Auto-Continue + Глобальные правила
- Строки 208-346: микросервисная архитектура + Карта проекта
- Строки 362-547: Best Practices Playwright Recording
- Строки 549-683: Composite Steps

### Шаг 0.5: Обновить ACTIVE_GOAL.md

Добавить ссылку на `.opencode\plans\EXPANDED_PLAN.md`, обновить главную цель.

---

## Iteration 1: Критические фиксы (ImportPage, SyncPage, seed, CAPTCHA)

### 1A: Исправить ImportPage.tsx

**Файл:** `qtest-runner/packages/web-ui/src/pages/ImportPage.tsx`

**Текущая проблема:** handleImport() не вызывает importExcel(), сразу ставит "Готово". Результат никогда не отображается.

**Что сделать:**
1. Установить npm-пакет `xlsx` в web-ui
2. В handleImport():
   - Прочитать файл через FileReader как ArrayBuffer
   - Распарсить через XLSX.read(data, {type: 'array'})
   - Преобразовать первый лист в rows: string[][]
   - Вызвать await importExcel(api, rows) из api.ts
   - Установить result и status через setResult/setStatus
   - try/catch с setError()

**Код замены (handleImport):**
```tsx
async function handleImport() {
  const file = fileInput.current?.files?.[0];
  if (!file) { setError('Выберите Excel-файл'); return; }
  setError('');
  setResult(null);
  setStatus('Чтение файла...');
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    setStatus('Импорт...');
    const result = await importExcel(api, rows);
    setResult(result);
    setStatus('Готово');
  } catch (e: any) {
    setError(e.message || 'Ошибка импорта');
    setStatus('');
  }
}
```

### 1B: Исправить SyncPage.tsx — handleDiff()

**Файл:** `qtest-runner/packages/web-ui/src/pages/SyncPage.tsx`

**Текущая проблема:** handleDiff() не вызывает diffExcel(), сразу ставит "Готово".

**Что сделать (аналогично ImportPage):**
```tsx
async function handleDiff() {
  const file = fileInput.current?.files?.[0];
  if (!file) { setStatus('Выберите Excel-файл'); return; }
  setStatus('Чтение файла...');
  setDiffResults(null);
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    setStatus('Сравнение...');
    const results = await diffExcel(api, rows);
    setDiffResults(results);
    setStatus('Готово');
  } catch (e: any) {
    setStatus('Ошибка сравнения');
  }
}
```

### 1C: Исправить seed данные comp-create-task

**Файл:** `qtest-runner/packages/step-library-service/src/index.ts`

**Строка 271:** `{ name: 'project', label: 'Проект', ...}`
→ **Заменить на:** `{ name: 'projectUrl', label: 'URL проекта', type: 'url', required: true }`

**Строка 276:** `'{{projectUrl}}'` — остаётся без изменений (теперь параметр существует).

### 1D: CAPTCHA test-pages

```powershell
Copy-Item -LiteralPath "qtest-runner/packages/browser-agent/test-pages/captcha-test.html" -Destination "qtest-runner/packages/stub-site/public/captcha-test.html"
```

---

## Iteration 2: Chrome Extension (Shadow DOM + icons)

### 2A: Shadow DOM — fix handleClick()

**Файл:** `qtest-runner/packages/chrome-extension/src/content.ts`

**Строка 57:** `const el = e.target as Element;`
→ **Заменить на:** `const el = (e.composedPath()[0] || e.target) as Element;`

**Добавить функцию** `deepEventTarget`:
```ts
function deepEventTarget(event: Event): Element | null {
  const path = event.composedPath();
  return path && path.length > 0 ? (path[0] as Element) : null;
}
```

**Изменить все `e.target`** в обработчиках:
- `handleInput` (строка 75): `const el = deepEventTarget(e) as HTMLInputElement`
- `handleChange` (строка 104): `const el = deepEventTarget(e) as HTMLInputElement`
- `handleSubmit` (строка 147): `const el = deepEventTarget(e) as HTMLFormElement`

### 2B: Shadow DOM — fix getSelector() for shadow roots

**Файл:** `qtest-runner/packages/chrome-extension/src/content.ts`

В функции `getSelector()` после `getInteractiveParent(el)` добавить:
```ts
// Если элемент внутри shadow root — построить селектор с ::shadow
const root = target.getRootNode();
if (root instanceof ShadowRoot) {
  const host = root.host;
  const hostSel = getSelector(host);
  const localSel = target.id ? `#${target.id}` : target.tagName.toLowerCase();
  return `${hostSel} >> ${localSel}`;
}
```

### 2C: Исправить пути иконок в manifest.json

**Файл:** `qtest-runner/packages/chrome-extension/manifest.json`

**Строка 11:**
```json
"default_icon": { "16": "icon-16.png", "48": "icon-48.png", "128": "icon-128.png" }
```
→ **Заменить на:**
```json
"default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
```

---

## Iteration 3: Graceful shutdown (6 сервисов)

### Общий паттерн

Добавить в каждый сервис перед `start()` / после `listen()`:

```ts
function shutdown(signal: string) {
  console.log(`[${signal}] Shutting down...`);
  server.close(() => {
    if (db) try { db.close(); } catch {}
    if (browser) try { browser.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGBREAK', () => shutdown('SIGBREAK')); // Windows
```

### 3A: browser-agent (ws-server.ts)

**Файл:** `qtest-runner/packages/browser-agent/src/ws-server.ts`

- Закрыть WebSocket: `wss.clients.forEach(c => c.close())`
- Закрыть браузер: `browser.close()` (импортировать browser manager)
- `server` = `httpServer` (строка 416)

### 3B: recorder-service (server.ts)

**Файл:** `qtest-runner/packages/recorder-service/src/server.ts`

- `server` = `httpServer` (строка 241)
- Закрыть БД: `db.close()` (импортировать из `./db`)

### 3C: testcase-service (index.ts)

**Файл:** `qtest-runner/packages/testcase-service/src/index.ts`

- Fastify: `app.close()`
- SQLite: `db.close()`

### 3D: step-library-service (index.ts)

**Файл:** `qtest-runner/packages/step-library-service/src/index.ts`

- Fastify: `app.close()`
- SQLite: `db.close()`

### 3E: execution-service (index.ts)

**Файл:** `qtest-runner/packages/execution-service/src/index.ts`

- Fastify: `app.close()`
- SQLite: `db.close()`

### 3F: api-gateway (index.ts)

**Файл:** `qtest-runner/packages/api-gateway/src/index.ts`

- `server.close()` (сохранить server из `server.listen(...)`)
- Нет БД

---

## Iteration 4: Cross-origin iframe test server

### 4A: stub-site/src/index.ts

**Файл:** `qtest-runner/packages/stub-site/src/index.ts`

Добавить второй Express-сервер на порту 9091:
```ts
const crossOriginApp = express();
crossOriginApp.use(express.static(path.join(__dirname, '../../browser-agent/test-pages')));
crossOriginApp.listen(9091, () => {
  console.log('Cross-origin test server: http://localhost:9091');
});
```

Этот сервер раздаёт `cross-iframe-content.html`, `iframe1.html`, `iframe2.html` из `browser-agent/test-pages/`.

---

## Iteration 5: Unit-тесты

### Инструмент: vitest

Установить:
```bash
cd qtest-runner
npm install -D vitest
```

Добавить в `package.json` (корень):
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### 5A: action-parser.test.ts

**Файл:** `qtest-runner/packages/browser-agent/src/__tests__/action-parser.test.ts`

Тестировать `parseStep()`:

**Группа 1 — Прямые типы действий (action → ожидаемый action):**
- `navigate`, `click`, `fill`, `select`, `press`, `dblclick`, `rightClick`, `contextmenu` → `rightClick`
- `assertText`, `assertVisible`, `assertValue`, `assertChecked`, `waitForSelector`
- `scroll`, `drag`, `switchTab`, `screenshot`, `verify`

**Группа 2 — Русские паттерны:**
- `'нажать на кнопку Войти'` → click
- `'ввести текст "admin" в поле логин'` → fill
- `'выбрать опцию "Вариант 1"'` → select
- `'нажать Enter'` → press, value=`Enter`
- `'дважды нажать на элемент'` → dblclick
- `'двойной клик по кнопке'` → dblclick
- `'правый клик по элементу'` → rightClick
- `'нажать правой кнопкой'` → rightClick
- `'нажать на canvas по координатам (100, 200)'` → click, x=100, y=200
- `'выделить текст "important"'` → verify
- `'открыть страницу https://example.com'` → navigate
- `'нажать клавишу Tab'` → press, value=`Tab`
- `'перетащить элемент'` → drag
- `'переключиться на вкладку 2'` → switchTab, value=`2`
- `'сделать скриншот'` → screenshot

**Группа 3 — Английские паттерны:**
- `'press Enter'` → press, Enter
- `'click button'` → click
- `'type "hello"'` → fill
- `'double click'` → dblclick
- `'right click'` → rightClick
- `'navigate to https://example.com'` → navigate
- `'switch tab 2'` → switchTab
- `'take screenshot'` → screenshot

**Группа 4 — Проверка testData:**
- `parseStep('fill', 'test value')` → action=fill, value='test value'
- `parseStep('select', 'option1')` → action=select, value='option1'
- `parseStep('press', 'Enter')` → action=press, value='Enter'

### 5B: executor.test.ts

**Файл:** `qtest-runner/packages/browser-agent/src/__tests__/executor.test.ts`

Тестировать mapping command → Playwright method (с моками):
- `click` → `frame.click(selector)`
- `fill` → `frame.fill(selector, value)`
- `dblclick` → `frame.dblclick(selector)`
- `rightClick` → `frame.click(selector, { button: 'right' })`
- `navigate` → `page.goto(value)`
- `press` → `page.keyboard.press(key)`
- `screenshot` → `page.screenshot()`
- `scroll` → `page.evaluate(scrollTo)`

### 5C: convertToSteps.test.ts

**Файл:** `qtest-runner/packages/recorder-service/src/__tests__/convertToSteps.test.ts`

Тестировать 15+ actionType → русский шаг:
| actionType | selector | value | Ожидаемый текст шага |
|------------|----------|-------|---------------------|
| click | `#btn` | `` | `Нажать на элемент "#btn"` |
| fill | `#input` | `test` | `Ввести текст "test" в поле "#input"` |
| select | `#sel` | `opt1` | `Выбрать опцию "opt1" в поле "#sel"` |
| navigate | `` | `url` | `Открыть страницу "url"` |
| dblclick | `#el` | `` | `Дважды нажать на элемент "#el"` |
| rightClick | `#el` | `` | `Нажать правой кнопкой на элемент "#el"` |
| canvas_click | `#cvs` | `x:10,y:20` | `Нажать на canvas "#cvs" по координатам (10, 20)` |
| selection | `` | `text` | `Выделить текст "text" [длина=4]` |
| keypress | `` | `Enter` | `Нажать клавишу "Enter"` |
| screenshot | `` | `` | `Сделать скриншот` |
| drag | `#src` | `#dst` | `Перетащить элемент "#src" на "#dst"` |
| switchTab | `` | `2` | `Переключиться на вкладку 2` |
| wait | `` | `1000` | `Подождать 1000 мс` |
| assertText | `#el` | text | `Проверить что элемент "#el" содержит текст "text"` |
| assertVisible | `#el` | `` | `Проверить что элемент "#el" видим` |

### 5D: ws-server.test.ts

**Файл:** `qtest-runner/packages/browser-agent/src/__tests__/ws-server.test.ts`

Тестировать:
1. selector forwarding: команда без selector получает selector из body.selector
2. fallback commands: при commands.length === 0 для assertText/assertVisible/assertValue/assertChecked/waitForSelector/fileUpload
3. parseStep вызывается с `(body.action, body.testData || body.value, body.expectedResult)`

---

## Iteration 6: E2E Interactive Course (MCP)

### Идея
MCP-инструмент, который запускает браузер, начинает запись, пошагово инструктирует пользователя, проверяет что каждое действие записано корректно.

### Размещение
Дополнить `mcp-qtest-debug/src/index.ts` новым инструментом:

```ts
server.tool(
  'run_test_course',
  'Запустить интерактивный курс тестирования записи действий',
  { courseName: z.string().describe('Название: basic, shadow-dom, iframe, canvas, full') },
  async ({ courseName }) => { ... }
);
```

### Структура курса

```ts
interface CourseStep {
  id: string;
  instruction: string;
  expectedAction: { actionType: string; selector?: string; value?: string };
  timeout: number;
  hint?: string;
}
```

### Курс "basic" (5 шагов)

| Шаг | Инструкция | Ожидаемое |
|-----|-----------|-----------|
| 1 | Нажми на кнопку "Кнопка 1" | click на button |
| 2 | Введи текст "Тестовое значение" в поле ввода | fill в input |
| 3 | Выбери опцию "Вариант 1" в списке | select |
| 4 | Нажми Enter | press Enter |
| 5 | Наведи курсор на ссылку "О проекте" | hover на ссылку |

### Курс "shadow-dom" (3 шага)
- click внутри shadow root
- fill внутри shadow root
- dblclick внутри shadow root

### Курс "canvas" (2 шага)
- click на canvas (50,50)
- click на canvas (150,150)

### Проверка
1. После инструкции — polling записи каждые 500ms до timeout
2. Сравнение последнего action с expectedAction
3. ✅ если совпало, ❌ если нет (показать hint, предложить пропустить)

### Отчёт
```
📊 **Курс "basic"**
✅ 4/5 шагов (80%)
✅ Шаг 1: click — OK
❌ Шаг 2: fill — записано как click (фокус не на поле)
✅ Шаг 3: select — OK
✅ Шаг 4: press Enter — OK
✅ Шаг 5: hover — OK
```

---

## Оценка времени

| Iteration | Описание | Время |
|-----------|----------|-------|
| 0 | Реструктуризация | ~15 мин |
| 1 | Критические фиксы | ~2-3 ч |
| 2 | Chrome Extension | ~1-2 ч |
| 3 | Graceful shutdown | ~1 ч |
| 4 | Cross-origin server | ~30 мин |
| 5 | Unit-тесты | ~3-4 ч |
| 6 | E2E Interactive Course | ~4-6 ч |
| **Итого** | | **~12-17 ч** |
