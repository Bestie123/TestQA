# Анализ фильтров реального Zephyr Scale

## Структура фильтров (проанализировано через Chrome DevTools)

### Кнопка "Фильтры"
- CSS: `button.expand-filters-button`
- Класс: `css-1luyhz2` / `css-dg3gvv`
- Действие: раскрывает/скрывает панель фильтров

### Панель фильтров
- `data-testid="zephyr-scale-grid-filter-section"`
- Содержит:
  1. Кнопку "Добавить критерий"
  2. Кнопку "Cохраненный фильтр"

### Кнопка "Добавить критерий"
- CSS: `button.css-48ccbj`
- Действие: открывает выпадающий список с поиском

### Список критериев (после клика)
- CSS: `div.css-7uwa0r`
- Position: absolute, z-index: 510
- Содержит:
  - Поле поиска (placeholder "Поиск...")
  - Заголовок "Static Fields"
  - Список критериев

### Доступные критерии и их контроли:
1. **Наименование** (Name) → text input (поиск по подстроке)
2. **Статус** (Status) → select dropdown с чекбоксами
3. **Приоритет** (Priority) → select dropdown с чекбоксами
4. **Тег** (Tag) → text input (поиск по подстроке)
5. **Дата создания** (Created Date) → date range picker (От—До)
6. **Расчётное время** (Estimated Time) → number range (От—До)
7. **Компонент** (Component) → select dropdown с чекбоксами
8. **Владелец** (Owner) → select dropdown с чекбоксами
9. **Покрытие (Задачи)** (Coverage - Issues) → number range (От—До)
10. **Покрытие (Страницы)** (Coverage - Pages) → number range (От—До)

### Поведение:
1. Клик "Фильтры" → раскрывает панель
2. Клик "Добавить критерий" → открывает dropdown с поиском
3. Выбор критерия → добавляет его инлайн с контролом
4. Каждый активный критерий имеет кнопку удаления (×)
5. Рядом кнопка "Cохраненный фильтр"
6. Фильтры применяются мгновенно (client-side)
7. Результаты обновляются в таблице

### CSS селекторы:
- Фильтр-панель: `[data-testid="zephyr-scale-grid-filter-section"]`
- Кнопка "Добавить критерий": `button.css-48ccbj`
- Dropdown: `div.css-7uwa0r`
- Поиск в dropdown: `input[placeholder="Поиск..."]`
- Опция: `[role="option"]`
- Активный критерий: `div.css-1c8z9du` (контейнер)
- Кнопка удаления: `span` с символом `×`

### Типы контролей (детально):
- **Text input**: `<input type="text" placeholder="Содержит...">` — 200px ширина
- **Select dropdown**: `<select>` с опциями из данных
- **Date range**: 2 `<input type="date">` разделены `—`
- **Number range**: 2 `<input type="number" min="0">` с placeholder "От"/"До"
