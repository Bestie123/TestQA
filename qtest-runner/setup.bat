@echo off
chcp 1251 >nul
cd /d "%~dp0"
title QTest Runner - Setup
echo === QTest Runner - First-time Setup ===
echo.

echo [1/4] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js >=22 from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=1-2 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%b
if %NODE_MAJOR% LSS 22 (
    echo [WARNING] Node.js %NODE_MAJOR% - expected >=22
)
echo      OK (Node.js %NODE_MAJOR%)
echo.

echo [2/4] Installing npm dependencies...
echo      This may take a while...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)
echo      OK
echo.

echo [3/4] Installing Playwright Chromium browser...
echo      Downloading ~300 MB. This may take 1-2 minutes...
call npx playwright install chromium
if errorlevel 1 (
    echo [WARNING] Playwright install failed.
    echo         Run manually: npx playwright install chromium
) else (
    echo      OK
)
echo.

echo [4/4] Building all packages...
call npx turbo run build
if errorlevel 1 (
    echo [ERROR] Build failed. Check output above.
    pause
    exit /b 1
)
echo      OK
echo.

echo === Setup complete! ===
echo.
echo Now run start.bat to launch all services.
echo.
pause
