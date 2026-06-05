"""
JARVIS OS — macOS icon generator v2
Proper macOS rounded-square icon, face prominent, tech background
"""

from PIL import Image, ImageDraw, ImageFilter
import os

SRC  = os.path.join(os.path.dirname(__file__), 'assets', 'icon.png')
OUT  = os.path.join(os.path.dirname(__file__), 'assets', 'icon_macos.png')
SIZE = 1024
RADIUS = int(SIZE * 0.2237)   # macOS Big Sur corner radius

# ── 1. Background: deep navy gradient ────────────────────────────────
bg = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(bg)

# Fill rounded square with solid dark navy first
draw.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=RADIUS, fill=(2, 8, 22, 255))

# Radial gradient overlay (lighter center)
for i in range(500, 0, -2):
    t = i / 500
    r = int(2  + t * 10)
    g = int(8  + t * 30)
    b = int(22 + t * 80)
    draw.ellipse(
        [SIZE//2 - i, SIZE//2 - i, SIZE//2 + i, SIZE//2 + i],
        fill=(r, g, b, 255)
    )

# Re-apply rounded mask to gradient
mask = Image.new('L', (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=RADIUS, fill=255)
bg.putalpha(mask)

# ── 2. Subtle cyan border glow ────────────────────────────────────────
border_layer = Image.new('RGBA', (SIZE, SIZE), (0,0,0,0))
bd = ImageDraw.Draw(border_layer)
bd.rounded_rectangle([2, 2, SIZE-3, SIZE-3], radius=RADIUS-2,
                     outline=(0, 200, 255, 60), width=6)
bd.rounded_rectangle([8, 8, SIZE-9, SIZE-9], radius=RADIUS-8,
                     outline=(0, 200, 255, 25), width=4)
bg = Image.alpha_composite(bg, border_layer)

# ── 3. Avatar — center crop top half (face focus), fill most of icon ─
avatar_src = Image.open(SRC).convert('RGBA')
W, H = avatar_src.size

# Crop: top 75% of image (face + upper body), centered horizontally
crop_h = int(H * 0.75)
crop_y_start = 0
crop_box = (0, crop_y_start, W, crop_y_start + crop_h)
face = avatar_src.crop(crop_box)

# Scale to fill 68% of icon
inner = int(SIZE * 0.68)
face  = face.resize((inner, int(inner * crop_h / W)), Image.LANCZOS)

# If too tall, crop to square from top
if face.height > inner:
    face = face.crop((0, 0, inner, inner))

# Center-paste
x_off = (SIZE - face.width)  // 2
y_off = (SIZE - face.height) // 2 + int(SIZE * 0.03)  # slight downward nudge
bg.paste(face, (x_off, y_off), face)

# ── 4. Final clip to rounded square ──────────────────────────────────
final_mask = Image.new('L', (SIZE, SIZE), 0)
ImageDraw.Draw(final_mask).rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=RADIUS, fill=255)
bg.putalpha(final_mask)

bg.save(OUT)

# Also overwrite icon.png so ICNS pipeline uses this
bg.save(os.path.join(os.path.dirname(__file__), 'assets', 'icon.png'))
print(f'✓  Saved  →  {OUT}')
