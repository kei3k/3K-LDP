@echo off
chcp 65001 >nul
title Reset Cache - Quick Fix

cd /d "%~dp0"

echo.
echo ========================================
echo   RESET CACHE - Quick Fix
echo ========================================
echo.

echo [1/3] Dung Vite dev server cu (neu dang chay)...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM npm.cmd >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Xoa cache Vite (bundle CU bi giu o day)...
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"
if exist ".vite" rmdir /s /q ".vite"
echo       Done.

echo [3/3] Hoan tat.
echo.
echo ========================================
echo   RESET XONG
echo ========================================
echo.
echo Bay gio:
echo   1. Double-click START.bat de chay lai tool
echo   2. Trong browser, bam Ctrl+Shift+R de hard refresh
echo   3. Kiem tra badge o goc phai - phai hien version moi
echo.
pause
