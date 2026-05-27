'use strict';
// ── JARVIS PERSONAL TELEGRAM BOT — v2.3 ──────────────────────────
// Sprint 2:  Voice-to-Action Agent      (handleVoice)
// Sprint 3:  HSK & Chinese Journal Coach (/journal upgrade)
// Sprint 5:  HSK Blitz Mode             (sendBrief + voice eval)
// Sprint 6:  Hook & Script Machine      (/hook + notionSaveScript)
// Sprint 10: HSK 3 Head Coach           (/hsk_drill /listening /hsk_progress)

const fetch  = require('node-fetch');
const { dbPersonal }  = require('../firebase');
const { notionSave }  = require('./notion');
const {
  isConfigured: calOk,
  parseEvent,
  createEvent,
  listTodayEvents,
  listUpcomingEvents,
  deleteEvent,
  formatEventTime,
  formatEventDate,
} = require('./calendar');
const { isConfigured: gmailOk, getUnreadEmails } = require('./gmail');
const {
  HSK_VOCAB_ALL,
  seedVocab,
  getWeakWords,
  updateMastery,
  getProgress,
  getDrillSession,
  saveDrillSession,
  clearDrillSession,
} = require('./hsk3-coach');

const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TG_CHAT    = process.env.TELEGRAM_ID;   // cron job-д ашиглана
const UID        = process.env.USER_UID;       // cron job-д ашиглана (default)
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = GEMINI_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`
  : null;

// ── BILEG SYSTEM INSTRUCTION — HSK 3 HEAD COACH + Personal AI ────
const BILEG_SYSTEM = { parts: [{ text:
  `Чи J.A.R.V.I.S — Билэгийн хувийн AI туслагч бөгөөд HSK 3 Head Coach юм.\n\n` +

  `━━ ХЭРЭГЛЭГЧИЙН ПРОФАЙЛ ━━\n` +
  `• Нэр: Билэг, 18 настай Монгол залуу\n` +
  `• Байршил: Шанхай, ганцаараа амьдардаг\n` +
  `• Бизнес: LFS Shanghai (bileg11.github.io) — Монгол аялагчдад VIP туслалцаа\n` +
  `• Tech: React, Firebase, Node.js, Railway\n` +
  `• Зорилго: AI-г бүрэн ашиглах, LFS бизнес болгох\n\n` +

  `━━ HSK 3 COACH ДҮРЭМ ━━\n` +
  `• Шалгалт: 2026/06/28 — 100% оноо авах ёстой\n` +
  `• Хуваарь: 09:40–15:00 хичээл (завгүй), 15:00+ хувийн бэлтгэл\n` +
  `• Чи маш хатуу, сахилга баттай, үр дүн л шаарддаг coach\n` +
  `• Өдөр бүр "Daily Drill" төлөвлөгөө гаргаж өгнө\n` +
  `• Shалгахдаа өмнөх алдсан үгс дээр төвлөрнө (Spaced Repetition)\n` +
  `• 15:00-аас хойш суралцах цагийг дэмжиж, хойшлуулах шалтаг хүлээхгүй\n` +
  `• Алдааг шууд зааж, урамшуулал + шаардлагыг хослуул\n\n` +

  `━━ ХАРИЛЦАХ ХЭЛБЭР ━━\n` +
  `• Үргэлж Монголоор хариул\n` +
  `• Найрсаг ч хатуу — Stark-level precision\n` +
  `• Telegram Markdown ашигла (*bold*, _italic_, \`code\`)\n` +
  `• Дараагийн алхмыг үргэлж санал бол`,
}]};

// ── HSK WORD BANK (HSK 4-6 хэцүү ханзууд) ───────────────────────
const HSK_BANK = [
  { char: '焦虑', pinyin: 'jiāolǜ',    meaning: 'санаа зоволт, түгшүүр',         level: 5 },
  { char: '尴尬', pinyin: 'gāngà',     meaning: 'эвгүй байдал',                  level: 6 },
  { char: '逐渐', pinyin: 'zhújiàn',   meaning: 'аажмаар',                        level: 4 },
  { char: '坚持', pinyin: 'jiānchí',   meaning: 'тэвчих, үргэлжлүүлэх',          level: 4 },
  { char: '影响', pinyin: 'yǐngxiǎng', meaning: 'нөлөөлөх, нөлөө',               level: 4 },
  { char: '提高', pinyin: 'tígāo',     meaning: 'дээшлүүлэх, нэмэгдүүлэх',       level: 4 },
  { char: '复杂', pinyin: 'fùzá',      meaning: 'төвөгтэй, нарийн',               level: 5 },
  { char: '环境', pinyin: 'huánjìng',  meaning: 'орчин, тойрон',                  level: 4 },
  { char: '机会', pinyin: 'jīhuì',     meaning: 'боломж, тохиолдол',              level: 4 },
  { char: '努力', pinyin: 'nǔlì',      meaning: 'хичээх, хөдөлмөрлөх',           level: 4 },
  { char: '压力', pinyin: 'yālì',      meaning: 'дарамт, стресс',                 level: 5 },
  { char: '成功', pinyin: 'chénggōng', meaning: 'амжилт, амжилтанд хүрэх',       level: 4 },
  { char: '习惯', pinyin: 'xíguàn',    meaning: 'зуршил, дадал',                  level: 4 },
  { char: '挑战', pinyin: 'tiǎozhàn',  meaning: 'сорилт, сорин тулгарах',         level: 5 },
  { char: '突破', pinyin: 'tūpò',      meaning: 'нэвтэрч гарах, шинэ ололт',      level: 5 },
  { char: '目标', pinyin: 'mùbiāo',    meaning: 'зорилт, зорилго',               level: 4 },
  { char: '规律', pinyin: 'guīlǜ',     meaning: 'дэг журам, тогтмол хэв',         level: 5 },
  { char: '专注', pinyin: 'zhuānzhù',  meaning: 'төвлөрөх, анхаарлаа хандуулах', level: 5 },
  { char: '积累', pinyin: 'jīlěi',     meaning: 'хуримтлуулах, цуглуулах',        level: 5 },
  { char: '执行', pinyin: 'zhíxíng',   meaning: 'биелүүлэх, гүйцэтгэх',          level: 5 },
  { char: '效率', pinyin: 'xiàolǜ',    meaning: 'үр ашиг, хурд',                  level: 5 },
  { char: '竞争', pinyin: 'jìngzhēng', meaning: 'өрсөлдөх, өрсөлдөөн',           level: 5 },
  { char: '发展', pinyin: 'fāzhǎn',    meaning: 'хөгжих, хөгжүүлэх',              level: 4 },
  { char: '解决', pinyin: 'jiějué',    meaning: 'шийдвэрлэх, шийдэх',             level: 4 },
  { char: '创业', pinyin: 'chuàngyè',  meaning: 'бизнес эхлүүлэх',               level: 6 },
];

// ── MULTI-USER ROUTING ────────────────────────────────────────────
// Firestore: telegram_lookup/${chatId} → { uid }
// profile:   users/${uid}/profile → { name, system_instruction, custom_api_key, ... }

async function findUserByChatId(chatId) {
  try {
    const snap = await dbPersonal.doc(`telegram_lookup/${chatId}`).get();
    if (!snap.exists) return null;
    const { uid } = snap.data();
    if (!uid) return null;
    const pSnap = await dbPersonal.doc(`users/${uid}/meta/profile`).get();
    const profile = pSnap.exists ? pSnap.data() : {};
    return { uid, chatId: String(chatId), ...profile };
  } catch (e) {
    console.error('[Routing] findUserByChatId error:', e.message);
    return null;
  }
}

// Билэгийн анхдагч профайлыг Firestore-д автоматаар үүсгэх
async function seedBilegProfile() {
  try {
    const uid  = UID;
    const chat = TG_CHAT;
    if (!uid) return;

    const pRef  = dbPersonal.doc(`users/${uid}/meta/profile`);
    const pSnap = await pRef.get();

    // Зөвхөн system_instruction байхгүй бол seed хийнэ
    if (!pSnap.exists || !pSnap.data()?.system_instruction) {
      await pRef.set({
        name:               'Билэг',
        username_slug:      'bileg',
        telegram_chat_id:   String(chat || ''),
        system_instruction: BILEG_SYSTEM.parts[0].text,
        custom_api_key:     '',
        telegram_bot_token: '',
        seededAt:           new Date().toISOString(),
      }, { merge: true });
      console.log('[Seed] Bileg profile created in Firestore');
    }

    // Reverse lookup
    if (chat) {
      await dbPersonal.doc(`telegram_lookup/${chat}`).set(
        { uid, seededAt: new Date().toISOString() },
        { merge: true }
      );
    }
  } catch (e) {
    console.error('[Seed] seedBilegProfile error:', e.message);
  }
}

// ── TELEGRAM HELPERS ──────────────────────────────────────────────
async function tgCall(method, body) {
  const r    = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await r.json();
  if (!data.ok) console.error(`[TG] ${method} failed:`, JSON.stringify(data.description || data));
  return data;
}
const tgSend   = (text, extra = {}) =>
  tgCall('sendMessage', { chat_id: TG_CHAT, text, parse_mode: 'Markdown', ...extra });
const tgAnswer = (id, text = '') =>
  tgCall('answerCallbackQuery', { callback_query_id: id, text });

// ── PERSONAL MEMORY ───────────────────────────────────────────────
async function getBilegProfile(uid = UID) {
  try {
    const snap = await dbPersonal.doc(`users/${uid}/bileg/profile`).get();
    return snap.exists ? snap.data() : {};
  } catch { return {}; }
}
async function saveBilegProfile(updates, uid = UID) {
  try {
    await dbPersonal.doc(`users/${uid}/bileg/profile`).set(
      { ...updates, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

// ── CHAT HISTORY — Sliding Window (max 10) ────────────────────────
// Path: users/${uid}/meta/chat  (web + Telegram хоёулаа энэ path ашиглана)
// Format: { role: 'user'|'assistant', content: '...' }
//   → web gemini.js _migrateMsg() backward-compat-тэй

async function getChatHistory(uid = UID) {
  try {
    const snap = await dbPersonal.doc(`users/${uid}/meta/chat`).get();
    if (!snap.exists) return [];
    const msgs = snap.data().history || snap.data().messages || [];
    // Migrate Gemini-format { role:'model', parts:[{text}] } → { role:'assistant', content }
    return msgs.map(m => {
      if (m.content !== undefined) return m;            // already new format
      const text = m.parts?.[0]?.text || '';
      return { role: m.role === 'model' ? 'assistant' : (m.role || 'user'), content: text };
    });
  } catch { return []; }
}

async function saveChatHistory(msgs, uid = UID) {
  try {
    // Хадгалахдаа шинэ format ашиглана, web-ийн DB.saveChatHistory()-тэй compatible
    await dbPersonal.doc(`users/${uid}/meta/chat`).set({
      history:   msgs.slice(-10),
      updatedAt: new Date().toISOString(),
    });
  } catch {}
}

async function appendHistory(role, text, uid = UID) {
  const hist = await getChatHistory(uid);
  // role: 'user' | 'assistant' (Telegram-д 'model' → 'assistant')
  const normRole = role === 'model' ? 'assistant' : role;
  hist.push({ role: normRole, content: String(text).slice(0, 600) });
  await saveChatHistory(hist, uid);
}

// ── TASK MANAGER ──────────────────────────────────────────────────
async function getTasks(uid = UID) {
  try {
    const snap = await dbPersonal.collection(`users/${uid}/tasks`)
      .where('done', '==', false).get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch { return []; }
}
async function addTask(text, uid = UID) {
  try {
    await dbPersonal.collection(`users/${uid}/tasks`).add({
      text, done: false, createdAt: new Date().toISOString(),
    });
  } catch {}
}
async function doneTask(index, uid = UID) {
  try {
    const tasks = await getTasks(uid);
    const task  = tasks[index - 1];
    if (!task) return null;
    await dbPersonal.doc(`users/${uid}/tasks/${task.id}`).update({
      done: true, doneAt: new Date().toISOString(),
    });
    return task.text;
  } catch { return null; }
}

// ── ROUTINE HELPERS ───────────────────────────────────────────────
const todaySH = () => new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

async function getScore(uid = UID) {
  const d = todaySH();
  const [r, l] = await Promise.all([
    dbPersonal.doc(`users/${uid}/routines/${d}`).get(),
    dbPersonal.doc(`users/${uid}/logs/${d}`).get(),
  ]);
  const rt    = r.exists ? r.data() : {};
  const water = l.exists ? (l.data().water?.total_ml || 0) : 0;
  const score = Math.min(100, Math.round(
    (water / 2000 * 25) + (rt.exercise ? 20 : 0) + (rt.hanzi ? 20 : 0) +
    (rt.read ? 15 : 0) + (rt.journal ? 10 : 0)
  ));
  return { score, routine: rt, water };
}

async function getStreak(key, uid = UID) {
  let s = 0;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  for (let i = 0; i < 30; i++) {
    const d  = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toLocaleDateString('sv');
    const snap = await dbPersonal.doc(`users/${uid}/routines/${ds}`).get();
    if (!snap.exists || !snap.data()[key]) break;
    s++;
  }
  return s;
}

async function logRoutine(key, uid = UID) {
  await dbPersonal.doc(`users/${uid}/routines/${todaySH()}`).set(
    { [key]: true, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

async function logWater(ml, uid = UID) {
  const d     = todaySH();
  const snap  = await dbPersonal.doc(`users/${uid}/logs/${d}`).get();
  const cur   = snap.exists ? (snap.data().water?.total_ml || 0) : 0;
  const total = cur + ml;
  await dbPersonal.doc(`users/${uid}/logs/${d}`).set(
    { water: { total_ml: total } },
    { merge: true }
  );
  return total;
}

// ── NOTION CONTENT DB — шинэ хуудас нээж хадгалах (Sprint 6) ─────
// NOTION_CONTENT_DB_ID: Notion-д тусдаа Content database-ийн ID
// notion.js-ийн notionSave() нь JARVIS page-д append хийдэг;
// notionSaveScript() нь Content DB-д шинэ PAGE үүсгэдэг.
async function notionSaveScript(title, content) {
  const token  = process.env.NOTION_TOKEN;
  const pageId = process.env.NOTION_DB_ID; // JARVIS хуудасны доор sub-page үүснэ
  if (!token || !pageId) return null;

  const today = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

  // Content-г 1900 тэмдэгтийн блок болгон хуваах (Notion 2000 хязгаар)
  const chunkSize = 1900;
  const chunks    = [];
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.slice(i, i + chunkSize));
  }

  const children = [
    {
      object: 'block',
      type:   'callout',
      callout: {
        rich_text: [{ type: 'text', text: {
          content: `🎬 J.A.R.V.I.S автоматаар үүсгэв — ${today}`,
        }}],
        icon:  { emoji: '🎬' },
        color: 'gray_background',
      },
    },
    ...chunks.map(chunk => ({
      object: 'block',
      type:   'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: chunk } }],
      },
    })),
  ];

  try {
    // JARVIS хуудасны доор шинэ sub-page үүсгэх (page_id ашиглана)
    const r = await fetch('https://api.notion.com/v1/pages', {
      method:  'POST',
      headers: {
        Authorization:    `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent:     { page_id: pageId },
        properties: {
          title: {
            title: [{ type: 'text', text: { content: title.slice(0, 100) } }],
          },
        },
        children,
      }),
    });

    const d = await r.json();
    if (d.object === 'error') {
      console.error('[Notion Script] API error:', d.message);
      return null;
    }
    return d.url || `https://notion.so/${(d.id || '').replace(/-/g, '')}`;

  } catch (e) {
    console.error('[Notion Script] Error:', e.message);
    return null;
  }
}

// ── WEEKLY REPORT ─────────────────────────────────────────────────
async function sendWeeklyReport() {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const days = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    days.push(d.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' }));
  }

  const routineSnaps = await Promise.all(
    days.map(d => dbPersonal.doc(`users/${UID}/routines/${d}`).get())
  );

  const routineKeys = ['exercise', 'hanzi', 'read', 'journal'];
  const cnt = {};
  routineKeys.forEach(k => { cnt[k] = 0; });
  routineSnaps.forEach(snap => {
    if (!snap.exists) return;
    const d = snap.data();
    routineKeys.forEach(k => { if (d[k]) cnt[k]++; });
  });

  const pct     = n => `${Math.round(n / 7 * 100)}%`;
  const weakest = routineKeys.reduce((a, b) => cnt[a] <= cnt[b] ? a : b);
  const labels  = {
    exercise: 'Дасгал 💪', hanzi: '汉字 🈶',
    read: 'Уншилт 📚',    journal: 'Journal 📝',
  };

  const tasks = await getTasks();

  let msg = `📊 *7 ХОНОГИЙН ТАЙЛАН*\n`;
  msg += `_${days[6]} → ${days[0]}_\n`;
  msg += `\`────────────────────\`\n\n`;
  msg += `💪 *Routine:*\n`;
  msg += `• Дасгал: *${cnt.exercise}/7* (${pct(cnt.exercise)})\n`;
  msg += `• 汉字: *${cnt.hanzi}/7* (${pct(cnt.hanzi)})\n`;
  msg += `• Уншилт: *${cnt.read}/7* (${pct(cnt.read)})\n`;
  msg += `• Journal: *${cnt.journal}/7* (${pct(cnt.journal)})\n`;
  msg += `\n📌 Сул тал: *${labels[weakest]}* — энэ долоо хоног анхаарна уу.\n`;

  if (tasks.length) {
    msg += `\n📋 Хийгдэхгүй үлдсэн tasks: *${tasks.length}*\n`;
    tasks.slice(0, 3).forEach(t => { msg += `• ${t.text}\n`; });
  }

  msg += `\n⚡ _J.A.R.V.I.S_`;
  await tgCall('sendMessage', { chat_id: TG_CHAT, text: msg, parse_mode: 'Markdown' });
}

// ── MORNING BRIEF (Sprint 5: HSK Blitz нэмэгдсэн) ─────────────────
async function sendBrief() {
  const now       = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const todaySHx  = now.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
  const yesterday = new Date(Date.now() - 86400000)
    .toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

  const calEventsPromise = calOk()   ? listTodayEvents().catch(() => [])  : Promise.resolve([]);
  const gmailPromise     = gmailOk() ? getUnreadEmails(3).catch(() => []) : Promise.resolve([]);

  const [bilegSnap, tasksRaw, routineSnap, logSnap, calEvents, gmailEmails] = await Promise.all([
    dbPersonal.doc(`users/${UID}/bileg/profile`).get(),
    dbPersonal.collection(`users/${UID}/tasks`).where('done', '==', false).get()
      .catch(() => ({ docs: [] })),
    dbPersonal.doc(`users/${UID}/routines/${yesterday}`).get(),
    dbPersonal.doc(`users/${UID}/logs/${yesterday}`).get(),
    calEventsPromise,
    gmailPromise,
  ]);

  const bileg = bilegSnap.exists ? bilegSnap.data() : {};
  const tasks = tasksRaw.docs
    .map(d => d.data())
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .slice(0, 5).map(t => t.text);

  const rt    = routineSnap.exists ? routineSnap.data() : {};
  const water = logSnap.exists ? (logSnap.data().water?.total_ml || 0) : 0;

  const routineItems = [
    { key: 'exercise', label: 'Дасгал', emoji: '💪' },
    { key: 'hanzi',    label: '汉字',   emoji: '🈶' },
    { key: 'read',     label: 'Уншилт', emoji: '📚' },
    { key: 'journal',  label: 'Journal',emoji: '📝' },
  ];
  const done   = routineItems.filter(r => rt[r.key]);
  const missed = routineItems.filter(r => !rt[r.key]);

  // Gemini өглөөний зөвлөгөө
  const context = [
    `Өнөөдөр: ${todaySHx}.`,
    done.length   ? `Хийсэн: ${done.map(r => r.label).join(', ')}.`   : 'Өчигдөр routine хийгдэхгүй.',
    missed.length ? `Хийгдэхгүй: ${missed.map(r => r.label).join(', ')}.` : '',
    `Ус: ${water}мл.`,
    bileg.goal   ? `Зорилго: "${bileg.goal}".` : '',
    tasks.length ? `Хийх tasks: ${tasks.slice(0, 3).join(', ')}.` : '',
    `Билэгийн хувийн J.A.R.V.I.S. Өчигдрийн үр дүнд тулгуурлан 2-3 өгүүлбэр проактив, шууд зөвлөгөө өг. Монголоор, анхаарлын тэмдэггүй.`,
  ].filter(Boolean).join(' ');

  let advice = 'Өнөөдөр нэг алхам урагш.';
  if (GEMINI_URL) {
    try {
      const r = await fetch(GEMINI_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: context }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.85 },
        }),
      });
      const data  = await r.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const part  = parts.find(p => !p.thought && p.text) || parts[0];
      advice = part?.text?.trim() || advice;
    } catch {}
  }

  // ── HSK Blitz: өнөөдрийн 5 ханз сонгох (Sprint 5) ───────────────
  const todayWords = [...HSK_BANK].sort(() => Math.random() - 0.5).slice(0, 5);

  // Firestore-д хадгалах — handleVoice-д ашиглана
  dbPersonal.doc(`users/${UID}/hsk/today`).set({
    words:     todayWords,
    date:      todaySHx,
    scored:    false,
    updatedAt: new Date().toISOString(),
  }).catch(() => {});

  const dayNames = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
  const dayName  = dayNames[now.getDay()];

  let msg = `🌅 Өглөөний мэнд, Билэг.\n`;
  msg += `${dayName}, ${todaySHx} | Шанхай 07:30\n\n`;

  msg += `Routine: `;
  msg += done.length ? done.map(r => r.emoji + r.label).join(' ') : 'хийгдэхгүй';
  msg += ` | Ус: ${water}мл\n`;

  if (tasks.length) {
    msg += `\n📋 Хийх (${tasks.length}):\n`;
    tasks.forEach((t, i) => { msg += `${i + 1}. ${t}\n`; });
  }

  if (bileg.goal) msg += `\n🎯 ${bileg.goal}\n`;

  if (calEvents && calEvents.length) {
    msg += `\n📅 Өнөөдрийн хуваарь:\n`;
    calEvents.forEach(e => { msg += `• ${formatEventTime(e)} — ${e.summary}\n`; });
  }

  if (gmailEmails && gmailEmails.length) {
    msg += `\n📧 Уншаагүй имэйл (${gmailEmails.length}):\n`;
    gmailEmails.forEach(e => {
      msg += `• ${e.from.slice(0, 20)} — ${e.subject.slice(0, 40)}\n`;
    });
  }

  msg += `\n💡 J.A.R.V.I.S:\n${advice}\n`;

  // HSK Blitz хэсэг
  msg += `\n\n🈶 *Өнөөдрийн 5 ханз (HSK Blitz):*\n`;
  todayWords.forEach(w => {
    msg += `• *${w.char}* (${w.pinyin}) — ${w.meaning} [HSK${w.level}]\n`;
  });
  msg += `\n_Дуут зурвасаар өгүүлбэр зохио — J.A.R.V.I.S оноо өгнө 🎯_`;

  msg += `\n\n⚡ J.A.R.V.I.S ажиллаж байна.`;

  await tgCall('sendMessage', { chat_id: TG_CHAT, text: msg });
}

// ── VOICE-TO-ACTION AGENT (Sprint 2 + Sprint 5 HSK eval) ─────────
async function handleVoice(msg, ctx = {}) {
  const uid = ctx.uid || UID;
  if (!GEMINI_URL) { await tgSend('⚠️ GEMINI_API_KEY тохиргоогүй.'); return; }

  await tgSend('🎙 Аудио ойлгож байна...');

  try {
    // 1. Telegram-аас file_path авах
    const fileInfo = await tgCall('getFile', { file_id: msg.voice.file_id });
    const filePath = fileInfo.result?.file_path;
    if (!filePath) { await tgSend('❌ Аудио файл авч чадсангүй.'); return; }

    // 2. Файл татаж авах → base64
    const fileUrl = `https://api.telegram.org/file/bot${TG_TOKEN}/${filePath}`;
    const resp    = await fetch(fileUrl);
    const buffer  = await resp.buffer();
    const base64  = buffer.toString('base64');

    // ── Sprint 5: HSK Blitz шалгалт байгаа эсэхийг эхлээд шалгах ─
    const hskSnap = await dbPersonal.doc(`users/${uid}/hsk/today`).get();
    const hskData = hskSnap.exists ? hskSnap.data() : null;
    const isHskActive =
      hskData !== null &&
      hskData.date === todaySH() &&
      hskData.scored === false &&
      Array.isArray(hskData.words) &&
      hskData.words.length > 0;

    if (isHskActive) {
      const wordList = hskData.words.map(w => w.char).join(', ');

      const hskPrompt =
        `Хэрэглэгч өнөөдрийн ханзуудыг ашиглан өгүүлбэр зохиосон байх ёстой.\n` +
        `Шалгах ханзууд: ${wordList}\n\n` +
        `Аудиог сонсоод дараах JSON-г буцаа (өөр тайлбар текст хэрэггүй):\n` +
        `{\n` +
        `  "transcript": "аудионы текст",\n` +
        `  "used_words": ["ашигласан ханзуудын жагсаалт"],\n` +
        `  "pronunciation_score": 80,\n` +
        `  "grammar_score": 85,\n` +
        `  "usage_score": 90,\n` +
        `  "total_score": 85,\n` +
        `  "feedback": "Монголоор 1-2 өгүүлбэр урам өгөх санал. Анхаарлын тэмдэггүй."\n` +
        `}\n\n` +
        `total_score = (pronunciation_score + grammar_score + usage_score) / 3`;

      const hskResp = await fetch(GEMINI_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role:  'user',
            parts: [
              { inline_data: { mime_type: 'audio/ogg; codecs=opus', data: base64 } },
              { text: hskPrompt },
            ],
          }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
        }),
      });

      const hskResult = await hskResp.json();
      const hskRaw    = hskResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      const hskMatch  = hskRaw?.match(/\{[\s\S]*\}/);

      if (hskMatch) {
        try {
          const eval_  = JSON.parse(hskMatch[0]);
          const total  = Math.min(100, Math.max(0, Math.round(eval_.total_score || 0)));

          // Оноог Firestore-д хадгалах (вэбсайтын HSK chart)
          const scoreRef  = dbPersonal.doc(`users/${uid}/hsk/scores`);
          const scoreSnap = await scoreRef.get();
          const existing  = scoreSnap.exists ? (scoreSnap.data().list || []) : [];
          existing.push({
            score:   total,
            date:    todaySH(),
            words:   eval_.used_words || [],
            savedAt: new Date().toISOString(),
          });
          // Хамгийн сүүлийн 30 оноог л хадгална
          if (existing.length > 30) existing.splice(0, existing.length - 30);
          await scoreRef.set({ list: existing, updatedAt: new Date().toISOString() });

          // Өнөөдрийн challenge дуусгасан болгох
          await dbPersonal.doc(`users/${uid}/hsk/today`).set(
            { scored: true }, { merge: true }
          );

          // Дасгал хийсэн тул hanzi routine тэмдэглэх
          await logRoutine('hanzi', uid);

          let hskMsg =
            `🈶 *HSK Шалгалт — ${total}/100*\n\n` +
            `🎙 _"${(eval_.transcript || '').slice(0, 120)}"_\n\n` +
            `📊 Дуудлага: ${eval_.pronunciation_score || 0}/100\n` +
            `📝 Дүрэм: ${eval_.grammar_score || 0}/100\n` +
            `✍️ Ашиглалт: ${eval_.usage_score || 0}/100\n\n` +
            `✅ Ашигласан ханзууд: ${(eval_.used_words || []).join(', ') || '—'}\n\n` +
            `💬 ${eval_.feedback || ''}`;

          if (total >= 90)      hskMsg += '\n\n🔥 Гайхалтай! Тэргүүний үр дүн.';
          else if (total >= 75) hskMsg += '\n\n👍 Сайн байна. Үргэлжлүүл.';
          else                  hskMsg += '\n\n💪 Дахин дасгалла — чадна.';

          await tgSend(hskMsg);
          return; // HSK eval дууссан — Voice-to-Action руу явахгүй
        } catch (parseErr) {
          console.error('[HSK Voice] JSON parse error:', parseErr.message);
          // JSON алдаатай → доорх Voice-to-Action-д үргэлжлүүлнэ
        }
      }
    }

    // ── Sprint 2: Voice-to-Action ────────────────────────────────
    const actionPrompt =
      `Дараах аудиог транскрипц хийж, хийх action-уудыг задал.\n\n` +
      `Боломжит action төрлүүд:\n` +
      `- revenue: орлого бүртгэх → { type: "revenue", amount: тоо (₮-гүй) }\n` +
      `- calendar: event нэмэх → { type: "calendar", text: "цагийн мэдээлэлтэй текст" }\n` +
      `- task: даалгавар нэмэх → { type: "task", text: "даалгаврын текст" }\n` +
      `- routine: routine тэмдэглэх → { type: "routine", key: "exercise"|"hanzi"|"read"|"journal" }\n\n` +
      `Хариу формат (JSON ONLY, өөр текст, тайлбар хэрэггүй):\n` +
      `{ "transcript": "аудионы монгол текст", "actions": [] }\n\n` +
      `Хэрэв action байхгүй бол actions массив хоосон байна.`;

    const actionResp = await fetch(GEMINI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role:  'user',
          parts: [
            { inline_data: { mime_type: 'audio/ogg; codecs=opus', data: base64 } },
            { text: actionPrompt },
          ],
        }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
      }),
    });

    const actionData = await actionResp.json();
    // Debug log — Railway-д харагдана
    console.log('[Voice] Gemini raw:', JSON.stringify(actionData).slice(0, 400));

    // Gemini error шалгах
    if (actionData.error) {
      await tgSend(`❌ Gemini алдаа: ${actionData.error.message || 'Unknown'}`);
      return;
    }
    // Хоосон candidates
    if (!actionData.candidates?.length) {
      const reason = actionData.promptFeedback?.blockReason || 'candidates хоосон';
      await tgSend(`⚠️ Gemini хариу ирсэнгүй (${reason}). Дахин илгээнэ үү.`);
      return;
    }

    const rawText    = actionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const jsonMatch  = rawText?.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      await tgSend(`🎙 Транскрипц:\n_"${rawText || 'Ойлгож чадсангүй'}"_`);
      return;
    }

    const parsed     = JSON.parse(jsonMatch[0]);
    const transcript = parsed.transcript || '';
    const actions    = Array.isArray(parsed.actions) ? parsed.actions : [];

    let resultMsg = `🎙 *Ойлголоо:*\n_"${transcript}"_\n\n`;

    if (!actions.length) {
      resultMsg += '⚡ Хийх action илрэхгүй байна.';
      await tgSend(resultMsg);
      return;
    }

    // Action-уудыг дараалан гүйцэтгэх
    const resultLines = [];
    for (const action of actions) {
      try {
        if (action.type === 'revenue' && action.amount > 0) {
          const today    = todaySH();
          const ref      = dbPersonal.doc(`users/${uid}/revenue/${today}`);
          const revSnap  = await ref.get();
          const curTotal = revSnap.exists ? (revSnap.data().total || 0) : 0;
          await ref.set({
            total:     curTotal + Number(action.amount),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          resultLines.push(`💰 Орлого: *${Number(action.amount).toLocaleString()}₮* бүртгэлээ`);

        } else if (action.type === 'calendar' && action.text && calOk()) {
          const ev = parseEvent(action.text);
          if (ev?.date) {
            await createEvent(
              ev.title,
              `${ev.date}T${ev.startTime}:00`,
              `${ev.date}T${ev.endTime}:00`,
              ''
            );
            resultLines.push(`📅 Calendar: *${ev.title}* — ${ev.date} ${ev.startTime}`);
          } else {
            resultLines.push(`📅 Calendar: огноо ойлгогдсонгүй ("${action.text.slice(0, 40)}")`);
          }

        } else if (action.type === 'task' && action.text) {
          await addTask(action.text, uid);
          resultLines.push(`✅ Task: *${action.text}*`);

        } else if (action.type === 'routine' && action.key) {
          await logRoutine(action.key, uid);
          const labels = {
            exercise: 'Дасгал 💪', hanzi: '汉字 🈶',
            read:     'Уншилт 📚', journal: 'Journal 📝',
          };
          resultLines.push(`📌 ${labels[action.key] || action.key} тэмдэглэлээ`);
        }
      } catch (e) {
        resultLines.push(`⚠️ ${action.type} алдаа: ${e.message}`);
      }
    }

    resultMsg += resultLines.join('\n');
    await tgSend(resultMsg);

    // History-д хадгалах (Voice-to-Action, шинэ format)
    await saveChatHistory([
      ...(await getChatHistory(uid)),
      { role: 'user',      content: `[Voice] ${transcript}` },
      { role: 'assistant', content: resultMsg },
    ], uid);

  } catch (e) {
    console.error('[Voice] Error:', e.message);
    await tgSend(`❌ Voice алдаа: ${e.message}`);
  }
}

// ── CALLBACK HANDLER ──────────────────────────────────────────────
async function handleCallback(cb) {
  const { data: cmd, message, id: cbId } = cb;
  const msgId = message.message_id;
  await tgAnswer(cbId);

  // Calendar event устгах
  if (cmd.startsWith('caldel_')) {
    const eventId = cmd.slice(7);
    try {
      await deleteEvent(eventId);
      await tgCall('editMessageReplyMarkup', {
        chat_id: TG_CHAT, message_id: msgId, reply_markup: { inline_keyboard: [] },
      });
      await tgCall('editMessageText', {
        chat_id: TG_CHAT, message_id: msgId, text: '🗑 Устгагдлаа.',
      });
    } catch (e) {
      await tgCall('sendMessage', {
        chat_id: TG_CHAT, text: `❌ Устгаж чадсангүй: ${e.message}`,
      });
    }
    return;
  }

  // HSK Reminder + Dashboard кнопкууд
  if (cmd === 'hsk_start_drill') {
    await handleText({ text: '/hsk_drill' }, { uid: UID });
    return;
  }
  if (cmd === 'hsk_progress') {
    await handleText({ text: '/hsk_progress' }, { uid: UID });
    return;
  }
  // Level-specific drill: hsk_drill_3, hsk_drill_4 ...
  const lvlDrillMatch = cmd.match(/^hsk_drill_(\d)$/);
  if (lvlDrillMatch) {
    await handleText({ text: `/hsk_drill ${lvlDrillMatch[1]}` }, { uid: UID });
    return;
  }
}

// ── DRILL HELPERS (Sprint 10) ─────────────────────────────────────

// Drill-ийн асуултыг илгээх
async function sendDrillQuestion(session, idx, uid) {
  const w      = session.words[idx];
  const total  = session.words.length;
  const lvlTag = w.hsk_level ? `HSK ${w.hsk_level}` : 'HSK';

  await tgCall('sendMessage', {
    chat_id: TG_CHAT,
    text:
      `🎯 ${idx + 1}/${total} — ${lvlTag} Drill\n\n` +
      `${w.word}   [${w.pinyin}]\n\n` +
      `Юу гэсэн үг вэ? Монгол эсвэл Англиар хариул\n\n` +
      `/drill_stop — зогсоох`,
  });
}

// Хэрэглэгчийн хариултыг AI-аар шалгах
async function handleDrillAnswer(msg, ctx, session) {
  const uid      = ctx.uid || UID;
  const apiKey   = ctx.custom_api_key || process.env.SYSTEM_USE_TOKEN;
  const answer   = (msg.text || '').trim();
  const idx      = session.current;
  const w        = session.words[idx];

  if (!w) { await clearDrillSession(uid); return; }

  let correct = false;
  let feedback = '';

  if (apiKey) {
    // AI-аар хариулт шалгах
    try {
      const checkPrompt =
        `Chinese word: "${w.word}" (${w.pinyin})\n` +
        `Mongolian definition: "${w.definition}"\n` +
        (w.en ? `English definition: "${w.en}"\n` : '') +
        `User's answer: "${answer}"\n\n` +
        `Is the user's answer correct or close enough (accept Mongolian OR English answers)? Be lenient with synonyms and paraphrasing.\n` +
        `Reply JSON only: {"correct": true/false, "feedback": "one sentence in Mongolian"}`;

      const resp = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: checkPrompt }],
          max_tokens: 80, temperature: 0.2,
        }),
      });
      const data = await resp.json();
      const raw  = data.choices?.[0]?.message?.content?.trim() || '{}';
      const json = JSON.parse(raw.replace(/```json\n?|```/g, '').trim());
      correct  = !!json.correct;
      feedback = json.feedback || '';
    } catch {
      // Fallback: keyword match
      const defLower = w.definition.toLowerCase();
      const ansLower = answer.toLowerCase();
      correct = defLower.split(/[,\s]+/).some(kw => kw.length > 2 && ansLower.includes(kw));
      feedback = correct ? 'Зөв байна!' : `Хариулт: ${w.definition}${w.en ? ` / ${w.en}` : ''}`;
    }
  } else {
    // API key байхгүй: keyword match (Mongolian + English)
    const defLower = w.definition.toLowerCase();
    const enLower  = (w.en || '').toLowerCase();
    const ansLower = answer.toLowerCase();
    const mnMatch  = defLower.split(/[,\s;]+/).some(kw => kw.length > 2 && ansLower.includes(kw));
    const enMatch  = enLower.split(/[,\s;]+/).some(kw => kw.length > 2 && ansLower.includes(kw));
    correct  = mnMatch || enMatch;
    feedback = correct ? 'Зөв!' : `Хариулт: ${w.definition}${w.en ? ` / ${w.en}` : ''}`;
  }

  // Mastery шинэчлэх
  const newLevel = await updateMastery(w.word, correct, uid, w.hsk_level || null);
  const stars    = newLevel ? '⭐'.repeat(newLevel) : '';

  const resultText  = correct
    ? `✅ Зөв! ${feedback || ''}\n📈 Mastery: ${stars}`
    : `❌ Буруу. ${w.word} = ${w.definition}${w.en ? ` / ${w.en}` : ''}\n${feedback ? `${feedback}\n` : ''}📉 Mastery: ${stars}`;

  // Session шинэчлэх
  const newCorrect = session.correct + (correct ? 1 : 0);
  const newWrong   = session.wrong   + (correct ? 0 : 1);
  const nextIdx    = idx + 1;

  if (nextIdx >= session.words.length) {
    // Drill дууслаа!
    await clearDrillSession(uid);
    const pct   = Math.round(newCorrect / session.words.length * 100);
    const medal = pct >= 80 ? '🏆' : pct >= 60 ? '🥈' : '💪';
    const drillLvl = session.hsk_level || null;

    // Dynamic coaching: тухайн түвшний дэвшил шалгах
    let coachNote = pct >= 80 ? '💪 Гайхалтай! Хэмнэл хадгалаарай.' : '📚 Буруу үгсийг дахин давтаарай.';
    let nextLvlBtn = null;
    if (drillLvl) {
      try {
        const prog = await getProgress(uid);
        const lp   = prog?.byLevel?.[drillLvl];
        if (lp && lp.pct >= 80 && drillLvl < 6) {
          coachNote = `🎉 *HSK ${drillLvl} 80%+ давлаа!* Дараагийн түвшин рүү шилжихэд бэлэн байна.`;
          nextLvlBtn = { text: `➡️ HSK ${drillLvl + 1} эхлэх`, callback_data: `hsk_drill_${drillLvl + 1}` };
        }
      } catch {}
    }

    const kbd = nextLvlBtn
      ? { inline_keyboard: [[nextLvlBtn, { text: '📊 Дэвшил', callback_data: 'hsk_progress' }]] }
      : { inline_keyboard: [[{ text: '🔄 Дахин', callback_data: drillLvl ? `hsk_drill_${drillLvl}` : 'hsk_start_drill' }, { text: '📊 Дэвшил', callback_data: 'hsk_progress' }]] };

    await tgCall('sendMessage', {
      chat_id:      TG_CHAT,
      text:
        `${resultText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${medal} Drill дууслаа!\n\n` +
        `✅ Зөв: ${newCorrect}/${session.words.length} (${pct}%)\n` +
        `❌ Буруу: ${newWrong}\n\n` +
        `${coachNote}\n\n` +
        `/hsk_drill — дахин  |  /hsk_progress — дэвшил`,
      reply_markup: kbd,
    });
  } else {
    // Дараагийн үг
    await saveDrillSession({ ...session, current: nextIdx, correct: newCorrect, wrong: newWrong }, uid);
    await tgCall('sendMessage', {
      chat_id: TG_CHAT,
      text:    resultText,
    });
    // Жаахан зай өгсний дараа дараагийн асуулт
    await sendDrillQuestion({ ...session, current: nextIdx }, nextIdx, uid);
  }
}

// ── TEXT HANDLER ──────────────────────────────────────────────────
async function handleText(msg, ctx = {}) {
  const uid  = ctx.uid || UID;
  const raw  = msg.text || '';
  const text = raw.toLowerCase().trim();
  // System instruction: профайлаас авах, байхгүй бол module-level BILEG_SYSTEM
  const sysText = ctx.system_instruction || BILEG_SYSTEM.parts[0].text;
  // API key: профайлаас авах, байхгүй бол env var
  const apiKey  = ctx.custom_api_key || process.env.SYSTEM_USE_TOKEN;

  // ── Sprint 10: Active Drill session шалгах ───────────────────────
  // Хэрэв идэвхтэй drill session байвал хариултыг drill handler руу дамжуулна
  if (!text.startsWith('/')) {
    const session = await getDrillSession(uid);
    if (session?.active && session?.type === 'drill') {
      await handleDrillAnswer(msg, ctx, session);
      return;
    }
  }

  // ── Routine ──────────────────────────────────────────────────────
  if (text === '/score') {
    const { score, routine, water } = await getScore(uid);
    const [exS, hzS] = await Promise.all([getStreak('exercise', uid), getStreak('hanzi', uid)]);
    await tgSend(
      `📊 *Өнөөдрийн Score: ${score}/100*\n\n` +
      `${routine.exercise ? '✅' : '❌'} Дасгал (${exS}🔥)\n` +
      `${routine.hanzi    ? '✅' : '❌'} 汉字 (${hzS}🔥)\n` +
      `${routine.read     ? '✅' : '❌'} Унших\n` +
      `${routine.journal  ? '✅' : '❌'} Journal\n` +
      `💧 Ус: ${water}мл/2000мл`
    );
    return;
  }

  if (text === '/dasgal' || text.includes('дасгал') || text.includes('workout')) {
    await logRoutine('exercise', uid);
    const { score } = await getScore(uid);
    const s = await getStreak('exercise', uid);
    await tgSend(`💪 Дасгал тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`);
    return;
  }

  if (text === '/hanzi' || text.includes('汉字') || text.includes('hanzi')) {
    await logRoutine('hanzi', uid);
    const { score } = await getScore(uid);
    const s = await getStreak('hanzi', uid);
    await tgSend(`🈶 汉字 тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`);
    return;
  }

  if (text === '/nom' || text.includes('уншлаа') || text.includes('ном уншсан')) {
    await logRoutine('read', uid);
    const { score } = await getScore(uid);
    await tgSend(`📚 Уншилт тэмдэглэлээ! Score: ${score}/100`);
    return;
  }

  // ── /journal — Sprint 3: HSK Journal Coach ───────────────────────
  if (text === '/journal' || raw.startsWith('/journal ') || raw.startsWith('/journal\n')) {
    const journalText = (raw.startsWith('/journal ') || raw.startsWith('/journal\n'))
      ? raw.slice(9).trim() : '';

    if (!journalText) {
      // Текстгүй → хуучин хэлбэрээр log хийнэ
      await logRoutine('journal', uid);
      const { score } = await getScore(uid);
      await tgSend(
        `📝 Journal тэмдэглэлээ! Score: ${score}/100\n\n` +
        `_Хятад хэлээр тэмдэглэл бичихийн тулд:_\n` +
        `\`/journal 我今天去了上海...\``
      );
      return;
    }

    const hasChineseChars = /[一-鿿]/.test(journalText);

    if (hasChineseChars && GEMINI_URL) {
      await tgSend('🔍 HSK шалгаж байна...');
      try {
        const checkPrompt =
          `Дараах хятад хэлний текстийг шалгаж, JSON хэлбэрт хариул (өөр текст хэрэггүй):\n` +
          `"${journalText}"\n\n` +
          `{\n` +
          `  "score": 85,\n` +
          `  "errors": [\n` +
          `    { "wrong": "буруу үг/бүтэц", "correct": "зөв хэлбэр", "explanation": "Монголоор товч тайлбар" }\n` +
          `  ],\n` +
          `  "hsk_words": [\n` +
          `    { "word": "ханз", "pinyin": "дуудлага", "hsk_level": 4, "meaning": "Монголоор утга" }\n` +
          `  ],\n` +
          `  "coach_message": "Монголоор 1-2 өгүүлбэр урам өгөх мессеж. Анхаарлын тэмдэггүй."\n` +
          `}\n\n` +
          `Дүрэм: errors массив хоосон байж болно (алдаа байхгүй бол хоосон). ` +
          `hsk_words: текстэд байгаа HSK 3+ үгсийг л жагсаа, хамгийн ихдээ 6.`;

        const r = await fetch(GEMINI_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: checkPrompt }] }],
            generationConfig: { maxOutputTokens: 700, temperature: 0.3 },
          }),
        });
        const d         = await r.json();
        const rawResp   = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        const jsonMatch = rawResp?.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          // Firestore-д хадгалах
          await dbPersonal.doc(`users/${uid}/journals/${todaySH()}`).set({
            text:      journalText,
            score:     result.score || 0,
            createdAt: new Date().toISOString(),
          }, { merge: true });

          // hanzi + journal streak автоматаар нэмэх
          await logRoutine('hanzi', uid);
          await logRoutine('journal', uid);
          const { score: dayScore } = await getScore(uid);
          const hzStreak = await getStreak('hanzi', uid);

          let replyMsg = `📝 *HSK Journal — ${result.score || 0}/100*\n\n`;
          replyMsg += `_"${journalText.slice(0, 100)}"_\n\n`;

          if (result.errors && result.errors.length > 0) {
            replyMsg += `❌ *Алдаа (${result.errors.length}):*\n`;
            result.errors.slice(0, 3).forEach(e => {
              replyMsg += `• ~~${e.wrong}~~ → *${e.correct}*\n  _${e.explanation}_\n`;
            });
            replyMsg += '\n';
          } else {
            replyMsg += `✅ Дүрмийн алдаа илрэхгүй\n\n`;
          }

          if (result.hsk_words && result.hsk_words.length > 0) {
            replyMsg += `📚 *HSK үгс:*\n`;
            result.hsk_words.slice(0, 6).forEach(w => {
              replyMsg += `• *${w.word}* (${w.pinyin}) — ${w.meaning} [HSK${w.hsk_level}]\n`;
            });
            replyMsg += '\n';
          }

          replyMsg += `💡 ${result.coach_message || 'Сайн хичээж байна.'}\n\n`;
          replyMsg +=
            `✅ *Journal + 汉字* тэмдэглэлээ ${hzStreak}🔥  |  Score: ${dayScore}/100`;

          await tgSend(replyMsg);

        } else {
          // JSON гарсангүй — энгийнээр log хийнэ
          await logRoutine('journal', uid);
          await dbPersonal.doc(`users/${uid}/journals/${todaySH()}`).set({
            text: journalText, createdAt: new Date().toISOString(),
          }, { merge: true });
          await tgSend(`📝 Journal хадгаллаа.\n_"${journalText.slice(0, 80)}"_`);
        }

      } catch (e) {
        console.error('[Journal] Error:', e.message);
        await logRoutine('journal', uid);
        await tgSend(
          `📝 Journal хадгаллаа. (HSK шалгаж чадсангүй)\n` +
          `_"${journalText.slice(0, 80)}"_`
        );
      }

    } else {
      // Хятад биш → энгийн тэмдэглэл
      await logRoutine('journal', uid);
      await dbPersonal.doc(`users/${uid}/journals/${todaySH()}`).set({
        text: journalText, createdAt: new Date().toISOString(),
      }, { merge: true });
      const { score } = await getScore(uid);
      await tgSend(
        `📝 Journal хадгаллаа! Score: ${score}/100\n` +
        `_"${journalText.slice(0, 80)}"_`
      );
    }
    return;
  }

  const waterMatch = raw.match(/(\d+)\s*(мл|ml)/i);
  if (text === '/us' || waterMatch) {
    const ml    = waterMatch ? parseInt(waterMatch[1]) : 250;
    const total = await logWater(ml, uid);
    await tgSend(
      `💧 +${ml}мл! Нийт: ${total}мл/2000мл (${Math.round(total / 20)}%) ` +
      `${total >= 2000 ? '🎉' : ''}`
    );
    return;
  }

  // ── Task Manager ─────────────────────────────────────────────────
  if (raw.startsWith('/task ') || raw.startsWith('/task\n')) {
    const taskText = raw.slice(6).trim();
    if (!taskText) { await tgSend('⚠️ `/task [тайлбар]`'); return; }
    await addTask(taskText, uid);
    const tasks = await getTasks(uid);
    await tgSend(`✅ Task нэмэгдлээ. Нийт: *${tasks.length}*`);
    return;
  }

  if (text === '/tasks') {
    const tasks = await getTasks(uid);
    if (!tasks.length) { await tgSend('📋 Хийх зүйл байхгүй байна. 🎉'); return; }
    const list = tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
    await tgSend(`📋 *Хийх зүйлүүд:*\n\n${list}\n\n_/done [дугаар]_`);
    return;
  }

  const doneMatch = raw.match(/^\/done\s+(\d+)/i);
  if (doneMatch) {
    const n    = parseInt(doneMatch[1]);
    const done = await doneTask(n, uid);
    if (!done) { await tgSend('⚠️ Тийм дугаартай task байхгүй байна.'); return; }
    const remaining = await getTasks(uid);
    await tgSend(`✅ *Дууслаа:* ${done}\n\nҮлдсэн: *${remaining.length}*`);
    return;
  }

  // ── Personal Memory ───────────────────────────────────────────────
  if (raw.startsWith('/goal ') || raw.startsWith('/goal\n')) {
    const goal = raw.slice(6).trim();
    await saveBilegProfile({ goal }, uid);
    await tgSend(`🎯 Зорилго хадгаллаа:\n_"${goal}"_\n\nJ.A.R.V.I.S өглөө бүр сануулна.`);
    return;
  }

  if (text === '/goal') {
    const p = await getBilegProfile(uid);
    if (!p.goal) { await tgSend('🎯 Зорилго тавиагүй байна.\n`/goal [зорилгоо]`'); return; }
    await tgSend(`🎯 *Одоогийн зорилго:*\n_"${p.goal}"_`);
    return;
  }

  if (raw.startsWith('/focus ')) {
    const focus = raw.slice(7).trim();
    await saveBilegProfile({ focus }, uid);
    await tgSend(`🔥 Focus хадгаллаа:\n_"${focus}"_`);
    return;
  }

  // ── Notion (JARVIS page-д append) ────────────────────────────────
  if (raw.startsWith('/notion ') || raw.startsWith('/notion\n')) {
    const noteText = raw.slice(8).trim();
    if (!noteText) { await tgSend('📝 `/notion [текст]`'); return; }
    const url = await notionSave(noteText, `Telegram: ${todaySH()}`, '📝');
    if (url) {
      await tgCall('sendMessage', {
        chat_id: TG_CHAT,
        text:    `📝 Notion-д хадгаллаа.\n\n"${noteText.slice(0, 80)}${noteText.length > 80 ? '...' : ''}"`,
      });
    } else {
      await tgCall('sendMessage', {
        chat_id: TG_CHAT, text: '⚠️ Notion-д хадгалж чадсангүй.',
      });
    }
    return;
  }

  // ── Google Calendar ───────────────────────────────────────────────
  if (raw.startsWith('/cal ') || raw.startsWith('/cal\n')) {
    const calText = raw.slice(5).trim();
    if (!calText) { await tgSend('📅 `/cal маргааш 3 цагт meeting`'); return; }
    if (!calOk()) { await tgSend('⚠️ Google Calendar тохиргоогүй байна.'); return; }
    const parsed = parseEvent(calText);
    if (!parsed?.date) {
      await tgSend('⚠️ Ойлгож чадсангүй.\nЖишээ: `/cal маргааш 3 цагт meeting`');
      return;
    }
    try {
      await createEvent(
        parsed.title,
        `${parsed.date}T${parsed.startTime}:00`,
        `${parsed.date}T${parsed.endTime}:00`,
        parsed.description || ''
      );
      await tgCall('sendMessage', {
        chat_id: TG_CHAT,
        text:    `✅ Calendar-д нэмэгдлээ!\n\n📌 ${parsed.title}\n📅 ${parsed.date}  ${parsed.startTime} – ${parsed.endTime}`,
      });
    } catch (e) {
      await tgSend(`❌ Calendar алдаа: ${e.message}`);
    }
    return;
  }

  if (text === '/events') {
    if (!calOk()) { await tgSend('⚠️ Google Calendar тохиргоогүй байна.'); return; }
    try {
      const events = await listUpcomingEvents(7);
      if (!events.length) { await tgSend('📅 Ойрын 7 хоногт event байхгүй байна.'); return; }
      await tgCall('sendMessage', {
        chat_id: TG_CHAT,
        text:    `📅 *Ойрын ${events.length} event:*`,
        parse_mode: 'Markdown',
      });
      for (const e of events) {
        await tgCall('sendMessage', {
          chat_id: TG_CHAT,
          text:    `📌 ${e.summary}\n🕐 ${formatEventDate(e)}  ${formatEventTime(e)}`,
          reply_markup: {
            inline_keyboard: [[{ text: '🗑 Устгах', callback_data: `caldel_${e.id}` }]],
          },
        });
      }
    } catch (e) {
      await tgSend(`❌ Calendar алдаа: ${e.message}`);
    }
    return;
  }

  // ── Sprint 10: HSK 3 Commands ────────────────────────────────────

  // /seed_hsk [force] — HSK 1-6 бүх үгийг Firestore-д нэмэх
  if (text.startsWith('/seed_hsk')) {
    const force = text.includes('force');
    await tgSend(`📥 HSK 1-6 үгсийг seed хийж байна… (2094 үг, ~5 batch)${force ? ' [FORCE]' : ''}`);
    try {
      const result = await seedVocab(uid, { force });
      if (result?.skipped) {
        await tgSend(
          `ℹ️ Vocab аль хэдийн seed хийгдсэн байна.\n` +
          `Дахин бичихийн тулд: \`/seed_hsk force\`\n\n` +
          `_/hsk\\_drill — drill эхлэх_`
        );
      } else {
        const byLevel = [1,2,3,4,5,6].map(l => {
          const n = (HSK_VOCAB_ALL || []).filter(v => v.hsk_level === l).length;
          return `HSK${l}: ${n}`;
        }).join(' | ');
        await tgSend(
          `✅ *HSK 1-6 Vocab Seed дууслаа!*\n\n` +
          `📚 *${result.seeded}* үг Firestore-д хадгалагдлаа\n` +
          `${byLevel}\n\n` +
          `_/hsk\\_drill 3 — HSK 3 drill_\n` +
          `_/hsk\\_progress — дэвшил харах_`
        );
      }
    } catch (e) {
      await tgSend(`❌ Seed алдаа: ${e.message}`);
    }
    return;
  }

  // /hsk_progress — per-level dashboard
  if (text === '/hsk_progress' || text === '/progress') {
    try {
      const p = await getProgress(uid);
      if (!p) {
        await tgSend('📭 Vocabulary байхгүй. `/seed_hsk` командаар эхлэ.');
        return;
      }
      const bar5 = (pct) => {
        const filled = Math.round(pct / 20);  // 0-5 stars
        return '█'.repeat(filled) + '░'.repeat(5 - filled);
      };
      const LEVEL_LABELS = { 1:'🔵', 2:'🟢', 3:'🟡', 4:'🟠', 5:'🔴', 6:'🟣' };

      let lvlLines = '';
      for (let l = 1; l <= 6; l++) {
        const lp = p.byLevel[l];
        if (!lp || lp.total === 0) continue;
        const tag = l === p.activeLevel ? ' ← одоо' : '';
        lvlLines += `${LEVEL_LABELS[l]} *HSK ${l}*  \`${bar5(lp.pct)}\` ${lp.pct}%  (${lp.mastered}/${lp.total})${tag}\n`;
      }

      // Per-level drill buttons
      const levelBtns = [1,2,3,4,5,6].filter(l => p.byLevel[l]?.total > 0).map(l => ({
        text: `HSK ${l} ${p.byLevel[l].pct}%`, callback_data: `hsk_drill_${l}`
      }));
      const kbd = {
        inline_keyboard: [
          levelBtns.slice(0,3),
          levelBtns.slice(3,6),
        ].filter(r => r.length > 0)
      };

      await tgCall('sendMessage', {
        chat_id:      TG_CHAT,
        parse_mode:   'Markdown',
        reply_markup: kbd,
        text:
          `📊 *HSK MASTER DASHBOARD*\n` +
          `\`────────────────────────\`\n\n` +
          lvlLines +
          `\n🌐 Нийт: *${p.mastered}/${p.total}* үг цээжилсэн (${p.pct}%)\n` +
          `⚡ Өдөрт: *${p.dailyGoal}* үг  |  📅 *${p.daysLeft}* хоног үлдлээ\n\n` +
          `_Drill хийхийн тулд дээрх товчийг дарна уу_`,
      });
    } catch (e) {
      await tgSend(`❌ Алдаа: ${e.message}`);
    }
    return;
  }

  // /hsk_drill [1-6] — level-based Spaced Repetition drill
  if (text.startsWith('/hsk_drill') || text.startsWith('/drill')) {
    try {
      // Parse optional level: /hsk_drill 3  or  /hsk_drill3
      const lvlMatch = text.match(/(\d)/);
      const drillLvl = lvlMatch ? parseInt(lvlMatch[1]) : null;
      if (drillLvl && (drillLvl < 1 || drillLvl > 6)) {
        await tgSend('⚠️ Түвшин 1-6 байх ёстой. Жишээ: `/hsk_drill 3`');
        return;
      }

      await clearDrillSession(uid);

      const words = await getWeakWords(uid, 10, drillLvl);
      if (!words.length) {
        const lvlTag = drillLvl ? `HSK ${drillLvl}` : 'бүх';
        await tgSend(
          `🎉 ${lvlTag} түвшинд өнөөдөр давтах үг байхгүй!\n\n` +
          `_/hsk\\_progress — дэвшил харах_`
        );
        return;
      }

      const lvlTag = drillLvl ? `HSK ${drillLvl}` : `HSK ${words[0]?.hsk_level || '?'}`;
      const session = {
        active:    true,
        type:      'drill',
        hsk_level: drillLvl,
        words:     words.map(w => ({ word: w.word, pinyin: w.pinyin, definition: w.definition, en: w.en || '', hsk_level: w.hsk_level || drillLvl })),
        current:   0,
        correct:   0,
        wrong:     0,
        startedAt: new Date().toISOString(),
      };
      await saveDrillSession(session, uid);

      await tgSend(`🎯 *${lvlTag} Drill* — ${words.length} үг бэлэн`, { parse_mode: 'Markdown' });
      await sendDrillQuestion(session, 0, uid);

    } catch (e) {
      await tgSend(`❌ Drill алдаа: ${e.message}`);
    }
    return;
  }

  // /drill_stop — drill дуусгах
  if (text === '/drill_stop' || text === '/stop') {
    const session = await getDrillSession(uid);
    if (session?.active) {
      await clearDrillSession(uid);
      await tgSend(
        `⏹ Drill зогсоолоо.\n` +
        `✅ ${session.correct} зөв  |  ❌ ${session.wrong} буруу\n\n` +
        `_/hsk\\_drill — дахин эхлэх_`
      );
    } else {
      await tgSend('Идэвхтэй drill байхгүй байна.');
    }
    return;
  }

  // /listening — HSK 3 унших + ойлголт шалгах
  if (text === '/listening') {
    if (!apiKey) { await tgSend('⚠️ API key тохиргоогүй.'); return; }
    await tgSend('📖 HSK 3 passage бэлдэж байна...');
    try {
      const prompt =
        `HSK 3 түвшний богино хятад хэлний диалог/текст үүсгэ (6-8 өгүүлбэр).\n` +
        `Агуулга: өдөр тутмын сэдэв (хөдөлмөр, хот, аялал, хоол гм).\n` +
        `Зөвхөн HSK 1-3 үгс хэрэглэ. Пиньинь байх шаардлагагүй.\n\n` +
        `Дараа нь текстэд тулгуурлан 3 ойлголтын асуулт гарга (A/B/C/D сонголттой).\n\n` +
        `Формат:\n` +
        `📖 ТЕКСТ:\n[хятад текст]\n\n` +
        `❓ АСУУЛТ:\n1. [асуулт]\nA) ... B) ... C) ... D) ...\n2. ...\n3. ...\n\n` +
        `Монгол тайлбар ХЭРЭГГҮЙ — зөвхөн хятад текст + асуулт.\n` +
        `Хариулт: текстийн дараа тусдаа блокод ||ХАРИУЛТ: 1-?, 2-?, 3-?|| гэж нуу.`;

      const resp = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an HSK 3 Chinese language teacher. Create reading comprehension exercises.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 600, temperature: 0.8,
        }),
      });
      const data   = await resp.json();
      const result = data.choices?.[0]?.message?.content?.trim();
      if (!result) { await tgSend('❌ Passage үүсгэж чадсангүй.'); return; }

      await tgSend(
        `🎧 *HSK 3 Reading Comprehension*\n\n` +
        result + `\n\n_Хариултаа нь 1-A, 2-B, 3-C гэх мэтээр илгээ_`
      );
    } catch (e) {
      await tgSend(`❌ Алдаа: ${e.message}`);
    }
    return;
  }

  // ── Brief / Weekly ────────────────────────────────────────────────
  if (raw.replace(/@\w+/, '').trim().toLowerCase() === '/brief') {
    await tgCall('sendMessage', { chat_id: TG_CHAT, text: '⏳ Брифинг бэлдэж байна...' });
    try { await sendBrief(); } catch (e) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: '❌ Brief алдаа: ' + e.message });
    }
    return;
  }

  if (text === '/weekly') {
    await tgCall('sendMessage', {
      chat_id: TG_CHAT, text: '📊 7 хоногийн тайлан бэлдэж байна...',
    });
    try { await sendWeeklyReport(); } catch (e) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: '❌ Weekly алдаа: ' + e.message });
    }
    return;
  }

  // ── Sprint 6: /hook — Shorts/Reels скрипт үүсгэгч ───────────────
  if (raw.toLowerCase().startsWith('/hook')) {
    const topic = raw.slice(5).trim();
    if (!topic) {
      await tgSend(
        `🎬 *Hook & Скрипт Машин*\n\n` +
        `\`/hook [сэдэв]\`\n\n` +
        `Жишээ:\n` +
        `• \`/hook Шанхайд анх удаа аялж байгаа хүнд 5 зөвлөгөө\`\n` +
        `• \`/hook LFS эмнэлгийн багц яагаад үнэ цэнтэй вэ\`\n` +
        `• \`/hook Шанхайн хамгийн сайн хоолны газрууд\``
      );
      return;
    }
    if (!GEMINI_URL) { await tgSend('⚠️ GEMINI_API_KEY тохиргоогүй.'); return; }

    await tgSend('🎬 Скрипт бэлдэж байна...');

    try {
      const hookPrompt =
        `"${topic}" сэдвээр Instagram Reels / TikTok-д зориулсан контент бэлд.\n` +
        `Зорилтот үзэгч: Шанхайд сонирхолтой Монголчууд. LFS Shanghai брэнд.\n\n` +
        `Дараах бүтцээр ЯГЛАА гарга:\n\n` +
        `───────────────────────\n` +
        `🪝 HOOK 1 (Асуулт өнцөг):\n` +
        `[Анхны 3 секундын текст]\n\n` +
        `🪝 HOOK 2 (Мэдэгдэл өнцөг):\n` +
        `[Анхны 3 секундын текст]\n\n` +
        `🪝 HOOK 3 (Тоон өгөгдлийн өнцөг):\n` +
        `[Анхны 3 секундын текст]\n\n` +
        `───────────────────────\n` +
        `🎬 БҮТЭН СКРИПТ (30 секунд):\n\n` +
        `[0-3сек] (HOOK дуудна)\n` +
        `[3-10сек] (Асуудал / контекст)\n` +
        `[10-22сек] (Шийдэл / LFS-ийн үнэ цэн)\n` +
        `[22-28сек] (CTA: захиалга эсвэл DM)\n` +
        `[28-30сек] (Хурдан дуусгах — брэнд)\n\n` +
        `───────────────────────\n` +
        `📌 CAPTION САНАЛ:\n` +
        `[50-80 тэмдэгт, Монголоор, hashtag-тай]`;

      const r = await fetch(GEMINI_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: hookPrompt }] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.85 },
        }),
      });
      const d      = await r.json();
      const script = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!script) { await tgSend('❌ Скрипт гарсангүй. Дахин оролд.'); return; }

      // Notion Content DB-д шинэ хуудас нээж хадгалах
      const notionUrl = await notionSaveScript(`🎬 ${topic}`, script);

      // Telegram-д харуулах (Markdown 4096 тэмдэгтийн хязгаар)
      const MAX_LEN  = 3800;
      const header   = `🎬 *Hook & Скрипт готов!*\n_Сэдэв: ${topic}_\n\n`;
      const bodyRoom = MAX_LEN - header.length;
      const body     = script.length > bodyRoom
        ? script.slice(0, bodyRoom) + `\n\n_...${script.length - bodyRoom} тэмдэгт үлдсэн_`
        : script;

      let replyMsg = header + body;
      if (notionUrl) replyMsg += `\n\n📝 _Notion Content DB-д хадгаллаа_`;

      await tgSend(replyMsg);

    } catch (e) {
      console.error('[Hook] Error:', e.message);
      await tgSend(`❌ Скрипт алдаа: ${e.message}`);
    }
    return;
  }

  // ── Help ──────────────────────────────────────────────────────────
  if (text === '/help') {
    await tgSend(
      `🤖 *J.A.R.V.I.S v2.2 — Хувийн Bot*\n\n` +
      `💬 *Чөлөөт яриа* 🆕\n` +
      `Ямар ч команд биш текст → JARVIS чамтай ярина\n` +
      `Сүүлийн 10 мессежийг санадаг (Memory)\n\n` +
      `📅 *Calendar*\n` +
      `/cal [текст] — event нэмэх\n` +
      `/events — ойрын 7 хоногийн хуваарь\n\n` +
      `📋 *Tasks*\n` +
      `/task [зүйл] — нэмэх\n` +
      `/tasks — жагсаах\n` +
      `/done [n] — дуусгах\n\n` +
      `🧠 *Санах ой*\n` +
      `/goal [текст] — зорилго\n` +
      `/focus [текст] — өнөөдрийн focus\n` +
      `/notion [текст] — Notion JARVIS хуудасд тэмдэглэх\n\n` +
      `📊 *Тайлан*\n` +
      `/brief — өглөөний брифинг + HSK Blitz\n` +
      `/weekly — 7 хоногийн тойм\n\n` +
      `💪 *Routine*\n` +
      `/score — score + streak\n` +
      `/dasgal · /hanzi · /nom\n` +
      `/journal — тэмдэглэл log\n` +
      `/journal [текст] — хятадаар → HSK шалгана\n` +
      `/us [мл] — ус 💧\n\n` +
      `🎬 *Контент*\n` +
      `/hook [сэдэв] — Reels 3 hook + 30с скрипт\n\n` +
      `🎙 *Voice*\n` +
      `Дуут зурвас → орлого/calendar/task автоматаар\n` +
      `HSK ханзаар өгүүлбэр → оноо авах 🎯`
    );
    return;
  }

  // ── Free Chat — GitHub Models (GPT-4o-mini), quota байхгүй ────────
  if (!apiKey) { await tgSend('⚠️ API key тохиргоогүй. Профайлдаа GitHub Token оруулна уу.'); return; }
  try {
    const hist = await getChatHistory(uid);

    // History нь { role:'user'|'assistant', content } format — шууд ашиглана
    const messages = [
      { role: 'system', content: sysText },
      ...hist.map(m => ({ role: m.role, content: m.content || '' })),
      { role: 'user', content: raw },
    ];

    const resp = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages,
        max_tokens:  800,
        temperature: 0.8,
      }),
    });
    const data  = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { await tgSend('🤖 Хариу ирсэнгүй. Дахин оролд.'); return; }

    // Sliding window history хадгалах (шинэ format: { role, content })
    await saveChatHistory([
      ...hist,
      { role: 'user',      content: raw   },
      { role: 'assistant', content: reply },
    ], uid);

    await tgSend(reply);

  } catch (e) {
    console.error('[FreeChat] Error:', e.message);
    await tgSend(`❌ Алдаа: ${e.message.slice(0, 80)}`);
  }
}

// ── WEBHOOK HANDLER ───────────────────────────────────────────────
// Server startup-д Билэгийн профайлыг seed хийнэ
seedBilegProfile().catch(e => console.error('[Seed] startup error:', e.message));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('J.A.R.V.I.S v2.2 OK');
  res.status(200).json({ ok: true });
  try {
    const upd = req.body;
    if (!upd) return;

    // ── Dynamic user routing ──────────────────────────────────────
    const rawChatId = String(
      upd.message?.chat?.id ||
      upd.callback_query?.message?.chat?.id || ''
    );

    // 1. Firestore-оос chatId-аар хэрэглэгч хайх
    let userCtx = await findUserByChatId(rawChatId);

    // 2. Байхгүй бол env-ийн default (Билэг) ашиглах
    if (!userCtx && rawChatId === String(TG_CHAT)) {
      userCtx = { uid: UID, chatId: rawChatId };
    }

    // 3. Танигдаагүй хэрэглэгч — бүртгэлийн зааврыг буцаах
    if (!userCtx) {
      await tgCall('sendMessage', {
        chat_id:    rawChatId,
        text:       `🤖 Сайн уу!\n\nТа JARVIS-ийг ашиглахын тулд вэб дээрээ Telegram Chat ID-гаа холбоно уу.\n\n` +
                    `📱 Telegram Chat ID-гаа авах: @userinfobot руу /start илгээнэ үү.\n` +
                    `🌐 Вэб: profile.html → Telegram Settings хэсэгт оруулна уу.`,
        parse_mode: 'Markdown',
      });
      return;
    }

    if (upd.callback_query) {
      await handleCallback(upd.callback_query);
    } else if (upd.message?.voice) {
      await handleVoice(upd.message, userCtx);
    } else if (upd.message?.text) {
      await handleText(upd.message, userCtx);
    }
  } catch (e) {
    console.error('[JARVIS] Error:', e.message);
  }
};

module.exports.sendWeeklyReport = sendWeeklyReport;
module.exports.sendBrief        = sendBrief;
module.exports.sendHSKReminder  = sendHSKReminder;

// ── HSK DAILY REMINDER — 15:00 Шанхай ────────────────────────────
async function sendHSKReminder() {
  try {
    const p = await getProgress(UID);

    let progressLine = '';
    let activeLvl    = 3;
    if (p) {
      activeLvl = p.activeLevel || 3;
      const lp  = p.byLevel?.[activeLvl] || {};
      progressLine =
        `\n📊 *HSK ${activeLvl}* одоогийн түвшин: *${lp.mastered || 0}/${lp.total || 0}* үг (${lp.pct || 0}%)\n` +
        `🌐 Нийт: *${p.mastered}/${p.total}* үг мастер\n` +
        `📅 Шалгалт хүртэл: *${p.daysLeft}* хоног\n` +
        `⚡ Өнөөдрийн зорилт: *${p.dailyGoal}* үг\n`;
    }

    await tgCall('sendMessage', {
      chat_id:    TG_CHAT,
      parse_mode: 'Markdown',
      text:
        `⏰ *15:00 болж байна — Хичээл дуусав!*\n\n` +
        `Одоо чиний хувийн суралцах цаг эхэллээ.\n` +
        `HSK ${activeLvl} түвшин давах хүртэл орой болтол орхиж болохгүй!\n` +
        `${progressLine}\n` +
        `📚 */hsk\\_drill ${activeLvl}* — HSK ${activeLvl} drill\n` +
        `🎧 */listening* — Reading comp\n` +
        `📈 */hsk\\_progress* — Дэвшил харах\n\n` +
        `_"每天进步一点点" — Өдөр бүр жаахан ч гэсэн урагш_`,
      reply_markup: {
        inline_keyboard: [[
          { text: `🎯 HSK ${activeLvl} Drill`, callback_data: `hsk_drill_${activeLvl}` },
          { text: '📊 Дэвшил', callback_data: 'hsk_progress' },
        ]],
      },
    });
  } catch (e) {
    console.error('[HSK Reminder] Error:', e.message);
  }
}
