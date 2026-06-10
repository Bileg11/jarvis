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

// ── BILEG SYSTEM INSTRUCTION (динамик — HSK хоног, challenge ctx) ─
function getBilegSystem() {
  const hskDays = Math.max(0, Math.ceil(
    (new Date('2026-06-28T09:00:00+08:00') - Date.now()) / 86400000
  ));
  const urgency = hskDays <= 7  ? '🔴 ШҮРГЭЖ ИРЛ_ЭЭ — ' + hskDays + ' хоног үлдсэн! Яаралтай!'
                : hskDays <= 20 ? '🟠 ЯАРАЛ БИЙ — ' + hskDays + ' хоног үлдсэн.'
                : '🟡 ' + hskDays + ' хоног үлдсэн.';

  return { parts: [{ text:
    `# J.A.R.V.I.S — SYSTEM PROMPT\n\n` +

    `## 1. IDENTITY\n` +
    `Чи бол J.A.R.V.I.S — Билэгийн хувийн elite AI, стратегийн түнш. ` +
    `Tony Stark-ийн JARVIS шиг: ухаалаг, урьдчилан таамагладаг, шууд. ` +
    `Жирийн chatbot биш — Билэгийн хоёр дахь тархи. ` +
    `"Билэг" эсвэл "Boss" гэж дуудна.\n\n` +

    `## 2. USER PROFILE\n` +
    `• 18 настай Монгол залуу, Шанхайд ганцаараа амьдардаг.\n` +
    `• Бизнес: LFS Shanghai (Монгол аялагчдад VIP туслалцаа).\n` +
    `• Tech stack: React, Firebase, Node.js, Railway, GitHub.\n` +
    `• Зорилго: AI-г тултал ашиглах · LFS-г бодит бизнес болгох · HSK100%.\n` +
    `• June Challenge: Маралаатай хамт 06/01–06/30 өдөр бүрийн дасгалжуулалт.\n\n` +

    `## 3. CORE PRINCIPLES\n` +
    `• ШУУД & ШИГДСЭН: Цөм рүү нь дайр. Оршил, "Мэдээж", "Тэгвэл", "Маш сайн асуулт" — ХОРИОТОЙ.\n` +
    `• ЗӨВ > АЮУЛГҮЙ: Хамгийн практик, шилдэг шийдлийг өг. Улс төржсөн, бөөрөнхий хариулт хориотой.\n` +
    `• ШҮҮМЖЛЭЛТЭЙ: Буруу логик, код, шийдвэр — зусардахгүй, шууд засаж хэл.\n` +
    `• PROACTIVE: Асуултаас нэг алхам түрүүлж сэтгэ. Аюул, цоорхой, эрсдэлийг урьдчилж сануул.\n` +
    `• TONE: 18 настай залуутай ярьж байгаа — найзынх шиг casual ч Stark-level precision.\n\n` +

    `## 4. HSK URGENCY 🎯\n` +
    `HSK4 шалгалт: 2026/06/28. ${urgency}\n` +
    `• Хамааралтай үед энэ urgency-г хариулт дотроо дотооддоо тусга.\n` +
    `• Үг заахдаа: [Ханз + Пиньин + Монгол + Жишээ өгүүлбэр].\n` +
    `• HSK-г хүчээр оруулахгүй — асуусныг нь л хариул.\n\n` +

    `## 5. STYLE\n` +
    `• Үргэлж Монголоор. Telegram Markdown (*bold*, _italic_, \`code\`).\n` +
    `• Хариулт бүрийн төгсгөлд тодорхой, практик НЭГ АЛХАМ үлдээ.\n` +
    `• Хариултын эхийг ХЭЗЭЭ Ч "Тэгвэл", "Мэдээж", "Ойлголоо" гэж эхлүүлэхгүй.`,
  }]};
}
const BILEG_SYSTEM = getBilegSystem(); // backward compat

// ── LIVE OS CONTEXT — Firestore-оос бүх модулийн өнөөдрийн байдал ──
// JARVIS free chat-д system prompt руу нэмэгддэг.
// Routine · HSK · Challenge · Finance · Tasks · Profile
async function getFullContext(uid) {
  const today = todaySH();
  const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  try {
    const [routineSnap, hskSnap, tasksRaw, challengeSnap, profileSnap] = await Promise.all([
      dbPersonal.doc(`users/${uid}/routines/${today}`).get().catch(() => null),
      dbPersonal.doc(`users/${uid}/hsk/today`).get().catch(() => null),
      dbPersonal.collection(`users/${uid}/tasks`).where('done', '==', false).get().catch(() => ({ docs: [] })),
      dbPersonal.doc('challenge/current').get().catch(() => null),
      dbPersonal.doc(`users/${uid}/bileg/profile`).get().catch(() => null),
    ]);

    const rt      = routineSnap?.exists ? routineSnap.data() : {};
    const hsk     = hskSnap?.exists ? hskSnap.data() : {};
    const tasks   = tasksRaw.docs.slice(0, 5).map(d => d.data().text).filter(Boolean);
    const profile = profileSnap?.exists ? profileSnap.data() : {};

    const routineStr = [
      rt.exercise ? '✅ Дасгал' : '❌ Дасгал',
      rt.hanzi    ? '✅ 汉字'   : '❌ 汉字',
      rt.read     ? '✅ Уншилт' : '❌ Уншилт',
      rt.journal  ? '✅ Journal' : '❌ Journal',
    ].join(' · ');

    let challengeLine = '';
    if (challengeSnap?.exists) {
      const chid = challengeSnap.data().id;
      const [proofSnap, dailySnap] = await Promise.all([
        dbPersonal.doc(`challenge/${chid}/proofs/${today}`).get().catch(() => null),
        dbPersonal.doc(`challenge/${chid}/daily/${today}`).get().catch(() => null),
      ]);
      const pct = dailySnap?.exists ? (dailySnap.data()?.bileg?.pct || 0) : 0;
      challengeLine = `Challenge proof: ${proofSnap?.exists ? '✅ оруулсан' : '❌ байхгүй'} · Хуваарь: ${pct}%`;
    }

    let financeLine = '';
    try {
      const finSnap = await dbPersonal.collection(`users/${uid}/finance/txns/records`)
        .where('date', '>=', month + '-01').where('date', '<=', month + '-31').get();
      const txns   = finSnap.docs.map(d => d.data());
      const expCNY = txns.filter(t => t.type === 'expense' && t.currency === 'CNY').reduce((s,t) => s + t.amount, 0);
      const incCNY = txns.filter(t => t.type === 'income'  && t.currency === 'CNY').reduce((s,t) => s + t.amount, 0);
      if (txns.length) financeLine = `Санхүү (${month}): орлого ¥${incCNY.toFixed(0)}, зарлага ¥${expCNY.toFixed(0)}, үлдэгдэл ${incCNY-expCNY >= 0 ? '+' : ''}¥${(incCNY-expCNY).toFixed(0)}`;
    } catch {}

    const lines = [
      `Одоо: ${today} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} Shanghai`,
      `Routine: ${routineStr}`,
      hsk.date === today ? `HSK: ${hsk.words?.length || 0} ханз · drill ${hsk.scored ? '✅ хийсэн' : '❌ хийгдэхгүй'}` : 'HSK: өнөөдрийн session байхгүй',
      challengeLine,
      financeLine,
      profile.goal  ? `Зорилго: "${profile.goal}"` : '',
      profile.focus ? `Фокус: "${profile.focus}"` : '',
      tasks.length  ? `Нээлттэй tasks (${tasks.length}): ${tasks.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    return `\n\n## LIVE OS CONTEXT [${today}]\n${lines}`;
  } catch (e) {
    console.error('[getFullContext]', e.message);
    return '';
  }
}

// ── BUILD PROMPT — HSK coaching context packager ──────────────────
// Gemini руу явуулах системийн болон хэрэглэгчийн context-ийг цэгцлэнэ.
// Drill start, progress summary, weak word coaching-д ашиглана.
function buildHSKPrompt({ profile = {}, progress = null, weakWords = [], mode = 'drill_end', drillResult = null }) {
  const hskDays = Math.max(0, Math.ceil(
    (new Date('2026-06-28T09:00:00+08:00') - Date.now()) / 86400000
  ));
  const urgencyTag = hskDays <= 7  ? 'ШҮРГЭЖ ИРЛЭЭ'
                   : hskDays <= 20 ? 'ЯАРАЛ БИЙ'
                   : 'ТОГТВОРТОЙ';

  const systemInstruction = [
    'Чи бол JARVIS — HSK4 шалгалтын strict coach.',
    'Монголоор, товч, практик хариул. Урамшуулал > шүүмж.',
    `Urgency: ${urgencyTag} (${hskDays} хоног үлдсэн).`,
    'JSON хариу буцаа. Markdown бичвэл bold (*) ашигла.',
  ].join('\n');

  const lines = [
    `Mode: ${mode}`,
    progress ? `Нийт: ${progress.total} үг | Mastered: ${progress.mastered} (${progress.pct}%)` : '',
    progress ? `Өдрийн зорилт: ${progress.dailyGoal} үг | Үлдсэн хоног: ${hskDays}` : '',
    progress?.activeLevel ? `Одоо активдаа: HSK ${progress.activeLevel}` : '',
    weakWords.length ? `Сул үгс: ${weakWords.slice(0,5).map(w=>w.word).join(', ')}` : '',
    drillResult ? `Drill үр дүн: ${drillResult.correct}/${drillResult.total} (${drillResult.pct}%)` : '',
  ].filter(Boolean).join('\n');

  const modeInstruction = {
    drill_end:  'Drill дууслаа. 1-2 мөрөнд coaching тайлбар өг. Маш товч, motivating. Хэт их бичихгүй.',
    progress:   'HSK явцын бүрэн дүгнэлт өг. Алсын харааг оруул. 3-4 мөр.',
    weak_coach: 'Хамгийн сул 5 үгийг яаж давтах зөвлөгөө бич. Тодорхой алхам оруул.',
  }[mode] || 'Практик зөвлөгөө өг.';

  const userPrompt = `${lines}\n\nДаалгавар: ${modeInstruction}`;
  return { systemInstruction, userPrompt };
}

// Gemini-ийг buildHSKPrompt-тайгаар дуудах helper
async function callGeminiCoach(promptData) {
  if (!GEMINI_URL) return null;
  try {
    const { systemInstruction, userPrompt } = buildHSKPrompt(promptData);
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 120, temperature: 0.7 },
      }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
}

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
    // GAP-02: meta/profile + config/profile хоёуланг нэгтгэж уншина
    const [metaSnap, cfgSnap] = await Promise.all([
      dbPersonal.doc(`users/${uid}/meta/profile`).get(),
      dbPersonal.doc(`users/${uid}/config/profile`).get(),
    ]);
    const profile = {
      ...(cfgSnap.exists ? cfgSnap.data() : {}),
      ...(metaSnap.exists ? metaSnap.data() : {}),
    };
    return { uid, chatId: String(chatId), ...profile };
  } catch (e) {
    console.error('[Routing] findUserByChatId error:', e.message);
    return null;
  }
}

// GAP-07: telegram_lookup-аас идэвхтэй TG хэрэглэгчид олох
// collection('users').get() бүгдийг татдагаас хамаагүй хэмнэлттэй
async function _getTelegramUsers() {
  const snaps = await dbPersonal.collection('telegram_lookup').get();
  return snaps.docs
    .map(d => ({ uid: d.data().uid, chatId: d.id }))
    .filter(u => u.uid);
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

    // challenge/current seed — зөвхөн байхгүй бол (Challenge #1)
    const curRef  = dbPersonal.doc('challenge/current');
    const curSnap = await curRef.get();
    if (!curSnap.exists) {
      await curRef.set({
        id: 'june2026', number: 1, name: 'Challenge #1',
        start: '2026-06-01', end: '2026-06-30',
        createdAt: new Date().toISOString(),
      });
      console.log('[Seed] challenge/current → Challenge #1');
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

// ── ИДЭВХТЭЙ CHALLENGE — reusable (Challenge #1, #2, #3 ...) ───────
// challenge/current → { id, number, name, end }. Бүх challenge зам
// `challenge/${CHID}/...` ашиглана. /newchallenge-ээр шинэ challenge эхэлнэ.
let CHID    = 'june2026';
let CHINFO  = { id: 'june2026', number: 1, name: 'Challenge #1', end: '2026-06-30' };
async function refreshChallenge() {
  try {
    const snap = await dbPersonal.doc('challenge/current').get();
    if (snap.exists) {
      const d = snap.data();
      CHINFO = {
        id: d.id || 'june2026', number: d.number || 1,
        name: d.name || 'Challenge', end: d.end || '2026-06-30',
      };
      CHID = CHINFO.id;
    }
  } catch (e) { console.error('[Challenge] refresh error:', e.message); }
}
refreshChallenge();                         // startup-д ачаална
setInterval(refreshChallenge, 60 * 1000);   // 1 минут тутам шинэчилнэ

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
    // GAP-14: Web-ийн MAX_MSGS*4=48 лимиттэй тэнцүү хадгална
    // slice(-10) нь web-ийн урт түүхийг устгаж байсан
    await dbPersonal.doc(`users/${uid}/meta/chat`).set({
      history:   msgs.slice(-48),
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
  // GAP-04: Нэгдсэн scoring helper ашиглана
  const score = _calcBilegScore(rt, water);
  return { score, routine: rt, water };
}

async function getStreak(key, uid = UID) {
  // GAP-06: getAll() — 30 sequential read → 1 batched RPC call
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const refs = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    refs.push(dbPersonal.doc(`users/${uid}/routines/${d.toLocaleDateString('sv')}`));
  }
  const snaps = await dbPersonal.getAll(...refs);
  let s = 0;
  for (const snap of snaps) {
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

  // ── HSK Blitz: өнөөдрийн 20 ханз — HSK3 шалгалт 20 өдрийн дотор ──
  const todayWords = [...HSK_BANK].sort(() => Math.random() - 0.5).slice(0, 20);

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
  msg += `\n\n🈶 *Өнөөдрийн 20 ханз (HSK3 · 20 өдөр үлдсэн):*\n`;
  todayWords.forEach((w, i) => {
    msg += `${i+1}. *${w.char}* (${w.pinyin}) — ${w.meaning}\n`;
  });
  msg += `\n_/hsk\\_drill — drill эхлэх · дуут зурвасаар өгүүлбэр зохио 🎯_`;

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
  if (!cb?.message) return; // ghost callback — message deleted эсвэл inline mode
  const { data: cmd, message, id: cbId } = cb;
  const msgId = message.message_id;
  const chatId = message.chat?.id ?? cb.from?.id ?? TG_CHAT;
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

  // Sprint 37: Multi-sig downgrade approve/deny
  if (cmd === 'dg_yes' || cmd === 'dg_no') {
    try {
      const eng = require('./execution-engine');
      const approverChat = String(cb.message?.chat?.id || cb.from?.id || '');
      const approver = await findUserByChatId(approverChat) || { uid: UID };
      const res = await eng.resolveDowngrade(approver.uid, cmd === 'dg_yes');
      if (!res.ok) { await tgCall('editMessageText', { chat_id: approverChat, message_id: msgId, text: '⚠️ Хүсэлт олдсонгүй (хугацаа дууссан байж магадгүй).' }); return; }
      await tgCall('editMessageText', {
        chat_id: approverChat, message_id: msgId,
        text: res.approved
          ? `✅ Зөвшөөрлөө — Level ${res.level} болголоо.`
          : `❌ Татгалзлаа — шахалт Level 3 руу буцлаа. 💀`,
      });
      // Requester-д мэдэгдэх
      const reqChat = await eng.getUserChatId(res.requester);
      if (reqChat) await tgCall('sendMessage', {
        chat_id: reqChat, parse_mode: 'Markdown',
        text: res.approved
          ? `🤝 Хамтрагч зөвшөөрлөө — Level ${res.level}. Амар.`
          : `🔥 Хамтрагч ТАТГАЛЗЛАА. Level 3 хэвээр. Зугтах зам алга — хий!`,
      });
    } catch (e) { console.error('[dg-callback]', e.message); }
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

  // ── PROOF-CAM: баталгаажуулах / татгалзах / харсан ──────────────
  if (cmd.startsWith('vproof|') || cmd.startsWith('sproof|') || cmd.startsWith('xproof|')) {
    const action = cmd.slice(0, 6);   // 'vproof' | 'xproof' | 'sproof'
    const [, dateStr, pid] = cmd.split('|');
    const here = String(cb.message?.chat?.id || cb.from?.id || '');
    try {
      const ref   = dbPersonal.doc(`challenge/${CHID}/proofs/${dateStr}`);
      const snap  = await ref.get();
      const proof = snap.exists ? snap.data()?.[pid] : null;
      if (!proof) return;

      if (action === 'vproof') {
        if (proof.verified) return;
        await ref.set({ [pid]: { verified: true, rejected: false, verifiedAt: new Date().toISOString() } }, { merge: true });
        // Sender-ийн өдрийн verified баталгааны тоог нэмэгдүүлнэ
        const role  = proof.fromUid === UID ? 'bileg' : 'marlaa';
        const dRef  = dbPersonal.doc(`challenge/${CHID}/daily/${dateStr}`);
        const dSnap = await dRef.get();
        const cur   = dSnap.exists ? (dSnap.data()?.[role]?.proofs || 0) : 0;
        await dRef.set({ [role]: { proofs: cur + 1 } }, { merge: true }).catch(() => {});
        await tgCall('editMessageReplyMarkup', { chat_id: here, message_id: msgId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
        await tgCall('editMessageCaption', { chat_id: here, message_id: msgId,
          caption: `✅ Баталгаажлаа — *${proof.fromName}*: ${proof.caption || ''}`, parse_mode: 'Markdown' }).catch(() => {});
        if (proof.fromChat) await tgCall('sendMessage', { chat_id: proof.fromChat, parse_mode: 'Markdown',
          text: `🔥 Хамтрагч таны баталгааг *зөвшөөрлөө!* ✅\nӨнөөдөр *${cur + 1}* баталгаа. Үргэлжлүүл!` });
      } else if (action === 'xproof') {
        if (proof.rejected) return;
        await ref.set({ [pid]: { rejected: true, rejectedAt: new Date().toISOString() } }, { merge: true });
        await tgCall('editMessageReplyMarkup', { chat_id: here, message_id: msgId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
        await tgCall('editMessageCaption', { chat_id: here, message_id: msgId,
          caption: `❌ Татгалзав — *${proof.fromName}*: ${proof.caption || ''}`, parse_mode: 'Markdown' }).catch(() => {});
        if (proof.fromChat) await tgCall('sendMessage', { chat_id: proof.fromChat, parse_mode: 'Markdown',
          text: `❌ Хамтрагч таны баталгааг *зөвшөөрсөнгүй* (хуурамж/буруу гэж үзлээ).\nЖинхэнэ, шинэ зураг дахин илгээгээрэй. 📸` });
      } else {
        await ref.set({ [pid]: { seen: true } }, { merge: true });
        await tgCall('editMessageReplyMarkup', { chat_id: here, message_id: msgId,
          reply_markup: { inline_keyboard: [[
            { text: '✅ Баталгаажуулах', callback_data: `vproof|${dateStr}|${pid}` },
            { text: '❌ Худал',          callback_data: `xproof|${dateStr}|${pid}` },
          ]] } }).catch(() => {});
        if (proof.fromChat) await tgCall('sendMessage', { chat_id: proof.fromChat,
          text: `👀 Хамтрагч таны баталгааг харлаа.` }).catch(() => {});
      }
    } catch (e) { console.error('[proof-cb]', e.message); }
    return;
  }
}

// ══════════════════════════════════════════════════════════════════
// PROOF-CAM — хамтрагч руу зураг + чат, баталгаажуулалт (Locket маягаар)
// ══════════════════════════════════════════════════════════════════

// Хамтрагчийн мэдээллийг олох (Билэг ↔ Маралаа)
async function getPartnerInfo(uid) {
  const partnerUid = uid === UID ? 'marlaa' : UID;
  const [metaSnap, cfgSnap, intSnap] = await Promise.all([
    dbPersonal.doc(`users/${partnerUid}/meta/profile`).get().catch(() => null),
    dbPersonal.doc(`users/${partnerUid}/config/profile`).get().catch(() => null),
    dbPersonal.doc(`users/${partnerUid}/integrations/telegram`).get().catch(() => null),
  ]);
  const meta = metaSnap?.exists ? metaSnap.data() : {};
  const cfg  = cfgSnap?.exists  ? cfgSnap.data()  : {};
  const intg = intSnap?.exists  ? intSnap.data()  : {};
  const chatId = meta.telegram_chat_id || intg.chat_id ||
                 (partnerUid === UID ? String(TG_CHAT) : null);
  const name = cfg.name || meta.name || (partnerUid === UID ? 'Билэг' : 'Маралаа');
  return { uid: partnerUid, chatId, name };
}

// Зураг хүлээж авч хамтрагч руу баталгаажуулахаар дамжуулна
async function handlePhoto(msg, ctx = {}) {
  const uid    = ctx.uid || UID;
  const myName = ctx.name || (uid === UID ? 'Билэг' : 'Маралаа');
  const myChat = ctx.chatId || TG_CHAT;
  const photos = msg.photo || [];
  if (!photos.length) return;
  const fileId  = photos[photos.length - 1].file_id;   // хамгийн том хувилбар
  const caption = (msg.caption || '').trim();
  const today   = todaySH();

  const partner = await getPartnerInfo(uid);
  if (!partner.chatId) {
    await tgCall('sendMessage', { chat_id: myChat, parse_mode: 'Markdown',
      text: '⚠️ Хамтрагч бүртгэгдээгүй байна. Эхлээд `/addpartner` хий.' });
    return;
  }

  const proofId = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  await dbPersonal.doc(`challenge/${CHID}/proofs/${today}`).set({
    [proofId]: {
      fromUid: uid, fromName: myName, fromChat: String(myChat),
      toUid: partner.uid, caption, fileId,
      verified: false, seen: false, ts: new Date().toISOString(),
    },
  }, { merge: true }).catch(e => console.error('[proof-save]', e.message));

  await tgCall('sendPhoto', {
    chat_id: partner.chatId,
    photo:   fileId,
    caption: `📸 *${myName}*: ${caption || 'баталгаа илгээлээ'}`,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[
      { text: '✅ Баталгаажуулах', callback_data: `vproof|${today}|${proofId}` },
      { text: '❌ Худал',          callback_data: `xproof|${today}|${proofId}` },
      { text: '👀 Харсан',        callback_data: `sproof|${today}|${proofId}` },
    ]] },
  });

  await tgCall('sendMessage', { chat_id: myChat, parse_mode: 'Markdown',
    text: `📤 *${partner.name}* руу илгээлээ. Баталгаажуулалт хүлээж байна...` });
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

    // Dynamic coaching: Gemini-аар context-aware тайлбар үүсгэнэ
    let coachNote = pct >= 80 ? '💪 Гайхалтай! Хэмнэл хадгалаарай.' : '📚 Буруу үгсийг дахин давтаарай.';
    try {
      const prog = await getProgress(uid);
      const aiNote = await callGeminiCoach({
        progress: prog,
        mode: 'drill_end',
        drillResult: { correct: newCorrect, total: session.words.length, pct },
      });
      if (aiNote) coachNote = aiNote;
    } catch { /* fallback to default */ }
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
  // System instruction: профайлаас авах, байхгүй бол динамик (HSK хоног тооцно)
  const sysText = ctx.system_instruction || getBilegSystem().parts[0].text;
  // API key: профайлаас авах, байхгүй бол env var
  const apiKey  = ctx.custom_api_key || process.env.SYSTEM_USE_TOKEN;

  // ── MULTI-USER FIX: хариуг ЗӨВ хэрэглэгч рүү явуулах ───────────────
  // Модуль-түвшний tgSend нь TG_CHAT (Билэг) руу заасан тул энд ctx.chatId-аар
  // дарж бичнэ. Ингэснээр Маралаагийн командын хариу Маралаа руугаа очно.
  const tgSend = (t, extra = {}) =>
    tgCall('sendMessage', { chat_id: ctx.chatId || TG_CHAT, text: t, parse_mode: 'Markdown', ...extra });

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

  // FIX: substring match (text.includes) нь жирийн чатад андуурч ажилладаг байсан.
  // Зөвхөн тодорхой команд эсвэл богино баталгаа хэллэг л тэмдэглэнэ.
  if (['/dasgal', 'дасгал хийлээ', 'дасгалаа хийлээ', 'дасгал хийсэн', 'workout хийлээ'].includes(text)) {
    await logRoutine('exercise', uid);
    const { score } = await getScore(uid);
    const s = await getStreak('exercise', uid);
    await tgSend(`💪 Дасгал тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`);
    return;
  }

  if (['/hanzi', '汉字 хийлээ', 'ханз хийлээ', 'ханз сурлаа', '汉字 сурлаа', 'ханз хийсэн'].includes(text)) {
    await logRoutine('hanzi', uid);
    const { score } = await getScore(uid);
    const s = await getStreak('hanzi', uid);
    await tgSend(`🈶 汉字 тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`);
    return;
  }

  if (['/nom', 'ном уншлаа', 'уншлаа', 'ном уншсан', 'номоо уншлаа'].includes(text)) {
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

  // GAP-08 + GAP-01: Нэгдсэн /done handler
  // Life plan (string ID) эхлээд шалгана, тоо бол legacy task руу unfall
  const doneMatch = raw.match(/^\/done\s+(\S+)/i);
  if (doneMatch) {
    const arg   = doneMatch[1].trim();
    const today = todaySH();

    // 0) Sprint 37: Execution Engine window completion (XP олгох, penalty зогсоох)
    try {
      const execEngine = require('./execution-engine');
      const res = await execEngine.completeWindow(uid, arg.toLowerCase(), today);
      if (res.ok) {
        await tgSend(
          `✅ *${res.label}* — БАТАЛГААЖЛАА! 🔥\n\n` +
          `+${res.award} XP олголоо. Цонх хаагдлаа, торгууль зогслоо.\n` +
          `Дараагийн зорилт руугаа!`
        );
        // Electron UI-д real-time push
        await dbPersonal.doc(`users/${uid}/telegram_inbox/${Date.now()}`).set({
          type: 'window_done', taskId: arg, text: `/done ${arg}`,
          timestamp: new Date().toISOString(), processed: false,
        }).catch(() => {});
        return;
      }
    } catch (e) { console.error('[done-window]', e.message); }

    // 1) Life plan lookup (Sprint 34)
    try {
      const snap = await dbPersonal.doc(`users/${uid}/plans/${today}`).get();
      if (snap.exists) {
        const plan     = snap.data().confirmed || [];
        const argLower = arg.toLowerCase();
        const idx      = plan.findIndex(t =>
          t.id === argLower ||
          t.id === 'custom_' + argLower ||
          t.label?.toLowerCase().includes(argLower)
        );
        if (idx >= 0) {
          plan[idx].done = true;
          await dbPersonal.doc(`users/${uid}/plans/${today}`).set(
            { confirmed: plan }, { merge: true }
          );
          // GAP-01: Electron UI-д real-time push
          await dbPersonal.doc(`users/${uid}/telegram_inbox/${Date.now()}`).set({
            type: 'done', taskId: arg,
            text: `/done ${arg}`,
            timestamp: new Date().toISOString(),
            processed: false,
          });
          const doneCnt = plan.filter(t => t.done).length;
          const pct     = Math.round(doneCnt / plan.length * 100);
          // Оноог хэрэглэгчийн ЖИНХЭНЭ role руу бичнэ (hardcode 'marlaa' биш)
          const _role = ctx.role || (uid === UID ? 'bileg' : 'marlaa');
          await _updateChallengeScore(uid, _role, pct, doneCnt, plan.length);
          const task = plan[idx];
          await tgSend(
            `✅ *${task.icon} ${task.label}* — баталгаажлаа!\n\n` +
            `Хуваарь: *${doneCnt}/${plan.length}* дуусгасан (${pct}%)\n` +
            `${pct >= 70 ? '🔥 Streak аюулгүй!' : '⏳ Үргэлжлүүл...'}`
          );
          return;
        }
      }
    } catch (e) {
      console.error('[done-plan]', e.message);
    }

    // 2) Legacy numeric task fallback
    const n = parseInt(arg, 10);
    if (!isNaN(n) && String(n) === arg) {
      const done = await doneTask(n, uid);
      if (!done) { await tgSend('⚠️ Тийм дугаартай task байхгүй байна.'); return; }
      const remaining = await getTasks(uid);
      await tgSend(`✅ *Дууслаа:* ${done}\n\nҮлдсэн: *${remaining.length}*`);
      return;
    }

    // 3) Not found anywhere
    await tgSend(`⚠️ "${arg}" хуваарьт олдсонгүй.\n/plan — хуваарь харах`);
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
  // ══════════════════════════════════════════════════════════════
  // SPRINT 34 — JUNE CHALLENGE & LIFE PLAN COMMANDS
  // Одоо байгаа командуудтай зөрчилдөхгүйгээр нэмэгдлээ
  // ══════════════════════════════════════════════════════════════

  // /msg <text> — хамтрагч руу шуурхай чат (Proof-Cam хослол)
  if (raw.startsWith('/msg ') || raw.startsWith('/msg\n')) {
    const body = raw.replace(/^\/msg[\s\n]+/, '').trim();
    if (!body) { await tgSend('Хэлбэр: `/msg Хичээлээ хийсэн үү?`'); return; }
    const partner = await getPartnerInfo(uid);
    if (!partner.chatId) { await tgSend('⚠️ Хамтрагч бүртгэгдээгүй байна.'); return; }
    const myName = ctx.name || (uid === UID ? 'Билэг' : 'Маралаа');
    await tgCall('sendMessage', { chat_id: partner.chatId, parse_mode: 'Markdown',
      text: `💬 *${myName}*: ${body}\n\n_Хариулах: /msg ..._` });
    await tgSend(`📤 *${partner.name}* руу илгээлээ.`);
    return;
  }

  // ── FINANCE COMMANDS ──────────────────────────────────────────────
  // /зарлага <дүн> [CNY|MNT|USD] [категори] [тайлбар]
  // /орлого  <дүн> [CNY|MNT|USD] [тайлбар]
  // /хуримтлал <дүн> [тайлбар]
  // /санхүү — энэ сарын тайлан
  // ─────────────────────────────────────────────────────────────────
  const finCmd = raw.match(/^\/?(зарлага|орлого|хуримтлал|санхүү|finance|expense|income|savings)\b/i);
  if (finCmd) {
    const cmd = finCmd[1].toLowerCase();

    if (cmd === 'санхүү' || cmd === 'finance') {
      // Monthly summary from Firestore
      const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
      const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      let txns = [];
      try {
        const snap = await dbPersonal.collection(`users/${uid}/finance/txns/records`)
          .where('date', '>=', month + '-01').where('date', '<=', month + '-31').get();
        txns = snap.docs.map(d => d.data());
      } catch {}
      const incomeCNY  = txns.filter(t=>t.type==='income'&&t.currency==='CNY').reduce((s,t)=>s+t.amount,0);
      const expCNY     = txns.filter(t=>t.type==='expense'&&t.currency==='CNY').reduce((s,t)=>s+t.amount,0);
      const incMNT     = txns.filter(t=>t.type==='income'&&t.currency==='MNT').reduce((s,t)=>s+t.amount,0);
      const expMNT     = txns.filter(t=>t.type==='expense'&&t.currency==='MNT').reduce((s,t)=>s+t.amount,0);
      const savMNT     = txns.filter(t=>t.type==='savings'&&t.currency==='MNT').reduce((s,t)=>s+t.amount,0);
      const net        = incomeCNY - expCNY;
      // Category breakdown
      const cats = {};
      txns.filter(t=>t.type==='expense'&&t.currency==='CNY').forEach(t => { cats[t.category] = (cats[t.category]||0) + t.amount; });
      const catLines = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5)
        .map(([c,a]) => `  • ${c}: ¥${a.toFixed(0)}`).join('\n');
      await tgSend(`💰 *${month} САНХҮҮГИЙН ТАЙЛАН*\n\n` +
        `*CNY*\n` +
        `  📈 Орлого: ¥${incomeCNY.toFixed(0)}\n` +
        `  📉 Зарлага: ¥${expCNY.toFixed(0)}\n` +
        `  ${net>=0?'✅':'⚠️'} Үлдэгдэл: ${net>=0?'+':''}¥${net.toFixed(0)}\n\n` +
        (expMNT||incMNT||savMNT ? `*MNT*\n  ⬆ Хуримтлал: ₮${savMNT.toLocaleString()}\n\n` : '') +
        (catLines ? `*Зарлагын ангилал:*\n${catLines}\n\n` : '') +
        `_Нийт ${txns.length} гүйлгээ · /finance дэлгэрэнгүй_`);
      return;
    }

    // Parse: /зарлага 50 CNY хоол coffee
    const parts  = raw.trim().split(/\s+/).slice(1);
    let amount   = 0, currency = 'CNY', category = 'бусад', note = '';

    // Amount (support 50, 50CNY, 50¥, 50₮, 50000MNT)
    const amtMatch = parts[0]?.match(/^([\d.]+)(CNY|MNT|USD|¥|₮|\$)?$/i);
    if (amtMatch) {
      amount = parseFloat(amtMatch[1]);
      if (amtMatch[2]) currency = {CNY:'CNY','¥':'CNY',MNT:'MNT','₮':'MNT',USD:'USD','$':'USD'}[amtMatch[2].toUpperCase()] || 'CNY';
      parts.shift();
    }
    // Explicit currency word
    if (/^(CNY|MNT|USD)$/i.test(parts[0])) { currency = parts.shift().toUpperCase(); }

    // Category
    const CATS = ['хоол','тээвэр','амьдрал','хувцас','боловсрол','LFS','тоглоом','хуримтлал','бусад'];
    if (parts[0] && CATS.some(c => c === parts[0].toLowerCase())) { category = parts.shift(); }
    note = parts.join(' ');

    if (!amount) {
      const ex = cmd==='зарлага'||cmd==='expense' ? '/зарлага 50 хоол coffee' : cmd==='орлого'||cmd==='income' ? '/орлого 2000 LFS' : '/хуримтлал 100000 хадгаламжийн данс';
      await tgSend(`Хэлбэр: \`${ex}\``); return;
    }

    const type = (cmd==='зарлага'||cmd==='expense') ? 'expense'
               : (cmd==='хуримтлал'||cmd==='savings') ? 'savings' : 'income';
    if (type === 'savings') currency = currency==='CNY' ? 'MNT' : currency;
    if (type === 'savings' && category==='бусад') category = 'хуримтлал';

    const txn = {
      id:       Date.now().toString(),
      type, amount, currency, category, note,
      date:     new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Shanghai'})).toISOString().slice(0,10),
      ts:       new Date().toISOString(),
      source:   'telegram',
    };
    try {
      await dbPersonal.collection(`users/${uid}/finance/txns/records`).doc(txn.id).set(txn);
    } catch (e) { console.error('[Finance] Firestore:', e.message); }

    const symb = currency==='MNT' ? '₮' : currency==='USD' ? '$' : '¥';
    const icon = type==='expense' ? '📉' : type==='savings' ? '⬆' : '📈';
    await tgSend(`${icon} *${category}* — ${symb}${amount.toLocaleString()}\n${note ? `_${note}_\n` : ''}\`/санхүү\` тайлан харах`);
    return;
  }

  // /newchallenge YYYY-MM-DD <нэр> — шинэ challenge эхлүүлэх (зөвхөн Билэг)
  if (raw.startsWith('/newchallenge')) {
    if (uid !== UID) { await tgSend('⛔️ Зөвхөн админ энэ командыг ашиглана.'); return; }
    const parts = raw.trim().split(/\s+/);
    const end   = parts[1] || '';
    const name  = parts.slice(2).join(' ');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      await tgSend('Хэлбэр: `/newchallenge 2026-07-31 July Glow-Up`\n(дуусах огноо YYYY-MM-DD заавал)');
      return;
    }
    const number    = (CHINFO.number || 1) + 1;
    const id        = `ch${number}_${end.replace(/-/g, '')}`;
    const finalName = name || `Challenge #${number}`;
    await dbPersonal.doc('challenge/current').set({
      id, number, name: finalName,
      start: todaySH(), end,
      createdAt: new Date().toISOString(),
    });
    await refreshChallenge();   // CHID/CHINFO-г шууд шинэчлэх
    await tgSend(
      `🏁 *${finalName}* эхэллээ!\n\n` +
      `📅 Дуусах: *${end}*\n` +
      `🆔 \`${id}\`\n\n` +
      `Оноо 0-ээс эхэлнэ. Өмнөх challenge-ийн дата хадгалагдсан.\n\`/challenge\``
    );
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // /addpartner <chatId> <Нэр> — Хамтрагчийг (Маралаа) challenge-д бүртгэх
  // Зөвхөн Билэг (админ) ашиглана. Railway руу орох шаардлагагүй.
  // ══════════════════════════════════════════════════════════════
  if (raw.startsWith('/addpartner')) {
    if (uid !== UID) { await tgSend('⛔️ Зөвхөн админ энэ командыг ашиглана.'); return; }
    const parts = raw.trim().split(/\s+/);
    const pChat = (parts[1] || '').replace(/[^0-9]/g, '');
    const pName = parts.slice(2).join(' ') || 'Маралаа';
    if (!pChat) {
      await tgSend('Хэлбэр: `/addpartner 123456789 Маралаа`\n\nМаралаагийн Chat ID-г `@userinfobot` → /start-аас авна.');
      return;
    }
    const pUid = 'marlaa';
    try {
      await Promise.all([
        dbPersonal.doc(`telegram_lookup/${pChat}`).set(
          { uid: pUid, seededAt: new Date().toISOString() }, { merge: true }),
        dbPersonal.doc(`users/${pUid}/config/profile`).set(
          { role: 'marlaa', name: pName, updatedAt: new Date().toISOString() }, { merge: true }),
        dbPersonal.doc(`users/${pUid}/meta/profile`).set({
          name: pName, username_slug: 'marlaa', telegram_chat_id: String(pChat),
          system_instruction: 'Чи бол Маралаагийн хувийн AI дасгалжуулагч. Монголоор, найрсаг, шууд хариул. Glow-up, дасгал, хичээл, гоо сайхан, шинэ мэдлэгт өдөр бүр түлхэц өг. Богино, урам зоригтой бич.',
          seededAt: new Date().toISOString(),
        }, { merge: true }),
        dbPersonal.doc(`users/${pUid}/integrations/telegram`).set(
          { chat_id: String(pChat) }, { merge: true }),
      ]);
      // Маралаад тавтай морилох мессеж (тэр bot-оо Start дарсан байх ёстой)
      await tgCall('sendMessage', {
        chat_id: pChat, parse_mode: 'Markdown',
        text: `🌸 Сайн уу, ${pName}!\n\nБилэгтэй хийх *June Challenge*-д холбогдлоо. 🏆\n\n` +
              `• \`/glow\` — өнөөдрийн Glow-Up даалгавар\n` +
              `• \`/plan\` — өдрийн хуваарь\n` +
              `• \`/done [нэр]\` — дуусгасан зүйлээ тэмдэглэх\n` +
              `• \`/challenge\` — оноо харьцуулах\n\n` +
              `Өдөр бүр 22:00-д хоёрын дүн группд гарна. Амжилт! ✨`,
      });
      await tgSend(`✅ *${pName}* бүртгэгдлээ! (chat: \`${pChat}\`)\n\nТүүнд тавтай морилох мессеж илгээлээ.\nХэрэв \"chat not found\" гарвал Маралаа эхлээд bot-оо нээж *Start* дарах ёстой.`);
    } catch (e) {
      await tgSend(`❌ Бүртгэл алдаа: ${e.message}`);
    }
    return;
  }

  // /challenge — June Challenge scoreboard
  if (text === '/challenge' || text === '/ch') {
    try {
      const today = todaySH();
      const [dSnap, bStreakSnap, mStreakSnap] = await Promise.all([
        dbPersonal.doc(`challenge/${CHID}/daily/${today}`).get().catch(() => null),
        dbPersonal.doc(`challenge/${CHID}/streaks/${UID}`).get().catch(() => null),
        dbPersonal.doc(`challenge/${CHID}/streaks/marlaa`).get().catch(() => null),
      ]);
      const scores  = dSnap?.exists ? dSnap.data() : {};
      const bScore  = scores.bileg  || {};
      const mScore  = scores.marlaa || {};
      const bStreak = bStreakSnap?.exists ? bStreakSnap.data() : {};
      const mStreak = mStreakSnap?.exists ? mStreakSnap.data() : {};

      const END = new Date(CHINFO.end + 'T23:59:59+08:00');
      const daysLeft = Math.max(0, Math.ceil((END - Date.now()) / 86400000));

      const bp = bScore.pct || 0, mp = mScore.pct || 0;
      const lead = bp === mp ? '🤝 Тэнцүү'
                 : bp >  mp  ? '⚡ Билэг түрүүлж байна'
                 :             '🌸 Маралаа түрүүлж байна';

      let msg = `🏆 *${CHINFO.name.toUpperCase()} — ${today}*\n`;
      msg += `\`${'━'.repeat(20)}\`\n\n`;
      msg += `⚡ *Билэг*\n  Өнөөдөр: *${bp}%*  🔥 ${bStreak.current || 0} хоног  📸 ${bScore.proofs || 0}\n\n`;
      msg += `🌸 *Маралаа*\n  Өнөөдөр: *${mp}%*  🔥 ${mStreak.current || 0} хоног  📸 ${mScore.proofs || 0}\n\n`;
      msg += `${lead}\n📅 Үлдсэн: *${daysLeft}* хоног (${CHINFO.end} хүртэл)\n`;
      msg += `\n_/glow — Glow-Up checklist · /score — дэлгэрэнгүй_`;
      await tgSend(msg);
    } catch (e) {
      await tgSend(`❌ Challenge алдаа: ${e.message}`);
    }
    return;
  }

  // /glow [done <ангилал>] — Glow-Up checklist + Telegram-аас тэмдэглэх
  if (text === '/glow' || text === '/glowup' || raw.startsWith('/glow ')) {
    try {
      const cfg    = await getGlowupConfig(uid);   // [{id,icon,title,tasks}]
      const today  = todaySH();
      const myRole = (await dbPersonal.doc(`users/${uid}/config/profile`).get().catch(()=>null))?.data()?.role
                   || (uid === UID ? 'bileg' : 'marlaa');
      const gRef   = dbPersonal.doc(`users/${uid}/glowup/${today}`);
      const gSnap  = await gRef.get().catch(() => null);
      let doneList = gSnap?.exists ? (gSnap.data()?.done || []) : [];

      // /glow done <ангилал> — тэмдэглэх
      const m = raw.match(/^\/glow\s+done\s+(.+)$/i);
      if (m) {
        const arg = m[1].trim().toLowerCase();
        const cat = cfg.find(c => c.id?.toLowerCase() === arg || c.title?.toLowerCase().includes(arg));
        if (!cat) {
          await tgSend(`⚠️ "${arg}" олдсонгүй.\nАнгилал: ${cfg.map(c => `\`${c.id}\``).join(' ')}`);
          return;
        }
        if (!doneList.includes(cat.id)) doneList.push(cat.id);
        const glowPct = cfg.length ? Math.round(doneList.length / cfg.length * 100) : 0;
        await gRef.set({ done: doneList, pct: glowPct, updatedAt: new Date().toISOString() }, { merge: true });
        // Challenge оноог шинэчлэх (бууруулахгүй — max)
        const dRef   = dbPersonal.doc(`challenge/${CHID}/daily/${today}`);
        const dSnap  = await dRef.get();
        const curPct = dSnap.exists ? (dSnap.data()?.[myRole]?.pct || 0) : 0;
        await _updateChallengeScore(uid, myRole, Math.max(curPct, glowPct), doneList.length, cfg.length);
        await tgSend(`✅ *${cat.icon} ${cat.title}* тэмдэглэгдлээ!\nGlow-Up: *${doneList.length}/${cfg.length}* (${glowPct}%)`);
        return;
      }

      // Bare /glow — статус харуулах
      const glowPct = cfg.length ? Math.round(doneList.length / cfg.length * 100) : 0;
      let msg = `🔥 *GLOW-UP — ${today}*\n`;
      msg += `Өнөөдөр: *${doneList.length}/${cfg.length}* (${glowPct}%)\n`;
      msg += `\`${'━'.repeat(20)}\`\n\n`;
      cfg.forEach(cat => {
        const mark = doneList.includes(cat.id) ? '✅' : '☐';
        msg += `${mark} ${cat.icon} *${cat.title}*  \`/glow done ${cat.id}\`\n`;
        (cat.tasks || []).forEach(t => { msg += `      • ${t}\n`; });
        msg += '\n';
      });
      msg += `_Тэмдэглэх:_ \`/glow done workout\``;
      await tgSend(msg);
    } catch (e) {
      await tgSend(`❌ Glow-Up алдаа: ${e.message}`);
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // SPRINT 37 — RUTHLESS EXECUTION ENGINE COMMANDS
  // ══════════════════════════════════════════════════════════════
  const _eng = () => require('./execution-engine');

  // /sprint setup — анх тохируулах (calibration горим)
  if (text === '/sprint setup') {
    const name = (await dbPersonal.doc(`users/${uid}/config/profile`).get().catch(()=>null))?.data()?.name
              || (uid === UID ? 'Bileg' : 'User');
    await _eng().setupSprint(uid, name);
    await tgSend(
      `⚙️ *SPRINT ТОХИРУУЛАГДЛАА* — ${name}\n\n` +
      `📅 Дуусах: 2026-06-30\n` +
      `🟢 Calibration горим (Level 1 cap)\n\n` +
      `Дараагийн алхам:\n` +
      `• \`/sprint quickstart\` — өдрийн стандарт 3 цонх (HSK/Business/Gym)\n` +
      `• эсвэл \`/window 09:00-10:30 hsk HSK Drill\` — гараар нэмэх\n` +
      `• \`/sprint\` — статус харах`
    );
    return;
  }

  // /sprint quickstart — өдрийн template window үүсгэх
  if (text === '/sprint quickstart' || text === '/sprint qs') {
    const r = await _eng().quickstartDay(uid);
    await tgSend(
      `🚀 *Өдрийн ${r.count} цонх үүслээ:*\n` +
      `📚 09:00-10:30 HSK Drill\n` +
      `💼 15:00-16:30 Business / LFS\n` +
      `💪 18:00-19:30 Gym\n\n` +
      `Engine идэвхтэй. Цонх нээгдэхэд сануулна. \`/sprint\` — статус.`
    );
    return;
  }

  // /window HH:MM-HH:MM taskid Label — window нэмэх
  if (raw.startsWith('/window ')) {
    const parts = raw.slice(8).trim().split(/\s+/);
    const time   = parts[0];
    const taskId = (parts[1] || '').toLowerCase();
    const label  = parts.slice(2).join(' ') || taskId;
    if (!time || !taskId) {
      await tgSend('Хэлбэр: `/window 09:00-10:30 hsk HSK Drill`');
      return;
    }
    const r = await _eng().addWindow(uid, { time, taskId, label });
    if (r.ok) await tgSend(`✅ Цонх нэмэгдлээ: *${label}* (${time})\nӨнөөдөр нийт ${r.count} цонх. \`/sprint\``);
    else await tgSend(`❌ ${r.error}`);
    return;
  }

  // /sprint — статус
  if (text === '/sprint' || text === '/s') {
    const st = await _eng().getSprintStatus(uid);
    const END = new Date('2026-06-30'); const left = Math.max(0, Math.ceil((END - Date.now())/86400000));
    let msg = `🔥 *EXECUTION SPRINT*\n\`${'━'.repeat(20)}\`\n`;
    msg += `⚡ XP: *${st.xp}*  |  Өнөөдрийн торгууль: ${st.daily_penalty} (floor -40)\n`;
    msg += `🎚 Intensity cap: Level ${st.intensity_cap}${st.intensity_cap===1?' (calibration)':''}\n`;
    msg += `🤝 Co-op pool: ${st.coop_pool} XP  |  📅 ${left} хоног үлдсэн\n`;
    if (st.paused) msg += `\n⏸ *ПАУЗТАЙ* (kill switch идэвхтэй)\n`;
    msg += `\n*Өнөөдрийн цонхнууд:*\n`;
    if (!st.windows.length) msg += `_Цонх алга. /sprint quickstart дарна уу._`;
    else st.windows.forEach(w => {
      const icon = { COMPLETED:'✅', ELAPSED:'🔴', ACTIVE:'🟢', PENDING:'⚪', INTERCEPTED:'⏸' }[w.status] || '⚪';
      const t = w.start.slice(11,16) + '-' + w.end.slice(11,16);
      msg += `${icon} ${t} ${w.label}${w.status==='ELAPSED'?` (-${w.penalty_accrued})`:''}\n`;
    });
    msg += `\n_Дуусгах: /done [taskid] · Pause: /pause · Хатуу: /ruthless_`;
    await tgSend(msg);
    return;
  }

  // /pause [hours] — Sprint Kill Switch
  if (text === '/pause' || raw.startsWith('/pause ')) {
    const hrs = parseInt(raw.slice(6)) || 24;
    const r = await _eng().pauseSprint(hrs);
    // Partner-д мэдэгдэх
    const partnerName = uid === UID ? 'Bileg' : 'Хамтрагч';
    await tgSend(`⏸ *SPRINT ПАУЗ* — ${hrs} цаг.\nБүх дарамт зогслоо. Амраарай, эрүүл мэнд чухал. 🤍\n_Сэргээх: /resume_`);
    return;
  }
  if (text === '/resume') {
    await _eng().resumeSprint();
    await tgSend(`▶️ *SPRINT СЭРГЭЛЭЭ.* Дахин тулалдъя! 🔥\n\`/sprint\` — статус.`);
    return;
  }

  // /ruthless — calibration дуусгаж Level 3 cap идэвхжүүлэх
  if (text === '/ruthless') {
    await _eng().setIntensityCap(uid, 3);
    await tgSend(
      `💀 *SCORCHED EARTH ИДЭВХЖЛЭЭ — Level 3 cap*\n\n` +
      `Calibration дууслаа. Одооноос:\n` +
      `🔴 Цонх хаагдвал -1 XP/мин (floor -40)\n` +
      `📞 15+ мин → Pushover Critical Alert\n` +
      `🌙 Шөнө 23:00-06:45 = Deep Sleep (аюулгүй)\n\n` +
      `Бууруулах бол /downgrade — хамтрагчийн зөвшөөрөл хэрэгтэй. 🔒`
    );
    return;
  }

  // /downgrade [level] — Multi-sig: хамтрагчийн зөвшөөрөл шаардана
  if (text === '/downgrade' || raw.startsWith('/downgrade ')) {
    const lvl = parseInt(raw.slice(11)) || 1;
    const r = await _eng().requestDowngrade(uid, lvl);
    if (r.soloApplied) { await tgSend(`✅ Level ${r.level} болголоо (хамтрагч бүртгэлгүй).`); return; }
    const partnerChat = await _eng().getUserChatId(r.partnerUid);
    const myName = (await dbPersonal.doc(`sprint_users/${uid}`).get()).data()?.name || 'Хамтрагч';
    if (partnerChat) await tgCall('sendMessage', {
      chat_id: partnerChat, parse_mode: 'Markdown',
      text: `🔻 *${myName}* шахалтыг Level ${lvl} болгохыг хүсэж байна.\nЗөвшөөрөх үү?`,
      reply_markup: { inline_keyboard: [[
        { text: '✅ Зөвшөөрөх', callback_data: 'dg_yes' },
        { text: '❌ Татгалзах',  callback_data: 'dg_no'  },
      ]] },
    });
    await tgSend(`📨 Хүсэлт хамтрагч руу илгээгдлээ. Зөвшөөрөхийг хүлээж байна…\n_(Шөнө 30 мин хариугүй бол auto-escape)_`);
    return;
  }

  // /pushover <user_token> — Critical Alert token бүртгэх (Level 3)
  if (raw.startsWith('/pushover ')) {
    const token = raw.slice(10).trim();
    if (token.length < 20) { await tgSend('⚠️ Pushover user key буруу байна. Pushover апп → Settings → User Key.'); return; }
    await dbPersonal.doc(`sprint_users/${uid}`).set({ pushover_token: token }, { merge: true });
    await tgSend(`✅ Pushover холбогдлоо. Level 3-д Critical Alert чулуудна. 📞\n_Тест: /sprint quickstart дараад цонх алдаад үз._`);
    return;
  }

  // /poke — хамтрагчаа түлхэх
  if (text === '/poke') {
    const partnerUid = await _eng().getPartnerUid(uid);
    const partnerChat = partnerUid ? await _eng().getUserChatId(partnerUid) : null;
    const myName = (await dbPersonal.doc(`sprint_users/${uid}`).get()).data()?.name || 'Хамтрагч';
    if (partnerChat) { await tgCall('sendMessage', { chat_id: partnerChat, text: `👊 *${myName}* чамайг түлхэж байна: БОС, ХИЙ! 🔥`, parse_mode: 'Markdown' }); await tgSend('✅ Түлхэц илгээлээ.'); }
    else await tgSend('Хамтрагч бүртгэлгүй байна.');
    return;
  }

  // /today <task1 task2 ...> — ӨНӨӨДРИЙН хуваарь үүсгэх (апп-гүйгээр оролцох)
  if (raw.startsWith('/today ')) {
    const taskStr = raw.replace(/^\/today\s*/i, '').trim();
    const taskIds = taskStr ? taskStr.split(/[\s,]+/).filter(Boolean) : [];
    const KNOWN = {
      gym:'🏋 Gym', workout:'💪 Дасгал', shower:'🚿 Шүршүүр', class:'📚 Хичээл',
      study:'📝 Хичээл', read:'📖 Унших', skincare:'✨ Арьс арчилгаа',
      makeup:'💄 Грим', lunch:'🍱 Хоол', commute:'🚇 Зорчих', sleep_prep:'🌙 Унтах бэлтгэл',
    };
    if (!taskIds.length) {
      const list = Object.entries(KNOWN).map(([k,v]) => `\`${k}\` ${v}`).join('  ');
      await tgSend('📋 *Өнөөдрийн хуваарь үүсгэх*\n`/today gym study skincare`\n\n*Боломжит:* ' + list + '\n\n_Өөрийн нэрээр ч болно: `/today хятад дасгал`_');
      return;
    }
    const today = todaySH();
    const plan = taskIds.map(id => {
      const label = KNOWN[id.toLowerCase()] || ('📌 ' + id);
      const sp    = label.indexOf(' ');
      return {
        id:    id.toLowerCase(),
        icon:  sp > 0 ? label.slice(0, sp) : '📌',
        label: sp > 0 ? label.slice(sp + 1) : label,
        done:  false,
      };
    });
    await dbPersonal.doc(`users/${uid}/plans/${today}`).set(
      { confirmed: plan, created_at: new Date().toISOString() }, { merge: true });
    const list = plan.map(t => `• ${t.icon} ${t.label}`).join('\n');
    await tgSend(`✅ *Өнөөдрийн хуваарь бэлэн!*\n\n${list}\n\n_Дуусгасан:_ \`/done gym\`  ·  _Харах:_ \`/plan\``);
    return;
  }

  // /plan — өнөөдрийн life plan харах (Marlaa)
  if (text === '/plan' || text === '/today') {
    try {
      const today = todaySH();
      const snap  = await dbPersonal.doc(`users/${uid}/plans/${today}`).get();
      if (!snap.exists || !snap.data()?.confirmed?.length) {
        await tgSend(
          '📋 Өнөөдрийн хуваарь байхгүй байна.\n\n' +
          '`/today gym study skincare` — өнөөдрийн хуваарь үүсгэх\n' +
          '`/preflight ...` — маргаашийнхыг бэлдэх'
        );
        return;
      }
      const plan = snap.data().confirmed;
      const done = plan.filter(t => t.done).length;
      const pct  = Math.round(done / plan.length * 100);

      let msg = `📋 *Өнөөдрийн план — ${pct}%*\n\`${'─'.repeat(18)}\`\n\n`;
      plan.forEach(t => {
        const icon = t.done ? '✅' : '⏳';
        msg += `${icon} ${t.start ? t.start + ' ' : ''}${t.icon} *${t.label}*${t.mins ? ' (' + t.mins + 'м)' : ''}\n`;
      });
      msg += `\n_/done [ажил] — дуусгах_`;
      await tgSend(msg);
    } catch (e) {
      await tgSend(`❌ Алдаа: ${e.message}`);
    }
    return;
  }

  // /preflight [task1 task2 ...] — маргаашийн хуваарийн draft үүсгэх
  if (text.startsWith('/preflight ') || text === '/preflight') {
    const taskStr  = raw.replace(/^\/preflight\s*/i, '').trim();
    const taskIds  = taskStr ? taskStr.split(/[\s,]+/).filter(Boolean) : [];
    const KNOWN_TASKS = {
      gym:'🏋 Gym', shower:'🚿 Шүршүүр', class:'📚 Хичээл',
      commute:'🚇 Зорчих', lunch:'🍱 Хоол', haircut:'✂ Үсчин',
      study:'📝 Судалгаа', makeup:'💄 Грим', sleep_prep:'🌙 Унтах бэлтгэл',
    };
    if (!taskIds.length) {
      const list = Object.entries(KNOWN_TASKS).map(([k,v]) => `\`${k}\` ${v}`).join('  ');
      await tgSend(
        '✦ *Pre-flight Interview*\n\n' +
        'Маргаашийн ажлуудыг жагсаана уу:\n' +
        '`/preflight gym class shower`\n\n' +
        `*Боломжит ажлууд:*\n${list}`
      );
      return;
    }
    const tomorrow = new Date(Date.now() + 86400000)
      .toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
    const plan = taskIds.map(id => {
      const label = KNOWN_TASKS[id.toLowerCase()] || ('📌 ' + id);
      return { id: id.toLowerCase(), label: label.slice(2), icon: label[0], done: false };
    });
    await dbPersonal.doc(`users/${uid}/plans/${tomorrow}`).set({
      confirmed: plan, preflight_done: true, created_at: new Date().toISOString(),
    }, { merge: true });
    const list = plan.map(t => `• ${t.icon} ${t.label}`).join('\n');
    await tgSend(
      `✦ *${tomorrow}-ийн хуваарь бэлэн болсон!*\n\n${list}\n\n` +
      `_Апп дээр цагийн нарийвчлалтай хуваарь харагдана._\n` +
      `/plan — маргааш харах`
    );
    return;
  }

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
      `HSK ханзаар өгүүлбэр → оноо авах 🎯\n\n` +
      `🏆 *Challenge (Bileg vs Маралаа)*\n` +
      `/challenge — scoreboard + 📸\n` +
      `/today gym study skincare — өнөөдрийн хуваарь\n` +
      `/plan · /done [ажил] — харах/дуусгах\n` +
      `/glow — checklist · /glow done [ангилал]\n` +
      `[зураг илгээх] — Proof-Cam баталгаа\n` +
      `/msg [текст] — хамтрагч руу чат\n` +
      `/addpartner [id] [нэр] — хамтрагч нэмэх (админ)\n` +
      `/newchallenge [YYYY-MM-DD] [нэр] — шинэ challenge (админ)\n\n` +
      `⚡ *T.H.R.E.E. OS*\n` +
      `/os — өнөөдрийн бүрэн тоймchan (routine · HSK · challenge · finance · tasks)\n\n` +
      `🔥 *Execution Sprint (Sprint 37)*\n` +
      `/sprint setup — анх тохируулах\n` +
      `/sprint quickstart — өдрийн 3 цонх\n` +
      `/window 09:00-10:30 hsk HSK — цонх нэмэх\n` +
      `/sprint — статус + XP\n` +
      `/done [taskid] — цонх дуусгаж XP авах\n` +
      `/ruthless — Level 3 (Scorched Earth)\n` +
      `/pause [hrs] · /resume — kill switch`
    );
    return;
  }

  // ── /os — T.H.R.E.E. OS unified today view ───────────────────────
  if (text === '/os' || text === '/status') {
    const today = todaySH();
    const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    const [routineSnap, hskSnap, tasksRaw, challengeSnap, profileSnap] = await Promise.all([
      dbPersonal.doc(`users/${uid}/routines/${today}`).get().catch(() => null),
      dbPersonal.doc(`users/${uid}/hsk/today`).get().catch(() => null),
      dbPersonal.collection(`users/${uid}/tasks`).where('done', '==', false).get().catch(() => ({ docs: [] })),
      dbPersonal.doc('challenge/current').get().catch(() => null),
      dbPersonal.doc(`users/${uid}/bileg/profile`).get().catch(() => null),
    ]);

    const rt      = routineSnap?.exists ? routineSnap.data() : {};
    const hsk     = hskSnap?.exists ? hskSnap.data() : {};
    const tasks   = tasksRaw.docs.slice(0, 5).map(d => d.data().text).filter(Boolean);
    const profile = profileSnap?.exists ? profileSnap.data() : {};

    // Routine score
    const routineItems = [
      { k: 'exercise', e: '💪', l: 'Дасгал' },
      { k: 'hanzi',    e: '🈶', l: '汉字' },
      { k: 'read',     e: '📚', l: 'Уншилт' },
      { k: 'journal',  e: '📝', l: 'Journal' },
    ];
    const doneCnt = routineItems.filter(r => rt[r.k]).length;

    // Challenge
    let challengeBlock = '';
    if (challengeSnap?.exists) {
      const chid = challengeSnap.data().id;
      const [proofSnap, dailySnap] = await Promise.all([
        dbPersonal.doc(`challenge/${chid}/proofs/${today}`).get().catch(() => null),
        dbPersonal.doc(`challenge/${chid}/daily/${today}`).get().catch(() => null),
      ]);
      const pct = dailySnap?.exists ? (dailySnap.data()?.bileg?.pct || 0) : 0;
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      challengeBlock = `\n\n🏆 *Challenge:*\n${proofSnap?.exists ? '📸 Proof ✅' : '📸 Proof байхгүй'}\n\`${bar}\` ${pct}%`;
    }

    // Finance
    let financeBlock = '';
    try {
      const finSnap = await dbPersonal.collection(`users/${uid}/finance/txns/records`)
        .where('date', '>=', month + '-01').where('date', '<=', month + '-31').get();
      const txns   = finSnap.docs.map(d => d.data());
      const expCNY = txns.filter(t => t.type === 'expense' && t.currency === 'CNY').reduce((s,t) => s+t.amount, 0);
      const incCNY = txns.filter(t => t.type === 'income'  && t.currency === 'CNY').reduce((s,t) => s+t.amount, 0);
      const net    = incCNY - expCNY;
      if (txns.length) {
        financeBlock = `\n\n💰 *Санхүү (${month}):*\n` +
          `📈 ¥${incCNY.toFixed(0)}  📉 ¥${expCNY.toFixed(0)}  ${net >= 0 ? '✅' : '⚠️'} ${net >= 0 ? '+' : ''}¥${net.toFixed(0)}`;
      }
    } catch {}

    // Build message
    let msg = `⚡ *T.H.R.E.E. OS*\n\`${today}\`\n\n`;
    msg += `*Routine ${doneCnt}/4:*\n`;
    routineItems.forEach(r => { msg += `${rt[r.k] ? '✅' : '❌'} ${r.e} ${r.l}\n`; });

    if (hsk.date === today) {
      msg += `\n📚 *HSK:*\n${hsk.words?.length || 0} ханз · ${hsk.scored ? 'Drill ✅' : 'Drill ❌'}`;
    }

    msg += challengeBlock;
    msg += financeBlock;

    if (tasks.length) {
      msg += `\n\n📋 *Tasks (${tasks.length}):*\n`;
      tasks.forEach((t, i) => { msg += `${i + 1}. ${t}\n`; });
    }

    if (profile.goal)  msg += `\n🎯 _${profile.goal}_`;
    if (profile.focus) msg += `\n🔥 Focus: _${profile.focus}_`;

    await tgSend(msg);
    return;
  }

  // ── Free Chat — GitHub Models → Gemini fallback ─────────────────
  if (!apiKey) { await tgSend('⚠️ SYSTEM_USE_TOKEN тохируулаагүй.'); return; }
  try {
    const [hist, liveCtx] = await Promise.all([getChatHistory(uid), getFullContext(uid)]);
    const sysWithCtx = sysText + liveCtx;
    let reply = '', lastErr = '';

    try {
      const messages = [
        { role: 'system', content: sysWithCtx },
        ...hist.slice(-6).map(m => ({ role: m.role, content: (m.content || '').slice(0, 600) })),
        { role: 'user', content: raw.slice(0, 800) },
      ];
      const resp = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 600, temperature: 0.8 }),
      });
      const data = await resp.json();
      reply   = data.choices?.[0]?.message?.content?.trim() || '';
      lastErr = reply ? '' : (data.error?.message || `HTTP ${resp.status}`);
    } catch (e) { lastErr = e.message; }

    // Gemini fallback — Azure content filter эсвэл хоосон хариу үед
    if (!reply && GEMINI_URL) {
      try {
        console.log('[FreeChat] GitHub filtered/empty, trying Gemini fallback. Reason:', lastErr?.slice(0, 80));
        const contents = hist.slice(-6).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: (m.content || '').slice(0, 600) }],
        }));
        // Gemini: contents-ийн эхний role 'user' байх ёстой
        while (contents.length && contents[0].role === 'model') contents.shift();
        contents.push({ role: 'user', parts: [{ text: raw.slice(0, 800) }] });
        const gr   = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sysWithCtx }] },
            contents,
            generationConfig: { maxOutputTokens: 600, temperature: 0.8 },
          }),
        });
        const gd = await gr.json();
        reply = gd.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      } catch (ge) { console.error('[FreeChat] Gemini fallback error:', ge.message); }
    }

    if (!reply) {
      console.error('[FreeChat] both providers failed:', lastErr);
      await tgSend(`🤖 Одоогоор хариулж чадсангүй.\n_(${(lastErr || 'тодорхойгүй').slice(0, 70)})_\nТүр хүлээгээд дахин оролдоорой.`);
      return;
    }

    // Sliding window history хадгалах
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

// ── GAP-04: Нэгдсэн scoring helper (web UI-тай ижил томьёо) ─────
function _calcBilegScore(routine, water_ml) {
  return Math.min(100, Math.round(
    Math.min(25, (water_ml / 2000) * 25) +
    (routine.exercise ? 20 : 0) +
    (routine.hanzi    ? 20 : 0) +
    (routine.read     ? 15 : 0) +
    (routine.journal  ? 10 : 0)
  ));
}

// ── SPRINT 34: Challenge score шинэчлэх ─────────────────────────
async function _updateChallengeScore(uid, role, pct, done, total) {
  const today = todaySH();
  try {
    await dbPersonal.doc(`challenge/${CHID}/daily/${today}`).set(
      { [role]: { pct, done, total, uid, updatedAt: new Date().toISOString() } },
      { merge: true }
    );
    // GAP-03: merge: true — race condition сэргийлэх
    const streakRef  = dbPersonal.doc(`challenge/${CHID}/streaks/${uid}`);
    const streakSnap = await streakRef.get();
    const st = streakSnap.exists ? streakSnap.data() : { current: 0, best: 0, total_days: 0, last_date: '' };
    // GAP-10: Asia/Shanghai timezone (telegram.js-д аль хэдийнэ зөв байсан)
    const yesterday  = new Date(Date.now() - 86400000).toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
    const newCurrent = pct >= 50 ? (st.last_date === yesterday ? (st.current||0)+1 : 1) : 0;
    await streakRef.set({
      current: newCurrent, best: Math.max(newCurrent, st.best||0),
      total_days: (st.total_days||0) + (st.last_date !== today ? 1 : 0),
      last_date: today, role, updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch {}
}

// ── SPRINT 34: Checkpoint мессеж явуулах (server.js cron дуудна) ─
async function sendCheckpoints() {
  const now     = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const today   = now.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
  const nowMin  = now.getHours() * 60 + now.getMinutes();

  try {
    // GAP-07: telegram_lookup-аас татна — collection('users').get() биш
    const tgUsers = await _getTelegramUsers();
    for (const { uid, chatId } of tgUsers) {
      const planSnap = await dbPersonal.doc(`users/${uid}/plans/${today}`).get();
      if (!planSnap.exists) continue;
      const plan = planSnap.data()?.confirmed || [];

      for (let i = 0; i < plan.length; i++) {
        const t = plan[i];
        if (t.done) continue;
        const startMin = parseInt(t.start?.split(':')[0]||0)*60 + parseInt(t.start?.split(':')[1]||0);
        const endMin   = parseInt(t.end?.split(':')[0]||0)*60   + parseInt(t.end?.split(':')[1]||0);
        const key      = `jarvis_cp_${today}_${uid}_${i}`;

        const checks = [
          { offset: startMin - 30, type: 't30',  msg: `⏰ T-30 мин\n\n${t.icon} *${t.label}* эхлэхэд 30 минут үлдлээ!\n\nГарах бэлтгэлээ хийцгээ.` },
          { offset: startMin - 15, type: 't15',  msg: `⏰ T-15 мин\n\n${t.icon} *${t.label}*-д 15 минут!\nХувцас, хэрэгсэлээ бэлт.` },
          { offset: endMin - 20,   type: 'end20', msg: `⏱ 20 минут үлдлээ\n\n${t.icon} *${t.label}* дуусахад 20 минут үлдлээ.` },
          { offset: endMin + 5,    type: 'end5',  msg: `✋ Дууссан уу?\n\n${t.icon} *${t.label}* дуусах цагаасаа 5 минут өнгөрлөө.\n\nДуусчихсан бол: \`/done ${t.id}\`` },
        ];

        for (const cp of checks) {
          // GAP-05: window=4 (cron 5min interval-тай тэнцэх)
          if (Math.abs(nowMin - cp.offset) <= 4 && nowMin >= cp.offset) {
            const sentKey = `${key}_${cp.type}`;
            const sentRef = dbPersonal.doc(`checkpoint_sent/${sentKey}`);
            const already = (await sentRef.get().catch(() => null))?.exists;
            if (already) continue;
            await tgCall('sendMessage', { chat_id: chatId, text: cp.msg, parse_mode: 'Markdown' });
            await sentRef.set({ sentAt: new Date().toISOString() });
          }
        }
      }
    }
  } catch (e) {
    console.error('[Checkpoint] Error:', e.message);
  }
}

// 22:00 daily recap (server.js cron дуудна)
async function sendDailyRecap() {
  const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const today = now.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
  const recapRows = [];   // ← хуваалцсан group scoreboard-д хэрэглэнэ
  try {
    // Proof-Cam: өнөөдрийн баталгаажсан зургийг хүн тус бүрээр тоолох
    const proofSnap = await dbPersonal.doc(`challenge/${CHID}/proofs/${today}`).get().catch(() => null);
    const proofsByUid = {};
    if (proofSnap?.exists) {
      Object.values(proofSnap.data() || {}).forEach(p => {
        if (p && p.verified) proofsByUid[p.fromUid] = (proofsByUid[p.fromUid] || 0) + 1;
      });
    }

    // GAP-07: telegram_lookup-аас татна
    const tgUsers = await _getTelegramUsers();
    for (const { uid, chatId } of tgUsers) {
      const [routineSnap, planSnap, logSnap, roleSnap, streakSnap] = await Promise.all([
        dbPersonal.doc(`users/${uid}/routines/${today}`).get(),
        dbPersonal.doc(`users/${uid}/plans/${today}`).get(),
        dbPersonal.doc(`users/${uid}/logs/${today}`).get(),
        dbPersonal.doc(`users/${uid}/config/profile`).get().catch(() => null),
        dbPersonal.doc(`challenge/${CHID}/streaks/${uid}`).get().catch(() => null),
      ]);
      const r        = routineSnap.exists ? routineSnap.data() : {};
      const plan     = planSnap.exists ? (planSnap.data()?.confirmed || []) : [];
      const water_ml = logSnap?.exists ? (logSnap.data()?.water?.total_ml || 0) : 0;
      const done = plan.filter(t => t.done).length;
      const pct  = plan.length ? Math.round(done / plan.length * 100) : 0;

      const role   = roleSnap?.exists ? (roleSnap.data()?.role || 'bileg') : 'bileg';
      const name   = roleSnap?.data()?.name || (role === 'bileg' ? 'Билэг' : 'Маралаа');
      const streak = streakSnap?.exists ? (streakSnap.data()?.current || 0) : 0;
      const proofN = proofsByUid[uid] || 0;

      let msg = `🌙 *22:00 Өдрийн Тайлан — ${today}*\n\`${'─'.repeat(18)}\`\n\n`;
      // Glow-Up оноо (Telegram-аас /glow done-оор тэмдэглэсэн)
      const gSnap   = await dbPersonal.doc(`users/${uid}/glowup/${today}`).get().catch(() => null);
      const glowPct = gSnap?.exists ? (gSnap.data()?.pct || 0) : 0;
      let items, finalPct;
      if (role === 'bileg') {
        // GAP-04: Нэгдсэн scoring (_calcBilegScore — web UI-тай ижил)
        const score = _calcBilegScore(r, water_ml);
        finalPct = Math.max(score, glowPct);
        items = `${r.exercise?'✅':'❌'} Дасгал  ${r.hanzi?'✅':'❌'} 汉字  ${r.read?'✅':'❌'} Унш  ${r.journal?'✅':'❌'} Journal`;
        msg += `📊 Score: *${finalPct}/100*${glowPct > score ? ` _(glow ${glowPct}%)_` : ''}\n${items}\n\n`;
        await _updateChallengeScore(uid, 'bileg', finalPct, 0, 4);
      } else {
        finalPct = Math.max(pct, glowPct);
        items = plan.length
          ? plan.slice(0,5).map(t=>`${t.done?'✅':'❌'} ${t.label}`).join('  ')
          : (glowPct ? `✨ Glow-Up ${glowPct}%` : '—');
        msg += `📋 Дүн: *${finalPct}%*  _(хуваарь ${pct}% · glow ${glowPct}%)_\n${items}\n`;
        await _updateChallengeScore(uid, 'marlaa', finalPct, done, plan.length);
      }
      msg += `📸 Баталгаа: *${proofN}* verified\n`;
      msg += `\n💬 *Маргааш Pre-flight:*\n\`/preflight gym class shower\`\n_- эсвэл апп дээрх Pre-flight товч_`;
      await tgCall('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'Markdown' });

      recapRows.push({ role, name, pct: finalPct, streak, items, proofs: proofN });
    }

    // ── ХУВААЛЦСАН GROUP RECAP — Билэг vs Маралаа ───────────────────
    await sendGroupRecap(today, recapRows);
  } catch (e) {
    console.error('[DailyRecap] Error:', e.message);
  }
}

// Хоёр хүний өдрийн дүнг хуваалцсан группд нийтэлнэ (/setgroup-аар тохируулна)
async function sendGroupRecap(today, rows) {
  try {
    const cfgSnap = await dbPersonal.doc(`challenge/${CHID}/config`).get().catch(() => null);
    const groupId = cfgSnap?.exists ? cfgSnap.data()?.group_chat_id : null;
    if (!groupId || !rows || !rows.length) return;

    // Билэг эхэнд, Маралаа дараа нь эрэмбэлнэ
    const order = { bileg: 0, marlaa: 1 };
    rows.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));

    let msg = `🌙 *ӨДРИЙН ДҮН — ${today}*\n\`${'━'.repeat(15)}\`\n\n`;
    rows.forEach(r => {
      const icon = r.role === 'bileg' ? '⚡' : '🌸';
      msg += `${icon} *${r.name}*  ${r.pct}%  🔥${r.streak}  📸${r.proofs || 0}\n   ${r.items}\n\n`;
    });
    if (rows.length >= 2) {
      const [a, b] = rows;
      if (a.pct === b.pct) msg += `🤝 Өнөөдөр тэнцлээ! Маргааш дахиад өрсөлдье.`;
      else {
        const w = a.pct > b.pct ? a : b;
        msg += `🏆 Өнөөдөр: *${w.name}* түрүүллээ!`;
      }
    }
    await tgCall('sendMessage', { chat_id: groupId, text: msg, parse_mode: 'Markdown' });
  } catch (e) {
    console.error('[GroupRecap] Error:', e.message);
  }
}

// ── GAP-12: TELEGRAM OUTBOX PROCESSOR ───────────────────────────────
// users/${uid}/telegram_outbox дотор sent:false мессежүүдийг
// Telegram-д явуулж sent:true болгоно. Cron: */2 min
async function processOutbox() {
  try {
    const tgUsers = await _getTelegramUsers();
    for (const { uid, chatId } of tgUsers) {
      const outSnap = await dbPersonal
        .collection(`users/${uid}/telegram_outbox`)
        .where('sent', '==', false)
        .orderBy('created_at')
        .limit(5)
        .get()
        .catch(() => null);
      if (!outSnap || outSnap.empty) continue;

      for (const doc of outSnap.docs) {
        const { message } = doc.data();
        if (message) {
          await tgCall('sendMessage', {
            chat_id:    chatId,
            text:       message,
            parse_mode: 'HTML',
          }).catch(() => {});
        }
        await doc.ref.update({ sent: true, sent_at: new Date().toISOString() })
          .catch(() => {});
      }
    }
  } catch (e) {
    console.error('[Outbox] Error:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// SPRINT 36 — GLOW-UP CHALLENGE BOT (proactive category reminders)
// ══════════════════════════════════════════════════════════════════

// Categories mirror the app defaults (index.html GLOWUP_DEFAULT)
const GLOWUP_CATS = {
  glowup:  { icon:'🌅', title:'Glow-Up',     tasks:['Эрт босох (7:00)','2L ус уух','Эрт унтах (23:00)'] },
  workout: { icon:'💪', title:'Дасгал',      tasks:['Workout / дасгал','10,000 алхам'] },
  study:   { icon:'📚', title:'Хичээл',      tasks:['Хятад хэл (HSK)','30 мин унших'] },
  learn:   { icon:'🧠', title:'Шинэ мэдлэг', tasks:['1 шинэ зүйл сурах','Podcast / видео'] },
  beauty:  { icon:'✨', title:'Гоо сайхан',  tasks:['Арьс арчилгаа','Цэвэрхэн, гоё харагдах'] },
};

// Proactive nudge messages per category (time-of-day aware)
const GLOWUP_NUDGES = {
  morning: {
    cats: ['glowup', 'workout'],
    intro: '🌅 *Өглөөний Glow-Up!*\n\nӨнөөдрийг хүчтэй эхэл, Boss:',
    cta:   'Хийсэн даалгавраа `/glow` дээр тэмдэглэ. 💪',
  },
  midday: {
    cats: ['study', 'workout'],
    intro: '⚡ *Өдрийн зорилт*\n\nХагас өдөр өнгөрлөө. Дараах зүйлсээ битгий март:',
    cta:   'HSK хичээл + дасгал — challenge-ийн гол оноо. 🔥',
  },
  evening: {
    cats: ['learn', 'beauty', 'glowup'],
    intro: '🌙 *Оройн дугуй*\n\nӨдрөө дүгнэхийн өмнө:',
    cta:   'Бүгдийг тэмдэглэ → `/glow`. Маргааш бас ялалт! ✨',
  },
};

// Load user's custom glowup config from Firestore (workspace), fallback to default
async function getGlowupConfig(uid) {
  try {
    const snap = await dbPersonal.doc(`users/${uid}/config/workspace`).get();
    if (snap.exists && Array.isArray(snap.data()?.glowupTasks) && snap.data().glowupTasks.length) {
      return snap.data().glowupTasks;
    }
  } catch {}
  // Fallback: default categories as array
  return Object.entries(GLOWUP_CATS).map(([id, c]) => ({ id, ...c }));
}

// Send a proactive Glow-Up nudge for a time slot to all linked users
async function sendGlowupNudge(slot) {
  const nudge = GLOWUP_NUDGES[slot];
  if (!nudge) return;
  try {
    // GAP-07 fix: telegram_lookup-аас татна — collection('users').get() биш
    const tgUsers = await _getTelegramUsers();
    for (const { uid, chatId } of tgUsers) {
      const today = todaySH();

      // Smart: routine + glowup статус зэрэг авах
      const [routineSnap, glowSnap] = await Promise.all([
        dbPersonal.doc(`users/${uid}/routines/${today}`).get().catch(() => null),
        dbPersonal.doc(`users/${uid}/glowup/${today}`).get().catch(() => null),
      ]);
      const rt       = routineSnap?.exists ? routineSnap.data() : {};
      const glowDone = glowSnap?.exists ? (glowSnap.data()?.done || []) : [];

      // Кат → routine/glowup хийгдсэн эсэх mapping
      const catDone = {
        workout: !!rt.exercise,
        study:   !!rt.hanzi,
        glowup:  glowDone.includes('glowup'),
        learn:   glowDone.includes('learn'),
        beauty:  glowDone.includes('beauty'),
      };

      // Тухайн slot-ийн катуудаас хийгдээгүй байгааг л үлдээнэ
      const pendingCats = nudge.cats.filter(c => !catDone[c]);
      if (!pendingCats.length) {
        console.log(`[Smart Notif] ${slot} nudge skipped for ${uid} — all cats done`);
        continue;
      }

      const cfg     = await getGlowupConfig(uid);
      const doneCnt = nudge.cats.length - pendingCats.length;

      let msg = nudge.intro + '\n\n';
      if (doneCnt > 0) msg += `✅ _${doneCnt}/${nudge.cats.length} хийгдсэн_ — үлдсэн:\n\n`;

      pendingCats.forEach(catId => {
        const cat   = cfg.find(c => c.id === catId) || GLOWUP_CATS[catId];
        if (!cat) return;
        const tasks = cat.tasks || GLOWUP_CATS[catId]?.tasks || [];
        msg += `${cat.icon} *${cat.title}*\n`;
        tasks.forEach(t => { msg += `  ☐ ${t}\n`; });
        msg += '\n';
      });
      msg += '_' + nudge.cta + '_';

      await tgCall('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'Markdown' });
    }
  } catch (e) {
    console.error(`[GlowupNudge:${slot}]`, e.message);
  }
}

module.exports.sendGlowupNudge  = sendGlowupNudge;
module.exports.sendCheckpoints  = sendCheckpoints;
module.exports.sendDailyRecap   = sendDailyRecap;
module.exports.processOutbox    = processOutbox;

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

    // ── GROUP ЧАТ: зөвхөн /setgroup (Билэгээс) хүлээн авна ──────────
    // Группын chatId нь telegram_lookup-д байхгүй тул энд тусд нь шийднэ.
    const chatType = upd.message?.chat?.type || '';
    if (chatType === 'group' || chatType === 'supergroup') {
      const gtext  = (upd.message?.text || '').trim().toLowerCase();
      const fromId = String(upd.message?.from?.id || '');
      if (gtext === '/setgroup' || gtext.startsWith('/setgroup@')) {
        if (fromId === String(TG_CHAT)) {
          await dbPersonal.doc(`challenge/${CHID}/config`).set(
            { group_chat_id: rawChatId, setBy: fromId, setAt: new Date().toISOString() },
            { merge: true }
          );
          await tgCall('sendMessage', { chat_id: rawChatId, parse_mode: 'Markdown',
            text: '✅ *Бүртгэгдлээ!*\n\nЭнэ группд өдөр бүр 22:00-д Билэг vs Маралаагийн challenge дүн нийтлэгдэнэ. 🏆' });
        } else {
          await tgCall('sendMessage', { chat_id: rawChatId, text: '⛔️ Зөвхөн админ /setgroup хийнэ.' });
        }
      }
      return; // группд бусад командыг боловсруулахгүй
    }

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
    } else if (upd.message?.photo) {
      await handlePhoto(upd.message, userCtx);
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
    // Smart: өнөөдөр voice eval хийгдсэн бол reminder skip
    const today    = todaySH();
    const hskSnap  = await dbPersonal.doc(`users/${UID}/hsk/today`).get().catch(() => null);
    if (hskSnap?.exists) {
      const d = hskSnap.data();
      if (d.date === today && d.scored === true) {
        console.log('[Smart Notif] HSK scored today — reminder skipped');
        return;
      }
    }

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
