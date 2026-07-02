@echo off
setlocal

cd /d "%~dp0"

set VITE_WS_URL=ws://localhost:8787

echo === HeroByte Client Dev Startup ===
echo.
echo Starting HeroByte client from %CD%
echo Client URL: http://localhost:5174/
echo.
node "%~dp0scripts\dev-port-preflight.mjs" ensure-free --service client
if errorlevel 1 exit /b 1
pnpm --filter herobyte-client dev

endlocal
