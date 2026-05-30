---
title: Testing Guide
source: testing.md
---

# Testing Guide

> **Source:** `testing.md`

## Unit Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run a specific test file
npx vitest run packages/browser-agent/src/__tests__/action-parser.test.ts
npx vitest run packages/recorder-service/src/__tests__/convertToSteps.test.ts
```

**Current coverage:** 205 tests across 4 suites:

| Suite | Tests | File |
|-------|-------|------|
| action-parser | 59 | `browser-agent/src/__tests__/action-parser.test.ts` |
| ws-server | 19 | `browser-agent/src/__tests__/ws-server.test.ts` |
| executor | 51 | `browser-agent/src/__tests__/executor.test.ts` |
| convertToSteps | 76 | `recorder-service/src/__tests__/convertToSteps.test.ts` |

---

## Manual Testing — Record on a Real Website

### Quick Start

1. **Start all services:**
   ```bash
   cd qtest-runner
   npm run build
   # Then start each service in separate terminals, or:
   # Using the MCP tools directly
   ```

2. **Launch browser and start recording** (via MCP tools or directly):

   **Using MCP tools:**
   ```json
   qtest_launch_browser { "profileName": "TestSession" }
   qtest_record_start { "name": "My Test" }
   ```

3. **Interact with the browser** — click, fill forms, navigate to websites.

4. **Stop recording and inspect:**
   ```json
   qtest_record_stop { "sessionId": "..." }
   qtest_get_actions { "sessionId": "...", "format": "testcase" }
   qtest_convert_steps { "sessionId": "..." }
   ```

### Recording Flow

```
Browser Interaction → INJECT_SCRIPT captures events
    → recorder.ts sends to recorder-service
    → db.ts stores in SQLite
    → convertToSteps() transforms to test steps
```

### Test Pages

| Page | URL | Purpose |
|------|-----|---------|
| Main test page | `http://localhost:9090/` | Click, fill, select, hover, dblclick |
| Advanced test | `http://localhost:9090/advanced-test.html` | Complex interactions |
| iframe test | `http://localhost:9090/iframe1.html` | Same-origin iframes |
| Cross-origin iframe | `http://localhost:9091/cross-iframe-content.html` | Cross-origin iframes |
| CAPTCHA test | `http://localhost:9090/captcha-test.html` | CAPTCHA detection |
| Cross-origin (port 9091) | `http://localhost:9091/` | Second server for cross-origin testing |

### Starting Test Pages

```bash
# Stub site with test pages (port 9090)
cd packages/stub-site
npx http-server public -p 9090

# Cross-origin iframe server (port 9091)
node server.js
```

---

## Action Type Checklist

When testing recording, verify these action types:

| Action Type | How to Trigger | Status |
|------------|----------------|--------|
| click | Left click on any element | ✅ |
| dblclick | Double click | ✅ |
| rightClick | Right click / contextmenu | ✅ |
| canvas_click | Click on `<canvas>` | ✅ |
| fill | Type in text input | ✅ |
| select | Choose from `<select>` | ✅ |
| keypress | Press Enter, Tab, Escape | ✅ |
| check | Check/uncheck checkbox/radio | ✅ |
| hover | Hover over element | ✅ |
| drag | Drag and drop | ✅ |
| scroll | Scroll page | ✅ |
| wheel | Mouse wheel | ✅ |
| submit | Submit a form | ✅ |
| navigate | Page navigation | ✅ |
| switchTab | Switch browser tab | ✅ |
| fileUpload | Upload a file | ✅ |
| waitForSelector | Wait for element | ✅ |
| assertText | Check text on page | ✅ |
| assertVisible | Check element visible | ✅ |
| touch | Touch events | ✅ |
| dialog | Browser dialog (alert/confirm) | ✅ |
| console | Console messages | ✅ |
| media_play/pause/seeked | HTML5 video/audio | ✅ |
| popover_toggle | Popover open/close | ✅ |
| js_error | JavaScript errors | ✅ |

---

## Checking the Database

```bash
# Via MCP tool
qtest_check_db { "limit": 10 }

# Direct SQLite (if recorder-service running)
sqlite3 packages/recorder-service/recordings.db
```

---

## Debugging Tips

1. **No actions recorded?** Check that INJECT_SCRIPT was loaded (browser console → look for inject-helpers messages)
2. **Wrong selectors?** Check the selector format — prefers `data-testid` > `id` > `class` > `tag`
3. **Test steps don't match?** Run `qtest_convert_steps` to see what convertToSteps produces
4. **Assertions failing?** Use `qtest_execute_step` with individual commands to isolate the issue

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `better-sqlite3` native module error | Ensure Node.js ≥22 and rebuild: `npm rebuild better-sqlite3` |
| Port already in use | Kill existing process on the port, or change port in config |
| Browser not launching | Check Chrome/Chromium installation, or set `CHROME_PATH` env var |
| Unit tests hang | The `wait` test takes ~1s; total runtime should be <10s |
