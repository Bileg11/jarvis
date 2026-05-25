// ── JARVIS GHOST MARKETER ─────────────────────────────────────────
// Агуулга үүсгэж Telegram-д draft явуулаад ШУУД гарна
// Approval-г approval-checker.js тусдаа job шалгана

'use strict';
const admin = require('firebase-admin');

const {
  PEXELS_API_KEY,
  UNSPLASH_ACCESS_KEY,
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  TAVILY_KEY,
  SYSTEM_USE_TOKEN:          GITHUB_TOKEN,
} = process.env;

const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ── USED IMAGES ───────────────────────────────────────────────────
async function getUsedIds() {
  const snap = await db.doc(`users/${USER_UID}/marketing/usedImages`).get();
  return new Set(snap.exists ? (snap.data().ids || []) : []);
}

// ── TAVILY ────────────────────────────────────────────────────────
const SHANGHAI_TOPICS = [
  'Shanghai travel tips for Mongolians 2025',
  'Shanghai tourism hidden gems attractions',
  'Shanghai street food guide tourists',
  'Shanghai luxury VIP travel experience',
  'Mongolia expat life Shanghai guide',
  'Shanghai Bund night skyline tourism',
  'Shanghai traditional culture modern city',
  'China travel visa tips Mongolia',
  'Shanghai medical tourism packages',
  'Shanghai fashion Nanjing Road shopping',
];

const MONGOLIA_TOPICS = [
  'Mongolia trending news today',
  'Ulaanbaatar events concerts 2025',
  'Mongolia viral social media today',
  'Mongolia sports entertainment news',
];

async function getTrend() {
  const isMongolia = Math.random() < 0.3;
  const pool = isMongolia ? MONGOLIA_TOPICS : SHANGHAI_TOPICS;
  const q    = pool[Math.floor(Math.random() * pool.length)];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_KEY, query: q, max_results: 3, search_depth: 'basic' }),
    });
    const data = await res.json();
    const snippets = (data.results || []).map(r => r.content || '').join(' ').slice(0, 900);
    return { query: q, snippets, isMongolia };
  } catch {
    return { query: q, snippets: '', isMongolia };
  }
}

// ── GPT CAPTION ───────────────────────────────────────────────────
async function generateContent(query, snippets, isMongolia) {
  const ctx = isMongolia
    ? 'Монголын trending сэдвийг LFS Shanghai брэндтэй байгалийн байдлаар холбо.'
    : 'LFS Shanghai — Монгол аялагчдын Шанхайн VIP платформ.';

  const prompt = `${ctx}
Сэдэв: ${query}
Мэдээлэл: ${snippets || 'Шанхай хот.'}

CAPTION:
[3-4 өгүүлбэр, Монгол, inspire+inform, 4-6 emoji, "👉 bileg11.github.io" CTA]

HASHTAGS:
[18-22 hashtag Монгол+Англи+Хятад, зайгаар]

Зөвхөн CAPTION: HASHTAGS: хэсгүүд буцаана.`;

  try {
    const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 700, temperature: 0.88 }),
    });
    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content?.trim() || '';
    const cap  = raw.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i)?.[1]?.trim();
    const hash = raw.match(/HASHTAGS:\s*([\s\S]*?)$/i)?.[1]?.trim();
    return { caption: cap || null, hashtags: hash || null };
  } catch { return { caption: null, hashtags: null }; }
}

// ── IMAGES ────────────────────────────────────────────────────────
const IMG_KW = [
  'shanghai skyline night', 'shanghai bund river', 'shanghai modern architecture',
  'shanghai street food', 'shanghai traditional garden', 'china luxury city',
  'shanghai pudong view', 'mongolia landscape', 'china culture heritage',
];

async function pexelsImage(usedIds) {
  const kw = IMG_KW[Math.floor(Math.random() * IMG_KW.length)];
  try {
    const res  = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(kw)}&per_page=20&orientation=portrait`, { headers: { 'Authorization': PEXELS_API_KEY } });
    const data = await res.json();
    const fresh = (data.photos || []).filter(p => !usedIds.has(`px_${p.id}`));
    if (!fresh.length) return null;
    const p = fresh[Math.floor(Math.random() * Math.min(fresh.length, 8))];
    return { id: `px_${p.id}`, url: p.src.large2x || p.src.large, source: 'Pexels', keyword: kw };
  } catch { return null; }
}

async function unsplashImage(usedIds) {
  const kw = IMG_KW[Math.floor(Math.random() * IMG_KW.length)];
  try {
    const res  = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(kw)}&per_page=20&orientation=portrait`, { headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` } });
    const data = await res.json();
    const fresh = (data.results || []).filter(p => !usedIds.has(`us_${p.id}`));
    if (!fresh.length) return null;
    const p = fresh[Math.floor(Math.random() * Math.min(fresh.length, 8))];
    return { id: `us_${p.id}`, url: p.urls.regular, source: 'Unsplash', keyword: kw };
  } catch { return null; }
}

async function fetchImage(usedIds) {
  const usePx = Math.random() > 0.5;
  let img = usePx ? await pexelsImage(usedIds) : await unsplashImage(usedIds);
  if (!img) img = usePx ? await unsplashImage(usedIds) : await pexelsImage(usedIds);
  return img;
}

// ── TELEGRAM DRAFT ────────────────────────────────────────────────
async function sendDraft(caption, img, slot) {
  const label = slot === 'morning' ? '🌅 Өглөөний' : '🌆 Оройн';
  const text  = `🤖 *JARVIS GHOST MARKETER*\n${label} пост · 📸 ${img.source}\n\n${caption}\n\n_Approve хийхгүй бол 15 минутын дараа автомат нийтлэгдэнэ._`;
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:      TG_CHAT,
      photo:        img.url,
      caption:      text,
      parse_mode:   'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Пост болгох', callback_data: 'approve' }, { text: '❌ Цуцлах', callback_data: 'reject' }],
          [{ text: '🖼️ Зураг солих', callback_data: 'new_image' }, { text: '✏️ Текст засах', callback_data: 'edit_text' }],
        ],
      },
    }),
  });
  const data = await res.json();
  return data.result?.message_id || null;
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  const utcH = new Date().getUTCHours();
  const slot  = utcH < 6 ? 'morning' : 'evening';
  console.log(`[Ghost] ${slot} | ${new Date().toISOString()}`);

  const usedIds = await getUsedIds();

  // ── Weekly queue шалгана ──────────────────────────────────────
  const today    = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
  const queueKey = `${today}-${slot}`;
  const qSnap    = await db.doc(`users/${USER_UID}/marketing/weeklyQueue`).get();
  const queued   = qSnap.exists ? qSnap.data()?.[queueKey] : null;

  let caption, hashtags;

  if (queued && !queued.used) {
    // Queue-с ашиглана — Tavily + GPT алгасна
    caption  = queued.caption;
    hashtags = queued.hashtags;
    console.log(`[Ghost] Queue ашигласан: ${queued.topic.slice(0, 50)}`);
    // Ашигласан гэж тэмдэглэнэ
    await db.doc(`users/${USER_UID}/marketing/weeklyQueue`).set(
      { [queueKey]: { ...queued, used: true } }, { merge: true }
    );
  } else {
    // Fresh generation — Tavily + GPT
    const { query, snippets, isMongolia } = await getTrend();
    console.log(`[Ghost] Fresh topic: ${query}`);
    const gen = await generateContent(query, snippets, isMongolia);
    caption  = gen.caption  || 'Шанхай хот — Монгол аялагчдын мөрөөдлийн газар! 🌆\n\n👉 bileg11.github.io';
    hashtags = gen.hashtags || '#Шанхай #Shanghai #LFSShanghai #МонголАялал';
  }

  const img = await fetchImage(usedIds);
  if (!img) { console.error('[Ghost] No image found'); process.exit(1); }
  console.log(`[Ghost] Image: ${img.source} ${img.id}`);

  // Telegram-н бүх хуучин update-г цэвэрлэж шинэ offset авна
  const tgRes1   = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?limit=100`);
  const tgData1  = await tgRes1.json();
  const allUpds  = tgData1.result || [];
  const tgOffset = allUpds.length ? allUpds[allUpds.length - 1].update_id + 1 : 0;
  // Хуучин update-г acknowledge хийнэ
  if (tgOffset > 0) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${tgOffset}&limit=1`);
  }

  const msgId = await sendDraft(caption, img, slot);
  if (!msgId) { console.error('[Ghost] Telegram send failed'); process.exit(1); }
  console.log(`[Ghost] Draft sent. msgId: ${msgId}`);

  // Firestore-д pending state хадгална → approval-checker.js авна
  await db.doc(`users/${USER_UID}/marketing/pendingPost`).set({
    caption, hashtags,
    imageUrl:  img.url,
    imageId:   img.id,
    imageSource: img.source,
    imageKeyword: img.keyword,
    slot, telegramMsgId: msgId, tgOffset,
    status:    'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });

  console.log('[Ghost] State saved to Firestore. Exiting.');
  process.exit(0);
}

main().catch(e => { console.error('[Ghost] Fatal:', e.message); process.exit(1); });
