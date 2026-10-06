# 最小靜態檔案伺服器，只用 Windows 內建的 PowerShell，不需要安裝任何東西。
#
# 為什麼需要伺服器：這個遊戲不能用 file:// 直接開。瀏覽器會擋掉
# WASM（手勢辨識模型）和字體的載入，畫面會出來但手勢完全沒反應。
#
# 為什麼用 TcpListener 而不是 HttpListener：HttpListener 要先向系統
# 註冊網址（netsh urlacl），沒有管理員權限會直接被拒。TcpListener
# 綁 127.0.0.1 不需要任何權限。

$ErrorActionPreference = 'Stop'

if ($PSScriptRoot) {
  $root = [System.IO.Path]::GetFullPath($PSScriptRoot)
} else {
  $root = [System.IO.Path]::GetFullPath((Get-Location).Path)
}
# 結尾補斜線，否則隔壁同名開頭的資料夾會被誤判成在遊戲資料夾內
$sep = [System.IO.Path]::DirectorySeparatorChar
$rootPrefix = $root.TrimEnd($sep) + $sep
$port = if ($env:AEROCATCH_PORT) { [int]$env:AEROCATCH_PORT } else { 8734 }

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.wasm' = 'application/wasm'
  '.webp' = 'image/webp'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.ico'  = 'image/x-icon'
  '.woff2'= 'font/woff2'
  '.woff' = 'font/woff'
  '.ttf'  = 'font/ttf'
  '.mp3'  = 'audio/mpeg'
  '.wav'  = 'audio/wav'
  '.ogg'  = 'audio/ogg'
}

try {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
  $listener.Start()
} catch {
  Write-Host ''
  Write-Host "  伺服器啟動失敗：$($_.Exception.Message)"
  Write-Host ''
  Write-Host '  如果寫的是「通訊端位址只能使用一次」，代表 8734 被別的程式佔走了。'
  Write-Host '  其他錯誤多半是防毒或資安軟體擋掉本機連線。'
  Write-Host ''
  Read-Host '  按 Enter 關閉'
  exit 1
}

Write-Host ''
Write-Host "  伺服器已啟動：http://127.0.0.1:$port/"
Write-Host '  這個視窗要留著，關掉遊戲就斷線了。'
Write-Host ''

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.NoDelay = $true
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000

    # 讀第一行（GET /路徑 HTTP/1.1）就夠了，剩下的標頭讀掉丟棄，
    # 不讀完的話瀏覽器那端會看到連線被硬切。
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    while ($true) {
      $h = $reader.ReadLine()
      if ($null -eq $h -or $h -eq '') { break }
    }

    if (-not $requestLine) { continue }

    $parts = $requestLine -split ' '
    $urlPath = ($parts[1] -split '\?')[0]
    $urlPath = [System.Uri]::UnescapeDataString($urlPath)
    if ($urlPath -eq '/' -or $urlPath -eq '') { $urlPath = '/index.html' }

    $relative = $urlPath.TrimStart('/').Replace('/', '\')
    $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relative))

    $status = '200 OK'
    $body = $null
    $type = 'application/octet-stream'

    # 請求不准跳出遊戲資料夾
    if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      $status = '403 Forbidden'
      $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
      $type = 'text/plain; charset=utf-8'
    } elseif (-not [System.IO.File]::Exists($target)) {
      $status = '404 Not Found'
      $body = [System.Text.Encoding]::UTF8.GetBytes('Not found: ' + $urlPath)
      $type = 'text/plain; charset=utf-8'
    } else {
      $body = [System.IO.File]::ReadAllBytes($target)
      $ext = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
      if ($mime.ContainsKey($ext)) { $type = $mime[$ext] }
    }

    $head = "HTTP/1.1 $status`r`n" +
            "Content-Type: $type`r`n" +
            "Content-Length: $($body.Length)`r`n" +
            "Cache-Control: no-store`r`n" +
            "Connection: close`r`n`r`n"
    $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)

    $stream.Write($headBytes, 0, $headBytes.Length)
    if ($parts[0] -ne 'HEAD' -and $body.Length -gt 0) {
      $stream.Write($body, 0, $body.Length)
    }
    $stream.Flush()
  } catch {
    # 瀏覽器常常先關連線（例如使用者重新整理），這不是錯誤，不用吵。
  } finally {
    if ($client) { try { $client.Close() } catch { } }
  }
}
