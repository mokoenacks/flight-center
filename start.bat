@echo off
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing Flight Desk, one time...
  call npm install
  if errorlevel 1 (
    echo Install failed.
    pause
    exit /b 1
  )
)
echo Opening Flight Desk in your browser...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173"
npm run dev
