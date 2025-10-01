@echo off
echo Starting HeroByte Server...
wsl -d Ubuntu bash -ic "cd ~/HeroByte/apps/server && pnpm dev"
pause
