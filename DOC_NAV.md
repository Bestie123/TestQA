# DOC_NAV.md — Навигатор документации TestQA

## Документация

| Документ | Описание |
|----------|----------|
| [docs/reference/zephyr-scale-api.md](docs/reference/zephyr-scale-api.md) | Zephyr Scale REST API v1 — эндпоинты, форматы, особенности |
| [docs/reference/zephyr-ui-analysis.md](docs/reference/zephyr-ui-analysis.md) | Анализ UI Zephyr Scale (DOM-структура, компоненты) |
| [qtest-runner/packages/recorder-shared/doc.md](qtest-runner/packages/recorder-shared/doc.md) | Recorder Shared — INJECT_SCRIPT, ActionQueue, types для browser-agent + mcp-browser |
| [qtest-runner/packages/browser-agent/doc.md](qtest-runner/packages/browser-agent/doc.md) | Browser Agent — CDP Listener, recorder, executor, TP_ID_GENERATOR |
| [qtest-runner/packages/recorder-service/doc.md](qtest-runner/packages/recorder-service/doc.md) | Recorder Service — convertToSteps, CDP action types |
| [qtest-runner/packages/web-ui/doc.md](qtest-runner/packages/web-ui/doc.md) | Web UI — Settings Page (videoDir, cdpCapture, injectTp) |
| [qtest-runner/packages/chrome-extension/doc.md](qtest-runner/packages/chrome-extension/doc.md) | Chrome Extension — content script, background, TP_ID_GENERATOR |

## Структура

```
TestQA/
  DOC_NAV.md                    ← этот файл
  docs/
    reference/
      zephyr-scale-api.md       ← API Reference (Zephyr Scale Server v1)
      zephyr-ui-analysis.md     ← UI Analysis (DOM structure)
    archive/
    reports/
    rules/
    testcases/
  qtest-runner/
    packages/
      recorder-shared/doc.md    ← INJECT_SCRIPT + ActionQueue + types (ОБЩИЙ)
      browser-agent/doc.md      ← CDP Listener + Browser Agent + TP_ID_GENERATOR
      recorder-service/doc.md   ← CDP convertToSteps
      web-ui/doc.md             ← Settings Page (videoDir, cdpCapture, injectTp)
      chrome-extension/doc.md   ← Content Script + TP_ID_GENERATOR
```
