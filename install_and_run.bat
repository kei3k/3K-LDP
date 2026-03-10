@echo off
chcp 65001 >nul
title LDP Generator - Cai dat va Khoi chay

echo.
echo  ========================================
echo    LDP Generator - Landing Page Clone
echo    Clone va Localize Landing Pages with AI
echo  ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [LOI] Node.js chua duoc cai dat!
    echo  Tai Node.js tai: https://nodejs.org/
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -v') do echo  [OK] Node.js %%v

if not exist "node_modules\" (
    echo.
    echo  [1/2] Dang cai dat thu vien...
    call npm install
    if %errorlevel% neq 0 (
        echo  [LOI] Cai dat that bai!
        pause
        exit /b 1
    )
    echo  [OK] Cai dat thanh cong!
) else (
    echo  [OK] Thu vien da co san
)

echo.
echo  [2/2] Dang khoi chay...
echo  Mo trinh duyet tai: http://localhost:5173
echo.

call npm run dev
