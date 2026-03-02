@echo off
title InternAssess FRONTEND (Keep this open!)
color 0B
cd /d %~dp0frontend
echo.
echo  ========================================
echo   InternAssess Frontend Server
echo   http://localhost:5173/admin/login
echo  ========================================
echo.
npm run dev
pause
