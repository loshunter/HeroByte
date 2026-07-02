@echo off
setlocal

cd /d "%~dp0"

echo === HeroByte Server Dev Startup ===
echo.
set PORT=8787
set HEROBYTE_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174

echo Starting HeroByte server from %CD%
echo Server URL: ws://localhost:8787
echo.
node "%~dp0scripts\dev-port-preflight.mjs" ensure-free --service server
if errorlevel 1 exit /b 1

pnpm --filter vtt-server dev

echo.
pause
endlocal
