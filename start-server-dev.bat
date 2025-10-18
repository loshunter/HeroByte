@echo off
setlocal

set PROJECT_PATH=/home/loshunter/HeroByte
set WSL_DISTRO=Ubuntu

echo === HeroByte Server Dev Startup ===
echo.
echo Releasing port 8787 inside WSL...
wsl -d %WSL_DISTRO% --cd %PROJECT_PATH% -e bash -lc "lsof -ti:8787 2>/dev/null | xargs -r kill -9 2>/dev/null; exit 0"
echo.
echo Starting HeroByte Server (dev branch)...
wsl -d %WSL_DISTRO% --cd %PROJECT_PATH% -e bash -lc "git checkout dev && pnpm --filter vtt-server dev"

echo.
pause
endlocal
