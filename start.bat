@echo off
title Curlywave OS
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org and run this again.
  pause
  exit /b
)
if not exist node_modules (
  echo Installing (first run only, takes a minute)...
  call npm install
)
echo.
echo Curlywave OS is starting at http://localhost:5173  -- keep this window open.
call npm run dev -- --open
pause
