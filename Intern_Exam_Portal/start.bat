@echo off
title InternAssess Portal Launcher
echo ============================================
echo   InternAssess Portal -- Starting Servers
echo ============================================
echo.

echo [1/2] Starting Backend (FastAPI on port 8000)...
start "InternAssess Backend" cmd /k "cd /d %~dp0backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo Waiting for backend to initialize...
timeout /t 4 /nobreak >nul

echo [2/2] Starting Frontend (Vite on port 5173)...
start "InternAssess Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   Servers are launching in separate windows!
echo.
echo   Admin Panel :  http://localhost:5173/admin/login
echo   API Docs    :  http://localhost:8000/docs
echo.
echo   Login with: admin / admin123
echo ============================================
echo.
echo You can close this window. The server windows
echo must stay open for the portal to work.
echo.
pause
