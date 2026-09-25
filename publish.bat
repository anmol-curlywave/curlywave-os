@echo off
title Publish Curlywave OS to GitHub
cd /d "%~dp0"
REM Sends the code in this folder to GitHub. GitHub then rebuilds the website and desktop apps automatically.
REM NOTE: GitHub is the main copy. Only use this if you changed files in THIS folder.
where git >nul 2>nul || (echo Git is not installed. Get it from https://git-scm.com & pause & exit /b 1)
if not exist .git (
  git init -b main
  git remote add origin https://github.com/anmol-curlywave/curlywave-os.git
)
git fetch origin main || goto :fail
git reset --soft origin/main
git add -A
git commit -m "Update from PC" || echo Nothing new to publish.
git push origin HEAD:main || goto :fail
echo.
echo Done. The website updates in about 2 minutes: https://anmol-curlywave.github.io/curlywave-os/
pause
exit /b 0
:fail
echo Something went wrong - send a screenshot of this window to Claude.
pause
exit /b 1
