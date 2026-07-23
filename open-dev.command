#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

HOST="127.0.0.1"
PORT="${PORT:-5173}"
URL="http://${HOST}:${PORT}/index.html"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to start the local development server."
  echo "Install Python 3, then run this command again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if lsof -PiTCP:"${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "A server is already running on ${URL}"
  open "${URL}"
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
open "${URL}"

echo
echo "Development server is running."
echo "Keep this window open while developing. Press Control-C to stop."

wait "${SERVER_PID}"
