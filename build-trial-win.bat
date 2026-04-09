@echo off
cd /d "%~dp0"
echo Building MyLoopio TRIAL for Windows...
call npm install --legacy-peer-deps
call npm run pack:win:trial
pause
