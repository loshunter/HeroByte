@echo off
echo Releasing HeroByte client port...
wsl -d Ubuntu bash -ic "cd ~/HeroByte && node scripts/dev-port-preflight.mjs free --service client"
pause
