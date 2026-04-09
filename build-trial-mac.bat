@echo off
cd /d "%~dp0"
echo Building MyLoopio TRIAL for Mac...
call npm install --legacy-peer-deps
call npm run pack:mac:trial
pause
