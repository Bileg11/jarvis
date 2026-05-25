'use strict';
// ── JARVIS CHAT ───────────────────────────────────────────────────
// Telegram-р JARVIS-тай ярих + routine track
// /score /dasgal /hanzi /nom /journal /us [мл] /stats /week /help

const admin = require('firebase-admin');
const fetch  = require('node-fetch');

const {
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT_ID,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  SYSTEM_USE_TOKEN:          GITHUB_TOKEN,
} = process.env;

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
}
const db = admin.firestore();

// ── HELPERS ───────────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

async function tgSend(text) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'Markdown' }),
  });
}

// ── FIRESTORE READ ────────────────────────────────────────────────
async function getToday() {
  const d = today();
  const [r, l] = await Promise.all([
    db.doc(`users/${USER_UID}/routines/${d}`).get(),
    db.doc(`users/${USER_UID}/logs/${d}`).get(),
  ]);
  const routine = r.exists ? r.data() : {};
  const log     = l.exists ? l.data() : {};
  const water   = log.water?.total_ml || 0;
  const done    = ['exercise','hanzi','read','journal'].filter(k => routine[k]).length;
  const score   = Math.min(100, Math.round(
    (water/2000*25) + (routine.exercise?20:0) +
    (routine.hanzi?20:0) + (routine.read?15:0) + (routine.journal?10:0)
  ));
  return { routine, water, done, score };
}

async function getStreak(key) {
  let s = 0;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toLocaleDateString('sv');
    const snap = await db.doc(`users/${USER_UID}/routines/${ds}`).get();
    if (!snap.exists || !snap.data()[key]) break;
    s++;
  }
  return s;
}

async function getWeekStats() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  let posts = 0, comments = 0, score7 = 0, days = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toLocaleDateString('sv');
    const [r, l, c] = await Promise.all([
      db.doc(`users/${USER_UID}/routines/${ds}`).get(),
      db.doc(`users/${USER_UID}/logs/${ds}`).get(),
      db.doc(`users/${USER_UID}/marketing/commentLog`).get(),
    ]);
    if (r.exists) {
      const rt = r.data();
      const lg = l.exists ? l.data() : {};
      const w  = lg.water?.total_ml || 0;
      score7  += Math.min(100, Math.round((w/2000*25)+(rt.exercise?20:0)+(rt.hanzi?20:0)+(rt.read?15:0)+(rt.journal?10:0)));
      days++;
    }
    if (c.exists) comments += (c.data()?.[ds] || []).length;
  }
  // Post тоо — pendingPost history байхгүй учир Firestore-с approximate
  const pendSnap = await db.doc(`users/${USER_UID}/marketing/pendingPost`).get();
  posts = pendSnap.exists ? 2 : 0; // approximate
  return { avgScore: days ? Math.round(score7/days) : 0, comments };
}

// ── ROUTINE LOG ───────────────────────────────────────────────────
async function logRoutine(key) {
  const d = today();
  await db.doc(`users/${USER_UID}/routines/${d}`).set(
    { [key]: true, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

async function logWater(ml) {
  const d = today();
  const snap = await db.doc(`users/${USER_UID}/logs/${d}`).get();
  const cur  = snap.exists ? (snap.data().water?.total_ml || 0) : 0;
  const total = cur + ml;
  await db.doc(`users/${USER_UID}/logs/${d}`).set(
    { water: { total_ml: total } }, { merge: true }
  );
  return total;
}

// ── COMMAND HANDLER ───────────────────────────────────────────────
async function handle(text) {
  const t = text.toLowerCase().trim();

  // ── /score ────────────────────────────────────────────────────
  if (t === '/score' || t === 'score') {
    const { score, done, water, routine } = await getToday();
    const [exS, hzS] = await Promise.all([getStreak('exercise'), getStreak('hanzi')]);
    return `📊 *Өнөөдрийн Score: ${score}/100*\n\n` +
      `Routine: ${done}/4\n` +
      `${routine.exercise?'✅':'❌'} Дасгал (${exS}🔥)\n` +
      `${routine.hanzi   ?'✅':'❌'} 汉字 (${hzS}🔥)\n` +
      `${routine.read    ?'✅':'❌'} Унших\n` +
      `${routine.journal ?'✅':'❌'} Journal\n` +
      `💧 Ус: ${water}мл/2000мл`;
  }

  // ── /stats ────────────────────────────────────────────────────
  if (t === '/stats' || t === 'stats') {
    const { avgScore, comments } = await getWeekStats();
    return `📈 *7 хоногийн Stats*\n\nДундаж score: ${avgScore}/100\nComment хариулсан: ${comments}`;
  }

  // ── /dasgal ───────────────────────────────────────────────────
  if (t === '/dasgal' || t.includes('дасгал') || t.includes('workout')) {
    await logRoutine('exercise');
    const { score } = await getToday();
    const s = await getStreak('exercise');
    return `💪 Дасгал тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`;
  }

  // ── /hanzi ────────────────────────────────────────────────────
  if (t === '/hanzi' || t.includes('汉字') || t.includes('hanzi')) {
    await logRoutine('hanzi');
    const { score } = await getToday();
    const s = await getStreak('hanzi');
    return `🈶 汉字 тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`;
  }

  // ── /nom ──────────────────────────────────────────────────────
  if (t === '/nom' || t.includes('уншлаа') || t.includes('ном')) {
    await logRoutine('read');
    const { score } = await getToday();
    return `📚 Уншилт тэмдэглэлээ! Score: ${score}/100`;
  }

  // ── /journal ──────────────────────────────────────────────────
  if (t === '/journal' || t.includes('journal')) {
    await logRoutine('journal');
    const { score } = await getToday();
    return `📝 Journal тэмдэглэлээ! Score: ${score}/100`;
  }

  // ── /us [мл] ──────────────────────────────────────────────────
  const waterMatch = t.match(/(\d+)\s*(мл|ml)/);
  if (t === '/us' || waterMatch) {
    const ml    = waterMatch ? parseInt(waterMatch[1]) : 250;
    const total = await logWater(ml);
    const pct   = Math.round(total/2000*100);
    return `💧 +${ml}мл! Нийт: ${total}мл/2000мл (${pct}%) ${pct >= 100 ? '🎉' : ''}`;
  }

  // ── /week ─────────────────────────────────────────────────────
  if (t === '/week' || t === 'week') {
    const qSnap = await db.doc(`users/${USER_UID}/marketing/weeklyQueue`).get();
    if (!qSnap.exists) return '📅 Долоо хоногийн план байхгүй. /plan командаар үүсгэнэ.';
    const q    = qSnap.data();
    const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    let msg = '📅 *Долоо хоногийн Post План*\n\n';
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      const ds = d.toLocaleDateString('sv');
      const dayName = ['Ня','Да','Мя','Лх','Пү','Ба','Бя'][d.getDay()];
      const morn = q[`${ds}-morning`];
      const even = q[`${ds}-evening`];
      if (morn || even) {
        msg += `*${dayName} ${ds}*\n`;
        if (morn) msg += `  🌅 ${(morn.topic||'').slice(0,50)}\n`;
        if (even) msg += `  🌆 ${(even.topic||'').slice(0,50)}\n`;
      }
    }
    return msg || '📅 Энэ долоо хоногт план байхгүй.';
  }

  // ── /help ─────────────────────────────────────────────────────
  if (t === '/help' || t === 'help') {
    return `🤖 *JARVIS Commands*\n\n` +
      `/score — Өнөөдрийн score\n` +
      `/stats — 7 хоногийн stats\n` +
      `/week — Долоо хоногийн post план\n\n` +
      `/dasgal — Дасгал хийлээ ✅\n` +
      `/hanzi — 汉字 судалсан ✅\n` +
      `/nom — Ном уншсан ✅\n` +
      `/journal — Journal бичсэн ✅\n` +
      `/us 500 — 500мл ус уусан 💧`;
  }

  return null;
}

// ── MAIN ──────────────────────────────────────────────────────────
async function run() {
  const configRef  = db.doc(`users/${USER_UID}/meta/settings`);
  const configSnap = await configRef.get();
  let offset       = configSnap.exists ? (configSnap.data().chatOffset || 0) : 0;

  const res  = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${offset}&limit=100`);
  const data = await res.json();

  if (!data.ok || !data.result?.length) { console.log('[Chat] Шинэ message байхгүй.'); return; }

  let latest = offset;

  for (const upd of data.result) {
    latest = upd.update_id + 1;

    // Зөвхөн text message, callback_query биш
    if (!upd.message?.text) continue;
    if (String(upd.message.chat.id) !== String(TG_CHAT_ID)) continue;

    const reply = await handle(upd.message.text);
    if (reply) {
      await tgSend(reply);
      console.log(`[Chat] Replied to: ${upd.message.text.slice(0,40)}`);
    }
  }

  await configRef.set({ chatOffset: latest }, { merge: true });
}

run().catch(console.error);
