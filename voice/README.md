# JARVIS VOICE

Jarvis-ийн хариуг **монголоор чангаар** уншуулна. Чат дээр дүр нь ам хөдөлгөж ярина.

---

## Асаах — ганц тушаал (зөвлөсөн)

```bash
cd ~/my-jarvis && ./jarvis-local.sh
```

Дуу хоолойн сервер (7788) + вэб сервер (5173)-ийг зэрэг асаагаад чатыг нээнэ.
Зогсоох: `Ctrl+C` — хоёуланг нь зогсооно.

### Зөвхөн дуу хоолойн сервер

```bash
cd ~/my-jarvis/voice && ./start.sh
```

Зогсоох: `Ctrl+C`

Ажиллаж байгаа эсэх:

```bash
curl http://127.0.0.1:7788/health
```

---

## Хэрэглэх

| Хаана | Юу болох |
|---|---|
| `voice.html` | Voice Studio — текст бичээд сонсоно, хурд/өнгө тохируулна |
| `chat.html` | 🔊 товч дарвал Jarvis-ийн хариу бүрийг чангаар уншина |

Товч унтраалттай бол дуу гарахгүй. Төлөв нь browser-т хадгалагдана.

---

## Хоёр провайдер

### 1. edge-tts — анхдагч

Үнэгүй, хязгааргүй, бүртгэл шаардахгүй. Хоолой:

- `bataa` — mn-MN-BataaNeural (эр)
- `yesui` — mn-MN-YesuiNeural (эм)

Энэ бол **Microsoft-ийн хоолой**, чинийх биш.

### 2. ElevenLabs — өөрийн хоолой

`.env` файл дотор тохируулна (аль хэдийн үүсгэсэн):

```
JARVIS_VOICE_PROVIDER=eleven
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICES=bilguun:ZY2eShwTXxMs91i4OIqr,sokoo:KQhNCZcXa4AKEt3GoAdo
ELEVENLABS_VOICE_ID=ZY2eShwTXxMs91i4OIqr
ELEVENLABS_MODEL=eleven_v3
```

- **API key**: elevenlabs.io → Profile → API Key. Зөвхөн энэ мөр дутуу байгаа.
- **ELEVENLABS_VOICES**: `нэр:ID` хосууд, таслалаар. Нэрийг дурын байдлаар солино —
  `voice.html` дээрх жагсаалт шууд өөрчлөгдөнө.
- **ELEVENLABS_VOICE_ID**: анхдагч (чат энийг хэрэглэнэ). Хоосон бол жагсаалтын эхнийх.
- **Model**: сайт дээрх нэр (жишээ "Eleven v4") ≠ API-гийн `model_id`.
  Docs-оос яг ID-г нь хараарай. Ажиллахгүй бол `eleven_multilingual_v2` туршина.

Хоолой солих 3 арга: нэрээр (`bilguun`), түүхий ID-гаар, эсвэл хоосон орхиод анхдагчаар.

### ⚠️ Үнэгүй эрхээр ElevenLabs API АЖИЛЛАХГҮЙ

2026-11-22-нд шалгасан. Key зөв тавигдсан ч бүх хоолой 402 буцаасан:

```
Free users cannot use library voices via the API.
Please upgrade your subscription to use this voice.
```

Bilguun, Sokoo төдийгүй ElevenLabs-ийн өөрийн үндсэн хоолой (Rachel) ч ижил.

- **Вэб дээр** (elevenlabs.io → Text to Speech) үнэгүй эрхээр ажиллана — MP3 татаж авч болно
- **API-гаар** (энэ сервер) төлбөртэй багц хэрэгтэй — Starter эхний сар $1, дараа нь $6

Тиймээс одоогоор `JARVIS_VOICE_PROVIDER=edge` байх ёстой. Код бэлэн —
багц авмагц `eleven` болгоход шууд ажиллана.

`.env` нь `.gitignore`-д байгаа — API key хэзээ ч git-д орохгүй.

---

## Кэш

Ижил текстийг хоёр дахь удаа үүсгэхгүй, `cache/`-ээс шууд авна.
ElevenLabs дээр энэ нь **credit хэмнэнэ**.

Кэш цэвэрлэх:

```bash
rm -rf ~/my-jarvis/voice/cache
```

---

## Текст цэвэрлэлт

Jarvis-ийн хариунд markdown, emoji, холбоос, JSON ордог. Тэдгээрийг
чангаар уншвал утгагүй. Сервер эдгээрийг автоматаар хасна:

- ` ```код``` `, `**тод**`, `# гарчиг`, `- жагсаалт`, хүснэгт
- emoji, нүцгэн URL
- `[текст](холбоос)` → зөвхөн текст үлдэнэ

Зөвхөн JSON action ирвэл (`{"action":"LOG_EXPENSE"...}`) огт уншихгүй — 422 буцаана.

---

## Аюулгүй байдал

- Сервер зөвхөн `127.0.0.1` дээр сонсоно. Гаднаас хандах боломжгүй.
- CORS: зөвхөн localhost ба Jarvis/LFS домэйнүүд.
- API key зөвхөн `.env`-д, git-д ордоггүй.

---

## Файлууд

| Файл | Үүрэг |
|---|---|
| `server.py` | TTS сервер — 2 провайдер, кэш, текст цэвэрлэлт |
| `start.sh` | Асаах |
| `.env.example` | Тохиргооны загвар |
| `../jarvis-voice.js` | Browser тал — дуу татаж тоглуулна, товч |
| `../jarvis-avatar.js` | Дүр — ам нь дууны далайцаар хөдөлнө |
| `../voice.html` | Voice Studio хуудас |

---

## Асуудал гарвал

**"Сервер олдсонгүй"** → `./start.sh` ажиллаж байгаа эсэхийг шалга.

**Deploy хийсэн сайт дээр дуу гарахгүй** → Энэ хүлээгдсэн зүйл.
`https://jarvis.amarsaikhanbileg.workers.dev` дээрээс `http://127.0.0.1:7788`
руу хандахыг браузер блоклодог (2026-11-22-нд баталгаажсан — Safari төдийгүй
Chromium дээр ч). Хуудас эвдрэхгүй, "Сервер олдсонгүй" гэж харуулна.

**Дуу хоолой ЗӨВХӨН локал хаяг дээр ажиллана:**

```bash
cd ~/my-jarvis && python3 -m http.server 5173
```

дараа нь `http://localhost:5173/voice.html` эсвэл `http://localhost:5173/chat.html`.

Deploy хийсэн домэйн дээр ажиллуулах бол Cloudflare Worker тал дээр TTS хийх
шаардлагатай — одоогоор хийгээгүй.

**Утсан дээр ажиллахгүй** → Локал сервер зөвхөн энэ Mac дээр байна.
Утсанд хэрэгтэй бол сервер талд (Cloudflare Worker) TTS нэмэх хэрэгтэй.
