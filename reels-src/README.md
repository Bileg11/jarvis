# LFS reels · Remotion эх код

LFS Shanghai-ийн reel-үүдийн эх код. 1080x1920, 30fps, брэндийн өнгө/фонт/лого/safe zone бүгд `src/brand.tsx` дотор.
Бэлэн mp4-үүд `../reels/` дотор, постлох хуваарь `../reels/queue.json` дотор.

## Бүтэц

| Файл | Юу |
|---|---|
| `src/brand.tsx` | Өнгө, фонт, layout grid (`Z`), Frame/Footer/Headline/WordCard/Traveler/Phone/QR/Bubble компонентууд |
| `src/reels/R*.tsx` | Reel тус бүр. `<Sequence from=...>` нь scene-ийн эхлэх frame |
| `src/Root.tsx` | Composition бүртгэл |
| `sfx.py` | Scene шилжилтэд синк хийсэн SFX-ийг кодоор үүсгэж mp4-т хийнэ (sample ашиглахгүй) |
| `CALENDAR.md` | Эхний 6 reel-ийн календарь, caption, story, engagement жагсаалт |

Layout grid (бүх reel адилхан, IG safe zone дотор):
`header 250 · title 400-740 · body 760 · visual 820-1270 · footer 1300-1420`. Баруун 230px, дээд 230px, 1440-өөс доош текст хийхгүй.

## Render хийх

```bash
cd reels-src
npm ci
# Chromium: Remotion-ий өөрийн browser татагдахгүй орчинд npm-ээр ирсэн Chromium-ийг ашиглана
node --input-type=module -e "import c from '@sparticuz/chromium'; console.log(await c.executablePath())"   # → /tmp/chromium
npm run build
npx remotion render build R1-1102-3ug-alipay out/R1.mp4 --codec=h264 --crf=20 --concurrency=2
# Safe zone шалгах (улаан = IG UI дардаг хэсэг):
npx remotion still build R1-1102-3ug-alipay out/check.png --frame=40 --props='{"safe":true}'
# SFX нэмэх (EVENTS-ийг sfx.py дотор reel тус бүрийн scene frame-тэй тааруулна):
python3 sfx.py out out-sfx
cp out-sfx/*.mp4 ../reels/
```

Mac дээр Chrome суусан бол `REMOTION_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` гэж зааж өгч болно.
`npm run studio` → browser дээр reel-үүдийг харж засна.

## Шинэ reel нэмэх

1. `src/reels/R7Xxx.tsx` үүсгэ (одоогийнхоос хуулбарлаад засах нь хамгийн хурдан), `Root.tsx`-д бүртгэ
2. `sfx.py`-ийн `EVENTS`-д `'R7': [...]` нэм
3. Render → SFX → `../reels/`-д хуул
4. `../reels/queue.json`-д `{date, file, caption, first_comment, skip:false}` мөр нэм

## Дүрэм (lfs-brand)

- Em dash "—" хэзээ ч хэрэглэхгүй
- Нэг слайд, нэг санаа. Карт бүр 6 үгээс хэтрэхгүй
- Үнэ зөвхөн батлагдсан: хөтөч ¥500/өдөр, онгоцны буудлаас тосох ¥200
- 5 постоос 4 нь юу ч зарахгүй
