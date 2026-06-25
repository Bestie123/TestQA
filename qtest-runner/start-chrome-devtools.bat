@echo off
echo Starting Chrome Dev with remote debugging on port 9222...
echo Close all Chrome windows first, then press any key to continue.
pause >nul
start "" "C:\Program Files\Google\Chrome Dev\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check
echo Chrome started. You can now use cdp_* MCP tools.
