#!/usr/bin/env node
// ---------------------------------------------------------------------------
// generate.js
// Gemini API (free tier)-аар сэдэв сонгож, post.json үүсгэнэ.
//
//   node scripts/generate.js
//   node scripts/generate.js --topic "AI-аар CV бичих"
//   node scripts/generate.js --out post.json
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { sanitizeDeep, hasLongDash } from '../src/text.js';
import { TEMPLATE_NAMES } from '../src/templates/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.GEMINI_API_KEY;
const MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
].filter(Boolean);

/* ------------------------------------------------------------ сэдвүүд ---- */
// Gemini сэдэв сонгоход туслах эргэлтийн жагсаалт. Өдрөөр тогтмол сонгогдох тул
// дараалсан өдрүүдэд ижил сэдэв давтагдахгүй.
const TOPIC_POOL = [
  'AI-аар имэйл хурдан бичих',
  'ChatGPT-ээр Excel/Sheets-ийн ажил автоматжуулах',
  'AI-аар танилцуулга слайд бэлтгэх',
  'Ажлын ярилцлагад AI-аар бэлдэх',
  'AI-аар CV болон ковер захидал сайжруулах',
  'Хурлын тэмдэглэлийг AI-аар хураангуйлах',
  'AI зураг үүсгэгчийг маркетингт ашиглах',
  'Монгол хэл дээр AI-аар контент бичих',
  'AI agent-ээр өдөр тутмын ажил автоматжуулах',
  'Үнэгүй AI хэрэгслүүдийн жагсаалт',
  'Prompt бичих 5 дүрэм',
  'AI-аар судалгаа хурдан хийх',
  'Багийн ажилд AI-г нэвтрүүлэх',
  'AI-аар санхүүгийн тайлан шинжлэх',
];

function topicOfTheDay() {
  const days = Math.floor(Date.now() / 86_400_000);
  return TOPIC_POOL[days % TOPIC_POOL.length];
}

/* -------------------------------------------------------------- prompt --- */
function buildPrompt(topic) {
  return `Чи бол KHAN AI (@khan.ai) нэртэй Монгол Instagram хуудасны контент зохиогч.
Уншигчид: AI-г ажилдаа хэрэглэхийг хүсдэг Монгол залуу мэргэжилтнүүд.

СЭДЭВ: ${topic}

Instagram carousel постын агуулгыг ЗӨВХӨН JSON хэлбэрээр буцаа.

=== CAROUSEL-ИЙН БҮТЭЦ (6 слайд, яг энэ дараалал) ===

Слайд 1  COVER   Дэгээ. 6-с илүүгүй үг. Доор нь 1 мөр амлалт.
Слайд 2  ЯАГААД  Яагаад энэ чухал вэ, 1 өгүүлбэр.
                 ЧУХАЛ: Instagram carousel-ийг 2 дахь слайдаас эхлүүлж
                 дахин үзүүлдэг. Тиймээс энэ слайд нэгдүгээрийг уншаагүй
                 хүнд ч бие даан ойлгогдох ёстой. "Оршил" бичиж болохгүй.
Слайд 3  АЛХАМ   3 алхам, тус бүр нэг санаа.
Слайд 4  PROMPT  Хуулж хэрэглэх бодит prompt.
Слайд 5  РЕКАП   Бүгдийг нэг жагсаалт болгоно.
                 ЭНЭ БОЛ ХҮМҮҮС SCREENSHOT АВААД ИЛГЭЭДЭГ СЛАЙД.
                 Бусад слайдыг уншаагүй хүн ч ойлгохоор бие даасан бич.
Слайд 6  OUTRO   Тогтмол, талбаргүй.

=== JSON ===
{
  "meta": {
    "slug": "латин-үсгээр-богино-нэр",
    "brand": "@khan.ai",
    "caption": "Instagram-ын тайлбар. Эхний мөр нь дэгээ. 3-5 догол мөр. Төгсгөлд асуулт.",
    "hashtags": ["#khanai", "#mongolia", "...нийт 8-12 ширхэг"]
  },
  "slides": [
    { "type":"cover", "bg":"assets/img/cover-bg.svg", "kicker":"2-3 үгтэй шошго",
      "title":"6-с илүүгүй үг", "sub":"1 мөр амлалт", "cta":"ЦААШ ГҮЙЛГЭЭРЭЙ" },

    { "type":"media", "eyebrow":"Яагаад", "text":"Гол мэдэгдэл, 10-с илүүгүй үг",
      "sub":"1 өгүүлбэр тайлбар" },
    // Анхаар: энд "image" талбар БҮҮ бич. Зураггүй үед том текст болно.

    { "type":"steps", "eyebrow":"3 алхам", "title":"гарчиг",
      "steps":[{"n":1,"title":"3-7 үг","text":"25-с илүүгүй үг"}] },

    { "type":"prompt", "label":"PROMPT:", "title":"гарчиг",
      "placeholder":"Хуулж авах prompt",
      "text":"Бодитоор хуулж хэрэглэж болох бүтэн prompt. 60-110 үг.",
      "note":"1 өгүүлбэр зөвлөгөө" },

    { "type":"recap", "eyebrow":"Хураангуй", "title":"гарчиг",
      "items":["мөр 1","мөр 2","мөр 3","мөр 4"],
      "note":"1 мөр" },

    { "type":"outro" }
  ]
}

=== ХАТУУ ХОРИО ===

1. ТОО БАРИМТ БҮҮ ЗОХИО.
   Чи ямар ч судалгааг шалгаж чадахгүй. Тиймээс:
   - "Судалгаагаар 20-30% нэмэгдсэн" гэх мэт зохиомол тоо БҮҮ бич
   - Forbes, TechCrunch, Bloomberg, McKinsey гэх мэт байгууллагын нэрийг
     эх сурвалж болгож БҮҮ дурд
   - "ойролцоогоор", "судалгаагаар" гэж бичээд тоо хавсаргахыг ч хориглоно
   Тоо хэрэгтэй бол зөвхөн маргаангүй зүйл бич ("3 алхам", "5 минут").

2. ЕРӨНХИЙ ҮГ ХОРИОТОЙ.
   Доорх маягийн өгүүлбэр бичихийг хориглоно:
   - "Зөв хэрэгслээ сонго"
   - "Хэрэгцээндээ тохирох аргыг ол"
   - "Туршиж үзээд сайжруул"
   - "Тодорхой зорилго тавь"
   Эдгээр юу ч хэлэхгүй. Оронд нь БОДИТ зүйл бич:
   - Бодит хэрэгслийн нэр: ChatGPT, Claude, Gemini, NotebookLM, Notion, Excel
   - Бодит үйлдэл: "Имэйлээ хуулаад ChatGPT-д тавь, 3 өгүүлбэрт багтаа гэж бич"
   - Бодит тоо: "5 имэйл дээр турш", "2 минут"

3. ГАРЧИГ, ТАЙЛБАР ХОЁР ИЖИЛ ЗҮЙЛ БҮҮ ДАВТ.
   Муу: title "Зөв хэрэгсэл сонго" / text "Тохирох хэрэгслийг зөв сонго"
   Сайн: title "ChatGPT-д үүрэг өг" / text "Эхний мөрөнд 'Чи санхүүгийн шинжээч' гэж бич"

4. ТОДРУУЛГА.
   Гарчиг бүрт гол үгийг {{давхар хаалтанд}} бич, нэг гарчигт 1 удаа.
   {{}} дотор "AI", "ChatGPT", "Prompt" гэх мэт англи нэр БҮҮ тавь.
   Муу: "{{AI}}-г ашиглан ажилла"
   Сайн: "Имэйлээ {{3 минутад}} бич"

5. УРТ ЗУРААС (—, –) ОГТ бүү хэрэглэ. Оронд нь таслал эсвэл цэг.

6. Нэг слайд нэг санаа. 25 үгэнд багтахгүй бол санаагаа хуваа.
   Монгол хэлээр, энгийн. Англи нэр томьёог хэвээр үлдээж болно.

7. bg талбарт ДЭЭР ӨГСӨН замыг л бич, шинэ зам бүү зохио.
   media слайд дээр image талбар БҮҮ бич.

ЗӨВХӨН JSON буца. Тайлбар, markdown код блок бүү нэм.`;
}

/* ---------------------------------------------------------------- API ---- */
async function callGemini(model, prompt) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
        topP: 0.95,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Gemini ${model}: HTTP ${res.status} ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text.trim()) throw new Error(`Gemini ${model}: хоосон хариу ирлээ.`);
  return text;
}

/** ```json ... ``` ороосон байвал тайлна. */
function parseJsonLoose(text) {
  let t = text.trim();
  if (t.startsWith('```')) t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first > 0 || last < t.length - 1) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

/* ------------------------------------------------------------ шалгалт ---- */
function validate(post) {
  const problems = [];
  if (!post?.meta) problems.push('meta байхгүй');
  if (!Array.isArray(post?.slides) || post.slides.length < 3) {
    problems.push('slides хэт цөөн');
  } else {
    post.slides.forEach((s, i) => {
      if (!TEMPLATE_NAMES.includes(s.type)) {
        problems.push(`slide ${i + 1}: танихгүй type "${s.type}"`);
      }
    });
    if (post.slides[0].type !== 'cover') problems.push('эхний slide нь cover биш');
    if (post.slides.at(-1).type !== 'outro') problems.push('сүүлийн slide нь outro биш');
    // recap бол screenshot/sends-ийн гол слайд, заавал байна
    if (!post.slides.some((s) => s.type === 'recap')) problems.push('recap slide алга');
    // media слайд дээр зохиомол эх сурвалж гаргахыг хориглоно
    for (const [i, sl] of post.slides.entries()) {
      if (sl.type === 'media' && (sl.source || sl.caption)) {
        problems.push(`slide ${i + 1}: шалгагдаагүй эх сурвалж бичсэн`);
      }
    }
  }
  return problems;
}

/** Gemini зохиосон зургийн замыг бодит файл руу хязгаарлана. */
function clampAssets(post) {
  const allowed = new Set(
    fs.existsSync(path.join(ROOT, 'assets', 'img'))
      ? fs.readdirSync(path.join(ROOT, 'assets', 'img')).map((f) => `assets/img/${f}`)
      : [],
  );
  const fallback = {
    bg: 'assets/img/cover-bg.svg',
    image: 'assets/img/news.svg',
    avatar: 'assets/img/avatar.svg',
  };
  for (const slide of post.slides ?? []) {
    for (const key of ['bg', 'image', 'avatar']) {
      const v = slide[key];
      if (v === undefined) continue;
      if (/^https?:/i.test(v)) continue;
      if (!allowed.has(v)) slide[key] = fallback[key];
    }
  }
  return post;
}

/* ---------------------------------------------------------------- main --- */
async function main() {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const topic = get('--topic') ?? process.env.TOPIC ?? topicOfTheDay();
  const theme = (get('--theme') ?? process.env.THEME ?? 'khan').trim() || 'khan';
  if (!['khan', 'blue', 'green'].includes(theme)) {
    console.error(`Танихгүй theme: "${theme}". Боломжит: khan, blue, green`);
    process.exit(1);
  }
  const outPath = path.resolve(ROOT, get('--out') ?? 'post.json');

  if (!API_KEY) {
    console.error(
      'GEMINI_API_KEY байхгүй.\n' +
        '  Локал:  export GEMINI_API_KEY=... (https://aistudio.google.com/apikey)\n' +
        '  CI:     GitHub Secrets дотор GEMINI_API_KEY нэмнэ.',
    );
    process.exit(1);
  }

  console.log(`Сэдэв: ${topic}`);
  console.log(`Theme: ${theme}`);
  const prompt = buildPrompt(topic);

  let post = null;
  let lastErr = null;

  outer: for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`  Gemini: ${model} (оролдлого ${attempt})`);
        const text = await callGemini(model, prompt);
        const parsed = parseJsonLoose(text);
        const problems = validate(parsed);
        if (problems.length) throw new Error('Буруу бүтэц: ' + problems.join('; '));
        post = parsed;
        break outer;
      } catch (e) {
        lastErr = e;
        console.log(`    ! ${e.message.slice(0, 180)}`);
        // 429 / 5xx бол хүлээгээд дахина оролдоно
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 4000));
      }
    }
  }

  if (!post) {
    console.error('\npost.json үүсгэж чадсангүй.\n' + (lastErr?.message ?? ''));
    process.exit(1);
  }

  // Урт зураас устгах шүүлтүүр + зургийн зам хязгаарлах
  post = clampAssets(sanitizeDeep(post));
  post.meta = post.meta ?? {};
  post.meta.brand = post.meta.brand || '@khan.ai';
  post.meta.slug =
    (post.meta.slug || 'post').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') ||
    'post';
  post.meta.theme = theme;
  post.meta.topic = topic;
  post.meta.generatedAt = new Date().toISOString();

  const leftover = JSON.stringify(post);
  if (hasLongDash(leftover)) {
    console.error('Урт зураас үлдсэн байна (шүүлтүүр алдаа).');
    process.exit(1);
  }

  fs.writeFileSync(outPath, JSON.stringify(post, null, 2) + '\n', 'utf8');
  console.log(`\nБэлэн: ${path.relative(ROOT, outPath)}`);
  console.log(`  slug:   ${post.meta.slug}`);
  console.log(`  theme:  ${post.meta.theme}`);
  console.log(`  slides: ${post.slides.map((s) => s.type).join(' > ')}`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
