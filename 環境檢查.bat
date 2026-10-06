@echo off
chcp 65001 >nul
REM 先切到自己所在的資料夾，而且一定要在 enabledelayedexpansion「之前」做。
REM 開了延遲展開之後，路徑裡的驚嘆號會被 cmd 吃掉 —— 例如
REM 「D:\創世神 World!\gesture-catcher」會變成找不到的「創世神 World」。
cd /d "%~dp0"
setlocal enabledelayedexpansion

title Aerocatch 環境檢查

set "REPORT=環境檢查結果.txt"
set "PROBE=8735"

echo.
echo   Aerocatch 環境檢查
echo   ------------------------------
echo   檢查中，大約 10 秒，請稍候...
echo.

call :check > "%REPORT%" 2>&1
type "%REPORT%"

echo.
echo   ------------------------------
echo   這份結果已存成「環境檢查結果.txt」，就在這個資料夾裡。
echo   把整份內容貼給 Claude 就能看出問題在哪。
echo.
pause
exit /b 0


:check
echo ==============================================
echo  Aerocatch 環境檢查報告
echo  時間：%DATE% %TIME%
REM 延遲展開會把路徑裡的驚嘆號吃掉，印出來會變成不存在的路徑，
REM 所以印這一行的時候暫時關掉它。
setlocal disabledelayedexpansion
echo  資料夾：%CD%
endlocal
echo ==============================================
echo.

echo [1] 作業系統
powershell -NoProfile -Command "$o=Get-CimInstance Win32_OperatingSystem; '    ' + $o.Caption + '  (版本 ' + $o.Version + ', ' + $o.OSArchitecture + ')'"
echo.

echo [2] PowerShell（沒有 Python 時就靠它當伺服器）
powershell -NoProfile -Command "'    [OK] PowerShell ' + $PSVersionTable.PSVersion.ToString()" 2>nul
if errorlevel 1 echo     [缺] 叫不出 PowerShell，這很不尋常，可能被資安政策鎖住
if exist "server.ps1" (
  echo     [OK] server.ps1 在
) else (
  echo     [缺] server.ps1 不見了，請重新完整下載一份遊戲
)
echo.

echo [3] Python（有的話會優先用，沒有也沒關係）
set "PY="
py -3 -c "import sys" >nul 2>&1 && set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>&1 && set "PY=python"
)
if defined PY (
  for /f "delims=" %%v in ('!PY! -V 2^>^&1') do echo     [OK] %%v   指令：!PY!
) else (
  echo     [無] 這台沒有可以執行的 Python
  echo          不影響，會自動改用上面那個 PowerShell 內建伺服器。
)
echo.

echo [4] 瀏覽器（手勢辨識在 Chrome 系跑最順）
set "HASBROWSER="
for %%B in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
  if not defined HASBROWSER if exist "%%~B" (
    echo     [OK] Chrome：%%~B
    set "HASBROWSER=1"
  )
)
if not defined HASBROWSER (
  for %%B in (
    "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
    "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  ) do (
    if not defined HASBROWSER if exist "%%~B" (
      echo     [OK] Edge：%%~B
      set "HASBROWSER=1"
    )
  )
)
if not defined HASBROWSER echo     [缺] 找不到 Chrome 或 Edge
echo.

echo [5] 遊戲檔案是否完整
set "MISSING="
call :needfile index.html
call :needfile app.js
call :needfile style.css
call :needfile public\vendor\mediapipe\hands\hands.js
call :needfile public\vendor\mediapipe\hands\hands_solution_simd_wasm_bin.wasm
call :needfile public\vendor\mediapipe\hands\hand_landmark_lite.tflite
call :needfile public\images\ship-main.webp
if not defined MISSING (
  echo     [OK] 關鍵檔案都在
) else (
  echo     [缺] 上面標示 [缺] 的檔案不見了
  echo          解法：重新完整下載一份，不要只複製部分檔案
)
echo.

echo [6] 連接埠 8734 是不是被別的程式佔走
netstat -an | findstr /c:"127.0.0.1:8734 " | findstr /i "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo     [注意] 已經有程式在用 8734
  echo            可能是先前開的伺服器還活著，關掉它或重開機即可
) else (
  echo     [OK] 8734 是空的
)
echo.

echo [7] 本機連線實測（這項最重要，直接重現「連不到 127.0.0.1」）
set "PROBESTARTED="
if defined PY (
  echo     測試方式：Python 伺服器
  start "envcheck-server" /min cmd /c "!PY! -m http.server %PROBE% --bind 127.0.0.1"
  set "PROBESTARTED=1"
) else (
  if exist "server.ps1" (
    echo     測試方式：PowerShell 內建伺服器
    start "envcheck-server" /min powershell -NoProfile -Command "$env:AEROCATCH_PORT='%PROBE%'; Invoke-Expression ([System.IO.File]::ReadAllText((Join-Path (Get-Location) 'server.ps1')))"
    set "PROBESTARTED=1"
  )
)
if defined PROBESTARTED (
  ping -n 5 127.0.0.1 >nul
  powershell -NoProfile -Command "try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PROBE%/index.html' -TimeoutSec 10; '    [OK] 連得上，收到 HTTP ' + $r.StatusCode + '，' + $r.RawContentLength + ' bytes'}catch{'    [失敗] 連不上本機伺服器'; '           原因：' + $_.Exception.Message; '           這通常是防毒／資安軟體擋掉本機連線，'; '           或公司電腦的網路政策限制 localhost。'}"
  taskkill /fi "WINDOWTITLE eq envcheck-server*" /t /f >nul 2>&1
) else (
  echo     [跳過] 沒有 Python 也沒有 server.ps1，無法測試
)
echo.

echo [8] 攝影機（遊戲靠它辨識手勢）
powershell -NoProfile -Command "$c = Get-PnpDevice -Class Camera,Image -ErrorAction SilentlyContinue ^| Where-Object { $_.Status -eq 'OK' }; if ($c) { foreach ($d in $c) { '    [OK] ' + $d.FriendlyName } } else { '    [注意] 找不到可用的攝影機裝置'; '           沒有鏡頭的話遊戲畫面會出現，但抓不到手勢' }"
echo.

echo ==============================================
echo  結論
echo ==============================================
if defined MISSING (
  echo   不能跑：遊戲檔案不完整，請重新完整下載一份
) else if not defined PROBESTARTED (
  echo   不能跑：沒有 Python，server.ps1 也不在，請重新完整下載一份
) else if not defined HASBROWSER (
  echo   可能有問題：找不到 Chrome 或 Edge，遊戲會用預設瀏覽器開。
  echo   如果手勢很卡，建議裝 Chrome。
) else (
  echo   基本條件都具備，直接點 啟動.bat 就能玩。
  echo   如果還是連不上，答案就在上面 [7] 那一項。
)
echo.
exit /b 0


:needfile
if exist "%~1" (
  echo     [OK] %~1
) else (
  echo     [缺] %~1
  set "MISSING=1"
)
exit /b 0
