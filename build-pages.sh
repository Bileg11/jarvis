#!/bin/bash
# ── Cloudflare Pages build ────────────────────────────────────────
# Зөвхөн JARVIS web app файлуудыг _site/ дотор бэлдэнэ.
# Server (webhook/), Electron (main/preload), dist/, node_modules оруулахгүй.
set -e

rm -rf _site
mkdir -p _site

# Үндсэн web файлууд
cp index.html        _site/ 2>/dev/null || true
cp app.js            _site/ 2>/dev/null || true
cp gemini.js         _site/ 2>/dev/null || true
cp firebase-config.js _site/ 2>/dev/null || true
cp themes.js         _site/ 2>/dev/null || true
cp intel.js          _site/ 2>/dev/null || true
cp style.css         _site/ 2>/dev/null || true
cp sw.js             _site/ 2>/dev/null || true
cp manifest.json     _site/ 2>/dev/null || true
cp icon.svg          _site/ 2>/dev/null || true

# Бусад html хуудаснууд (chat, profile, tracker, guide, life, dashboard)
cp chat.html profile.html tracker.html guide.html life.html dashboard.html _site/ 2>/dev/null || true

# Assets фолдер
cp -r assets _site/assets 2>/dev/null || true

# SPA fallback
cp index.html _site/404.html 2>/dev/null || true

echo "✅ _site бэлэн:"
ls -1 _site
