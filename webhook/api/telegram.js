'use strict';
// ── JARVIS PERSONAL TELEGRAM BOT ─────────────────────────────────
// Зөвхөн Билэгийн хувийн зүйлс:
//   routine, tasks, goal, calendar, gmail, notion, brief

const fetch  = require('node-fetch');
const { dbPersonal } = require('../firebase');
const { notionSave }  = require('./notion');
const { isConfigured: calOk, parseEvent, createEvent, listTodayEvents, listUpcomingEvents, deleteEvent, formatEventTime, formatEventDate } = require('./calendar');
const { isConfigured: gmailOk, getUnreadEmails } = require('./gmail');

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TG_CHAT  = process.env.TELEGRAM_ID;
const UID      = process.env.USER_UID;

// ── TELEGRAM HELPERS ──────────────────────────────────────────────
async function tgCall(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}
const tgSend   = (text, extra = {}) =>
  tgCall('sendMessage', { chat_id: TG_CHAT, text, parse_mode: 'Markdown', ...extra });
const tgAnswer = (id, text = '') =>
  tgCall('answerCallbackQuery', { callback_query_id: id, text });

// ── PERSONAL MEMORY ───────────────────────────────────────────────
async function getBilegProfile() {
  try {
    const snap = await dbPersonal.doc(`users/${UID}/bileg/profile`).get();
    return snap.exists ? snap.data() : {};
  } catch { return {}; }
}
async function saveBilegProfile(updates) {
  try {
    await dbPersonal.doc(`users/${UID}/bileg/profile`).set(
      { ...updates, updatedAt: new Date().toISOString() }, { merge: true }
    );
  } catch {}
}

// ── TASK MANAGER ──────────────────────────────────────────────────
async function getTasks() {
  try {
    const snap = await dbPersonal.collection(`users/${UID}/tasks`)
      .where('done', '==', false).get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch { return []; }
}
async function addTask(text) {
  try {
    await dbPersonal.collection(`users/${UID}/tasks`).add({
      text, done: false, createdAt: new Date().toISOString(),
    });
  } catch {}
}
async function doneTask(index) {
  try {
    const tasks = await getTasks();
    const task  = tasks[index - 1];
    if (!task) return null;
    await dbPersonal.doc(`users/${UID}/tasks/${task.id}`).update({ done: true, doneAt: new Date().toISOString() });
    return task.text;
  } catch { return null; }
}

// ── ROUTINE HELPERS ───────────────────────────────────────────────
const todaySH = () => new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

async function getScore() {
  const d = todaySH();
  const [r, l] = await Promise.all([
    dbPersonal.doc(`users/${UID}/routines/${d}`).get(),
    dbPersonal.doc(`users/${UID}/logs/${d}`).get(),
  ]);
  const rt    = r.exists ? r.data() : {};
  const water = l.exists ? (l.data().water?.total_ml || 0) : 0;
  const score = Math.min(100, Math.round(
    (water/2000*25) + (rt.exercise?20:0) + (rt.hanzi?20:0) + (rt.read?15:0) + (rt.journal?10:0)
  ));
  return { score, routine: rt, water };
}

async function getStreak(key) {
  let s = 0;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toLocaleDateString('sv');
    const snap = await dbPersonal.doc(`users/${UID}/routines/${ds}`).get();
    if (!snap.exists || !snap.data()[key]) break;
    s++;
  }
  return s;
}

async function logRoutine(key) {
  await dbPersonal.doc(`users/${UID}/routines/${todaySH()}`).set(
    { [key]: true, updatedAt: new Date().toISOString() }, { merge: true }
  );
}

async function logWater(ml) {
  const d    = todaySH();
  const snap = await dbPersonal.doc(`users/${UID}/logs/${d}`).get();
  const cur  = snap.exists ? (snap.data().water?.total_ml || 0) : 0;
  const total = cur + ml;
  await dbPersonal.doc(`users/${UID}/logs/${d}`).set({ water: { total_ml: total } }, { merge: true });
  return total;
}

// ── WEEKLY REPORT ─────────────────────────────────────────────────
async function sendWeeklyReport() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
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

  const pct     = n => `${Math.round(n/7*100)}%`;
  const weakest = routineKeys.reduce((a, b) => cnt[a] <= cnt[b] ? a : b);
  const labels  = { exercise:'Дасгал 💪', hanzi:'汉字 🈶', read:'Уншилт 📚', journal:'Journal 📝' };

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

// ── MORNING BRIEF ─────────────────────────────────────────────────
async function sendBrief() {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const now        = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const todaySHx   = now.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
  const yesterday  = new Date(Date.now() - 86400000).toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

  const calEventsPromise = calOk() ? listTodayEvents().catch(() => []) : Promise.resolve([]);
  const gmailPromise     = gmailOk() ? getUnreadEmails(3).catch(() => []) : Promise.resolve([]);

  const [bilegSnap, tasksRaw, routineSnap, logSnap, calEvents, gmailEmails] = await Promise.all([
    dbPersonal.doc(`users/${UID}/bileg/profile`).get(),
    dbPersonal.collection(`users/${UID}/tasks`).where('done', '==', false).get().catch(() => ({ docs: [] })),
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

  // Gemini зөвлөгөө
  const context = [
    `Өнөөдөр: ${todaySHx}.`,
    done.length   ? `Хийсэн: ${done.map(r => r.label).join(', ')}.`   : 'Өчигдөр routine хийгдэхгүй.',
    missed.length ? `Хийгдэхгүй: ${missed.map(r => r.label).join(', ')}.` : '',
    `Ус: ${water}мл.`,
    bileg.goal    ? `Зорилго: "${bileg.goal}".` : '',
    tasks.length  ? `Хийх tasks: ${tasks.slice(0,3).join(', ')}.` : '',
    `Билэгийн хувийн J.A.R.V.I.S. Өчигдрийн үр дүнд тулгуурлан 2-3 өгүүлбэр проактив, шууд зөвлөгөө өг. Монголоор, анхаарлын тэмдэггүй.`,
  ].filter(Boolean).join(' ');

  let advice = 'Өнөөдөр нэг алхам урагш.';
  if (GEMINI_KEY) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: context }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.85 },
          }),
        }
      );
      const data  = await r.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const part  = parts.find(p => !p.thought && p.text) || parts[0];
      advice = part?.text?.trim() || advice;
    } catch {}
  }

  const days    = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
  const dayName = days[now.getDay()];

  let msg = `🌅 Өглөөний мэнд, Билэг.\n`;
  msg += `${dayName}, ${todaySHx} | Шанхай 07:30\n\n`;

  msg += `Routine: `;
  msg += done.length ? done.map(r => r.emoji + r.label).join(' ') : 'хийгдэхгүй';
  msg += ` | Ус: ${water}мл\n`;

  if (tasks.length) {
    msg += `\n📋 Хийх (${tasks.length}):\n`;
    tasks.forEach((t, i) => { msg += `${i+1}. ${t}\n`; });
  }

  if (bileg.goal) msg += `\n🎯 ${bileg.goal}\n`;

  if (calEvents && calEvents.length) {
    msg += `\n📅 Өнөөдрийн хуваарь:\n`;
    calEvents.forEach(e => { msg += `• ${formatEventTime(e)} — ${e.summary}\n`; });
  }

  if (gmailEmails && gmailEmails.length) {
    msg += `\n📧 Уншаагүй имэйл (${gmailEmails.length}):\n`;
    gmailEmails.forEach(e => { msg += `• ${e.from.slice(0,20)} — ${e.subject.slice(0,40)}\n`; });
  }

  msg += `\n💡 J.A.R.V.I.S:\n${advice}\n`;
  msg += `\n⚡ J.A.R.V.I.S ажиллаж байна.`;

  await tgCall('sendMessage', { chat_id: TG_CHAT, text: msg });
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
        chat_id: TG_CHAT, message_id: msgId,
        text: `🗑 Устгагдлаа.`,
      });
    } catch (e) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: `❌ Устгаж чадсангүй: ${e.message}` });
    }
    return;
  }
}

// ── TEXT HANDLER ──────────────────────────────────────────────────
async function handleText(msg) {
  const raw  = msg.text || '';
  const text = raw.toLowerCase().trim();

  // ── Routine ──────────────────────────────────────────────────────
  if (text === '/score') {
    const { score, routine, water } = await getScore();
    const [exS, hzS] = await Promise.all([getStreak('exercise'), getStreak('hanzi')]);
    await tgSend(
      `📊 *Өнөөдрийн Score: ${score}/100*\n\n` +
      `${routine.exercise?'✅':'❌'} Дасгал (${exS}🔥)\n` +
      `${routine.hanzi   ?'✅':'❌'} 汉字 (${hzS}🔥)\n` +
      `${routine.read    ?'✅':'❌'} Унших\n` +
      `${routine.journal ?'✅':'❌'} Journal\n` +
      `💧 Ус: ${water}мл/2000мл`
    );
    return;
  }

  if (text === '/dasgal' || text.includes('дасгал') || text.includes('workout')) {
    await logRoutine('exercise');
    const { score } = await getScore();
    const s = await getStreak('exercise');
    await tgSend(`💪 Дасгал тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`);
    return;
  }

  if (text === '/hanzi' || text.includes('汉字') || text.includes('hanzi')) {
    await logRoutine('hanzi');
    const { score } = await getScore();
    const s = await getStreak('hanzi');
    await tgSend(`🈶 汉字 тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`);
    return;
  }

  if (text === '/nom' || text.includes('уншлаа') || text.includes('ном уншсан')) {
    await logRoutine('read');
    const { score } = await getScore();
    await tgSend(`📚 Уншилт тэмдэглэлээ! Score: ${score}/100`);
    return;
  }

  if (text === '/journal' || text.includes('journal')) {
    await logRoutine('journal');
    const { score } = await getScore();
    await tgSend(`📝 Journal тэмдэглэлээ! Score: ${score}/100`);
    return;
  }

  const waterMatch = raw.match(/(\d+)\s*(мл|ml)/i);
  if (text === '/us' || waterMatch) {
    const ml    = waterMatch ? parseInt(waterMatch[1]) : 250;
    const total = await logWater(ml);
    await tgSend(`💧 +${ml}мл! Нийт: ${total}мл/2000мл (${Math.round(total/20)}%) ${total >= 2000 ? '🎉' : ''}`);
    return;
  }

  // ── Task Manager ─────────────────────────────────────────────────
  if (raw.startsWith('/task ') || raw.startsWith('/task\n')) {
    const taskText = raw.slice(6).trim();
    if (!taskText) { await tgSend('⚠️ `/task [тайлбар]`'); return; }
    await addTask(taskText);
    const tasks = await getTasks();
    await tgSend(`✅ Task нэмэгдлээ. Нийт: *${tasks.length}*`);
    return;
  }

  if (text === '/tasks') {
    const tasks = await getTasks();
    if (!tasks.length) { await tgSend('📋 Хийх зүйл байхгүй байна. 🎉'); return; }
    const list = tasks.map((t, i) => `${i+1}. ${t.text}`).join('\n');
    await tgSend(`📋 *Хийх зүйлүүд:*\n\n${list}\n\n_/done [дугаар]_`);
    return;
  }

  const doneMatch = raw.match(/^\/done\s+(\d+)/i);
  if (doneMatch) {
    const n    = parseInt(doneMatch[1]);
    const done = await doneTask(n);
    if (!done) { await tgSend('⚠️ Тийм дугаартай task байхгүй байна.'); return; }
    const remaining = await getTasks();
    await tgSend(`✅ *Дууслаа:* ${done}\n\nҮлдсэн: *${remaining.length}*`);
    return;
  }

  // ── Personal Memory ───────────────────────────────────────────────
  if (raw.startsWith('/goal ') || raw.startsWith('/goal\n')) {
    const goal = raw.slice(6).trim();
    await saveBilegProfile({ goal });
    await tgSend(`🎯 Зорилго хадгаллаа:\n_"${goal}"_\n\nJ.A.R.V.I.S өглөө бүр сануулна.`);
    return;
  }

  if (text === '/goal') {
    const p = await getBilegProfile();
    if (!p.goal) { await tgSend('🎯 Зорилго тавиагүй байна.\n`/goal [зорилгоо]`'); return; }
    await tgSend(`🎯 *Одоогийн зорилго:*\n_"${p.goal}"_`);
    return;
  }

  if (raw.startsWith('/focus ')) {
    const focus = raw.slice(7).trim();
    await saveBilegProfile({ focus });
    await tgSend(`🔥 Focus хадгаллаа:\n_"${focus}"_`);
    return;
  }

  // ── Notion ────────────────────────────────────────────────────────
  if (raw.startsWith('/notion ') || raw.startsWith('/notion\n')) {
    const noteText = raw.slice(8).trim();
    if (!noteText) { await tgSend('📝 `/notion [текст]`'); return; }
    const url = await notionSave(noteText, `Telegram: ${todaySH()}`, '📝');
    if (url) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: `📝 Notion-д хадгаллаа.\n\n"${noteText.slice(0,80)}${noteText.length>80?'...':''}"` });
    } else {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: '⚠️ Notion-д хадгалж чадсангүй.' });
    }
    return;
  }

  // ── Google Calendar ───────────────────────────────────────────────
  if (raw.startsWith('/cal ') || raw.startsWith('/cal\n')) {
    const calText = raw.slice(5).trim();
    if (!calText) { await tgSend('📅 `/cal маргааш 3 цагт meeting`'); return; }
    if (!calOk()) { await tgSend('⚠️ Google Calendar тохиргоогүй байна.'); return; }
    const parsed = parseEvent(calText);
    if (!parsed?.date) { await tgSend('⚠️ Ойлгож чадсангүй.\nЖишээ: `/cal маргааш 3 цагт meeting`'); return; }
    try {
      await createEvent(parsed.title, `${parsed.date}T${parsed.startTime}:00`, `${parsed.date}T${parsed.endTime}:00`, parsed.description || '');
      await tgCall('sendMessage', {
        chat_id: TG_CHAT,
        text: `✅ Calendar-д нэмэгдлээ!\n\n📌 ${parsed.title}\n📅 ${parsed.date}  ${parsed.startTime} – ${parsed.endTime}`,
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
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: `📅 *Ойрын ${events.length} event:*`, parse_mode: 'Markdown' });
      for (const e of events) {
        await tgCall('sendMessage', {
          chat_id: TG_CHAT,
          text: `📌 ${e.summary}\n🕐 ${formatEventDate(e)}  ${formatEventTime(e)}`,
          reply_markup: { inline_keyboard: [[{ text: '🗑 Устгах', callback_data: `caldel_${e.id}` }]] },
        });
      }
    } catch (e) {
      await tgSend(`❌ Calendar алдаа: ${e.message}`);
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
    await tgCall('sendMessage', { chat_id: TG_CHAT, text: '📊 7 хоногийн тайлан бэлдэж байна...' });
    try { await sendWeeklyReport(); } catch (e) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: '❌ Weekly алдаа: ' + e.message });
    }
    return;
  }

  // ── Help ──────────────────────────────────────────────────────────
  if (text === '/help') {
    await tgSend(
      `🤖 *J.A.R.V.I.S — Хувийн Bot*\n\n` +
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
      `/notion [текст] — Notion-д тэмдэглэх\n\n` +
      `📊 *Тайлан*\n` +
      `/brief — өглөөний брифинг\n` +
      `/weekly — 7 хоногийн тойм\n\n` +
      `💪 *Routine*\n` +
      `/score — score + streak\n` +
      `/dasgal · /hanzi · /nom · /journal\n` +
      `/us [мл] — ус 💧`
    );
    return;
  }
}

// ── WEBHOOK HANDLER ───────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('J.A.R.V.I.S OK');
  res.status(200).json({ ok: true });
  try {
    const upd = req.body;
    if (!upd || !UID) return;
    if (upd.callback_query) {
      await handleCallback(upd.callback_query);
    } else if (upd.message?.text && String(upd.message.chat.id) === String(TG_CHAT)) {
      await handleText(upd.message);
    }
  } catch (e) {
    console.error('[JARVIS] Error:', e.message);
  }
};

module.exports.sendWeeklyReport = sendWeeklyReport;
module.exports.sendBrief        = sendBrief;
