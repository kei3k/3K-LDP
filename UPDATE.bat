@echo off
chcp 65001 >nul
title 3K-LDP AI Video Tool - Update tu GitHub

echo.
echo ========================================
echo   UPDATE TOOL TU GITHUB
echo ========================================
echo.

cd /d "%~dp0"

set BRANCH=claude/hardcore-payne-74b124
set REPO=kei3k/3K-LDP
set ZIP=%TEMP%\3K-LDP-update.zip
set EXTRACT=%TEMP%\3K-LDP-update

echo [1/5] Tai source moi tu GitHub...
powershell -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://codeload.github.com/%REPO%/zip/refs/heads/%BRANCH%' -OutFile '%ZIP%' -TimeoutSec 60"
if errorlevel 1 (
    echo [LOI] Tai zip that bai. Kiem tra ket noi mang.
    pause
    exit /b 1
)

echo [2/5] Giai nen tam...
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%"
powershell -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%EXTRACT%' -Force"
if errorlevel 1 (
    echo [LOI] Giai nen that bai.
    pause
    exit /b 1
)

REM Find the extracted subfolder (GitHub names it 3K-LDP-claude-hardcore-payne-74b124)
for /d %%i in ("%EXTRACT%\*") do set SRC=%%i

echo [3/5] Ap dung file moi (giu nguyen vertex-key.json + .env)...
REM Copy everything from extracted source to current folder, EXCEPT keys
robocopy "%SRC%" . /E /XF "vertex-key.json" ".env" /XD ".github" /R:1 /W:1 /NFL /NDL /NJH /NJS /NC /NS >nul

echo [4/5] Cap nhat dependencies...
call npm install
if errorlevel 1 (
    echo [CANH BAO] npm install loi nhung file da update. Thu chay lai sau.
)

echo [5/5] Don dep...
rmdir /s /q "%EXTRACT%" 2>nul
del "%ZIP%" 2>nul

echo.
echo ========================================
echo   UPDATE HOAN TAT!
echo ========================================
echo.
echo Chay START.bat de mo tool voi phien ban moi.
echo.
pause
