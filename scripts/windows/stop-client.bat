@echo off
set PORT=5174
echo Stopping HeroByte Client (killing processes on port %PORT%)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo Found process on port %PORT% (PID %%a)
    taskkill /PID %%a
)
echo Done!
pause
