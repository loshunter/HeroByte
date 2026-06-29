@echo off
setlocal
set PORT=5174

echo Releasing HeroByte client port %PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $conns = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction Stop } catch { $conns = @() };" ^
  "foreach ($conn in $conns) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo Done! Port %PORT% should be free now.
timeout /t 2 /nobreak >nul
endlocal
