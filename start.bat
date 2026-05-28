@echo off
chcp 65001 >nul
title 3K-LDP AI Video Tool - Dang chay...

echo.
echo ========================================
echo   3K-LDP AI VIDEO TOOL
echo ========================================
echo.

if not exist "node_modules" (
    echo [LOI] Chua cai dat. Hay chay INSTALL.bat truoc.
    echo.
    pause
    exit /b 1
)

echo Mo browser sau 3 giay...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo Tool dang chay. KHONG dong cua so nay khi su dung.
echo Khi muon thoat, an Ctrl+C trong cua so nay roi dong.
echo ----------------------------------------

call npm run dev
