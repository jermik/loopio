@echo off
cd /d "%~dp0"
echo Building MyLoopio FULL for Windows...
call npm install --legacy-peer-deps
call npm run pack:win:full
pause
