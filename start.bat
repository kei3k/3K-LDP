@echo off
chcp 65001 >nul 2>&1
title LDP Generator
cd /d "%~dp0"

echo.
echo  ========================================
echo   LDP Generator - Landing Page A/B Test
echo  ========================================
echo.

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [LOI] Khong tim thay npm. Hay cai dat Node.js truoc!
    echo  Tai ve tai: https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo  Dang cai dat dependencies lan dau...
    call npm install
    echo.
)

echo  Dang khoi dong... (Ctrl+C de dung)
echo.
call npm run dev
pause
