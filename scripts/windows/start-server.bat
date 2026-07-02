@echo off
echo Checking HeroByte server port...
wsl -d Ubuntu bash -ic "cd ~/HeroByte && node scripts/dev-port-preflight.mjs ensure-free --service server"
if errorlevel 1 goto :end
echo Starting HeroByte Server...
wsl -d Ubuntu bash -ic "cd ~/HeroByte && pnpm --filter vtt-server dev"
pause

:end
