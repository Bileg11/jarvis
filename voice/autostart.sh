#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# JARVIS — компьютер асахад өөрөө ажилладаг болгох / болиулах
# ══════════════════════════════════════════════════════════════════
# Суулгах:  ./voice/autostart.sh on
# Болиулах: ./voice/autostart.sh off
# Төлөв:    ./voice/autostart.sh status
#
# Юу хийдэг вэ:
#   macOS-ийн LaunchAgent үүсгэнэ. Чи нэвтрэх бүрд дуу хоолойн сервер
#   ба вэб сервер чимээгүйхэн асна. Терминал нээх шаардлагагүй.
#
# Хаана байрлах вэ:
#   ~/Library/LaunchAgents/com.bileg.jarvis.plist
#
# Энэ нь зөвхөн ЧИНИЙ хэрэглэгчийн дотор ажиллана. Системийн тохиргоо
# өөрчлөхгүй, администраторын нууц үг шаардахгүй. "off" гэвэл бүрэн арилна.

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.bileg.jarvis"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$REPO/voice/autostart.log"

usage() {
  echo ""
  echo "  Хэрэглэх:"
  echo "    ./voice/autostart.sh on       — нэвтрэх бүрд өөрөө асна"
  echo "    ./voice/autostart.sh off      — болиулж, файлыг арилгана"
  echo "    ./voice/autostart.sh status   — одоогийн төлөв"
  echo ""
}

case "${1:-}" in
# ── АСААХ ────────────────────────────────────────────────────────
on)
  mkdir -p "$HOME/Library/LaunchAgents"

  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO/jarvis-local.sh</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$REPO</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>JARVIS_NO_OPEN</key>
    <string>1</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
</dict>
</plist>
PLISTEOF

  plutil -lint "$PLIST" > /dev/null

  # Хуучин байвал эхлээд буулгана
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"

  echo ""
  echo "  ✓ Суулгалаа. Одооноос нэвтрэх бүрд өөрөө асна."
  echo ""
  echo "    Чат   : http://localhost:5173/chat.html"
  echo "    Студи : http://localhost:5173/voice.html"
  echo ""
  echo "    Лог      : $LOG"
  echo "    Болиулах : ./voice/autostart.sh off"
  echo ""
  ;;

# ── БОЛИУЛАХ ─────────────────────────────────────────────────────
off)
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo ""
  echo "  ✓ Болиулж, $PLIST файлыг устгалаа."
  echo "    Ажиллаж байгаа серверүүд зогссон."
  echo "    Гараар асаах: ./jarvis-local.sh"
  echo ""
  ;;

# ── ТӨЛӨВ ────────────────────────────────────────────────────────
status)
  echo ""
  if [ -f "$PLIST" ]; then
    echo "  LaunchAgent : суулгасан ($PLIST)"
  else
    echo "  LaunchAgent : суулгаагүй"
  fi
  if launchctl print "gui/$(id -u)/$LABEL" > /dev/null 2>&1; then
    echo "  launchd     : ачаалагдсан"
  else
    echo "  launchd     : ачаалагдаагүй"
  fi
  printf "  Дуу хоолой  : "
  curl -s -m 3 http://127.0.0.1:7788/health > /dev/null 2>&1 \
    && echo "ажиллаж байна (7788)" || echo "унтарсан"
  printf "  Вэб         : "
  curl -s -m 3 -o /dev/null http://localhost:5173/chat.html 2>/dev/null \
    && echo "ажиллаж байна (5173)" || echo "унтарсан"
  echo ""
  ;;

*)
  usage
  exit 1
  ;;
esac
