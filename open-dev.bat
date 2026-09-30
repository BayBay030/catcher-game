@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "HOST=127.0.0.1"
if "%PORT%"=="" set "PORT=5173"
set "URL=http://%HOST%:%PORT%/index.html"

REM This game runs MediaPipe hand tracking. Chromium's WASM SIMD / WebGL path is
REM a good deal faster than the alternatives, so Chrome is preferred, and Edge --
REM also Chromium, and shipped with Windows -- is the fallback.
REM To force one:   set "BROWSER_APP=C:\path\to\browser.exe"   then run this file.

REM Python is "python" on Windows, but the py launcher is the reliable one.
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY ( where python >nul 2>&1 && set "PY=python" )
if not defined PY (
  echo Python 3 is required to start the local development server.
  echo Install it from https://www.python.org/downloads/
  echo ^(tick "Add python.exe to PATH" during setup^), then run this file again.
  echo.
  pause
  exit /b 1
)

REM Is something already serving on this port? The trailing space matters --
REM without it, port 5173 also matches 51730.
netstat -an | findstr /c:"%HOST%:%PORT% " | findstr /i "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo A server is already running on %URL%
  call :open_url
  echo.
  pause
  exit /b 0
)

echo Starting local development server...
echo Opening %URL%

start "aerocatch-server" /min cmd /c "%PY% -m http.server %PORT% --bind %HOST%"

REM Give the server a moment before pointing a browser at it.
ping -n 3 127.0.0.1 >nul

call :open_url

echo.
echo Development server is running.
echo Keep this window open while playing. Close it to stop the server.
echo.
pause

taskkill /fi "WINDOWTITLE eq aerocatch-server*" /t /f >nul 2>&1
exit /b 0


:open_url
REM Probing real install paths rather than "start chrome": start does not set
REM errorlevel dependably in a batch file, so a missing browser would look like
REM a success and no window would ever appear.
if defined BROWSER_APP if exist "%BROWSER_APP%" (
  start "" "%BROWSER_APP%" "%URL%"
  echo Opened with %BROWSER_APP%.
  exit /b 0
)

for %%B in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
  if exist "%%~B" (
    start "" "%%~B" "%URL%"
    echo Opened with Chrome.
    exit /b 0
  )
)
echo Chrome not found, trying Edge.

for %%B in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do (
  if exist "%%~B" (
    start "" "%%~B" "%URL%"
    echo Opened with Edge.
    exit /b 0
  )
)

echo Edge not found, falling back to the default browser.
start "" "%URL%"
exit /b 0
