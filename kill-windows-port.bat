@echo off
:: Safely release the HeroByte client port before starting the client

setlocal
cd /d "%~dp0"
node "%~dp0scripts\dev-port-preflight.mjs" free --service client
set EXIT_CODE=%ERRORLEVEL%
endlocal
exit /b %EXIT_CODE%
