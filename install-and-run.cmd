@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Can cai Node.js 20 tro len: https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules\electron\dist\electron.exe call npm install
if errorlevel 1 (
  echo Cai dependency that bai. Hay xoa thu muc node_modules roi chay lai file nay.
  pause
  exit /b 1
)
call npm start
