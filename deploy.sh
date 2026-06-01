#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# T.H.R.E.E. OS — Deploy Script
# Хэрэглэх: bash deploy.sh
# Шаардлага: Node 20+, npm, интернэт холболт
# ══════════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  T.H.R.E.E. OS — Deploy Pipeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 1: Firebase CLI шалгах / суулгах ────────────────────────
echo "▶ Step 1: Firebase CLI шалгах..."
if ! command -v firebase &>/dev/null; then
  echo "  Firebase CLI олдсонгүй — суулгаж байна..."
  npm install -g firebase-tools@latest
  echo "  ✓ Firebase CLI суулгасан"
else
  echo "  ✓ Firebase CLI байна: $(firebase --version)"
fi

# ── Step 2: Functions dependencies ──────────────────────────────
echo ""
echo "▶ Step 2: Functions dependencies суулгах..."
cd functions
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  npm install
  echo "  ✓ Dependencies суулгасан"
else
  echo "  ✓ Dependencies аль хэдийн байна"
fi
cd ..

# ── Step 3: Firebase login шалгах ───────────────────────────────
echo ""
echo "▶ Step 3: Firebase auth шалгах..."
if ! firebase projects:list &>/dev/null 2>&1; then
  echo "  Нэвтрэх шаардлагатай:"
  firebase login
fi
echo "  ✓ Firebase auth OK"

# ── Step 4: Environment variables тохируулах ────────────────────
echo ""
echo "▶ Step 4: Telegram env vars тохируулах..."
echo "  (Bot token болон Chat ID тохируулагдсан эсэхийг шалгаж байна...)"

# Check if already set
CURRENT_CONFIG=$(firebase functions:config:get 2>/dev/null || echo "{}")
if echo "$CURRENT_CONFIG" | grep -q "telegram"; then
  echo "  ✓ Telegram config аль хэдийн байна"
else
  echo ""
  echo "  ⚠ Telegram bot token болон chat_id оруулна уу:"
  read -p "  BOT_TOKEN: " BOT_TOKEN
  read -p "  CHAT_ID:   " CHAT_ID
  if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
    firebase functions:config:set telegram.bot_token="$BOT_TOKEN" telegram.chat_id="$CHAT_ID"
    echo "  ✓ Telegram config тохируулсан"
  else
    echo "  ⚠ Config алгасалаа — хожим: firebase functions:config:set telegram.bot_token=xxx"
  fi
fi

# ── Step 5: Deploy Functions ─────────────────────────────────────
echo ""
echo "▶ Step 5: Cloud Functions deploy хийж байна..."
echo "  (Энэ 2-3 минут үргэлжилнэ...)"
firebase deploy --only functions --project jarvis-bileg

# ── Step 6: Get webhook URL and register ────────────────────────
echo ""
echo "▶ Step 6: Telegram Webhook URL авах..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deploy дууслаа!"
echo ""
echo "  Одоо Webhook бүртгэх:"
echo ""
echo "  1. Firebase Console-оос telegramWebhook-ийн URL авна:"
echo "     https://console.firebase.google.com/project/jarvis-bileg/functions"
echo ""
echo "  2. Дараах командыг ажиллуулна (URL-г өөрийнхөөрөө солино):"
echo "     curl 'https://api.telegram.org/bot{BOT_TOKEN}/setWebhook?url={FUNCTION_URL}'"
echo ""
echo "  Жишээ URL форм (v2 Cloud Run):"
echo "  https://telegramwebhook-XXXXXXXXXXXX-as.a.run.app"
echo "  эсвэл:"
echo "  https://asia-east1-jarvis-bileg.cloudfunctions.net/telegramWebhook"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
