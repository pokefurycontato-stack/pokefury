@echo off
echo Upload de assets da cidade...
echo.
cd /d "%~dp0\..\.."
node upload-city-assets.js
echo.
pause
