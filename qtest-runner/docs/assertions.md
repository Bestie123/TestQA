---
title: Assertions
source: assertions.md
---

# Assertions

> **Source:** `assertions.md`

qtest-runner supports 5 assertion types that verify page state during test execution. Assertions can be triggered by:
- **Natural language** — Russian phrases parsed by `action-parser.ts`
- **Direct command** — English action type (e.g. `assertText`)
- **Recorded** — captured via INJECT_SCRIPT during browser recording

---

## assertText

Checks that a specific text string appears anywhere on the page.

**Usage:**
- English: `assertText`, `verify "text"`
- Russian: `проверить что "текст" отображается`, `проверить текст "текст"`, `убедиться "текст"`

**Implementation** (`executor.ts:274`):
```ts
result = await verifyText(ctx, command.text || '');
```
Uses Playwright's `page.locator('text=...')` under the hood.

**In test steps** (`convertToSteps`):
> Проверить что текст "Welcome back!" отображается

---

## assertVisible

Checks that a specific element is visible on the page.

**Usage:**
- English: `assertVisible`, `verify visible "selector"`
- Russian: `проверить видимость "селектор"`, `проверить что "..." отображается`

**Implementation** (`executor.ts:278`):
```ts
await ctx.waitForSelector(command.selector, { state: 'visible', timeout: 10000 });
result = true;
```

**In test steps:**
> Проверить видимость элемента "Submit button"

---

## assertValue

Checks that an input field has a specific value.

**Usage:**
- English: `assertValue`, `verify value "selector" = "expected"`
- Russian: `проверить значение "поле" равно "значение"`

**Implementation** (`executor.ts:284`):
```ts
const val = await ctx.inputValue(command.selector);
result = val === (command.value || '');
```

**In test steps:**
> Проверить значение поля "Name field" = "John"

---

## assertChecked

Checks whether a checkbox or radio button is checked.

**Usage:**
- English: `assertChecked`, `verify checked "selector"`
- Russian: `проверить чекбокс "..."`

**Implementation** (`executor.ts:289`):
```ts
result = await ctx.isChecked(command.selector);
```

**In test steps:**
> Проверить состояние чекбокса "Checkbox"

---

## assertUrl

Checks that the current page URL contains a specific string.

**Usage:**
- English: `assertUrl`, `verify url "..."` 
- Russian: `проверить URL содержит "..."`, `адрес должен быть "..."`, `страница должна содержать "..."`

**Implementation** (`executor.ts:292`):
```ts
result = page.url().includes(command.text || command.value || '');
```

**In test steps:**
> Проверить URL содержит "/dashboard"

---

## Error Handling

All assertions return `{ status: 'failed', error: ... }` when the check fails:

```ts
return { status: 'failed', error: `Assertion failed: assertText (selector=text=hello, expected=hello)` };
```

Recording still captures the action even on failure (for debugging).

---

## Natural Language Parsing

The action parser (`action-parser.ts:191-208`) handles Russian phrases:

| Phrase Pattern | Action |
|---------------|--------|
| `проверить что "текст"` | `assertText` |
| `проверить видимость "..."` | `assertVisible` |
| `проверить значение "..." = "..."` | `assertValue` |
| `проверить чекбокс "..."` | `assertChecked` |
| `проверить URL / адрес должен быть` | `assertUrl` |
| `убедиться "..."` | `assertText` |

---

## Related Files

| File | Purpose |
|------|---------|
| `packages/browser-agent/src/executor.ts` | Assertion execution |
| `packages/browser-agent/src/action-parser.ts` | Natural language parsing |
| `packages/recorder-service/src/db.ts` | Test step conversion |
| `packages/browser-agent/src/__tests__/executor.test.ts` | Assertion tests |
