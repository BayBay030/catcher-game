#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

HOST="127.0.0.1"
PORT="${PORT:-5173}"
URL="http://${HOST}:${PORT}/index.html"

# 這個遊戲跑的是 MediaPipe 手勢辨識，Chromium 的 WASM SIMD / WebGL 路徑比
# Safari 快上不少，所以預設開 Chrome，Safari 只是備援。
# 要指定其他瀏覽器： BROWSER_APP="Safari" ./open-dev.command
open_url() {
  # 明確指定的優先，其餘依序退讓
  for app in ${BROWSER_APP:+"$BROWSER_APP"} "Google Chrome" "Safari"; do
    if open -a "$app" "${URL}" 2>/dev/null; then
      echo "已用 $app 開啟。"
      return 0
    fi
    echo "找不到 $app，換下一個。"
  done
  echo "改用系統預設瀏覽器開啟。"
  open "${URL}"
}

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to start the local development server."
  echo "Install Python 3, then run this command again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if lsof -PiTCP:"${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "A server is already running on ${URL}"
  open_url
  read -r -p "Press Enter to close..."
  exit 0
fi

echo "Starting local development server..."
echo "Opening ${URL}"

python3 -m http.server "${PORT}" --bind "${HOST}" &
SERVER_PID=$!

cleanup() {
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 1
open_url

echo
echo "Development server is running."
echo "Keep this window open while developing. Press Control-C to stop."

wait "${SERVER_PID}"
