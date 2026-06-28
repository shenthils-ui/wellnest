@echo off
title WellNest - Build
cd /d "%~dp0"

REM --- Rebuild WellNest after code changes (optimized production PWA) ---

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

echo Installing/updating dependencies...
call npm --prefix backend install --no-audit --no-fund
call npm --prefix frontend install --no-audit --no-fund

echo.
echo Building the optimized app...
call npm --prefix frontend run build
if errorlevel 1 (
  echo Build failed - see messages above.
  pause
  exit /b 1
)

echo.
echo Build complete. Double-click start.bat to run WellNest.
pause
