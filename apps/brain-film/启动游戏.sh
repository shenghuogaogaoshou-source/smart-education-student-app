#!/usr/bin/env bash
# 脑洞放映厅 · 启动器(git-bash / WSL / macOS)
set -u
cd "$(dirname "$0")"
PORT="${BH_PORT:-8765}"

if curl -s -o /dev/null --max-time 3 "http://127.0.0.1:${PORT}/api/health"; then
  echo "[1/2] 后端已在运行"
else
  echo "[1/2] 启动后端 server.py(端口 ${PORT})…"
  if [ "${BH_LAN:-}" = "1" ]; then
    (python server.py --port "$PORT" --lan >/dev/null 2>&1 &)
  elif [ "${BH_NO_AI:-}" = "1" ]; then
    (python server.py --port "$PORT" --no-ai >/dev/null 2>&1 &)
  else
    (python server.py --port "$PORT" >/dev/null 2>&1 &)
  fi
  for _ in $(seq 1 30); do
    sleep 0.5
    curl -s -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/api/health" && break
  done
fi

URL="http://127.0.0.1:${PORT}/"
echo "[2/2] 打开 ${URL}"
if [ "${BH_DRYRUN:-}" = "1" ]; then echo "[DRYRUN] $URL"; exit 0; fi
if command -v cmd.exe >/dev/null 2>&1; then powershell -NoProfile -Command "Start-Process '$URL'"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
elif command -v open >/dev/null 2>&1; then open "$URL"
else echo "请手动打开:$URL"; fi
