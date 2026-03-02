@echo off
title InternAssess BACKEND (Keep this open!)
color 0A
cd /d %~dp0backend
echo.
echo  ========================================
echo   InternAssess Backend Server
echo   http://localhost:8000
echo   http://localhost:8000/docs  (API Docs)
echo  ========================================
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
