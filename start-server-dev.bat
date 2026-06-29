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
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $conns = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction Stop } catch { $conns = @() };" ^
  "foreach ($conn in $conns) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }"

pnpm --filter vtt-server dev

echo.
pause
endlocal
