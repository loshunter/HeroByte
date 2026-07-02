@echo off
setlocal
cd /d "%~dp0"
node "%~dp0scripts\dev-port-preflight.mjs" free --service client
set EXIT_CODE=%ERRORLEVEL%
endlocal
exit /b %EXIT_CODE%
