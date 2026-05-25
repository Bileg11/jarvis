'use strict';
// ── JARVIS WEEKLY PLANNER ─────────────────────────────────────────
// Даваа гаригт дараагийн 7 хоногийн 14 post topic үүсгэж Firestore-д хадгална
// ghost-poster.js queue-г шалгаж, байгаа бол ашиглана (Tavily/GPT алгасна)

const admin = require('firebase-admin');
const fetch  = require('node-fetch');

const {
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT_ID,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  SYSTEM_USE_TOKEN:          GITHUB_TOKEN,
  TAVILY_KEY,
} = process.env;

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
}
const db = admin.firestore();

async function tgSend(text) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'Markdown' }),
  });
}

// ── TAVILY: 7 өдрийн topic цуглуулна ─────────────────────────────
const TOPIC_POOL = [
  'Shanghai travel hidden gems 2025',
  'Shanghai street food guide tourists',
  'Shanghai luxury experience Mongolians',
  'Shanghai Bund skyline night view',
  'Mongolia expat community Shanghai',
  'Shanghai traditional culture modern',
  'China visa travel tips Mongolia',
  'Shanghai Pudong architecture',
  'Shanghai shopping Nanjing Road',
  'Shanghai wellness spa experience',
  'Mongolia trending lifestyle 2025',
  'Shanghai food tour local favorites',
  'China travel budget tips',
  'Shanghai art galleries museums',
];

async function fetchSnippet(query) {
  try {
    const res  = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_KEY, query, max_results: 2, search_depth: 'basic' }),
    });
    const data = await res.json();
    return (data.results || []).map(r => r.content || '').join(' ').slice(0, 500);
  } catch { return ''; }
}

// ── GPT: 7 post нэгдсэн prompt-р үүсгэнэ ────────────────────────
async function generateWeeklyPosts(topics) {
  const topicList = topics.map((t, i) => `${i+1}. ${t.topic} (${t.slot})`).join('\n');
  const prompt = `LFS Shanghai — Монгол аялагчдын Шанхайн VIP платформ.
Дараах 14 Instagram post-г үүсгэ:

${topicList}

Формат (яг ингэж):
POST1_CAPTION: [3-4 өгүүлбэр Монголоор, 3-4 emoji, "👉 bileg11.github.io" CTA]
POST1_HASHTAGS: [15-18 hashtag Монгол+Англи, зайгаар]
POST2_CAPTION: ...
POST2_HASHTAGS: ...
...POST14_HASHTAGS: ...

Зөвхөн энэ форматаар буцаа.`;

  try {
    const res  = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.85,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('[Planner] GPT error:', e.message);
    return '';
  }
}

function parsePost(raw, index) {
  const n       = index + 1;
  const cap     = raw.match(new RegExp(`POST${n}_CAPTION:\\s*([\\s\\S]*?)(?=POST${n}_HASHTAGS:|POST${n+1}_CAPTION:|$)`, 'i'))?.[1]?.trim();
  const hash    = raw.match(new RegExp(`POST${n}_HASHTAGS:\\s*([\\s\\S]*?)(?=POST${n+1}_CAPTION:|$)`, 'i'))?.[1]?.trim();
  return { caption: cap || null, hashtags: hash || null };
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  console.log(`[Planner] Weekly plan starting... ${now.toISOString()}`);

  // 14 slot үүсгэнэ (7 өдөр × 2)
  const slots = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const ds = d.toLocaleDateString('sv');
    slots.push({ date: ds, slot: 'morning', idx: i * 2 });
    slots.push({ date: ds, slot: 'evening', idx: i * 2 + 1 });
  }

  // Topic-г pool-с random + Tavily snippet
  const topicsWithSnippets = await Promise.all(
    slots.map(async (s) => {
      const topicRaw = TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)];
      const snippets = await fetchSnippet(topicRaw);
      return { ...s, topic: topicRaw, snippets };
    })
  );

  console.log('[Planner] Topics ready, generating captions...');

  // GPT-р 14 caption нэгдсэн дуудалт
  const raw  = await generateWeeklyPosts(topicsWithSnippets);
  const queue = {};

  for (let i = 0; i < 14; i++) {
    const s    = topicsWithSnippets[i];
    const post = parsePost(raw, i);
    const key  = `${s.date}-${s.slot}`;
    queue[key] = {
      topic:    s.topic,
      caption:  post.caption || `Шанхай хот — Монгол аялагчдын мөрөөдлийн газар! 🌆\n👉 bileg11.github.io`,
      hashtags: post.hashtags || '#Шанхай #Shanghai #LFSShanghai',
      used:     false,
      createdAt: new Date().toISOString(),
    };
  }

  await db.doc(`users/${USER_UID}/marketing/weeklyQueue`).set(queue);
  console.log('[Planner] Saved 14 posts to Firestore queue');

  // Telegram-д долоо хоногийн хуваарь явуулна
  const DAYS = ['Ня','Да','Мя','Лх','Пү','Ба','Бя'];
  let msg = `📅 *Долоо хоногийн Post Хуваарь*\n_(${slots[0].date} → ${slots[13].date})_\n\n`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const ds = d.toLocaleDateString('sv');
    const dayName = DAYS[d.getDay()];
    const morn = queue[`${ds}-morning`];
    const even = queue[`${ds}-evening`];
    msg += `*${dayName}*  ${ds}\n`;
    msg += `  🌅 ${(morn?.topic || '').slice(0, 45)}\n`;
    msg += `  🌆 ${(even?.topic || '').slice(0, 45)}\n`;
  }
  msg += `\n_Пост бүр зурагтайгаар автоматаар нийтлэгдэнэ._`;
  await tgSend(msg);

  console.log('[Planner] Done.');
}

main().catch(e => { console.error('[Planner] Fatal:', e.message); process.exit(1); });
