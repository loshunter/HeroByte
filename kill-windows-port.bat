@echo off
:: Kill any Windows process holding port 5173 before starting the client

setlocal
set PORT=5173

echo === Releasing Windows hold on port %PORT% ===

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $conns = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction Stop } catch { $conns = @() };" ^
  "if ($conns.Count -eq 0) { Write-Host 'No Windows process is listening on port %PORT%' } else {" ^
  "  foreach ($conn in $conns) {" ^
  "    try {" ^
  "      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop;" ^
  "      Write-Host ('Stopped process {0} on port %PORT%' -f $conn.OwningProcess)" ^
  "    } catch {" ^
  "      Write-Warning ('Failed to stop process {0} on port %PORT%: {1}' -f $conn.OwningProcess, $_)" ^
  "    }" ^
  "  }" ^
  "}"

if errorlevel 1 (
  echo.
  echo ⚠️  PowerShell reported an error while freeing the port.
)

echo.
echo === Done ===
echo.
pause
endlocal
exit /b 0
