@echo off
echo Checking HeroByte client port...
wsl -d Ubuntu bash -ic "cd ~/HeroByte && node scripts/dev-port-preflight.mjs ensure-free --service client"
if errorlevel 1 goto :end
echo Starting HeroByte Client...
wsl -d Ubuntu bash -ic "cd ~/HeroByte && pnpm --filter herobyte-client dev"
pause
goto :end

:end
