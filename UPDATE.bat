@echo off
chcp 65001 >nul
title 3K-LDP AI Video Tool - Update tu GitHub

cd /d "%~dp0"

set BRANCH=claude/hardcore-payne-74b124
set REPO=kei3k/3K-LDP
set ZIP=%TEMP%\3K-LDP-update.zip
set EXTRACT=%TEMP%\3K-LDP-update
set LOG=%~dp0update-log.txt

REM Ghi log ra file de debug tu xa: friend gui file nay neu loi
echo ============================================ > "%LOG%"
echo UPDATE LOG - %DATE% %TIME% >> "%LOG%"
echo Working dir: %CD% >> "%LOG%"
echo Branch: %BRANCH% >> "%LOG%"
echo ============================================ >> "%LOG%"
echo. >> "%LOG%"

echo.
echo ========================================
echo   UPDATE TOOL TU GITHUB
echo ========================================
echo Log: %LOG%
echo.

echo [0/7] Dung Vite dev server + npm processes...
echo [0/7] Killing node processes... >> "%LOG%"
taskkill /F /IM node.exe >> "%LOG%" 2>&1
taskkill /F /IM npm.cmd >> "%LOG%" 2>&1
timeout /t 3 /nobreak >nul

echo [1/7] Tai source moi tu GitHub (~1MB)...
echo [1/7] Downloading zip... >> "%LOG%"
del "%ZIP%" 2>nul
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://codeload.github.com/%REPO%/zip/refs/heads/%BRANCH%' -OutFile '%ZIP%' -TimeoutSec 60; Write-Host 'Download OK' } catch { Write-Host ('Download FAIL: ' + $_.Exception.Message); exit 1 }" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [LOI] Tai zip that bai. Xem chi tiet trong %LOG%
    echo       Cau hinh mang / firewall / proxy co the chan codeload.github.com
    pause
    exit /b 1
)
if not exist "%ZIP%" (
    echo [LOI] File zip khong duoc tai ve. Xem %LOG%
    pause
    exit /b 1
)
for %%A in ("%ZIP%") do (
    echo       Da tai: %%~zA bytes
    echo       Zip size: %%~zA bytes >> "%LOG%"
)

echo [2/7] Giai nen tam...
echo [2/7] Extracting... >> "%LOG%"
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%EXTRACT%' -Force" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [LOI] Giai nen that bai. Xem %LOG%
    pause
    exit /b 1
)

set SRC=
for /d %%i in ("%EXTRACT%\*") do set SRC=%%i
if "%SRC%"=="" (
    echo [LOI] Khong tim thay folder source sau khi giai nen.
    echo       Extract failed - no subfolder found >> "%LOG%"
    pause
    exit /b 1
)
echo       Source: %SRC%
echo       Extracted to: %SRC% >> "%LOG%"

REM PRE-FLIGHT: source phai DAY DU truoc khi dung vao folder hien tai
if not exist "%SRC%\src\lib\templates\template2_raw.html" goto :src_incomplete
if not exist "%SRC%\vite.config.js" goto :src_incomplete
if not exist "%SRC%\package.json" goto :src_incomplete
goto :src_ok
:src_incomplete
echo [LOI] Source tai ve bi THIEU FILE (tai loi / mang chan).
echo       Folder hien tai KHONG bi thay doi. Chay lai UPDATE hoac tai zip moi.
echo CRITICAL: source incomplete, aborting before touching dest >> "%LOG%"
pause
exit /b 1
:src_ok

echo [3/7] Tat thuoc tinh read-only (neu co)...
attrib -R -S -H "src\*" /S /D >nul 2>&1
attrib -R -S -H "scripts\*" /S /D >nul 2>&1

echo [4/7] Ap dung file moi (ghi de, GIU file cu - khong xoa)...
echo [4/7] Robocopy /E (additive, no delete)... >> "%LOG%"
REM /E = copy ke ca thu muc rong, GHI DE nhung KHONG xoa file thua (an toan,
REM khong bao gio mat file). /R:3 retry, /W:2 wait.
robocopy "%SRC%" . /E /XF "vertex-key.json" ".env" ".update_version" "update-log.txt" /XD ".github" "node_modules" "public\ffmpeg" /R:3 /W:2 /NP >> "%LOG%" 2>&1
set RC=%ERRORLEVEL%
echo       Robocopy exit code: %RC% >> "%LOG%"
if %RC% GEQ 8 (
    echo [LOI] Robocopy that bai voi exit code %RC%. Xem %LOG%
    echo       File co the dang bi khoa - dong tat ca cua so Tool roi thu lai.
    pause
    exit /b 1
)
echo       Robocopy OK (exit code %RC% - 0..7 la binh thuong)

echo [5/7] Lay commit hash tu GitHub va bake vao version.js...
echo [5/7] Baking commit hash... >> "%LOG%"
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { (Invoke-RestMethod -Uri 'https://api.github.com/repos/%REPO%/branches/%BRANCH%' -TimeoutSec 15).commit.sha.Substring(0,7) } catch { 'dev' }"') do set COMMIT_SHA=%%i
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set BUILD_DT=%%i
echo       Got SHA: %COMMIT_SHA% Date: %BUILD_DT% >> "%LOG%"
powershell -NoProfile -Command "$f='src\version.js'; if (Test-Path $f) { $c = Get-Content $f -Raw; $c = $c -replace \": 'dev';\", \": '%COMMIT_SHA%';\"; $c = $c -replace \": 'dev'\;`r`n\", \": '%COMMIT_SHA%';`r`n\"; $c = $c -replace \": new Date\\(\\)\\.toISOString\\(\\)\\.slice\\(0, 10\\);\", \": '%BUILD_DT%';\"; Set-Content -Path $f -Value $c -Encoding utf8 -NoNewline; Write-Host 'Baked OK' } else { Write-Host 'version.js NOT FOUND' }" >> "%LOG%" 2>&1
echo       Da bake commit=%COMMIT_SHA% date=%BUILD_DT%

REM Verify
for /f "tokens=2 delims='" %%a in ('findstr "APP_VERSION" src\version.js 2^>nul') do set APPLIED_VER=%%a
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "(Select-String -Path src\version.js -Pattern 'BUILD_COMMIT.*:.*''([a-f0-9]+)''' | Select-Object -First 1).Matches.Groups[1].Value"') do set DISK_SHA=%%a
echo       Phien ban tren dia: v%APPLIED_VER% commit=%DISK_SHA%
echo       Verified on disk: APP_VERSION=%APPLIED_VER% BUILD_COMMIT=%DISK_SHA% >> "%LOG%"

if not exist "src\lib\templates\template2_raw.html" (
    echo.
    echo [LOI NGHIEM TRONG] template2_raw.html bi mat. UPDATE that bai.
    echo   -^> Phuong an: tai zip moi tu anh Kei, giai nen DE LEN folder hien tai.
    echo CRITICAL: template2_raw.html missing >> "%LOG%"
    pause
    exit /b 1
)

echo [6/7] Cap nhat dependencies (npm install)...
echo [6/7] npm install >> "%LOG%"
call npm install >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [CANH BAO] npm install co loi - xem %LOG%
)

echo [7/7] Xoa cache Vite + don dep...
echo [7/7] Clearing vite cache + cleanup >> "%LOG%"
REM Vite cache giu bundle CU - phai xoa de bundle moi co the lay tu source moi
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite" 2>nul
if exist ".vite" rmdir /s /q ".vite" 2>nul
powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm' | Out-File -FilePath '.update_version' -Encoding utf8"
rmdir /s /q "%EXTRACT%" 2>nul
del "%ZIP%" 2>nul
echo [7/7] Cleanup done. SUCCESS. >> "%LOG%"

echo.
echo ========================================
echo   UPDATE HOAN TAT! v%APPLIED_VER% (%DISK_SHA%)
echo ========================================
echo.
echo Bay gio chay START.bat de mo tool voi phien ban moi.
echo NEU BADGE VAN SHOW VERSION CU: dong tab browser, hard refresh Ctrl+Shift+R
echo Log debug: %LOG%
echo.
pause
