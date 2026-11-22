#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# JARVIS — ярьдаг горимоор асаах (ганц тушаал)
# ══════════════════════════════════════════════════════════════════
# Хоёр зүйлийг зэрэг асаана:
#   1. Дуу хоолойн сервер   — 127.0.0.1:7788
#   2. Вэб сервер           — localhost:5173
# Дараа нь чатыг браузерт нээнэ.
#
# Яагаад вэб серверээ локалаар асаадаг вэ:
#   Deploy хийсэн https:// хуудаснаас http://127.0.0.1 рүү хандахыг
#   браузер блоклодог. Тиймээс дуу хоолой зөвхөн localhost дээр гарна.
#
# Ажиллуулах:  cd ~/my-jarvis && ./jarvis-local.sh
# Зогсоох:     Ctrl+C  (хоёуланг нь зогсооно)

cd "$(dirname "$0")" || exit 1

VOICE_PORT="${JARVIS_VOICE_PORT:-7788}"
WEB_PORT="${JARVIS_WEB_PORT:-5173}"
VOICE_PID=""
WEB_PID=""

# ── Портыг эзэлсэн БИДНИЙ процессыг зогсооно ─────────────────────
# (өөр програм бол хөндөхгүй — анхааруулаад гарна)
free_port() {
  local port="$1" pattern="$2" label="$3"
  local pids ours p
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)
  [ -z "$pids" ] && return 0

  ours=""
  for p in $pids; do
    if ps -o command= -p "$p" 2>/dev/null | grep -q "$pattern"; then
      ours="$ours $p"
    fi
  done

  if [ -z "$ours" ]; then
    echo "  ✗ $port портыг ӨӨР програм эзэлж байна ($label биш):"
    ps -o pid=,command= -p $pids 2>/dev/null | sed 's/^/      /'
    return 1
  fi

  # shellcheck disable=SC2086
  kill $ours 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.3
    [ -z "$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)" ] && return 0
  done
  # shellcheck disable=SC2086
  kill -9 $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null) 2>/dev/null
  sleep 1
  return 0
}

cleanup() {
  echo ""
  echo "  Зогсоож байна…"
  [ -n "$VOICE_PID" ] && kill "$VOICE_PID" 2>/dev/null
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null
  wait 2>/dev/null
  echo "  Зогсов."
  exit 0
}
trap cleanup INT TERM

# ── Шалгалт ──────────────────────────────────────────────────────
if [ ! -x voice/.venv/bin/python ]; then
  echo ""
  echo "  ✗ voice/.venv олдсонгүй. Нэг удаа:"
  echo "      cd ~/my-jarvis/voice"
  echo "      python3 -m venv .venv && .venv/bin/pip install edge-tts"
  echo ""
  exit 1
fi

free_port "$VOICE_PORT" "server\.py" "дуу хоолойн сервер" || exit 1
free_port "$WEB_PORT" "http\.server" "вэб сервер" || exit 1

# ── 1. Дуу хоолойн сервер ────────────────────────────────────────
voice/.venv/bin/python -u voice/server.py &
VOICE_PID=$!

# ── 2. Вэб сервер ────────────────────────────────────────────────
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 > /dev/null 2>&1 &
WEB_PID=$!

# ── Хоёулаа боссон эсэхийг хүлээнэ ───────────────────────────────
ok_voice=0
ok_web=0
for _ in $(seq 1 25); do
  sleep 0.4
  [ "$ok_voice" = 0 ] && curl -s -m 2 "http://127.0.0.1:$VOICE_PORT/health" > /dev/null 2>&1 && ok_voice=1
  [ "$ok_web" = 0 ] && curl -s -m 2 -o /dev/null "http://localhost:$WEB_PORT/chat.html" && ok_web=1
  [ "$ok_voice" = 1 ] && [ "$ok_web" = 1 ] && break
done

echo ""
echo "  ─────────────────────────────────────────"
if [ "$ok_voice" = 1 ]; then
  echo "  ✓ Дуу хоолой : http://127.0.0.1:$VOICE_PORT"
else
  echo "  ✗ Дуу хоолой боссонгүй — дээрх алдааг хар"
fi
if [ "$ok_web" = 1 ]; then
  echo "  ✓ Вэб        : http://localhost:$WEB_PORT"
else
  echo "  ✗ Вэб сервер боссонгүй"
fi
echo "  ─────────────────────────────────────────"
echo ""
echo "  Чат   : http://localhost:$WEB_PORT/chat.html"
echo "  Студи : http://localhost:$WEB_PORT/voice.html"
echo ""
echo "  Чат дээр баруун дээд буланд байгаа 🔊 товчийг нэг удаа дар."
echo "  Зогсоох: Ctrl+C"
echo ""

if [ "$ok_web" = 1 ]; then
  open "http://localhost:$WEB_PORT/chat.html" 2>/dev/null
fi

wait
