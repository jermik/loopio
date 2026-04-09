@echo off
cd /d "%~dp0"
echo Building MyLoopio TRIAL for Linux...
call npm install --legacy-peer-deps
call npm run pack:linux:trial
pause
