@echo off
chcp 1251 >nul
cd /d "%~dp0"
title QTest Runner - Start
echo === QTest Runner - Iteration 6 ===
echo.

if not exist "node_modules" (
    echo [ERROR] node_modules not found. Run setup.bat first.
    pause
    exit /b 1
)

echo [0/2] Killing stale services from previous run...
taskkill /fi "windowtitle eq qtest-tc:3001" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-step:3002" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-exec:3003" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-recorder:3004" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-agent:3005" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-gateway:3000" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-web:8080" /f >nul 2>&1
REM Also kill orphaned node processes on qtest ports
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000 :3001 :3002 :3003 :3004 :3005 :3006 :8080" ^| findstr "LISTENING"') do taskkill /pid %%p /f >nul 2>&1
timeout /t 2 /nobreak >nul
echo      Done.
echo.

echo [1/2] Checking build status...
set NEED_BUILD=0
if not exist "packages\shared-types\dist" set NEED_BUILD=1
if not exist "packages\execution-service\dist" set NEED_BUILD=1
if not exist "packages\browser-agent\dist" set NEED_BUILD=1
if not exist "packages\testcase-service\dist" set NEED_BUILD=1
if not exist "packages\step-library-service\dist" set NEED_BUILD=1
if not exist "packages\recorder-service\dist" set NEED_BUILD=1
if not exist "packages\api-gateway\dist" set NEED_BUILD=1
if not exist "packages\web-ui\dist\index.html" set NEED_BUILD=1

if %NEED_BUILD%==1 (
    echo      Building packages ^(this may take a minute^)...
    call npx turbo run build
    if errorlevel 1 (
        echo [ERROR] Build failed.
        echo         Try running: npx turbo run build
        pause
        exit /b 1
    )
    echo      Build OK.
) else (
    echo      All packages already built. Skipping build.
)
echo.

echo [2/2] Starting services...
echo.

start "qtest-tc:3001" cmd /c "title qtest-tc:3001 && cd /d %~dp0packages\testcase-service && node dist\index.js"
echo [1] testcase-service  : http://localhost:3001
timeout /t 2 /nobreak >nul

start "qtest-step:3002" cmd /c "title qtest-step:3002 && cd /d %~dp0packages\step-library-service && node dist\index.js"
echo [2] step-library-service : http://localhost:3002
timeout /t 2 /nobreak >nul

start "qtest-exec:3003" cmd /c "title qtest-exec:3003 && cd /d %~dp0packages\execution-service && node dist\index.js"
echo [3] execution-service : http://localhost:3003
timeout /t 2 /nobreak >nul

start "qtest-recorder:3004" cmd /c "title qtest-recorder:3004 && cd /d %~dp0packages\recorder-service && node dist\index.js"
echo [4] recorder-service  : http://localhost:3004
timeout /t 2 /nobreak >nul

start "qtest-agent:3005" cmd /c "title qtest-agent:3005 && cd /d %~dp0packages\browser-agent && node dist\index.js"
echo [5] browser-agent     : http://localhost:3005
timeout /t 2 /nobreak >nul

start "qtest-gateway:3000" cmd /c "title qtest-gateway:3000 && cd /d %~dp0packages\api-gateway && node dist\index.js"
echo [6] api-gateway       : http://localhost:3000
timeout /t 2 /nobreak >nul

start "qtest-web:8080" cmd /c "title qtest-web:8080 && cd /d %~dp0packages\web-ui && call npx.cmd vite --port 8080 --host"
echo [7] web-ui (dev)      : http://localhost:8080

echo.
echo === All services started ===
echo.
echo Web UI:     http://localhost:8080
echo API Gw:     http://localhost:3000
echo.
echo Close this window or press any key to stop all services.
echo.
pause >nul

echo Stopping services...
taskkill /fi "windowtitle eq qtest-tc:3001" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-step:3002" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-exec:3003" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-recorder:3004" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-agent:3005" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-gateway:3000" /f >nul 2>&1
taskkill /fi "windowtitle eq qtest-web:8080" /f >nul 2>&1
echo Done.
timeout /t 2 /nobreak >nul
