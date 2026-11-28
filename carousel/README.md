# KHAN AI carousel factory

Instagram + Facebook (@khan.ai)-д зориулсан **0₮ зардлаар** ажилладаг carousel пост үүсгэгч, нийтлэгч.

- Node.js + `puppeteer-core` (browser ШИНЭЭР ТАТАХГҮЙ, системийн Chrome-ыг ашиглана)
- HTML/CSS slide template, 1080x1350 PNG гаралт
- Gemini API (free tier)-ээр агуулга үүсгэнэ
- GitHub Actions (нээлттэй repo-д үнэгүй)-ээр хуваарьт постлоно
- Docker, хүнд сан, төлбөртэй hosting хэрэггүй

2015 MacBook (Intel i5, 8GB RAM, macOS 12) дээр туршсан. 6 слайд ~10 секундэд рендерлэнэ.

---

## 1. Суулгах

```bash
npm install
```

Chrome шаардлагатай. `/Applications/Google Chrome.app` байвал автоматаар олно.
Өөр газар байвал:

```bash
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## 2. Локалаар рендерлэх

```bash
npm run render
```

`post.json` уншаад `output/<slug>/` дотор `01-cover.png` ... `06-outro.png` үүснэ.

```bash
node src/render.js post.json --keep-html   # HTML-ийг нь ч хадгална (дизайн засахад тустай)
node src/render.js post.json --out dist    # өөр хавтас руу
```

---

## 3. Slide template-ууд

`post.json` доторх `slides` массивын элемент бүр `type` талбартай.

| type | Юу гаргах вэ |
|---|---|
| `cover` | Арын зураг + хар gradient + том гарчиг + "ЦААШ ГҮЙЛГЭЭРЭЙ" товч |
| `steps` | Ногоон дугаартай гарчиг + `→` сумтай богино алхмууд |
| `media` | 1-2 мөр тайлбар + булан дугуйрсан мэдээний зураг / meme |
| `prompt` | "PROMPT:" гарчиг + хар саарал чат хайрцаг + ногоон `↑` товч |
| `x_card` | X (Twitter) пост, Quote-Tweet карт, Монгол орчуулга |
| `recap` | **Screenshot слайд.** Бүх санааг нэг жагсаалт болгоно |
| `outro` | Тогтмол `+FOLLOW` карт (@khan.ai) |

### Carousel-ийн бүтэц

`ig-carousel` skill-ийн зарчмын дагуу:

```
1  COVER    дэгээ, 6-с илүүгүй үг
2  ЯАГААД   яагаад чухал вэ, 1 өгүүлбэр   (media, зураггүй)
3  АЛХАМ    3 алхам                        (steps)
4  PROMPT   хуулж хэрэглэх prompt          (prompt)
5  РЕКАП    бүгдийг нэг жагсаалт           (recap)
6  OUTRO    нэг л үйлдэл                   (outro)
```

Хоёр дахь слайд чухал: Instagram carousel-ийг **2 дахь слайдаас эхлүүлж
дахин үзүүлдэг**. Тиймээс тэр нь нэгдүгээрийг уншаагүй хүнд ч ойлгогдох ёстой.

`recap` нь хүмүүс screenshot аваад найздаа илгээдэг слайд. Sends бол
Instagram-ын хамгийн хүчтэй дохио тул үүнийг бие даан ойлгогдохоор бич.

### Гол үгийг ногооноор тодруулах

Аль ч гарчигт `{{давхар хаалт}}` бичвэл тэр хэсэг ногоон болно:

```json
{ "title": "AI agent чиний {{ажлыг}} хийж дуусгана" }
```

### Өнгөний загвар (theme)

`post.json` дээр `meta.theme` бичнэ. Хоёр сонголт:

| theme | Дүр төрх |
|---|---|
| `khan` | **Default.** Хар `#0A0A0C`, эзэнт гүрний алт `#E8B44A`. KHAN AI брэндийн өнгө. |
| `blue` | Хар хөх `#05070F`, `#4F8DFF` accent. Хуучин AI Оффис загвар. |
| `green` | Хар `#07090A`, `#00FF88` accent. |

```json
{ "meta": { "theme": "khan", "slug": "..." } }
```

Бичихгүй бол `khan` болно. Түр өөрчлөх бол:

```bash
node src/render.js post.json --theme blue
```

### Текст автоматаар багтана

Урт Монгол гарчиг зурагнаас хальдаггүй. `render.js` нь фонтын хэмжээг багасгаж,
дараа нь зай/padding-г агшуулж 1080x1350-д багтаана. Багтахгүй бол консол дээр
анхааруулга өгнө (аль элемент хальснаар нь хамт).

---

## 4. Урт зураасны шүүлтүүр

AI-аар үүсгэсэн Монгол текст урт зураас (`—`, `–`) их хэрэглэдэг. `src/text.js` доторх
`noEmDash()` үүнийг бүрэн зайлуулна:

| Орох | Гарах |
|---|---|
| `ChatGPT — шинэ функц` | `ChatGPT, шинэ функц` |
| `5—10 минут` | `5-10 минут` |
| `AI -- хэрэгсэл` | `AI, хэрэгсэл` |
| `— Эхлээд уншина уу` | `Эхлээд уншина уу` |

Шүүлтүүр `post.json`-ы **бүх** string дээр (гарчиг, caption, hashtag, prompt)
рендерлэхээс өмнө ажиллана. Рендер хийсний дараа зураг дээрх текстийг дахин шалгаж,
үлдсэн байвал анхааруулна.

---

## 5. Өөрийн фонт нэмэх (сонголт)

`assets/fonts/` дотор `.woff2` / `.ttf` файл хийвэл автоматаар ашиглана.
Файлын нэрэнд `bold`, `black`, `semibold` гэх мэт орсон байвал жинг нь таамаглана:

```
assets/fonts/
  Montserrat-Bold.woff2
  Montserrat-Black.woff2
```

Хоосон байвал системийн фонт (Arial / Noto Sans / DejaVu Sans) руу шилжинэ,
энэ нь кирилл үсгийг бүрэн дэмждэг.

---

## 6. Gemini-ээр агуулга үүсгэх

```bash
export GEMINI_API_KEY="..."          # https://aistudio.google.com/apikey (free tier)
npm run generate                      # сэдвийг өдрөөр автоматаар сонгоно
node scripts/generate.js --topic "AI-аар CV бичих"
```

Gemini-ийн буцаасан JSON-г бүтцээр нь шалгаж, зургийн замыг `assets/img/` доторх
бодит файлаар хязгаарлаж, урт зураасыг цэвэрлэж `post.json` руу бичнэ.

---

## 7. Instagram + Facebook руу нийтлэх

```bash
npm run publish                       # DRY RUN, юу ч нийтлэхгүй
node scripts/publish.js --yes         # жинхэнээсээ нийтэлнэ
node scripts/publish.js --only fb --yes
```

> `--yes` өгөөгүй бол ямар ч пост гарахгүй, зураг ч байршуулахгүй.

### Hosting хэрэггүй

Facebook Graph API зургийн файлыг **шууд (multipart)** хүлээж авдаг тул гадны
hosting шаардлагагүй. Instagram нь нээлттэй URL шаарддаг ч дараах байдлаар шийдсэн:

1. Зураг бүрийг Facebook Page руу `published=false`-оор байршуулна
2. `GET /{photo-id}?fields=images` гэж асуухад `scontent.fbcdn.net` хаяг буцна
3. Тэр хаягийг Instagram carousel-д дамжуулна

Нэмэлт ашиг: Facebook зургийг JPEG болгож хувиргадаг тул Instagram-ын JPEG
шаардлага автоматаар биелнэ (бид PNG рендерлэдэг ч асуудалгүй).

Өөрийн hosting ашиглахыг хүсвэл `PUBLIC_MEDIA_BASE` тохируулна. Тэр тохиолдолд
зурагнууд **JPEG** байх ёстойг анхаарна уу.

### Орчны хувьсагчид

`publish.js` нь нэрийг хоёр янзаар хүлээж авна, аль нь ч болно:

| Энэ төсөл | jarvis repo-д хэвшсэн нэр |
|---|---|
| `META_ACCESS_TOKEN` | `FB_PAGE_TOKEN_AI_OFFICE` |
| `FB_PAGE_ID` | `FACEBOOK_PAGE_ID` |
| `IG_USER_ID` | `INSTAGRAM_BUSINESS_ID` |
| `META_API_VERSION` | `FB_API_VERSION` |

Шаардлагатай эрхүүд: `pages_manage_posts`, `pages_read_engagement`,
`instagram_basic`, `instagram_content_publish`.

---

## 8. GitHub Actions (автомат горим)

`.github/workflows/auto-post.yml`:

1. Gemini-ээр `post.json` үүсгэх
2. PNG рендерлэх
3. Artifact болгон хадгалах
4. Meta Graph API-аар Instagram carousel + Facebook Page пост нийтлэх

### Repo үүсгэж push хийх

```bash
git remote add origin https://github.com/<хэрэглэгч>/<repo>.git
git push -u origin main
```

### Secrets нэмэх

**Settings > Secrets and variables > Actions > Secrets**:

```
GEMINI_API_KEY
FB_PAGE_TOKEN_AI_OFFICE
FACEBOOK_PAGE_ID
INSTAGRAM_BUSINESS_ID
```

Эдгээрийн утгыг `Bileg11/jarvis` repo-оос хуулж болно, ижил Page, ижил token.

> Repo **хувийн (private) байж болно**. Hosting хэрэггүй болсон тул
> `raw.githubusercontent.com` ашиглахаа больсон.

### Гараар ажиллуулах

Actions > "Auto post carousel" > "Run workflow". Сэдэв, theme сонгоно.
`publish` = `false` бол зөвхөн зураг үүсгээд **нийтлэхгүй**, artifact-аас татаж харна.

---

## Файлын бүтэц

```
src/
  render.js            post.json -> PNG (autofit, зураг ачаалалт, шалгалт)
  browser.js           Chrome хайгч (macOS / Linux / CI)
  text.js              noEmDash, sanitizeDeep, {{тодруулга}}
  templates/
    base.css           дизайн систем (өнгө, фонт, 6 template-ийн загвар)
    cover.js steps.js media.js prompt.js x_card.js outro.js
scripts/
  generate.js          Gemini -> post.json
  publish.js           output/ -> Instagram + Facebook
  brand.js             profile picture + Facebook cover
assets/
  img/                 жишээ зурагнууд (SVG, өөрийнхөөрөө солино)
    avatar.svg         KHAN AI лого (outro дээр гарна)
  fonts/               (сонголт) өөрийн фонт
.github/workflows/
  auto-post.yml        хуваарьт автомат пост
post.json              жишээ агуулга
output/<slug>/         үүссэн PNG + manifest.json
```
