# TestQA / qtest-runner

> Browser-based test recording tool for Zephyr Scale. Records real user interactions in a browser, converts them to structured test steps (Russian), and integrates with Jira/Zephyr.

## Quick Start

```bash
cd qtest-runner
npm install
npm run build    # builds all 9 packages
npm test         # 205 unit tests
start.bat        # launches all 6 services + web-ui
```

**Ports:** Web UI — 8080, Docs — 5173, Services — 3000-3005

## Architecture (9 packages, monorepo)

```
Web UI (8080) → API Gateway (3000) → Execution (3003) → Browser Agent (3005)
                                    → Recorder (3004)  → SQLite
                                    → Testcase (3001)  → SQLite
                                    → Step Library (3002) → SQLite
```

| Package | Port | DB | Purpose |
|---------|------|----|---------|
| `api-gateway` | 3000 | — | BFF, routing, aggregation |
| `testcase-service` | 3001 | testcases.db | CRUD, Excel import, Zephyr sync |
| `step-library-service` | 3002 | steplibrary.db | Reusable parameterized steps |
| `execution-service` | 3003 | executions.db | State machine, step orchestration |
| `recorder-service` | 3004 | recordings.db | Capture actions, convert to steps |
| `browser-agent` | 3005 | — | CDP, Playwright, inject scripts |
| `web-ui` | 8080 | — | React SPA (Vite) |
| `chrome-extension` | — | — | Manifest V3, action panel |
| `shared-types` | — | — | TypeScript interfaces & DTOs |

## Key Commands

| Command | What |
|---------|------|
| `npm run build` | Build all 9 packages (tsc) |
| `npm test` | Run 205 unit tests (vitest) |
| `npm run lint` | ESLint check (0 errors, ~245 warnings) |
| `npm run docs:dev` | Start VitePress docs (localhost:5173) |
| `npm run docs:build` | Build static docs site |
| `npm run format` | Prettier format |

## Test Status

- **205 unit tests** (59 action-parser + 19 ws-server + 51 executor + 76 convertToSteps)
- **ESLint: 0 errors**, 245 warnings (all `no-explicit-any`)
- **All 9 packages build** with 0 TypeScript errors

## Documentation (VitePress site)

Start with: `npm run docs:dev` → http://localhost:5173

| Page | What you'll find |
|------|-----------------|
| `/usage` | How to run, import Excel, record, sync Zephyr |
| `/architecture` | Microservices, ports, code style, patterns |
| `/web-ui` | Theme system (7 themes), settings (69 toggles + drag mode), Docs iframe |
| `/flow` | Full execution flow: UI → executor → browser |
| `/action-types` | All 77 action types reference matrix |
| `/assertions` | 5 assertion types, Russian/English patterns |
| `/composite-steps` | Reusable step blocks, parameters, DB schema |
| `/testing` | How to test on real websites |
| `/problems` | Known issues, root causes, fixes |
| `/status` | Current progress, completed iterations |
| `/changelog` | History of changes |

## Key Rules & Convention

1. **SQLite:** single-quoted strings, double-quoted column identifiers. `better-sqlite3` v11.
2. **Fastify v5:** response objects required, not bare arrays.
3. **Chrome Extension:** `composedPath()` for Shadow DOM, `icons/icon<size>.png` paths.
4. **Graceful shutdown:** SIGINT/SIGTERM/SIGBREAK handlers on all 6 services.
5. **Mocks:** `vi.hoisted()` + `vi.mock()` for runtime dependencies in tests. Use in-memory SQLite for `better-sqlite3` mocks.
6. **ESLint flat config** (`eslint.config.mjs`) + Prettier. No `no-empty` for inject scripts.
7. **Theme:** 7 CSS variable themes (dark default), saved to `localStorage('theme')`.
8. **Settings:** key-value `app_settings` table in `recordings.db`, CRUD via `GET/PUT /api/settings`.

## RECOMMENDED READING ORDER (for new AI session)

1. **`qtest-runner/docs/architecture.md`** — services, ports, stack
2. **`qtest-runner/docs/status.md`** — what's done, progress, roadmap
3. **`qtest-runner/docs/web-ui.md`** — theme system, settings, Docs iframe
4. **`docs/rules/AGENTS.md`** — Zephyr formatting rules, recording best practices
5. **`ACTIVE_GOAL.md`** — current session goal

## External Resources

| Resource | Path |
|----------|------|
| Zephyr formatting rules | `TestQA/docs/rules/AGENTS.md` |
| Active Goal / Session Log | `TestQA/ACTIVE_GOAL.md` |
| Global context rules | `~/.config/opencode/CONTEXT_RULES.md` |
| Test data (Zephyr exports) | `TestQA/docs/testcases/` |
| Bug reports (Word) | `TestQA/docs/reports/` |

## Recent Progress

- **77 action types** identified, 69 configurable toggles in settings
- **Settings page:** 69 action type toggles + drag mode (smart/simple) + backend API
- **Theme selector:** 7 themes (light, dark, opencode, green, purple, ocean, sunset), localStorage persistence
- **Docs tab:** iframe with VitePress docs site inside web-ui
- **ESLint + Prettier + CI/CD** (GitHub Actions) — 0 errors
- **205 unit tests** across 4 suites, all pass in <5s
- **Interactive E2E courses** via MCP tools (`qtest_test_course`/`qtest_test_course_verify`)
- **VitePress docs site** — 17 pages covering all aspects
