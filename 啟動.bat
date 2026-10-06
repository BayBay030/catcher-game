@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Aerocatch 飛船秘寶 - 遊戲伺服器

set "HOST=127.0.0.1"
set "PORT=8734"
set "URL=http://%HOST%:%PORT%/index.html"

echo.
echo   Aerocatch 飛船秘寶
echo   ------------------------------
echo.

REM 找 Python。Windows 上 python3 是微軟商店的假捷徑，不能用。
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY (
  where python >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo   找不到 Python，遊戲需要它才能開。
  echo   到 https://www.python.org/downloads/ 下載安裝，
  echo   安裝時記得勾「Add python.exe to PATH」，裝完再點一次這個檔案。
  echo.
  pause
  exit /b 1
)

REM 已經有伺服器在跑就不要再開一個（結尾空格很重要，不然 8734 會誤判成 87340）
netstat -an | findstr /c:"%HOST%:%PORT% " | findstr /i "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo   伺服器已經在跑了，直接開遊戲。
  call :open_browser
  echo.
  pause
  exit /b 0
)

echo   正在啟動遊戲伺服器...
start "aerocatch-server" /min cmd /c "%PY% -m http.server %PORT% --bind %HOST%"

REM 等伺服器站穩再開瀏覽器
ping -n 3 127.0.0.1 >nul

call :open_browser

echo.
echo   遊戲開好了，記得允許瀏覽器使用攝影機。
echo   ------------------------------
echo   玩的時候這個黑視窗不要關。
echo   玩完了按任意鍵，伺服器就會關掉。
echo.
pause >nul

taskkill /fi "WINDOWTITLE eq aerocatch-server*" /t /f >nul 2>&1
exit /b 0


:open_browser
REM 這遊戲靠 MediaPipe 做手勢辨識，Chrome 系的瀏覽器跑最順，所以優先找 Chrome。
for %%B in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
  if exist "%%~B" (
    start "" "%%~B" "%URL%"
    echo   已用 Chrome 開啟。
    exit /b 0
  )
)

for %%B in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do (
  if exist "%%~B" (
    start "" "%%~B" "%URL%"
    echo   已用 Edge 開啟。
    exit /b 0
  )
)

start "" "%URL%"
echo   已用預設瀏覽器開啟。
exit /b 0
