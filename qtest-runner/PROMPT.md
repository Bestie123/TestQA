# Промпт для новой сессии

## Скопируй и вставь в новую сессию:

---

Прочитай файлы `STATUS.md`, `PROBLEMS.md`, `LOOP_RULES.md` в папке `Q:\User_Data\Desktop\TestQA\qtest-runner\`.

**Текущая задача:** Решить проблему INJECT_SCRIPT — DOM-события (click, fill, select) не записываются в recorder-service.

**Что работает:** Playwright-level события (request, navigate, page_load, response, console) — записываются. HTTP перехват работает. MCP инструменты созданы. convertToSteps доработан.

**Что НЕ работает:** INJECT_SCRIPT (14000+ символов) не инжектится в страницу. Перепробовано: page.evaluate, addInitScript, addScriptTag, exposeFunction, console.debug — ничего не помогло.

**Приоритетные гипотезы для решения:**
1. **CDP Runtime.evaluate** — инжект через Chrome DevTools Protocol напрямую (`page.context().newCDPSession(page)` → `Runtime.evaluate`)
2. **Упрощённый скрипт** — создать МИНИМАЛЬНЫЙ скрипт (только click + fill, без overlay/shadow DOM/HTTP) и проверить работает ли он
3. **Playwright codegen подход** — изучить исходный код `packages/injected/src/recorder/recorder.ts` в репозитории Playwright как именно он инжектит скрипт

**Следуй правилам из LOOP_RULES.md** — не зацикливайся, верифицируй после каждого изменения, максимум 3 попытки на подход.
