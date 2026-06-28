@echo off
title WellNest
cd /d "%~dp0"

REM --- WellNest one-click launcher (production / installable PWA) ---
REM Builds the optimized app if needed, then runs the local server which
REM serves the app AND the API on one address. Open it on this PC, or on a
REM phone using this PC's Wi-Fi address (shown in the window when it starts).

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed.
  echo   Please install the LTS version from https://nodejs.org/ and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo Installing backend dependencies ^(first run only, this can take a minute^)...
  call npm --prefix backend install --no-audit --no-fund
  if errorlevel 1 goto setup_error
)

if not exist "frontend\node_modules" (
  echo Installing frontend dependencies ^(first run only^)...
  call npm --prefix frontend install --no-audit --no-fund
  if errorlevel 1 goto setup_error
)

if not exist "frontend\dist\index.html" (
  echo Building the app ^(first run only; run build.bat after updates^)...
  call npm --prefix frontend run build
  if errorlevel 1 goto setup_error
)

echo.
echo   Starting WellNest. A browser window will open in a few seconds.
echo   Leave this window open while you use the app. Close it to stop.
echo.

REM open the browser shortly after the server has time to start
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3001"

node backend\server.js
goto :eof

:setup_error
echo.
echo   Setup failed. Please read the messages above.
echo   If it mentions build tools for better-sqlite3, see the README.
echo.
pause
exit /b 1
