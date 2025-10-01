@echo off
echo Stopping HeroByte Client (killing processes on port 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo Found process on port 5173 (PID %%a)
    taskkill /PID %%a
)
echo Done!
pause
