@echo off
cd /d "%~dp0"
echo Building MyLoopio FULL for Linux...
call npm install --legacy-peer-deps
call npm run pack:linux:full
pause
