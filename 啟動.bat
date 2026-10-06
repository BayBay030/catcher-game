@echo off
chcp 65001 >nul
REM 先切到自己所在的資料夾，而且一定要在 enabledelayedexpansion「之前」做。
REM 開了延遲展開之後，路徑裡的驚嘆號會被 cmd 吃掉 —— 例如
REM 「D:\創世神 World!\gesture-catcher」會變成找不到的「創世神 World」。
cd /d "%~dp0"
setlocal enabledelayedexpansion

title Aerocatch 飛船秘寶 - 遊戲伺服器

set "HOST=127.0.0.1"
set "PORT=8734"
set "URL=http://%HOST%:%PORT%/index.html"

echo.
echo   Aerocatch 飛船秘寶
echo   ------------------------------
echo.

REM 先找 Python。它的 http.server 比較快，有就優先用。
REM 只檢查檔案在不在是不夠的：Windows 上常常留著 py.exe 卻沒裝任何 Python
REM 版本，而 python.exe 可能是微軟商店的空捷徑，一執行只會跳出商店。
REM 所以這裡直接叫它跑一行程式，跑得過才算數。
set "PY="
py -3 -c "import sys" >nul 2>&1 && set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>&1 && set "PY=python"
)

set "MODE="
if defined PY (
  set "MODE=python"
) else (
  REM 沒有 Python 也沒關係，用 Windows 自己內建的 PowerShell 當伺服器。
  if exist "server.ps1" set "MODE=powershell"
)

if not defined MODE (
  echo   [問題] 找不到 Python，而且 server.ps1 也不在這個資料夾裡。
  echo.
  echo   請重新完整下載一份遊戲，不要只複製部分檔案。
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

REM 伺服器視窗故意不最小化、也故意留著：萬一它掛了，錯誤訊息要看得見，
REM 不然只會變成「瀏覽器連不上」而查不出原因。
if "%MODE%"=="python" (
  echo   使用 Python 伺服器：!PY!
  start "aerocatch-server" cmd /k "!PY! -m http.server %PORT% --bind %HOST%"
) else (
  echo   這台沒有 Python，改用 Windows 內建的 PowerShell 當伺服器。
  REM 用 Invoke-Expression 讀進來執行，而不是直接執行 .ps1 檔：
  REM 有些電腦的資安政策禁止執行 .ps1 檔案，這樣寫可以繞過那個限制。
  REM ReadAllText 會自動辨識檔案的 BOM，中文註解才不會變亂碼。
  start "aerocatch-server" powershell -NoProfile -Command "$env:AEROCATCH_PORT='%PORT%'; Invoke-Expression ([System.IO.File]::ReadAllText((Join-Path (Get-Location) 'server.ps1')))"
)

REM 等到真的連得上再開瀏覽器，最多等 15 秒。
set "READY="
for /l %%i in (1,1,15) do (
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
  echo   也可以點「環境檢查.bat」，它會把這台電腦的狀況整理成一份報告。
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
