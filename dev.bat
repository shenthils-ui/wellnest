@echo off
title WellNest - Dev
cd /d "%~dp0"

REM --- Development mode: Vite dev server + backend together (hot reload) ---
REM Frontend: http://localhost:5173   Backend API: http://localhost:3001
REM On a phone (same Wi-Fi) use http://THIS-PC-IP:5173 in dev mode.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist "node_modules" call npm install
if not exist "backend\node_modules" call npm --prefix backend install
if not exist "frontend\node_modules" call npm --prefix frontend install

call npm run dev
