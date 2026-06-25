# Активная цель (сохранено 18.06.2026)

## Главная цель
Исправить баги зависания и потери данных в mcp-browser (recorder)

## Статус
- ✅ BUG 1: Бесконечная рекурсия console → зависание — исправлена (inject-script.ts)
- ✅ BUG 2: Потеря данных при stop() из-за отсутствия await — исправлена (action-queue.ts)
- ✅ Пересобраны оба пакета (recorder-shared, mcp-browser)
- ⬜ Проверить в реальном браузере при записи (manual QA)

## Принятые решения
- Для BUG 1: использовать `__origConsole.debug` вместо `console.debug` в `__record()` чтобы обойти monkey-patch console
- Для BUG 2: сделать `stop()` асинхронным и дожидаться `flushWithRetries` перед `sessionId = null`

## Заметки / вопросы
- Для полной проверки нужен запущенный recorder-service (port 3004) и браузер
- BUG 3 (timeout postJson) и BUG 4 (cleanup listener) — признаны не-багами
