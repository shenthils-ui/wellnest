@echo off
title WellNest - Enable auto-start
setlocal
cd /d "%~dp0"
set "REPO=%~dp0"
set "TARGET=%REPO%start.bat"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP%\WellNest.lnk"

REM Create a shortcut to start.bat in the Windows Startup folder, so WellNest
REM launches automatically (minimized) whenever you sign in to Windows.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%REPO%'; $s.WindowStyle=7; $s.Description='Start WellNest'; $s.Save()"

if exist "%SHORTCUT%" (
  echo.
  echo   Done. WellNest will now start automatically when you sign in to Windows.
  echo   It opens minimized and stays reachable from the phone on your Wi-Fi.
  echo.
  echo   To turn this off later, just run  uninstall-autostart.bat
) else (
  echo.
  echo   Could not create the startup shortcut. Please run this file as your
  echo   normal Windows user ^(not "Run as administrator"^) and try again.
)
echo.
pause
