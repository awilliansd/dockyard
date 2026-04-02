@echo off
echo.
echo   Dockyard - Setup
echo   ----------------
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Node.js is required. Install from https://nodejs.org
    pause
    exit /b 1
)
echo   [ok] Node.js found

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo   [..] Installing pnpm...
    npm install -g pnpm
)
echo   [ok] pnpm found

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] git is required. Install from https://git-scm.com
    pause
    exit /b 1
)
echo   [ok] git found

echo.
echo   [..] Installing dependencies...
cd /d "%~dp0"
pnpm install

if not exist "data\tasks" mkdir data\tasks

echo.
echo   [ok] Setup complete!
echo.
echo   Run Dockyard:
echo     pnpm dev          Start dev server (http://localhost:5421)
echo     shipyard.cmd       Start + open browser
echo.
pause
