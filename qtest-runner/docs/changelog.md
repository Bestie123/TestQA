---
title: Changelog
source: changelog.md
---

# Changelog

> **Source:** `changelog.md`

All notable changes to qtest-runner.

## 2026-05-30 — Iteration 5b: convertToSteps Unit Tests

- **Added** 76 unit tests for `convertToSteps()` in recorder-service (`db.ts`)
- **Added** `"exclude": ["src/__tests__"]` to recorder-service `tsconfig.json`
- **Total** 205 unit tests (59 action-parser + 19 ws-server + 51 executor + 76 convertToSteps)

## 2026-05-30 — Iteration 5a: executor + ws-server Tests

- **Added** 51 unit tests for `executor.ts` (all action types, error handling, frame resolution)
- **Added** 19 unit tests for `ws-server.ts` (HTTP endpoints, WebSocket routing)
- **Fixed** ws-server exported `httpServer`, `handleMessage`, `clients` for testability
- **Fixed** browser-agent tsconfig: added `"exclude": ["src/__tests__"]`
- **Fixed** 5 action-parser bugs:
  - English "right click" pattern added to rightClick regex
  - English "navigate to / go to" + Russian "страницу / страница" added to URL regex
  - English "switch tab / select tab / change tab" — fixed regex order (was matched as listTabs)
  - Russian "открыть страницу URL" — extended URL regex
  - assertText regex ordering — "проверить что" moved to first alternation position
- **Total** 129 unit tests (59 + 19 + 51)

## 2026-05-30 — File Reorganization

- `Test-cases&Bug-reports/` moved out of TestQA to `Desktop/`
- `zephyr-sort-extension/` moved out of TestQA to `Desktop/`
- `docs/` structure created at TestQA root: `rules/`, `testcases/`, `reports/`, `archive/`
- `.md` files from qtest-runner root moved to `qtest-runner/docs/`
- Loose files (.xlsx → testcases/, .docx → reports/, plan files → archive/)
- Garbled/temp files moved to `Test-cases&Bug-reports/`

## 2026-05-30 — Critical Fixes

- **ImportPage.tsx**: Client-side Excel parsing via SheetJS (`xlsx`) instead of broken server upload
- **SyncPage.tsx**: Client-side Excel parsing + diff display
- **Step Library Service**: Seed parameter `project` → `projectUrl`
- **Chrome Extension**: Shadow DOM support via `composedPath()`, `getSelector()` shadow-aware
- **Chrome Extension manifest**: Icon paths fixed to `icons/icon16.png`
- **Graceful shutdown**: SIGINT/SIGTERM/SIGBREAK on all 6 services (5s force timeout)
- **Cross-origin iframe test server**: Port 9091

## 2026-05-28 — Iterations 0-6 Complete

- **Iteration 0**: AGENTS.md restructured, project map
- **Iteration 1**: ImportPage + SyncPage Excel fixes, seed data, CAPTCHA test pages
- **Iteration 2**: Chrome Extension Shadow DOM, composedPath, icons
- **Iteration 3**: Graceful shutdown for all 6 services
- **Iteration 4**: Cross-origin iframe test server
- **Iteration 5**: Vitest setup, 59 action-parser tests
- **Iteration 6**: E2E Interactive Course MCP tools

## 2026-05-27 — Project Initialization

- 8 microservices created
- INJECT_SCRIPT recording system
- MCP tools for browser debugging
- Core recording pipeline: inject → store → convert → execute
