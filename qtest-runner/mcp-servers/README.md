# MCP Servers for qtest-runner

## Working Servers

### browser-devtools (v2.0.0)
**Status:** ✅ Working
**Purpose:** Chrome DevTools Protocol wrapper for browser analysis

**Tools:**
- `browser_navigate` - Navigate to URL
- `browser_get_html` - Get HTML of element
- `browser_inspect_dom` - Inspect DOM tree structure
- `browser_find_elements` - Find elements by CSS selector
- `browser_click` - Click an element
- `browser_type` - Type text into input
- `browser_evaluate` - Execute JavaScript
- `browser_screenshot` - Take screenshot
- `browser_list_tabs` - List browser tabs
- `browser_get_filter_panel` - Click filter button and find filter panel

**Prerequisites:**
1. Chrome must be running with `--remote-debugging-port=9222`
2. Run `node chrome-launcher.js` to start Chrome

### zephyr-scale (v2.0.0)
**Status:** ⚠️ Network dependent
**Purpose:** Zephyr Scale API wrapper

**Tools:**
- `zephyr_list_projects` - List all projects
- `zephyr_list_testcases` - List test cases
- `zephyr_get_testcase` - Get test case details
- `zephyr_list_cycles` - List test cycles
- `zephyr_list_plans` - List test plans
- `zephyr_list_folders` - List folder tree
- `zephyr_get_execution` - Get test execution results

**Prerequisites:**
1. `~/.qtest/credentials.json` must exist
2. Network access to jira.ifellow.ru

### regression-test (v1.0.0)
**Status:** ✅ Working
**Purpose:** Regression testing with logging

**Tools:**
- `test_fullscreen` - Test if site is displayed in full screen
- `test_layout` - Test layout elements
- `test_load_time` - Test page load time
- `get_logs` - Get regression test logs
- `clear_logs` - Clear regression test logs

**Logging:**
- All tool calls
- All responses
- All errors
- Timestamps
- Parameters

**Log file:** `regression-test.log`

## Utility Scripts

### chrome-launcher.js
Launch Chrome with CDP enabled:
```bash
node chrome-launcher.js              # Launch Chrome
node chrome-launcher.js --check      # Check if CDP is running
node chrome-launcher.js --kill       # Kill Chrome CDP instances
```

### verify.js
Test all MCP servers:
```bash
node verify.js                       # Test all servers
```

### test-mcp.js
Test individual MCP servers:
```bash
node test-mcp.js browser-devtools    # Test browser MCP
node test-mcp.js zephyr-scale        # Test Zephyr MCP
node test-mcp.js regression-test     # Test regression MCP
node test-mcp.js all                 # Test all
```

### debug-toolkit.js
Full diagnostics:
```bash
node debug-toolkit.js                # Full diagnostics
```

## Troubleshooting

### Chrome not connecting
1. Kill existing Chrome: `node chrome-launcher.js --kill`
2. Wait 2 seconds
3. Launch Chrome: `node chrome-launcher.js`
4. Verify: `node chrome-launcher.js --check`

### Zephyr API not accessible
1. Check network: `ping jira.ifellow.ru`
2. Check credentials: `cat ~/.qtest/credentials.json`
3. Test API: `curl -H "Authorization: Bearer TOKEN" https://jira.ifellow.ru/rest/tests/latest/projects`

### MCP server not loading in opencode
1. Verify opencode.json has mcp section (not mcpServers)
2. Restart opencode
3. Check server logs in opencode output

### Regression test MCP not working
1. Check if Chrome CDP is running: `node chrome-launcher.js --check`
2. Check logs: `node -e "..."`
3. Clear logs: `node -e "..."`

## Documentation

- `ADVANCED-PROMPT.md` - Advanced prompt with self-healing
- `REGRESSION-FIX-PROMPT.md` - Regression fix prompt
- `FINAL-PROMPT.md` - Final prompt for new sessions
- `PROBLEMS.md` - Problems and solutions
- `zephyr-filter-analysis.md` - Zephyr filter analysis
- `zephyr-cycle-analysis.md` - Zephyr cycle analysis
