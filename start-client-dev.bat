@echo off
setlocal

set PORT=5173
set PROJECT_PATH=~/HeroByte
set WSL_DISTRO=Ubuntu

:: Step 1: ensure Windows isn't holding the port
call "%~dp0kill-windows-port.bat"

:: Step 2: clean up WSL processes on the same port
wsl -d %WSL_DISTRO% --cd /home/loshunter/HeroByte -e bash -lc "cd %PROJECT_PATH% && ./kill-ports.sh"

:: Step 3: start client
wsl -d %WSL_DISTRO% --cd /home/loshunter/HeroByte -e bash -lc "cd %PROJECT_PATH% && git checkout dev && pnpm --filter herobyte-client dev"

endlocal
