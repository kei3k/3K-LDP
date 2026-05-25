@echo off
chcp 65001 >nul
title 3K-LDP AI Video Tool - Cai dat lan dau

echo.
echo ========================================
echo   CAI DAT TOOL AI VIDEO (1 lan duy nhat)
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Chua co Node.js tren may.
    echo.
    echo Vui long cai Node.js v18+ tu: https://nodejs.org/
    echo Sau do chay lai INSTALL.bat nay.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js da co.
node --version
echo.

echo Dang cai dat dependencies (mat khoang 2-3 phut, vui long cho)...
echo.

call npm install
if errorlevel 1 (
    echo.
    echo [LOI] npm install that bai. Kiem tra ket noi mang va thu lai.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   CAI DAT HOAN TAT!
echo ========================================
echo.
echo Tu lan sau, chi can double-click START.bat de chay tool.
echo.
pause
