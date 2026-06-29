@echo off
setlocal

cd /d "%~dp0"

set VITE_WS_URL=ws://localhost:8787

echo === HeroByte Client Dev Startup ===
echo.
echo Starting HeroByte client from %CD%
echo Client URL: http://localhost:5174/
echo.
call "%~dp0kill-windows-port.bat"
pnpm --filter herobyte-client dev

endlocal
