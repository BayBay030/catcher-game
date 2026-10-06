@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Aerocatch 飛船秘寶 - 遊戲伺服器

set "HOST=127.0.0.1"
set "PORT=8734"
set "URL=http://%HOST%:%PORT%/index.html"

echo.
echo   Aerocatch 飛船秘寶
echo   ------------------------------
echo.

REM 找「真的跑得起來」的 Python。
REM 只檢查檔案在不在是不夠的：Windows 上常常留著 py.exe 卻沒裝任何 Python
REM 版本，而 python.exe 可能是微軟商店的空捷徑，一執行只會跳出商店。
REM 所以這裡直接叫它跑一行程式，跑得過才算數。
set "PY="
py -3 -c "import sys" >nul 2>&1 && set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>&1 && set "PY=python"
)

if not defined PY (
  echo   [問題] 這台電腦沒有可以用的 Python，伺服器起不來。
  echo.
  echo   到 https://www.python.org/downloads/ 下載安裝，
  echo   安裝畫面第一頁記得勾「Add python.exe to PATH」，
  echo   裝完再點一次這個檔案。
  echo.
  pause
  exit /b 1
)
echo   Python 檢查通過：%PY%

REM 已經有伺服器在跑就不要再開一個（結尾空格很重要，不然 8734 會誤判成 87340）
netstat -an | findstr /c:"%HOST%:%PORT% " | findstr /i "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo   伺服器已經在跑了，直接開遊戲。
  call :open_browser
  echo.
  pause
  exit /b 0
)

echo   正在啟動伺服器...

REM 這個視窗故意不最小化、也故意用 /k 讓它留著：伺服器萬一掛掉，
REM 錯誤訊息要看得見，不然只會變成「瀏覽器連不上」而查不出原因。
start "aerocatch-server" cmd /k "%PY% -m http.server %PORT% --bind %HOST%"

REM 等到真的連得上再開瀏覽器，最多等 10 秒。
set "READY="
for /l %%i in (1,1,10) do (
  if not defined READY (
    powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('%HOST%',%PORT%);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
    if not errorlevel 1 (
      set "READY=1"
    ) else (
      ping -n 2 127.0.0.1 >nul
    )
  )
)

if not defined READY (
  echo.
  echo   [問題] 伺服器沒起來，所以瀏覽器連不到 %HOST%:%PORT%
  echo.
  echo   旁邊那個標題是 aerocatch-server 的視窗裡會有錯誤訊息，
  echo   那行字就是真正的原因，把它告訴我就能修。
  echo.
  echo   常見狀況：防毒／資安軟體擋掉本機連線，或這個埠被別的程式佔走。
  echo.
  pause
  exit /b 1
)

echo   伺服器已就緒。
call :open_browser

echo.
echo   遊戲開好了，記得允許瀏覽器使用攝影機。
echo   ------------------------------
echo   玩的時候這個視窗和 aerocatch-server 視窗都不要關。
echo   玩完了按任意鍵，伺服器就會收掉。
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
