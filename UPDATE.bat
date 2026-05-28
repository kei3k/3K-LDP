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

echo [0/6] Dung Vite dev server cu (neu dang chay)...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [1/6] Tai source moi tu GitHub (~1MB)...
del "%ZIP%" 2>nul
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://codeload.github.com/%REPO%/zip/refs/heads/%BRANCH%' -OutFile '%ZIP%' -TimeoutSec 60; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
    echo [LOI] Tai zip that bai. Kiem tra ket noi mang / firewall.
    pause
    exit /b 1
)
if not exist "%ZIP%" (
    echo [LOI] File zip khong duoc tai ve.
    pause
    exit /b 1
)
for %%A in ("%ZIP%") do echo       Da tai: %%~zA bytes

echo [2/6] Giai nen tam...
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%EXTRACT%' -Force"
if errorlevel 1 (
    echo [LOI] Giai nen that bai.
    pause
    exit /b 1
)

set SRC=
for /d %%i in ("%EXTRACT%\*") do set SRC=%%i
if "%SRC%"=="" (
    echo [LOI] Khong tim thay folder source sau khi giai nen.
    pause
    exit /b 1
)
echo       Source: %SRC%

echo [3/6] Ap dung file moi (giu nguyen vertex-key.json + .env)...
REM /MIR = mirror (force overwrite + delete extras). /XF preserves keys.
robocopy "%SRC%" . /MIR /XF "vertex-key.json" ".env" ".update_version" /XD ".github" "node_modules" "public\ffmpeg" /R:1 /W:1 /NP
set RC=%ERRORLEVEL%
if %RC% GEQ 8 (
    echo [LOI] Robocopy that bai voi exit code %RC%.
    pause
    exit /b 1
)

REM Bake commit hash from GitHub API into src/version.js so badge shows real version
REM (we have no .git folder, so vite.config.js can't run `git rev-parse`)
echo [3.5/6] Lay commit hash tu GitHub va bake vao version.js...
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { (Invoke-RestMethod -Uri 'https://api.github.com/repos/%REPO%/branches/%BRANCH%' -TimeoutSec 15).commit.sha.Substring(0,7) } catch { 'dev' }"') do set COMMIT_SHA=%%i
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set BUILD_DT=%%i
powershell -NoProfile -Command "(Get-Content src\version.js -Raw) -replace \": 'dev';\", \": '%COMMIT_SHA%';\" -replace \": new Date\\(\\)\\.toISOString\\(\\)\\.slice\\(0, 10\\);\", \": '%BUILD_DT%';\" | Set-Content -Path src\version.js -Encoding utf8"
echo       Da bake commit=%COMMIT_SHA% date=%BUILD_DT%

REM Verify the copy actually applied — read APP_VERSION from disk
for /f "tokens=2 delims='" %%a in ('findstr "APP_VERSION" src\version.js 2^>nul') do set APPLIED_VER=%%a
echo       Phien ban tren dia sau update: %APPLIED_VER% (%COMMIT_SHA%)

if not exist "src\lib\templates\template2_raw.html" (
    echo.
    echo [LOI NGHIEM TRONG] template2_raw.html bi mat. UPDATE that bai.
    echo   -^> Phuong an: tai zip moi tu anh Kei, giai nen DE LEN folder hien tai.
    pause
    exit /b 1
)

echo [4/6] Cap nhat dependencies (npm install)...
call npm install
if errorlevel 1 (
    echo [CANH BAO] npm install co loi. Tool van co the chay duoc.
)

echo [5/6] Luu version moi...
powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm' | Out-File -FilePath '.update_version' -Encoding utf8"

echo [6/6] Don dep...
rmdir /s /q "%EXTRACT%" 2>nul
del "%ZIP%" 2>nul

echo.
echo ========================================
echo   UPDATE HOAN TAT!
echo ========================================
echo.
echo Bay gio chay START.bat de mo tool voi phien ban moi.
echo.
pause
