'use strict';
// ── JARVIS REMINDERS ──────────────────────────────────────────────
// Proactive сануулга — routine хийгдээгүй үед л явуулна
// 12:00 ус | 21:00 дасгал | 23:00 journal

const admin = require('firebase-admin');
const fetch  = require('node-fetch');

const {
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT_ID,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
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

async function run() {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const hour = now.getHours();
  const today = now.toLocaleDateString('sv');

  const [routineSnap, logSnap] = await Promise.all([
    db.doc(`users/${USER_UID}/routines/${today}`).get(),
    db.doc(`users/${USER_UID}/logs/${today}`).get(),
  ]);

  const routine = routineSnap.exists ? routineSnap.data() : {};
  const water   = logSnap.exists ? (logSnap.data().water?.total_ml || 0) : 0;

  console.log(`[Reminders] ${hour}:00 Шанхай`);

  // ── 12:00 — Ус сануулга ──────────────────────────────────────
  if (hour === 12 && water < 800) {
    await tgSend(`💧 Ус уусан уу?\nОдоогоор *${water}мл* — зорилго 2000мл!\n\n_/us 500 гэж бичээрэй_`);
    console.log('[Reminders] Water reminder sent');
    return;
  }

  // ── 21:00 — Дасгал сануулга ──────────────────────────────────
  if (hour === 21 && !routine.exercise) {
    await tgSend(`💪 Өнөөдөр дасгал хийгээгүй байна!\nОдоо 20 минут ч хангалттай. Хийчихвэл score нэмэгдэнэ 🔥\n\n_Дууссаны дараа /dasgal гэж бичээрэй_`);
    console.log('[Reminders] Exercise reminder sent');
    return;
  }

  // ── 23:00 — Journal сануулга ─────────────────────────────────
  if (hour === 23 && !routine.journal) {
    await tgSend(`📝 Journal бичсэн үү?\nӨдрийн сүүлд 5 минут — өнөөдөр юу сурсан, юу хийсэн.\n\n_Дууссаны дараа /journal гэж бичээрэй_`);
    console.log('[Reminders] Journal reminder sent');
    return;
  }

  // ── Streak алдсан сануулга (21:00) ───────────────────────────
  if (hour === 21) {
    let streak = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = d.toLocaleDateString('sv');
      const s  = await db.doc(`users/${USER_UID}/routines/${ds}`).get();
      if (s.exists && s.data().exercise) streak++;
      else break;
    }
    if (streak === 0) {
      await tgSend(`⚠️ 3+ хоног дасгал хийгээгүй байна.\nStreак тасарсан — өнөөдөр эргэж орно уу 💪`);
    }
  }

  console.log('[Reminders] Сануулга илгээх шаардлагагүй.');
}

run().catch(console.error);
