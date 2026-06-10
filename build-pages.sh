#!/bin/bash
# ── Cloudflare Pages build ────────────────────────────────────────
set -e

rm -rf _site
mkdir -p _site

# Үндсэн web файлууд
cp index.html app.js gemini.js firebase-config.js themes.js intel.js style.css sw.js manifest.json icon.svg _site/ 2>/dev/null || true

# HTML хуудаснууд
cp chat.html profile.html tracker.html guide.html life.html dashboard.html hsk.html finance.html hsk-signup.html learn.html _site/ 2>/dev/null || true

# Ханз app
cp hsk-vocab.js _site/ 2>/dev/null || true

# Icons
cp icon-192.png icon-512.png apple-touch-icon.png _site/ 2>/dev/null || true

# Assets
cp -r assets _site/assets 2>/dev/null || true

# SPA fallback
cp index.html _site/404.html 2>/dev/null || true

# ── CACHE-BUST ───────────────────────────────────────────────────
BUILD_ID=$(date +%s)
for f in _site/*.html _site/404.html; do
  [ -f "$f" ] && sed -i.bak -E "s|(src=\"[a-zA-Z0-9_./-]+\.js)\"|\1?b=${BUILD_ID}\"|g; s|(href=\"[a-zA-Z0-9_./-]+\.css)\"|\1?b=${BUILD_ID}\"|g" "$f" && rm -f "$f.bak"
done

# ── MINIFY JS ───────────────────────────────────────────────────
echo "📦 Minifying JS..."
for f in _site/app.js _site/gemini.js _site/firebase-config.js _site/intel.js _site/themes.js; do
  [ -f "$f" ] && npx terser "$f" --compress --mangle --output "$f" 2>/dev/null && echo "  ✓ $(basename $f)" || true
done

# ── MINIFY HTML ─────────────────────────────────────────────────
echo "📦 Minifying HTML..."
for f in _site/*.html; do
  [ -f "$f" ] && npx html-minifier-terser "$f" \
    --collapse-whitespace \
    --remove-comments \
    --minify-js true \
    --minify-css true \
    --output "$f" 2>/dev/null && echo "  ✓ $(basename $f)" || true
done

# ── HEADERS ─────────────────────────────────────────────────────
cat > _site/_headers <<'HEADERS'
/
  Cache-Control: no-cache, must-revalidate
/*.html
  Cache-Control: no-cache, must-revalidate
/*.js
  Cache-Control: public, max-age=31536000, immutable
/*.css
  Cache-Control: public, max-age=31536000, immutable
/*.png
  Cache-Control: public, max-age=31536000, immutable
HEADERS

# ── REDIRECTS ───────────────────────────────────────────────────
cat > _site/_redirects <<'REDIRECTS'
/hsk           /hsk-signup.html 302
/hsk-app       /hsk-signup.html 302
REDIRECTS

echo ""
echo "✅ Build дууслаа (build=${BUILD_ID}):"
echo "--- Файлын хэмжээ ---"
wc -c _site/index.html _site/dashboard.html _site/app.js _site/style.css 2>/dev/null | sort -rn | head -6
