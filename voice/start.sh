#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# JARVIS VOICE — локал TTS серверийг асаана
# ══════════════════════════════════════════════════════════════════
# Порт эзэлсэн хуучин сервер байвал өөрөө зогсоогоод дахин асаана.
cd "$(dirname "$0")" || exit 1

PORT="${JARVIS_VOICE_PORT:-7788}"

# ── Порт эзэлсэн эсэх ────────────────────────────────────────────
PIDS=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null)

if [ -n "$PIDS" ]; then
  # Энэ бидний сервер мөн үү? (өөр програмыг санамсаргүй устгахгүй)
  OURS=""
  for p in $PIDS; do
    if ps -o command= -p "$p" 2>/dev/null | grep -q "server\.py"; then
      OURS="$OURS $p"
    fi
  done

  if [ -n "$OURS" ]; then
    echo "  ⟳ $PORT порт дээрх хуучин серверийг зогсоож байна (PID:$OURS)"
    # shellcheck disable=SC2086
    kill $OURS 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      sleep 0.3
      [ -z "$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null)" ] && break
    done
    # Сайнаар зогсохгүй бол хүчээр
    STILL=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$STILL" ]; then
      # shellcheck disable=SC2086
      kill -9 $STILL 2>/dev/null
      sleep 1
    fi
  else
    echo ""
    echo "  ✗ $PORT портыг ӨӨР програм эзэлж байна (PID: $PIDS):"
    ps -o pid=,command= -p $PIDS 2>/dev/null | sed 's/^/      /'
    echo ""
    echo "    Тэр програмыг зогсоо, эсвэл өөр порт дээр асаа:"
    echo "      JARVIS_VOICE_PORT=$((PORT + 1)) ./start.sh"
    echo "    (өөр порт сонговол jarvis-voice.js доторх SERVER хаягийг ч засна)"
    echo ""
    exit 1
  fi
fi

# ── venv байгаа эсэх ─────────────────────────────────────────────
if [ ! -x .venv/bin/python ]; then
  echo ""
  echo "  ✗ .venv олдсонгүй. Нэг удаа дараах тушаалыг ажиллуул:"
  echo "      cd ~/my-jarvis/voice"
  echo "      python3 -m venv .venv && .venv/bin/pip install edge-tts"
  echo ""
  exit 1
fi

exec .venv/bin/python server.py
