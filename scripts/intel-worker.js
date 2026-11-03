/**
 * JARVIS Intel Worker — GitHub Actions
 * Secrets шаардлагатай: TAVILY_KEY, FIREBASE_SERVICE_ACCOUNT, USER_UID
 * GITHUB_TOKEN — автомат байдлаар Actions-д байдаг
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

const TAVILY_URL = 'https://api.tavily.com/search';
const CHAT_URL   = 'https://models.inference.ai.azure.com/chat/completions';

const TAVILY_KEY    = process.env.TAVILY_KEY;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ulaanbaatar' }));

// Firebase
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ── ХАЙЛТЫН ЗАПРОСУУД ─────────────────────────────────────────────
const QUERIES = [
  {
    label: '🤖 AI & Технологи',
    query: 'new AI model release artificial intelligence breakthrough technology news today 2026'
  },
  {
    label: '🐦 X / Нийгмийн медиа',
    query: 'Elon Musk Donald Trump X Twitter post statement announcement today'
  },
  {
    label: '🌍 Монгол & Дэлхий',
    query: 'Монгол улс мэдээ Улаанбаатар өнөөдөр Mongolia news today 2026 world major events'
  }
];

async function tavilySearch(query) {
  try {
    const res = await fetch(TAVILY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY, query,
        search_depth: 'basic', include_answer: true, max_results: 5
      })
    });
    if (!res.ok) { console.warn('[Intel] Tavily', res.status); return null; }
    return await res.json();
  } catch(e) {
    console.warn('[Intel] Tavily error:', e.message);
    return null;
  }
}

// ── DIGEST — урт брифингээс 3 мөр гаргана ─────────────────────────
// Өглөөний brief-д бүтэн текст хэтэрхий урт тул тусад нь хураангуйлна
async function makeDigest(fullMessage) {
  if (!GITHUB_TOKEN || !fullMessage) return null;
  try {
    const res = await fetch(CHAT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({
        model:    'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Чи мэдээг хураангуйлагч. Монголоор, зөвхөн хүссэн форматаар хариул.' },
          { role: 'user',   content: `Доорх брифингээс ХАМГИЙН чухал 3 мэдээг сонгож, мөр бүрийг "• " -ээр эхлүүлж, мөр тутам 12 үгнээс хэтрэхгүй бич. Өөр юу ч бүү нэм.\n\n${fullMessage}` }
        ],
        max_tokens: 160, temperature: 0.3
      })
    });
    if (!res.ok) { console.warn('[Intel] Digest', res.status); return null; }
    const d = await res.json();
    const text = d.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    // Зөвхөн bullet мөрүүдийг авна, дээд тал нь 3
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('•')).slice(0, 3);
    return lines.length ? lines.join('\n') : null;
  } catch (e) {
    console.warn('[Intel] Digest error:', e.message);
    return null;
  }
}

async function main() {
  const uid = process.env.USER_UID;
  if (!uid) throw new Error('USER_UID байхгүй');

  const ts = now.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ulaanbaatar'
  });
  console.log(`[Intel] ${ts} Улаанбаатар — эхлэв`);

  if (!TAVILY_KEY) throw new Error('TAVILY_KEY secret байхгүй');

  // 3 хайлт зэрэг
  const results = await Promise.all(QUERIES.map(q => tavilySearch(q.query)));
  const ok = results.filter(Boolean).length;
  console.log(`[Intel] Tavily: ${ok}/3 амжилтай`);

  // Raw context
  let raw = `Хайлтын үр дүн [${ts} Улаанбаатар]:\n\n`;
  results.forEach((r, i) => {
    raw += `--- ${QUERIES[i].label} ---\n`;
    if (!r) { raw += '(Хайлт амжилтгүй)\n\n'; return; }
    if (r.answer) raw += `AI нэгтгэл: ${r.answer}\n\n`;
    (r.results || []).slice(0, 4).forEach(item => {
      raw += `• ${item.title}\n  ${(item.content || '').slice(0, 300)}\n  ${item.url}\n\n`;
    });
  });

  const prompt = `${raw}
──────────────────────────────
Дээрх бодит цагийн мэдээллийг "JARVIS Intel Брифинг" болгон Монгол хэлээр нэгтгэ.

Формат:
🤖 **AI & ТЕХНОЛОГИ**
• [шинэ model/tool байвал онцол, байхгүй бол "Том мэдэгдэл гараагүй" гэ]

🐦 **ELON & TRUMP**
• [тэдний чухал мэдэгдэл]

🌍 **ДЭЛХИЙ & МОНГОЛ**
• [том үйл явдлууд, Монгол мэдээ байвал онцол]

⚡ **JARVIS ЗӨВЛӨГӨӨ**
[Билэгт нэг практик зөвлөгөө]

Товч, конкрет байлга.`;

  // gpt-4o-mini
  const chatRes = await fetch(CHAT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
    body: JSON.stringify({
      model:       'gpt-4o-mini',
      messages:    [
        { role: 'system', content: 'Та JARVIS — Билэгийн хувийн AI туслах. Монголоор хариулна уу.' },
        { role: 'user',   content: prompt }
      ],
      max_tokens: 1200, temperature: 0.6
    })
  });

  if (!chatRes.ok) throw new Error(`GPT ${chatRes.status}`);
  const chatData = await chatRes.json();
  const message  = chatData.choices?.[0]?.message?.content?.trim() || '...';

  console.log('[Intel] GPT ✓');

  // ── DIGEST — өглөөний Telegram brief-д тавих 3 мөр ──────────────
  // Урт брифингийг хурдан уншихад зориулж тусад нь хураангуйлна
  const digest = await makeDigest(message);
  if (digest) console.log('[Intel] Digest ✓');

  // Firestore-д хадгална — daily history + latest
  // `now` аль хэдийн УБ-ын цаг тул дахин шилжүүлбэл орой үед огноо нэг хоногоор
  // хэтэрдэг — шинэ Date-ээс нэг л удаа хөрвүүлнэ.
  const date = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Ulaanbaatar' });
  const payload = {
    message,
    digest: digest || null,
    timestamp: new Date().toISOString(),
    date,
    sources: ok,
  };
  // ЗАМЫН ДҮРЭМ: Firestore-ийн document зам ТЭГШ тоотой хэсэгтэй байх ёстой.
  // Хуучин `intel/daily/${date}` (5 хэсэг) нь collection зам байсан тул
  // .doc() шууд exception хаяж, intel job бүхэлдээ унадаг байв.
  await Promise.all([
    db.doc(`users/${uid}/intel/${date}`).set(payload),          // өдрийн түүх
    db.doc(`users/${uid}/intel/latest`).set(payload),           // backward compat
  ]);

  console.log('[Intel] Firestore ✓');
  console.log('[Intel] Preview:', message.slice(0, 120) + '...');
}

main().catch(err => {
  console.error('[Intel] Алдаа:', err.message);
  process.exit(1);
});
