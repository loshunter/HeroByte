@echo off
echo Starting HeroByte Server (dev branch)...
wsl -d Ubuntu bash -ic "cd ~/HeroByte && git checkout dev && cd apps/server && pnpm dev"
pause