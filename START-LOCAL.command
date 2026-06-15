#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT=4177
echo "Mission2026 Study Hub local server starting..."
echo "Open this URL in browser: http://127.0.0.1:${PORT}"
python3 -m http.server "${PORT}" --bind 127.0.0.1
