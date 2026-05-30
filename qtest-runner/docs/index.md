---
title: What is qtest-runner
---

# qtest-runner

> **Source:** `index.md` (new)

Browser-based test recording tool for generating Zephyr Scale test cases. Records real user interactions in a browser and converts them into structured test steps with Russian-language descriptions.

## Key Capabilities

- **Record** — capture clicks, fills, navigations, HTTP requests, assertions, and more via injected script
- **Convert** — transform raw action logs into readable test steps via `convertToSteps()`
- **Execute** — replay recorded steps through Playwright automation
- **Integrate** — import/export test cases for Zephyr Scale (Excel .xlsx)

## Architecture Overview

```
Web UI (8080)  →  API Gateway (3000)  →  Execution Service (3003)
                                       →  Recorder Service (3004)
                                       →  Testcase Service (3001)
                                       →  Step Library Service (3002)

Browser Agent (3005)  ← MCP  ←  AI Assistant (opencode)
                          ↓
                    Recorder Service (3004)  →  SQLite
```

## Quick Links

| Section | Description |
|---------|-------------|
| [Usage Guide](/usage) | Installation, build, run all services, MCP tools |
| [Architecture](/architecture) | 8 microservices, ports, technologies, code style |
| [Execution Flow](/flow) | How a test case executes from UI to browser |
| [Assertions](/assertions) | assertText, assertVisible, assertValue, assertChecked, assertUrl |
| [Known Problems](/problems) | INJECT_SCRIPT, execute-step, and other issues |
| [Testing Guide](/testing) | How to test the recorder on real websites |
| [Project Status](/status) | Current progress, completed iterations, roadmap |
| [Changelog](/changelog) | History of changes |

## External Links

| Resource | Location |
|----------|----------|
| Zephyr Rules & Process | `TestQA/docs/rules/AGENTS.md` |
| Active Goal / Session Log | `TestQA/ACTIVE_GOAL.md` |

## Test Stats

- **205** unit tests across 4 test suites
- **9** packages all build with 0 TypeScript errors
- **76** `convertToSteps` tests covering all action types
- **51** `executor.ts` tests covering all execution paths
