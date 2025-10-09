@echo off
echo Killing any process using port 5173...
wsl -d Ubuntu lsof -ti:5173 2>nul | xargs kill -9 2>nul
echo Done! Port 5173 should be free now.
timeout /t 2
