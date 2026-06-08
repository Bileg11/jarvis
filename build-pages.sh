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

# Бусад html хуудаснууд (chat, profile, tracker, guide, life, dashboard, hsk)
cp chat.html profile.html tracker.html guide.html life.html dashboard.html hsk.html finance.html _site/ 2>/dev/null || true

# Assets фолдер
cp -r assets _site/assets 2>/dev/null || true

# SPA fallback
cp index.html _site/404.html 2>/dev/null || true

# ── CACHE-BUST: build бүрт local JS/CSS-д unique version нэмнэ ───────
# (Browser хуучин gemini.js г.м-ийг кэшнээс уншихаас сэргийлнэ)
BUILD_ID=$(date +%s)
for f in _site/index.html _site/404.html; do
  [ -f "$f" ] && sed -i.bak -E "s|(src=\"[a-zA-Z0-9_./-]+\.js)\"|\1?b=${BUILD_ID}\"|g; s|(href=\"[a-zA-Z0-9_./-]+\.css)\"|\1?b=${BUILD_ID}\"|g" "$f" && rm -f "$f.bak"
done

# ── HTML-ийг үргэлж revalidate (шинэ deploy шууд хүрнэ) ─────────────
cat > _site/_headers <<'HEADERS'
/
  Cache-Control: no-cache, must-revalidate
/*.html
  Cache-Control: no-cache, must-revalidate
HEADERS

# ── hsk.html болон бусад HTML-д ч cache-bust нэмэх ─────────────────
for f in _site/*.html; do
  [ -f "$f" ] && sed -i.bak -E "s|(src=\"[a-zA-Z0-9_./-]+\.js)\"|\1?b=${BUILD_ID}\"|g; s|(href=\"[a-zA-Z0-9_./-]+\.css)\"|\1?b=${BUILD_ID}\"|g" "$f" && rm -f "$f.bak"
done

echo "✅ _site бэлэн (build=${BUILD_ID}):"
ls -1 _site
echo "--- index.html script srcs ---"
grep -oE "src=\"[a-z][a-zA-Z0-9_.-]+\.js[^\"]*\"" _site/index.html || true
