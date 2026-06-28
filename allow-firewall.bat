@echo off
title WellNest - Allow phone access (firewall)

REM Lets phones on your Wi-Fi reach WellNest by opening its port in Windows
REM Firewall. Needs administrator rights, so it will ask for permission.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking Windows for permission to update the firewall...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Opening the WellNest ports (3001 for the app, 5173 for dev mode)...
netsh advfirewall firewall delete rule name="WellNest" >nul 2>&1
netsh advfirewall firewall delete rule name="WellNest (dev)" >nul 2>&1
netsh advfirewall firewall add rule name="WellNest" dir=in action=allow protocol=TCP localport=3001
netsh advfirewall firewall add rule name="WellNest (dev)" dir=in action=allow protocol=TCP localport=5173

echo.
echo Done. Your phone (on the SAME Wi-Fi, not a "Guest" network) should now
echo open WellNest at  http://YOUR-PC-IP:3001
echo.
echo To undo this later, run this command in an admin PowerShell:
echo    netsh advfirewall firewall delete rule name="WellNest"
echo.
pause
