@echo off
echo Attempting to free port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do call :killprocess %%a
if errorlevel 1 goto :end
timeout /t 2 /nobreak >nul
echo Starting HeroByte Client...
wsl -d Ubuntu bash -ic "cd ~/HeroByte/apps/client && pnpm dev"
pause
goto :end

:killprocess
echo Stopping process on port 5173 (PID %1)...
taskkill /PID %1 >nul 2>&1
if errorlevel 1 (
    echo WARNING: Could not stop process %1 - it may require admin privileges
    echo Please run stop-client.bat as administrator or close the previous instance manually
    pause
    exit /b 1
)
exit /b 0

:end
