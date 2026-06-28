@echo off
title WellNest - Disable auto-start
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\WellNest.lnk"

if exist "%SHORTCUT%" (
  del "%SHORTCUT%"
  echo Auto-start turned off. WellNest will no longer launch when you sign in.
) else (
  echo Auto-start was not enabled, so there is nothing to remove.
)
echo.
echo This only stops the automatic launch. Your app and all your data are untouched.
echo To stop WellNest right now, just close its black server window.
echo.
pause
