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
REM Git needs a name/email for commits; set one for this folder only if none is configured.
git config user.email >nul 2>nul || git config user.email "anmol-curlywave@users.noreply.github.com"
git config user.name >nul 2>nul || git config user.name "anmol-curlywave"
git fetch origin main || goto :fail
REM Start from GitHub's copy, then add this folder's new and changed files.
REM Files missing here are NOT deleted on GitHub, and the .github automations are never touched.
git reset --mixed origin/main >nul
git add --ignore-removal -- . ":(exclude).github"
git diff --cached --quiet && (echo Nothing new to publish.) || (git commit -q -m "Update from PC" || goto :fail)
git push origin HEAD:main || goto :fail
echo.
echo Done. The website updates in about 2 minutes: https://anmol-curlywave.github.io/curlywave-os/
pause
exit /b 0
:fail
echo Something went wrong - send a screenshot of this window to Claude.
pause
exit /b 1
