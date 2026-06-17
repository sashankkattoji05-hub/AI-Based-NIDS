@echo off
title Sentinel NIDS - Full Stack Launcher
echo =======================================================
echo     Sentinel NIDS: Launching Full-Stack Application
echo =======================================================
echo.

:: 1. Start the FastAPI Backend in a new terminal window
echo [*] Starting FastAPI Backend on Port 8000...
start "Sentinel NIDS - Backend API" cmd /k "python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"

:: Wait 3 seconds to let the backend DB & ML model load
echo [*] Waiting for backend services to load...
timeout /t 3 >nul

:: 2. Start the Vite Frontend in a new terminal window
echo [*] Starting Vite Frontend on Port 3000...
start "Sentinel NIDS - Frontend UI" cmd /k "cd frontend && npm.cmd run dev"

:: Wait 1 second
timeout /t 1 >nul

:: 3. Automatically open the browser to the web cockpit
echo [*] Opening Dashboard in your browser...
start http://localhost:3000/

echo.
echo =======================================================
echo   SUCCESS: Both servers are starting up!
echo   ⚠️ Keep the two newly opened command windows running.
echo   Press any key to close this launcher.
echo =======================================================
pause >nul
